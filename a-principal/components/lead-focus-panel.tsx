"use client"

import React from "react"

import { useState, useEffect, useRef, useCallback } from "react"
import { 
  X, 
  Send, 
  ImageIcon, 
  Paperclip, 
  MapPin, 
  Clock,
  Check,
  CheckCheck,
  Building2,
  Heart,
  Eye,
  XCircle,
  ChevronDown,
  ChevronUp,
  Share2,
  Link2,
  CheckCircle2,
  RotateCcw,
  Play,
  Archive
} from "lucide-react"
import type { Property } from "./atlas-map"
import { useOrbitContext, type CycleEndReason } from "./orbit-context"
import { LeadMemory } from "./lead-memory"
import { OrbitInsightBar } from "./orbit-insight-bar"

export type LeadInternalState = "priority" | "focus" | "resolved" | "default"

export interface LeadFocusData {
  id: string
  name: string
  avatar: string
  status: "online" | "typing" | "offline"
  statusLabel: string
  lastSeen: string
  internalState: LeadInternalState
}

// Property state for the Capsule View
export type PropertyState = "sent" | "favorited" | "discarded" | "visited"

export interface SentProperty {
  property: Property
  state: PropertyState
  sentAt: Date
  stateChangedAt?: Date
}

interface Message {
  id: string
  content: string
  timestamp: string
  type: "sent" | "received"
  status?: "sent" | "delivered" | "read"
  media?: {
    type: "image" | "file"
    name: string
    url?: string
  }[]
  linkedProperty?: Property // Property linked to this message
}

const leadsDatabase: Record<string, LeadFocusData> = {
  "1": {
    id: "1",
    name: "Marina Costa",
    avatar: "MC",
    status: "online",
    statusLabel: "online",
    lastSeen: "agora",
    internalState: "priority",
  },
  "2": {
    id: "2",
    name: "Lucas Ferreira",
    avatar: "LF",
    status: "typing",
    statusLabel: "digitando...",
    lastSeen: "há 5min",
    internalState: "default",
  },
  "3": {
    id: "3",
    name: "Ana Rodrigues",
    avatar: "AR",
    status: "offline",
    statusLabel: "visto por último há 1h",
    lastSeen: "há 1h",
    internalState: "default",
  },
  "4": {
    id: "4",
    name: "Pedro Santos",
    avatar: "PS",
    status: "offline",
    statusLabel: "visto por último há 3h",
    lastSeen: "há 3h",
    internalState: "resolved",
  },
  "5": {
    id: "5",
    name: "Julia Mendes",
    avatar: "JM",
    status: "online",
    statusLabel: "online",
    lastSeen: "agora",
    internalState: "focus",
  },
}

// Sample conversation data
const sampleMessages: Message[] = [
  {
    id: "1",
    content: "Olá! Vi que vocês têm unidades disponíveis no Laguna Premium. Ainda tem cobertura?",
    timestamp: "10:30",
    type: "received",
  },
  {
    id: "2",
    content: "Oi Marina! Sim, temos algumas opções de cobertura disponíveis. Você prefere vista mar ou piscina privativa?",
    timestamp: "10:32",
    type: "sent",
    status: "read",
  },
  {
    id: "3",
    content: "Vista mar seria incrível! Qual a metragem?",
    timestamp: "10:33",
    type: "received",
  },
  {
    id: "4",
    content: "A cobertura com vista mar tem 248m², com 4 suítes e terraço gourmet. Posso enviar as fotos?",
    timestamp: "10:35",
    type: "sent",
    status: "read",
  },
  {
    id: "5",
    content: "Sim, por favor! E qual o valor?",
    timestamp: "10:36",
    type: "received",
  },
]

interface LeadFocusPanelProps {
  leadId: string | null
  isOpen: boolean
  onClose: () => void
  onAtlasMapInvoke?: () => void
  onCapsuleEmerge?: () => void
  onFocusModeToggle?: () => void
}

