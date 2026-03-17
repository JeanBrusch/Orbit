"use client"

import { useOrbitContext } from "./orbit-context"
import { useEffect, useState, useCallback } from "react"
import {
  X, Sparkles, TrendingUp, TrendingDown, Minus,
  Clock, Brain, ExternalLink, ChevronRight
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

interface LeadDetail {
  id: string
  name: string
  photo_url: string | null
  orbit_stage: string | null
  last_interaction_at: string | null
  interest_score: number | null
  momentum_score: number | null
  current_state: string | null
  action_suggested: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map(p => p[0]).join("").toUpperCase()
}

function formatSince(dateStr: string | null): string {
  if (!dateStr) return "nunca"
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 1) return "agora"
  if (mins < 60) return `${mins}min`
  if (hours < 24) return `${hours}h`
  if (days === 1) return "ontem"
  return `${days}d`
}

function stageLabel(stage: string | null): string {
  const map: Record<string, string> = {
    deciding: "Decidindo", evaluating: "Avaliando", exploring: "Explorando",
    curious: "Curioso", latent: "Latente", resolved: "Resolvido", dormant: "Inativo",
  }
  return map[stage || ""] || stage || "—"
}

function ScoreBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="relative h-px w-full bg-white/[0.06] rounded-full overflow-hidden">
      <div
        className="absolute left-0 top-0 h-full rounded-full transition-all duration-700"
        style={{ width: `${value}%`, background: color, opacity: 0.5 + (value / 100) * 0.5 }}
      />
    </div>
  )
}

function TrendIcon({ score }: { score: number }) {
  if (score >= 70) return <TrendingUp className="w-3 h-3 text-emerald-400" />
  if (score <= 30) return <TrendingDown className="w-3 h-3 text-red-400" />
  return <Minus className="w-3 h-3 text-slate-500" />
}

