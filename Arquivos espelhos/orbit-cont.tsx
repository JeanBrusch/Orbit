"use client"

import { createContext, useContext, useState, useCallback, type ReactNode } from "react"

// Location visibility for public views
export type LocationVisibility = "visible" | "approximate" | "hidden"

// Location accuracy - how precise is the property's location
export type LocationAccuracy = "unknown" | "approximate" | "precise"

// Ingestion status - properties are created via ingestion only
export type IngestionStatus = "ingesting" | "partial" | "ready" | "failed"

// Source type detected from URL
export type SourceType = "portal" | "builder_site" | "pdf" | "generic"

// Property type classification (derived from ingestion)
export type PropertyType = "apartment" | "house" | "penthouse" | "commercial"

// Ingested Property - the ONLY property model (no manual creation)
// Properties only exist if materialized in the Atlas via Pocket Listing ingestion
export interface IngestedProperty {
  id: string
  sourceUrl: string // Always stored - the origin link
  sourceType: SourceType
  ingestionStatus: IngestionStatus
  // Extracted data (nullable - filled by ingestion pipeline)
  title: string
  priceCents: number | null // Nullable until extracted
  description: string | null
  images: string[] // Image URLs/refs
  // Location (nullable - may be detected or set later)
  lat: number | null
  lng: number | null
  locationAccuracy: LocationAccuracy // unknown | approximate | precise
  locationVisibility: LocationVisibility
  // Metadata
  createdAt: Date
  updatedAt: Date
  // Ingestion details
  ingestionError?: string
  rawExtractedData?: Record<string, unknown> // Raw data from scraping
}

// Legacy Property interface - used for map display
export interface Property {
  id: string
  name: string
  address: string
  type: PropertyType
  price: string
  area: string
  bedrooms?: number
  position: { x: number; y: number }
  highlight?: boolean
  url?: string // Source URL
  // Location accuracy for drag & drop
  locationAccuracy?: LocationAccuracy
  // Ingestion status for display
  ingestionStatus?: IngestionStatus
  // Reference to full ingested property
  ingestedData?: IngestedProperty
}

// Domain events for property system
export interface PropertyEvent {
  type: "property.ingested" | "property.ingestion_failed" | "property.updated" | "property.location_updated"
  payload: {
    propertyId: string
    sourceUrl: string
    title: string
    lat?: number | null
    lng?: number | null
    locationAccuracy?: LocationAccuracy
  }
  timestamp: Date
}

// Undo state for location changes
export interface LocationUndoState {
  propertyId: string
  previousLat: number | null
  previousLng: number | null
  previousAccuracy: LocationAccuracy
  timestamp: Date
}

// Input type for adding new leads via admin
export interface NewLeadInput {
  name: string
  contact: string
  note?: string
  photoUrl?: string // Real contact photo
  isProvisional?: boolean // Lead from external source before full registration
  provisionalSource?: string // e.g., "whatsapp", "instagram"
}

export type LeadInternalState = "priority" | "focus" | "resolved" | "default"

// Call outcome types - simple interaction logging
export type CallOutcome = "talked" | "not_reached" | "callback_requested"

// Contact outcome types - WhatsApp and general
export type ContactOutcome = 
  | "call_answered" 
  | "call_missed" 
  | "whatsapp_viewed" 
  | "whatsapp_replied" 
  | "no_response"

// Cycle end reasons
export type CycleEndReason = "bought" | "gave_up" | "no_return"

// Call log entry - logged as events in lead history
export interface CallLogEntry {
  id: string
  outcome: CallOutcome
  note?: string
  timestamp: Date
}

// Follow-up reminder
export interface FollowUpReminder {
  date: Date
  note?: string
  isActive: boolean
}

// Decision Cycle - a period of active engagement with a lead
export interface DecisionCycle {
  id: string
  name: string
  startedAt: Date
  endedAt?: Date
  isActive: boolean
  capsuleData: any[] // Properties sent during this cycle
  endReason?: CycleEndReason // Why the cycle was closed
}

// Contact log entry - logged as events for any contact attempt
export interface ContactLogEntry {
  id: string
  outcome: ContactOutcome
  timestamp: Date
}