export function LeadFocusPanel({
  leadId,
  isOpen,
  onClose,
}: LeadFocusPanelProps) {
  const [lead, setLead] = useState<LeadFocusData | null>(null)
  const [messages, setMessages] = useState<Message[]>(sampleMessages)
  const [inputValue, setInputValue] = useState("")
  const [selectedImages, setSelectedImages] = useState<File[]>([])
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [linkedProperty, setLinkedProperty] = useState<Property | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isAtlasOpen, setIsAtlasOpen] = useState(false) // Declare isAtlasOpen
  
  // Capsule View state - tracks all sent properties and their states
  const [sentProperties, setSentProperties] = useState<SentProperty[]>([])
  const [isCapsuleExpanded, setIsCapsuleExpanded] = useState(true)
  
  // Magic Link state
  const [magicLinkUrl, setMagicLinkUrl] = useState<string | null>(null)
  const [isLinkCopied, setIsLinkCopied] = useState(false)
  const [isGeneratingLink, setIsGeneratingLink] = useState(false)
  
  // Cycle end reason picker state
  const [showEndCycleReason, setShowEndCycleReason] = useState(false)
  
  // Decision Cycles - from context
  const {
    getActiveCycle,
    getAllCycles,
    startNewCycle,
    endCycle,
    updateCycleCapsule,
    hasActiveCycle,
  } = useOrbitContext()
  
  // Get cycle data for current lead
  const activeCycle = leadId ? getActiveCycle(leadId) : undefined
  const allCycles = leadId ? getAllCycles(leadId) : []
  const isInActiveCycle = leadId ? hasActiveCycle(leadId) : false
  
  // Capsule is active when at least one property has been sent AND we're in an active cycle
  const isCapsuleActive = sentProperties.length > 0 && isInActiveCycle

  useEffect(() => {
    if (leadId && leadsDatabase[leadId]) {
      setLead(leadsDatabase[leadId])
    } else {
      setLead(null)
    }
  }, [leadId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Load capsule data from active cycle when lead changes
  useEffect(() => {
    if (activeCycle) {
      setSentProperties(activeCycle.capsuleData)
    } else {
      setSentProperties([])
    }
    // Reset magic link when switching leads
    setMagicLinkUrl(null)
    setIsLinkCopied(false)
  }, [leadId, activeCycle])

  // Sync sentProperties to cycle capsule data
  useEffect(() => {
    if (leadId && isInActiveCycle && sentProperties.length > 0) {
      updateCycleCapsule(leadId, sentProperties)
    }
  }, [leadId, isInActiveCycle, sentProperties, updateCycleCapsule])

  // Keyboard handler for escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose])

  const handleSend = useCallback(() => {
    if (!inputValue.trim() && selectedImages.length === 0 && selectedFiles.length === 0) return

    const newMessage: Message = {
      id: Date.now().toString(),
      content: inputValue,
      timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      type: "sent",
      status: "sent",
      media: [
        ...selectedImages.map(img => ({ type: "image" as const, name: img.name })),
        ...selectedFiles.map(file => ({ type: "file" as const, name: file.name })),
      ],
    }

    setMessages(prev => [...prev, newMessage])
    setInputValue("")
    setSelectedImages([])
    setSelectedFiles([])
  }, [inputValue, selectedImages, selectedFiles])

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setSelectedImages(prev => [...prev, ...files])
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setSelectedFiles(prev => [...prev, ...files])
  }

  const removeSelectedImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index))
  }

  const removeSelectedFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }

  // Get invokeAtlasMap from context
  const { invokeAtlasMap } = useOrbitContext()
  
  const handleSelectPropertyOnMap = useCallback(() => {
    // Invoke the global Atlas Focus Surface with callback to receive the selected property
    window.open(`/atlas?leadId=${leadId}&tab=acervo`, "_blank")
  }, [leadId])

