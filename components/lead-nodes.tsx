"use client";

import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { Megaphone, Zap, RefreshCw, ChevronDown } from "lucide-react";
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

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface LeadNodesProps {
  highlightedLeads: string[];
  coreState: CoreState;
  onLeadClick?: (leadId: string) => void;
  /** Callback to expose computed positions to parent (for connection lines) */
  onPositionsChange?: (positions: Map<string, { x: number; y: number }>) => void;
}

type EmotionalAura =
  | "intent"
  | "curious"
  | "conflicted"
  | "aware"
  | "silentGravity"
  | "whatsapp";

type Priority = "hot" | "warm" | "neutral" | "cold";

interface LeadNode {
  id: string;
  name: string;
  avatar: string;
  photoUrl?: string;
  priority: Priority;
  badge?: { type: "messages" | "campaign" | "urgent"; count?: number };
  delay: number;
  emotionalAura: EmotionalAura;
  hasRecentActivity?: boolean;
  hasNotification?: boolean;
  needsAttention?: boolean;
  isNew?: boolean;
  isProvisional?: boolean;
  interestScore?: number;
  momentumScore?: number;
  currentState?: string;
  hasMatureNotes?: boolean;
  interactionDays?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Orbit ring radii in pixels. Leads are placed on these rings based on their
 * cognitive state. These are PIXEL values and do NOT scale with zoom.
 */
const ORBIT_RADII = [260, 360, 460, 560] as const;
const MAX_RADIUS = 750; // px — expanded to allow reaching padding limits
const MIN_DISTANCE = 8; // px — espaçamento mínimo garantido entre avatares
const REPULSION_DISTANCE = 85; // px — raio de influência magnética
const REPULSION_ITERATIONS = 8;

// ─────────────────────────────────────────────────────────────────────────────
// Style maps
// ─────────────────────────────────────────────────────────────────────────────

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
  whatsapp: {
    ring: "border-emerald-500/80",
    glow: "shadow-[0_0_12px_rgba(16,185,129,0.4)]",
  },
};

const stateRingColors: Record<string, { ring: string; glow: string }> = {
  latent: { ring: "border-zinc-500/20", glow: "" },
  curious: { ring: "border-sky-400/40", glow: "shadow-[0_0_4px_rgba(56,189,248,0.1)]" },
  exploring: { ring: "border-blue-400/60", glow: "shadow-[0_0_6px_rgba(59,130,246,0.2)]" },
  evaluating: { ring: "border-orange-400/60", glow: "shadow-[0_0_8px_rgba(251,146,60,0.2)]" },
  deciding: { ring: "border-red-500/70", glow: "shadow-[0_0_12px_rgba(239,68,68,0.3)]" },
  resolved: { ring: "border-emerald-500/60", glow: "shadow-[0_0_8px_rgba(16,185,129,0.2)]" },
  dormant: { ring: "border-zinc-800", glow: "" },
};

const visualStateStyles: Record<LeadVisualState, { dot: string; label: string }> = {
  ativo: { dot: "bg-emerald-500", label: "text-emerald-400" },
  aguardando: { dot: "bg-amber-500", label: "text-amber-400" },
  em_decisao: { dot: "bg-blue-500", label: "text-blue-400" },
  pausado: { dot: "bg-zinc-500", label: "text-zinc-400" },
  encerrado: { dot: "bg-rose-500/70", label: "text-rose-400/70" },
};

// ─────────────────────────────────────────────────────────────────────────────
// Polar coordinate layout
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Map cognitive state → orbit ring index (0 = innermost).
 */
function stateToRingIndex(state: string | undefined): number {
  switch (state) {
    case "deciding":   return 0;
    case "evaluating": return 0;
    case "exploring":  return 1;
    case "curious":    return 2;
    case "latent":     return 2;
    case "dormant":    return 3;
    case "resolved":   return 3;
    default:           return 2;
  }
}

/**
 * Node visual size class based on cognitive state.
 */
