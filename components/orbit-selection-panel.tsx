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
  TrendingUp,
  Timer,
} from "lucide-react";

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
  viewCount?: number; // NEW: total de views para este imóvel
}

interface TopInterest {
  property: SelectionProperty;
  viewCount: number;
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

// NEW: formata duração em segundos para exibição legível
function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return s > 0 ? `${m}min ${s}s` : `${m}min`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm > 0 ? `${h}h ${rm}min` : `${h}h`;
}

const stateConfig: Record<string, { label: string; color: string; bg: string }> = {
  favorited:         { label: "Curtido",       color: "text-rose-400",    bg: "bg-rose-500/10 border-rose-500/20" },
  visited:           { label: "Visita",         color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
  discarded:         { label: "Descartado",     color: "text-slate-500",   bg: "bg-slate-500/10 border-slate-500/20" },
  viewed:            { label: "Visto",          color: "text-blue-400",    bg: "bg-blue-500/10 border-blue-500/20" },
  sent:              { label: "Enviado",        color: "text-[#d4af35]",   bg: "bg-[#d4af35]/10 border-[#d4af35]/20" },
  portal_opened:     { label: "Portal aberto",  color: "text-purple-400",  bg: "bg-purple-500/10 border-purple-500/20" },
  property_question: { label: "Pergunta",       color: "text-sky-400",     bg: "bg-sky-500/10 border-sky-500/20" },
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

function PropertyRow({ prop, isTop }: { prop: SelectionProperty; isTop?: boolean }) {
  const cfg = prop.interactionType
    ? (stateConfig[prop.interactionType] || stateConfig.sent)
    : stateConfig.sent;

  return (
    <div className={`flex items-center gap-3 py-2.5 border-b border-white/[0.04] last:border-0 group ${isTop ? "rounded-lg px-2 bg-blue-500/[0.06] border border-blue-500/[0.15] mb-1" : ""}`}>
      {/* Cover */}
      <div className="w-9 h-9 rounded-lg overflow-hidden bg-white/5 shrink-0 relative">
        {prop.cover_image ? (
          <img src={prop.cover_image} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Building2 className="w-3.5 h-3.5 text-slate-600" />
          </div>
        )}
        {isTop && (
          <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-blue-500 flex items-center justify-center">
            <TrendingUp className="w-2 h-2 text-white" />
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
          {/* NEW: view count badge por imóvel */}
          {prop.viewCount && prop.viewCount > 0 && (
            <>
              <span className="text-slate-700">·</span>
              <span className="text-[9px] text-blue-400/70 flex items-center gap-0.5">
                <Eye className="w-2.5 h-2.5" />
                {prop.viewCount}x
              </span>
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
  const [topInterest, setTopInterest] = useState<TopInterest | null>(null);
  const [portalUrl, setPortalUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [lastOpen, setLastOpen] = useState<string | null>(null);
  const [lastSessionDuration, setLastSessionDuration] = useState<number | null>(null); // NEW: duração em segundos

  const glass = "bg-[rgba(12,12,12,0.85)] backdrop-blur-[16px] border border-white/[0.07]";

  const fetchData = useCallback(async () => {
    if (!leadId) return;
    setLoading(true);

    try {
      // ── 1. Client Space ──────────────────────────────────────────────────────
      // Usa fetch para a rota de API do servidor (bypassa RLS via service role)
      const spaceRes = await fetch(`/api/client-spaces?leadId=${leadId}`);
      let spaceData: ClientSpace | null = null;

      if (spaceRes.ok) {
        const sd = await spaceRes.json();
        spaceData = sd.space || null;
      }

      // Fallback: tenta direto se a rota não existir ainda
      if (!spaceData) {
        const { getSupabase } = await import("@/lib/supabase");
        const supabase = getSupabase();
        const { data } = await (supabase.from("client_spaces") as any)
          .select("id, slug, created_at, lead_id")
          .eq("lead_id", leadId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        spaceData = data;
      }

      if (!spaceData) {
        setSpace(null);
        setStats(null);
        setProperties([]);
        setTopInterest(null);
        setLoading(false);
        return;
      }

      setSpace(spaceData);
      setPortalUrl(`${window.location.origin}/selection/${spaceData.slug}`);

      // ── 2. Interactions via rota de servidor (bypassa RLS) ───────────────────
      console.log("[OrbitSelectionPanel] Fetching interactions via server API for leadId:", leadId);
      const intRes = await fetch(`/api/property-interactions?leadId=${leadId}`);
      const intData = await intRes.json();
      console.log("[OrbitSelectionPanel] Server API interactions count:", intData.interactions?.length ?? 0);

      const allInteractions = (intData.interactions || []) as Array<{
        interaction_type: string;
        property_id: string;
        timestamp: string;
        metadata?: any;
      }>;

      // Filtra só interações do portal do cliente
      const intList = allInteractions.filter(i => {
        // A rota GET não retorna 'source', então aceita tudo que veio da rota server
        // (já filtramos por leadId, e as interações do portal têm tipos específicos)
        return true;
      });

      // ── 3. Stats globais ─────────────────────────────────────────────────────
      const computedStats: SelectionStats = {
        views:     intList.filter(i => i.interaction_type === "viewed").length,
        likes:     intList.filter(i => i.interaction_type === "favorited").length,
        discards:  intList.filter(i => i.interaction_type === "discarded").length,
        visits:    intList.filter(i => i.interaction_type === "visited").length,
        questions: intList.filter(i => i.interaction_type === "property_question").length,
      };
      setStats(computedStats);

      // ── 4. Último acesso e duração de sessão (NEW) ───────────────────────────
      const openEvent = [...intList]
        .filter(i => i.interaction_type === "portal_opened")
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
      setLastOpen(openEvent?.timestamp || null);

      // Pega a duração da sessão mais recente
      const sessionEndEvents = intList
        .filter(i => i.interaction_type === "session_end")
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      if (sessionEndEvents.length > 0) {
        const lastSession = sessionEndEvents[0];
        const duration = lastSession.metadata?.duration_seconds
          ?? (lastSession as any).duration_seconds
          ?? null;
        setLastSessionDuration(typeof duration === "number" ? duration : null);
      } else {
        setLastSessionDuration(null);
      }

      // ── 5. Contagem de views por imóvel (NEW: Top Interesse) ─────────────────
      const viewsByProperty: Record<string, number> = {};
      for (const int of intList) {
        if (int.interaction_type === "viewed" && int.property_id) {
          viewsByProperty[int.property_id] = (viewsByProperty[int.property_id] || 0) + 1;
        }
      }

      // ── 6. Capsule items com dados de propriedade ────────────────────────────
      const { getSupabase } = await import("@/lib/supabase");
      const supabase = getSupabase();

      const { data: capsuleItems } = await (supabase.from("capsule_items") as any)
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
        // Mapa de última interação por imóvel
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
              viewCount: viewsByProperty[p.id] || 0, // NEW
            };
          });

        // Ordena: mais interagido primeiro
        const priority: Record<string, number> = {
          favorited: 0, visited: 1, property_question: 2, viewed: 3, portal_opened: 4, sent: 5,
        };
        props.sort((a, b) => (priority[a.interactionType || "sent"] ?? 5) - (priority[b.interactionType || "sent"] ?? 5));

        setProperties(props);

        // ── 7. Top Interesse: imóvel com mais views (NEW) ──────────────────────
        let topPropId: string | null = null;
        let topViewCount = 0;
        for (const [propId, count] of Object.entries(viewsByProperty)) {
          if (count > topViewCount) {
            topViewCount = count;
            topPropId = propId;
          }
        }

        if (topPropId && topViewCount >= 1) {
          const topProp = props.find(p => p.id === topPropId);
          if (topProp) {
            setTopInterest({ property: topProp, viewCount: topViewCount });
          } else {
            setTopInterest(null);
          }
        } else {
          setTopInterest(null);
        }
      } else {
        setProperties([]);
        setTopInterest(null);
      }
    } catch (err) {
      console.error("[OrbitSelectionPanel] fetchData error:", err);
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

      {/* Last portal open + sessão */}
      <div className="flex items-center gap-3">
        {lastOpen && (
          <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
            <Clock className="w-3 h-3" />
            <span>Acesso: <span className="text-slate-400">{formatRelativeTime(lastOpen)}</span></span>
          </div>
        )}
        {/* NEW: Duração da última sessão */}
        {lastSessionDuration !== null && lastSessionDuration > 0 && (
          <div className="flex items-center gap-1.5 text-[10px] text-blue-400/70">
            <Timer className="w-3 h-3" />
            <span>Duração: <span className="text-blue-300">{formatDuration(lastSessionDuration)}</span></span>
          </div>
        )}
      </div>

      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-4 gap-1 p-3 rounded-lg bg-white/[0.03] border border-white/[0.05]">
          <StatBadge icon={Eye}           value={stats.views}     label="Views"     color="text-blue-400" />
          <StatBadge icon={Heart}         value={stats.likes}     label="Curtidas"  color="text-rose-400" />
          <StatBadge icon={Calendar}      value={stats.visits}    label="Visitas"   color="text-emerald-400" />
          <StatBadge icon={MessageSquare} value={stats.questions} label="Perguntas" color="text-sky-400" />
        </div>
      )}

      {/* NEW: Top Interesse — destaque azul */}
      {topInterest && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-500/[0.08] border border-blue-500/[0.2]">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-500/20 shrink-0">
            <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[9px] text-blue-400/70 uppercase tracking-widest font-bold mb-0.5">Top Interesse</p>
            <p className="text-[11px] text-slate-200 truncate font-medium">
              {topInterest.property.title || topInterest.property.internal_name || "Imóvel"}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0 text-blue-300">
            <Eye className="w-3 h-3" />
            <span className="text-[11px] font-bold">{topInterest.viewCount}x</span>
          </div>
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
          <p className="text-[9px] text-slate-600 uppercase tracking-widest font-bold mb-2">
            {properties.length} imóve{properties.length > 1 ? "is" : "l"} na seleção
          </p>
          <div>
            {properties.map(p => (
              <PropertyRow
                key={p.id}
                prop={p}
                isTop={topInterest?.property.id === p.id}
              />
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
