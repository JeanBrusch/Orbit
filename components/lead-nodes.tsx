"use client";

import { useMemo, useState, memo, useCallback, useEffect } from "react";
import { Megaphone, Zap, MessageCircle, ChevronDown } from "lucide-react";
import type { CoreState } from "@/app/page";
import {
  useOrbitContext,
  type LeadVisualState,
  LEAD_VISUAL_STATE_LABELS,
} from "./orbit-context";
import { useSupabaseLeads, type OrbitLead } from "@/hooks/use-supabase-data";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface LeadNodesProps {
  highlightedLeads: string[];
  coreState: CoreState;
  onLeadClick?: (leadId: string) => void;
}

type EmotionalAura =
  | "intent"
  | "curious"
  | "conflicted"
  | "aware"
  | "silentGravity"
  | "whatsapp";
type Priority = "hot" | "warm" | "neutral" | "cold";

// ─── Visual Contact Cycle (Radar de Prioridade) ──────────────────────────────
const contactCycleStyles: Record<string, { ring: string; glow: string; intensity: string; opacity: string; pulse?: string }> = {
  verde: { 
    ring: "border-emerald-500/40", 
    glow: "", 
    intensity: "", 
    opacity: "opacity-100",
    pulse: "animate-pulse border-emerald-400"
  },
  azul: { 
    ring: "border-blue-500/30", 
    glow: "", 
    intensity: "", 
    opacity: "opacity-100" 
  },
  amarelo: { 
    ring: "border-amber-400/30", 
    glow: "", 
    intensity: "", 
    opacity: "opacity-90" 
  },
  laranja: { 
    ring: "border-orange-500/30", 
    glow: "", 
    intensity: "", 
    opacity: "opacity-80" 
  },
  vermelho: { 
    ring: "border-rose-600/40", 
    glow: "animate-urgent-pulse", 
    intensity: "", 
    opacity: "opacity-100" 
  },
  cinza: { 
    ring: "border-zinc-500/20", 
    glow: "", 
    intensity: "grayscale opacity-50", 
    opacity: "opacity-50" 
  },
};
const DEFAULT_STATE_RING = { ring: "border-zinc-500/10", glow: "", intensity: "opacity-70", opacity: "opacity-70" };

// CycleStage kept for gravity/positioning logic only (not used for rings)
type CycleStage =
  | "sem_ciclo"
  | "inicio"
  | "explorando"
  | "decidindo"
  | "resolvido"
  | "encerrado";

// Emotional intensity based on aura (used on the node wrapper)
const emotionalIntensity: Record<EmotionalAura, string> = {
  intent:       "brightness-110",
  curious:      "brightness-105",
  conflicted:   "brightness-100",
  aware:        "brightness-95",
  silentGravity: "brightness-90 opacity-80",
  whatsapp:     "brightness-110",
};

interface LeadNode {
  id: string;
  name: string;
  avatar: string;
  photoUrl?: string;
  priority: Priority;
  position: { top: string; left: string };
  badge?: { type: "messages" | "campaign" | "urgent"; count?: number };
  delay: number;
  emotionalAura: EmotionalAura;
  hasRecentActivity?: boolean;
  hasNotification?: boolean;
  needsAttention?: boolean;
  isNew?: boolean;
  isProvisional?: boolean;
  cycleStage: CycleStage;
  daysSinceInteraction?: number;
  hasMatureNotes?: boolean;
  followupActive?: boolean;
  followupRemaining?: number;
  followupDoneToday?: boolean;
  interestScore?: number;
  riskScore?: number;
  currentState?: string;
}

const auraColors: Record<EmotionalAura, { ring: string; glow: string }> = {
  intent: {
    ring: "border-emerald-400/30",
    glow: "",
  },
  curious: {
    ring: "border-[#FFC87A]/30",
    glow: "",
  },
  conflicted: {
    ring: "border-orange-400/30",
    glow: "",
  },
  aware: {
    ring: "border-[#2EC5FF]/30",
    glow: "",
  },
  silentGravity: {
    ring: "border-cyan-300/30",
    glow: "",
  },
  // Green override: unread WhatsApp message — pulsing, replaces current aura until lead is opened
  whatsapp: {
    ring: "border-emerald-500/50",
    glow: "",
  },
};

const priorityOpacity: Record<Priority, string> = {
  hot: "opacity-100",
  warm: "opacity-90",
  neutral: "opacity-75",
  cold: "opacity-60",
};

const staticLeadNodes: LeadNode[] = [];