// Send property to lead - this triggers the Capsule evolution
  const handleSendProperty = useCallback(() => {
    if (!linkedProperty || !isInActiveCycle) return
    
    // Add property to sent list with initial "sent" state
    const newSentProperty: SentProperty = {
      property: linkedProperty,
      state: "sent",
      sentAt: new Date(),
    }
    
    setSentProperties(prev => [...prev, newSentProperty])
    
    // Add a message indicating the property was sent
    const propertyMessage: Message = {
      id: `prop-${Date.now()}`,
      content: `Imóvel enviado: ${linkedProperty.name}`,
      timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      type: "sent",
      status: "sent",
      linkedProperty: linkedProperty,
    }
    
    setMessages(prev => [...prev, propertyMessage])
    setLinkedProperty(null) // Clear the linked property after sending
  }, [linkedProperty])

  // Toggle property state in the Capsule
  const handleTogglePropertyState = useCallback((propertyId: string, newState: PropertyState) => {
    setSentProperties(prev => 
      prev.map(sp => 
        sp.property.id === propertyId 
          ? { ...sp, state: newState, stateChangedAt: new Date() }
          : sp
      )
    )
  }, [])

  // Get the appropriate icon and color for property state
  const getPropertyStateConfig = (state: PropertyState) => {
    switch (state) {
      case "favorited":
        return { icon: Heart, color: "text-rose-400", bg: "bg-rose-500/20", label: "Favoritado" }
      case "discarded":
        return { icon: XCircle, color: "text-zinc-400", bg: "bg-zinc-500/20", label: "Descartado" }
      case "visited":
        return { icon: Eye, color: "text-emerald-400", bg: "bg-emerald-500/20", label: "Visitado" }
      default:
        return { icon: Send, color: "text-[var(--orbit-glow)]", bg: "bg-[var(--orbit-glow)]/20", label: "Enviado" }
    }
  }

  // Generate magic link for client access
  const handleGenerateMagicLink = useCallback(async () => {
    if (!leadId || sentProperties.length === 0) return
    
    setIsGeneratingLink(true)
    
    // Generate a secure unique token (in production, this would be server-side)
    const token = Array.from(crypto.getRandomValues(new Uint8Array(24)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
    
    // Create the magic link URL
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
    const url = `${baseUrl}/capsule/${token}`
    
    // Simulate server delay for generating the link
    await new Promise(resolve => setTimeout(resolve, 300))
    
    setMagicLinkUrl(url)
    setIsGeneratingLink(false)
  }, [leadId, sentProperties.length])

  // Copy magic link to clipboard
  const handleCopyMagicLink = useCallback(async () => {
    if (!magicLinkUrl) return
    
    try {
      await navigator.clipboard.writeText(magicLinkUrl)
      setIsLinkCopied(true)
      setTimeout(() => setIsLinkCopied(false), 2000)
    } catch (err) {
      // Fallback for older browsers
      const textarea = document.createElement('textarea')
      textarea.value = magicLinkUrl
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setIsLinkCopied(true)
      setTimeout(() => setIsLinkCopied(false), 2000)
    }
  }, [magicLinkUrl])

  const handleCloseAtlas = useCallback(() => {
    setIsAtlasOpen(false)
  }, [])

  const handlePropertySelected = useCallback((property: Property) => {
    setLinkedProperty(property)
    setIsAtlasOpen(false)
  }, [])

  if (!isOpen || !lead) return null

  return (
    <>
      {/* Backdrop - semi-transparent to keep Orbit View visible */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] animate-backdrop-fade"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel - slides in from right */}
      <div
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-[var(--orbit-bg)] border-l border-[var(--orbit-glass-border)] shadow-[-8px_0_30px_rgba(0,0,0,0.5)] animate-panel-slide-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lead-focus-title"
      >
        {/* Compact Header */}
        <div className="flex items-center gap-3 border-b border-[var(--orbit-glass-border)] bg-[var(--orbit-glass)] px-4 py-3">
          {/* Avatar */}
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--orbit-glow)]/20 to-[var(--orbit-glow)]/5 text-sm font-medium text-[var(--orbit-text)]">
            {lead.avatar}
            {/* Online indicator */}
            {lead.status === "online" && (
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[var(--orbit-bg)] bg-emerald-400" />
            )}
          </div>

          {/* Name & Status */}
          <div className="flex-1 min-w-0">
            <h2 id="lead-focus-title" className="truncate text-sm font-medium text-[var(--orbit-text)]">
              {lead.name}
            </h2>
            <p className={`text-xs ${lead.status === "typing" ? "text-emerald-400" : "text-[var(--orbit-text-muted)]"}`}>
              {lead.statusLabel}
            </p>
          </div>

          {/* Last interaction signal */}
          <div className="flex items-center gap-1 text-xs text-[var(--orbit-text-muted)]">
            <Clock className="h-3 w-3" />
            <span>{lead.lastSeen}</span>
          </div>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--orbit-text-muted)] transition-colors hover:bg-[var(--orbit-glow)]/10 hover:text-[var(--orbit-text)]"
            aria-label="Fechar painel"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Decision Cycle Indicator - subtle, natural */}
        <div className="flex items-center justify-between border-b border-[var(--orbit-glass-border)]/50 bg-[var(--orbit-bg)]/50 px-4 py-2">
          {isInActiveCycle && activeCycle ? (
            <>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] text-[var(--orbit-text-muted)]">
                  {activeCycle.name}
                </span>
                {allCycles.length > 1 && (
                  <span className="text-[10px] text-[var(--orbit-text-muted)]/50">
                    ({allCycles.filter(c => !c.isActive).length} anterior{allCycles.filter(c => !c.isActive).length !== 1 ? 'es' : ''})
                  </span>
                )}
              </div>
              {showEndCycleReason ? (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      if (leadId) {
                        endCycle(leadId, "bought")
                        setShowEndCycleReason(false)
                      }
                    }}
                    className="flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-400 transition-colors hover:bg-emerald-500/20"
                  >
                    Comprou
                  </button>
                  <button
                    onClick={() => {
                      if (leadId) {
                        endCycle(leadId, "gave_up")
                        setShowEndCycleReason(false)
                      }
                    }}
                    className="flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-1 text-[10px] text-amber-400 transition-colors hover:bg-amber-500/20"
                  >
                    Desistiu
                  </button>
                  <button
                    onClick={() => {
                      if (leadId) {
                        endCycle(leadId, "no_return")
                        setShowEndCycleReason(false)
                      }
                    }}
                    className="flex items-center gap-1 rounded-md bg-zinc-500/10 px-2 py-1 text-[10px] text-zinc-400 transition-colors hover:bg-zinc-500/20"
                  >
                    Sem retorno
                  </button>
                  <button
                    onClick={() => setShowEndCycleReason(false)}
                    className="flex h-5 w-5 items-center justify-center rounded-md text-[var(--orbit-text-muted)] transition-colors hover:bg-[var(--orbit-glass)]"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowEndCycleReason(true)}
                  className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] text-[var(--orbit-text-muted)] transition-colors hover:bg-[var(--orbit-glass)] hover:text-[var(--orbit-text)]"
                >
                  <Archive className="h-3 w-3" />
                  Encerrar ciclo
                </button>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
                <span className="text-[10px] text-[var(--orbit-text-muted)]">
                  Sem ciclo ativo
                </span>
                {allCycles.length > 0 && (
                  <span className="text-[10px] text-[var(--orbit-text-muted)]/50">
                    ({allCycles.length} arquivado{allCycles.length !== 1 ? 's' : ''})
                  </span>
                )}
              </div>
              <button
                onClick={() => leadId && startNewCycle(leadId)}
                className="flex items-center gap-1.5 rounded-md bg-[var(--orbit-glow)]/10 px-2 py-1 text-[10px] text-[var(--orbit-glow)] transition-colors hover:bg-[var(--orbit-glow)]/20"
              >
                <Play className="h-3 w-3" />
                Iniciar ciclo
              </button>
            </>
          )}
        </div>

        {/* Operational Memory - Quick Notes, Call Outcomes, Follow-up */}
        {leadId && <LeadMemory leadId={leadId} />}

        {/* Orbit Cognitive Analysis — dados reais do motor de produção */}
        {leadId && <OrbitInsightBar leadId={leadId} />}

        {/* Capsule View - Decision Space Timeline (appears after first property sent) */}
        {isCapsuleActive && (
          <div className="border-b border-[var(--orbit-glass-border)] bg-[var(--orbit-bg-secondary)]/50 animate-text-fade-in">
            {/* Capsule Header */}
            <button
              onClick={() => setIsCapsuleExpanded(!isCapsuleExpanded)}
              className="flex w-full items-center justify-between px-4 py-2.5 text-left transition-colors hover:bg-[var(--orbit-glow)]/5"
            >
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--orbit-glow)]/10">
                  <Building2 className="h-3.5 w-3.5 text-[var(--orbit-glow)]" />
                </div>
                <span className="text-xs font-medium text-[var(--orbit-text)]">
                  Espaço de Decisão
                </span>
                <span className="rounded-full bg-[var(--orbit-glow)]/20 px-2 py-0.5 text-[10px] font-medium text-[var(--orbit-glow)]">
                  {sentProperties.length} {sentProperties.length === 1 ? "imóvel" : "imóveis"}
                </span>
              </div>
              {isCapsuleExpanded ? (
                <ChevronUp className="h-4 w-4 text-[var(--orbit-text-muted)]" />
              ) : (
                <ChevronDown className="h-4 w-4 text-[var(--orbit-text-muted)]" />
              )}
            </button>

            {/* Capsule Content - Property Cards with States */}
            {isCapsuleExpanded && (
              <div className="px-4 pb-3 space-y-2">
                {sentProperties.map((sp) => {
                  const stateConfig = getPropertyStateConfig(sp.state)
                  const StateIcon = stateConfig.icon
                  
                  return (
                    <div
                      key={sp.property.id}
                      className={`rounded-xl border border-[var(--orbit-glass-border)] bg-[var(--orbit-glass)] p-3 transition-all ${
                        sp.state === "discarded" ? "opacity-60" : ""
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {/* Property Icon with State */}
                        <div className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${stateConfig.bg} ${stateConfig.color}`}>
                          <Building2 className="h-5 w-5" />
                          {/* State indicator badge */}
                          <span className={`absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full ${stateConfig.bg} border border-[var(--orbit-bg)]`}>
                            <StateIcon className={`h-2.5 w-2.5 ${stateConfig.color}`} />
                          </span>
                        </div>

                        {/* Property Info */}
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-sm font-medium text-[var(--orbit-text)]">
                            {sp.property.name}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-[var(--orbit-text-muted)]">
                              {sp.property.price}
                            </span>
                            <span className="text-[var(--orbit-text-muted)]">·</span>
                            <span className="text-[10px] text-[var(--orbit-text-muted)]">
                              {sp.property.area}
                            </span>
                          </div>
                        </div>

                        {/* State Label */}
                        <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-medium ${stateConfig.bg} ${stateConfig.color}`}>
                          {stateConfig.label}
                        </span>
                      </div>

                      {/* State Toggle Buttons - Decision Timeline */}
                      <div className="mt-3 flex gap-1.5">
                        <button
                          onClick={() => handleTogglePropertyState(sp.property.id, "sent")}
                          className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-[10px] font-medium transition-all ${
                            sp.state === "sent"
                              ? "bg-[var(--orbit-glow)] text-[var(--orbit-bg)]"
                              : "bg-[var(--orbit-glow)]/10 text-[var(--orbit-glow)] hover:bg-[var(--orbit-glow)]/20"
                          }`}
                        >
                          <Send className="h-3 w-3" />
                          Enviado
                        </button>
                        <button
                          onClick={() => handleTogglePropertyState(sp.property.id, "visited")}
                          className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-[10px] font-medium transition-all ${
                            sp.state === "visited"
                              ? "bg-emerald-500 text-white"
                              : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                          }`}
                        >
                          <Eye className="h-3 w-3" />
                          Visitado
                        </button>
                        <button
                          onClick={() => handleTogglePropertyState(sp.property.id, "favorited")}
                          className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-[10px] font-medium transition-all ${
                            sp.state === "favorited"
                              ? "bg-rose-500 text-white"
                              : "bg-rose-500/10 text-rose-400 hover:bg-rose-500/20"
                          }`}
                        >
                          <Heart className="h-3 w-3" />
                          Favorito
                        </button>
                        <button
                          onClick={() => handleTogglePropertyState(sp.property.id, "discarded")}
                          className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-[10px] font-medium transition-all ${
                            sp.state === "discarded"
                              ? "bg-zinc-500 text-white"
                              : "bg-zinc-500/10 text-zinc-400 hover:bg-zinc-500/20"
                          }`}
                        >
                          <XCircle className="h-3 w-3" />
                          Descartado
                        </button>
                      </div>

                      {/* Timeline indicator */}
                      <div className="mt-2 flex items-center gap-1.5 text-[10px] text-[var(--orbit-text-muted)]">
                        <Clock className="h-3 w-3" />
                        <span>
                          Enviado {sp.sentAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          {sp.stateChangedAt && sp.state !== "sent" && (
                            <> · {stateConfig.label.toLowerCase()} {sp.stateChangedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</>
                          )}
                        </span>
                      </div>
                    </div>
                  )
                })}

                {/* Share with Client - Magic Link */}
                <div className="mt-3 pt-3 border-t border-[var(--orbit-glass-border)]/50">
                  {!magicLinkUrl ? (
                    <button
                      onClick={handleGenerateMagicLink}
                      disabled={isGeneratingLink}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--orbit-glass-border)] bg-transparent py-2.5 text-xs font-medium text-[var(--orbit-text-muted)] transition-all hover:border-[var(--orbit-glow)]/50 hover:text-[var(--orbit-glow)] disabled:opacity-50"
                    >
                      {isGeneratingLink ? (
                        <>
                          <div className="h-3.5 w-3.5 animate-spin rounded-full border border-current border-t-transparent" />
                          Gerando link...
                        </>
                      ) : (
                        <>
                          <Share2 className="h-3.5 w-3.5" />
                          Compartilhar com cliente
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 rounded-xl bg-[var(--orbit-bg)] px-3 py-2">
                        <Link2 className="h-3.5 w-3.5 shrink-0 text-[var(--orbit-glow)]" />
                        <span className="flex-1 truncate text-xs text-[var(--orbit-text-muted)]">
                          {magicLinkUrl}
                        </span>
                        <button
                          onClick={handleCopyMagicLink}
                          className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-medium transition-all ${
                            isLinkCopied
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-[var(--orbit-glow)]/10 text-[var(--orbit-glow)] hover:bg-[var(--orbit-glow)]/20"
                          }`}
                        >
                          {isLinkCopied ? (
                            <span className="flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Copiado
                            </span>
                          ) : (
                            "Copiar"
                          )}
                        </button>
                      </div>
                      <p className="text-center text-[10px] text-[var(--orbit-text-muted)]">
                        Link exclusivo para {lead.name.split(" ")[0]}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Conversation Timeline - WhatsApp style */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scrollbar-thin">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.type === "sent" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`relative max-w-[85%] rounded-2xl px-3 py-2 ${
                  message.type === "sent"
                    ? "bg-[var(--orbit-glow)]/20 text-[var(--orbit-text)] rounded-br-sm"
                    : "bg-[var(--orbit-glass)] text-[var(--orbit-text)] rounded-bl-sm"
                }`}
              >
                {/* Property Card in message (if linked) */}
                {message.linkedProperty && (
                  <div className="mb-2 rounded-lg border border-[var(--orbit-glow)]/30 bg-[var(--orbit-bg)]/50 p-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--orbit-glow)]/20 text-[var(--orbit-glow)]">
                        <Building2 className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-xs font-medium text-[var(--orbit-text)]">
                          {message.linkedProperty.name}
                        </p>
                        <p className="text-[10px] text-[var(--orbit-glow)]">
                          {message.linkedProperty.price} · {message.linkedProperty.area}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Media attachments */}
                {message.media && message.media.length > 0 && (
                  <div className="mb-2 space-y-1">
                    {message.media.map((m, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 rounded bg-black/20 px-2 py-1 text-xs"
                      >
                        {m.type === "image" ? (
                          <ImageIcon className="h-3 w-3 text-[var(--orbit-glow)]" />
                        ) : (
                          <Paperclip className="h-3 w-3 text-[var(--orbit-glow)]" />
                        )}
                        <span className="truncate">{m.name}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Message content */}
                <p className="text-sm leading-relaxed">{message.content}</p>

                {/* Timestamp & status */}
                <div className={`mt-1 flex items-center gap-1 ${message.type === "sent" ? "justify-end" : ""}`}>
                  <span className="text-[10px] text-[var(--orbit-text-muted)]">{message.timestamp}</span>
                  {message.type === "sent" && message.status && (
                    <span className="text-[var(--orbit-glow)]">
                      {message.status === "read" ? (
                        <CheckCheck className="h-3 w-3" />
                      ) : (
                        <Check className="h-3 w-3" />
                      )}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Selected Media Preview */}
        {(selectedImages.length > 0 || selectedFiles.length > 0) && (
          <div className="border-t border-[var(--orbit-glass-border)] bg-[var(--orbit-glass)] px-4 py-2">
            <div className="flex flex-wrap gap-2">
              {selectedImages.map((img, i) => (
                <div
                  key={`img-${i}`}
                  className="flex items-center gap-2 rounded-lg bg-[var(--orbit-glow)]/10 px-2 py-1 text-xs text-[var(--orbit-text)]"
                >
                  <ImageIcon className="h-3 w-3 text-[var(--orbit-glow)]" />
                  <span className="max-w-[100px] truncate">{img.name}</span>
                  <button
                    onClick={() => removeSelectedImage(i)}
                    className="text-[var(--orbit-text-muted)] hover:text-red-400"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {selectedFiles.map((file, i) => (
                <div
                  key={`file-${i}`}
                  className="flex items-center gap-2 rounded-lg bg-[var(--orbit-accent)]/10 px-2 py-1 text-xs text-[var(--orbit-text)]"
                >
                  <Paperclip className="h-3 w-3 text-[var(--orbit-accent)]" />
                  <span className="max-w-[100px] truncate">{file.name}</span>
                  <button
                    onClick={() => removeSelectedFile(i)}
                    className="text-[var(--orbit-text-muted)] hover:text-red-400"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Input Bar */}
        <div className="border-t border-[var(--orbit-glass-border)] bg-[var(--orbit-glass)] p-3">
          {/* Linked Property Card or Select Property Button */}
          {linkedProperty ? (
            <div className="mb-3 rounded-xl border border-[var(--orbit-glow)]/30 bg-[var(--orbit-bg-secondary)] p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--orbit-glow)]/30 bg-[var(--orbit-glow)]/10 text-[var(--orbit-glow)]">
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-[var(--orbit-text-muted)]">Imóvel selecionado</p>
                  <p className="truncate text-sm font-medium text-[var(--orbit-text)]">{linkedProperty.name}</p>
                  <p className="text-xs text-[var(--orbit-glow)]">{linkedProperty.price}</p>
                </div>
                <button
                  onClick={handleSelectPropertyOnMap}
                  className="shrink-0 rounded-lg border border-[var(--orbit-glass-border)] bg-transparent px-2.5 py-1.5 text-[10px] font-medium text-[var(--orbit-text-muted)] transition-all hover:bg-[var(--orbit-glow)]/10 hover:text-[var(--orbit-text)]"
                >
                  Alterar
                </button>
              </div>
              {/* Send Property Button - This triggers Capsule evolution */}
              <button
                onClick={handleSendProperty}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--orbit-glow)] py-2.5 text-sm font-medium text-[var(--orbit-bg)] transition-all hover:opacity-90 active:scale-[0.98]"
              >
                <Send className="h-4 w-4" />
                Enviar para {lead.name.split(" ")[0]}
              </button>
            </div>
          ) : isInActiveCycle ? (
            <button
              onClick={handleSelectPropertyOnMap}
              className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--orbit-glow)] py-3 text-sm font-medium text-[var(--orbit-bg)] transition-all hover:opacity-90 active:scale-[0.98]"
            >
              <MapPin className="h-4 w-4" />
              Selecionar imóvel no mapa
            </button>
          ) : (
            <div className="mb-3 rounded-xl border border-dashed border-[var(--orbit-glass-border)] bg-[var(--orbit-bg-secondary)]/50 px-4 py-3 text-center">
              <p className="text-xs text-[var(--orbit-text-muted)]">
                Inicie um ciclo para enviar imóveis
              </p>
            </div>
          )}

          {/* Message Input */}
          <div className="flex items-end gap-2">
            {/* Attachment buttons */}
            <div className="flex gap-1">
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleImageSelect}
              />
              <button
                onClick={() => imageInputRef.current?.click()}
                className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--orbit-text-muted)] transition-colors hover:bg-[var(--orbit-glow)]/10 hover:text-[var(--orbit-glow)]"
                title="Enviar imagens"
              >
                <ImageIcon className="h-5 w-5" />
              </button>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileSelect}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--orbit-text-muted)] transition-colors hover:bg-[var(--orbit-accent)]/10 hover:text-[var(--orbit-accent)]"
                title="Enviar arquivos"
              >
                <Paperclip className="h-5 w-5" />
              </button>
            </div>

            {/* Text input */}
            <div className="flex-1 rounded-2xl border border-[var(--orbit-glass-border)] bg-[var(--orbit-bg-secondary)] px-4 py-2.5 focus-within:border-[var(--orbit-glow)]/40">
              <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Digite uma mensagem..."
                rows={1}
                className="w-full resize-none bg-transparent text-sm text-[var(--orbit-text)] placeholder-[var(--orbit-text-muted)] outline-none"
                style={{ minHeight: "20px", maxHeight: "100px" }}
              />
            </div>

            {/* Send button */}
            <button
              onClick={handleSend}
              disabled={!inputValue.trim() && selectedImages.length === 0 && selectedFiles.length === 0}
              className={`flex h-10 w-10 items-center justify-center rounded-full transition-all ${
                inputValue.trim() || selectedImages.length > 0 || selectedFiles.length > 0
                  ? "bg-[var(--orbit-glow)] text-[var(--orbit-bg)] hover:opacity-90"
                  : "bg-[var(--orbit-glow)]/10 text-[var(--orbit-text-muted)]"
              }`}
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Atlas is now a global Focus Surface - invoked via context */}
    </>
  )
}
