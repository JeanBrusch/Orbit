"use client"

import { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo, type ReactNode } from "react"
import { getSupabase } from "@/lib/supabase"

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

// Property interface - used for map display and property detail
export interface Property {
  id: string
  name: string
  locationText: string | null
  type: PropertyType
  value: number | null
  position: { x: number; y: number }
  highlight?: boolean
  url?: string // Source URL
  domain?: string // Source domain
  coverImage?: string | null // Cover image from og:image
  // Location accuracy for drag & drop
  locationAccuracy?: LocationAccuracy
  // Ingestion status for display
  ingestionStatus?: IngestionStatus
  // Geographic location
  lat?: number | null
  lng?: number | null
  // Technical property data (from Supabase)
  photos?: string[]
  area_privativa?: number
  area_total?: number
  bedrooms?: number
  suites?: string | number | null
  parking_spots?: string | number | null
  neighborhood?: string | null
  features?: string[]
  internal_code?: string | null
  condo_fee?: string | number | null
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

// Visual states for lead cards (manual, user-controlled)
export type LeadVisualState = "ativo" | "aguardando" | "em_decisao" | "pausado" | "encerrado"

export const LEAD_VISUAL_STATE_LABELS: Record<LeadVisualState, string> = {
  ativo: "Ativo",
  aguardando: "Aguardando",
  em_decisao: "Em decisão",
  pausado: "Pausado",
  encerrado: "Encerrado",
}

// Call outcome types - simple interaction logging
export type CallOutcome = "talked" | "not_reached" | "callback_requested"

// Contact outcome types - WhatsApp and general
export type ContactOutcome = 
  | "call_answered" 
  | "call_missed" 
  | "whatsapp_viewed" 
  | "whatsapp_replied" 
  | "no_response"



// Call log entry - logged as events in lead history
export interface CallLogEntry {
  id: string
  outcome: CallOutcome
  note?: string
  timestamp: Date
}



// Contact log entry - logged as events for any contact attempt
export interface ContactLogEntry {
  id: string
  outcome: ContactOutcome
  timestamp: Date
}

export interface FollowUpData {
  date: string
  isActive: boolean
}

// Operational memory - lightweight day-to-day tracking
export interface OperationalMemory {
  notes: string // Free-text notes (auto-saved)
  callLog: CallLogEntry[] // Call outcome history (legacy)
  contactLog: ContactLogEntry[] // Contact outcomes (calls, whatsapp, etc.)
  followUp?: FollowUpData | null
}

export interface LeadState {
  id: string
  internalState: LeadInternalState
  isPriority: boolean
  isMuted: boolean
  linkedProperty?: Property // Property associated with the lead
  // Operational memory - lightweight tracking
  memory: OperationalMemory
  // Visual state - manual, user-controlled status indicator
  visualState?: LeadVisualState
  // Provisional state - leads from external sources (e.g., WhatsApp) before full registration
  isProvisional?: boolean
  provisionalSource?: string // e.g., "whatsapp", "instagram", "website"
  // Admin data (static/local info)
  adminData?: {
    name: string
    avatar: string
    photoUrl?: string
    position: { top: string; left: string }
    createdAt: Date
    note?: string
    contact?: string
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
  setSelectedLeadId: (leadId: string | null) => void

  // Lead States (non-visual, behavioral)
  leadStates: Record<string, LeadState>
  updateLeadState: (leadId: string, state: Partial<LeadState>) => void
  initializeLeadStates: (leads: Array<{ id: string; orbit_stage?: string | null; orbit_visual_state?: string | null }>) => void
  getOrCreateLeadState: (leadId: string) => LeadState

  // Visual State Management (manual, user-controlled)
  setLeadVisualState: (leadId: string, visualState: LeadVisualState | undefined) => void
  getLeadVisualState: (leadId: string) => LeadVisualState | undefined

  // Property linking
  linkPropertyToLead: (leadId: string, property: Property) => void
  getLinkedProperty: (leadId: string) => Property | undefined

  // Operational Memory
  updateLeadNotes: (leadId: string, notes: string) => Promise<{ success: boolean; noteId?: string; capsuleItemId?: string | null }>
  logContactOutcome: (leadId: string, outcome: ContactOutcome) => void
  setFollowUpReminder: (leadId: string, date: Date) => void
  clearFollowUpReminder: (leadId: string) => void
  getLeadsWithActiveFollowUp: () => string[]

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
  addLead: (input: NewLeadInput) => Promise<string | null>
  newLeads: string[] // IDs of leads added via admin (for animations)
  atlasProperties: Property[] // Properties in Atlas (view model)
  isAdminDrawerOpen: boolean
  setIsAdminDrawerOpen: (open: boolean) => void
  activeAdminView: "menu" | "lead" | "conversation"
  setActiveAdminView: (view: "menu" | "lead" | "conversation") => void

  // Pending leads (Realtime)
  pendingLeadsCount: number
  refetchPendingCount: () => Promise<void>

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

  // ORBIT VIEW - temporary work mode by intention
  orbitView: {
    active: boolean
    query: string
    results: {
      leads: Array<{ id: string; name: string; stage: string; lastInteraction: string; intent?: string; relevanceScore?: number; snippet?: string; matchReason?: string }>
      properties: Array<{ id: string; title: string; price: string; location: string }>
      intentions: Array<{ text: string }>
    }
    sourceLeadId?: string
    /** @deprecated Use results.leads */
    leads: Array<{ id: string; name: string; stage: string; lastInteraction: string; intent?: string; relevanceScore?: number; snippet?: string; matchReason?: string }>
  }
  activateOrbitView: (query: string, sourceLeadId?: string) => Promise<number>
  deactivateOrbitView: () => void
  setOrbitViewResults: (query: string, leads: any[]) => void
}

const OrbitContext = createContext<OrbitContextValue | null>(null)

export function useOrbitContext() {
  const context = useContext(OrbitContext)
  if (!context) {
    throw new Error("useOrbitContext must be used within OrbitProvider")
  }
  return context
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



// Map orbit_stage from Supabase to internal state
function mapOrbitStageToInternalState(stage: string | null): LeadInternalState {
  switch (stage) {
    case 'deciding':
    case 'evaluating':
    case 'exploring':
    case 'curious':
      return 'focus'
    case 'resolved':
      return 'resolved'
    default:
      return 'default'
  }
}

// Map orbit_visual_state from Supabase to visual state
function mapOrbitVisualState(state: string | null): LeadVisualState | undefined {
  if (!state) return undefined
  const validStates: LeadVisualState[] = ['ativo', 'aguardando', 'em_decisao', 'pausado', 'encerrado']
  return validStates.includes(state as LeadVisualState) ? (state as LeadVisualState) : undefined
}

// Create a LeadState from Supabase lead data
function createLeadStateFromSupabase(lead: {
  id: string
  orbit_stage?: string | null
  orbit_visual_state?: string | null
}): LeadState {
  return {
    id: lead.id,
    internalState: mapOrbitStageToInternalState(lead.orbit_stage || null),
    isPriority: lead.orbit_stage === 'deciding',
    isMuted: lead.orbit_stage === 'closed' || lead.orbit_stage === 'resolved',
    memory: createDefaultMemory(),
    visualState: mapOrbitVisualState(lead.orbit_visual_state || null),
  }
}

// Create default lead state for unknown leads
function createDefaultLeadState(leadId: string): LeadState {
  return {
    id: leadId,
    internalState: 'default',
    isPriority: false,
    isMuted: false,
    memory: createDefaultMemory(),
  }
}

export function OrbitProvider({ children }: { children: ReactNode }) {
  // Lead Panel State
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [isLeadPanelOpen, setIsLeadPanelOpen] = useState(false)

  // Lead Internal States - starts empty, populated from Supabase
  const [leadStates, setLeadStates] = useState<Record<string, LeadState>>({})

  // System Mode States (placeholders)
  const [isAtlasMapActive, setIsAtlasMapActive] = useState(false)
  const [isCapsuleActive, setIsCapsuleActive] = useState(false)
  const [isFocusModeActive, setIsFocusModeActive] = useState(false)
  
  // ORBIT VIEW state - temporary work mode by intention
  const [orbitViewState, setOrbitViewState] = useState<{
    active: boolean
    query: string
    results: {
      leads: any[]
      properties: any[]
      intentions: any[]
    }
    sourceLeadId?: string
  }>({
    active: false,
    query: '',
    results: {
      leads: [],
      properties: [],
      intentions: [],
    },
    sourceLeadId: undefined,
  })

  // Computed orbitView with compatibility alias
  const orbitView = useMemo(() => ({
    ...orbitViewState,
    leads: orbitViewState.results.leads
  }), [orbitViewState])
  const [atlasInvokeContext, setAtlasInvokeContext] = useState<{
    leadId?: string
    leadName?: string
    onPropertySelected?: (property: Property) => void
  } | null>(null)

  const [pendingLeadsCount, setPendingLeadsCount] = useState(0)
  const pendingChannelRef = useRef<any>(null)

  const fetchPendingCount = useCallback(async () => {
    try {
      const supabase = getSupabase()
      const { count } = await supabase
        .from("leads")
        .select("*", { count: "exact", head: true })
        .eq("state", "pending")
      setPendingLeadsCount(count || 0)
    } catch (err) {
      console.error("[ORBIT CONTEXT] Error fetching pending count:", err)
    }
  }, [])

  // Centralized Realtime for Pending Leads (Layer 1)
  useEffect(() => {
    fetchPendingCount()

    const supabase = getSupabase()
    const channel = supabase
      .channel("orbit-pending-global")
      .on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table: "leads" },
        (payload: any) => {
          // Reatuaiza se houver mudança de estado para pending ou de um pending
          if (payload.new?.state === "pending" || payload.old?.state === "pending") {
            fetchPendingCount()
          }
        }
      )
      .subscribe()

    pendingChannelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchPendingCount])