// Operational memory - lightweight day-to-day tracking
export interface OperationalMemory {
  notes: string // Free-text notes (auto-saved)
  callLog: CallLogEntry[] // Call outcome history (legacy)
  contactLog: ContactLogEntry[] // Contact outcomes (calls, whatsapp, etc.)
  followUp?: FollowUpReminder // Next follow-up reminder
}

export interface LeadState {
  id: string
  internalState: LeadInternalState
  isPriority: boolean
  isMuted: boolean
  linkedProperty?: Property // Property associated with the lead
  cycles: DecisionCycle[] // All cycles for this lead
  activeCycleId?: string // Currently active cycle (only one at a time)
  // Operational memory - lightweight tracking
  memory: OperationalMemory
  // Provisional state - leads from external sources (e.g., WhatsApp) before full registration
  isProvisional?: boolean
  provisionalSource?: string // e.g., "whatsapp", "instagram", "website"
  // Admin-added lead data
  adminData?: {
    name: string
    contact: string
    note?: string
    avatar: string
    photoUrl?: string // Real contact photo URL
    position: { top: string; left: string }
    createdAt: Date
    isProvisional?: boolean
    provisionalSource?: string
  }
}

interface OrbitContextValue {
  // Lead Focus Panel
  selectedLeadId: string | null
  isLeadPanelOpen: boolean
  openLeadPanel: (leadId: string) => void
  closeLeadPanel: () => void

  // Lead Expanded View (optional unified view: Chat + Capsule + Atlas)
  isExpandedViewOpen: boolean
  expandedViewLeadId: string | null
  openExpandedView: (leadId: string) => void
  closeExpandedView: () => void

  // Lead States (non-visual, behavioral)
  leadStates: Record<string, LeadState>
  updateLeadState: (leadId: string, state: Partial<LeadState>) => void

  // Property linking
  linkPropertyToLead: (leadId: string, property: Property) => void
  getLinkedProperty: (leadId: string) => Property | undefined

  // Decision Cycles
  getActiveCycle: (leadId: string) => DecisionCycle | undefined
  getAllCycles: (leadId: string) => DecisionCycle[]
  startNewCycle: (leadId: string, cycleName?: string) => void
  endCycle: (leadId: string, reason?: CycleEndReason) => void
  updateCycleCapsule: (leadId: string, capsuleData: any[]) => void
  hasActiveCycle: (leadId: string) => boolean

  // Operational Memory
  updateLeadNotes: (leadId: string, notes: string) => void
  logCallOutcome: (leadId: string, outcome: CallOutcome, note?: string) => void
  logContactOutcome: (leadId: string, outcome: ContactOutcome) => void
  setFollowUpReminder: (leadId: string, date: Date, note?: string) => void
  clearFollowUpReminder: (leadId: string) => void
  getLeadsWithActiveFollowUp: () => string[] // Returns lead IDs with due follow-ups

  // System Mode Hooks (placeholders for future integration)
  isAtlasMapActive: boolean
  isCapsuleActive: boolean
  isFocusModeActive: boolean
  atlasInvokeContext: {
    leadId?: string
    leadName?: string
    onPropertySelected?: (property: Property) => void
  } | null
  invokeAtlasMap: (context?: { leadId?: string; leadName?: string; onPropertySelected?: (property: Property) => void }) => void
  closeAtlasMap: () => void
  emergeCapsule: () => void
  toggleFocusMode: () => void

  // Admin functions
  addLead: (input: NewLeadInput) => void
  newLeads: string[] // IDs of leads added via admin (for animations)
  atlasProperties: Property[] // Properties in Atlas (view model)

  // Property Ingestion Pipeline (Pocket Listing is the ONLY source)
  ingestedProperties: IngestedProperty[] // All ingested properties
  ingestPropertyFromUrl: (url: string) => Promise<IngestedProperty> // Start ingestion pipeline
  updateIngestedProperty: (id: string, data: Partial<IngestedProperty>) => void // Manual corrections only
  getIngestedProperty: (id: string) => IngestedProperty | undefined
  propertyEvents: PropertyEvent[] // Event log

  // Property Location Management (drag & drop in Atlas)
  updatePropertyLocation: (id: string, lat: number, lng: number, accuracy?: LocationAccuracy) => void
  locationUndoState: LocationUndoState | null
  undoLocationChange: () => void
}

const OrbitContext = createContext<OrbitContextValue | null>(null)

