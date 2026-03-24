"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
  emotional_state: string | null;
  analysis_confidence: number | null;
  has_fresh_analysis: boolean;
  priority_score: number;
}

interface ReengagementResult {
  message: string;
  tone: string;
  silence_reason: string;
  strategy: string;
  should_include_properties: boolean;
  matched_properties: {
    id: string;
    title: string | null;
    value: number | null;
    location_text: string | null;
    cover_image: string | null;
  }[];
  confidence: number;
  next_step_if_reply: string;
  next_step_if_ignore: string;
  reasoning: string;
}

interface LeadCardState {
  status: "idle" | "analyzing" | "generating" | "ready" | "sending" | "sent" | "error";
  silenceAnalysis: any | null;
  reengagement: ReengagementResult | null;
  editedMessage: string;
  error: string | null;
}

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

function formatDays(days: number): string {
  if (days === 1) return "1 dia";
  if (days < 7) return `${days} dias`;
  if (days < 14) return "1 semana";
  if (days < 30) return `${Math.floor(days / 7)} semanas`;
  return `${Math.floor(days / 30)} ${Math.floor(days / 30) === 1 ? "mês" : "meses"}`;
}

function formatValue(v: number | null) {
  if (!v) return "";
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `R$ ${Math.round(v / 1_000)}k`;
  return `R$ ${v}`;
}

const REASON_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; icon: string }
> = {
  PRICE_FRICTION: {
    label: "Atrito de Preço",
    color: "text-amber-400",
    bg: "bg-amber-500/8 border-amber-500/20",
    icon: "💰",
  },
  TIMING: {
    label: "Timing Errado",
    color: "text-blue-400",
    bg: "bg-blue-500/8 border-blue-500/20",
    icon: "⏳",
  },
  TRUST_GAP: {
    label: "Confiança Fraca",
    color: "text-violet-400",
    bg: "bg-violet-500/8 border-violet-500/20",
    icon: "🤝",
  },
  LOW_INTENT: {
    label: "Intenção Baixa",
    color: "text-slate-400",
    bg: "bg-slate-500/8 border-slate-500/20",
    icon: "📉",
  },
  OVERWHELM: {
    label: "Sobrecarga",
    color: "text-orange-400",
    bg: "bg-orange-500/8 border-orange-500/20",
    icon: "🌀",
  },
  MISALIGNMENT: {
    label: "Desalinhamento",
    color: "text-red-400",
    bg: "bg-red-500/8 border-red-500/20",
    icon: "↔️",
  },
  COMPETING_OFFER: {
    label: "Concorrência",
    color: "text-rose-400",
    bg: "bg-rose-500/8 border-rose-500/20",
    icon: "⚡",
  },
};

const TONE_LABELS: Record<string, string> = {
  casual: "casual",
  curiosity: "curiosidade",
  direct: "direto",
  reconnect: "reconexão",
  value_anchor: "ancora de valor",
};

// ─── Silence Pulse Visualization ─────────────────────────────────────────────

function SilencePulse({ days, score }: { days: number; score: number }) {
  const intensity = Math.min(1, score / 100);
  const bars = 12;

  return (
    <div className="flex items-end gap-0.5 h-8">
      {Array.from({ length: bars }).map((_, i) => {
        const pos = i / (bars - 1);
        const isSilent = pos > 0.6;
        const height = isSilent
          ? Math.random() * 20 + 5
          : 20 + Math.sin(pos * Math.PI * 2) * 15 * intensity;
        return (
          <div
            key={i}
            className={`w-0.5 rounded-full transition-all duration-700 ${
              isSilent ? "bg-white/10" : "bg-[var(--orbit-glow)]/40"
            }`}
            style={{ height: `${Math.max(4, height)}px` }}
          />
        );
      })}
    </div>
  );
}

// ─── Lead Card ────────────────────────────────────────────────────────────────

