"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ExternalLink,
  Heart,
  Eye,
  X,
  Calendar,
  Building2,
  Link2,
  Copy,
  Check,
  RefreshCw,
  MessageSquare,
  Sparkles,
  Clock,
} from "lucide-react";
import { getSupabase } from "@/lib/supabase";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface SelectionStats {
  views: number;
  likes: number;
  discards: number;
  visits: number;
  questions: number;
}

interface SelectionProperty {
  id: string;
  title: string | null;
  internal_name: string | null;
  cover_image: string | null;
  value: number | null;
  source_link: string | null;
  state: string;
  lastInteraction?: string;
  interactionType?: string;
}

interface ClientSpace {
  id: string;
  slug: string;
  created_at: string;
  lead_id: string;
}

interface OrbitSelectionPanelProps {
  leadId: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatValue(value: number | null): string {
  if (!value) return "—";
  if (value >= 1_000_000) {
    const m = value / 1_000_000;
    return `R$ ${m % 1 === 0 ? m : m.toFixed(1)}M`;
  }
  if (value >= 1_000) {
    const k = value / 1_000;
    return `R$ ${k % 1 === 0 ? k : k.toFixed(0)}k`;
  }
  return `R$ ${value}`;
}

function formatRelativeTime(ts: string | null): string {
  if (!ts) return "—";
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min`;
  if (hours < 24) return `${hours}h`;
  if (days === 1) return "ontem";
  return `${days}d`;
}

const stateConfig: Record<string, { label: string; color: string; bg: string }> = {
  favorited: { label: "Curtido", color: "text-rose-400", bg: "bg-rose-500/10 border-rose-500/20" },
  visited:   { label: "Visita", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
  discarded: { label: "Descartado", color: "text-slate-500", bg: "bg-slate-500/10 border-slate-500/20" },
  viewed:    { label: "Visto", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
  sent:      { label: "Enviado", color: "text-[#d4af35]", bg: "bg-[#d4af35]/10 border-[#d4af35]/20" },
  portal_opened: { label: "Portal aberto", color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20" },
  property_question: { label: "Pergunta", color: "text-sky-400", bg: "bg-sky-500/10 border-sky-500/20" },
};

// ─── Stat Badge ────────────────────────────────────────────────────────────────

function StatBadge({ icon: Icon, value, label, color }: {
  icon: React.ElementType;
  value: number;
  label: string;
  color: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`flex items-center gap-1 text-sm font-bold ${color}`}>
        <Icon className="w-3.5 h-3.5" />
        <span>{value}</span>
      </div>
      <span className="text-[9px] text-slate-600 uppercase tracking-widest">{label}</span>
    </div>
  );
}

// ─── Property Row ──────────────────────────────────────────────────────────────

function PropertyRow({ prop }: { prop: SelectionProperty }) {
  const cfg = prop.interactionType
    ? (stateConfig[prop.interactionType] || stateConfig.sent)
    : stateConfig.sent;

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-white/[0.04] last:border-0 group">
      {/* Cover */}
      <div className="w-9 h-9 rounded-lg overflow-hidden bg-white/5 shrink-0">
        {prop.cover_image ? (
          <img src={prop.cover_image} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Building2 className="w-3.5 h-3.5 text-slate-600" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium text-slate-200 truncate leading-tight">
          {prop.title || prop.internal_name || "Imóvel"}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-[#d4af35]/60">{formatValue(prop.value)}</span>
          {prop.lastInteraction && (
            <>
              <span className="text-slate-700">·</span>
              <span className="text-[9px] text-slate-600">{formatRelativeTime(prop.lastInteraction)}</span>
            </>
          )}
        </div>
      </div>

      {/* State + link */}
      <div className="flex items-center gap-1.5 shrink-0">
        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${cfg.bg} ${cfg.color}`}>
          {cfg.label}
        </span>
        {prop.source_link && (
          <a
            href={prop.source_link}
            target="_blank"
            rel="noopener noreferrer"
            className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-600 hover:text-slate-400"
          >
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function OrbitSelectionPanel({ leadId }: OrbitSelectionPanelProps) {
  const [space, setSpace] = useState<ClientSpace | null>(null);
  const [stats, setStats] = useState<SelectionStats | null>(null);
  const [properties, setProperties] = useState<SelectionProperty[]>([]);
  const [portalUrl, setPortalUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [lastOpen, setLastOpen] = useState<string | null>(null);

  const glass = "bg-[rgba(12,12,12,0.85)] backdrop-blur-[16px] border border-white/[0.07]";

  const fetchData = useCallback(async () => {
    setLoading(true);
    const supabase = getSupabase();

    // 1. Get client space for this lead
    const { data: spaceData } = await (supabase
      .from("client_spaces") as any)
      .select("id, slug, created_at, lead_id")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!spaceData) {
      setSpace(null);
      setStats(null);
      setProperties([]);
      setLoading(false);
      return;
    }

    setSpace(spaceData);
    const url = `${window.location.origin}/selection/${spaceData.slug}`;
    setPortalUrl(url);

    // 2. Get all property interactions from client_portal via Server Route to bypass RLS
    const intRes = await fetch(`/api/property-interactions?leadId=${leadId}`)
    const intData = await intRes.json()
    
    const intList = ((intData.interactions || []) as any[]).filter(i => i.source === "client_portal");

    // Stats
    const computedStats: SelectionStats = {
      views:     intList.filter(i => i.interaction_type === "viewed").length,
      likes:     intList.filter(i => i.interaction_type === "favorited").length,
      discards:  intList.filter(i => i.interaction_type === "discarded").length,
      visits:    intList.filter(i => i.interaction_type === "visited").length,
      questions: intList.filter(i => i.interaction_type === "property_question").length,
    };
    setStats(computedStats);

    // Last portal open
    const openEvent = intList.find(i => i.interaction_type === "portal_opened");
    setLastOpen(openEvent?.timestamp || null);

    // 3. Get capsule items and their properties
    const { data: capsuleItems } = await (supabase
      .from("capsule_items") as any)
      .select(`
        property_id,
        state,
        properties:property_id (
          id, title, internal_name, cover_image, value, source_link
        )
      `)
      .eq("lead_id", leadId)
      .neq("state", "discarded");

    if (capsuleItems && capsuleItems.length > 0) {
      // Build a map of latest interaction per property
      const latestInteractionMap = new Map<string, { type: string; ts: string }>();
      for (const int of intList) {
        if (!latestInteractionMap.has(int.property_id)) {
          latestInteractionMap.set(int.property_id, {
            type: int.interaction_type,
            ts: int.timestamp,
          });
        }
      }

      const props: SelectionProperty[] = (capsuleItems as any[])
        .filter(item => item.properties)
        .map(item => {
          const p = item.properties as any;
          const latestInt = latestInteractionMap.get(p.id);
          return {
            id: p.id,
            title: p.title,
            internal_name: p.internal_name,
            cover_image: p.cover_image,
            value: p.value,
            source_link: p.source_link,
            state: item.state,
            lastInteraction: latestInt?.ts,
            interactionType: latestInt?.type || item.state,
          };
        });

      // Sort: most interacted first (favorited/visited > viewed > sent)
      const priority: Record<string, number> = {
        favorited: 0, visited: 1, property_question: 2, viewed: 3, portal_opened: 4, sent: 5,
      };
      props.sort((a, b) => (priority[a.interactionType || "sent"] ?? 5) - (priority[b.interactionType || "sent"] ?? 5));

      setProperties(props);
    } else {
      setProperties([]);
    }

    setLoading(false);
  }, [leadId]);

  useEffect(() => {
    if (leadId) fetchData();
  }, [leadId, fetchData]);

  const handleCopyLink = async () => {
    if (!portalUrl) return;
    await navigator.clipboard.writeText(portalUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const hasActivity = stats && (stats.views + stats.likes + stats.discards + stats.visits + stats.questions) > 0;

  // ── NO PORTAL STATE ──────────────────────────────────────────────────────────
  if (!loading && !space) {
    return (
      <div className={`${glass} rounded-xl p-5 flex flex-col gap-3`}>
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-4 h-4 text-[#d4af35]" />
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-300">Orbit Selection</h3>
        </div>
        <div className="flex flex-col items-center gap-2 py-4 text-center">
          <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
            <Link2 className="w-4 h-4 text-slate-600" />
          </div>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            Nenhum portal enviado<br />para este lead ainda.
          </p>
        </div>
      </div>
    );
  }

  // ── LOADING ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className={`${glass} rounded-xl p-5 flex flex-col gap-3`}>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#d4af35]" />
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-300">Orbit Selection</h3>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-12 rounded-lg bg-white/[0.03] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // ── MAIN ─────────────────────────────────────────────────────────────────────
  return (
    <div className={`${glass} rounded-xl p-5 flex flex-col gap-4`}>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#d4af35]" />
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-300">Orbit Selection</h3>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={fetchData}
            className="p-1 rounded-md text-slate-600 hover:text-slate-400 transition-colors"
            title="Atualizar"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
          {portalUrl && (
            <a
              href={portalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 rounded-md text-slate-600 hover:text-[#d4af35] transition-colors"
              title="Abrir portal"
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>

      {/* Portal Link */}
      {portalUrl && (
        <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-white/[0.03] border border-white/[0.05]">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
          <span className="text-[10px] text-slate-500 truncate flex-1 font-mono">
            /selection/{space?.slug}
          </span>
          <button
            onClick={handleCopyLink}
            className="shrink-0 text-slate-600 hover:text-[#d4af35] transition-colors"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>
      )}

      {/* Last portal open */}
      {lastOpen && (
        <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
          <Clock className="w-3 h-3" />
          <span>Último acesso: <span className="text-slate-400">{formatRelativeTime(lastOpen)}</span></span>
        </div>
      )}

      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-4 gap-1 p-3 rounded-lg bg-white/[0.03] border border-white/[0.05]">
          <StatBadge icon={Eye}      value={stats.views}    label="Views"   color="text-blue-400" />
          <StatBadge icon={Heart}    value={stats.likes}    label="Curtidas" color="text-rose-400" />
          <StatBadge icon={Calendar} value={stats.visits}   label="Visitas"  color="text-emerald-400" />
          <StatBadge icon={MessageSquare} value={stats.questions} label="Perguntas" color="text-sky-400" />
        </div>
      )}

      {/* No activity yet */}
      {!hasActivity && properties.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#d4af35]/5 border border-[#d4af35]/10">
          <Clock className="w-3 h-3 text-[#d4af35]/50 shrink-0" />
          <p className="text-[10px] text-[#d4af35]/50">
            Portal enviado · aguardando acesso do cliente
          </p>
        </div>
      )}

      {/* X indicator if has discards */}
      {stats && stats.discards > 0 && (
        <div className="flex items-center gap-1.5 text-[10px] text-slate-600">
          <X className="w-3 h-3" />
          <span>{stats.discards} imóve{stats.discards > 1 ? "is" : "l"} descartado{stats.discards > 1 ? "s" : ""}</span>
        </div>
      )}

      {/* Property list */}
      {properties.length > 0 && (
        <div className="flex flex-col">
          <p className="text-[9px] text-slate-600 uppercase tracking-widest font-bold mb-1">
            {properties.length} imóve{properties.length > 1 ? "is" : "l"} na seleção
          </p>
          <div>
            {properties.map(p => (
              <PropertyRow key={p.id} prop={p} />
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