  // Admin-added items
  const [newLeads, setNewLeads] = useState<string[]>([])
  const [atlasProperties, setAtlasProperties] = useState<Property[]>([])
  const [isAdminDrawerOpen, setIsAdminDrawerOpen] = useState(false)
  const [activeAdminView, setActiveAdminView] = useState<"menu" | "lead" | "conversation">("menu")

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

  // Initialize lead states from Supabase data
  const initializeLeadStates = useCallback((leads: Array<{ id: string; orbit_stage?: string | null; orbit_visual_state?: string | null }>) => {
    setLeadStates((prev) => {
      const newStates = { ...prev }
      for (const lead of leads) {
        if (!newStates[lead.id]) {
          newStates[lead.id] = createLeadStateFromSupabase(lead)
        } else {
          // Update existing with Supabase data but preserve local cycle state
          newStates[lead.id] = {
            ...newStates[lead.id],
            visualState: mapOrbitVisualState(lead.orbit_visual_state || null),
            internalState: mapOrbitStageToInternalState(lead.orbit_stage || null),
          }
        }
      }
      return newStates
    })
  }, [])

  // Get or create lead state on demand
  const getOrCreateLeadState = useCallback((leadId: string): LeadState => {
    // Note: This still needs to read leadStates to return the value.
    // To make this stable, we'd need a Ref or shift the logic.
    // However, calling it inside render is common, so it's tricky.
    // For now, let's keep it but recognize it's a bottleneck.
    const existing = leadStates[leadId]
    if (existing) return existing
    
    const newState = createDefaultLeadState(leadId)
    // We update async to avoid state-update-during-render warning
    setTimeout(() => {
      setLeadStates((prev) => {
        if (prev[leadId]) return prev
        return { ...prev, [leadId]: newState }
      })
    }, 0)
    return newState
  }, [leadStates])

