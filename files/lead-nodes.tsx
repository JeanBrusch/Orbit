"use client"

import { useMemo, useState, useEffect } from "react"
import { Megaphone, Zap, MessageCircle, ChevronDown } from "lucide-react"
import type { CoreState } from "@/app/page"
import { useOrbitContext, type LeadVisualState, LEAD_VISUAL_STATE_LABELS } from "./orbit-context"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface LeadNodesProps {
  highlightedLeads: string[]
  coreState: CoreState
  onLeadClick?: (leadId: string) => void
}

type EmotionalAura = "intent" | "curious" | "conflicted" | "aware" | "silentGravity"
type Priority = "hot" | "warm" | "neutral" | "cold"

interface LeadNode {
  id: string
  name: string
  avatar: string
  photoUrl?: string
  priority: Priority
  position: { top: string; left: string }
  badge?: { type: "messages" | "campaign" | "urgent"; count?: number }
  delay: number
  emotionalAura: EmotionalAura
  hasRecentActivity?: boolean
  hasNotification?: boolean
  needsAttention?: boolean // mensagem recebida não respondida → anel verde pulsante
  isNew?: boolean
  isProvisional?: boolean
}

// ─── Paleta de auras: borda fina + glow suave (light e dark separados) ────────
const auraConfig: Record<EmotionalAura, {
  borderLight: string; borderDark: string
  glowLight: string;   glowDark: string
  nameLight: string;   nameDark: string
}> = {
  intent: {
    borderLight: "rgba(16,185,129,0.5)",   borderDark: "rgba(52,211,153,0.55)",
    glowLight:   "0 0 10px rgba(16,185,129,0.22), 0 0 20px rgba(16,185,129,0.08)",
    glowDark:    "0 0 12px rgba(52,211,153,0.32), 0 0 24px rgba(52,211,153,0.12)",
    nameLight:   "#059669",                nameDark:   "#34d399",
  },
  curious: {
    borderLight: "rgba(245,158,11,0.5)",   borderDark: "rgba(255,200,122,0.55)",
    glowLight:   "0 0 10px rgba(245,158,11,0.22), 0 0 20px rgba(245,158,11,0.08)",
    glowDark:    "0 0 12px rgba(255,200,122,0.32), 0 0 24px rgba(255,200,122,0.12)",
    nameLight:   "#b45309",                nameDark:   "#fbbf24",
  },
  conflicted: {
    borderLight: "rgba(239,68,68,0.45)",   borderDark: "rgba(255,122,122,0.5)",
    glowLight:   "0 0 10px rgba(239,68,68,0.2), 0 0 20px rgba(239,68,68,0.07)",
    glowDark:    "0 0 12px rgba(255,122,122,0.3), 0 0 24px rgba(255,122,122,0.1)",
    nameLight:   "#dc2626",                nameDark:   "#f87171",
  },
  aware: {
    borderLight: "rgba(14,165,233,0.45)",  borderDark: "rgba(46,197,255,0.5)",
    glowLight:   "0 0 10px rgba(14,165,233,0.2), 0 0 20px rgba(14,165,233,0.07)",
    glowDark:    "0 0 12px rgba(46,197,255,0.3), 0 0 24px rgba(46,197,255,0.1)",
    nameLight:   "#0284c7",                nameDark:   "#38bdf8",
  },
  silentGravity: {
    borderLight: "rgba(148,163,184,0.3)",  borderDark: "rgba(100,116,139,0.35)",
    glowLight:   "0 0 6px rgba(148,163,184,0.12)",
    glowDark:    "0 0 6px rgba(100,116,139,0.18)",
    nameLight:   "#94a3b8",                nameDark:   "#64748b",
  },
}

// ─── Verde exclusivo: mensagem recebida não respondida ─────────────────────────
const attentionConfig = {
  borderLight: "rgba(34,197,94,0.65)",   borderDark: "rgba(74,222,128,0.7)",
  glowLight:   "0 0 14px rgba(34,197,94,0.38), 0 0 28px rgba(34,197,94,0.14)",
  glowDark:    "0 0 16px rgba(74,222,128,0.45), 0 0 32px rgba(74,222,128,0.18)",
  nameLight:   "#16a34a",                nameDark:   "#4ade80",
  ringLight:   "rgba(34,197,94,0.55)",   ringDark:   "rgba(74,222,128,0.6)",
}

