"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  Send,
  RefreshCw,
  Clock,
  ChevronRight,
  Building2,
  Loader2,
  Check,
  AlertTriangle,
  Zap,
  Eye,
  Edit3,
  X,
  ArrowLeft,
  Activity,
  Target,
  ShieldCheck,
  Info,
  Waves,
} from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface SilentLead {
  id: string;
  name: string | null;
  phone: string | null;
  photo_url: string | null;
  days_silent: number;
  interest_score: number;
  momentum_score: number;
  current_state: string | null;
  silence_reason: string | null;
  strategy: string | null;
  has_fresh_analysis: boolean;
  priority_score: number;
}

interface ReengagementResult {
  message: string;
  tone: string;
  confidence: number;
  matched_properties: {
    id: string;
    title: string | null;
    value: number | null;
    location_text: string | null;
    cover_image: string | null;
  }[];
  reasoning: string;
}

interface LeadCardState {
  status: "idle" | "analyzing" | "generating" | "ready" | "sending" | "sent" | "error";
  silenceAnalysis: any | null;
  reengagement: ReengagementResult | null;
  editedMessage: string;
  error: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const OBSIDIAN_GLASS = "bg-[#05060b]/60 backdrop-blur-3xl border border-white/5 shadow-[0_8px_32px_rgba(0,0,0,0.8)]";
const SURGICAL_BLUE = "#2ec5ff";
const URGENT_RED = "#ff4d4d";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string | null) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const REASON_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  PRICE_FRICTION: { label: "Atrito de Preço", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20", icon: <Zap className="w-3 h-3" /> },
  TIMING: { label: "Timing Errado", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20", icon: <Clock className="w-3 h-3" /> },
  TRUST_GAP: { label: "Confiança Fraca", color: "text-violet-400", bg: "bg-violet-500/10 border-violet-500/20", icon: <ShieldCheck className="w-3 h-3" /> },
  LOW_INTENT: { label: "Intenção Baixa", color: "text-slate-400", bg: "bg-slate-500/10 border-slate-500/20", icon: <Target className="w-3 h-3" /> },
  OVERWHELM: { label: "Sobrecarga", color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20", icon: <Activity className="w-3 h-3" /> },
  MISALIGNMENT: { label: "Desalinhamento", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20", icon: <AlertTriangle className="w-3 h-3" /> },
  COMPETITOR: { label: "Concorrência", color: "text-rose-400", bg: "bg-rose-500/10 border-rose-500/20", icon: <Zap className="w-3 h-3" /> },
};

// ─── Components ─────────────────────────────────────────────────────────────

function BiometricPulse({ score, critical }: { score: number; critical: boolean }) {
  return (
    <div className="relative w-16 h-8 flex items-center justify-center overflow-hidden">
        <svg viewBox="0 0 100 40" className="w-full h-full">
            <motion.path
                d="M 0 20 L 20 20 L 30 5 L 40 35 L 50 20 L 70 20 L 80 15 L 90 25 L 100 20"
                fill="transparent"
                stroke={critical ? URGENT_RED : SURGICAL_BLUE}
                strokeWidth="2"
                initial={{ pathLength: 0, opacity: 0.2 }}
                animate={{ 
                    pathLength: [0, 1, 1],
                    pathOffset: [0, 0, 1],
                    opacity: [0.2, 1, 0.2]
                }}
                transition={{ 
                    duration: 2, 
                    repeat: Infinity,
                    ease: "linear"
                }}
            />
        </svg>
    </div>
  );
}

function RiskMeter({ value, label }: { value: number; label: string }) {
    const color = value > 80 ? "bg-emerald-500" : value > 50 ? "bg-blue-500" : "bg-amber-500";
    return (
        <div className="flex-1">
            <div className="flex justify-between items-center mb-1.5">
                <span className="text-[10px] uppercase font-bold tracking-widest text-white/30">{label}</span>
                <span className="text-[10px] font-mono text-white/60">{value}%</span>
            </div>
            <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${value}%` }}
                    className={`h-full ${color} shadow-[0_0_10px_rgba(46,197,255,0.3)]`}
                />
            </div>
        </div>
    );
}

function LeadDossier({ lead, onSent }: { lead: SilentLead; onSent: (id: string) => void }) {
  const [state, setState] = useState<LeadCardState>({
    status: "idle",
    silenceAnalysis: null,
    reengagement: null,
    editedMessage: "",
    error: null,
  });

  const [isEditing, setIsEditing] = useState(false);
  const isCritical = lead.days_silent > 7 || lead.momentum_score < 30;

  const handleProcess = async () => {
    setState(s => ({ ...s, status: "analyzing", error: null }));
    try {
      const analysisRes = await fetch(`/api/lead/${lead.id}/silence-analysis`, { method: "POST" });
      const analysis = await analysisRes.json();
      if (analysis.error) throw new Error(analysis.error);

      setState(s => ({ ...s, status: "generating", silenceAnalysis: analysis }));

      const reengRes = await fetch(`/api/lead/${lead.id}/reengagement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ silence_analysis: analysis }),
      });
      const reeng = await reengRes.json();
      if (reeng.error) throw new Error(reeng.error);

      setState(s => ({ ...s, status: "ready", reengagement: reeng, editedMessage: reeng.message }));
    } catch (err: any) {
      setState(s => ({ ...s, status: "error", error: err.message }));
    }
  };

  const handleSend = async () => {
    setState(s => ({ ...s, status: "sending" }));
    try {
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: lead.phone,
          message: state.editedMessage,
          leadId: lead.id
        })
      });

      if (!res.ok) throw new Error("Falha no envio");

      await fetch(`/api/lead/${lead.id}/reengagement`, {
        method: "PATCH",
        body: JSON.stringify({ sent_at_hour: new Date().getHours() })
      });

      setState(s => ({ ...s, status: "sent" }));
      setTimeout(() => onSent(lead.id), 2000);
    } catch (err: any) {
      setState(s => ({ ...s, status: "error", error: err.message }));
    }
  };

  const reasonConfig = lead.silence_reason ? REASON_CONFIG[lead.silence_reason] : null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`relative group p-6 rounded-3xl ${OBSIDIAN_GLASS} transition-all duration-500 hover:border-white/10`}
    >
      {isCritical && (
          <div className="absolute -top-px -left-px w-12 h-12 overflow-hidden rounded-tl-3xl pointer-events-none">
              <div className="absolute top-0 left-0 w-[200%] h-4 bg-red-500/50 -rotate-45 -translate-x-1/2 -translate-y-1/2 blur-lg" />
          </div>
      )}

      {/* Header Bio */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
                {lead.photo_url && !state.error ? (
                    <img 
                      src={lead.photo_url} 
                      alt="" 
                      className="w-full h-full object-cover"
                      onError={() => setState(s => ({ ...s, silenceAnalysis: { photo_error: true } }))} 
                    />
                ) : (
                    <span className="text-xl font-bold text-white/40 tracking-tighter">{getInitials(lead.name)}</span>
                )}
                {state.silenceAnalysis?.photo_error && (
                   <span className="text-xl font-bold text-white/40 tracking-tighter">{getInitials(lead.name)}</span>
                )}
            </div>
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-[#05060b] rounded-full border border-white/10 flex items-center justify-center">
                <div className={`w-1.5 h-1.5 rounded-full ${isCritical ? "bg-red-500 animate-pulse" : "bg-emerald-500"}`} />
            </div>
          </div>
          <div>
            <h3 className="text-lg font-bold tracking-tight text-white/90 leading-tight">
                {lead.name?.split(' ')[0]} <span className="text-white/40 font-light">{lead.name?.split(' ').slice(1).join(' ')}</span>
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <Activity className="w-3 h-3 text-white/30" />
              <span className="text-[10px] font-mono text-white/40 uppercase tracking-widest leading-none">
                Silence: {lead.days_silent}d
              </span>
            </div>
          </div>
        </div>
        
        {reasonConfig && (
          <div className={`px-3 py-1.5 rounded-xl border ${reasonConfig.bg} ${reasonConfig.color} flex items-center gap-2 transition-transform duration-300 group-hover:scale-105`}>
            {reasonConfig.icon}
            <span className="text-[9px] font-bold uppercase tracking-[0.15em]">{reasonConfig.label}</span>
          </div>
        )}
      </div>

      {/* Biometrics */}
      <div className="mt-8 flex items-end gap-6">
        <div className="flex-1 flex flex-col gap-4">
            <RiskMeter value={lead.interest_score} label="Interesse" />
            <RiskMeter value={lead.momentum_score} label="Momentum" />
        </div>
        <div className="flex flex-col items-center gap-1">
            <BiometricPulse score={lead.interest_score} critical={isCritical} />
            <span className="text-[8px] font-mono text-white/20 uppercase tracking-widest underline decoration-white/10 underline-offset-4">Pulse Analysis</span>
        </div>
      </div>

      {/* Action Zone */}
      <div className="mt-8 pt-6 border-t border-white/5">
        <AnimatePresence mode="wait">
          {state.status === "idle" && (
            <motion.button
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleProcess}
              className="w-full py-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-bold text-[10px] uppercase tracking-[0.2em] border border-white/5 transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
            >
              <Brain className="w-4 h-4 text-blue-400" />
              Interceptar Silêncio
            </motion.button>
          )}

          {(state.status === "analyzing" || state.status === "generating") && (
            <motion.div 
                key="loading"
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-full h-[58px] flex flex-col items-center justify-center gap-2 bg-blue-500/5 rounded-2xl border border-blue-500/10 relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-500/10 to-transparent -translate-x-full animate-[shimmer_2s_infinite] transition-transform" style={{ animationTimingFunction: 'linear' }} />
              <div className="flex items-center gap-3">
                  <div className="relative">
                      <div className="w-2 h-2 rounded-full bg-blue-500 animate-ping absolute inset-0" />
                      <div className="w-2 h-2 rounded-full bg-blue-500 relative" />
                  </div>
                  <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-blue-400">
                    {state.status === "analyzing" ? "Lendo Biometria..." : "Sincronizando Resposta..."}
                  </span>
              </div>
            </motion.div>
          )}

          {state.status === "ready" && state.reengagement && (
            <motion.div 
                key="ready"
                initial={{ opacity: 0, y: 10 }} 
                animate={{ opacity: 1, y: 0 }} 
                className="space-y-4"
            >
              <div className="relative p-5 rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden">
                <div className="absolute top-0 right-0 p-3 flex gap-2">
                    <button onClick={() => setIsEditing(!isEditing)} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                        {isEditing ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Edit3 className="w-3.5 h-3.5 text-white/40" />}
                    </button>
                    <Info className="w-3.5 h-3.5 text-white/20 mt-1.5" />
                </div>
                
                <span className="text-[9px] font-bold uppercase tracking-widest text-blue-400 mb-3 block">
                    Tom sugerido: <span className="text-white/60">{state.reengagement.tone}</span>
                </span>
                
                {isEditing ? (
                    <textarea 
                        value={state.editedMessage} 
                        onChange={e => setState(s => ({ ...s, editedMessage: e.target.value }))}
                        className="w-full bg-transparent border-none focus:ring-0 text-sm font-light text-white/80 leading-relaxed resize-none h-24 p-0"
                    />
                ) : (
                    <p className="text-sm font-light text-white/80 leading-relaxed italic">
                        "{state.editedMessage}"
                    </p>
                )}
              </div>
              
              <button 
                onClick={handleSend}
                className="w-full py-4 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-2xl font-bold text-[10px] uppercase tracking-[0.2em] border border-emerald-500/20 transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
              >
                <Send className="w-3.5 h-3.5" /> Transmitir via WhatsApp
              </button>
            </motion.div>
          )}

          {state.status === "sent" && (
            <motion.div 
                key="sent"
                initial={{ scale: 0.9, opacity: 0 }} 
                animate={{ scale: 1, opacity: 1 }}
                className="w-full py-4 flex items-center justify-center gap-3 text-emerald-400 font-bold text-[10px] uppercase tracking-[0.3em] bg-emerald-500/5 border border-emerald-400/20 rounded-2xl"
            >
              <Check className="w-4 h-4" /> Transmissão Concluída
            </motion.div>
          )}

          {state.status === "error" && (
            <motion.div 
                key="error"
                initial={{ x: 10, opacity: 0 }} 
                animate={{ x: 0, opacity: 1 }}
                className="w-full p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3"
            >
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <div className="flex-1">
                  <p className="text-[9px] font-bold text-red-500 uppercase tracking-widest">Erro de Sistema</p>
                  <p className="text-[10px] text-white/40">{state.error}</p>
              </div>
              <button onClick={() => setState(s => ({ ...s, status: "idle" }))} className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 transition-colors">
                  <RefreshCw className="w-3 h-3" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ─── Página Principal ─────────────────────────────────────────────────────────

export default function SilenceAnalysisPage() {
  const [leads, setLeads] = useState<SilentLead[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLeads = async () => {
    try {
      const res = await fetch("/api/leads/silent");
      const data = await res.json();
      setLeads(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLeads(); }, []);

  const handleSent = (id: string) => {
    setLeads(l => l.filter(lead => lead.id !== id));
  };

  const criticalCount = useMemo(() => leads.filter(l => l.days_silent > 7).length, [leads]);

  return (
    <div className="min-h-screen bg-[#020306] selection:bg-blue-500/30 text-white font-sans overflow-x-hidden">
      {/* Dynamic Background */}
      <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-500/10 blur-[120px] rounded-full animate-pulse" />
          <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-emerald-500/5 blur-[120px] rounded-full" />
          <div className="absolute inset-0 bg-[#020306]/40 backdrop-blur-[2px]" />
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none select-none mix-blend-overlay" 
               style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }} />
      </div>

      <header className="max-w-7xl mx-auto px-8 pt-12 pb-20 relative flex flex-col md:flex-row items-end justify-between gap-8">
        <div>
            <Link href="/atlas" className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.3em] text-white/30 hover:text-white/100 transition-all mb-8 group">
                <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-1" />
                Regressar ao Atlas
            </Link>
            <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-px bg-gradient-to-r from-blue-500 to-transparent" />
                <span className="text-[10px] font-bold uppercase tracking-[0.5em] text-blue-400">Core Awareness</span>
            </div>
            <h1 className="text-5xl md:text-6xl font-black tracking-tighter text-white">
                Análise de <span className="text-white/20 italic">Silêncio</span>
            </h1>
        </div>
        
        <div className="flex gap-4 md:text-right">
            <div className="px-6 py-4 rounded-3xl bg-white/[0.02] border border-white/5 backdrop-blur-md">
                <p className="text-[10px] uppercase font-bold tracking-widest text-white/30 mb-1">Impacto Crítico</p>
                <div className="flex items-center gap-3">
                    <span className="text-3xl font-black text-white">{criticalCount}</span>
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                </div>
            </div>
            <div className="px-6 py-4 rounded-3xl bg-white/[0.02] border border-white/5 backdrop-blur-md">
                <p className="text-[10px] uppercase font-bold tracking-widest text-white/30 mb-1">Leads Detectados</p>
                <span className="text-3xl font-black text-white/60">{loading ? "..." : leads.length}</span>
            </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-8 pb-32 relative">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-40 gap-6">
            <div className="relative">
                <Loader2 className="w-12 h-12 animate-spin text-blue-500/20" strokeWidth={1} />
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-1 h-1 rounded-full bg-blue-500 animate-pulse" />
                </div>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-white/20 animate-pulse">Varrendo Sistema...</p>
          </div>
        ) : leads.length === 0 ? (
          <div className="text-center py-40 bg-white/[0.01] border border-white/[0.03] rounded-[40px] border-dashed">
            <div className="relative w-20 h-20 mx-auto mb-8">
                <Waves className="w-full h-full text-white/10" strokeWidth={0.5} />
                <motion.div 
                    animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.3, 0.1] }}
                    transition={{ duration: 4, repeat: Infinity }}
                    className="absolute inset-0 bg-blue-500/20 blur-3xl rounded-full" 
                />
            </div>
            <h2 className="text-2xl font-bold text-white/40 tracking-tight">Vácuo Indetectado</h2>
            <p className="text-xs text-white/20 uppercase tracking-[0.2em] mt-2">Nenhuma anomalia de comunicação no radar.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <AnimatePresence mode="popLayout">
              {leads.map((lead, index) => (
                <motion.div
                    key={lead.id}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ delay: index * 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                >
                    <LeadDossier lead={lead} onSent={handleSent} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>

      <style jsx global>{`
        @keyframes shimmer {
          100% {
            transform: translateX(100%);
          }
        }
        ::selection {
          background: rgba(46, 197, 255, 0.2);
          color: #2ec5ff;
        }
      `}</style>
    </div>
  );
}
