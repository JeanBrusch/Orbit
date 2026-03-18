"use client";

import { useEffect, useState, useMemo } from "react";
import { getSupabase } from "@/lib/supabase";
import { TopBar } from "@/components/top-bar";
import { OrbitProvider } from "@/components/orbit-context";
import { useTheme } from "next-themes";
import { Columns, RefreshCw, X, MessageSquare, Phone, MoreHorizontal, AlertTriangle, ArrowRight, ArrowUp, ArrowDown, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { LeadFocusPanel } from "@/components/lead-focus-panel"; // Usamos isso para detalhe se quisermos o painel todo, ou construímos o mini-drawer no arquivo?
// As instruções falam: "Drawer de detalhe (bottom sheet) ... Abre ao tocar no card."
// Vamos construir o drawer aqui.

// ─── Interfaces ─────────────────────────────────────────────────────────────
interface PipelineLead {
  id: string;
  name: string;
  photo_url: string | null;
  phone: string | null;
  orbit_stage: string;
  action_suggested: string | null;
  last_interaction_at: string | null;
  interest_score: number;
  momentum_score: number;
  risk_score: number;
  current_state: string | null;
  central_conflict: string | null;
  what_not_to_do: string | null;
  last_human_action_at: string | null;
  last_ai_analysis_at: string | null;
  snippet: string | null;
  urgency: number;
}

const STAGES = [
  { key: "latent", label: "Latente", color: "#64748b", light: { bg: "#f5f5f5", text: "#6b7280", border: "rgba(0,0,0,0.08)" } },
  { key: "curious", label: "Curioso", color: "#3b82f6", light: { bg: "#eff6ff", text: "#3b82f6", border: "rgba(59,130,246,0.15)" } },
  { key: "exploring", label: "Explorando", color: "#8b5cf6", light: { bg: "#f5f3ff", text: "#8b5cf6", border: "rgba(139,92,246,0.15)" } },
  { key: "evaluating", label: "Avaliando", color: "#10b981", light: { bg: "#f0fdf4", text: "#16a34a", border: "rgba(22,163,74,0.15)" } },
  { key: "deciding", label: "Decidindo", color: "#4f46e5", light: { bg: "#eef2ff", text: "#4f46e5", border: "rgba(79,70,229,0.20)" } },
  { key: "resolved", label: "Resolvido", color: "#f43f5e", light: { bg: "#fff1f2", text: "#e11d48", border: "rgba(225,29,72,0.15)" } },
] as const;

type StageKey = (typeof STAGES)[number]["key"];

// ─── Helpers ────────────────────────────────────────────────────────────────
function formatRelativeShort(ts: string | null) {
  if (!ts) return "—";
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return `${Math.floor(d / 7)}sem`;
}

function getInitials(name: string | null) {
  if (!name) return "??";
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

// ─── Main Component ─────────────────────────────────────────────────────────
export default function PipelinePage() {
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  
  const [leads, setLeads] = useState<PipelineLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterUrgent, setFilterUrgent] = useState(false);
  
  // Mobile UI state
  const [activeTab, setActiveTab] = useState<StageKey>("latent");
  const [isMobile, setIsMobile] = useState(false);
  
  // Drawer state
  const [selectedLead, setSelectedLead] = useState<PipelineLead | null>(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const fetchPipeline = async () => {
    setLoading(true);
    const supabase = getSupabase();
    try {
      // 1. Fetch leads
      const { data: leadsData } = await supabase
        .from('leads')
        .select(`
          id, name, phone, photo_url, orbit_stage, action_suggested, last_interaction_at,
          lead_cognitive_state (
            interest_score, momentum_score, risk_score, current_state,
            central_conflict, what_not_to_do, last_human_action_at, last_ai_analysis_at
          )
        `)
        .not('state', 'in', '("blocked","ignored","pending")')
        .order('last_interaction_at', { ascending: false });

      if (!leadsData) return;
      const ids = leadsData.map((l: any) => l.id);

      // 2. Fetch snippets
      const { data: messagesData } = await (supabase as any)
        .from('messages')
        .select('lead_id, content, source, timestamp')
        .in('lead_id', ids)
        .order('timestamp', { ascending: false });

      // 3. Fetch insights for urgency
      const { data: insightsData } = await supabase
        .from('ai_insights')
        .select('lead_id, urgency, content, created_at')
        .in('lead_id', ids)
        .order('created_at', { ascending: false });

      // Build map
      const msgsByLead = new Map();
      messagesData?.forEach((m: any) => {
        if (!msgsByLead.has(m.lead_id)) msgsByLead.set(m.lead_id, m);
      });

      const insightsByLead = new Map();
      insightsData?.forEach((i: any) => {
        if (!insightsByLead.has(i.lead_id)) insightsByLead.set(i.lead_id, i);
      });

      const mapped: PipelineLead[] = leadsData.map((l: any) => {
        const cog = Array.isArray(l.lead_cognitive_state) ? l.lead_cognitive_state[0] : l.lead_cognitive_state;
        const msg = msgsByLead.get(l.id);
        const ins = insightsByLead.get(l.id);

        let parsedSnippet = msg?.content || "";
        try {
          const js = JSON.parse(parsedSnippet);
          if (js.caption || js.summary) parsedSnippet = js.caption || js.summary;
        } catch {}

        let st = l.orbit_stage || "latent";
        if (st === "dormant") st = "latent";

        return {
          id: l.id,
          name: l.name || "Lead",
          photo_url: l.photo_url,
          phone: l.phone,
          orbit_stage: st,
          action_suggested: l.action_suggested,
          last_interaction_at: l.last_interaction_at,
          interest_score: cog?.interest_score || 50,
          momentum_score: cog?.momentum_score || 50,
          risk_score: cog?.risk_score || 50,
          current_state: cog?.current_state || null,
          central_conflict: cog?.central_conflict || null,
          what_not_to_do: cog?.what_not_to_do || null,
          last_human_action_at: cog?.last_human_action_at || null,
          last_ai_analysis_at: cog?.last_ai_analysis_at || null,
          snippet: parsedSnippet,
          urgency: ins?.urgency || 0
        };
      });

      setLeads(mapped);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPipeline();

    // Supabase Realtime subscriptions
    const supabase = getSupabase();
    const ch = supabase.channel("pipeline-realtime")
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lead_cognitive_state' }, () => {
        fetchPipeline(); // For simplicity, refetch all to guarantee consistency. In a massive scale, we'd update locally.
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        fetchPipeline();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
        fetchPipeline();
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, []);

  const displayedLeads = useMemo(() => {
    return filterUrgent ? leads.filter(l => l.urgency >= 4) : leads;
  }, [leads, filterUrgent]);

  const leadsByStage = useMemo(() => {
    const acc = STAGES.reduce((map, stage) => {
      map[stage.key] = [];
      return map;
    }, {} as Record<string, PipelineLead[]>);
    
    displayedLeads.forEach(l => {
      // Falback if stage is unknown
      if (acc[l.orbit_stage]) {
        acc[l.orbit_stage].push(l);
      } else {
        acc['latent'].push(l);
      }
    });

    return acc;
  }, [displayedLeads]);

  const stats = {
    total: leads.length,
    active: leads.filter(l => l.orbit_stage !== "resolved").length,
    deciding: leads.filter(l => l.orbit_stage === "deciding").length,
    resolved: leads.filter(l => l.orbit_stage === "resolved").length,
  };

  const handleLogout = () => {
    const supabase = getSupabase();
    supabase.auth.signOut().then(() => router.push("/login"));
  };

  return (
    <OrbitProvider>
      <div className="min-h-screen bg-[var(--orbit-bg)] text-[var(--orbit-text)] overflow-hidden flex flex-col font-sans">
      <TopBar 
        totalLeads={stats.active} 
        isDark={theme === "dark"} 
        onThemeToggle={() => setTheme(theme === 'dark' ? 'light' : 'dark')} 
        onLogout={handleLogout} 
      />

      <main className="flex-1 mt-[60px] md:mt-[72px] flex flex-col min-h-0 relative z-10">
        
        {/* HEADER */}
        <div className="px-4 md:px-6 py-4 shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--orbit-glass-border)] bg-[var(--orbit-bg)]">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/")} className="p-1.5 rounded-lg bg-[var(--orbit-glass)] border border-[var(--orbit-glass-border)] text-slate-400 hover:text-white transition-all">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h1 className="text-lg md:text-xl font-display font-bold flex items-center gap-2">
              <Columns className="w-5 h-5 text-[var(--orbit-glow)]" />
              Pipeline
              <span className="text-xs font-sans font-normal text-[var(--orbit-text-muted)] bg-[var(--orbit-bg-secondary)] px-2 py-0.5 rounded-full border border-[var(--orbit-glass-border)] ml-2 invisible sm:visible">
                Orbit View
              </span>
            </h1>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 md:gap-4 overflow-x-auto pb-1 sm:pb-0 custom-scrollbar-hide">
            {/* Stats chips */}
            <div className="flex gap-2">
              <StatChip label="Total" value={stats.total} />
              <StatChip label="Ativos" value={stats.active} />
              <StatChip label="Decidindo" value={stats.deciding} highlight={true} />
              <StatChip label="Fechados" value={stats.resolved} />
            </div>

            <div className="flex items-center gap-2">
              <button 
                onClick={() => setFilterUrgent(!filterUrgent)}
                className={`text-[11px] font-bold px-3 py-1.5 rounded-lg border transition-all whitespace-nowrap ${
                  filterUrgent 
                    ? "bg-rose-500/10 text-rose-500 border-rose-500/20" 
                    : "bg-[var(--orbit-bg-secondary)] text-[var(--orbit-text-muted)] border-[var(--orbit-glass-border)] hover:text-[var(--orbit-text)]"
                }`}
              >
                Urgentes ({leads.filter(l => l.urgency >= 4).length})
              </button>
              
              <button onClick={fetchPipeline} className="p-1.5 rounded-lg bg-[var(--orbit-bg-secondary)] border border-[var(--orbit-glass-border)] text-slate-400 hover:text-[var(--orbit-text)] transition-all shrink-0">
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-[var(--orbit-glow)]" : ""}`} />
              </button>
            </div>
          </div>
        </div>

        {/* MOBILE TABS */}
        {isMobile && (
          <div className="flex overflow-x-auto border-b border-[var(--orbit-glass-border)] bg-[var(--orbit-bg)] sticky top-0 z-20 custom-scrollbar-hide">
            {STAGES.map(stage => {
              const count = leadsByStage[stage.key].length;
              const hasUrgent = leadsByStage[stage.key].some(l => l.urgency >= 4);
              const active = activeTab === stage.key;
              return (
                <button
                  key={stage.key}
                  onClick={() => setActiveTab(stage.key)}
                  className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-all shrink-0 ${
                    active ? "border-[var(--orbit-glow)] text-[var(--orbit-text)] bg-[var(--orbit-bg-secondary)]" : "border-transparent text-[var(--orbit-text-muted)] hover:text-[var(--orbit-text)]"
                  }`}
                >
                  <div className="relative">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
                    {hasUrgent && <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-rose-500 animate-pulse border border-[var(--orbit-bg)]" />}
                  </div>
                  <span className="text-xs font-bold uppercase tracking-widest">{stage.label}</span>
                  <span className="text-[10px] bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded-md font-mono text-[var(--orbit-text)]">{count}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* BOARD AREA */}
        <div className={`flex-1 overflow-x-auto overflow-y-hidden p-4 md:p-6 ${isMobile ? "" : "flex gap-4 md:gap-6"}`}>
          {STAGES.map(stage => {
            // If mobile, only render the active tab column
            if (isMobile && activeTab !== stage.key) return null;
            
            const colLeads = leadsByStage[stage.key];

            return (
              <div key={stage.key} className={`flex flex-col h-full shrink-0 ${isMobile ? "w-full" : "w-[280px] lg:w-[320px]"}`}>
                
                {/* Column Header (Desktop only) */}
                {!isMobile && (
                  <div className="flex items-center justify-between mb-4 sticky top-0 px-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
                      <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--orbit-text)]">{stage.label}</h2>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono bg-[var(--orbit-glass)] border border-[var(--orbit-glass-border)] px-1.5 py-0.5 rounded-md">
                      {colLeads.length}
                    </span>
                  </div>
                )}

                {/* Column Content */}
                <div className="flex-1 overflow-y-auto pr-2 pb-10 space-y-3 custom-scrollbar">
                  <AnimatePresence>
                    {colLeads.map(lead => (
                      <PipelineCard 
                        key={lead.id} 
                        lead={lead} 
                        color={stage.color}
                        onClick={() => setSelectedLead(lead)} 
                        onChat={() => router.push(`/lead/${lead.id}`)}
                      />
                    ))}
                  </AnimatePresence>
                  {colLeads.length === 0 && (
                    <div className="border-2 border-dashed border-white/5 rounded-xl flex items-center justify-center p-6 bg-white/[0.01]">
                      <span className="text-xs text-slate-600 font-medium">Vazio</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

      </main>

      {/* LEAD DRAWER (Bottom Sheet) */}
      <AnimatePresence>
        {selectedLead && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setSelectedLead(null)}
              className="fixed inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm z-[200] touch-none"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 26, stiffness: 220 }}
              className="fixed bottom-0 left-0 right-0 max-h-[90vh] bg-[var(--orbit-bg)] border-t border-[var(--orbit-glass-border)] rounded-t-3xl z-[201] flex flex-col shadow-2xl pb-[env(safe-area-inset-bottom)] lg:max-w-xl lg:mx-auto lg:bottom-4 lg:rounded-3xl lg:border lg:h-auto"
            >
              {/* Handle bar */}
              <div className="w-full flex justify-center pt-3 pb-2 cursor-pointer touch-none" onClick={() => setSelectedLead(null)}>
                <div className="w-12 h-1.5 bg-slate-300 dark:bg-white/20 rounded-full" />
              </div>

              <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
                
                {/* Header Profile */}
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className="w-16 h-16 rounded-full overflow-hidden bg-[#d4af35]/10 border-2 border-[#d4af35]/30 flex items-center justify-center text-xl font-bold text-[#d4af35]">
                        {selectedLead.photo_url ? (
                          <img src={selectedLead.photo_url} alt="" className="w-full h-full object-cover" />
                        ) : getInitials(selectedLead.name)}
                      </div>
                      <div className="absolute bottom-0 right-0 w-4 h-4 bg-emerald-500 rounded-full border-2 border-[var(--orbit-bg)]" />
                    </div>
                    <div>
                      <h2 className="text-lg font-display font-medium text-[var(--orbit-text)]">{selectedLead.name}</h2>
                      <div className="flex items-center gap-2 mt-1">
                        <span 
                          className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border"
                          style={{ 
                            backgroundColor: STAGES.find(s => s.key === selectedLead.orbit_stage)?.light?.bg,
                            color: STAGES.find(s => s.key === selectedLead.orbit_stage)?.light?.text,
                            borderColor: STAGES.find(s => s.key === selectedLead.orbit_stage)?.light?.border
                          }}
                        >
                          {STAGES.find(s => s.key === selectedLead.orbit_stage)?.label || selectedLead.orbit_stage}
                        </span>
                        <span className="text-xs text-[var(--orbit-text-muted)]">• Há {formatRelativeShort(selectedLead.last_interaction_at)}</span>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => setSelectedLead(null)} className="p-2 rounded-full bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-[var(--orbit-text-muted)]">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Score Grid */}
                <div className="grid grid-cols-3 gap-3">
                  <ScoreBox label="Interesse" value={selectedLead.interest_score} colorClass="text-[#d4af35]" bgClass="bg-[#d4af35]/10 border-[#d4af35]/20" />
                  <ScoreBox label="Momentum" value={selectedLead.momentum_score} colorClass="text-[#d4af35]" bgClass="bg-[#d4af35]/10 border-[#d4af35]/20" />
                  <ScoreBox label="Risco" value={selectedLead.risk_score} colorClass="text-red-500" bgClass="bg-red-500/10 border-red-500/20" />
                </div>

                {/* AI Suggestions and Conflicts */}
                {selectedLead.action_suggested && (
                  <div className="bg-[var(--orbit-glow)]/5 border border-[var(--orbit-glow)]/10 p-4 rounded-xl flex flex-col gap-2">
                    <h4 className="text-[10px] font-bold text-[var(--orbit-glow)] uppercase tracking-widest flex items-center gap-2">
                      <AlertTriangle className="w-3 h-3" /> Sugestão da IA
                    </h4>
                    <p className="text-[13px] text-[var(--orbit-text)] leading-relaxed font-medium">
                      {selectedLead.action_suggested}
                    </p>
                  </div>
                )}

                {(selectedLead.central_conflict || selectedLead.what_not_to_do) && (
                  <div className="flex flex-col gap-3">
                    {selectedLead.central_conflict && (
                      <div className="bg-red-500/5 border border-red-500/10 p-3.5 rounded-xl">
                        <h4 className="text-[10px] font-bold text-red-500 uppercase tracking-widest mb-1.5">Conflito Central</h4>
                        <p className="text-xs text-red-600 dark:text-red-200/80 leading-snug font-medium">{selectedLead.central_conflict}</p>
                      </div>
                    )}
                    {selectedLead.what_not_to_do && (
                      <div className="bg-orange-500/5 border border-orange-500/10 p-3.5 rounded-xl">
                        <h4 className="text-[10px] font-bold text-orange-500 uppercase tracking-widest mb-1.5">O Que Não Fazer</h4>
                        <p className="text-xs text-orange-600 dark:text-orange-200/80 leading-snug font-medium">{selectedLead.what_not_to_do}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Snippet Msg */}
                {selectedLead.snippet && (
                  <div className="bg-[var(--orbit-bg-secondary)] border border-[var(--orbit-glass-border)] p-4 rounded-xl italic">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--orbit-text-muted)] mb-2">
                      Última Mensagem
                    </p>
                    <p className="text-sm text-[var(--orbit-text)] leading-relaxed border-l-2 border-[var(--orbit-glow)]/30 pl-3">
                      "{selectedLead.snippet}"
                    </p>
                  </div>
                )}

              </div>

              {/* Actions Footer */}
              <div className="p-4 border-t border-[var(--orbit-glass-border)] bg-slate-50 dark:bg-[#1a1a1a] flex gap-3 rounded-b-3xl">
                <button 
                  onClick={() => router.push(`/lead/${selectedLead.id}`)}
                  className="flex-1 bg-[var(--orbit-glow)] text-white font-bold uppercase tracking-widest text-[11px] py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-[var(--orbit-shadow)] transition-transform hover:scale-[1.02]"
                >
                  <MessageSquare className="w-4 h-4" /> Abrir Chat
                </button>
                <button 
                  onClick={() => router.push(`/lead/${selectedLead.id}`)}
                  className="flex-1 bg-slate-200 dark:bg-white/5 border border-slate-300 dark:border-white/10 text-[var(--orbit-text)] font-bold uppercase tracking-widest text-[11px] py-3.5 rounded-xl flex items-center justify-center gap-2 transition-colors hover:bg-slate-300 dark:hover:bg-white/10"
                >
                  Ver Perfil
                </button>
              </div>

            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
    </OrbitProvider>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function StatChip({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`flex flex-col px-3 py-1.5 rounded-lg border flex-shrink-0 min-w-[70px] ${
      highlight ? "bg-[var(--orbit-glow)]/5 border-[var(--orbit-glow)]/20 text-[var(--orbit-glow)]" : "bg-[var(--orbit-bg-secondary)] border-[var(--orbit-glass-border)] text-[var(--orbit-text-muted)]"
    }`}>
      <span className="text-[9px] uppercase tracking-widest font-bold mb-0.5">{label}</span>
      <span className={`text-[15px] font-display font-medium leading-none ${highlight ? "text-[var(--orbit-glow)]" : "text-[var(--orbit-text)]"}`}>{value}</span>
    </div>
  );
}

function ScoreBox({ label, value, colorClass, bgClass }: { label: string; value: number; colorClass: string; bgClass: string }) {
  return (
    <div className={`flex flex-col items-center justify-center p-3 rounded-xl border ${bgClass} transition-colors`}>
      <span className="text-[8px] font-bold uppercase tracking-widest text-[var(--orbit-text-muted)] mb-1">{label}</span>
      <span className={`text-xl font-display font-medium ${colorClass}`}>{value}</span>
    </div>
  );
}

function PipelineCard({ lead, color, onClick, onChat }: { lead: PipelineLead; color: string; onClick: () => void; onChat: () => void; }) {
  
  // Condicional indicators
  const isUrgent = lead.urgency >= 4;
  const isPendingWarning = lead.last_ai_analysis_at && lead.last_human_action_at 
    ? new Date(lead.last_ai_analysis_at) > new Date(lead.last_human_action_at) 
    : false;
  
  const isRecent = lead.last_interaction_at && (Date.now() - new Date(lead.last_interaction_at).getTime()) < 3600000; // < 1h
  
  const urgencyBorder = lead.urgency === 5 ? "border-t-[3px] border-t-red-500" : lead.urgency === 4 ? "border-t-[3px] border-t-orange-500" : "";

  const momentumIcon = lead.momentum_score > 60 ? <ArrowUp className="w-3 h-3 text-emerald-400" /> : lead.momentum_score < 30 ? <ArrowDown className="w-3 h-3 text-red-400" /> : <ArrowRight className="w-3 h-3 text-[#d4af35]" />;

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -2 }}
      className={`bg-[var(--orbit-bg)] rounded-xl p-3.5 border border-[var(--orbit-glass-border)] shadow-[var(--orbit-shadow)] hover:shadow-[var(--orbit-shadow-hover)] cursor-pointer ${urgencyBorder} flex flex-col gap-3 relative overflow-hidden transition-shadow duration-300`}
      onClick={onChat}
    >
      {/* HEADER: Avatar + Info */}
      <div className="flex gap-3 items-center">
        <div className="relative shrink-0">
          <div 
            className={`w-11 h-11 rounded-full overflow-hidden flex items-center justify-center font-bold text-sm text-[var(--orbit-bg)] border-2`}
            style={{ backgroundColor: color, borderColor: `${color}80` }}
          >
            {lead.photo_url ? <img src={lead.photo_url} className="w-full h-full object-cover" /> : getInitials(lead.name)}
          </div>
          {isPendingWarning && (
            <div className="absolute -inset-1 rounded-full border border-dashed border-[#d4af35] animate-[spin_4s_linear_infinite] pointer-events-none" />
          )}
          {isRecent && (
            <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-[var(--orbit-bg)] animate-pulse" />
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-[var(--orbit-text)] truncate font-display">{lead.name}</h3>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-[var(--orbit-text-muted)] font-medium">Há {formatRelativeShort(lead.last_interaction_at)}</span>
            {isUrgent && <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-500 uppercase border border-rose-500/20">Urgent</span>}
          </div>
        </div>
        
        {/* Quick action: Details */}
        <button 
          onClick={(e) => { e.stopPropagation(); onClick(); }}
          className="w-8 h-8 rounded bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 flex items-center justify-center text-[var(--orbit-text-muted)] hover:text-[var(--orbit-text)] shrink-0 transition-colors"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>

      {/* Snippet */}
      {lead.snippet && (
        <p className="text-xs text-[var(--orbit-text-muted)] italic line-clamp-2 leading-relaxed pl-1 border-l border-[var(--orbit-glass-border)]">
          "{lead.snippet}"
        </p>
      )}

      {/* Metrics Row */}
      <div className="flex items-center justify-between mt-1 px-1">
        {/* Interest Progress */}
        <div className="flex-1 max-w-[50%]">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[8px] font-bold uppercase tracking-wider text-[var(--orbit-text-muted)]">Interesse</span>
            <span className="text-[10px] font-display font-medium text-[var(--orbit-glow)]">{lead.interest_score}</span>
          </div>
          <div className="h-1.5 w-full bg-[var(--orbit-bg-secondary)] rounded-full overflow-hidden">
            <div className="h-full bg-[var(--orbit-glow)] rounded-full transition-all" style={{ width: `${Math.max(0, Math.min(100, lead.interest_score))}%` }} />
          </div>
        </div>
        
        {/* Momentum Indicator */}
        <div className="flex items-center gap-1.5 bg-[var(--orbit-bg-secondary)] border border-[var(--orbit-glass-border)] px-2 py-1 rounded-md">
          <span className="text-[8px] font-bold uppercase tracking-wider text-[var(--orbit-text-muted)]">Mom</span>
          {momentumIcon}
        </div>
      </div>

      {/* Action Suggested Box */}
      {lead.action_suggested && (
        <div className="bg-[var(--orbit-glow)]/5 border border-[var(--orbit-glow)]/10 rounded-lg p-2.5 mt-1">
          <p className="text-[10px] text-[var(--orbit-glow)] font-medium leading-relaxed truncate group-hover:block" title={lead.action_suggested}>
            💡 {lead.action_suggested}
          </p>
        </div>
      )}

    </motion.div>
  );
}
