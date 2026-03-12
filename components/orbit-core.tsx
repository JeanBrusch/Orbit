import { useState, useRef, useEffect, useMemo } from "react"
import { X, TrendingUp, ArrowLeft, Brain, Search, User, Building, Sparkles } from "lucide-react"
import type { CoreState } from "@/app/page"
import { useOrbitContext } from "./orbit-context"
import { useSupabaseLeads, useSupabaseProperties } from "@/hooks/use-supabase-data"
import { motion, AnimatePresence } from "framer-motion"

interface OrbitCoreProps {
  state: CoreState
  message: string
  activeCount: number
  onActivate: () => void
  onQuerySubmit: (query: string) => void
  onCancel: () => void
  onLeadSelect?: (leadId: string) => void
}

// Enriched Lead Mini Card
function LeadMiniCard({ lead, isSelected }: { lead: any, isSelected: boolean }) {
  const stageLabels: Record<string, string> = {
    negotiation: "Negociação",
    interest: "Interesse",
    exploration: "Exploração",
    contact: "Contato",
    closed: "Fechado",
    deciding: "Decidindo",
  }

  const stageColors: Record<string, string> = {
    negotiation: "#f59e0b", // amber
    interest: "#10b981", // emerald
    exploration: "#3b82f6", // blue
    contact: "#6366f1", // indigo
    closed: "#94a3b8", // slate
    deciding: "#ec4899", // pink
  }

  return (
    <div className={`flex items-center gap-3 w-full p-2 rounded-lg transition-all duration-200 ${isSelected ? 'bg-[var(--orbit-glow)]/10 scale-[1.02] shadow-[0_0_15px_rgba(var(--orbit-glow-rgb),0.2)]' : 'hover:bg-[var(--orbit-glow)]/5'}`}>
      {/* Avatar with Glow based on stage */}
      <div 
        className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-[var(--orbit-glass)] text-[11px] font-medium text-[var(--orbit-text)] backdrop-blur-sm"
        style={{ 
          borderColor: stageColors[lead.orbitStage || 'contact'] || 'rgba(148,163,184,0.4)',
          boxShadow: isSelected ? `0 0 12px ${stageColors[lead.orbitStage || 'contact']}` : 'none'
        }}
      >
        {lead.photoUrl ? (
          <img src={lead.photoUrl} alt={lead.name} className="h-full w-full rounded-full object-cover" />
        ) : (
          lead.avatar
        )}
        {/* Active Pulse for selected item */}
        {isSelected && (
          <motion.div 
            className="absolute inset-0 rounded-full border border-[var(--orbit-glow)]"
            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        )}
      </div>

      <div className="flex flex-1 flex-col min-w-0 text-left">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[var(--orbit-text)] truncate">{lead.name}</span>
          <span 
            className="shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider"
            style={{ 
              background: `${stageColors[lead.orbitStage || 'contact']}20`,
              color: stageColors[lead.orbitStage || 'contact']
            }}
          >
            {stageLabels[lead.orbitStage || 'contact'] || 'Contato'}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-[var(--orbit-text-muted)] mt-0.5">
          <span>{lead.daysSinceInteraction !== undefined ? `${lead.daysSinceInteraction}d atrás` : 'Sem interações'}</span>
          <span className="opacity-30">•</span>
          <span className="truncate italic text-[var(--orbit-glow)]/80">
            {lead.actionSuggested || lead.origin || "Sin título"}
          </span>
        </div>
      </div>
    </div>
  )
}

