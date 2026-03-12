"use client"

import type React from "react"
import { useState, useRef, useEffect, useMemo } from "react"
import { X, TrendingUp, Search, UserPlus } from "lucide-react"
import type { CoreState, Lead } from "@/types/orbit-types"
import { leadsData, isSilent, followUpRemainingDays, STAGE_COLORS } from "@/types/orbit-types"

interface OrbitCoreProps {
  state: CoreState
  message: string
  activeCount: number
  onActivate: () => void
  onQuerySubmit: (query: string) => void
  onCancel: () => void
  onLeadSelect?: (leadId: string) => void
  onCreateLead?: (name: string) => void
}

// ===== LeadMiniCard (inline for autocomplete) =====
function LeadMiniCard({ lead }: { lead: Lead }) {
  const lastInteraction = lead.interactions[0]
  const remaining = followUpRemainingDays(lead)
  const silent = isSilent(lead)

  const stageLabels: Record<string, string> = {
    negotiation: "Negociacao",
    interest: "Interesse",
    exploration: "Exploracao",
    contact: "Contato",
    closed: "Fechado",
  }

  function formatTimeAgo(date: Date): string {
    const diff = Date.now() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    if (minutes < 1) return "agora"
    if (minutes < 60) return `${minutes}min`
    if (hours < 24) return `${hours}h`
    if (days === 1) return "ontem"
    if (days < 30) return `${days}d`
    return `${Math.floor(days / 30)}m`
  }

  return (
    <div className="flex items-center gap-3 w-full">
      {/* Avatar */}
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-[var(--orbit-glass)] text-[10px] font-light text-[var(--orbit-text)] backdrop-blur-sm"
        style={{
          borderColor: STAGE_COLORS[lead.pipelineStage] || "rgba(148,163,184,0.4)",
          boxShadow: `0 0 8px ${STAGE_COLORS[lead.pipelineStage] || "transparent"}`,
        }}
      >
        {lead.profile_image_url ? (
          <img
            src={lead.profile_image_url}
            alt={lead.name}
            className="h-full w-full rounded-full object-cover"
          />
        ) : (
          lead.avatar
        )}
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-[var(--orbit-text)] truncate">{lead.name}</span>
          <span
            className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider"
            style={{
              background: `${STAGE_COLORS[lead.pipelineStage]}20`,
              color: STAGE_COLORS[lead.pipelineStage],
            }}
          >
            {stageLabels[lead.pipelineStage] || lead.pipelineStage}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-[var(--orbit-text-muted)]">
          {lastInteraction && (
            <span>
              {lastInteraction.type} {" \u2022 "} {formatTimeAgo(lastInteraction.timestamp)}
            </span>
          )}
          {remaining !== null && remaining <= 1 && (
            <span className="text-amber-400">follow-up</span>
          )}
          {silent && <span className="opacity-50">silencioso</span>}
        </div>
      </div>
    </div>
  )
}