function LeadCard({
  lead,
  onSent,
}: {
  lead: SilentLead;
  onSent: (leadId: string) => void;
}) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const [state, setState] = useState<LeadCardState>({
    status: lead.has_fresh_analysis ? "idle" : "idle",
    silenceAnalysis: null,
    reengagement: null,
    editedMessage: "",
    error: null,
  });

  const [showReasoning, setShowReasoning] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const reasonConfig = lead.silence_reason
    ? REASON_CONFIG[lead.silence_reason]
    : null;

  const handleAnalyzeAndGenerate = useCallback(async () => {
    setState((s) => ({ ...s, status: "analyzing", error: null }));

    try {
      // Step 1: Run silence analysis
      const analysisRes = await fetch(
        `/api/lead/${lead.id}/silence-analysis`,
        { method: "POST" }
      );
      if (!analysisRes.ok) throw new Error("Falha na análise de silêncio");
      const analysis = await analysisRes.json();

      setState((s) => ({
        ...s,
        status: "generating",
        silenceAnalysis: analysis,
      }));

      // Step 2: Generate reengagement message
      const reengRes = await fetch(`/api/lead/${lead.id}/reengagement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ silence_analysis: analysis }),
      });
      if (!reengRes.ok) throw new Error("Falha na geração da mensagem");
      const reeng = await reengRes.json();

      setState((s) => ({
        ...s,
        status: "ready",
        reengagement: reeng,
        editedMessage: reeng.message,
      }));
    } catch (err: any) {
      setState((s) => ({
        ...s,
        status: "error",
        error: err.message,
      }));
    }
  }, [lead.id]);

  const handleSend = useCallback(async () => {
    if (!state.editedMessage.trim()) return;
    setState((s) => ({ ...s, status: "sending" }));

    try {
      const sendTo = lead.phone;
      if (!sendTo) throw new Error("Sem número de telefone cadastrado");

      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: sendTo,
          message: state.editedMessage.trim(),
          leadId: lead.id,
        }),
      });

      if (!res.ok) throw new Error("Falha ao enviar WhatsApp");

      // Log the send hour for learning
      await fetch(`/api/lead/${lead.id}/reengagement`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sent_at_hour: new Date().getHours(),
        }),
      });

      setState((s) => ({ ...s, status: "sent" }));
      setTimeout(() => onSent(lead.id), 1500);
    } catch (err: any) {
      setState((s) => ({ ...s, status: "error", error: err.message }));
    }
  }, [state.editedMessage, lead.id, lead.phone, onSent]);

  const isLoading =
    state.status === "analyzing" || state.status === "generating";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, y: -8 }}
      className={`relative overflow-hidden rounded-2xl border transition-all duration-500 ${
        state.status === "sent"
          ? "border-emerald-500/30 bg-emerald-500/5"
          : isDark
          ? "bg-[#080810] border-white/[0.07] hover:border-white/[0.12]"
          : "bg-white border-[var(--orbit-line)] hover:border-[var(--orbit-glow)]/30 shadow-sm hover:shadow-[var(--orbit-shadow)]"
      }`}
    >
      {/* Priority glow for high-score leads */}
      {lead.priority_score >= 70 && state.status === "idle" && (
        <div className="absolute inset-0 rounded-2xl opacity-20 pointer-events-none bg-gradient-to-r from-[var(--orbit-glow)]/20 via-transparent to-transparent" />
      )}

      <div className="p-5 flex flex-col gap-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div
                className={`w-11 h-11 rounded-full border overflow-hidden flex items-center justify-center text-sm font-bold ${
                  isDark
                    ? "border-white/10 bg-[var(--orbit-glow)]/10 text-[var(--orbit-glow)]"
                    : "border-[var(--orbit-line)] bg-[var(--orbit-glow)]/5 text-[var(--orbit-glow)]"
                }`}
              >
                {lead.photo_url ? (
                  <img
                    src={lead.photo_url}
                    className="w-full h-full object-cover"
                    alt=""
                  />
                ) : (
                  getInitials(lead.name)
                )}
              </div>
              {/* Silence indicator ring */}
              <div
                className="absolute -inset-1 rounded-full opacity-30"
                style={{
                  background: `conic-gradient(transparent ${
                    (1 - Math.min(1, lead.days_silent / 30)) * 360
                  }deg, var(--orbit-glow) 0deg)`,
                }}
              />
            </div>

            <div>
              <p
                className={`font-semibold text-sm ${
                  isDark ? "text-white" : "text-[var(--orbit-text)]"
                }`}
              >
                {lead.name || "Lead sem nome"}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <Clock
                  className={`w-3 h-3 ${
                    isDark ? "text-slate-500" : "text-[var(--orbit-text-muted)]"
                  }`}
                />
                <span
                  className={`text-[10px] font-mono ${
                    isDark ? "text-slate-500" : "text-[var(--orbit-text-muted)]"
                  }`}
                >
                  Silêncio há {formatDays(lead.days_silent)}
                </span>
              </div>
            </div>
          </div>

          {/* Reason badge */}
          {reasonConfig && (
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider shrink-0 ${reasonConfig.bg} ${reasonConfig.color}`}
            >
              <span>{reasonConfig.icon}</span>
              {reasonConfig.label}
            </div>
          )}
        </div>

        {/* Scores row + silence visualization */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <p
                className={`text-[9px] uppercase tracking-widest font-bold mb-1 ${
                  isDark ? "text-slate-600" : "text-[var(--orbit-text-muted)]"
                }`}
              >
                Interesse
              </p>
              <div className="flex items-center gap-2">
                <div
                  className={`h-1 w-16 rounded-full overflow-hidden ${
                    isDark ? "bg-white/5" : "bg-gray-100"
                  }`}
                >
                  <div
                    className="h-full bg-[var(--orbit-glow)] rounded-full"
                    style={{ width: `${lead.interest_score}%` }}
                  />
                </div>
                <span
                  className={`text-[10px] font-mono ${
                    isDark ? "text-slate-400" : "text-[var(--orbit-text-muted)]"
                  }`}
                >
                  {lead.interest_score}%
                </span>
              </div>
            </div>
            <div>
              <p
                className={`text-[9px] uppercase tracking-widest font-bold mb-1 ${
                  isDark ? "text-slate-600" : "text-[var(--orbit-text-muted)]"
                }`}
              >
                Momentum
              </p>
              <div className="flex items-center gap-2">
                <div
                  className={`h-1 w-16 rounded-full overflow-hidden ${
                    isDark ? "bg-white/5" : "bg-gray-100"
                  }`}
                >
                  <div
                    className="h-full bg-[var(--orbit-glow)]/50 rounded-full"
                    style={{ width: `${lead.momentum_score}%` }}
                  />
                </div>
                <span
                  className={`text-[10px] font-mono ${
                    isDark ? "text-slate-400" : "text-[var(--orbit-text-muted)]"
                  }`}
                >
                  {lead.momentum_score}%
                </span>
              </div>
            </div>
          </div>

          <SilencePulse days={lead.days_silent} score={lead.interest_score} />
        </div>

        {/* Strategy tag (if analysis exists) */}
        {lead.strategy && (
          <p
            className={`text-[10px] ${
              isDark ? "text-slate-600" : "text-[var(--orbit-text-muted)]"
            }`}
          >
            Estratégia:{" "}
            <span
              className={isDark ? "text-slate-400" : "text-[var(--orbit-text)]"}
            >
              {lead.strategy.replace(/_/g, " ").toLowerCase()}
            </span>
          </p>
        )}

        {/* ── CTA or generated message ── */}
        <AnimatePresence mode="wait">
          {state.status === "idle" && (
            <div className="flex flex-col gap-2">
              <button
                disabled
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-[11px] uppercase tracking-widest transition-all cursor-not-allowed opacity-50 ${
                  isDark
                    ? "bg-white/5 border border-white/10 text-slate-500"
                    : "bg-gray-100 border border-gray-200 text-gray-400"
                }`}
              >
                <Brain className="w-3.5 h-3.5" />
                Análise de Silêncio Inativa
              </button>
              <div className={`flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg border ${
                isDark ? "bg-amber-500/5 border-amber-500/10 text-amber-500/80" : "bg-amber-50 border-amber-200 text-amber-600"
              }`}>
                <AlertTriangle className="w-3 h-3" />
                <span className="text-[10px] font-medium">IA Desconectada por Governança</span>
              </div>
            </div>
          )}

          {isLoading && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={`flex items-center gap-3 py-3 px-4 rounded-xl border ${
                isDark
                  ? "bg-[var(--orbit-glow)]/5 border-[var(--orbit-glow)]/10"
                  : "bg-[var(--orbit-glow)]/5 border-[var(--orbit-glow)]/10"
              }`}
            >
              <Loader2 className="w-4 h-4 animate-spin text-[var(--orbit-glow)]" />
              <div>
                <p
                  className={`text-xs font-bold ${
                    isDark ? "text-[var(--orbit-glow)]" : "text-[var(--orbit-glow)]"
                  }`}
                >
                  {state.status === "analyzing"
                    ? "Lendo o silêncio..."
                    : "Construindo a mensagem..."}
                </p>
                <p
                  className={`text-[10px] ${
                    isDark ? "text-slate-600" : "text-[var(--orbit-text-muted)]"
                  }`}
                >
                  {state.status === "analyzing"
                    ? "Analisando contexto + estado cognitivo"
                    : "Cruzando com o acervo Atlas"}
                </p>
              </div>
            </motion.div>
          )}

          {state.status === "ready" && state.reengagement && (
            <motion.div
              key="ready"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-col gap-3"
            >
              {/* Message box */}
              <div
                className={`rounded-xl border p-4 ${
                  isDark
                    ? "bg-white/[0.03] border-white/[0.08]"
                    : "bg-[var(--orbit-bg-secondary)] border-[var(--orbit-line)]"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[9px] uppercase tracking-widest font-bold ${
                        isDark
                          ? "text-[var(--orbit-glow)]/70"
                          : "text-[var(--orbit-glow)]"
                      }`}
                    >
                      {TONE_LABELS[state.reengagement.tone] || state.reengagement.tone}
                    </span>
                    {state.reengagement.confidence >= 0.7 && (
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded-full border ${
                          isDark
                            ? "text-emerald-400 border-emerald-500/20 bg-emerald-500/8"
                            : "text-emerald-600 border-emerald-500/20 bg-emerald-50"
                        }`}
                      >
                        {Math.round(state.reengagement.confidence * 100)}% confiança
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setIsEditing(!isEditing)}
                    className={`text-[10px] flex items-center gap-1 transition-colors ${
                      isDark
                        ? "text-slate-600 hover:text-slate-300"
                        : "text-[var(--orbit-text-muted)] hover:text-[var(--orbit-text)]"
                    }`}
                  >
                    <Edit3 className="w-3 h-3" />
                    {isEditing ? "ok" : "editar"}
                  </button>
                </div>

                {isEditing ? (
                  <textarea
                    value={state.editedMessage}
                    onChange={(e) =>
                      setState((s) => ({
                        ...s,
                        editedMessage: e.target.value,
                      }))
                    }
                    rows={4}
                    className={`w-full text-sm bg-transparent focus:outline-none resize-none leading-relaxed ${
                      isDark ? "text-slate-100" : "text-[var(--orbit-text)]"
                    }`}
                    autoFocus
                  />
                ) : (
                  <p
                    className={`text-sm leading-relaxed whitespace-pre-wrap ${
                      isDark ? "text-slate-200" : "text-[var(--orbit-text)]"
                    }`}
                  >
                    {state.editedMessage}
                  </p>
                )}
              </div>

              {/* Matched properties (if any) */}
              {state.reengagement.matched_properties.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {state.reengagement.matched_properties.map((p) => (
                    <div
                      key={p.id}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border shrink-0 ${
                        isDark
                          ? "bg-white/4 border-white/8"
                          : "bg-[var(--orbit-bg)] border-[var(--orbit-line)]"
                      }`}
                    >
                      <Building2 className="w-3 h-3 text-[var(--orbit-glow)] shrink-0" />
                      <div>
                        <p
                          className={`text-[10px] font-medium truncate max-w-[120px] ${
                            isDark ? "text-slate-300" : "text-[var(--orbit-text)]"
                          }`}
                        >
                          {p.title}
                        </p>
                        {p.value && (
                          <p className="text-[9px] text-[var(--orbit-glow)]/70 font-mono">
                            {formatValue(p.value)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Reasoning toggle */}
              <button
                onClick={() => setShowReasoning(!showReasoning)}
                className={`flex items-center gap-1.5 text-[10px] transition-colors ${
                  isDark
                    ? "text-slate-600 hover:text-slate-400"
                    : "text-[var(--orbit-text-muted)] hover:text-[var(--orbit-text)]"
                }`}
              >
                <Eye className="w-3 h-3" />
                {showReasoning ? "Ocultar raciocínio" : "Ver raciocínio da IA"}
                <ChevronRight
                  className={`w-3 h-3 transition-transform ${
                    showReasoning ? "rotate-90" : ""
                  }`}
                />
              </button>

              <AnimatePresence>
                {showReasoning && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div
                      className={`p-3 rounded-xl border-l-2 text-[11px] leading-relaxed ${
                        isDark
                          ? "border-[var(--orbit-glow)]/30 bg-[var(--orbit-glow)]/4 text-slate-400"
                          : "border-[var(--orbit-glow)]/30 bg-[var(--orbit-glow)]/3 text-[var(--orbit-text-muted)]"
                      }`}
                    >
                      {state.reengagement.reasoning}
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div
                        className={`p-2.5 rounded-lg border text-[10px] ${
                          isDark
                            ? "bg-white/3 border-white/5"
                            : "bg-[var(--orbit-bg-secondary)] border-[var(--orbit-line)]"
                        }`}
                      >
                        <p
                          className={`font-bold uppercase tracking-wider mb-1 text-[9px] ${
                            isDark ? "text-emerald-400" : "text-emerald-600"
                          }`}
                        >
                          Se responder
                        </p>
                        <p
                          className={
                            isDark ? "text-slate-400" : "text-[var(--orbit-text-muted)]"
                          }
                        >
                          {state.reengagement.next_step_if_reply}
                        </p>
                      </div>
                      <div
                        className={`p-2.5 rounded-lg border text-[10px] ${
                          isDark
                            ? "bg-white/3 border-white/5"
                            : "bg-[var(--orbit-bg-secondary)] border-[var(--orbit-line)]"
                        }`}
                      >
                        <p
                          className={`font-bold uppercase tracking-wider mb-1 text-[9px] ${
                            isDark ? "text-slate-500" : "text-[var(--orbit-text-muted)]"
                          }`}
                        >
                          Se ignorar
                        </p>
                        <p
                          className={
                            isDark ? "text-slate-400" : "text-[var(--orbit-text-muted)]"
                          }
                        >
                          {state.reengagement.next_step_if_ignore}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Action buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    setState((s) => ({
                      ...s,
                      status: "idle",
                      reengagement: null,
                    }))
                  }
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[10px] font-bold uppercase tracking-wider transition-all ${
                    isDark
                      ? "border-white/8 text-slate-500 hover:bg-white/5 hover:text-slate-300"
                      : "border-[var(--orbit-line)] text-[var(--orbit-text-muted)] hover:bg-gray-50"
                  }`}
                >
                  <RefreshCw className="w-3 h-3" />
                  Gerar outra
                </button>

                <button
                  onClick={handleSend}
                  disabled={!state.editedMessage.trim()}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl font-bold text-[11px] uppercase tracking-widest transition-all disabled:opacity-40 ${
                    isDark
                      ? "bg-[var(--orbit-glow)] text-black hover:brightness-110 shadow-[0_0_20px_rgba(var(--orbit-glow-rgb),0.2)]"
                      : "bg-[var(--orbit-glow)] text-white hover:brightness-110 shadow-[var(--orbit-shadow)]"
                  }`}
                >
                  <Send className="w-3.5 h-3.5" />
                  Enviar via WhatsApp
                </button>
              </div>
            </motion.div>
          )}

          {state.status === "sending" && (
            <motion.div
              key="sending"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center justify-center py-3 gap-2"
            >
              <Loader2 className="w-4 h-4 animate-spin text-[var(--orbit-glow)]" />
              <span className="text-xs text-[var(--orbit-glow)] font-mono">
                Enviando...
              </span>
            </motion.div>
          )}

          {state.status === "sent" && (
            <motion.div
              key="sent"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center justify-center py-3 gap-2"
            >
              <Check className="w-4 h-4 text-emerald-400" />
              <span className="text-xs text-emerald-400 font-bold uppercase tracking-wider">
                Mensagem enviada
              </span>
            </motion.div>
          )}

          {state.status === "error" && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2 py-2 px-3 rounded-xl bg-red-500/8 border border-red-500/20"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
              <p className="text-xs text-red-400">{state.error}</p>
              <button
                onClick={() =>
                  setState((s) => ({ ...s, status: "idle", error: null }))
                }
                className="ml-auto text-red-400/60 hover:text-red-400"
              >
                <X className="w-3 h-3" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ReengagementPage() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const [leads, setLeads] = useState<SilentLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [minDays, setMinDays] = useState(3);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/reengagement/queue?min_days=${minDays}&limit=15`
      );
      if (!res.ok) throw new Error("Falha ao carregar fila");
      const data = await res.json();
      setLeads(data.leads || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [minDays]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  const handleSent = useCallback((leadId: string) => {
    setSentIds((prev) => new Set([...prev, leadId]));
  }, []);

  const visibleLeads = leads.filter((l) => !sentIds.has(l.id));

  const urgentCount = visibleLeads.filter((l) => l.priority_score >= 70).length;
  const warmCount = visibleLeads.filter(
    (l) => l.priority_score >= 40 && l.priority_score < 70
  ).length;

  return (
    <div
      className={`min-h-screen ${
        isDark ? "bg-[#050505] text-slate-100" : "bg-[var(--orbit-bg)] text-[var(--orbit-text)]"
      }`}
    >
      {/* Background texture */}
      {isDark && (
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 60% 50% at 50% 0%, rgba(var(--orbit-glow-rgb),0.04) 0%, transparent 70%)",
          }}
        />
      )}

      <div className="relative max-w-2xl mx-auto px-4 py-8 md:py-12">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/"
            className={`flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-bold mb-6 transition-colors ${
              isDark
                ? "text-slate-600 hover:text-slate-400"
                : "text-[var(--orbit-text-muted)] hover:text-[var(--orbit-text)]"
            }`}
          >
            <ArrowLeft className="w-3 h-3" />
            Orbit
          </Link>

          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    isDark
                      ? "bg-[var(--orbit-glow)]/10 border border-[var(--orbit-glow)]/20"
                      : "bg-[var(--orbit-glow)]/8 border border-[var(--orbit-glow)]/15"
                  }`}
                >
                  <Waves className="w-4 h-4 text-[var(--orbit-glow)]" />
                </div>
                <h1
                  className={`text-xl font-bold tracking-tight ${
                    isDark ? "text-white" : "text-[var(--orbit-text)]"
                  }`}
                >
                  Leitura do Silêncio
                </h1>
              </div>
              <p
                className={`text-sm leading-relaxed max-w-md ${
                  isDark ? "text-slate-500" : "text-[var(--orbit-text-muted)]"
                }`}
              >
                O silêncio de um lead não é ausência — é uma posição. A IA
                interpreta cada silêncio e constrói a mensagem certa para o
                momento certo.
              </p>
            </div>

            <button
              onClick={fetchQueue}
              disabled={loading}
              className={`shrink-0 p-2 rounded-lg border transition-all ${
                isDark
                  ? "border-white/8 text-slate-500 hover:text-slate-300 hover:bg-white/5"
                  : "border-[var(--orbit-line)] text-[var(--orbit-text-muted)] hover:text-[var(--orbit-text)] hover:bg-gray-50"
              }`}
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              />
            </button>
          </div>

          {/* Stats strip */}
          {!loading && visibleLeads.length > 0 && (
            <div
              className={`flex items-center gap-4 mt-4 p-3 rounded-xl border ${
                isDark
                  ? "bg-white/[0.02] border-white/[0.05]"
                  : "bg-[var(--orbit-bg-secondary)] border-[var(--orbit-line)]"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span
                  className={`text-[10px] font-bold ${
                    isDark ? "text-red-400" : "text-red-500"
                  }`}
                >
                  {urgentCount} urgentes
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-amber-400" />
                <span
                  className={`text-[10px] font-bold ${
                    isDark ? "text-amber-400" : "text-amber-600"
                  }`}
                >
                  {warmCount} quentes
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <div
                  className={`w-2 h-2 rounded-full ${
                    isDark ? "bg-slate-600" : "bg-gray-300"
                  }`}
                />
                <span
                  className={`text-[10px] ${
                    isDark ? "text-slate-600" : "text-[var(--orbit-text-muted)]"
                  }`}
                >
                  {visibleLeads.length - urgentCount - warmCount} outros
                </span>
              </div>

              {/* Filter */}
              <div className="ml-auto flex items-center gap-2">
                <span
                  className={`text-[9px] uppercase tracking-widest ${
                    isDark ? "text-slate-600" : "text-[var(--orbit-text-muted)]"
                  }`}
                >
                  mín.
                </span>
                {[3, 7, 14].map((d) => (
                  <button
                    key={d}
                    onClick={() => setMinDays(d)}
                    className={`px-2 py-0.5 rounded text-[9px] font-bold transition-all ${
                      minDays === d
                        ? isDark
                          ? "bg-[var(--orbit-glow)]/15 text-[var(--orbit-glow)] border border-[var(--orbit-glow)]/20"
                          : "bg-[var(--orbit-glow)]/10 text-[var(--orbit-glow)] border border-[var(--orbit-glow)]/20"
                        : isDark
                        ? "text-slate-600 hover:text-slate-400"
                        : "text-[var(--orbit-text-muted)] hover:text-[var(--orbit-text)]"
                    }`}
                  >
                    {d}d
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-6 h-6 animate-spin text-[var(--orbit-glow)]" />
            <p
              className={`text-[10px] uppercase tracking-widest ${
                isDark ? "text-slate-600" : "text-[var(--orbit-text-muted)]"
              }`}
            >
              Varrendo o campo cognitivo...
            </p>
          </div>
        ) : visibleLeads.length === 0 ? (
          <div
            className={`text-center py-20 border-2 border-dashed rounded-2xl ${
              isDark ? "border-white/5" : "border-[var(--orbit-line)]"
            }`}
          >
            <Zap
              className={`w-8 h-8 mx-auto mb-4 ${
                isDark ? "text-[var(--orbit-glow)]/20" : "text-[var(--orbit-glow)]/30"
              }`}
            />
            <p
              className={`text-sm font-medium mb-1 ${
                isDark ? "text-slate-400" : "text-[var(--orbit-text)]"
              }`}
            >
              Todos os leads estão em contato
            </p>
            <p
              className={`text-xs ${
                isDark ? "text-slate-600" : "text-[var(--orbit-text-muted)]"
              }`}
            >
              Nenhum silêncio acima de {minDays} dias detectado
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <AnimatePresence>
              {visibleLeads.map((lead) => (
                <LeadCard key={lead.id} lead={lead} onSent={handleSent} />
              ))}
            </AnimatePresence>

            {sentIds.size > 0 && (
              <p
                className={`text-center text-xs pt-2 ${
                  isDark ? "text-slate-700" : "text-[var(--orbit-text-muted)]"
                }`}
              >
                {sentIds.size}{" "}
                {sentIds.size === 1 ? "mensagem enviada" : "mensagens enviadas"}{" "}
                nesta sessão
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