// ─────────────────────────────────────────────────────────────────────────────
// COLLISION DETECTION — multi-pass, adaptive minimum distance
// ─────────────────────────────────────────────────────────────────────────────
function resolveCollisions(nodes: LeadNode[]): LeadNode[] {
  const MIN_DISTANCE = 10;
  const MAX_ITERATIONS = 8;
  const PADDING = { min: 8, max: 92 };

  // ── Zona proibida: OrbitCore fica em 50%, 50% ──
  const CORE_CENTER = { top: 50, left: 50 };
  const CORE_RADIUS = 18; // % — nenhum nó entra nessa área

  const resolved = nodes.map((n) => ({
    ...n,
    position: { ...n.position },
  }));

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    let moved = false;

    // 1. Repulsão nó-a-nó (lógica original)
    for (let i = 0; i < resolved.length; i++) {
      const a = resolved[i];
      let topA = parseFloat(a.position.top);
      let leftA = parseFloat(a.position.left);

      for (let j = i + 1; j < resolved.length; j++) {
        const b = resolved[j];
        let topB = parseFloat(b.position.top);
        let leftB = parseFloat(b.position.left);

        const dTop = topB - topA;
        const dLeft = leftB - leftA;
        const dist = Math.sqrt(dTop * dTop + dLeft * dLeft);

        if (dist < MIN_DISTANCE && dist > 0.001) {
          const overlap = (MIN_DISTANCE - dist) / 2 + 1;
          const angle = Math.atan2(dTop, dLeft);
          const cosA = Math.cos(angle);
          const sinA = Math.sin(angle);

          topA = Math.min(
            PADDING.max,
            Math.max(PADDING.min, topA - sinA * overlap),
          );
          leftA = Math.min(
            PADDING.max,
            Math.max(PADDING.min, leftA - cosA * overlap),
          );
          topB = Math.min(
            PADDING.max,
            Math.max(PADDING.min, topB + sinA * overlap),
          );
          leftB = Math.min(
            PADDING.max,
            Math.max(PADDING.min, leftB + cosA * overlap),
          );

          resolved[i] = {
            ...a,
            position: { top: `${topA}%`, left: `${leftA}%` },
          };
          resolved[j] = {
            ...b,
            position: { top: `${topB}%`, left: `${leftB}%` },
          };
          moved = true;
        }
      }
    }

    // 2. Repulsão do centro — expulsa nós dentro da exclusion zone
    for (let i = 0; i < resolved.length; i++) {
      let top = parseFloat(resolved[i].position.top);
      let left = parseFloat(resolved[i].position.left);

      const dTop = top - CORE_CENTER.top;
      const dLeft = left - CORE_CENTER.left;
      const dist = Math.sqrt(dTop * dTop + dLeft * dLeft);

      if (dist < CORE_RADIUS) {
        if (dist < 0.001) {
          // Nó exatamente no centro — empurra para direção aleatória determinística
          const angle = (i / nodes.length) * 2 * Math.PI;
          top = CORE_CENTER.top + Math.sin(angle) * (CORE_RADIUS + 2);
          left = CORE_CENTER.left + Math.cos(angle) * (CORE_RADIUS + 2);
        } else {
          // Empurra radialmente para fora até a borda da zona proibida
          const scale = (CORE_RADIUS + 2) / dist;
          top = CORE_CENTER.top + dTop * scale;
          left = CORE_CENTER.left + dLeft * scale;
        }

        top = Math.min(PADDING.max, Math.max(PADDING.min, top));
        left = Math.min(PADDING.max, Math.max(PADDING.min, left));

        resolved[i] = {
          ...resolved[i],
          position: { top: `${top}%`, left: `${left}%` },
        };
        moved = true;
      }
    }

    if (!moved) break;
  }

  return resolved;
}

// ─────────────────────────────────────────────────────────────────────────────
// GRAVITY — pulls leads toward the Orbit Core centre (50 %, 50 %)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a pull-strength based on how "hot" the lead is.
 *
 * Stage weights (stronger → closer to core):
 *   decidindo  → 0.45   (actively deciding, must be prominent)
 *   explorando → 0.30
 *   inicio     → 0.20
 *   resolvido  → 0.10   (deal done, can drift outward)
 *   encerrado  → 0      (no pull at all)
 *   sem_ciclo  → 0.05
 */
function getStagePullStrength(cycleStage: CycleStage): number {
  switch (cycleStage) {
    case "decidindo":
      return 0.45;
    case "explorando":
      return 0.3;
    case "inicio":
      return 0.2;
    case "resolvido":
      return 0.1;
    case "encerrado":
      return 0.0;
    case "sem_ciclo":
      return 0.05;
    default:
      return 0.05;
  }
}