function MatchTag({ reason }: { reason: string }) {
  const colors: Record<string, string> = {
    "Perfil cognitivo compatível": "text-[#d4af35] bg-[#d4af35]/10 border-[#d4af35]/20",
    "Nome encontrado": "text-blue-400 bg-blue-400/10 border-blue-400/20",
    "Mencionado em notas": "text-purple-400 bg-purple-400/10 border-purple-400/20",
    "Contexto imobiliário similar": "text-teal-400 bg-teal-400/10 border-teal-400/20",
    "Filtro de status aplicado": "text-slate-400 bg-slate-400/10 border-slate-400/20",
  }
  const cls = colors[reason] || "text-slate-400 bg-slate-400/10 border-slate-400/20"
  return (
    <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider ${cls}`}>
      {reason}
    </span>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function CopilotoPanel() {
  const { orbitView, deactivateOrbitView, openLeadPanel } = useOrbitContext()
  const [leadDetails, setLeadDetails] = useState<Record<string, LeadDetail>>({})
  const [visible, setVisible] = useState(false)

  // Animate in
  useEffect(() => {
    if (orbitView.active) {
      setTimeout(() => setVisible(true), 50)
    } else {
      setVisible(false)
    }
  }, [orbitView.active])

  // Enrich leads with full details (photo, scores, etc.)
  const enrichLeads = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return
    try {
      const res = await fetch(`/api/lead/find?ids=${ids.join(",")}`)
      if (!res.ok) return
      const data = await res.json()
      if (data.leads) {
        setLeadDetails(prev => {
          const next = { ...prev }
          for (const l of data.leads) next[l.id] = l
          return next
        })
      }
    } catch {}
  }, [])

  useEffect(() => {
    if (!orbitView.active) return
    const missing = orbitView.results.leads
      .map(l => l.id)
      .filter(id => !leadDetails[id])
    if (missing.length > 0) enrichLeads(missing)
  }, [orbitView.active, orbitView.results.leads, enrichLeads, leadDetails])

  // ESC key to close
  useEffect(() => {
    if (!orbitView.active) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") deactivateOrbitView()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [orbitView.active, deactivateOrbitView])

  if (!orbitView.active) return null

  const sorted = [...orbitView.results.leads].sort(
    (a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0)
  )

  return (
    <div
      className={`
        fixed right-0 top-0 h-full z-[55]
        flex flex-col
        transition-all duration-500 ease-out
        ${visible ? "translate-x-0 opacity-100" : "translate-x-8 opacity-0"}
      `}
      style={{ width: "300px" }}
    >
      {/* Left edge glow */}
      <div className="absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-[rgba(212,175,53,0.15)] to-transparent" />

      <div className="flex-1 flex flex-col bg-[rgba(5,5,12,0.97)] backdrop-blur-md overflow-hidden">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/[0.04]">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#d4af35] animate-pulse" />
              <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-[#d4af35]">
                Campo Cognitivo
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500 font-mono truncate">
              "{orbitView.query}"
            </p>
          </div>
          <button
            onClick={deactivateOrbitView}
            title="Fechar (Esc)"
            className="text-slate-600 hover:text-white transition-colors p-1 ml-2 flex-shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* ── Count ── */}
        <div className="px-5 py-2 border-b border-white/[0.03]">
          <span className="text-[9px] font-mono text-slate-700 uppercase tracking-wider">
            {sorted.length === 0
              ? "Nenhum resultado encontrado"
              : `${sorted.length} lead${sorted.length !== 1 ? "s" : ""} · ordenado por aderência`
            }
          </span>
        </div>

        {/* ── Results list ── */}
        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
          {sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3 px-6 text-center">
              <Brain className="w-8 h-8 text-slate-700" />
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Nenhum lead encontrado para essa intenção.<br />
                Tente reformular a busca.
              </p>
            </div>
          ) : (
            sorted.map((result, i) => {
              const detail = leadDetails[result.id]
              const isTop = i === 0
              const interest = detail?.interest_score ?? null
              const momentum = detail?.momentum_score ?? null

              return (
                <div
                  key={result.id}
                  className={`
                    border-b border-white/[0.03] cursor-pointer
                    transition-colors group
                    hover:bg-white/[0.025]
                    ${isTop ? "bg-[rgba(212,175,53,0.03)]" : ""}
                  `}
                  onClick={() => {
                    openLeadPanel(result.id)
                    // Note: we do NOT deactivate — panel stays open per requirements
                  }}
                >
                  {/* Top section: rank + avatar + name */}
                  <div className="flex items-start gap-3 px-5 pt-4 pb-3">
                    {/* Rank */}
                    <span className={`text-[10px] font-mono mt-1 w-4 flex-shrink-0 ${
                      isTop ? "text-[#d4af35]" : "text-slate-700"
                    }`}>
                      {String(i + 1).padStart(2, "0")}
                    </span>

                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-full overflow-hidden border border-white/10 bg-white/5 flex items-center justify-center shrink-0">
                      {detail?.photo_url
                        ? <img src={detail.photo_url} alt="" className="w-full h-full object-cover" />
                        : <span className="text-[10px] font-medium text-slate-400">
                            {getInitials(detail?.name || result.id.slice(0, 2))}
                          </span>
                      }
                    </div>

                    {/* Name + meta */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[13px] font-medium text-slate-200 truncate">
                          {detail?.name || result.id.slice(0, 8) + "…"}
                        </span>
                        {interest !== null && <TrendIcon score={interest} />}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {detail?.current_state && (
                          <span className="text-[9px] text-[#d4af35]/60 font-mono">
                            {stageLabel(detail.current_state)}
                          </span>
                        )}
                        {detail?.last_interaction_at && (
                          <>
                            <span className="text-slate-700">·</span>
                            <span className="flex items-center gap-1 text-[9px] text-slate-600">
                              <Clock className="w-2.5 h-2.5" />
                              {formatSince(detail.last_interaction_at)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Arrow */}
                    <ChevronRight className="w-3 h-3 text-slate-700 group-hover:text-slate-400 transition-colors shrink-0 mt-1" />
                  </div>

                  {/* Score bars */}
                  {(interest !== null || momentum !== null) && (
                    <div className="px-5 pb-3 space-y-1.5">
                      {interest !== null && (
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-mono text-slate-700 w-14">Interesse</span>
                          <ScoreBar value={interest} color="#d4af35" />
                          <span className="text-[9px] font-mono text-slate-600 w-6 text-right">{Math.round(interest)}</span>
                        </div>
                      )}
                      {momentum !== null && (
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-mono text-slate-700 w-14">Momentum</span>
                          <ScoreBar value={momentum} color="#60a5fa" />
                          <span className="text-[9px] font-mono text-slate-600 w-6 text-right">{Math.round(momentum)}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Match reason + snippet */}
                  {(result.matchReason || result.snippet) && (
                    <div className="px-5 pb-4 space-y-1.5">
                      {result.matchReason && <MatchTag reason={result.matchReason} />}
                      {result.snippet && (
                        <p className="text-[10px] text-slate-600 leading-relaxed line-clamp-2">
                          {result.snippet}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Action suggested */}
                  {detail?.action_suggested && detail.action_suggested !== "none" && (
                    <div className="mx-5 mb-3 px-3 py-2 rounded-lg bg-[#d4af35]/5 border border-[#d4af35]/10">
                      <p className="text-[10px] text-[#d4af35]/70 leading-relaxed">
                        {detail.action_suggested}
                      </p>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-5 py-3 border-t border-white/[0.04] flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-2.5 h-2.5 text-[#d4af35]/40" />
            <span className="text-[9px] font-mono text-slate-700 uppercase tracking-wider">
              motor cognitivo · ia
            </span>
          </div>
          <button
            onClick={deactivateOrbitView}
            className="text-[9px] font-mono text-slate-700 hover:text-slate-400 transition-colors uppercase tracking-wider"
          >
            Esc · Sair
          </button>
        </div>
      </div>
    </div>
  )
}