export function OrbitCore({
  state,
  message,
  activeCount,
  onActivate,
  onQuerySubmit,
  onCancel,
  onLeadSelect,
  onCreateLead,
}: OrbitCoreProps) {
  const [inputValue, setInputValue] = useState("")
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

           useEffect(() => {
             if (state === "listening" && inputRef.current) {
               inputRef.current.focus()
             }
           }, [state])

           useEffect(() => {
             if (state === "idle") {
               setInputValue("")
               setSelectedIndex(0)
             }
           }, [state])

           useEffect(() => {
             if (state !== "responding") return
             const handler = (e: KeyboardEvent) => {
               if (e.key === "Escape") onCancel()
             }
             window.addEventListener("keydown", handler)
             return () => window.removeEventListener("keydown", handler)
           }, [state, onCancel])

  // Search autocomplete results (max 5)
  const searchResults = useMemo(() => {
    if (state !== "listening" || !inputValue.trim()) return []
    const q = inputValue
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")

    return leadsData
      .filter((lead) => {
        // Exclude closed from autocomplete results
        if (lead.pipelineStage === "closed") return false
        const nameMatch = lead.name
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .includes(q)
        const keywordMatch = lead.keywords.some((kw) =>
          kw
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .includes(q),
        )
        return nameMatch || keywordMatch
      })
      .slice(0, 5)
  }, [state, inputValue])

  const showAutocomplete = state === "listening" && inputValue.trim().length > 0
  const showCreateOption = showAutocomplete && searchResults.length === 0

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0)
  }, [searchResults.length, showCreateOption])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputValue.trim()) return

    // If autocomplete has results and an item is selected, navigate to it
    if (searchResults.length > 0 && selectedIndex < searchResults.length) {
      const selected = searchResults[selectedIndex]
      onLeadSelect?.(selected.id)
      onCancel()
      return
    }

    // If no results and create option is shown
    if (showCreateOption) {
      onCreateLead?.(inputValue.trim())
      onCancel()
      return
    }

    // Fallback: submit as keyword search
    onQuerySubmit(inputValue.trim())
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onCancel()
      return
    }

    const totalItems = searchResults.length + (showCreateOption ? 1 : 0)

    if (e.key === "ArrowDown") {
      e.preventDefault()
      setSelectedIndex((prev) => (prev + 1) % Math.max(totalItems, 1))
    }
    if (e.key === "ArrowUp") {
      e.preventDefault()
      setSelectedIndex((prev) => (prev - 1 + Math.max(totalItems, 1)) % Math.max(totalItems, 1))
    }
  }

  const handleResultClick = (lead: Lead) => {
    onLeadSelect?.(lead.id)
    onCancel()
  }

  const handleCreateClick = () => {
    onCreateLead?.(inputValue.trim())
    onCancel()
  }

  const handleQueryClick = () => {
    onQuerySubmit(inputValue.trim())
  }

  const getOuterRingClass = () => {
    if (state === "listening" || state === "processing") return "animate-ring-fast"
    return "animate-orbit-rotate"
  }

  const getInnerRingClass = () => {
    if (state === "listening" || state === "processing") return "animate-ring-fast-reverse"
    return "animate-orbit-rotate-reverse"
  }

  const getCoreClasses = () => {
    return "relative flex h-[180px] w-[180px] cursor-pointer items-center justify-center rounded-full bg-[var(--orbit-glass)] backdrop-blur-xl border border-[var(--orbit-glass-border)] transition-all duration-300 animate-orbit-pulse"
  }

  const getCoreInnerClasses = () => {
    if (state === "listening") return "absolute inset-0 rounded-full animate-core-listening"
    if (state === "processing" || state === "responding") return "absolute inset-0 rounded-full transition-transform duration-300 scale-105"
    return "absolute inset-0 rounded-full animate-orbit-breathe"
  }

  return (
    <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2" style={{ isolation: "isolate" }}>
      {/* === HALO RINGS (never move, purely decorative) === */}
      <div className="pointer-events-none" style={{ position: "absolute", inset: 0 }}>
        {/* Outermost ring */}
        <div
          className={`absolute left-1/2 top-1/2 h-[480px] w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[var(--orbit-line)] ${
            state === "listening" || state === "processing" ? "opacity-70" : "opacity-40"
          } ${getOuterRingClass()}`}
          style={{ transformOrigin: "center center" }}
        />

        {/* Third ring */}
        <div
          className={`absolute left-1/2 top-1/2 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[var(--orbit-line)] ${
            state === "listening" || state === "processing" ? "opacity-80" : "opacity-50"
          } ${getInnerRingClass()}`}
          style={{ transformOrigin: "center center" }}
        >
          <div className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-[var(--orbit-glow)]" />
          <div className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-[var(--orbit-accent)]" />
        </div>

        {/* Second ring */}
        <div
          className={`absolute left-1/2 top-1/2 h-[320px] w-[320px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--orbit-glow)]/30 ${getOuterRingClass()}`}
          style={{ transformOrigin: "center center" }}
        >
          <div className="absolute -left-1 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-[var(--orbit-glow)]" />
          <div className="absolute -right-1 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-[var(--orbit-glow)]" />
        </div>

        {/* Inner ring */}
        <div
          className={`absolute left-1/2 top-1/2 h-[240px] w-[240px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[var(--orbit-glow)]/40 ${getInnerRingClass()}`}
          style={{ transformOrigin: "center center" }}
        />

        {/* Processing ripple rings */}
        {state === "processing" && (
          <>
            <div className="absolute left-1/2 top-1/2 h-[180px] w-[180px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--orbit-glow)] animate-processing-ripple" />
            <div
              className="absolute left-1/2 top-1/2 h-[180px] w-[180px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--orbit-glow)] animate-processing-ripple"
              style={{ animationDelay: "0.5s" }}
            />
            <div
              className="absolute left-1/2 top-1/2 h-[180px] w-[180px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--orbit-glow)] animate-processing-ripple"
              style={{ animationDelay: "1s" }}
            />
          </>
        )}
      </div>

      {/* === CENTRAL CORE (clickable) === */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Centro de comando ORBIT, clique para buscar"
        title="Clique para consultar leads"
        onClick={state === "idle" ? onActivate : undefined}
        onKeyDown={(e) => {
          if (e.key === "Enter" && state === "idle") onActivate()
        }}
        className={getCoreClasses()}
      >
        {/* Inner glow */}
        <div
          className={`absolute inset-2 rounded-full bg-gradient-to-br from-[var(--orbit-glow)]/10 to-transparent transition-opacity duration-300 ${
            state === "listening" || state === "processing" ? "opacity-100 from-[var(--orbit-glow)]/20" : ""
          }`}
        />

        {/* Core content */}
        <div className="relative z-10 w-full px-4 text-center">
          {/* Listening state -- show input */}
          {state === "listening" && (
            <form onSubmit={handleSubmit} className="animate-text-fade-in">
              <div className="relative flex items-center gap-2">
                <Search className="h-3.5 w-3.5 shrink-0 text-[var(--orbit-text-muted)]" />
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Buscar lead..."
                  className="w-full bg-transparent text-xs font-light text-[var(--orbit-text)] placeholder:text-[var(--orbit-text-muted)] focus:outline-none"
                  aria-label="Buscar lead por nome ou palavra-chave"
                  autoComplete="off"
                />
              </div>
              <div className="mt-2 text-[9px] text-[var(--orbit-text-muted)]">
                {"\u2191\u2193"} navegar {"  \u00B7  "} Enter selecionar {"  \u00B7  "} Esc cancelar
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onCancel()
                }}
                className="absolute -right-2 -top-4 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--orbit-glass)] border border-[var(--orbit-glass-border)] text-[var(--orbit-text-muted)] hover:text-[var(--orbit-text)] transition-colors"
                aria-label="Cancelar"
              >
                <X className="h-3 w-3" />
              </button>
            </form>
          )}

          {/* Other states */}
          {state !== "listening" && (
            <div className={`relative ${state === "responding" || state === "processing" ? "animate-text-fade-in" : ""}`}>
              <div className="text-sm font-light tracking-[0.3em] text-[var(--orbit-glow)]">ORBIT</div>
              <div className="mt-1 text-[10px] font-light tracking-wider text-[var(--orbit-text-muted)]">
                {message}
              </div>
              {state === "idle" && (
                <div className="mt-2 flex items-center justify-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5 text-[var(--orbit-glow)] animate-activity-pulse" />
                  <span className="text-sm font-medium text-[var(--orbit-glow)] opacity-90 drop-shadow-[0_0_10px_rgba(var(--orbit-glow-rgb),0.4)]">
                    {activeCount} ativos
                  </span>
                </div>
              )}
              {state === "responding" && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onCancel()
                  }}
                  className="absolute -right-2 -top-4 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--orbit-glass)] border border-[var(--orbit-glass-border)] text-[var(--orbit-text-muted)] hover:text-[var(--orbit-text)] transition-colors"
                  aria-label="Fechar resultado"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Pulse ring */}
        <div
          className={`absolute inset-0 rounded-full border border-[var(--orbit-glow)]/50 ${
            state === "idle" ? "animate-semantic-pulse" : "opacity-0"
          }`}
        />
      </div>

      {/* === SEARCH AUTOCOMPLETE DROPDOWN (overlay, outside core circle) === */}
      {showAutocomplete && (
        <div
          className="absolute left-1/2 -translate-x-1/2 w-64 z-50 animate-text-fade-in"
          style={{ top: "calc(50% + 100px)" }}
        >
          <div className="rounded-xl border border-[var(--orbit-glass-border)] bg-[var(--orbit-glass)] backdrop-blur-xl shadow-lg overflow-hidden">
            {searchResults.length > 0 ? (
              <div className="flex flex-col py-1">
                {searchResults.map((lead, i) => (
                  <button
                    key={lead.id}
                    onClick={() => handleResultClick(lead)}
                    onMouseEnter={() => setSelectedIndex(i)}
                    className={`flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                      i === selectedIndex
                        ? "bg-[var(--orbit-glow)]/10"
                        : "hover:bg-[var(--orbit-glow)]/5"
                    }`}
                  >
                    <LeadMiniCard lead={lead} />
                  </button>
                ))}
              </div>
            ) : (
              /* No results -- show options */
              <div className="flex flex-col">
                <button
                  onClick={handleQueryClick}
                  className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-[var(--orbit-glow)]/5"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--orbit-glow)]/40 bg-[var(--orbit-glow)]/10">
                    <Search className="h-3.5 w-3.5 text-[var(--orbit-glow)]" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-[var(--orbit-text)]">Consultar IA</span>
                    <span className="text-[10px] text-[var(--orbit-text-muted)]">{'Buscar "'}{inputValue.trim()}{'" com Gemini'}</span>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
