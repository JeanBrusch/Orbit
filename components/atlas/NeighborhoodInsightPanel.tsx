"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Flame, Users, TrendingUp, MapPin, ArrowRight, Loader2 } from "lucide-react"
import { useTheme } from "next-themes"

export interface NeighborhoodData {
  neighborhood: string
  city: string
  score: number // 0–100
  totalCount: number
  lat: number
  lng: number
}

interface LeadInsight {
  id: string
  name: string
  photo_url: string | null
  orbit_stage: string | null
  interest_score: number
  momentum_score: number
}

interface NeighborhoodInsightPanelProps {
  neighborhood: NeighborhoodData | null
  metric: string
  onClose: () => void
  onLeadClick?: (leadId: string) => void
}

// Labels legíveis das métricas
const METRIC_LABELS: Record<string, string> = {
  all: "Demanda Total",
  sent: "Imóveis Enviados",
  favorited: "Imóveis Favoritados",
  visited: "Visitas Realizadas",
  deciding: "Leads em Decisão",
}

// Estado cognitivo → cor e label
const STAGE_CONFIG: Record<string, { color: string; label: string }> = {
  deciding: { color: "#ff3b30", label: "Decidindo" },
  evaluating: { color: "#ff9500", label: "Avaliando" },
  exploring: { color: "#34c759", label: "Explorando" },
  curious: { color: "#5ac8fa", label: "Curioso" },
  latent: { color: "#8e8e93", label: "Latente" },
  dormant: { color: "#636366", label: "Dormente" },
}

// Score → cor do heatmap
function getScoreColor(score: number) {
  if (score >= 80) return "#ff3030"
  if (score >= 60) return "#ff7820"
  if (score >= 40) return "#ffc830"
  if (score >= 20) return "#00e6b4"
  return "#00d4ff"
}

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="relative h-2 w-full rounded-full bg-white/10 overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${score}%` }}
        transition={{ duration: 1, ease: [0.19, 1, 0.22, 1], delay: 0.2 }}
        className="absolute inset-y-0 left-0 rounded-full"
        style={{
          background: `linear-gradient(to right, #00d4ff, ${getScoreColor(score)})`,
          boxShadow: `0 0 8px ${getScoreColor(score)}80`,
        }}
      />
    </div>
  )
}