/**
 * Core gravity — always applied based on cycle stage.
 * This replaces the old boolean `hasPriorityGravity` logic so that EVERY
 * lead with an active stage gets pulled toward the centre proportionally.
 */
function applyGravity(
  position: { top: string; left: string },
  cycleStage: CycleStage,
  daysSinceInteraction: number | undefined,
  extraBoost: number = 0, // e.g. follow-up or recent contacts bonus
): { top: string; left: string } {
  const days = daysSinceInteraction ?? 0

  let pullStrength = Math.min(
    0.65,
    getStagePullStrength(cycleStage) + extraBoost,
  );

  if (days > 30) {
    pullStrength = -0.45; // Empurra forte para a periferia (quasi-invisivel)
  } else if (days > 15) {
    pullStrength = -0.10; // Empurra suavemente para fora
  }

  if (pullStrength === 0) return position;

  const top = parseFloat(position.top);
  const left = parseFloat(position.left);
  // Para push negativo, afasta do centro (50,50) em vez de aproximar
  const newTop = top + (50 - top) * pullStrength;
  const newLeft = left + (50 - left) * pullStrength;

  // Clamp so nodes stay within the visible canvas
  const clampedTop = Math.min(92, Math.max(8, newTop));
  const clampedLeft = Math.min(92, Math.max(8, newLeft));
  return { top: `${clampedTop}%`, left: `${clampedLeft}%` };
}

/**
 * Orbit-view gravity — additional pull for leads related to the active
 * intention (scales with relevance score and day-load factor).
 */
function applyOrbitViewGravity(
  position: { top: string; left: string },
  relevanceScore: number,
  dayLoadFactor: number = 1.0,
): { top: string; left: string } {
  if (relevanceScore <= 0) return position;

  const top = parseFloat(position.top);
  const left = parseFloat(position.left);

  let orbitMultiplier: number;
  if (relevanceScore >= 0.8) orbitMultiplier = 0.6;
  else if (relevanceScore >= 0.6) orbitMultiplier = 0.45;
  else if (relevanceScore >= 0.4) orbitMultiplier = 0.3;
  else orbitMultiplier = 0.15;

  const pullStrength = orbitMultiplier * dayLoadFactor;
  const newTop = top + (50 - top) * pullStrength;
  const newLeft = left + (50 - left) * pullStrength;
  return { top: `${newTop}%`, left: `${newLeft}%` };
}

// ─────────────────────────────────────────────────────────────────────────────
// Badge helpers (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

