"use client"

import React, { useState, useRef, useEffect, useCallback } from "react"
import { X, Search, Loader2, Sparkles, ArrowRight } from "lucide-react"
import type { CoreState } from "@/app/page"
import { useOrbitContext } from "./orbit-context"
import { getSupabase } from "@/lib/supabase"
import { useTheme } from "next-themes"

interface OrbitCoreProps {
  state: CoreState
  message: string
  activeCount: number
  onActivate: () => void
  onQuerySubmit: (query: string) => void
  onCancel: () => void
}

// ─── Lead typeahead suggestion ────────────────────────────────────────────────
interface LeadSuggestion {
  id: string
  name: string
  photo_url: string | null
  orbit_stage: string | null
  current_state: string | null
  last_interaction_at: string | null
}

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map(p => p[0]).join("").toUpperCase()
}

function stageLabel(stage: string | null) {
  const map: Record<string, string> = {
    deciding: "Decidindo", evaluating: "Avaliando", exploring: "Explorando",
    curious: "Curioso", latent: "Latente", resolved: "Resolvido", dormant: "Inativo",
  }
  return map[stage || ""] || stage || ""
}

// ─── Component ───────────────────────────────────────────────────────────────
export function OrbitCore({
  state,
  message,
  activeCount,
  onActivate,
  onQuerySubmit,
  onCancel,
}: OrbitCoreProps) {
  const [inputValue, setInputValue] = useState("")
  const [suggestions, setSuggestions] = useState<LeadSuggestion[]>([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [suggestionsVisible, setSuggestionsVisible] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestDebounceRef = useRef<NodeJS.Timeout | null>(null)
  const { openLeadPanel } = useOrbitContext()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"

  // Focus on entering listening mode
  useEffect(() => {
    if (state === "listening" && inputRef.current) {
      inputRef.current.focus()
    }
  }, [state])

  // Clear on returning to idle
  useEffect(() => {
    if (state === "idle") {
      setInputValue("")
      setSuggestions([])
      setSuggestionsVisible(false)
    }
  }, [state])

  // Live typeahead — fires on every keystroke, debounced 200ms
  const fetchSuggestions = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 1) {
      setSuggestions([])
      setSuggestionsVisible(false)
      return
    }

    setLoadingSuggestions(true)
    try {
      const supabase = getSupabase()
      // Parallel: name search + cognitive state
      const { data } = await supabase
        .from("leads")
        .select(`
          id, name, photo_url, orbit_stage, last_interaction_at,
          lead_cognitive_state (current_state)
        `)
        .ilike("name", `%${query}%`)
        .not("state", "in", '("blocked","ignored","pending")')
        .order("last_interaction_at", { ascending: false })
        .limit(6) as any

      const results: LeadSuggestion[] = (data || []).map((l: any) => ({
        id: l.id,
        name: l.name || "Sem nome",
        photo_url: l.photo_url || null,
        orbit_stage: l.lead_cognitive_state?.[0]?.current_state || l.orbit_stage || null,
        current_state: l.lead_cognitive_state?.[0]?.current_state || null,
        last_interaction_at: l.last_interaction_at || null,
      }))

      setSuggestions(results)
      setSuggestionsVisible(results.length > 0)
    } catch {
      setSuggestions([])
    } finally {
      setLoadingSuggestions(false)
    }
  }, [])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setInputValue(val)

    if (suggestDebounceRef.current) clearTimeout(suggestDebounceRef.current)
    suggestDebounceRef.current = setTimeout(() => fetchSuggestions(val), 200)
  }, [fetchSuggestions])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (inputValue.trim()) {
      setSuggestionsVisible(false)
      onQuerySubmit(inputValue.trim())
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      if (suggestionsVisible) {
        setSuggestionsVisible(false)
      } else {
        onCancel()
      }
    }
    if (e.key === "ArrowDown" && suggestionsVisible) {
      e.preventDefault()
      const first = document.querySelector<HTMLButtonElement>("[data-suggestion]")
      first?.focus()
    }
  }

  const handleSuggestionClick = (lead: LeadSuggestion) => {
    setSuggestionsVisible(false)
    setInputValue("")
    // Open the lead panel directly — instant, no AI search needed
    openLeadPanel(lead.id)
  }

  const handleAISearch = () => {
    if (inputValue.trim()) {
      setSuggestionsVisible(false)
      onQuerySubmit(inputValue.trim())
    }
  }

  const getOuterRingClass = () =>
    state === "listening" || state === "processing"
      ? isDark 
        ? "animate-ring-fast shadow-[0_0_40px_rgba(46,197,255,0.15)_inset] border-cyan-400/30"
        : "animate-ring-fast border-[var(--orbit-glow)]/40 shadow-[0_0_30px_var(--orbit-glow)]/5"
      : isDark
        ? "animate-orbit-rotate shadow-[0_0_20px_rgba(46,197,255,0.05)_inset] border-cyan-400/15"
        : "animate-orbit-rotate border-[var(--orbit-line)]"

  const getInnerRingClass = () =>
    state === "listening" || state === "processing"
      ? isDark
        ? "animate-ring-fast-reverse shadow-[0_0_30px_rgba(46,197,255,0.1)_inset] border-cyan-400/25"
        : "animate-ring-fast-reverse border-[var(--orbit-glow)]/30"
      : isDark
        ? "animate-orbit-rotate-reverse shadow-[0_0_15px_rgba(46,197,255,0.05)_inset] border-cyan-400/10"
        : "animate-orbit-rotate-reverse border-[var(--orbit-line)]/50"

  const getCoreClasses = () => {
    const base = isDark
      ? "relative flex h-[180px] w-[180px] cursor-pointer items-center justify-center rounded-full bg-gradient-to-br from-white/10 to-transparent dark:from-cyan-950/40 dark:to-transparent backdrop-blur-3xl border border-white/20 dark:border-cyan-400/30 shadow-[0_0_50px_rgba(46,197,255,0.2)] transition-all duration-[600ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
      : "relative flex h-[180px] w-[180px] cursor-pointer items-center justify-center rounded-full bg-white/80 backdrop-blur-3xl border border-[var(--orbit-line)] shadow-[0_20px_50px_rgba(0,0,0,0.05)] transition-all duration-[600ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
    
    if (state === "listening") {
      return isDark 
        ? `${base} animate-core-listening ring-4 ring-cyan-400/20 scale-105`
        : `${base} ring-4 ring-[var(--orbit-glow)]/10 scale-105 border-[var(--orbit-glow)]/30`
    }
    if (state === "processing" || state === "responding") {
      return isDark
        ? `${base} scale-110 shadow-[0_0_80px_rgba(212,175,53,0.3)] border-[#d4af35]/40`
        : `${base} scale-110 shadow-[0_10px_40px_rgba(212,175,53,0.15)] border-amber-400/50`
    }
    return isDark
      ? `${base} animate-orbit-breathe hover:scale-[1.03] hover:shadow-[0_0_60px_rgba(46,197,255,0.3)] hover:border-cyan-400/50`
      : `${base} hover:scale-[1.03] hover:shadow-[0_25px_60px_rgba(0,0,0,0.08)] hover:border-[var(--orbit-glow)]/40`
  }

  return (
    <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
      {/* Rings */}
      <div
        className={`absolute left-1/2 top-1/2 h-[480px] w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-full border transition-all duration-700 pointer-events-none ${getOuterRingClass()}`}
        style={{ transformOrigin: "center center" }}
      />
      <div
        className={`absolute left-1/2 top-1/2 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full border transition-all duration-700 pointer-events-none ${getInnerRingClass()}`}
        style={{ transformOrigin: "center center" }}
      />
      <div
        className={`absolute left-1/2 top-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full border transition-all duration-700 pointer-events-none ${getOuterRingClass()}`}
        style={{ transformOrigin: "center center" }}
      />

      {/* Core sphere */}
      <div
        className={getCoreClasses()}
        style={{ pointerEvents: "auto" }}
        onClick={state === "idle" ? onActivate : undefined}
        onKeyDown={(e) => { if (e.key === "Enter" && state === "idle") onActivate(); handleKeyDown(e) }}
        tabIndex={state === "idle" ? 0 : -1}
        role={state === "idle" ? "button" : "presentation"}
        aria-label="Centro de comando ORBIT"
      >
        {/* Inner glow */}
        <div
          className={`absolute inset-2 rounded-full bg-gradient-to-br from-cyan-400/20 to-transparent transition-opacity duration-[600ms] pointer-events-none ${
            state === "listening" ? "opacity-100 animate-pulse" : "opacity-0"
          }`}
        />
        <div
          className={`absolute inset-0 rounded-full bg-gradient-to-br from-[#d4af35]/20 to-transparent transition-opacity duration-[600ms] pointer-events-none ${
            state === "processing" || state === "responding" ? "opacity-100" : "opacity-0"
          }`}
        />
        {!isDark && (
          <div className="absolute inset-0 rounded-full bg-white opacity-20 pointer-events-none" />
        )}

        {/* Content */}
        <div className="relative z-10 text-center w-full px-4">

          {/* ── LISTENING: input + typeahead ── */}
          {state === "listening" && (
            <div className="animate-in fade-in zoom-in-95 duration-300">
              <form onSubmit={handleSubmit}>
                <div className="relative flex items-center gap-2">
                  {loadingSuggestions
                    ? <Loader2 className={`w-4 h-4 animate-spin shrink-0 ${isDark ? 'text-cyan-400' : 'text-[var(--orbit-glow)]'}`} />
                    : <Search className={`w-4 h-4 shrink-0 ${isDark ? 'text-cyan-400' : 'text-[var(--orbit-glow)]'}`} />
                  }
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Quem você busca?"
                    className={`flex-1 bg-transparent text-center text-sm font-medium focus:outline-none min-w-0 tracking-wide ${
                      isDark 
                        ? 'text-white placeholder:text-cyan-200/50 drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]' 
                        : 'text-[var(--orbit-text)] placeholder:text-slate-400'
                    }`}
                    aria-label="Buscar lead ou fazer pesquisa cognitiva"
                  />
                </div>
                <div className={`mt-2 text-[10px] font-medium tracking-wide uppercase ${isDark ? 'text-cyan-200/60' : 'text-slate-400'}`}>
                  Enter para busca IA · Esc para sair
                </div>
              </form>

              {/* Cancel button */}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onCancel() }}
                className={`absolute -right-3 -top-3 flex h-6 w-6 items-center justify-center rounded-full border transition-all shadow-lg hover:scale-110 ${
                  isDark 
                    ? 'bg-white/10 dark:bg-black/40 border-white/20 text-slate-300 hover:text-white hover:bg-white/20' 
                    : 'bg-white border-[var(--orbit-line)] text-slate-400 hover:text-slate-600 hover:border-slate-300'
                }`}
                aria-label="Cancelar"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}

          {/* ── OTHER STATES ── */}
          {state !== "listening" && (
            <div className={`transition-all duration-500 ${state === "processing" || state === "responding" ? "scale-105" : ""}`}>
              {state === "processing" && (
                <div className="flex justify-center mb-3 relative">
                  <div className={`absolute inset-0 blur-xl rounded-full animate-pulse ${isDark ? 'bg-[#d4af35]/30' : 'bg-amber-400/20'}`} />
                  <Sparkles className={`w-6 h-6 animate-pulse relative z-10 ${isDark ? 'text-[#d4af35]' : 'text-amber-500'}`} />
                </div>
              )}
              {state === "responding" && (
                <div className="flex justify-center mb-3 relative">
                  <div className={`absolute inset-0 blur-xl rounded-full ${isDark ? 'bg-[#d4af35]/40' : 'bg-amber-400/30'}`} />
                  <Search className={`w-6 h-6 relative z-10 ${isDark ? 'text-[#d4af35]' : 'text-amber-500'}`} />
                </div>
              )}
              <p className={`text-sm font-semibold tracking-wide drop-shadow-md transition-colors duration-500 ${
                state === "processing" || state === "responding" 
                  ? isDark ? "text-[#d4af35]" : "text-amber-600"
                  : isDark ? "text-cyan-50" : "text-slate-700"
              }`}>{message}</p>
              {state === "idle" && (
                <p className={`mt-1.5 text-[10px] font-medium tracking-widest uppercase ${isDark ? 'text-cyan-200/60' : 'text-slate-400'}`}>{activeCount} ativos</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── TYPEAHEAD DROPDOWN — rendered outside the sphere, centered below it ── */}
      {state === "listening" && suggestionsVisible && suggestions.length > 0 && (
        <div
          className="absolute left-1/2 -translate-x-1/2 pointer-events-auto w-[calc(100vw-32px)] md:w-[340px]"
          style={{ top: "calc(90px + 12px)", zIndex: 100 }}
        >
          <div className={`rounded-2xl border backdrop-blur-3xl overflow-hidden ring-1 shadow-[0_16px_60px_rgba(0,0,0,0.8)] ${
            isDark 
              ? 'border-white/10 bg-black/60 ring-white/5' 
              : 'border-[var(--orbit-line)] bg-white ring-slate-100 shadow-[0_20px_40px_rgba(0,0,0,0.1)]'
          }`}>
            {/* Lead suggestions */}
            <div className="p-1.5">
              {suggestions.map((lead, i) => (
                <button
                  key={lead.id}
                  data-suggestion
                  onClick={() => handleSuggestionClick(lead)}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowDown") {
                      e.preventDefault()
                      const next = document.querySelectorAll<HTMLButtonElement>("[data-suggestion]")[i + 1]
                      next?.focus()
                    }
                    if (e.key === "ArrowUp") {
                      e.preventDefault()
                      if (i === 0) { inputRef.current?.focus(); return }
                      const prev = document.querySelectorAll<HTMLButtonElement>("[data-suggestion]")[i - 1]
                      prev?.focus()
                    }
                    if (e.key === "Escape") { setSuggestionsVisible(false); inputRef.current?.focus() }
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors focus:outline-none group ${
                    isDark ? 'hover:bg-[rgba(255,255,255,0.05)] focus:bg-[rgba(255,255,255,0.05)]' : 'hover:bg-slate-50 focus:bg-slate-50'
                  }`}
                >
                  {/* Avatar */}
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-[var(--orbit-glass)] border border-[var(--orbit-glass-border)] shrink-0 flex items-center justify-center">
                    {lead.photo_url
                      ? <img src={lead.photo_url} alt="" className="w-full h-full object-cover" />
                      : <span className="text-[10px] font-medium text-[var(--orbit-text-muted)]">{getInitials(lead.name)}</span>
                    }
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium text-[var(--orbit-text)] truncate">{lead.name}</p>
                    {lead.orbit_stage && (
                      <p className="text-[10px] text-[var(--orbit-text-muted)]">{stageLabel(lead.orbit_stage)}</p>
                    )}
                  </div>

                  {/* Arrow on hover */}
                  <ArrowRight className="w-3 h-3 text-[var(--orbit-text-muted)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </button>
              ))}
            </div>

            {/* AI Search option — always shown when there's text */}
            {inputValue.trim().length > 0 && (
              <div className={`border-t p-1.5 bg-gradient-to-b ${isDark ? 'border-white/10 from-transparent to-black/40' : 'border-slate-100 from-transparent to-slate-50'}`}>
                <button
                  onClick={handleAISearch}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all focus:outline-none ring-1 ring-inset ring-transparent group ${
                    isDark ? 'hover:bg-white/10 focus:bg-white/10 hover:ring-[#d4af35]/30' : 'hover:bg-amber-50 focus:bg-amber-50 hover:ring-amber-200'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 transition-shadow ${
                    isDark 
                      ? 'bg-gradient-to-br from-[#d4af35]/20 to-[#d4af35]/5 border-[#d4af35]/30 shadow-[0_0_15px_rgba(212,175,53,0.15)] group-hover:shadow-[0_0_20px_rgba(212,175,53,0.3)]' 
                      : 'bg-gradient-to-br from-amber-100 to-amber-50 border-amber-200 shadow-sm group-hover:shadow-md'
                  }`}>
                    <Sparkles className={`w-4 h-4 ${isDark ? 'text-[#d4af35]' : 'text-amber-600'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[12px] font-semibold tracking-wide ${isDark ? 'text-[#d4af35]' : 'text-amber-700'}`}>Busca Cognitiva</p>
                    <p className={`text-[10px] truncate opacity-90 mt-0.5 ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>"{inputValue.trim()}"</p>
                  </div>
                  <ArrowRight className={`w-4 h-4 shrink-0 transition-colors group-hover:translate-x-0.5 ${isDark ? 'text-[#d4af35]/40 group-hover:text-[#d4af35]/80' : 'text-amber-300 group-hover:text-amber-500'}`} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty state when typing but no name matches — show only AI option */}
      {state === "listening" && !suggestionsVisible && !loadingSuggestions && inputValue.trim().length >= 2 && suggestions.length === 0 && (
        <div
          className="absolute left-1/2 -translate-x-1/2 pointer-events-auto"
          style={{ top: "calc(90px + 12px)", width: "340px", zIndex: 100 }}
        >
          <div className={`rounded-2xl border backdrop-blur-3xl overflow-hidden ring-1 p-1.5 ${
            isDark 
              ? 'border-white/10 bg-black/60 shadow-[0_16px_60px_rgba(0,0,0,0.8)] ring-white/5' 
              : 'border-[var(--orbit-line)] bg-white shadow-[0_20px_40px_rgba(0,0,0,0.1)] ring-slate-100'
          }`}>
            <button
              onClick={handleAISearch}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all focus:outline-none ring-1 ring-inset ring-transparent group ${
                isDark ? 'hover:bg-white/10 focus:bg-white/10 hover:ring-[#d4af35]/30' : 'hover:bg-amber-50 focus:bg-amber-50 hover:ring-amber-200'
              }`}
            >
              <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 transition-shadow ${
                isDark 
                  ? 'bg-gradient-to-br from-[#d4af35]/20 to-[#d4af35]/5 border-[#d4af35]/30 shadow-[0_0_15px_rgba(212,175,53,0.15)] group-hover:shadow-[0_0_20px_rgba(212,175,53,0.3)]' 
                  : 'bg-gradient-to-br from-amber-100 to-amber-50 border-amber-200 shadow-sm group-hover:shadow-md'
              }`}>
                <Sparkles className={`w-4 h-4 ${isDark ? 'text-[#d4af35]' : 'text-amber-600'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-[12px] font-semibold tracking-wide ${isDark ? 'text-[#d4af35]' : 'text-amber-700'}`}>Busca Cognitiva</p>
                <p className={`text-[10px] truncate opacity-90 mt-0.5 ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>"{inputValue.trim()}"</p>
              </div>
              <ArrowRight className={`w-4 h-4 shrink-0 transition-colors group-hover:translate-x-0.5 ${isDark ? 'text-[#d4af35]/40 group-hover:text-[#d4af35]/80' : 'text-amber-300 group-hover:text-amber-500'}`} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