export function NeighborhoodInsightPanel({
  neighborhood,
  metric,
  onClose,
  onLeadClick,
}: NeighborhoodInsightPanelProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"
  const [leads, setLeads] = useState<LeadInsight[]>([])
  const [isLoadingLeads, setIsLoadingLeads] = useState(false)

  // Busca leads relacionados ao bairro (via imóveis no bairro)
  useEffect(() => {
    if (!neighborhood) return

    setIsLoadingLeads(true)
    fetch(
      `/api/atlas/heatmap/leads?neighborhood=${encodeURIComponent(neighborhood.neighborhood)}&days=30`
    )
      .then((r) => r.json())
      .then((data) => {
        setLeads(data.leads || [])
      })
      .catch(() => setLeads([]))
      .finally(() => setIsLoadingLeads(false))
  }, [neighborhood?.neighborhood])

  const score = neighborhood?.score ?? 0
  const scoreColor = getScoreColor(score)

  return (
    <AnimatePresence>
      {neighborhood && (
        <motion.div
          initial={{ x: 420, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 420, opacity: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 32 }}
          className={`fixed right-0 top-0 h-full w-full md:w-[380px] z-[40] flex flex-col overflow-hidden shadow-2xl border-l ${
            isDark
              ? "bg-[#09090b]/95 border-white/8 backdrop-blur-2xl"
              : "bg-white/95 border-[var(--orbit-line)] backdrop-blur-2xl"
          }`}
        >
          {/* Header com gradient de cor do calor */}
          <div
            className="relative shrink-0 p-6 pb-8"
            style={{
              background: isDark
                ? `linear-gradient(135deg, ${scoreColor}18 0%, transparent 60%)`
                : `linear-gradient(135deg, ${scoreColor}10 0%, transparent 60%)`,
            }}
          >
            {/* Glow decoration */}
            <div
              className="absolute top-0 right-0 w-40 h-40 rounded-full opacity-20 blur-3xl pointer-events-none"
              style={{ background: scoreColor }}
            />

            <div className="flex items-start justify-between mb-5 relative z-10">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: `${scoreColor}25`, border: `1px solid ${scoreColor}40` }}
                >
                  <Flame className="w-4 h-4" style={{ color: scoreColor }} />
                </div>
                <div>
                  <p className={`text-[10px] font-mono uppercase tracking-[0.18em] mb-0.5 ${isDark ? "text-white/40" : "text-[var(--orbit-text-muted)]"}`}>
                    {METRIC_LABELS[metric] || "Demanda"}
                  </p>
                  <h3 className={`text-lg font-semibold leading-tight ${isDark ? "text-white" : "text-[var(--orbit-text)]"}`}>
                    {neighborhood.neighborhood}
                  </h3>
                  {neighborhood.city && (
                    <p className={`text-[11px] flex items-center gap-1 mt-0.5 ${isDark ? "text-white/40" : "text-[var(--orbit-text-muted)]"}`}>
                      <MapPin className="w-3 h-3" />
                      {neighborhood.city}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={onClose}
                className={`p-3.5 rounded-lg transition-colors flex items-center justify-center ${isDark ? "text-white/40 hover:text-white hover:bg-white/10" : "text-[var(--orbit-text-muted)] hover:text-[var(--orbit-text)] hover:bg-black/5"}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Score visual */}
            <div className="space-y-2 relative z-10">
              <div className="flex items-baseline justify-between">
                <span className={`text-[10px] font-mono uppercase tracking-wider ${isDark ? "text-white/40" : "text-[var(--orbit-text-muted)]"}`}>
                  Intensidade de Interesse
                </span>
                <span className="text-2xl font-bold tabular-nums" style={{ color: scoreColor }}>
                  {score}
                  <span className={`text-xs ml-0.5 font-normal ${isDark ? "text-white/30" : "text-[var(--orbit-text-muted)]"}`}>/100</span>
                </span>
              </div>
              <ScoreBar score={score} />
            </div>

            {/* Stat chips */}
            <div className="flex gap-2 mt-4 relative z-10">
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-mono ${isDark ? "bg-white/5 text-white/50" : "bg-black/5 text-[var(--orbit-text-muted)]"}`}>
                <TrendingUp className="w-3 h-3" />
                {neighborhood.totalCount} interações
              </div>
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-mono ${isDark ? "bg-white/5 text-white/50" : "bg-black/5 text-[var(--orbit-text-muted)]"}`}>
                <Users className="w-3 h-3" />
                {leads.length} leads ativos
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className={`h-px shrink-0 ${isDark ? "bg-white/5" : "bg-[var(--orbit-line)]"}`} />

          {/* Lista de leads */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-5">
              <p className={`text-[10px] font-mono uppercase tracking-[0.18em] mb-4 ${isDark ? "text-white/30" : "text-[var(--orbit-text-muted)]"}`}>
                Leads Ativos neste Bairro
              </p>

              {isLoadingLeads ? (
                <div className="flex flex-col gap-3">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className={`h-16 rounded-xl animate-pulse ${isDark ? "bg-white/5" : "bg-black/5"}`}
                    />
                  ))}
                </div>
              ) : leads.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {leads.map((lead, i) => {
                    const stage = STAGE_CONFIG[lead.orbit_stage || "latent"] || STAGE_CONFIG.latent
                    return (
                      <motion.button
                        key={lead.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.06 }}
                        onClick={() => onLeadClick?.(lead.id)}
                        className={`w-full flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all group ${
                          isDark
                            ? "border-white/5 hover:border-white/15 hover:bg-white/5"
                            : "border-[var(--orbit-line)] hover:border-[var(--orbit-glow)]/30 hover:bg-[var(--orbit-glow)]/3"
                        }`}
                      >
                        {/* Avatar */}
                        <div className={`w-10 h-10 rounded-xl shrink-0 flex items-center justify-center text-xs font-bold overflow-hidden ${isDark ? "bg-white/10" : "bg-[var(--orbit-bg-secondary)] border border-[var(--orbit-line)]"}`}>
                          {lead.photo_url ? (
                            <img src={lead.photo_url} alt={lead.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className={isDark ? "text-white/60" : "text-[var(--orbit-text-muted)]"}>
                              {lead.name.slice(0, 2).toUpperCase()}
                            </span>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className={`text-[13px] font-medium truncate ${isDark ? "text-white/90" : "text-[var(--orbit-text)]"}`}>
                            {lead.name}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span
                              className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider"
                              style={{
                                color: stage.color,
                                background: `${stage.color}18`,
                              }}
                            >
                              {stage.label}
                            </span>
                            {/* Mini score bar */}
                            <div className={`flex-1 h-1 rounded-full overflow-hidden ${isDark ? "bg-white/10" : "bg-black/10"}`}>
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${lead.interest_score}%`,
                                  background: stage.color,
                                }}
                              />
                            </div>
                            <span className={`text-[9px] font-mono tabular-nums ${isDark ? "text-white/30" : "text-[var(--orbit-text-muted)]"}`}>
                              {lead.interest_score}
                            </span>
                          </div>
                        </div>

                        {/* Arrow */}
                        <ArrowRight className={`w-3.5 h-3.5 shrink-0 transition-transform group-hover:translate-x-0.5 ${isDark ? "text-white/20 group-hover:text-white/50" : "text-[var(--orbit-text-muted)]/40 group-hover:text-[var(--orbit-glow)]"}`} />
                      </motion.button>
                    )
                  })}
                </div>
              ) : (
                <div className={`flex flex-col items-center justify-center py-12 gap-3 rounded-xl border border-dashed ${isDark ? "border-white/10" : "border-[var(--orbit-line)]"}`}>
                  <Users className={`w-8 h-8 ${isDark ? "text-white/15" : "text-[var(--orbit-text-muted)]/30"}`} />
                  <p className={`text-xs text-center max-w-[180px] ${isDark ? "text-white/30" : "text-[var(--orbit-text-muted)]"}`}>
                    Nenhum lead com interações neste bairro nos últimos 30 dias
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className={`shrink-0 px-5 py-4 border-t text-[10px] font-mono text-center ${isDark ? "border-white/5 text-white/20" : "border-[var(--orbit-line)] text-[var(--orbit-text-muted)]"}`}>
            Clique num lead para abrir o painel cognitivo
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