const priorityOpacity: Record<Priority, number> = {
  hot: 1, warm: 0.9, neutral: 0.7, cold: 0.52,
}

const staticLeadNodes: LeadNode[] = [
  {
    id: "1", name: "Marina Costa", avatar: "MC", priority: "hot",
    position: { top: "32%", left: "28%" },
    badge: { type: "messages", count: 3 }, delay: 0,
    emotionalAura: "intent", needsAttention: true, hasRecentActivity: true,
  },
  {
    id: "2", name: "Lucas Ferreira", avatar: "LF", priority: "hot",
    position: { top: "35%", left: "58%" }, delay: 0.8, emotionalAura: "curious",
  },
  {
    id: "3", name: "Ana Rodrigues", avatar: "AR", priority: "warm",
    position: { top: "58%", left: "22%" },
    badge: { type: "campaign" }, delay: 1.2,
    emotionalAura: "aware", hasRecentActivity: true,
  },
  {
    id: "4", name: "Pedro Santos", avatar: "PS", priority: "neutral",
    position: { top: "68%", left: "62%" }, delay: 2, emotionalAura: "silentGravity",
  },
  {
    id: "5", name: "Julia Mendes", avatar: "JM", priority: "hot",
    position: { top: "42%", left: "12%" },
    badge: { type: "urgent" }, delay: 1.6,
    emotionalAura: "conflicted", hasRecentActivity: true, hasNotification: true,
  },
]

function resolveCollisions(nodes: LeadNode[]): LeadNode[] {
  const minDistance = 12
  const resolved = [...nodes]
  for (let i = 0; i < resolved.length; i++) {
    const a = resolved[i]
    const tA = parseFloat(a.position.top)
    const lA = parseFloat(a.position.left)
    for (let j = i + 1; j < resolved.length; j++) {
      const b = resolved[j]
      let tB = parseFloat(b.position.top)
      let lB = parseFloat(b.position.left)
      const dist = Math.sqrt((tA - tB) ** 2 + (lA - lB) ** 2)
      if (dist < minDistance && dist > 0) {
        const angle = Math.atan2(tB - tA, lB - lA)
        const push = minDistance - dist + 2
        tB = Math.min(85, Math.max(15, tB + Math.sin(angle) * push))
        lB = Math.min(85, Math.max(15, lB + Math.cos(angle) * push))
        resolved[j] = { ...b, position: { top: `${tB}%`, left: `${lB}%` } }
      }
    }
  }
  return resolved
}

// ─── Badge ────────────────────────────────────────────────────────────────────
function BadgeContent({ badge, isDark }: { badge: LeadNode["badge"]; isDark: boolean }) {
  if (!badge) return null
  const base =
    "flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[9px] font-semibold"

  if (badge.type === "messages") {
    return (
      <div
        className={base}
        style={{
          background: isDark ? "rgba(46,197,255,0.92)" : "rgba(14,165,233,0.9)",
          color: "#fff",
          boxShadow: isDark ? "0 0 8px rgba(46,197,255,0.5)" : "0 0 6px rgba(14,165,233,0.3)",
        }}
      >
        {badge.count ?? <MessageCircle className="h-2 w-2" />}
      </div>
    )
  }
  if (badge.type === "campaign") {
    return (
      <div
        className={`${base} h-[18px] w-[18px]`}
        style={{
          background: isDark ? "rgba(255,200,122,0.92)" : "rgba(245,158,11,0.88)",
          color: isDark ? "#09090b" : "#fff",
          boxShadow: isDark ? "0 0 8px rgba(255,200,122,0.4)" : "0 0 6px rgba(245,158,11,0.28)",
        }}
      >
        <Megaphone className="h-2.5 w-2.5" />
      </div>
    )
  }
  if (badge.type === "urgent") {
    return (
      <div
        className={`${base} h-[18px] w-[18px] animate-urgent-pulse`}
        style={{
          background: isDark ? "rgba(255,100,100,0.88)" : "rgba(239,68,68,0.88)",
          color: "#fff",
          boxShadow: isDark ? "0 0 10px rgba(255,100,100,0.5)" : "0 0 8px rgba(239,68,68,0.32)",
        }}
      >
        <Zap className="h-2.5 w-2.5" />
      </div>
    )
  }
  return null
}