function nodeSizeClass(state: string | undefined): string {
  switch (state) {
    case "deciding":
    case "evaluating":
      return "h-[48px] w-[48px] text-[9.5px]"; // Lead quente (48px)
    case "exploring":
      return "h-[42px] w-[42px] text-[8.5px]"; // Negociação (42px)
    case "curious":
      return "h-[36px] w-[36px] text-[8px]"; // Acompanhamento (36px)
    default:
      return "h-[28px] w-[28px] text-[7.5px]"; // Frio/Latente (28px)
  }
}

interface PolarNode extends LeadNode {
  /** Final pixel position relative to canvas centre (0,0) */
  px: number;
  py: number;
  /** Orbit ring radius used */
  ringRadius: number;
}

/**
 * Assigns each lead to an orbit ring and distributes angle evenly.
 * Returns nodes with pixel offsets from centre.
 */
function buildPolarLayout(nodes: LeadNode[]): PolarNode[] {
  // Group by ring
  const rings: LeadNode[][] = [[], [], [], []];
  for (const node of nodes) {
    const idx = stateToRingIndex(node.currentState);
    rings[Math.min(idx, 3)].push(node);
  }

  const result: PolarNode[] = [];

  rings.forEach((group, ringIdx) => {
    const radius = ORBIT_RADII[ringIdx];
    const count = group.length;
    if (count === 0) return;

    // We want to avoid exact top (-PI/2) and bottom (PI/2) because OrbitCore is tall.
    // We achieve this by slightly squashing the Y axis (ellipse) or forcing angles away from poles.
    const startAngle = ringIdx % 2 === 0 ? -Math.PI / 4 : Math.PI / 4;
    group.forEach((node, i) => {
      let angle = startAngle + (2 * Math.PI * i) / count;
      
      // Se o ângulo cair muito próximo do Pólo Sul (PI/2) ou Pólo Norte (-PI/2), 
      // empurramos levemente para os lados
      const normalizeAngle = (a: number) => {
        let n = a % (2 * Math.PI);
        if (n < 0) n += 2 * Math.PI;
        return n;
      };
      const nAngle = normalizeAngle(angle);
      
      // Empurrar do pólo inferior (aprox 1.57 rad) e pólo superior (aprox 4.71 rad)
      const isNearBottom = Math.abs(nAngle - Math.PI/2) < 0.4;
      const isNearTop = Math.abs(nAngle - (3*Math.PI)/2) < 0.65;
      
      if (isNearBottom) angle += (nAngle > Math.PI/2 ? 0.3 : -0.3);
      if (isNearTop) angle += (nAngle > (3*Math.PI)/2 ? 0.45 : -0.45);

      // Usar perfil Elíptico Wide (telas costumam ser 16:9)
      const ovalRadiusX = radius * 1.35;
      let ovalRadiusY = radius * 0.95;

      // Achata a metade superior da elipse levemente para o Core
      if (Math.sin(angle) < 0) {
        ovalRadiusY *= 0.85;
      }

      let py = Math.sin(angle) * ovalRadiusY;

      result.push({
        ...node,
        px: Math.cos(angle) * ovalRadiusX,
        py,
        ringRadius: radius,
      });
    });
  });

  return result;
}

/**
 * Simple node-to-node repulsion so labels don't overlap.
 * Pushes nodes apart while keeping them near their target ring radius.
 */
function applyRepulsion(nodes: PolarNode[]): PolarNode[] {
  const out = nodes.map((n) => ({ ...n }));

  for (let iter = 0; iter < REPULSION_ITERATIONS; iter++) {
    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        const dx = out[j].px - out[i].px;
        const dy = out[j].py - out[i].py;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < REPULSION_DISTANCE && dist > 0.001) {
          const overlap = (REPULSION_DISTANCE - dist) / 2 + 1;
          const nx = dx / dist;
          const ny = dy / dist;
          out[i].px -= nx * overlap;
          out[i].py -= ny * overlap;
          out[j].px += nx * overlap;
          out[j].py += ny * overlap;
        }
      }
    }
  }

  // Clamp to MAX_RADIUS
  for (const n of out) {
    const dist = Math.sqrt(n.px * n.px + n.py * n.py);
    if (dist > MAX_RADIUS) {
      const scale = MAX_RADIUS / dist;
      n.px *= scale;
      n.py *= scale;
    }
  }

  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mapping helpers