function BadgeContent({ badge }: { badge: LeadNode["badge"] }) {
  if (!badge) return null;
  if (badge.type === "messages") {
    return (
      <div className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[#2EC5FF]/80 px-1 text-[9px] font-medium text-white">
        {badge.count ? badge.count : <MessageCircle className="h-2 w-2" />}
      </div>
    );
  }
  if (badge.type === "campaign") {
    return (
      <div className="flex h-4 w-4 items-center justify-center rounded-full bg-[#FFC87A]/80 text-white">
        <Megaphone className="h-2.5 w-2.5" />
      </div>
    );
  }
  if (badge.type === "urgent") {
    return (
      <div className="flex h-4 w-4 animate-urgent-pulse items-center justify-center rounded-full bg-[#FF7A7A]/70 text-white">
        <Zap className="h-2.5 w-2.5" />
      </div>
    );
  }
  return null;
}

function NotificationRing() {
  return (
    <>
      <div className="absolute -inset-1 animate-notification-ring rounded-full border border-[#FF7A7A]/60" />
      <div
        className="absolute -inset-2 animate-notification-ring rounded-full border border-[#FF7A7A]/40"
        style={{ animationDelay: "0.3s" }}
      />
      <div
        className="absolute -inset-3 animate-notification-ring rounded-full border border-[#FF7A7A]/20"
        style={{ animationDelay: "0.6s" }}
      />
    </>
  );
}

function FollowUpRing() {
  return (
    <>
      <div className="absolute -inset-1 animate-notification-ring rounded-full border border-amber-400/60" />
      <div
        className="absolute -inset-2 animate-notification-ring rounded-full border border-amber-400/40"
        style={{ animationDelay: "0.3s" }}
      />
      <div
        className="absolute -inset-3 animate-notification-ring rounded-full border border-amber-400/20"
        style={{ animationDelay: "0.6s" }}
      />
    </>
  );
}

type ActionBadgeType = "lightning" | "plane" | "chat" | "number";

interface ActionBadgeProps {
  type: ActionBadgeType;
  number?: number;
  title?: string;
  onClick?: (e: React.MouseEvent) => void;
}

const badgeColors: Record<ActionBadgeType, string> = {
  lightning: "text-amber-400 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]",
  plane: "text-sky-400 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]",
  chat: "text-violet-400 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]",
  number: "text-emerald-400 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]",
};

function ActionBadge({ type, number, title, onClick }: ActionBadgeProps) {
  const colorClass = badgeColors[type];
  return (
    <div
      className={`absolute -top-2 -right-2 z-10 flex items-center justify-center ${colorClass} ${onClick ? "cursor-pointer hover:scale-110 transition-transform" : ""}`}
      style={{
        fontSize: type === "number" ? "14px" : "18px",
        fontWeight: 700,
        lineHeight: 1,
      }}
      title={title}
      onClick={onClick}
    >
      {type === "lightning" && <span>⚡</span>}
      {type === "plane" && <span>✈️</span>}
      {type === "chat" && <span>💬</span>}
      {type === "number" && number !== undefined && (
        <span style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
          {Math.min(number, 7)}
        </span>
      )}
    </div>
  );
}

function ActivityIndicators({
  leadId,
  leadStates,
  hasFollowUpDue,
}: {
  leadId: string;
  leadStates: Record<string, any>;
  hasFollowUpDue: boolean;
}) {
  const leadState = leadStates[leadId];
  if (!leadState) return null;

  const hasCapsule = leadState.cycles && leadState.cycles.length > 0;
  const hasPropertiesSent = leadState.cycles?.some(
    (cycle: any) => cycle.capsuleData && cycle.capsuleData.length > 0,
  );

  if (!hasCapsule && !hasPropertiesSent && !hasFollowUpDue) return null;

  return (
    <div className="mt-0.5 flex items-center justify-center gap-0.5">
      {hasCapsule && (
        <span
          className="h-1 w-1 rounded-full bg-blue-400/70"
          title="Tem cápsula"
        />
      )}
      {hasPropertiesSent && (
        <span
          className="h-1 w-1 rounded-full bg-sky-400/80"
          title="Propriedades enviadas"
        />
      )}
      {hasFollowUpDue && (
        <span
          className="h-1 w-1 rounded-full bg-amber-400/70"
          title="Aguardando resposta"
        />
      )}
    </div>
  );
}

const visualStateStyles: Record<
  LeadVisualState,
  { dot: string; label: string }
> = {
  ativo: { dot: "bg-sky-500", label: "text-sky-400" },
  aguardando: { dot: "bg-amber-500", label: "text-amber-400" },
  em_decisao: { dot: "bg-blue-500", label: "text-blue-400" },
  pausado: { dot: "bg-zinc-500", label: "text-zinc-400" },
  encerrado: { dot: "bg-rose-500/70", label: "text-rose-400/70" },
};

function VisualStateIndicator({
  leadId,
  visualState,
  onStateChange,
}: {
  leadId: string;
  visualState: LeadVisualState | undefined;
  onStateChange: (leadId: string, state: LeadVisualState | undefined) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const allStates: (LeadVisualState | undefined)[] = [
    undefined,
    "ativo",
    "aguardando",
    "em_decisao",
    "pausado",
    "encerrado",
  ];

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="mt-0.5 flex items-center gap-1 rounded px-1 py-0.5 text-[9px] transition-all opacity-0 group-hover:opacity-100"
        >
          {visualState ? (
            <>
              <span
                className={`h-1.5 w-1.5 rounded-full ${visualStateStyles[visualState].dot}`}
              />
              <span
                className={`font-medium ${visualStateStyles[visualState].label}`}
              >
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
        align="center"
        side="bottom"
        className="min-w-[130px] border-white/10 bg-zinc-900/95 backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {allStates.map((state) => (
          <DropdownMenuItem
            key={state ?? "none"}
            onClick={(e) => {
              e.stopPropagation();
              onStateChange(leadId, state);
              setIsOpen(false);
            }}
            className={`flex cursor-pointer items-center gap-2 text-xs ${state === visualState ? "bg-white/10" : ""}`}
          >
            {state ? (
              <>
                <span
                  className={`h-2 w-2 rounded-full ${visualStateStyles[state].dot}`}
                />
                <span className={visualStateStyles[state].label}>
                  {LEAD_VISUAL_STATE_LABELS[state]}
                </span>
              </>
            ) : (
              <span className="text-zinc-500">Sem estado</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mapping helpers
// ─────────────────────────────────────────────────────────────────────────────

function mapEmotionalStateToPriority(state: string): Priority {
  switch (state) {
    case "engaged":
      return "hot";
    case "warm":
      return "warm";
    case "cooling":
      return "cold";
    default:
      return "neutral";
  }
}

function mapEmotionalStateToAura(state: string): EmotionalAura {
  switch (state) {
    case "engaged":
      return "intent";
    case "warm":
      return "curious";
    case "cooling":
      return "silentGravity";
    default:
      return "aware";
  }
}

function getContactCycleAura(
  days: number | undefined,
  needsAttention: boolean,
  isDark: boolean,
): { ring: string; glow: string } {
  if (needsAttention) {
    return { 
      ring: "border-emerald-400", 
      glow: "shadow-[0_0_16px] shadow-emerald-500/80" 
    }
  }

  const d = days ?? 0
  if (d <= 3) return { ring: "border-blue-500", glow: "shadow-[0_0_12px] shadow-blue-500/50" }
  if (d <= 7) return { ring: "border-yellow-400", glow: "shadow-[0_0_12px] shadow-yellow-400/50" }
  if (d <= 15) return { ring: "border-orange-500", glow: "shadow-[0_0_12px] shadow-orange-500/50" }
  return { ring: "border-red-600", glow: "shadow-[0_0_12px] shadow-red-600/50" }
}

// hook leve para detectar o tema atual (lê a classe do <html>)
function useIsDark(): boolean {
  const [isDark, setIsDark] = useState(
    () => document.documentElement.classList.contains("dark")
  )
  useEffect(() => {
    const obs = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains("dark"))
    })
    obs.observe(document.documentElement, { attributeFilter: ["class"] })
    return () => obs.disconnect()
  }, [])
  return isDark
}

// ─────────────────────────────────────────────────────────────────────────────
// Opacity helpers (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

function getActivityOpacity(
  cycleStage: CycleStage,
  leadState: any,
  hasFollowUpDue: boolean,
  followupDoneToday?: boolean,
): string {
  if (cycleStage === "encerrado") return "opacity-40";
  if (followupDoneToday) return "opacity-50";
  if (hasFollowUpDue) return "opacity-100";

  const memory = leadState?.memory;
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentContacts =
    memory?.contactLog?.filter((c: any) => new Date(c.timestamp) > weekAgo) ||
    [];
  if (recentContacts.length > 0) return "opacity-100";

  return "opacity-70";
}

function hasMemorySignal(leadState: any): {
  hasNotes: boolean;
  hasRecentContacts: boolean;
} {
  const memory = leadState?.memory;
  if (!memory) return { hasNotes: false, hasRecentContacts: false };
  const hasNotes = (memory.notes?.length || 0) > 0;
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentContacts =
    memory.contactLog?.filter((c: any) => new Date(c.timestamp) > weekAgo) ||
    [];
  const hasRecentContacts = recentContacts.length >= 3;
  return { hasNotes, hasRecentContacts };
}

const LeadNodeItem = memo(({ 
  node, 
  isHighlighted, 
  highlightDelay, 
  isResponding, 
  hasHighlights,
  leadState,
  orbitViewStatus,
  onMouseEnter,
  onMouseLeave,
  onClick,
  isHovered,
  visualState,
  onVisualStateChange
}: {
  node: LeadNode;
  isHighlighted: boolean;
  highlightDelay: number;
  isResponding: boolean;
  hasHighlights: boolean;
  leadState: any;
  orbitViewStatus: { active: boolean; isRelated: boolean; isUnrelated: boolean };
  onMouseEnter: (id: string) => void;
  onMouseLeave: () => void;
  onClick: (id: string) => void;
  isHovered: boolean;
  visualState: LeadVisualState | undefined;
  onVisualStateChange: (id: string, state: LeadVisualState|undefined) => void;
}) => {
  const isDark = useIsDark();

  const hasFollowUpDue = !!(
    node.followupActive &&
    (node.followupRemaining || 0) > 0 &&
    !node.followupDoneToday
  );

  const getFadeDepth = (days: number | undefined, needsAttention: boolean): string => {
    if (needsAttention) return ""                                  // 1. Mensagem Nova: sempre pleno
    const d = days ?? 0
    if (d <= 3)  return ""                                         // pleno
    if (d <= 7)  return "opacity-90"                               // quase pleno
    if (d <= 15) return "opacity-80 scale-[0.97]"                  // começa a recuar, mas cor ainda visível
    if (d <= 30) return "opacity-75 scale-[0.94] grayscale-[0.3]"  // recuado
    return            "opacity-20 scale-[0.80] grayscale"            // > 30 dias: quasi-invisível e menor
  }

  let activityOpacity = ""
  if (orbitViewStatus.active) {
    if (orbitViewStatus.isRelated) {
      // Powerful glow for highlighted search results
      activityOpacity = "scale-105 drop-shadow-[0_0_15px_rgba(212,175,53,0.5)] z-50 brightness-110 opacity-100"
    } else {
      // Significant dimming for unrelated leads to create contrast
      activityOpacity = "opacity-15 grayscale scale-90"
    }
  } else {
    // Normal depth-fade behavior when search isn't active
    activityOpacity = getFadeDepth(node.daysSinceInteraction, !!node.needsAttention)
  }

  return (
    <div
      className={`pointer-events-auto absolute transition-all duration-[600ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${node.needsAttention ? 'animate-pulse z-40' : ''} ${activityOpacity} ${!isResponding && !node.isNew ? "animate-node-float" : ""} ${node.cycleStage === "decidindo" || hasFollowUpDue
          ? "animate-hot-lead-pulse"
          : ""
        } ${node.isNew ? "animate-lead-emerge" : ""} ${orbitViewStatus.isRelated ? "z-30" : ""}`}
      style={{
        top: node.position.top,
        left: node.position.left,
        animationDelay: `${node.delay}s`,
        transitionDelay: orbitViewStatus.active && orbitViewStatus.isRelated ? `${highlightDelay}s` : "0s",
      }}
      onMouseEnter={() => onMouseEnter(node.id)}
      onMouseLeave={() => onMouseLeave()}
    >
      <div
        onClick={() => onClick(node.id)}
        className="cubic-bezier-smooth group flex cursor-pointer flex-col items-center transition-all duration-[240ms] hover:scale-105"
      >
        <div className="relative">
          {/* O raio de lightning badge foi removido conforme solicitação */}
          {hasFollowUpDue && !node.needsAttention && <FollowUpRing />}

          <div
            className={`flex h-10 w-10 relative mt-0 z-10 items-center justify-center overflow-hidden rounded-full border-2 bg-[var(--orbit-glass)] text-xs font-light text-[var(--orbit-text)] backdrop-blur-sm transition-all duration-300 ${
              isHighlighted && isResponding
                ? "animate-lead-highlight scale-110 border-[var(--orbit-glow)]"
                : node.isNew
                  ? "border-[var(--orbit-glow)] animate-new-lead-glow"
                  : `${getContactCycleAura(node.daysSinceInteraction, !!node.needsAttention, isDark).ring} ${getContactCycleAura(node.daysSinceInteraction, !!node.needsAttention, isDark).glow}`
            }`}
            style={{
              animationDelay: isHighlighted ? `${highlightDelay}s` : "0s",
            }}
          >
            {node.photoUrl && node.photoUrl !== "null" ? (
              <img
                src={node.photoUrl}
                alt={node.name}
                className="h-full w-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                  const fallback = document.createElement("span");
                  fallback.textContent = node.avatar;
                  e.currentTarget.parentElement?.appendChild(fallback);
                }}
              />
            ) : node.avatar}
          </div>

          {(node.daysSinceInteraction ?? 0) > 30 && (
            <div className="absolute -bottom-1 -right-1 flex items-center gap-0.5 rounded-full bg-slate-50/90 dark:bg-zinc-900/80 px-1 py-0.5 text-[7px] text-slate-500 dark:text-zinc-400 border border-slate-200 dark:border-white/5 font-medium shadow-sm">
              <span>⟳</span>
              <span>{node.daysSinceInteraction}d</span>
            </div>
          )}

        </div>

        <div
          className={`mt-1 flex flex-col items-center text-center text-[10px] font-medium leading-tight backdrop-blur-sm transition-all duration-[240ms] drop-shadow-sm ${isHighlighted && isResponding
              ? "text-[var(--orbit-glow)] font-semibold"
              : node.cycleStage === "encerrado" || node.cycleStage === "sem_ciclo"
                ? "text-slate-400 dark:text-zinc-500"
                : "text-slate-700 dark:text-zinc-300 group-hover:text-[var(--orbit-glow)] dark:group-hover:text-[var(--orbit-glow)]"
            }`}
        >
          {node.name.split(" ").map((part, i) => (
            <span key={i}>{part}</span>
          ))}
        </div>


        <VisualStateIndicator leadId={node.id} visualState={visualState} onStateChange={onVisualStateChange} />
      </div>

      {isHovered && (
        <div className={`absolute left-1/2 -translate-x-1/2 w-52 rounded-md border border-white/10 bg-zinc-950/95 backdrop-blur-2xl shadow-2xl p-4 z-[9999] pointer-events-none animate-in fade-in zoom-in-95 duration-200 ${parseFloat(node.position.top) < 20 ? "top-full mt-4" : "-top-4 -translate-y-full"}`}>
          <div className="flex flex-col gap-3">
            <div>
              <p className="font-semibold text-slate-100 text-sm whitespace-nowrap overflow-hidden text-ellipsis">{node.name}</p>
              {node.currentState && <p className="text-[10px] text-zinc-400 capitalize mt-0.5">{node.currentState}</p>}
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between items-center"><span className="text-zinc-500">Interesse</span><span className="text-zinc-300 font-medium">{node.interestScore ? `${node.interestScore}%` : "—"}</span></div>
              <div className="flex justify-between items-center"><span className="text-zinc-500">Risco</span><span className={`font-medium ${node.riskScore && node.riskScore > 60 ? "text-red-400" : "text-zinc-300"}`}>{node.riskScore ? `${node.riskScore}%` : "—"}</span></div>
              <div className="flex justify-between items-center"><span className="text-zinc-500">Ação</span><span className="text-amber-400 font-medium">{node.needsAttention ? "Responder" : "—"}</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
LeadNodeItem.displayName = "LeadNodeItem";

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export function LeadNodes({
  highlightedLeads,
  coreState,
  onLeadClick,
}: LeadNodesProps) {
  const isResponding = coreState === "responding";
  const hasHighlights = highlightedLeads.length > 0;

  const { leads: supabaseLeads, loading } = useSupabaseLeads();

  const {
    leadStates,
    newLeads,
    getLeadsWithActiveFollowUp,
    getLeadVisualState,
    setLeadVisualState,
  } = useOrbitContext();

  // Local helper para substituir a função removida do contexto
  const hasActiveCycle = (id: string) => {
    const state = leadStates[id]
    if (!state) return false
    return state.visualState && ["ativo", "aguardando", "em_decisao"].includes(state.visualState)
  }

  const [activeVisualStates, setActiveVisualStates] = useState<
    Record<string, LeadVisualState>
  >({});
  
  const [hoveredLeadId, setHoveredLeadId] = useState<string | null>(null);
  const [clearedAttentionLeads, setClearedAttentionLeads] = useState<string[]>([]);

  const { orbitView } = useOrbitContext();

  const followUpLeads = getLeadsWithActiveFollowUp();

  // ── Admin leads ──────────────────────────────────────────────────────────
  const adminLeadNodes: LeadNode[] = useMemo(() => {
    const adminLeads = Object.values(leadStates).filter((state) => state.adminData);
    return adminLeads.map((state) => ({
      id: state.id,
      name: state.adminData!.name,
      avatar: state.adminData!.avatar,
      photoUrl: state.adminData!.photoUrl,
      priority: "warm" as Priority,
      position: state.adminData!.position,
      delay: 0,
      emotionalAura: "aware" as EmotionalAura,
      hasRecentActivity: newLeads.includes(state.id),
      isNew: newLeads.includes(state.id),
      isProvisional: state.isProvisional,
      cycleStage: "sem_ciclo" as CycleStage,
      contactCycle: "azul" as const,
      daysSinceInteraction: 0,
    }));
  }, [leadStates, newLeads]);

  // ── Supabase leads ───────────────────────────────────────────────────────
  const supabaseLeadNodes: LeadNode[] = useMemo(() => {
    return supabaseLeads.map((lead: OrbitLead): LeadNode => {
      const priority = mapEmotionalStateToPriority(lead.emotionalState);
      const emotionalAura = mapEmotionalStateToAura(lead.emotionalState);
      
      let mappedBadge: LeadNode["badge"] = undefined;
      if (lead.badge) {
        mappedBadge = {
          type: lead.badge === "hot" ? "urgent" : lead.badge === "campaign" ? "campaign" : "messages",
        };
      }

      return {
        id: lead.id,
        name: lead.name,
        avatar: lead.avatar,
        photoUrl: lead.photoUrl,
        priority,
        needsAttention: clearedAttentionLeads.includes(lead.id) ? false : !!lead.needsAttention,
        position: lead.position,
        badge: mappedBadge,
        delay: lead.delay,
        emotionalAura,
        hasRecentActivity: lead.hasCapsuleActive,
        hasNotification: lead.emotionalState === "engaged",
        cycleStage: (lead.cycleStage as CycleStage) || ("sem_ciclo" as CycleStage),
        daysSinceInteraction: lead.daysSinceInteraction,
        hasMatureNotes: lead.hasMatureNotes,
        followupActive: lead.followupActive,
        followupRemaining: lead.followupRemaining,
        followupDoneToday: lead.followupDoneToday,
        interestScore: lead.interestScore,
        riskScore: lead.riskScore,
        currentState: lead.currentState,
      };
    });
  }, [supabaseLeads, clearedAttentionLeads]);

  // ── Day-load factor ──────────────────────────────────────────────────────
  const activeLeadCount = useMemo(
    () => supabaseLeads.filter((l: OrbitLead) => l.needsAttention || l.cycleStage === "decidindo").length,
    [supabaseLeads],
  );

  const dayLoadFactor = useMemo(() => {
    if (activeLeadCount >= 10) return 0.5;
    if (activeLeadCount >= 6) return 0.7;
    if (activeLeadCount >= 3) return 0.85;
    return 1.0;
  }, [activeLeadCount]);

  // ── Orbit-view scores ────────────────────────────────────────────────────
  const orbitViewLeadScores = useMemo(() => {
    if (!orbitView.active) return new Map<string, number>();
    const sortedLeads = [...orbitView.results.leads].sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
    const scores = new Map<string, number>();
    for (const lead of sortedLeads.slice(0, 18)) {
      scores.set(lead.id, lead.relevanceScore || 0.7);
    }
    return scores;
  }, [orbitView.active, orbitView.results.leads]);

  // ── Combine + gravity + collision ────────────────────────────────────────
  const allLeadNodes = useMemo(() => {
    const combined = [...supabaseLeadNodes, ...adminLeadNodes];

    const withGravity = combined.map((node) => {
      const leadState = leadStates[node.id];
      const memSignal = hasMemorySignal(leadState);
      const hasFollowUpDue = !!(node.followupActive && (node.followupRemaining || 0) > 0 && !node.followupDoneToday);
      const extraBoost = (hasFollowUpDue ? 0.1 : 0) + (memSignal.hasRecentContacts ? 0.05 : 0);
      let pos = applyGravity(node.position, node.cycleStage, node.daysSinceInteraction, extraBoost);
      const orbitScore = orbitViewLeadScores.get(node.id) || 0;
      if (orbitView.active && orbitScore > 0) {
        pos = applyOrbitViewGravity(pos, orbitScore, dayLoadFactor);
      }
      return { ...node, position: pos };
    });

    return resolveCollisions(withGravity);
  }, [supabaseLeadNodes, adminLeadNodes, leadStates, orbitViewLeadScores, orbitView.active, dayLoadFactor]);

  const handleLeadClick = useCallback((leadId: string) => {
    setClearedAttentionLeads(prev =>
      prev.includes(leadId) ? prev : [...prev, leadId]
    );

    // Persiste no banco — sobrevive ao reload
    fetch(`/api/lead/${leadId}/read`, { method: 'POST' }).catch((err) =>
      console.error('[LeadNodes] Erro ao marcar lead como lido:', err)
    );
  
    onLeadClick?.(leadId);
  }, [onLeadClick]);
  const handleMouseEnter = useCallback((id: string) => setHoveredLeadId(id), []);
  const handleMouseLeave = useCallback(() => setHoveredLeadId(null), []);
  const handleNodeClick = useCallback((id: string) => onLeadClick?.(id), [onLeadClick]);

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {allLeadNodes.map((node) => {
        const isHighlighted = highlightedLeads.includes(node.id);
        const highlightDelay = isHighlighted ? highlightedLeads.indexOf(node.id) * 0.15 : 0;
        const orbitViewScore = orbitViewLeadScores.get(node.id) || 0;

        return (
          <LeadNodeItem
            key={node.id}
            node={node}
            isHighlighted={isHighlighted}
            highlightDelay={highlightDelay}
            isResponding={isResponding}
            hasHighlights={hasHighlights}
            leadState={leadStates[node.id]}
            orbitViewStatus={{
              active: orbitView.active,
              isRelated: orbitView.active && orbitViewScore > 0,
              isUnrelated: orbitView.active && orbitViewScore === 0
            }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={handleLeadClick}
            isHovered={hoveredLeadId === node.id}
            visualState={getLeadVisualState(node.id)}
            onVisualStateChange={setLeadVisualState}
          />
        );
      })}
    </div>
  );
}
