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
  Send,
  Loader2,
  Trash2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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
  internal_code: string | null;
  cover_image: string | null;
  value: number | null;
  source_link: string | null;
  state: string;
  lastInteraction?: string;
  interactionType?: string;
  viewCount?: number;
  interestScore?: number;
  metadata?: any;
  leadId?: string; // Added leadId to SelectionProperty
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
    <div className="flex flex-col items-center gap-1.5 group cursor-default">
      <div className={`flex items-center gap-1.5 text-sm font-display font-bold ${color} group-hover:scale-110 transition-transform`}>
        <Icon className="w-3.5 h-3.5" />
        <span>{value}</span>
      </div>
      <span className="text-[8px] text-[var(--orbit-text-muted)] uppercase tracking-[0.15em] font-mono leading-none">{label}</span>
    </div>
  );
}

// ─── Property Row ──────────────────────────────────────────────────────────────

interface PropertyRowProps {
  prop: SelectionProperty;
  isTop?: boolean;
  onRefresh?: () => void;
}

function PropertyRow({ prop, isTop, onRefresh }: PropertyRowProps) {
  const cfg = prop.interactionType
    ? (stateConfig[prop.interactionType] || stateConfig.sent)
    : stateConfig.sent;

  const handleDelete = async () => {
    if (!prop.leadId) {
      console.error("Lead ID is missing for property deletion.");
      return;
    }
    if (confirm("Remover da seleção?")) {
      const res = await fetch(`/api/property-interactions?leadId=${prop.leadId}&propertyId=${prop.id}&t=${Date.now()}`, {
        method: 'DELETE'
      });
      if (res.ok) onRefresh?.();
    }
  };

  return (
    <div className={`flex flex-col gap-2 py-3 border-b border-white/[0.04] last:border-0 group ${isTop ? "rounded-lg px-2 bg-blue-500/[0.06] border border-blue-500/[0.15] mb-2" : ""}`}>
      <div className="flex items-center gap-3">
        {/* Cover */}
        <div className="w-10 h-10 rounded-lg overflow-hidden bg-white/5 shrink-0 relative">
          {prop.cover_image ? (
            <img src={prop.cover_image} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Building2 className="w-3.5 h-3.5 text-slate-600" />
            </div>
          )}
          {isTop && (
            <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-blue-500 flex items-center justify-center border-2 border-[#0c0c0c]">
              <TrendingUp className="w-2 h-2 text-white" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold text-slate-200 truncate leading-tight">
             {prop.title || prop.internal_name || "Imóvel"}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-[#d4af35]/80 font-medium">{formatValue(prop.value)}</span>
            {prop.lastInteraction && (
              <>
                <span className="text-slate-700">·</span>
                <span className="text-[9px] text-slate-500">{formatRelativeTime(prop.lastInteraction)}</span>
              </>
            )}
            {prop.viewCount && prop.viewCount > 0 && (
              <>
                <span className="text-slate-700">·</span>
                <span className="text-[9px] text-blue-400 font-medium flex items-center gap-0.5">
                  <Eye className="w-2.5 h-2.5" />
                  {prop.viewCount}x
                </span>
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border shadow-sm ${cfg.bg} ${cfg.color}`}>
            {cfg.label}
          </span>
        <div className="flex items-center gap-1">
          <button 
            onClick={() => (window as any).openPropertyChat?.(prop)}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 transition-colors"
            title="Abrir Chat"
          >
            <MessageSquare className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={handleDelete}
            className="p-1.5 rounded-lg bg-rose-500/5 hover:bg-rose-500/20 text-rose-500/60 hover:text-rose-500 transition-all"
            title="Remover da Seleção"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
        </div>
      </div>

      {/* Interest Bar */}
      <div className="flex items-center gap-3 px-1">
        <div className="flex-1 h-1.5 bg-[var(--orbit-line)] rounded-full overflow-hidden relative">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${Math.min((prop.interestScore || 0) * 2, 100)}%` }}
            className={`h-full rounded-full ${
              (prop.interestScore || 0) > 35 ? 'bg-gradient-to-r from-orange-400 to-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]' :
              (prop.interestScore || 0) > 15 ? 'bg-gradient-to-r from-teal-400 to-[var(--orbit-glow)] shadow-[0_0_8px_rgba(46,197,255,0.4)]' : 
              'bg-[var(--orbit-text-muted)]/20'
            }`}
          />
        </div>
        <span className="text-[8px] font-mono font-bold text-[var(--orbit-text-muted)] uppercase tracking-tight shrink-0">
          INT: {prop.interestScore || 0}%
        </span>
      </div>

      {/* Mini Tracking Badges */}
      {prop.metadata?.last_interaction && (
        <div className="flex flex-wrap gap-1 px-1">
          {prop.metadata.scroll_depth && (
            <span className="text-[8px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded flex items-center gap-1">
              Scroll {prop.metadata.scroll_depth}%
            </span>
          )}
          {prop.metadata.last_interaction === 'video_play' && (
            <span className="text-[8px] bg-purple-500/10 text-purple-400 px-1.5 py-0.5 rounded flex items-center gap-1">
              Assistiu Vídeo
            </span>
          )}
        </div>
      )}
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
  const [lastSessionDuration, setLastSessionDuration] = useState<number | null>(null);
  const [chatProp, setChatProp] = useState<SelectionProperty | null>(null); // State para o chat modal

  const glass = "bg-[var(--orbit-bg-secondary)]/80 backdrop-blur-xl border border-[var(--orbit-line)] shadow-[var(--orbit-shadow)]";

  const fetchData = useCallback(async () => {
    if (!leadId) return;
    setLoading(true);

    try {
      console.log("[OrbitSelectionPanel] Fetching dashboard data for leadId:", leadId);
      const res = await fetch(`/api/selection-dashboard?leadId=${leadId}&t=${Date.now()}`);
      if (!res.ok) throw new Error("Erro ao buscar dados do dashboard");
      
      const { space: spaceData, items, interactions } = await res.json();
      
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

      // 1. Compute global stats from multiple tables
      const computedStats: SelectionStats = {
        views:     interactions.filter((i: any) => i.interaction_type === "viewed").length,
        likes:     interactions.filter((i: any) => i.interaction_type === "favorited").length,
        discards:  interactions.filter((i: any) => i.interaction_type === "discarded").length,
        visits:    interactions.filter((i: any) => i.interaction_type === "visited").length,
        questions: interactions.filter((i: any) => i.interaction_type === "property_question").length,
      };
      setStats(computedStats);

      // 2. Compute last open and session duration
      const openEvent = [...interactions]
        .filter((i: any) => i.interaction_type === "portal_opened")
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
      setLastOpen(openEvent?.timestamp || null);

      const sessionEndEvents = interactions
        .filter((i: any) => i.interaction_type === "session_end")
        .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      if (sessionEndEvents.length > 0) {
        const lastSession = sessionEndEvents[0];
        const duration = lastSession.metadata?.duration_seconds ?? null;
        setLastSessionDuration(duration);
      } else {
        setLastSessionDuration(null);
      }

      // 3. View counts per property for Top Interest logic
      const viewsByProperty: Record<string, number> = {};
      interactions.forEach((i: any) => {
        if (i.interaction_type === "viewed" && i.property_id) {
          viewsByProperty[i.property_id] = (viewsByProperty[i.property_id] || 0) + 1;
        }
      });

      // 4. Map capsule items into selection properties
      const latestInteractionMap = new Map<string, { type: string; ts: string }>();
      interactions.forEach((i: any) => {
        if (!latestInteractionMap.has(i.property_id)) {
          latestInteractionMap.set(i.property_id, {
            type: i.interaction_type,
            ts: i.timestamp,
          });
        }
      });

      const props: SelectionProperty[] = (items as any[])
        .filter(item => item.properties)
        .map(item => {
          const p = item.properties as any;
          const latestInt = latestInteractionMap.get(p.id);
          return {
            id: p.id,
            title: p.title,
            internal_name: p.internal_name,
            internal_code: p.internal_code || null,
            cover_image: p.cover_image,
            value: p.value,
            source_link: p.source_link,
            state: item.state,
            lastInteraction: latestInt?.ts,
            interactionType: latestInt?.type || item.state,
            viewCount: viewsByProperty[p.id] || 0,
            interestScore: item.metadata?.interest_score || 0,
            metadata: item.metadata,
            leadId: leadId, // Pass leadId to property for deletion
          };
        });

      // Sorting: highest priority interaction types first
      const priority: Record<string, number> = {
        favorited: 0, visited: 1, property_question: 2, viewed: 3, portal_opened: 4, sent: 5,
      };
      props.sort((a: SelectionProperty, b: SelectionProperty) => (priority[a.interactionType || "sent"] ?? 10) - (priority[b.interactionType || "sent"] ?? 10));

      setProperties(props);

      // 5. Select Top Interest based on view counts
      let topPropId: string | null = null;
      let topViewCount = 0;
      Object.entries(viewsByProperty).forEach(([propId, count]) => {
        if (count > topViewCount) {
          topViewCount = count;
          topPropId = propId;
        }
      });

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

    } catch (err) {
      console.error("[OrbitSelectionPanel] fetchData consolidated error:", err);
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
                onRefresh={fetchData}
              />
            ))}
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


      {/* GLOBAL MODALS / DRAWERS */}
      {chatProp && (
        <div className="fixed inset-y-0 right-0 w-[400px] z-[100] bg-[#0c0c0c] border-l border-white/10 shadow-2xl flex flex-col translate-x-0 transition-transform duration-300">
           <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <div>
                <h3 className="text-white font-bold text-sm">Chat com Lead</h3>
                <p className="text-[10px] text-slate-500 truncate max-w-[250px]">{chatProp.title}</p>
              </div>
              <button 
                onClick={() => setChatProp(null)}
                className="p-1.5 rounded-lg bg-white/5 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {/* Reuso do componente de chat (versão broker) */}
            <div className="flex-1 overflow-hidden relative">
               <BrokerPropertyChat 
                 leadId={leadId} 
                 propertyId={chatProp.id} 
                 propertyTitle={chatProp.title || ""} 
               />
            </div>
        </div>
      )}

      {/* External Control Hack */}
      <div className="hidden">
        {(() => {
          if (typeof window !== 'undefined') {
            (window as any).openPropertyChat = (prop: SelectionProperty) => setChatProp(prop);
          }
          return null;
        })()}
      </div>
    </div>
  );
}


function BrokerPropertyChat({ leadId, propertyId, propertyTitle }: { leadId: string, propertyId: string, propertyTitle: string }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const fetchMsgs = async () => {
      try {
        const res = await fetch(`/api/selection-chat?leadId=${leadId}&propertyId=${propertyId}`);
        const d = await res.json();
        setMessages(d.messages || []);
      } catch (err) {}
      setLoading(false);
    };
    fetchMsgs();
  }, [leadId, propertyId]);

  const handleSend = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch('/api/selection-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId,
          propertyId,
          senderType: 'broker', // Identifica Jean Brusch
          content: text
        })
      });
      if (res.ok) {
        const m = await res.json();
        setMessages(prev => [...prev, m]);
        setText("");
      }
    } catch (err) {}
    setSending(false);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="w-4 h-4 animate-spin text-slate-600" />
          </div>
        ) : (
          messages.map((m: any) => (
            <div key={m.id} className={`flex ${m.sender_type === 'broker' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-xl p-3 text-[11px] ${
                m.sender_type === 'broker' ? 'bg-[#d4af35] text-black font-medium' : 'bg-white/5 text-slate-300'
              }`}>
                {m.content}
              </div>
            </div>
          ))
        )}
      </div>
      <div className="p-4 bg-white/[0.02] border-t border-white/5">
        <div className="flex gap-2">
          <input 
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Responder ao cliente..."
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[11px] focus:outline-none focus:border-[#d4af35]/50"
          />
          <button 
            onClick={handleSend}
            disabled={!text.trim() || sending}
            className="p-2 rounded-lg bg-[#d4af35] text-black disabled:opacity-50"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