// ─────────────────────────────────────────────────────────────────────────────

function mapEmotionalStateToAura(state: string): EmotionalAura {
  switch (state) {
    case "engaged":  return "intent";
    case "warm":     return "curious";
    case "cooling":  return "silentGravity";
    default:         return "aware";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

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
    undefined, "ativo", "aguardando", "em_decisao", "pausado", "encerrado",
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
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export function LeadNodes({
  highlightedLeads,
  coreState,
  onLeadClick,
  onPositionsChange,
}: LeadNodesProps) {
  const isResponding = coreState === "responding";
  const hasHighlights = highlightedLeads.length > 0;

  const { leads: supabaseLeads } = useSupabaseLeads();

  const {
    leadStates,
    newLeads,
    getLeadVisualState,
    setLeadVisualState,
    orbitView,
    selectedLeadId,
  } = useOrbitContext();

  // Seed for angle jitter — incremented on "Reorganizar" click
  const [seed, setSeed] = useState(0);
  const reorganize = useCallback(() => setSeed((s) => s + 1), []);

  // Admin leads from context
  const adminLeads = Object.values(leadStates).filter((s) => s.adminData);
  const adminLeadNodes: LeadNode[] = adminLeads.map((state) => ({
    id: state.id,
    name: state.adminData!.name,
    avatar: state.adminData!.avatar,
    photoUrl: state.adminData!.photoUrl,
    priority: "warm",
    delay: 0,
    emotionalAura: "aware",
    isNew: newLeads.includes(state.id),
    isProvisional: state.isProvisional,
    currentState: "latent",
  }));

  // Supabase leads
  const supabaseLeadNodes: LeadNode[] = supabaseLeads.map((lead: OrbitLead) => ({
    id: lead.id,
    name: lead.name,
    avatar: lead.avatar,
    photoUrl: lead.photoUrl,
    priority: lead.emotionalState === "engaged" ? "hot" : lead.emotionalState === "warm" ? "warm" : "neutral",
    badge: lead.badge
      ? ({
          type: lead.badge === "hot" ? "urgent" : lead.badge === "campaign" ? "campaign" : "messages",
        } as LeadNode["badge"])
      : undefined,
    delay: lead.delay,
    emotionalAura: mapEmotionalStateToAura(lead.emotionalState),
    hasRecentActivity: !!lead.lastAiAnalysisAt,
    hasNotification: lead.emotionalState === "engaged",
    needsAttention: lead.needsAttention,
    interestScore: lead.interestScore,
    momentumScore: lead.momentumScore,
    currentState: lead.currentState,
    hasMatureNotes: lead.hasMatureNotes,
    interactionDays: lead.daysSinceInteraction || 0,
  }));

  // Orbit-view scores
  const orbitViewLeadScores = useMemo(() => {
    if (!orbitView.active) return new Map<string, number>();
    const scores = new Map<string, number>();
    for (const lead of orbitView.leads.slice(0, 18)) {
      scores.set(lead.leadId, lead.relevanceScore || 0.7);
    }
    return scores;
  }, [orbitView.active, orbitView.leads]);

  // COMBINED SOURCE NODES
  const sourceNodes = useMemo(() => {
    // Sort leads deterministically by ID so their radial position remains consistent
    const combined = [...supabaseLeadNodes, ...adminLeadNodes].sort((a, b) => a.id.localeCompare(b.id));
    return combined.map((n) => {
      if (selectedLeadId && n.id === selectedLeadId) {
        return { ...n, currentState: "deciding" }; // force inner ring visually
      }
      return n;
    });
  }, [supabaseLeadNodes, adminLeadNodes, selectedLeadId]);

  // PHYSICS STATE REF
  const physicsNodesRef = useRef<Map<string, {
    x: number; y: number; vx: number; vy: number;
    angle: number; idealRadius: number;
    node: LeadNode;
  }>>(new Map());

  // REACT RENDER STATE
  const [renderNodes, setRenderNodes] = useState<PolarNode[]>([]);

  // INIT OR UPDATE PHYSICS STATE
  useEffect(() => {
    const currentMap = physicsNodesRef.current;
    const newMap = new Map<string, any>();

    // Determine target distribution ring counts
    const rings: LeadNode[][] = [[], [], [], []];
    for (const node of sourceNodes) {
      const idx = stateToRingIndex(node.currentState);
      rings[Math.min(idx, 3)].push(node);
    }

    rings.forEach((group, ringIdx) => {
      const radius = ORBIT_RADII[ringIdx];
      const count = group.length;
      if (count === 0) return;

      const startAngle = ringIdx % 2 === 0 ? -Math.PI / 4 : Math.PI / 4;
      
      group.forEach((node, i) => {
        let idealAngle = startAngle + (2 * Math.PI * i) / count;
        
        // Exclusões de Pólos na ÂNCORA (não na posição final, a mola puxa pra cá)
        const nAngle = (idealAngle % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
        const isNearBottom = Math.abs(nAngle - Math.PI/2) < 0.4;
        const isNearTop = Math.abs(nAngle - (3*Math.PI)/2) < 0.65;
        if (isNearBottom) idealAngle += (nAngle > Math.PI/2 ? 0.3 : -0.3);
        if (isNearTop) idealAngle += (nAngle > (3*Math.PI)/2 ? 0.45 : -0.45);

        const existing = currentMap.get(node.id);
        
        if (existing) {
          // Keep current physical position, just update targets
          newMap.set(node.id, {
            ...existing,
            node,
            idealRadius: radius
            // We intentionally do NOT lock the angle, we let it drift from wherever it is
          });
        } else {
          // Spawn new node
          // Spawn new node - Deterministic angle based on index
          const ovalRadiusX = radius * 1.4;
          let ovalRadiusY = radius * 0.7; // Ligeiramente menos achatado para dar mais ar vertical
          if (Math.sin(idealAngle) < 0) ovalRadiusY *= 0.8;

          newMap.set(node.id, {
            x: Math.cos(idealAngle) * ovalRadiusX,
            y: Math.sin(idealAngle) * ovalRadiusY,
            vx: 0,
            vy: 0,
            angle: idealAngle, // Remove random phase for deterministic layout
            idealRadius: radius,
            node
          });
        }
      });
    });

    physicsNodesRef.current = newMap;
  }, [sourceNodes, seed]);

  // MAIN PHYSICS LOOP (requestAnimationFrame)
  useEffect(() => {
    let animationFrameId: number;
    let lastTime = performance.now();

    const tick = (time: number) => {
      const deltaTime = Math.min((time - lastTime) / 1000, 0.1); // clamp to 100ms max (10fps min)
      lastTime = time;

      const nodesMap = physicsNodesRef.current;
      const nodes = Array.from(nodesMap.values());

      // 1. Apply Forces
      for (let i = 0; i < nodes.length; i++) {
        const p = nodes[i];

        // --- ELASTIC SPRING TETHER TO ANCHOR ---
        // Achatando a elipse significativamente e esticando as laterais (1.4x)
        const ovalRadiusX = p.idealRadius * 1.4;
        let ovalRadiusY = p.idealRadius * 0.7;
        if (Math.sin(p.angle) < 0) ovalRadiusY *= 0.8;

        const anchorX = Math.cos(p.angle) * ovalRadiusX;
        const anchorY = Math.sin(p.angle) * ovalRadiusY;

        const dxAnchor = anchorX - p.x;
        const dyAnchor = anchorY - p.y;
        
        // Mola mais estanque para grudar rápido e parar os tremores.
        const springK = 2.0; 
        p.vx += dxAnchor * springK * deltaTime;
        p.vy += dyAnchor * springK * deltaTime;

        // --- CORE EXCLUSION ZONE (Escudo de proteção do OrbitCore) ---
        const distFromCenter = Math.sqrt(p.x * p.x + p.y * p.y);
        const CORE_SAFETY_RADIUS = 220; // Limpa inclusive os anéis internos do Core
        if (distFromCenter < CORE_SAFETY_RADIUS) {
          const pushForce = (CORE_SAFETY_RADIUS - distFromCenter) * 10.0; // Suavizado para evitar oscilação
          p.vx += (p.x / (distFromCenter || 1)) * pushForce * deltaTime;
          p.vy += (p.y / (distFromCenter || 1)) * pushForce * deltaTime;
        }

        // --- REPULSION BETWEEN NODES (Magnetic Field) ---
        // Aumentando ainda mais o raio para acomodar avatares maiores sem sobreposição visual.
        const REP_DIST = 200; 
        const BASE_REP_FORCE = 400; // Reduzido para parar a "briga" constante

        for (let j = i + 1; j < nodes.length; j++) {
          const p2 = nodes[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const distSq = dx*dx + dy*dy;
          const dist = Math.sqrt(distSq);
          
          // Anti-colisão dura (MIN_DISTANCE = 8)
          if (dist < MIN_DISTANCE && dist > 0) {
            const angle = Math.atan2(dy, dx);
            const move = (MIN_DISTANCE - dist) / 2;
            const mx = Math.cos(angle) * move;
            const my = Math.sin(angle) * move;
            p.x += mx; p.y += my;
            p2.x -= mx; p2.y -= my;
          }

          if (distSq > 0 && distSq < REP_DIST * REP_DIST) {
            // Curva exponencial: muito forte de perto (evita sobreposição real), muito fraca de longe.
            const strengthRatio = Math.pow(1 - dist / REP_DIST, 2); 
            const force = (BASE_REP_FORCE * strengthRatio * (Math.abs(p.idealRadius - p2.idealRadius) < 10 ? 3.0 : 1.0)) * deltaTime;
            
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            
            p.vx += fx;
            p.vy += fy;
            p2.vx -= fx;
            p2.vy -= fy;
          }
        }
      }

      // 2. Integration & Damping
      const DAMPING = 0.40; // Damping agressivo = sistema para de oscilar quase instantaneamente
      const snapThreshold = 0.02;

      let needsRender = false;
      const newRenderNodes: PolarNode[] = [];

      for (const p of nodes) {
        p.vx *= DAMPING;
        p.vy *= DAMPING;
        
        if (Math.abs(p.vx) > snapThreshold || Math.abs(p.vy) > snapThreshold) {
          needsRender = true;
          p.x += p.vx;
          p.y += p.vy;

          // Soft "Natural" Edge Repulsion (Padding 4% Lateral / 8% Vertical)
          // Em vez de travar o nó, aplicamos uma força que o empurra de volta se ele passar do limite.
          const leftPct = (p.x + 600) / 12;
          const topPct = (p.y + 346.5) / 6.93;
          
          const edgeSoftForce = 12.0; 
          // Borda lateral mais fina (4%)
          if (leftPct < 4) p.vx += (4 - leftPct) * edgeSoftForce * deltaTime;
          if (leftPct > 96) p.vx -= (leftPct - 96) * edgeSoftForce * deltaTime;
          // Borda vertical mantém respiro (8%)
          if (topPct < 8) p.vy += (8 - topPct) * edgeSoftForce * deltaTime;
          if (topPct > 92) p.vy -= (topPct - 92) * edgeSoftForce * deltaTime;

          // Hard safety clamp (Absolute Viewport Bounds)
          p.x = Math.max(-585, Math.min(585, p.x)); // 2% cada lado
          p.y = Math.max(-305, Math.min(305, p.y)); // 6% cada lado

          // Hard Circular FLOOR (Protect the Core area)
          const finalDist = Math.sqrt(p.x * p.x + p.y * p.y);
          const MIN_ALLOWED_DIST = 215;
          if (finalDist < MIN_ALLOWED_DIST) {
            p.x = (p.x / (finalDist || 1)) * MIN_ALLOWED_DIST;
            p.y = (p.y / (finalDist || 1)) * MIN_ALLOWED_DIST;
          }
        }

        newRenderNodes.push({
          ...p.node,
          px: p.x,
          py: p.y,
          ringRadius: p.idealRadius
        });
      }

      // Always update React but let's try not to thrash too much if nothing moved
      // However since there's constant orbital drift, it will likely render every frame (which is what we want for smooth UI)
      setRenderNodes(newRenderNodes);

      animationFrameId = requestAnimationFrame(tick);
    };

    animationFrameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  return (
    <>
      {/* ── Reorganizar button ───────────────────────────────────────────── */}
      <button
        type="button"
        onClick={reorganize}
        title="Reorganizar Orbit"
        className="pointer-events-auto absolute bottom-6 left-1/2 z-[100] -translate-x-1/2 flex items-center gap-1.5 rounded-full border border-white/10 bg-zinc-900/80 px-3 py-1.5 text-[10px] font-medium text-zinc-400 backdrop-blur-xl transition-all hover:border-cyan-500/40 hover:text-cyan-400 hover:bg-zinc-800/80"
      >
        <RefreshCw className="h-3 w-3" />
        Reorganizar Orbit
      </button>

      {/* ── Lead nodes ───────────────────────────────────────────────────── */}
      <div className="pointer-events-none absolute inset-0 z-20">
        {renderNodes.map((node: PolarNode) => {
          const isHighlighted = highlightedLeads.includes(node.id);
          const highlightDelay = isHighlighted ? highlightedLeads.indexOf(node.id) * 0.15 : 0;

          const stateStyle = stateRingColors[node.currentState || "latent"];
          const aura = node.needsAttention ? auraColors.whatsapp : auraColors[node.emotionalAura as EmotionalAura] || auraColors.aware;

          const orbitScore = orbitViewLeadScores.get(node.id) || 0;
          const isOrbitViewRelated = orbitView.active && orbitScore > 0;
          const isOrbitViewUnrelated = orbitView.active && orbitScore === 0;

          const isPulsing = node.currentState === "deciding" || node.needsAttention;
          const pulseSpeed = (node.interactionDays || 0) < 1 ? "1s" : (node.interactionDays || 0) < 3 ? "2s" : "4s";

          const zDepthClass =
            node.currentState === "deciding" || node.currentState === "evaluating"
              ? "z-[60]"
              : node.currentState === "exploring"
                ? "z-[40]"
                : "z-[20]";

          const sizeClass = nodeSizeClass(node.currentState);

          const opacityClass = isOrbitViewUnrelated
            ? "opacity-[0.04] grayscale pointer-events-none"
            : node.currentState === "dormant"
              ? "opacity-30 grayscale"
              : node.currentState === "latent"
                ? "opacity-50 grayscale-[0.4]"
                : "opacity-100";

          return (
            <div
              key={node.id}
              className={`pointer-events-auto absolute transition-[opacity,transform,filter] duration-700 ease-out ${
                isResponding && hasHighlights && !isHighlighted
                  ? "opacity-[0.05] scale-90"
                  : opacityClass
              } animate-node-float ${
                isPulsing ? "animate-hot-lead-pulse" : ""
              } ${isOrbitViewRelated ? "z-[70]" : zDepthClass}`}
              style={{
                /* Place relative to centre of the canvas (which is at 50/50 of the wrapper) */
                left: `calc(50% + ${node.px}px)`,
                top: `calc(50% + ${node.py}px)`,
                transform: "translate(-50%, -50%)",
                animationDelay: `${node.delay}s`,
                transitionDelay: isResponding ? `${highlightDelay}s` : "0s",
                animationDuration: isPulsing ? pulseSpeed : undefined,
              }}
            >
              <HoverCard openDelay={200} closeDelay={100}>
                <HoverCardTrigger asChild>
                  <div
                    onClick={() => onLeadClick?.(node.id)}
                    className="group flex cursor-pointer flex-col items-center transition-all duration-[240ms] hover:scale-105"
                  >
                    <div className="relative">
                      {/* Cognitive state ring - Thinner and more discrete */}
                      <div
                        className={`absolute -inset-[1.5px] rounded-full border-[0.5px] transition-all duration-700 ${stateStyle.ring} ${stateStyle.glow}`}
                      />
                      {/* Emotional aura ring - Subtle outer glow */}
                      <div
                        className={`absolute -inset-[2.5px] rounded-full border-[0.5px] opacity-40 transition-all duration-500 ${aura.ring} ${aura.glow}`}
                      />

                      {/* Avatar */}
                      <div
                        className={`flex ${sizeClass} items-center justify-center overflow-hidden rounded-full border-2 bg-[var(--orbit-glass)] text-xs font-light text-[var(--orbit-text)] backdrop-blur-sm transition-all duration-300 ${
                          isHighlighted && isResponding
                            ? "animate-lead-highlight scale-110 border-[var(--orbit-glow)]"
                            : node.isNew
                              ? "border-[var(--orbit-glow)] animate-new-lead-glow"
                              : `${stateStyle.ring} ${stateStyle.glow}`
                        }`}
                        style={{
                          animationDelay: `${highlightDelay}s`,
                          transition: "all 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)",
                        }}
                      >
                        {node.photoUrl ? (
                          <img
                            src={node.photoUrl}
                            alt={node.name}
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                              const parent = e.currentTarget.parentElement;
                              if (parent) {
                                const fallback = document.createElement("span");
                                fallback.textContent = node.avatar;
                                parent.appendChild(fallback);
                              }
                            }}
                          />
                        ) : (
                          node.avatar
                        )}
                      </div>

                      {/* Attention badge */}
                      {node.needsAttention && (
                        <div className="absolute -right-0.5 -top-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-emerald-500 border border-zinc-900">
                          <div className="h-1.5 w-1.5 rounded-full bg-white" />
                        </div>
                      )}
                    </div>

                    {/* Name label */}
                    <div
                      className={`mt-1 flex flex-col items-center text-center text-[9.5px] font-normal leading-none tracking-tight backdrop-blur-sm transition-all duration-[240ms] ${
                        isHighlighted && isResponding
                          ? "text-[var(--orbit-glow)]"
                          : node.currentState === "dormant" || node.currentState === "latent"
                            ? "text-[var(--orbit-text-muted)] opacity-50"
                            : "text-[var(--orbit-text)] group-hover:text-[var(--orbit-glow)]"
                      }`}
                    >
                      {node.name.split(" ").map((part, i) => (
                        <span key={i}>{part}</span>
                      ))}
                    </div>

                    {/* Visual state indicator */}
                    <VisualStateIndicator
                      leadId={node.id}
                      visualState={getLeadVisualState(node.id)}
                      onStateChange={setLeadVisualState}
                    />
                  </div>
                </HoverCardTrigger>

                <HoverCardContent
                  side="right"
                  align="center"
                  sideOffset={16}
                  className="w-56 border-white/10 bg-zinc-950/95 backdrop-blur-2xl shadow-2xl p-4"
                >
                  <div className="flex flex-col gap-3">
                    <div>
                      <span className="font-semibold text-slate-100 uppercase tracking-wide">
                        {node.name.split(new RegExp(`(${orbitView.query})`, "gi")).map((part: string, i: number) =>
                          part.toLowerCase() === orbitView.query.toLowerCase() ? (
                            <span key={i} className="text-[#2EC5FF] bg-[#2EC5FF]/10 px-0.5 rounded">
                              {part}
                            </span>
                          ) : (
                            part
                          ),
                        )}
                      </span>
                      {node.currentState && (
                        <p className="text-xs text-zinc-400 capitalize">{node.currentState}</p>
                      )}
                    </div>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-500">Interesse</span>
                        <span className="text-zinc-300 font-medium">
                          {node.interestScore ? `${node.interestScore}%` : "N/A"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-500">Ticket</span>
                        <span className="text-emerald-400 font-medium">R$ --</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-500">Ação</span>
                        <span className="text-amber-400 font-medium truncate max-w-[100px] text-right">
                          {node.needsAttention ? "Responder" : "Nenhuma"}
                        </span>
                      </div>
                    </div>
                  </div>
                </HoverCardContent>
              </HoverCard>
            </div>
          );
        })}
      </div>
    </>
  );
}