  // Visual State Management - persists to Supabase
  const setLeadVisualState = useCallback(async (leadId: string, visualState: LeadVisualState | undefined) => {
    // Update local state immediately
    setLeadStates((prev) => {
      const existing = prev[leadId] || createDefaultLeadState(leadId)
      return {
        ...prev,
        [leadId]: {
          ...existing,
          visualState,
        },
      }
    })
    
    // Persist to Supabase via API
    try {
      await fetch('/api/lead/visual-state', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, visualState: visualState || null })
      })
    } catch (error) {
      console.error('Error persisting visual state:', error)
    }
  }, [])

  const getLeadVisualState = useCallback(
    (leadId: string) => {
      return leadStates[leadId]?.visualState
    },
    [leadStates]
  )

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

  // ORBIT VIEW functions
  const activateOrbitView = useCallback(async (query: string, sourceLeadId?: string) => {
    if (!query.trim()) return
    
    try {
      const response = await fetch('/api/search/orbit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim(), sourceLeadId }),
      })
      
      if (!response.ok) {
        console.error('Failed to search notes')
        return
      }
      
      const data = await response.json()
      const leads = data.results || []
      
      setOrbitViewState({
        active: true,
        query: query.trim(),
        results: {
          leads, // Assuming backend returns some structure
          properties: [], // For now, properties might come from a different logic
          intentions: [],
        },
        sourceLeadId,
      })
      
      return leads.length
    } catch (err) {
      console.error('Error activating ORBIT VIEW:', err)
      return 0
    }
  }, [])

  const deactivateOrbitView = useCallback(() => {
    setOrbitViewState({
      active: false,
      query: '',
      results: {
        leads: [],
        properties: [],
        intentions: [],
      },
      sourceLeadId: undefined,
    })
  }, [])

  const setOrbitViewResults = useCallback((query: string, leads: any[]) => {
    setOrbitViewState({
      active: true,
      query,
      results: {
        leads,
        properties: [],
        intentions: [],
      },
    })
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

  // Admin: Add a new lead (persists to Supabase)
  const addLead = useCallback(async (input: NewLeadInput): Promise<string | null> => {
    try {
      const response = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: input.name,
          phone: input.contact,
          origin: input.provisionalSource || 'manual',
          note: input.note,
        }),
      })

      if (!response.ok) {
        console.error('Failed to create lead in Supabase')
        return null
      }

      const data = await response.json()
      const newId = data.id

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
      const staticPositions = [
        { top: 32, left: 28 },
        { top: 35, left: 58 },
        { top: 58, left: 22 },
        { top: 68, left: 62 },
        { top: 42, left: 12 },
      ]
      existingPositions.push(...staticPositions)

      const position = findNonCollidingPosition(existingPositions)

      setLeadStates((prev) => ({
        ...prev,
        [newId]: {
          id: newId,
          internalState: "default",
          isPriority: false,
          isMuted: false,
          isProvisional: input.isProvisional,
          provisionalSource: input.provisionalSource,
          memory: createDefaultMemory(),
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

      setNewLeads((prev) => [...prev, newId])

      setTimeout(() => {
        setNewLeads((prev) => prev.filter((id) => id !== newId))
      }, 3000)

      // Auto-open chat panel for the new lead
      openLeadPanel(newId)

      return newId
    } catch (err) {
      console.error('Error creating lead:', err)
      return null
    }
  }, [leadStates, findNonCollidingPosition, openLeadPanel])

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
      locationText: null,
      type: "apartment",
      value: null,
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
      if (data.priceCents) updated.value = data.priceCents
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

  // Operational Memory Actions
  const updateLeadNotes = useCallback(async (leadId: string, notes: string): Promise<{ success: boolean; noteId?: string }> => {
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
    
    try {
      const response = await fetch('/api/note', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          leadId, 
          content: notes,
        }),
      })

      if (!response.ok) {
        console.error('[NOTE] API error:', response.status)
        return { success: false }
      }

      const data = await response.json()
      
      return {
        success: true,
        noteId: data.noteId,
      }
    } catch (err) {
      console.error('[NOTE] Error persisting note:', err)
      return { success: false }
    }
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
    
    // Decrement follow-up on human action (call counts as explicit touch)
    if (outcome === 'call_answered' || outcome === 'call_missed') {
      // NOTE: Follow-up logic is now managed by cognitive state. 
      // Manual decrement removed to avoid conflict.
    }
  }, [])



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
  }, [locationUndoState, ingestedProperties])

  const getLeadsWithActiveFollowUp = useCallback(() => {
    return Object.keys(leadStates).filter(id => leadStates[id].memory.followUp?.isActive)
  }, [leadStates])

  const setFollowUpReminder = useCallback((leadId: string, date: Date) => {
    setLeadStates((prev) => {
      const state = prev[leadId]
      if (!state) return prev
      return {
        ...prev,
        [leadId]: {
          ...state,
          memory: {
            ...state.memory,
            followUp: {
              date: date.toISOString(),
              isActive: true
            }
          }
        }
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
            followUp: null
          }
        }
      }
    })
  }, [])

  const value = useMemo(() => ({
    // Lead Focus Panel
    selectedLeadId,
    isLeadPanelOpen,
    openLeadPanel,
    closeLeadPanel,
    setSelectedLeadId,

    // Lead States
    leadStates,
    updateLeadState,
    initializeLeadStates,
    getOrCreateLeadState,

    // Visual States
    setLeadVisualState,
    getLeadVisualState,

    // Property linking
    linkPropertyToLead,
    getLinkedProperty,

    // Operational Memory
    updateLeadNotes,
    logCallOutcome,
    logContactOutcome,
    setFollowUpReminder,
    clearFollowUpReminder,
    getLeadsWithActiveFollowUp,

    // System Mode
    isAtlasMapActive,
    isCapsuleActive,
    isFocusModeActive,
    atlasInvokeContext,
    invokeAtlasMap,
    closeAtlasMap,
    emergeCapsule,
    toggleFocusMode,

    // Admin
    addLead,
    newLeads,
    setNewLeads,
    atlasProperties,
    isAdminDrawerOpen,
    setIsAdminDrawerOpen,
    activeAdminView,
    setActiveAdminView,

    // Ingestion
    ingestedProperties,
    ingestPropertyFromUrl,
    updateIngestedProperty,
    getIngestedProperty,
    propertyEvents,

    // Location
    updatePropertyLocation,
    locationUndoState,
    undoLocationChange,

    // Orbit View
    orbitView,
    activateOrbitView,
    deactivateOrbitView,
    setOrbitViewResults,

    // Pending leads
    pendingLeadsCount,
    refetchPendingCount: fetchPendingCount,
  }), [
    selectedLeadId,
    isLeadPanelOpen,
    openLeadPanel,
    closeLeadPanel,
    setSelectedLeadId,
    leadStates,
    updateLeadState,
    initializeLeadStates,
    getOrCreateLeadState,
    setLeadVisualState,
    getLeadVisualState,
    linkPropertyToLead,
    getLinkedProperty,
    updateLeadNotes,
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
    isAdminDrawerOpen,
    activeAdminView,
    ingestedProperties,
    ingestPropertyFromUrl,
    updateIngestedProperty,
    getIngestedProperty,
    propertyEvents,
    updatePropertyLocation,
    locationUndoState,
    undoLocationChange,
    orbitView,
    activateOrbitView,
    deactivateOrbitView,
    setOrbitViewResults,
    pendingLeadsCount,
    fetchPendingCount,
  ])

  return (
    <OrbitContext.Provider value={value}>
      {children}
    </OrbitContext.Provider>
  )
}
