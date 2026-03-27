"use client"

import { useState, useEffect } from "react"
import { Brain, Zap, MessageSquare, ChevronDown, ChevronUp, Lightbulb } from "lucide-react"

// Mapeamento visual de estágio para exibição
const stageConfig: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  descoberta:    { label: "Descoberta",    color: "text-sky-400",     bg: "bg-sky-500/10",     dot: "bg-sky-400" },
  exploracao:    { label: "Exploração",    color: "text-amber-400",   bg: "bg-amber-500/10",   dot: "bg-amber-400" },
  direcionamento:{ label: "Direcionamento",color: "text-violet-400",  bg: "bg-violet-500/10",  dot: "bg-violet-400" },
  decisao:       { label: "Decisão",       color: "text-emerald-400", bg: "bg-emerald-500/10", dot: "bg-emerald-400" },
  manutencao:    { label: "Manutenção",    color: "text-zinc-400",    bg: "bg-zinc-500/10",    dot: "bg-zinc-400" },
}

interface OrbitInsight {
  id: string
  content: string
  urgency: number
  created_at: string
  message_intention: string | null
  possibility_hook: string | null
  suggested_whatsapp_message: string | null
  emotional_climate: string | null
}

interface LeadOrbitStage {
  client_stage: string | null
}

interface OrbitInsightBarProps {
  leadId: string
}

async function fetchLatestInsight(leadId: string): Promise<{ insight: OrbitInsight | null; stage: string | null }> {
  try {
    const res = await fetch(`/api/leads/${leadId}/insights?limit=1`)
    if (!res.ok) return { insight: null, stage: null }
    const data = await res.json()
    return {
      insight: data?.insights?.[0] ?? null,
      stage: data?.client_stage ?? null,
    }
  } catch {
    return { insight: null, stage: null }
  }
}

export function OrbitInsightBar({ leadId }: OrbitInsightBarProps) {
  const [insight, setInsight] = useState<OrbitInsight | null>(null)
  const [stage, setStage] = useState<string | null>(null)
  const [isExpanded, setIsExpanded] = useState(true)
  const [isCopied, setIsCopied] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!leadId) return
    setIsLoading(true)
    fetchLatestInsight(leadId).then(({ insight, stage }) => {
      setInsight(insight)
      setStage(stage)
      setIsLoading(false)
    })
  }, [leadId])

  const handleCopyMessage = async () => {
    if (!insight?.suggested_whatsapp_message) return
    await navigator.clipboard.writeText(insight.suggested_whatsapp_message)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }

  // Nada a mostrar
  if (!isLoading && !insight) return null

  const stageCfg = stageConfig[stage ?? ""] ?? null

  return (
    <div className="border-b border-[var(--orbit-glass-border)] bg-[var(--orbit-bg)]/50">
      {/* Header do bloco — clicável para expandir/recolher */}
      <button
        onClick={() => setIsExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-2.5 transition-colors hover:bg-[var(--orbit-glow)]/5"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-2">
          <Brain className="h-3.5 w-3.5 text-[var(--orbit-glow)]" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--orbit-glow)]">
            Orbit Analysis
          </span>
          {/* Badge de urgência */}
          {insight && insight.urgency >= 4 && (
            <span className="flex items-center gap-1 rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-400">
              <Zap className="h-2.5 w-2.5" />
              URGENTE
            </span>
          )}
          {/* Badge de estágio */}
          {stageCfg && (
            <span className={`flex items-center gap-1 rounded-full ${stageCfg.bg} px-2 py-0.5 text-[9px] font-semibold ${stageCfg.color}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${stageCfg.dot}`} />
              {stageCfg.label}
            </span>
          )}
        </div>
        {isExpanded
          ? <ChevronUp className="h-3.5 w-3.5 text-[var(--orbit-text-muted)]" />
          : <ChevronDown className="h-3.5 w-3.5 text-[var(--orbit-text-muted)]" />
        }
      </button>

      {/* Corpo expandido */}
      {isExpanded && (
        <div className="space-y-2.5 px-4 pb-3.5">
          {isLoading ? (
            <div className="flex items-center gap-2 py-1.5">
              <div className="h-3.5 w-3.5 animate-spin rounded-full border border-[var(--orbit-glow)]/40 border-t-[var(--orbit-glow)]" />
              <span className="text-[11px] text-[var(--orbit-text-muted)]">Carregando análise...</span>
            </div>
          ) : (
            <>
              {/* Intenção detectada */}
              {insight?.message_intention && (
                <div className="rounded-xl border border-[var(--orbit-glass-border)] bg-[var(--orbit-glass)] px-3 py-2.5">
                  <p className="mb-1 text-[9px] font-bold uppercase tracking-widest text-[var(--orbit-text-muted)]">
                    Intenção detectada
                  </p>
                  <p className="text-xs leading-relaxed text-[var(--orbit-text)]">
                    {insight.message_intention}
                  </p>
                </div>
              )}

              {/* Clima emocional */}
              {insight?.emotional_climate && (
                <div className="flex items-start gap-2 rounded-xl border border-[var(--orbit-glass-border)] bg-[var(--orbit-glass)] px-3 py-2.5">
                  <span className="mt-0.5 text-sm">🌡️</span>
                  <div>
                    <p className="mb-1 text-[9px] font-bold uppercase tracking-widest text-[var(--orbit-text-muted)]">
                      Clima emocional
                    </p>
                    <p className="text-xs leading-relaxed text-[var(--orbit-text)]">
                      {insight.emotional_climate}
                    </p>
                  </div>
                </div>
              )}

              {/* Gancho de possibilidade */}
              {insight?.possibility_hook && (
                <div className="flex items-start gap-2 rounded-xl border border-[var(--orbit-glow)]/20 bg-[var(--orbit-glow)]/5 px-3 py-2.5">
                  <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--orbit-glow)]" />
                  <div>
                    <p className="mb-1 text-[9px] font-bold uppercase tracking-widest text-[var(--orbit-glow)]/70">
                      Gancho de possibilidade
                    </p>
                    <p className="text-xs leading-relaxed text-[var(--orbit-text)]">
                      {insight.possibility_hook}
                    </p>
                  </div>
                </div>
              )}

              {/* Mensagem WhatsApp sugerida */}
              {insight?.suggested_whatsapp_message && (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5">
                  <div className="mb-1.5 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <MessageSquare className="h-3 w-3 text-emerald-400" />
                      <p className="text-[9px] font-bold uppercase tracking-widest text-emerald-400/80">
                        Mensagem sugerida
                      </p>
                    </div>
                    <button
                      onClick={handleCopyMessage}
                      className={`rounded-md px-2 py-0.5 text-[9px] font-semibold transition-all ${
                        isCopied
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-emerald-500/10 text-emerald-400/70 hover:bg-emerald-500/20 hover:text-emerald-400"
                      }`}
                    >
                      {isCopied ? "✓ Copiado" : "Copiar"}
                    </button>
                  </div>
                  <p className="text-xs leading-relaxed text-[var(--orbit-text)] whitespace-pre-wrap">
                    {insight.suggested_whatsapp_message}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