// ─── Anéis pulsantes que expandem e dissolvem ─────────────────────────────────
function PulseRings({ color }: { color: string }) {
  return (
    <>
      <div
        className="absolute -inset-1.5 animate-notification-ring rounded-full"
        style={{ border: `1px solid ${color}` }}
      />
      <div
        className="absolute -inset-[10px] animate-notification-ring rounded-full"
        style={{ border: `1px solid ${color}`, animationDelay: "0.35s" }}
      />
      <div
        className="absolute -inset-[16px] animate-notification-ring rounded-full"
        style={{ border: `1px solid ${color}`, animationDelay: "0.7s" }}
      />
    </>
  )
}

// ─── Indicadores de atividade ─────────────────────────────────────────────────
function ActivityIndicators({
  leadId, leadStates, hasFollowUpDue,
}: { leadId: string; leadStates: Record<string, any>; hasFollowUpDue: boolean }) {
  const s = leadStates[leadId]
  if (!s) return null
  const hasCapsule = s.cycles?.length > 0
  const hasProps = s.cycles?.some((c: any) => c.capsuleData?.length > 0)
  if (!hasCapsule && !hasProps && !hasFollowUpDue) return null
  return (
    <div className="mt-0.5 flex items-center justify-center gap-0.5">
      {hasCapsule   && <span className="h-1 w-1 rounded-full bg-blue-400/70"    title="Cápsula ativa" />}
      {hasProps     && <span className="h-1 w-1 rounded-full bg-emerald-400/70" title="Imóveis enviados" />}
      {hasFollowUpDue && <span className="h-1 w-1 rounded-full bg-amber-400/70" title="Follow-up pendente" />}
    </div>
  )
}

const visualStateStyles: Record<LeadVisualState, { dot: string; label: string }> = {
  ativo:      { dot: "bg-emerald-500", label: "text-emerald-400" },
  aguardando: { dot: "bg-amber-500",   label: "text-amber-400" },
  em_decisao: { dot: "bg-blue-500",    label: "text-blue-400" },
  pausado:    { dot: "bg-zinc-500",    label: "text-zinc-400" },
  encerrado:  { dot: "bg-rose-500/70", label: "text-rose-400/70" },
}