export function useOrbitContext() {
  const context = useContext(OrbitContext)
  if (!context) {
    throw new Error("useOrbitContext must be used within OrbitProvider")
  }
  return context
}

// Generate a cycle name based on date
function generateCycleName(): string {
  const now = new Date()
  const month = now.toLocaleDateString("pt-BR", { month: "short" })
  const year = now.getFullYear()
  return `${month} ${year}`
}

// Create a new cycle
function createCycle(name?: string): DecisionCycle {
  return {
    id: crypto.randomUUID(),
    name: name || generateCycleName(),
    startedAt: new Date(),
    isActive: true,
    capsuleData: [],
  }
}

// Create default operational memory
function createDefaultMemory(): OperationalMemory {
  return {
    notes: "",
    callLog: [],
    contactLog: [],
    followUp: undefined,
  }
}

// Initial lead states (non-visual)
const initialLeadStates: Record<string, LeadState> = {
  "1": {
    id: "1",
    internalState: "priority",
    isPriority: true,
    isMuted: false,
    cycles: [createCycle()],
    activeCycleId: undefined, // Will be set below
    memory: createDefaultMemory(),
  },
  "2": {
    id: "2",
    internalState: "default",
    isPriority: false,
    isMuted: false,
    cycles: [createCycle()],
    activeCycleId: undefined,
    memory: createDefaultMemory(),
  },
  "3": {
    id: "3",
    internalState: "default",
    isPriority: false,
    isMuted: false,
    cycles: [createCycle()],
    activeCycleId: undefined,
    memory: createDefaultMemory(),
  },
  "4": {
    id: "4",
    internalState: "resolved",
    isPriority: false,
    isMuted: true,
    cycles: [], // No active cycle - neutral
    activeCycleId: undefined,
    memory: createDefaultMemory(),
  },
  "5": {
    id: "5",
    internalState: "focus",
    isPriority: true,
    isMuted: false,
    cycles: [createCycle()],
    activeCycleId: undefined,
    memory: createDefaultMemory(),
  },
}

// Set active cycle IDs for leads with cycles
Object.keys(initialLeadStates).forEach((leadId) => {
  const state = initialLeadStates[leadId]
  if (state.cycles.length > 0) {
    state.activeCycleId = state.cycles[0].id
  }
})