// Property Mini Card
function PropertyMiniCard({ property, isSelected }: { property: any, isSelected: boolean }) {
  return (
    <div className={`flex items-center gap-3 w-full p-2 rounded-lg transition-all duration-200 ${isSelected ? 'bg-[var(--orbit-glow)]/10 scale-[1.02] shadow-[0_0_15px_rgba(var(--orbit-glow-rgb),0.2)]' : 'hover:bg-[var(--orbit-glow)]/5'}`}>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--orbit-glass-border)] bg-[var(--orbit-glass)] text-[var(--orbit-glow)]">
        <Building className="h-4 w-4" />
      </div>
      <div className="flex flex-1 flex-col min-w-0 text-left">
        <span className="text-xs font-medium text-[var(--orbit-text)] truncate">{property.title || property.internal_name}</span>
        <div className="flex items-center gap-2 text-[10px] text-[var(--orbit-text-muted)] mt-0.5">
          <span className="text-[var(--orbit-accent)] font-medium">
            {property.value ? `R$ ${(property.value).toLocaleString('pt-BR')}` : 'Sob consulta'}
          </span>
          <span className="opacity-30">•</span>
          <span className="truncate">{property.location_text || 'Localização a confirmar'}</span>
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
  onLeadSelect
}: OrbitCoreProps) {
  const [inputValue, setInputValue] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  
  const { orbitView, activateOrbitView, deactivateOrbitView, invokeAtlasMap } = useOrbitContext()
  const { leads } = useSupabaseLeads()
  const { properties } = useSupabaseProperties()

  // Cognitive Search Results
  const cognitiveResults = useMemo(() => {
    if (state !== "listening" || !inputValue.trim()) return { leads: [], properties: [], total: 0 }
    
    const q = inputValue.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    
    const matchedLeads = leads.filter(l => 
      l.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(q) ||
      (l.keywords && l.keywords.some(k => k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(q)))
    ).slice(0, 3)

    const matchedProps = properties.filter(p => 
      (p.title || p.internal_name || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(q) ||
      (p.location_text || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(q)
    ).slice(0, 2)

    return {
      leads: matchedLeads,
      properties: matchedProps,
      total: matchedLeads.length + matchedProps.length + 1 // +1 for "Ask AI"
    }
  }, [state, inputValue, leads, properties])

  const showAutocomplete = state === "listening" && inputValue.trim().length > 0

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

  const handleSelectIndex = async (index: number) => {
    const { leads: matchedLeads, properties: matchedProps } = cognitiveResults

    if (index < matchedLeads.length) {
      onLeadSelect?.(matchedLeads[index].id)
      onCancel()
    } else if (index < matchedLeads.length + matchedProps.length) {
      // Logic for selecting property
      invokeAtlasMap()
      onCancel()
    } else {
      // Ask AI fallback (Semantic search)
      if (inputValue.trim()) {
        setIsSearching(true)
        await activateOrbitView(inputValue.trim())
        setIsSearching(false)
        onCancel()
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onCancel()
    }
  }

  const getOuterRingClass = () => {
    if (state === "listening" || state === "processing") {
      return "animate-ring-fast"
    }
    return "animate-orbit-rotate"
  }

  const getInnerRingClass = () => {
    if (state === "listening" || state === "processing") {
      return "animate-ring-fast-reverse"
    }
    return "animate-orbit-rotate-reverse"
  }

  const getCoreClasses = () => {
    const base =
      "absolute top-0 left-0 w-[180px] h-[180px] -ml-[90px] -mt-[90px] flex cursor-pointer items-center justify-center rounded-full bg-[var(--orbit-glass)] backdrop-blur-xl border border-[var(--orbit-glass-border)] transition-[background-color,border-color,box-shadow,opacity] duration-300 pointer-events-auto"

    if (state === "listening") {
      return `${base} animate-core-listening`
    }
    if (state === "processing" || state === "responding") {
      return `${base} scale-105`
    }
    return `${base} animate-orbit-breathe animate-orbit-pulse hover:scale-[1.02]`
  }

  return (
    <div
      className="absolute left-1/2 top-1/2 z-10 w-0 h-0 pointer-events-none"
    >
      {/* Outermost ring — matches orbit ring 4 (r=480 → ⌀960) */}
      <div
        className={`absolute top-0 left-0 w-[960px] h-[960px] -ml-[480px] -mt-[480px] rounded-full border border-[var(--orbit-line)] transition-opacity duration-300 ${
          state === "listening" || state === "processing" ? "opacity-50" : "opacity-25"
        } ${getOuterRingClass()}`}
        style={{ transformOrigin: "center center" }}
      />

      {/* Third ring — matches orbit ring 3 (r=360 → ⌀720) */}
      <div
        className={`absolute top-0 left-0 w-[720px] h-[720px] -ml-[360px] -mt-[360px] rounded-full border border-[var(--orbit-line)] transition-opacity duration-300 ${
          state === "listening" || state === "processing" ? "opacity-60" : "opacity-30"
        } ${getInnerRingClass()}`}
        style={{ transformOrigin: "center center" }}
      >
        <div className="absolute top-0 left-1/2 h-2 w-2 -ml-1 -mt-1 rounded-full bg-[var(--orbit-glow)]" />
        <div className="absolute bottom-0 left-1/2 h-2 w-2 -ml-1 -mb-1 rounded-full bg-[var(--orbit-accent)]" />
      </div>

      {/* Second ring — matches orbit ring 2 (r=240 → ⌀480) */}
      <div
        className={`absolute top-0 left-0 w-[480px] h-[480px] -ml-[240px] -mt-[240px] rounded-full border-2 border-[var(--orbit-glow)]/20 transition-opacity duration-300 ${getOuterRingClass()}`}
        style={{ transformOrigin: "center center" }}
      >
        <div className="absolute left-0 top-1/2 h-2 w-2 -ml-1 -mt-1 rounded-full bg-[var(--orbit-glow)]" />
        <div className="absolute right-0 top-1/2 h-2 w-2 -mr-1 -mt-1 rounded-full bg-[var(--orbit-glow)]" />
      </div>

      {/* Inner ring — matches orbit ring 1 (r=130 → ⌀260) */}
      <div
        className={`absolute top-0 left-0 w-[260px] h-[260px] -ml-[130px] -mt-[130px] rounded-full border border-[var(--orbit-glow)]/40 transition-opacity duration-300 ${getInnerRingClass()}`}
        style={{ transformOrigin: "center center" }}
      />

      {/* Processing ripple rings */}
      {state === "processing" && (
        <>
          <div className="absolute top-0 left-0 w-[180px] h-[180px] -ml-[90px] -mt-[90px] rounded-full border-2 border-[var(--orbit-glow)] animate-processing-ripple" />
          <div
            className="absolute top-0 left-0 w-[180px] h-[180px] -ml-[90px] -mt-[90px] rounded-full border-2 border-[var(--orbit-glow)] animate-processing-ripple"
            style={{ animationDelay: "0.5s" }}
          />
          <div
            className="absolute top-0 left-0 w-[180px] h-[180px] -ml-[90px] -mt-[90px] rounded-full border-2 border-[var(--orbit-glow)] animate-processing-ripple"
            style={{ animationDelay: "1s" }}
          />
        </>
      )}

      {/* Central core */}
      <div 
        className={getCoreClasses()}
        role="button"
        tabIndex={0}
        aria-label="Centro de comando ORBIT, clique para interagir"
        title="Clique para consultar leads"
        onClick={state === "idle" ? onActivate : undefined}
        onKeyDown={(e) => {
          if (e.key === "Enter" && state === "idle") {
            onActivate()
          }
          handleKeyDown(e)
        }}
      >
        {/* Inner glow */}
        <div
          className={`absolute inset-4 rounded-full bg-gradient-to-br from-[var(--orbit-glow)]/10 to-transparent transition-opacity duration-300 ${
            state === "listening" || state === "processing" ? "opacity-100 from-[var(--orbit-glow)]/20" : ""
          }`}
        />

        {/* Core content */}
        <div className="relative z-10 text-center w-full px-4">
          {/* Listening state - show input */}
          {state === "listening" && (
            <form 
              onSubmit={(e) => {
                e.preventDefault()
                if (cognitiveResults.total > 0) {
                  handleSelectIndex(selectedIndex)
                }
              }} 
              className="animate-text-fade-in"
            >
              <div className="relative flex items-center justify-center gap-2">
                <Search className="h-3.5 w-3.5 shrink-0 text-[var(--orbit-glow)] opacity-50" />
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => {
                    setInputValue(e.target.value)
                    setSelectedIndex(0)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowDown") {
                      e.preventDefault()
                      setSelectedIndex(prev => (prev + 1) % cognitiveResults.total)
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault()
                      setSelectedIndex(prev => (prev - 1 + cognitiveResults.total) % cognitiveResults.total)
                    } else if (e.key === "Escape") {
                      onCancel()
                    } else if (e.key === "Enter") {
                      e.preventDefault()
                      handleSelectIndex(selectedIndex)
                    }
                  }}
                  placeholder="Busque leads ou intenções..."
                  className="w-full bg-transparent text-center text-[12px] font-light text-[var(--orbit-text)] placeholder:text-[var(--orbit-text-muted)] focus:outline-none"
                  aria-label="Busque leads ou intenções"
                  autoComplete="off"
                />
              </div>
              <div className="mt-2 text-[9px] text-[var(--orbit-text-muted)] tracking-wider">
                ↑↓ Navegar · Enter Selecionar
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onCancel()
                }}
                className="absolute -right-4 -top-6 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--orbit-glass)] border border-[var(--orbit-glass-border)] text-[var(--orbit-text-muted)] hover:text-[var(--orbit-text)] transition-colors hover:scale-110 active:scale-95"
                aria-label="Cancelar"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </form>
          )}

          {/* ORBIT VIEW active state */}
          {state !== "listening" && orbitView.active && (
            <div className="animate-text-fade-in">
              <div className="text-sm font-light tracking-[0.3em] text-[var(--orbit-glow)]">ORBIT</div>
              <div className="mt-1 text-[10px] font-light tracking-wider text-violet-400">
                Modo de Trabalho Ativo
              </div>
              <div className="mt-1.5 flex items-center justify-center gap-1.5">
                <Brain className="h-3.5 w-3.5 text-violet-400" />
                <span className="text-xs font-medium text-[var(--orbit-text)] capitalize">
                  {orbitView.query}
                </span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  deactivateOrbitView()
                }}
                className="mt-2 flex items-center justify-center gap-1 text-[9px] text-[var(--orbit-text-muted)] hover:text-[var(--orbit-text)] transition-colors mx-auto"
              >
                <ArrowLeft className="h-3 w-3" />
                Sair do modo
              </button>
            </div>
          )}

          {/* Other states */}
          {state !== "listening" && !orbitView.active && (
            <div className={state === "responding" || state === "processing" ? "animate-text-fade-in" : ""}>
              <div className="text-sm font-light tracking-[0.3em] text-[var(--orbit-glow)]">ORBIT</div>
              <div className="mt-1 text-[10px] font-light tracking-wider text-[var(--orbit-text-muted)]">{message}</div>
              {state === "idle" && (
                <div className="mt-2 flex items-center justify-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5 text-[var(--orbit-glow)] animate-activity-pulse" />
                  <span className="text-sm font-medium text-[var(--orbit-glow)] opacity-90 dark:drop-shadow-[0_0_10px_rgba(46,197,255,0.5)]">
                    {activeCount} ativos
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

      </div>

      {/* Autocomplete Dropdown - Positioned relative to Parent w-0 h-0 */}
      <AnimatePresence>
        {showAutocomplete && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute left-1/2 -translate-x-1/2 mt-[120px] w-72 z-50 pointer-events-auto"
            style={{ top: "0" }}
          >
            <div className="relative overflow-hidden rounded-2xl border border-[var(--orbit-glass-border)] bg-[var(--orbit-glass)] backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
              <div className="absolute inset-0 bg-gradient-to-b from-[var(--orbit-glow)]/5 to-transparent pointer-events-none" />
              
              <div className="relative p-2 flex flex-col gap-1 max-h-[400px] overflow-y-auto no-scrollbar">
                <div className="flex items-center gap-2 px-3 py-2 text-[10px] font-bold text-[var(--orbit-glow)]/60 tracking-[0.2em] uppercase">
                   <Sparkles className="h-3 w-3" />
                   Cognitive Matches
                </div>

                {cognitiveResults.leads.length > 0 && (
                  <div className="flex flex-col gap-0.5">
                    {cognitiveResults.leads.map((lead, i) => (
                      <button
                        key={lead.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleSelectIndex(i)
                        }}
                        onMouseEnter={() => setSelectedIndex(i)}
                        className="w-full"
                      >
                        <LeadMiniCard lead={lead} isSelected={selectedIndex === i} />
                      </button>
                    ))}
                  </div>
                )}

                {cognitiveResults.properties.length > 0 && (
                  <div className="flex flex-col gap-0.5 mt-2">
                    <div className="px-3 py-1.5 text-[9px] font-medium text-[var(--orbit-text-muted)]/60 tracking-wider text-left">PROPRIEDADES</div>
                    {cognitiveResults.properties.map((prop, i) => {
                      const flatIndex = cognitiveResults.leads.length + i
                      return (
                        <button
                          key={prop.id}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleSelectIndex(flatIndex)
                          }}
                          onMouseEnter={() => setSelectedIndex(flatIndex)}
                          className="w-full"
                        >
                          <PropertyMiniCard property={prop} isSelected={selectedIndex === flatIndex} />
                        </button>
                      )
                    })}
                  </div>
                )}

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleSelectIndex(cognitiveResults.total - 1)
                  }}
                  onMouseEnter={() => setSelectedIndex(cognitiveResults.total - 1)}
                  className={`flex items-center gap-3 w-full p-3 mt-2 rounded-xl transition-all duration-200 border border-dashed text-left ${selectedIndex === cognitiveResults.total - 1 ? 'bg-[var(--orbit-glow)]/20 border-[var(--orbit-glow)]/50 scale-[1.02]' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500/30 to-fuchsia-500/30 text-violet-400">
                    <Brain className="h-5 w-5" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-white tracking-tight">Perguntar ao Orbit AI</span>
                    <span className="text-[10px] text-[var(--orbit-text-muted)] italic">"Quem procura {inputValue}?"</span>
                  </div>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