function VisualStateIndicator({
  leadId, visualState, onStateChange,
}: {
  leadId: string
  visualState: LeadVisualState | undefined
  onStateChange: (id: string, s: LeadVisualState | undefined) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const all: (LeadVisualState | undefined)[] = [
    undefined, "ativo", "aguardando", "em_decisao", "pausado", "encerrado",
  ]
  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="mt-0.5 flex items-center gap-1 rounded px-1 py-0.5 text-[9px] opacity-0 transition-all group-hover:opacity-100"
        >
          {visualState ? (
            <>
              <span className={`h-1.5 w-1.5 rounded-full ${visualStateStyles[visualState].dot}`} />
              <span className={`font-medium ${visualStateStyles[visualState].label}`}>
                {LEAD_VISUAL_STATE_LABELS[visualState]}
              </span>
            </>
          ) : (
            <span className="text-[var(--orbit-text-muted)]/60">
              <ChevronDown className="h-2.5 w-2.5" />
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="center" side="bottom"
        className="min-w-[130px] border-white/10 bg-zinc-900/95 backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {all.map((state) => (
          <DropdownMenuItem
            key={state ?? "none"}
            onClick={(e) => {
              e.stopPropagation()
              onStateChange(leadId, state)
              setIsOpen(false)
            }}
            className={`flex cursor-pointer items-center gap-2 text-xs ${state === visualState ? "bg-white/10" : ""}`}
          >
            {state ? (
              <>
                <span className={`h-2 w-2 rounded-full ${visualStateStyles[state].dot}`} />
                <span className={visualStateStyles[state].label}>{LEAD_VISUAL_STATE_LABELS[state]}</span>
              </>
            ) : (
              <span className="text-zinc-500">Sem estado</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ─── LeadNodes ────────────────────────────────────────────────────────────────
export function LeadNodes({ highlightedLeads, coreState, onLeadClick }: LeadNodesProps) {
  const isResponding = coreState === "responding"
  const hasHighlights = highlightedLeads.length > 0

  // Detecta dark mode reativo
  const [isDark, setIsDark] = useState(false)
  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains("dark"))
    check()
    const obs = new MutationObserver(check)
    obs.observe(document.documentElement, { attributeFilter: ["class"] })
    return () => obs.disconnect()
  }, [])

  const {
    hasActiveCycle, leadStates, newLeads,
    getLeadsWithActiveFollowUp, getLeadVisualState, setLeadVisualState,
  } = useOrbitContext()

  const followUpLeads = getLeadsWithActiveFollowUp()

  const adminLeadNodes: LeadNode[] = useMemo(
    () =>
      Object.values(leadStates)
        .filter((s) => s.adminData)
        .map((s) => ({
          id: s.id,
          name: s.adminData!.name,
          avatar: s.adminData!.avatar,
          photoUrl: s.adminData!.photoUrl,
          priority: "warm" as Priority,
          position: s.adminData!.position,
          delay: 0,
          emotionalAura: "aware" as EmotionalAura,
          hasRecentActivity: newLeads.includes(s.id),
          isNew: newLeads.includes(s.id),
          isProvisional: s.isProvisional,
        })),
    [leadStates, newLeads],
  )

  const allLeadNodes = useMemo(
    () => resolveCollisions([...staticLeadNodes, ...adminLeadNodes]),
    [adminLeadNodes],
  )

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {allLeadNodes.map((node) => {
        const isHighlighted    = highlightedLeads.includes(node.id)
        const highlightDelay   = isHighlighted ? highlightedLeads.indexOf(node.id) * 0.15 : 0
        const leadHasActiveCycle = hasActiveCycle(node.id)
        const isNeutral        = !leadHasActiveCycle
        const hasFollowUpDue   = followUpLeads.includes(node.id)
        const needsAttention   = !!node.needsAttention

        // ── Resolve estilos de borda/glow/nome ──────────────────────────
        let border: string, glow: string, nameColor: string

        if (isHighlighted && isResponding) {
          border    = "var(--orbit-glow)"
          glow      = `0 0 18px rgba(var(--orbit-glow-rgb),0.55), 0 0 36px rgba(var(--orbit-glow-rgb),0.2)`
          nameColor = "var(--orbit-glow)"
        } else if (needsAttention) {
          // ✅ Verde — só aparece quando há mensagem recebida não respondida
          border    = isDark ? attentionConfig.borderDark : attentionConfig.borderLight
          glow      = isDark ? attentionConfig.glowDark   : attentionConfig.glowLight
          nameColor = isDark ? attentionConfig.nameDark   : attentionConfig.nameLight
        } else if (hasFollowUpDue) {
          border    = isDark ? "rgba(251,191,36,0.6)"   : "rgba(245,158,11,0.55)"
          glow      = isDark
            ? "0 0 12px rgba(251,191,36,0.35), 0 0 24px rgba(251,191,36,0.12)"
            : "0 0 10px rgba(245,158,11,0.25), 0 0 20px rgba(245,158,11,0.08)"
          nameColor = isDark ? "#fbbf24" : "#d97706"
        } else if (node.isNew) {
          border    = "var(--orbit-glow)"
          glow      = `0 0 14px rgba(var(--orbit-glow-rgb),0.45), 0 0 28px rgba(var(--orbit-glow-rgb),0.18)`
          nameColor = "var(--orbit-glow)"
        } else if (isNeutral) {
          border    = isDark ? "rgba(71,85,105,0.3)"    : "rgba(148,163,184,0.32)"
          glow      = "none"
          nameColor = "var(--orbit-text-muted)"
        } else {
          const cfg = auraConfig[node.emotionalAura]
          border    = isDark ? cfg.borderDark : cfg.borderLight
          glow      = isDark ? cfg.glowDark   : cfg.glowLight
          nameColor = isDark ? cfg.nameDark   : cfg.nameLight
        }

        // Cor dos anéis pulsantes
        const ringColor = needsAttention
          ? (isDark ? attentionConfig.ringDark : attentionConfig.ringLight)
          : node.hasNotification
            ? (isDark ? "rgba(255,100,100,0.6)" : "rgba(239,68,68,0.55)")
            : "rgba(251,191,36,0.55)"

        // Opacidade geral
        const opacity = isResponding && hasHighlights && !isHighlighted
          ? 0.32
          : needsAttention || hasFollowUpDue
            ? 1
            : isNeutral
              ? 0.48
              : priorityOpacity[node.priority]

        // Fundo do avatar — glass effect adaptado ao tema
        const avatarBg = isDark
          ? "rgba(12,18,36,0.78)"
          : "rgba(255,255,255,0.88)"

        const avatarText = isDark ? "rgba(226,232,240,0.92)" : "rgba(15,23,42,0.82)"

        return (
          <div
            key={node.id}
            className={[
              "pointer-events-auto absolute transition-all duration-500",
              !isResponding && !node.isNew ? "animate-node-float" : "",
              (node.priority === "hot" && !isNeutral) || hasFollowUpDue ? "animate-hot-lead-pulse" : "",
              node.isNew ? "animate-lead-emerge" : "",
            ].join(" ")}
            style={{
              top:            node.position.top,
              left:           node.position.left,
              opacity,
              animationDelay: `${node.delay}s`,
              transitionDelay: isResponding ? `${highlightDelay}s` : "0s",
            }}
          >
            <div
              onClick={() => onLeadClick?.(node.id)}
              className="cubic-bezier-smooth group flex cursor-pointer flex-col items-center transition-all duration-[240ms] hover:scale-105"
            >
              {/* ── Avatar container ── */}
              <div className="relative">
                {/* Anéis de pulso — só quando necessário */}
                {(needsAttention || node.hasNotification || hasFollowUpDue) && (
                  <PulseRings color={ringColor} />
                )}

                {/* Círculo principal */}
                <div
                  className={[
                    "flex h-11 w-11 items-center justify-center overflow-hidden rounded-full",
                    "text-[11px] font-medium backdrop-blur-sm transition-all duration-500",
                    isHighlighted && isResponding ? "animate-lead-highlight scale-110" : "",
                    node.isNew ? "animate-new-lead-glow" : "",
                  ].join(" ")}
                  style={{
                    background:   avatarBg,
                    color:        avatarText,
                    border:       `1.5px solid ${border}`,
                    boxShadow:    glow,
                    animationDelay: isHighlighted ? `${highlightDelay}s` : "0s",
                  }}
                >
                  {node.photoUrl ? (
                    <img
                      src={node.photoUrl}
                      alt={node.name}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = "none"
                        const span = document.createElement("span")
                        span.textContent = node.avatar
                        e.currentTarget.parentElement?.appendChild(span)
                      }}
                    />
                  ) : (
                    node.avatar
                  )}
                </div>

                {/* Badge */}
                {node.badge && (
                  <div className="absolute -right-1 -top-1 z-10">
                    <BadgeContent badge={node.badge} isDark={isDark} />
                  </div>
                )}
              </div>

              {/* ── Nome ── */}
              <div
                className="mt-1.5 flex flex-col items-center text-center text-[10px] font-medium leading-tight drop-shadow-sm transition-all duration-[240ms]"
                style={{ color: nameColor }}
              >
                {node.name.split(" ").map((part, i) => (
                  <span key={i}>{part}</span>
                ))}
              </div>

              <ActivityIndicators
                leadId={node.id}
                leadStates={leadStates}
                hasFollowUpDue={hasFollowUpDue}
              />

              <VisualStateIndicator
                leadId={node.id}
                visualState={getLeadVisualState(node.id)}
                onStateChange={setLeadVisualState}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
