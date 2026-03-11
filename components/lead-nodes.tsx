"use client";

import { useMemo, useState } from "react";
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
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

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

// Cognitive AI state → subtle inner ring
const stateRingColors: Record<string, { ring: string; glow: string }> = {
  latent:     { ring: "border-zinc-500/20",     glow: "" },
  curious:    { ring: "border-sky-400/40",      glow: "shadow-[0_0_4px_rgba(56,189,248,0.1)]" },
  exploring:  { ring: "border-blue-400/60",     glow: "shadow-[0_0_6px_rgba(59,130,246,0.2)]" },
  evaluating: { ring: "border-orange-400/60",   glow: "shadow-[0_0_8px_rgba(251,146,60,0.2)]" },
  deciding:   { ring: "border-red-500/70",      glow: "shadow-[0_0_12px_rgba(239,68,68,0.3)]" },
  resolved:   { ring: "border-violet-400/60",   glow: "shadow-[0_0_8px_rgba(167,139,250,0.2)]" },
  dormant:    { ring: "border-zinc-800",         glow: "" },
};
const DEFAULT_STATE_RING = { ring: "border-zinc-500/30", glow: "" };

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
    ring: "border-emerald-400/60",
    glow: "shadow-[0_0_8px_rgba(52,211,153,0.3)]",
  },
  curious: {
    ring: "border-[#FFC87A]/60",
    glow: "shadow-[0_0_8px_rgba(255,200,122,0.3)]",
  },
  conflicted: {
    ring: "border-orange-400/60",
    glow: "shadow-[0_0_8px_rgba(251,146,60,0.3)]",
  },
  aware: {
    ring: "border-[#2EC5FF]/60",
    glow: "shadow-[0_0_8px_rgba(46,197,255,0.3)]",
  },
  silentGravity: {
    ring: "border-cyan-300/60",
    glow: "shadow-[0_0_8px_rgba(103,232,249,0.3)]",
  },
  // Green override: unread WhatsApp message — pulsing, replaces current aura until lead is opened
  whatsapp: {
    ring: "border-emerald-500/90",
    glow: "shadow-[0_0_14px_rgba(16,185,129,0.5)]",
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
  extraBoost: number = 0, // e.g. follow-up or recent contacts bonus
): { top: string; left: string } {
  const pullStrength = Math.min(
    0.65,
    getStagePullStrength(cycleStage) + extraBoost,
  );
  if (pullStrength <= 0) return position;

  const top = parseFloat(position.top);
  const left = parseFloat(position.left);
  const newTop = top + (50 - top) * pullStrength;
  const newLeft = left + (50 - left) * pullStrength;
  return { top: `${newTop}%`, left: `${newLeft}%` };
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
          className="h-1 w-1 rounded-full bg-emerald-400/70"
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
  ativo: { dot: "bg-emerald-500", label: "text-emerald-400" },
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

// Maps AI cognitive current_state to a subtle border color (not loud, no animation)
function getCognitiveAuraClass(currentState?: string): { ring: string; glow: string } | null {
  switch (currentState) {
    case "deciding":    return { ring: "border-orange-400/60",   glow: "shadow-[0_0_10px_rgba(251,146,60,0.25)]" };
    case "evaluating": return { ring: "border-amber-300/50",    glow: "shadow-[0_0_8px_rgba(252,211,77,0.20)]" };
    case "exploring":  return { ring: "border-sky-400/50",      glow: "shadow-[0_0_8px_rgba(56,189,248,0.20)]" };
    case "curious":    return { ring: "border-violet-400/50",   glow: "shadow-[0_0_8px_rgba(167,139,250,0.20)]" };
    case "resolved":   return { ring: "border-emerald-400/50",  glow: "shadow-[0_0_8px_rgba(52,211,153,0.20)]" };
    case "dormant":    return { ring: "border-zinc-500/40",     glow: "" };
    case "latent":     return { ring: "border-zinc-400/30",     glow: "" };
    default:           return null;
  }
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
    orbitView,
  } = useOrbitContext();

  const followUpLeads = getLeadsWithActiveFollowUp();

  // ── Admin leads ──────────────────────────────────────────────────────────
  const adminLeads = Object.values(leadStates).filter(
    (state) => state.adminData,
  );
  const adminLeadNodes: LeadNode[] = adminLeads.map((state) => ({
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
  }));

  // ── Supabase leads ───────────────────────────────────────────────────────
  const supabaseLeadNodes: LeadNode[] = supabaseLeads.map(
    (lead: OrbitLead) => ({
      id: lead.id,
      name: lead.name,
      avatar: lead.avatar,
      photoUrl: lead.photoUrl,
      priority: mapEmotionalStateToPriority(lead.emotionalState),
      position: lead.position,
      badge: lead.badge
        ? ({
          type:
            lead.badge === "hot"
              ? "urgent"
              : lead.badge === "campaign"
                ? "campaign"
                : "messages",
        } as LeadNode["badge"])
        : undefined,
      delay: lead.delay,
      emotionalAura: mapEmotionalStateToAura(lead.emotionalState),
      hasRecentActivity: lead.hasCapsuleActive,
      hasNotification: lead.emotionalState === "engaged",
      needsAttention: lead.needsAttention,
      cycleStage: (lead.cycleStage as CycleStage) || "sem_ciclo" as CycleStage, // From database — NEVER calculate
      hasMatureNotes: lead.hasMatureNotes,
      followupActive: lead.followupActive,
      followupRemaining: lead.followupRemaining,
      followupDoneToday: lead.followupDoneToday,
      interestScore: lead.interestScore,
      riskScore: lead.riskScore,
      currentState: lead.currentState,
    }),
  );

  // ── Day-load factor ──────────────────────────────────────────────────────
  const activeLeadCount = useMemo(
    () =>
      supabaseLeads.filter(
        (l: OrbitLead) => l.needsAttention || l.cycleStage === "decidindo",
      ).length,
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
    const sortedLeads = [...orbitView.leads].sort(
      (a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0),
    );
    const scores = new Map<string, number>();
    for (const lead of sortedLeads.slice(0, 18)) {
      scores.set(lead.leadId, lead.relevanceScore || 0.7);
    }
    return scores;
  }, [orbitView.active, orbitView.leads]);

  // ── Combine + gravity + collision ────────────────────────────────────────
  const allLeadNodes = useMemo(() => {
    const combined = [...supabaseLeadNodes, ...adminLeadNodes];

    // 1. Apply gravity BEFORE collision resolution so hot leads settle near
    //    the core, and the collision resolver pushes cold ones outward.
    const withGravity = combined.map((node) => {
      const leadState = leadStates[node.id];
      const memSignal = hasMemorySignal(leadState);
      const hasFollowUpDue = !!(
        node.followupActive &&
        (node.followupRemaining || 0) > 0 &&
        !node.followupDoneToday
      );

      // Extra boost for leads with follow-up or recent contacts
      const extraBoost =
        (hasFollowUpDue ? 0.1 : 0) + (memSignal.hasRecentContacts ? 0.05 : 0);

      let pos = applyGravity(node.position, node.cycleStage, extraBoost);

      // Orbit-view additional pull
      const orbitScore = orbitViewLeadScores.get(node.id) || 0;
      if (orbitView.active && orbitScore > 0) {
        pos = applyOrbitViewGravity(pos, orbitScore, dayLoadFactor);
      }

      return { ...node, position: pos };
    });

    // 2. Resolve collisions on the gravity-adjusted positions
    return resolveCollisions(withGravity);
  }, [
    supabaseLeadNodes,
    adminLeadNodes,
    leadStates,
    orbitViewLeadScores,
    orbitView.active,
    dayLoadFactor,
  ]);

  const handleLeadClick = (leadId: string) => {
    onLeadClick?.(leadId);
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {allLeadNodes.map((node) => {
        const isHighlighted = highlightedLeads.includes(node.id);
        const highlightDelay = isHighlighted
          ? highlightedLeads.indexOf(node.id) * 0.15
          : 0;

        const leadState = leadStates[node.id];
        const memorySignal = hasMemorySignal(leadState);

        const hasFollowUpDue = !!(
          node.followupActive &&
          (node.followupRemaining || 0) > 0 &&
          !node.followupDoneToday
        );

        const orbitViewScore = orbitViewLeadScores.get(node.id) || 0;
        const isOrbitViewRelated = orbitView.active && orbitViewScore > 0;
        const isOrbitViewUnrelated = orbitView.active && orbitViewScore === 0;

        // NOTE: position is already computed (gravity + collision) inside allLeadNodes
        const adjustedPosition = node.position;

        const intensityClass = emotionalIntensity[node.emotionalAura];

        // Opacity based on AI cognitive state (not cycleStage)
        const activityOpacity = isOrbitViewUnrelated
          ? "opacity-40"
          : node.currentState === "dormant"
            ? "opacity-30 grayscale"
            : node.currentState === "latent"
              ? "opacity-50 grayscale-[0.4]"
              : "opacity-100";

        // AI state ring (inner, very thin)
        const stateStyle = stateRingColors[node.currentState ?? ""] ?? DEFAULT_STATE_RING;
        // Emotional aura ring (outer) — whatsapp green overrides when unread
        const effectiveAura: EmotionalAura = node.needsAttention ? "whatsapp" : node.emotionalAura;
        const aura = auraColors[effectiveAura];

        return (
          <div
            key={node.id}
            className={`pointer-events-auto absolute transition-all duration-700 ${intensityClass} ${isResponding && hasHighlights && !isHighlighted
                ? "scale-95 opacity-40"
                : activityOpacity
              } ${!isResponding && !node.isNew ? "animate-node-float" : ""} ${node.cycleStage === "decidindo" || hasFollowUpDue
                ? "animate-hot-lead-pulse"
                : ""
              } ${node.isNew ? "animate-lead-emerge" : ""} ${isOrbitViewRelated ? "z-30" : ""}`}
            style={{
              top: adjustedPosition.top,
              left: adjustedPosition.left,
              animationDelay: `${node.delay}s`,
              transitionDelay: isResponding ? `${highlightDelay}s` : "0s",
            }}
          >
            <div
              onClick={() => handleLeadClick(node.id)}
              className="cubic-bezier-smooth group flex cursor-pointer flex-col items-center transition-all duration-[240ms] hover:scale-105"
            >
              <HoverCard openDelay={200} closeDelay={100}>
                <HoverCardTrigger asChild>
                  <div className="relative">
                    {/* Action badges */}
                    {node.needsAttention && (
                      <ActionBadge type="lightning" title="Mensagem não respondida" />
                    )}
                    {!node.needsAttention &&
                      node.followupActive &&
                      (node.followupRemaining || 0) > 0 && (
                        <ActionBadge
                          type="number"
                          number={node.followupRemaining}
                          title={`Follow-up: ${node.followupRemaining} ações restantes`}
                        />
                      )}
                    {!node.needsAttention && !node.followupActive && node.hasMatureNotes && (
                      <ActionBadge
                        type="chat"
                        title="Existe contexto aqui"
                        onClick={(e) => { e.stopPropagation(); handleLeadClick(node.id); }}
                      />
                    )}

                    {hasFollowUpDue && !node.needsAttention && <FollowUpRing />}

                    {/* Avatar — single ring, colored by cognitive state or whatsapp green */}
                    <div
                      className={`flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-2 bg-[var(--orbit-glass)] text-xs font-light text-[var(--orbit-text)] backdrop-blur-sm transition-all duration-500 ${
                        isHighlighted && isResponding
                          ? "animate-lead-highlight scale-110 border-[var(--orbit-glow)]"
                          : node.isNew
                            ? "border-[var(--orbit-glow)] animate-new-lead-glow"
                            : node.needsAttention
                              ? "border-emerald-500/90 shadow-[0_0_10px_rgba(16,185,129,0.4)] animate-pulse"
                              : `${stateStyle.ring} ${stateStyle.glow}`
                      }`}
                      style={{ animationDelay: isHighlighted ? `${highlightDelay}s` : "0s" }}
                    >
                      {node.photoUrl ? (
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

                    {node.badge && (
                      <div className="absolute -right-1 -top-1">
                        <BadgeContent badge={node.badge} />
                      </div>
                    )}
                  </div>
                </HoverCardTrigger>

                <HoverCardContent
                  side="right"
                  align="center"
                  sideOffset={16}
                  className="w-52 border-white/10 bg-zinc-950/95 backdrop-blur-2xl shadow-2xl p-4"
                >
                  <div className="flex flex-col gap-3">
                    <div>
                      <p className="font-semibold text-slate-100 text-sm">{node.name}</p>
                      {node.currentState && (
                        <p className="text-[10px] text-zinc-400 capitalize mt-0.5">{node.currentState}</p>
                      )}
                    </div>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-500">Interesse</span>
                        <span className="text-zinc-300 font-medium">
                          {node.interestScore ? `${node.interestScore}%` : "—"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-500">Risco</span>
                        <span className={`font-medium ${node.riskScore && node.riskScore > 60 ? "text-red-400" : "text-zinc-300"}`}>
                          {node.riskScore ? `${node.riskScore}%` : "—"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-500">Ação</span>
                        <span className="text-amber-400 font-medium">
                          {node.needsAttention ? "Responder" : "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                </HoverCardContent>
              </HoverCard>

              {/* Name label */}
              <div
                className={`mt-1 flex flex-col items-center text-center text-xs font-light leading-tight backdrop-blur-sm transition-all duration-[240ms] ${isHighlighted && isResponding
                    ? "text-[var(--orbit-glow)]"
                    : node.cycleStage === "encerrado" ||
                      node.cycleStage === "sem_ciclo"
                      ? "text-[var(--orbit-text-muted)]"
                      : "text-[var(--orbit-text)] group-hover:text-[var(--orbit-glow)]"
                  }`}
              >
                {node.name.split(" ").map((part, i) => (
                  <span key={i}>{part}</span>
                ))}
              </div>

              {/* Activity indicators */}
              <ActivityIndicators
                leadId={node.id}
                leadStates={leadStates}
                hasFollowUpDue={hasFollowUpDue}
              />

              {/* Visual state indicator */}
              <VisualStateIndicator
                leadId={node.id}
                visualState={getLeadVisualState(node.id)}
                onStateChange={setLeadVisualState}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
