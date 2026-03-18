"use client";

import { useEffect, useState, useMemo } from "react";
import { getSupabase } from "@/lib/supabase";
import { TopBar } from "@/components/top-bar";
import { OrbitProvider, useOrbitContext } from "@/components/orbit-context";
import { useTheme } from "next-themes";
import {
  RefreshCw, ArrowLeft, ArrowRight, ArrowUp, ArrowDown,
  Zap, Clock, TrendingUp
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { LeadCognitiveConsole } from "@/components/lead-cognitive-console";

// ─── Interfaces ──────────────────────────────────────────────────────────────
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
  { key: "latent",     label: "Latente",    color: "#64748b" },
  { key: "curious",    label: "Curioso",    color: "#3b82f6" },
  { key: "exploring",  label: "Explorando", color: "#8b5cf6" },
  { key: "evaluating", label: "Avaliando",  color: "#10b981" },
  { key: "deciding",   label: "Decidindo",  color: "#f59e0b" },
  { key: "resolved",   label: "Resolvido",  color: "#f43f5e" },
] as const;

type StageKey = (typeof STAGES)[number]["key"];

// ─── Helpers ─────────────────────────────────────────────────────────────────
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

// ─── Inner Component ──────────────────────────────────────────────────────────
function PipelineContent() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const router = useRouter();
  const { selectedLeadId, isLeadPanelOpen, openLeadPanel, closeLeadPanel } = useOrbitContext();

  const [leads, setLeads] = useState<PipelineLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterUrgent, setFilterUrgent] = useState(false);
  const [activeTab, setActiveTab] = useState<StageKey>("latent");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const fetchPipeline = async () => {
    setLoading(true);
    const supabase = getSupabase();
    try {
      const { data: leadsData } = await supabase
        .from("leads")
        .select(`
          id, name, phone, photo_url, orbit_stage, action_suggested, last_interaction_at,
          lead_cognitive_state (
            interest_score, momentum_score, risk_score, current_state,
            central_conflict, what_not_to_do, last_human_action_at, last_ai_analysis_at
          )
        `)
        .not("state", "in", '("blocked","ignored","pending")')
        .order("last_interaction_at", { ascending: false });

      if (!leadsData) return;
      const ids = leadsData.map((l: any) => l.id);

      const { data: messagesData } = await (supabase as any)
        .from("messages").select("lead_id, content, source, timestamp")
        .in("lead_id", ids).order("timestamp", { ascending: false });

      const { data: insightsData } = await supabase
        .from("ai_insights").select("lead_id, urgency, content, created_at")
        .in("lead_id", ids).order("created_at", { ascending: false });

      const msgsByLead = new Map();
      messagesData?.forEach((m: any) => { if (!msgsByLead.has(m.lead_id)) msgsByLead.set(m.lead_id, m); });
      const insightsByLead = new Map();
      insightsData?.forEach((i: any) => { if (!insightsByLead.has(i.lead_id)) insightsByLead.set(i.lead_id, i); });

      const mapped: PipelineLead[] = leadsData.map((l: any) => {
        const cog = Array.isArray(l.lead_cognitive_state) ? l.lead_cognitive_state[0] : l.lead_cognitive_state;
        const msg = msgsByLead.get(l.id);
        const ins = insightsByLead.get(l.id);
        let snippet = msg?.content || "";
        try { const js = JSON.parse(snippet); if (js.caption || js.summary) snippet = js.caption || js.summary; } catch {}
        let st = l.orbit_stage || "latent";
        if (st === "dormant") st = "latent";
        return {
          id: l.id, name: l.name || "Lead", photo_url: l.photo_url, phone: l.phone,
          orbit_stage: st, action_suggested: l.action_suggested,
          last_interaction_at: l.last_interaction_at,
          interest_score: cog?.interest_score || 50,
          momentum_score: cog?.momentum_score || 50,
          risk_score: cog?.risk_score || 50,
          current_state: cog?.current_state || null,
          central_conflict: cog?.central_conflict || null,
          what_not_to_do: cog?.what_not_to_do || null,
          last_human_action_at: cog?.last_human_action_at || null,
          last_ai_analysis_at: cog?.last_ai_analysis_at || null,
          snippet, urgency: ins?.urgency || 0
        };
      });
      setLeads(mapped);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => {
    fetchPipeline();
    const supabase = getSupabase();
    const ch = supabase.channel("pipeline-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "lead_cognitive_state" }, fetchPipeline)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, fetchPipeline)
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, fetchPipeline)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const displayedLeads = useMemo(() =>
    filterUrgent ? leads.filter(l => l.urgency >= 4) : leads,
    [leads, filterUrgent]
  );

  const leadsByStage = useMemo(() => {
    const acc = STAGES.reduce((map, s) => { map[s.key] = []; return map; }, {} as Record<string, PipelineLead[]>);
    displayedLeads.forEach(l => { (acc[l.orbit_stage] ?? acc["latent"]).push(l); });
    return acc;
  }, [displayedLeads]);

  const stats = {
    total: leads.length,
    active: leads.filter(l => l.orbit_stage !== "resolved").length,
    deciding: leads.filter(l => l.orbit_stage === "deciding").length,
    urgent: leads.filter(l => l.urgency >= 4).length,
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--orbit-bg)] text-[var(--orbit-text)]">
      <TopBar
        totalLeads={stats.active}
        isDark={isDark}
        onThemeToggle={() => setTheme(isDark ? "light" : "dark")}
        onLogout={() => getSupabase().auth.signOut().then(() => router.push("/login"))}
      />

      <div className="flex-1 flex flex-col mt-[60px] md:mt-[72px] overflow-hidden">

        {/* ── HEADER ── */}
        <div className="shrink-0 px-5 md:px-8 py-3.5 flex items-center justify-between gap-4 border-b border-[var(--orbit-glass-border)] bg-[var(--orbit-bg)] backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/")}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-all bg-[var(--orbit-glass)] border border-[var(--orbit-glass-border)] text-[var(--orbit-text-muted)] hover:text-[var(--orbit-text)]"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>

            <div className="w-px h-5 bg-[var(--orbit-glass-border)]" />

            <div className="flex items-center gap-2">
              <span className="w-1 h-4 rounded-full bg-[var(--orbit-glow)]" />
              <h1 className="text-sm font-bold tracking-tight text-[var(--orbit-text)]">Pipeline</h1>
              <span className="text-[9px] font-bold uppercase tracking-[0.15em] px-2 py-0.5 rounded-full bg-[var(--orbit-glow)]/10 text-[var(--orbit-glow)] border border-[var(--orbit-glow)]/20">
                Orbit 3.0
              </span>
            </div>

            <div className="hidden md:flex items-center gap-3 ml-1">
              <span className="text-[10px] text-[var(--orbit-text-muted)]">
                <span className="font-mono font-bold text-[var(--orbit-text)]">{stats.active}</span> ativos
              </span>
              <span className="text-[10px] text-[var(--orbit-text-muted)]">
                <span className="font-mono font-bold text-amber-400">{stats.deciding}</span> decidindo
              </span>
              {stats.urgent > 0 && (
                <span className="text-[10px] text-[var(--orbit-text-muted)]">
                  <span className="font-mono font-bold text-rose-400">{stats.urgent}</span> urgentes
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilterUrgent(!filterUrgent)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-wider transition-all ${
                filterUrgent
                  ? "bg-rose-500/10 text-rose-400 border-rose-500/25"
                  : "bg-[var(--orbit-glass)] border-[var(--orbit-glass-border)] text-[var(--orbit-text-muted)] hover:text-[var(--orbit-text)]"
              }`}
            >
              <Zap className="w-3 h-3" />
              Urgentes
            </button>
            <button
              onClick={fetchPipeline}
              className="w-8 h-8 rounded-lg border flex items-center justify-center transition-all bg-[var(--orbit-glass)] border-[var(--orbit-glass-border)] text-[var(--orbit-text-muted)] hover:text-[var(--orbit-text)]"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-[var(--orbit-glow)]" : ""}`} />
            </button>
          </div>
        </div>

        {/* ── MOBILE TABS ── */}
        {isMobile && (
          <div className="flex overflow-x-auto shrink-0 border-b border-[var(--orbit-glass-border)] bg-[var(--orbit-bg)]">
            {STAGES.map(stage => {
              const count = leadsByStage[stage.key].length;
              const isActive = activeTab === stage.key;
              return (
                <button
                  key={stage.key}
                  onClick={() => setActiveTab(stage.key)}
                  className={`flex items-center gap-2 px-4 py-3 border-b-2 shrink-0 transition-all ${
                    isActive ? "border-[var(--orbit-glow)]" : "border-transparent"
                  }`}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: stage.color, boxShadow: isActive ? `0 0 5px ${stage.color}` : "none" }}
                  />
                  <span className={`text-[10px] font-bold uppercase tracking-widest transition-colors ${
                    isActive ? "text-[var(--orbit-text)]" : "text-[var(--orbit-text-muted)]"
                  }`}>
                    {stage.label}
                  </span>
                  <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md transition-colors ${
                    isActive
                      ? "bg-[var(--orbit-glow)]/10 text-[var(--orbit-glow)]"
                      : "bg-[var(--orbit-glass)] text-[var(--orbit-text-muted)]"
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* ── BOARD ── */}
        <div className="flex-1 overflow-hidden">
          <div className={`h-full ${isMobile ? "overflow-y-auto p-4" : "flex overflow-x-auto overflow-y-hidden gap-4 p-4 md:p-6"}`}>
            {STAGES.map((stage) => {
              if (isMobile && activeTab !== stage.key) return null;
              const colLeads = leadsByStage[stage.key];

              return (
                <div
                  key={stage.key}
                  className={`flex flex-col shrink-0 ${isMobile ? "w-full mb-8" : "w-[255px] lg:w-[275px]"}`}
                >
                  {/* Column header */}
                  <div className="flex items-center justify-between mb-3 px-0.5">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-1.5 h-4 rounded-full"
                        style={{ backgroundColor: stage.color, boxShadow: `0 0 8px ${stage.color}60` }}
                      />
                      <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--orbit-text)]">
                        {stage.label}
                      </span>
                    </div>
                    <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-lg bg-[var(--orbit-glass)] border border-[var(--orbit-glass-border)] text-[var(--orbit-text-muted)]">
                      {colLeads.length}
                    </span>
                  </div>

                  {/* Cards */}
                  <div className="flex-1 overflow-y-auto space-y-2 pb-4 custom-scrollbar">
                    <AnimatePresence>
                      {colLeads.map((lead, i) => (
                        <PipelineCard
                          key={lead.id}
                          lead={lead}
                          color={stage.color}
                          index={i}
                          onClick={() => openLeadPanel(lead.id)}
                        />
                      ))}
                    </AnimatePresence>

                    {colLeads.length === 0 && (
                      <div className="rounded-xl border-2 border-dashed border-[var(--orbit-glass-border)] p-8 flex items-center justify-center">
                        <span className="text-[10px] text-[var(--orbit-text-muted)] font-medium">Vazio</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {selectedLeadId && (
        <LeadCognitiveConsole
          leadId={selectedLeadId}
          isOpen={isLeadPanelOpen}
          onClose={closeLeadPanel}
        />
      )}
    </div>
  );
}

// ─── Root export ──────────────────────────────────────────────────────────────
export default function PipelinePage() {
  return (
    <OrbitProvider>
      <PipelineContent />
    </OrbitProvider>
  );
}

// ─── Pipeline Card ────────────────────────────────────────────────────────────
function PipelineCard({
  lead, color, index, onClick
}: {
  lead: PipelineLead;
  color: string;
  index: number;
  onClick: () => void;
}) {
  const isUrgent = lead.urgency >= 4;
  const isPendingAI = lead.last_ai_analysis_at && lead.last_human_action_at
    ? new Date(lead.last_ai_analysis_at) > new Date(lead.last_human_action_at)
    : false;
  const isRecent = lead.last_interaction_at
    ? (Date.now() - new Date(lead.last_interaction_at).getTime()) < 3600000
    : false;

  const mom = lead.momentum_score;
  const MomIcon = mom > 60 ? ArrowUp : mom < 30 ? ArrowDown : ArrowRight;
  const momColor = mom > 60 ? "#34d399" : mom < 30 ? "#f87171" : "#fbbf24";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ delay: index * 0.025, duration: 0.18 }}
      whileHover={{ y: -1, transition: { duration: 0.12 } }}
      onClick={onClick}
      className={`
        relative cursor-pointer rounded-xl overflow-hidden group
        bg-[var(--orbit-bg-secondary)]
        border border-[var(--orbit-glass-border)]
        hover:border-[var(--orbit-glow)]/20
        shadow-[var(--orbit-shadow)]
        hover:shadow-[var(--orbit-shadow-hover)]
        transition-all duration-200
        ${isUrgent ? "border-t-rose-500/30" : ""}
      `}
    >
      {/* Urgency top bar */}
      {isUrgent && (
        <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-rose-500 to-orange-400" />
      )}

      {/* Stage left stripe */}
      <div
        className="absolute left-0 inset-y-0 w-[3px]"
        style={{ backgroundColor: color, opacity: 0.7 }}
      />

      <div className="pl-[14px] pr-3.5 py-3 flex flex-col gap-2.5">

        {/* Row 1: Avatar + name + momentum */}
        <div className="flex items-center gap-2.5">
          {/* Avatar */}
          <div className="relative shrink-0">
            <div
              className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center text-[10px] font-bold"
              style={{
                background: `linear-gradient(135deg, ${color}25 0%, ${color}10 100%)`,
                color,
                border: `1.5px solid ${color}35`,
              }}
            >
              {lead.photo_url
                ? <img src={lead.photo_url} className="w-full h-full object-cover" alt="" />
                : getInitials(lead.name)
              }
            </div>
            {isPendingAI && (
              <div
                className="absolute -inset-[3px] rounded-full border border-dashed animate-[spin_6s_linear_infinite] pointer-events-none"
                style={{ borderColor: `${color}50` }}
              />
            )}
            {isRecent && (
              <div
                className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border-[1.5px] border-[var(--orbit-bg-secondary)]"
                style={{ backgroundColor: color }}
              />
            )}
          </div>

          {/* Name + time */}
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-[var(--orbit-text)] truncate leading-tight">
              {lead.name}
            </p>
            <div className="flex items-center gap-1 mt-0.5">
              <Clock className="w-2.5 h-2.5 text-[var(--orbit-text-muted)] shrink-0" />
              <span className="text-[10px] text-[var(--orbit-text-muted)]">
                {formatRelativeShort(lead.last_interaction_at)}
              </span>
              {isUrgent && (
                <span className="ml-1 text-[8px] font-bold px-1 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/15 uppercase tracking-wide">
                  urgente
                </span>
              )}
            </div>
          </div>

          {/* Momentum chip */}
          <div className="flex items-center gap-1 px-1.5 py-1 rounded-lg shrink-0 bg-[var(--orbit-glass)] border border-[var(--orbit-glass-border)]">
            <MomIcon className="w-2.5 h-2.5" style={{ color: momColor }} />
            <span className="text-[9px] font-mono font-bold" style={{ color: momColor }}>
              {mom}
            </span>
          </div>
        </div>

        {/* Snippet */}
        {lead.snippet && (
          <p className="text-[11px] leading-relaxed line-clamp-2 italic pl-2 border-l border-[var(--orbit-glass-border)] text-[var(--orbit-text-muted)]">
            {lead.snippet}
          </p>
        )}

        {/* Interest bar */}
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--orbit-text-muted)] shrink-0 w-12">
            Interesse
          </span>
          <div className="flex-1 h-[3px] rounded-full overflow-hidden bg-[var(--orbit-glass)]">
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: color }}
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(0, Math.min(100, lead.interest_score))}%` }}
              transition={{ duration: 0.7, ease: "easeOut", delay: 0.1 + index * 0.02 }}
            />
          </div>
          <span className="text-[9px] font-mono font-bold shrink-0" style={{ color }}>
            {lead.interest_score}
          </span>
        </div>

        {/* AI suggestion */}
        {lead.action_suggested && (
          <div className="flex items-start gap-2 px-2 py-1.5 rounded-lg bg-[var(--orbit-glow)]/5 border border-[var(--orbit-glow)]/10">
            <TrendingUp className="w-2.5 h-2.5 text-[var(--orbit-glow)] shrink-0 mt-0.5" />
            <p className="text-[10px] text-[var(--orbit-glow)] leading-snug line-clamp-2">
              {lead.action_suggested}
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