export function OrbitProvider({ children }: { children: ReactNode }) {
  // Lead Panel State
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [isLeadPanelOpen, setIsLeadPanelOpen] = useState(false)

  // Lead Expanded View State
  const [isExpandedViewOpen, setIsExpandedViewOpen] = useState(false)
  const [expandedViewLeadId, setExpandedViewLeadId] = useState<string | null>(null)

  // Lead Internal States
  const [leadStates, setLeadStates] = useState<Record<string, LeadState>>(initialLeadStates)

  // System Mode States (placeholders)
  const [isAtlasMapActive, setIsAtlasMapActive] = useState(false)
  const [isCapsuleActive, setIsCapsuleActive] = useState(false)
  const [isFocusModeActive, setIsFocusModeActive] = useState(false)
  const [atlasInvokeContext, setAtlasInvokeContext] = useState<{
    leadId?: string
    leadName?: string
    onPropertySelected?: (property: Property) => void
  } | null>(null)

  // Admin-added items
  const [newLeads, setNewLeads] = useState<string[]>([])
  const [atlasProperties, setAtlasProperties] = useState<Property[]>([])

  // Property Ingestion State
  const [ingestedProperties, setIngestedProperties] = useState<IngestedProperty[]>([])
  const [propertyEvents, setPropertyEvents] = useState<PropertyEvent[]>([])
  const [locationUndoState, setLocationUndoState] = useState<LocationUndoState | null>(null)

  // Lead Panel Actions
  const openLeadPanel = useCallback((leadId: string) => {
    setSelectedLeadId(leadId)
    setIsLeadPanelOpen(true)
  }, [])

  const closeLeadPanel = useCallback(() => {
    setIsLeadPanelOpen(false)
    // Delay clearing the ID to allow exit animation
    setTimeout(() => setSelectedLeadId(null), 300)
  }, [])

  // Lead Expanded View Actions
  const openExpandedView = useCallback((leadId: string) => {
    setExpandedViewLeadId(leadId)
    setIsExpandedViewOpen(true)
    // Close the regular lead panel if open
    setIsLeadPanelOpen(false)
  }, [])

  const closeExpandedView = useCallback(() => {
    setIsExpandedViewOpen(false)
    // Delay clearing the ID to allow exit animation
    setTimeout(() => setExpandedViewLeadId(null), 300)
  }, [])

  // Lead State Updates
  const updateLeadState = useCallback((leadId: string, state: Partial<LeadState>) => {
    setLeadStates((prev) => ({
      ...prev,
      [leadId]: {
        ...prev[leadId],
        ...state,
      },
    }))
  }, [])

  // Property Linking
  const linkPropertyToLead = useCallback((leadId: string, property: Property) => {
    setLeadStates((prev) => ({
      ...prev,
      [leadId]: {
        ...prev[leadId],
        linkedProperty: property,
      },
    }))
  }, [])

  const getLinkedProperty = useCallback(
    (leadId: string) => {
      return leadStates[leadId]?.linkedProperty
    },
    [leadStates]
  )

  // System Mode Actions
  const invokeAtlasMap = useCallback((context?: { leadId?: string; leadName?: string; onPropertySelected?: (property: Property) => void }) => {
    setAtlasInvokeContext(context || null)
    setIsAtlasMapActive(true)
  }, [])

  const closeAtlasMap = useCallback(() => {
    setIsAtlasMapActive(false)
    setAtlasInvokeContext(null)
  }, [])

  const emergeCapsule = useCallback(() => {
    setIsCapsuleActive(true)
  }, [])

  const toggleFocusMode = useCallback(() => {
    setIsFocusModeActive((prev) => !prev)
  }, [])

  // Helper to find a non-colliding position for a new lead
  const findNonCollidingPosition = useCallback((existingPositions: { top: number; left: number }[]): { top: number; left: number } => {
    const minDistance = 12 // Minimum distance between nodes (percentage)
    const maxAttempts = 50
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const angle = Math.random() * 2 * Math.PI
      const radius = 25 + Math.random() * 20 // 25-45% from center
      const top = 50 + Math.sin(angle) * radius
      const left = 50 + Math.cos(angle) * radius
      
      // Check for collisions with existing positions
      let hasCollision = false
      for (const existing of existingPositions) {
        const distance = Math.sqrt(
          Math.pow(top - existing.top, 2) + Math.pow(left - existing.left, 2)
        )
        if (distance < minDistance) {
          hasCollision = true
          break
        }
      }
      
      if (!hasCollision) {
        return { top, left }
      }
    }
    
    // Fallback: return a position even if it might overlap
    const angle = Math.random() * 2 * Math.PI
    const radius = 25 + Math.random() * 20
    return {
      top: 50 + Math.sin(angle) * radius,
      left: 50 + Math.cos(angle) * radius,
    }
  }, [])

  // Admin: Add a new lead
  const addLead = useCallback((input: NewLeadInput) => {
    const newId = `admin-${Date.now()}`
    
    // Generate initials from name
    const initials = input.name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)

    // Gather existing positions from all leads
    const existingPositions: { top: number; left: number }[] = []
    Object.values(leadStates).forEach((state) => {
      if (state.adminData?.position) {
        existingPositions.push({
          top: parseFloat(state.adminData.position.top),
          left: parseFloat(state.adminData.position.left),
        })
      }
    })
    // Add static lead positions
    const staticPositions = [
      { top: 32, left: 28 },
      { top: 35, left: 58 },
      { top: 58, left: 22 },
      { top: 68, left: 62 },
      { top: 42, left: 12 },
    ]
    existingPositions.push(...staticPositions)

    // Find a non-colliding position
    const position = findNonCollidingPosition(existingPositions)

    // Create the lead state
    const newCycle = createCycle()
    setLeadStates((prev) => ({
      ...prev,
      [newId]: {
        id: newId,
        internalState: "default",
        isPriority: false,
        isMuted: false,
        isProvisional: input.isProvisional,
        provisionalSource: input.provisionalSource,
        cycles: [newCycle],
        activeCycleId: newCycle.id,
        memory: createDefaultMemory(),
        // Store additional admin data
        adminData: {
          name: input.name,
          contact: input.contact,
          note: input.note,
          avatar: initials,
          photoUrl: input.photoUrl,
          position: { top: `${position.top}%`, left: `${position.left}%` },
          createdAt: new Date(),
          isProvisional: input.isProvisional,
          provisionalSource: input.provisionalSource,
        },
      },
    }))

    // Track as new lead for animation
    setNewLeads((prev) => [...prev, newId])

    // Clear from newLeads after animation completes
    setTimeout(() => {
      setNewLeads((prev) => prev.filter((id) => id !== newId))
    }, 3000)
  }, [leadStates, findNonCollidingPosition])

  // Emit a property event
  const emitPropertyEvent = useCallback((type: PropertyEvent["type"], property: IngestedProperty) => {
    const event: PropertyEvent = {
      type,
      payload: {
        propertyId: property.id,
        sourceUrl: property.sourceUrl,
        title: property.title,
        lat: property.lat,
        lng: property.lng,
      },
      timestamp: new Date(),
    }
    setPropertyEvents((prev) => [...prev, event])
  }, [])

  // Detect source type from URL
  const detectSourceType = useCallback((url: string): SourceType => {
    const domain = new URL(url).hostname.toLowerCase()
    
    // Known portal domains
    const portalDomains = ["vivareal.com.br", "zapimoveis.com.br", "olx.com.br", "imovelweb.com.br", "quintoandar.com.br"]
    if (portalDomains.some(d => domain.includes(d))) return "portal"
    
    // Builder site patterns
    const builderPatterns = ["construtora", "incorporadora", "empreendimento", "lancamento"]
    if (builderPatterns.some(p => domain.includes(p) || url.includes(p))) return "builder_site"
    
    // PDF detection
    if (url.endsWith(".pdf")) return "pdf"
    
    return "generic"
  }, [])

  // Simulate scraping/parsing (in production, this would call an API)
  const simulateIngestion = useCallback(async (url: string, sourceType: SourceType): Promise<Partial<IngestedProperty>> => {
    // Simulate network delay for scraping
    await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1000))
    
    try {
      const urlObj = new URL(url)
      const pathParts = urlObj.pathname.split("/").filter(Boolean)
      const lastPart = pathParts[pathParts.length - 1] || "imovel"
      
      // Extract title from URL
      const title = lastPart
        .replace(/-/g, " ")
        .replace(/_/g, " ")
        .split(" ")
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ")
      
      // Simulate different extraction success rates
      const hasPrice = Math.random() > 0.3
      const hasLocation = Math.random() > 0.4
      const hasImages = Math.random() > 0.2
      
      return {
        title: title || `Imóvel via ${urlObj.hostname}`,
        priceCents: hasPrice ? Math.floor(500000 + Math.random() * 2000000) * 100 : null,
        description: `Imóvel importado de ${urlObj.hostname}`,
        images: hasImages ? [`https://placehold.co/800x600/1a1a1a/666?text=${encodeURIComponent(title)}`] : [],
        lat: hasLocation ? -5.8 - Math.random() * 0.15 : null,
        lng: hasLocation ? -35.2 + Math.random() * 0.2 : null,
        rawExtractedData: { url, sourceType, extractedAt: new Date().toISOString() },
      }
    } catch {
      throw new Error("Failed to parse URL content")
    }
  }, [])

  // Main ingestion pipeline - creates property in Atlas
  const ingestPropertyFromUrl = useCallback(async (url: string): Promise<IngestedProperty> => {
    const now = new Date()
    const id = `prop-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const sourceType = detectSourceType(url)
    
    // Create property immediately with "ingesting" status
    const initialProperty: IngestedProperty = {
      id,
      sourceUrl: url,
      sourceType,
      ingestionStatus: "ingesting",
      title: "Carregando...",
      priceCents: null,
      description: null,
      images: [],
      lat: null,
      lng: null,
      locationAccuracy: "unknown",
      locationVisibility: "approximate",
      createdAt: now,
      updatedAt: now,
    }
    
    // Add to state immediately (property exists in Atlas right away)
    setIngestedProperties(prev => [...prev, initialProperty])
    
    // Create view model for Atlas display
    const viewProperty: Property = {
      id,
      name: "Carregando...",
      address: "Processando link...",
      type: "apartment",
      price: "—",
      area: "—",
      position: {
        x: 20 + Math.random() * 60,
        y: 20 + Math.random() * 60,
      },
      highlight: true,
      url,
      ingestionStatus: "ingesting",
      ingestedData: initialProperty,
    }
    setAtlasProperties(prev => [...prev, viewProperty])
    
    // Open Atlas to show the ingesting property
    setIsAtlasMapActive(true)
    
    try {
      // Run the ingestion pipeline
      const extractedData = await simulateIngestion(url, sourceType)
      
      // Determine final status based on extraction completeness
      const hasRequiredFields = !!extractedData.title
      const hasOptionalFields = !!extractedData.priceCents && !!extractedData.lat
      const finalStatus: IngestionStatus = hasRequiredFields 
        ? (hasOptionalFields ? "ready" : "partial")
        : "failed"
      
      // Update the ingested property
      const updatedProperty: IngestedProperty = {
        ...initialProperty,
        ...extractedData,
        ingestionStatus: finalStatus,
        updatedAt: new Date(),
      }
      
      setIngestedProperties(prev => 
        prev.map(p => p.id === id ? updatedProperty : p)
      )
      
      // Update view model
      setAtlasProperties(prev => 
        prev.map(p => {
          if (p.id !== id) return p
          return {
            ...p,
            name: extractedData.title || "Imóvel sem título",
            address: extractedData.lat ? "Localização detectada" : "Localização pendente",
            price: extractedData.priceCents 
              ? `R$ ${(extractedData.priceCents / 100).toLocaleString("pt-BR")}`
              : "A confirmar",
            position: extractedData.lat && extractedData.lng
              ? {
                  x: ((extractedData.lng + 35.2) / 0.3) * 80 + 10,
                  y: ((-extractedData.lat - 5.8) / 0.2) * 70 + 15,
                }
              : p.position,
            ingestionStatus: finalStatus,
            ingestedData: updatedProperty,
          }
        })
      )
      
      // Emit success event
      emitPropertyEvent("property.ingested", updatedProperty)
      
      return updatedProperty
    } catch (error) {
      // Even failed ingestion creates a stub property
      const failedProperty: IngestedProperty = {
        ...initialProperty,
        ingestionStatus: "failed",
        title: "Falha na importação",
        ingestionError: error instanceof Error ? error.message : "Unknown error",
        updatedAt: new Date(),
      }
      
      setIngestedProperties(prev => 
        prev.map(p => p.id === id ? failedProperty : p)
      )
      
      setAtlasProperties(prev => 
        prev.map(p => {
          if (p.id !== id) return p
          return {
            ...p,
            name: "Falha na importação",
            address: url,
            ingestionStatus: "failed",
            ingestedData: failedProperty,
          }
        })
      )
      
      // Emit failure event
      emitPropertyEvent("property.ingestion_failed", failedProperty)
      
      return failedProperty
    }
  }, [detectSourceType, simulateIngestion, emitPropertyEvent])

  // Update ingested property (for manual corrections only)
  const updateIngestedProperty = useCallback((id: string, data: Partial<IngestedProperty>) => {
    setIngestedProperties(prev => {
      const index = prev.findIndex(p => p.id === id)
      if (index === -1) return prev
      
      const updated: IngestedProperty = {
        ...prev[index],
        ...data,
        updatedAt: new Date(),
      }
      
      const newList = [...prev]
      newList[index] = updated
      
      emitPropertyEvent("property.updated", updated)
      
      return newList
    })
    
    // Update view model
    setAtlasProperties(prev => {
      const index = prev.findIndex(p => p.id === id)
      if (index === -1) return prev
      
      const updated = { ...prev[index] }
      if (data.title) updated.name = data.title
      if (data.priceCents) updated.price = `R$ ${(data.priceCents / 100).toLocaleString("pt-BR")}`
      if (data.lat && data.lng) {
        updated.position = {
          x: ((data.lng + 35.2) / 0.3) * 80 + 10,
          y: ((-data.lat - 5.8) / 0.2) * 70 + 15,
        }
      }
      
      const newList = [...prev]
      newList[index] = updated
      return newList
    })
  }, [emitPropertyEvent])

  // Get ingested property by ID
  const getIngestedProperty = useCallback((id: string): IngestedProperty | undefined => {
    return ingestedProperties.find(p => p.id === id)
  }, [ingestedProperties])

  // Decision Cycle Actions
  const getActiveCycle = useCallback(
    (leadId: string): DecisionCycle | undefined => {
      const state = leadStates[leadId]
      if (!state || !state.activeCycleId) return undefined
      return state.cycles.find((c) => c.id === state.activeCycleId && c.isActive)
    },
    [leadStates]
  )

  const getAllCycles = useCallback(
    (leadId: string): DecisionCycle[] => {
      return leadStates[leadId]?.cycles || []
    },
    [leadStates]
  )

  const hasActiveCycle = useCallback(
    (leadId: string): boolean => {
      return !!getActiveCycle(leadId)
    },
    [getActiveCycle]
  )

  const startNewCycle = useCallback((leadId: string, cycleName?: string) => {
    const newCycle = createCycle(cycleName)
    setLeadStates((prev) => ({
      ...prev,
      [leadId]: {
        ...prev[leadId],
        cycles: [...(prev[leadId]?.cycles || []), newCycle],
        activeCycleId: newCycle.id,
      },
    }))
  }, [])

  const endCycle = useCallback((leadId: string, reason?: CycleEndReason) => {
    setLeadStates((prev) => {
      const state = prev[leadId]
      if (!state || !state.activeCycleId) return prev

      return {
        ...prev,
        [leadId]: {
          ...state,
          cycles: state.cycles.map((c) =>
            c.id === state.activeCycleId
              ? { ...c, isActive: false, endedAt: new Date(), endReason: reason }
              : c
          ),
          activeCycleId: undefined,
        },
      }
    })
  }, [])

  const updateCycleCapsule = useCallback((leadId: string, capsuleData: any[]) => {
    setLeadStates((prev) => {
      const state = prev[leadId]
      if (!state || !state.activeCycleId) return prev

      return {
        ...prev,
        [leadId]: {
          ...state,
          cycles: state.cycles.map((c) =>
            c.id === state.activeCycleId ? { ...c, capsuleData } : c
          ),
        },
      }
    })
  }, [])

  // Operational Memory Actions
  const updateLeadNotes = useCallback((leadId: string, notes: string) => {
    setLeadStates((prev) => {
      const state = prev[leadId]
      if (!state) return prev
      return {
        ...prev,
        [leadId]: {
          ...state,
          memory: { ...state.memory, notes },
        },
      }
    })
  }, [])

  const logCallOutcome = useCallback((leadId: string, outcome: CallOutcome, note?: string) => {
    const entry: CallLogEntry = {
      id: crypto.randomUUID(),
      outcome,
      note,
      timestamp: new Date(),
    }
    setLeadStates((prev) => {
      const state = prev[leadId]
      if (!state) return prev
      return {
        ...prev,
        [leadId]: {
          ...state,
          memory: {
            ...state.memory,
            callLog: [entry, ...state.memory.callLog], // Most recent first
          },
        },
      }
    })
  }, [])

  const logContactOutcome = useCallback((leadId: string, outcome: ContactOutcome) => {
    const entry: ContactLogEntry = {
      id: crypto.randomUUID(),
      outcome,
      timestamp: new Date(),
    }
    setLeadStates((prev) => {
      const state = prev[leadId]
      if (!state) return prev
      return {
        ...prev,
        [leadId]: {
          ...state,
          memory: {
            ...state.memory,
            contactLog: [entry, ...state.memory.contactLog], // Most recent first
          },
        },
      }
    })
  }, [])

  const setFollowUpReminder = useCallback((leadId: string, date: Date, note?: string) => {
    setLeadStates((prev) => {
      const state = prev[leadId]
      if (!state) return prev
      return {
        ...prev,
        [leadId]: {
          ...state,
          memory: {
            ...state.memory,
            followUp: { date, note, isActive: true },
          },
        },
      }
    })
  }, [])

  const clearFollowUpReminder = useCallback((leadId: string) => {
    setLeadStates((prev) => {
      const state = prev[leadId]
      if (!state) return prev
      return {
        ...prev,
        [leadId]: {
          ...state,
          memory: {
            ...state.memory,
            followUp: undefined,
          },
        },
      }
    })
  }, [])

  const getLeadsWithActiveFollowUp = useCallback((): string[] => {
    const now = new Date()
    return Object.values(leadStates)
      .filter((state) => {
        if (!state.memory.followUp?.isActive) return false
        return new Date(state.memory.followUp.date) <= now
      })
      .map((state) => state.id)
  }, [leadStates])

  // Update property location (drag & drop in Atlas)
  const updatePropertyLocation = useCallback((id: string, lat: number, lng: number, accuracy: LocationAccuracy = "precise") => {
    // Find the property to save undo state
    const property = ingestedProperties.find(p => p.id === id)
    if (property) {
      // Save undo state
      setLocationUndoState({
        propertyId: id,
        previousLat: property.lat,
        previousLng: property.lng,
        previousAccuracy: property.locationAccuracy,
        timestamp: new Date(),
      })

      // Clear undo state after 10 seconds
      setTimeout(() => {
        setLocationUndoState(prev => 
          prev?.propertyId === id ? null : prev
        )
      }, 10000)
    }

    // Update ingested property
    setIngestedProperties(prev => 
      prev.map(p => p.id === id 
        ? { ...p, lat, lng, locationAccuracy: accuracy, updatedAt: new Date() }
        : p
      )
    )

    // Update view model (atlas properties)
    setAtlasProperties(prev => 
      prev.map(p => {
        if (p.id !== id) return p
        return {
          ...p,
          locationAccuracy: accuracy,
          position: {
            x: ((lng + 35.2) / 0.3) * 80 + 10,
            y: ((-lat - 5.8) / 0.2) * 70 + 15,
          },
          address: accuracy === "precise" ? "Localização definida" : "Localização aproximada",
        }
      })
    )

    // Emit event
    const updatedProperty = ingestedProperties.find(p => p.id === id)
    if (updatedProperty) {
      const event: PropertyEvent = {
        type: "property.location_updated",
        payload: {
          propertyId: id,
          sourceUrl: updatedProperty.sourceUrl,
          title: updatedProperty.title,
          lat,
          lng,
          locationAccuracy: accuracy,
        },
        timestamp: new Date(),
      }
      setPropertyEvents(prev => [...prev, event])
    }
  }, [ingestedProperties])

  // Undo last location change (within 10 second window)
  const undoLocationChange = useCallback(() => {
    if (!locationUndoState) return

    const { propertyId, previousLat, previousLng, previousAccuracy } = locationUndoState

    // Restore previous location
    setIngestedProperties(prev => 
      prev.map(p => p.id === propertyId 
        ? { ...p, lat: previousLat, lng: previousLng, locationAccuracy: previousAccuracy, updatedAt: new Date() }
        : p
      )
    )

    // Restore view model
    setAtlasProperties(prev => 
      prev.map(p => {
        if (p.id !== propertyId) return p
        return {
          ...p,
          locationAccuracy: previousAccuracy,
          position: previousLat !== null && previousLng !== null
            ? {
                x: ((previousLng + 35.2) / 0.3) * 80 + 10,
                y: ((-previousLat - 5.8) / 0.2) * 70 + 15,
              }
            : p.position,
          address: previousAccuracy === "precise" 
            ? "Localização definida" 
            : previousAccuracy === "approximate" 
              ? "Localização aproximada"
              : "Localização pendente",
        }
      })
    )

    // Clear undo state
    setLocationUndoState(null)
  }, [locationUndoState])

  const value: OrbitContextValue = {
    selectedLeadId,
    isLeadPanelOpen,
    openLeadPanel,
    closeLeadPanel,
    // Lead Expanded View
    isExpandedViewOpen,
    expandedViewLeadId,
    openExpandedView,
    closeExpandedView,
    leadStates,
    updateLeadState,
    linkPropertyToLead,
    getLinkedProperty,
    getActiveCycle,
    getAllCycles,
    startNewCycle,
    endCycle,
    updateCycleCapsule,
    hasActiveCycle,
    updateLeadNotes,
    logCallOutcome,
    logContactOutcome,
    setFollowUpReminder,
    clearFollowUpReminder,
    getLeadsWithActiveFollowUp,
    isAtlasMapActive,
    isCapsuleActive,
    isFocusModeActive,
    atlasInvokeContext,
    invokeAtlasMap,
    closeAtlasMap,
    emergeCapsule,
    toggleFocusMode,
    addLead,
    newLeads,
    atlasProperties,
    // Property Ingestion Pipeline
    ingestedProperties,
    ingestPropertyFromUrl,
    updateIngestedProperty,
    getIngestedProperty,
    propertyEvents,
    // Property Location Management
    updatePropertyLocation,
    locationUndoState,
    undoLocationChange,
  }

  return <OrbitContext.Provider value={value}>{children}</OrbitContext.Provider>
}
