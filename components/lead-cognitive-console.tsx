"use client";

import { useRef, useState, useEffect, useCallback, memo, useMemo } from "react";
import { useTheme } from "next-themes";
import {
  X, ArrowUp, Play, Loader2, Check, Brain,
  Mic, Zap, Star, Building2, ExternalLink, Copy, CheckCheck,
  Square, Paperclip, Search, StopCircle, FileText, User, HelpCircle,
  Trash2, AlertTriangle, MessageSquare
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getSupabase } from "@/lib/supabase";
import { useOrbitContext } from "./orbit-context";
import { OrbitSelectionPanel } from "@/components/orbit-selection-panel";

// Mobile hook for responsive layout
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return isMobile;
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface Lead {
  id: string;
  name: string | null;
  phone: string | null;
  photo_url: string | null;
  orbit_stage: string | null;
  action_suggested: string | null;
  last_interaction_at: string | null;
  lid: string | null;
}

interface CognitiveState {
  interest_score: number;
  momentum_score: number;
  risk_score: number;
  clarity_level: number;
  current_state: string | null;
  last_ai_analysis_at: string | null;
  central_conflict?: string | null;
  what_not_to_do?: string | null;
}

interface MemoryItem {
  id: string;
  type: string;
  content: string;
  confidence: number | null;
}

interface AiInsight {
  id: string;
  content: string;
  urgency: number;
  created_at: string | null;
}

interface Message {
  id: string;
  source: "whatsapp" | "operator" | "internal";
  content: string | null;
  timestamp: string;
  ai_analysis: Record<string, unknown> | null;
}

interface PropertyInteraction {
  id: string;
  interaction_type: string;
  timestamp: string;
  property?: {
    id: string;
    title: string | null;
    cover_image: string | null;
    value: number | null;
    location_text: string | null;
    source_link: string | null;
  };
}

interface LeadCognitiveConsoleProps {
  leadId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatValue(v: number | null) {
  if (!v) return "—";
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `R$ ${Math.round(v / 1_000)}k`;
  return `R$ ${v}`;
}

function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function getInitials(name: string | null) {
  if (!name) return "?";
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

const STAGE_LABELS: Record<string, string> = {
  needs_attention: "Precisa de Atenção",
  active: "Lead Ativo", ativo: "Lead Ativo",
  warm: "Quente", quente: "Quente",
  cold: "Frio", frio: "Frio",
  deciding: "Decidindo", decidindo: "Decidindo",
  negotiating: "Negociando", negociando: "Negociando",
  exploring: "Explorando", explorando: "Explorando",
  comparing: "Comparando", comparando: "Comparando",
  closed: "Fechado", fechado: "Fechado",
  lost: "Perdido", perdido: "Perdido",
  new: "Novo", novo: "Novo",
};

function humanStage(raw: string | null | undefined): string {
  if (!raw) return "Lead Ativo";
  return STAGE_LABELS[raw.toLowerCase()] ?? raw.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

const COG_STATE_LABELS: Record<string, string> = {
  latent:     "Latente",
  curious:    "Curioso",
  exploring:  "Explorando",
  evaluating: "Avaliando",
  deciding:   "Decidindo",
  resolved:   "Resolvido",
  dormant:    "Dormente",
  // legacy fallbacks
  active: "Ativo", ativo: "Ativo",
  passive: "Passivo",
  engaged: "Engajado",
  hot: "Quente",
  cold: "Frio",
  at_risk: "Em Risco",
};

function humanCogState(raw: string | null | undefined): string {
  if (!raw) return "Ativo";
  return COG_STATE_LABELS[raw.toLowerCase()] ?? raw.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}


// ─── Cognitive Ring ────────────────────────────────────────────────────────────
const CognitiveRing = memo(function CognitiveRing({ value, label, color = "var(--orbit-glow)" }: { value: number; label: string; color?: string }) {
  const r = 18;
  const circ = 2 * Math.PI * r;
  const offset = circ - ((Math.min(100, Math.max(0, value)) / 100) * circ);
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative flex items-center justify-center">
        <svg className="w-10 h-10 -rotate-90" viewBox="0 0 40 40">
          <circle cx="20" cy="20" r={r} fill="none" stroke="var(--orbit-line)" strokeWidth="2" />
          <circle cx="20" cy="20" r={r} fill="none" stroke={color} strokeWidth="2"
            strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
        </svg>
        <span className="absolute text-[10px] font-display font-medium text-[var(--orbit-text)]">{Math.round(value)}%</span>
      </div>
      <span className="text-[9px] uppercase tracking-widest text-[var(--orbit-text-muted)] font-sans">{label}</span>
    </div>
  );
});

// ─── Audio Waveform ────────────────────────────────────────────────────────────
function AudioWaveform() {
  const bars = useRef(Array.from({ length: 16 }, () => Math.random() * 70 + 10));
  return (
    <div className="flex items-center gap-0.5 h-8 flex-1">
      {bars.current.map((h, i) => (
        <div key={i} className="w-0.5 rounded-full bg-[var(--orbit-glow)]/40" style={{ height: `${h}%` }} />
      ))}
    </div>
  );
}

// ─── Image Group Bubble ────────────────────────────────────────────────────────────
const ImageGroupBubble = memo(function ImageGroupBubble({ group, leadPhoto, leadName }: { group: any, leadPhoto: string | null, leadName: string | null }) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const items = group.items;
  
  if (items.length === 1) {
    return <MessageBubble msg={items[0]} leadPhoto={leadPhoto} leadName={leadName} />;
  }

  if (group.source === "whatsapp") {
    return (
      <div className="flex gap-3 max-w-[80%]">
        <div className="w-8 h-8 rounded-full border border-[var(--orbit-line)] shrink-0 overflow-hidden bg-[var(--orbit-glow)]/10 flex items-center justify-center text-[10px] font-bold text-[var(--orbit-glow)]">
          {leadPhoto ? <img src={leadPhoto} className="w-full h-full object-cover" alt="" /> : getInitials(leadName)}
        </div>
        <div className="flex flex-col gap-1">
          <div className={`bg-[var(--orbit-bg-secondary)] border border-[var(--orbit-line)] border-l-2 border-l-white/10 rounded-2xl rounded-tl-none p-2 shadow-[var(--orbit-shadow)]`}>
            <div className={`grid gap-1 ${items.length === 2 ? "grid-cols-2" : items.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
              {items.map((msg: any) => {
                 let p: any = {};
                 try { p = JSON.parse(msg.content || "{}"); } catch {}
                 return (
                   <div key={msg.id} className="relative aspect-square">
                     <img src={p.url} alt="" className="rounded-lg w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity" />
                   </div>
                 );
              })}
            </div>
          </div>
          <span className="text-[10px] text-[var(--orbit-text-muted)] ml-1">{formatTime(group.timestamp)}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1 self-end max-w-[80%]">
      <div className={`border rounded-2xl rounded-tr-none p-2 shadow-[var(--orbit-shadow)] ${
        isDark ? 'bg-[var(--orbit-glow)]/10 border-[var(--orbit-glow)]/20' : 'bg-[var(--orbit-glow)]/5 border-[var(--orbit-glow)]/20 shadow-sm'
      }`}>
        <div className={`grid gap-1 ${items.length === 2 ? "grid-cols-2" : items.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
          {items.map((msg: any) => {
             let p: any = {};
             try { p = JSON.parse(msg.content || "{}"); } catch {}
             return (
               <div key={msg.id} className="relative aspect-square">
                 <img src={p.url} alt="" className="rounded-lg w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity" />
               </div>
             );
          })}
        </div>
      </div>
      <span className="text-[10px] text-[var(--orbit-text-muted)] mr-1">{formatTime(group.timestamp)}</span>
    </div>
  );
});

// ─── Message Bubble ────────────────────────────────────────────────────────────
const MessageBubble = memo(function MessageBubble({ msg, leadPhoto, leadName }: { msg: Message, leadPhoto: string | null, leadName: string | null }) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  
  const isOperator = msg.source === "operator";
  if (msg.source === "internal") {
    return (
      <div className="flex justify-center my-3 w-full">
        <div className={`border rounded-2xl px-5 py-4 max-w-[85%] relative overflow-hidden group ${
          isDark ? 'bg-[var(--orbit-glow)]/5 border-[var(--orbit-glow)]/10' : 'bg-[var(--orbit-glow)]/5 border-[var(--orbit-line)] shadow-sm'
        }`}>
          <div className="absolute top-0 right-0 p-1 opacity-5 group-hover:opacity-10 transition-opacity">
             <Star className="w-12 h-12 text-[var(--orbit-glow)]" />
          </div>
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-5 h-5 rounded flex items-center justify-center ${isDark ? 'bg-[var(--orbit-glow)]/20' : 'bg-[var(--orbit-glow)]/10'}`}>
              <Star className="w-3 h-3 text-[var(--orbit-glow)] fill-current" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--orbit-glow)]">Nota Interna</span>
            <span className="text-[9px] text-[var(--orbit-glow)]/40 ml-auto">{formatTime(msg.timestamp)}</span>
          </div>
          <p className={`text-sm leading-relaxed font-medium ${isDark ? 'text-[var(--orbit-text)]' : 'text-[var(--orbit-text)]'}`}>
            {msg.content}
          </p>
        </div>
      </div>
    );
  }

  const analysis = msg.ai_analysis as Record<string, string> | null;
  const signal = analysis?.signal;
  const intention = analysis?.intention;

  let text = msg.content || "";
  let mediaType: string | undefined;
  let mediaUrl: string | undefined;
  let manualKind: string | undefined;
  let manualNextContact: string | undefined;

  try {
    const p = JSON.parse(text);
    if (p.type === "audio_transcript" && p.url) {
      // Rich transcription card
      const ana = p.analysis || {};
      const sentColor =
        ana.sentiment === "positive" ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/5"
        : ana.sentiment === "negative" ? "text-red-400 border-red-500/30 bg-red-500/5"
        : "text-blue-400 border-blue-400/20 bg-blue-500/5";
      const urgencyWidth = `${Math.min(ana.urgency || 0, 100)}%`;

      return (
        <div className="flex flex-col items-end gap-1 self-end max-w-[90%] w-full">
          <div className={`w-full border rounded-2xl rounded-tr-none overflow-hidden shadow-[var(--orbit-shadow)] ${
            isDark ? 'bg-[var(--orbit-bg)] border-[var(--orbit-glow)]/20' : 'bg-white border-[var(--orbit-line)]'
          }`}>
            {/* Header */}
            <div className={`flex items-center gap-2 px-3 py-2 border-b ${
              isDark ? 'border-[var(--orbit-line)] bg-[var(--orbit-glow)]/5' : 'border-[var(--orbit-line)] bg-[var(--orbit-bg-secondary)]'
            }`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center ${isDark ? 'bg-[var(--orbit-glow)]/20' : 'bg-[var(--orbit-glow)]/10'}`}>
                <Mic className="h-3 w-3 text-[var(--orbit-glow)]" />
              </div>
              <span className={`text-[10px] font-mono uppercase tracking-widest ${isDark ? 'text-[var(--orbit-glow)]/70' : 'text-[var(--orbit-glow)]'}`}>Transcrição de Áudio</span>
              <span className="ml-auto text-[10px] text-[var(--orbit-text-muted)]">{formatTime(msg.timestamp)}</span>
            </div>

            {/* Audio Player (basic) */}
            <div className={`flex items-center gap-3 px-3 py-2 border-b ${isDark ? 'border-white/5' : 'border-[var(--orbit-line)]'}`}>
              <audio controls src={p.url} className="w-full h-8 opacity-70" style={{ filter: isDark ? "invert(0.9) hue-rotate(180deg) saturate(0.6)" : "none" }} />
            </div>

            {/* Transcript */}
            {p.transcript && (
              <div className={`px-3 py-2 border-b ${isDark ? 'border-[var(--orbit-line)]' : 'border-[var(--orbit-line)]'}`}>
                <p className="text-[10px] uppercase tracking-wider text-[var(--orbit-text-muted)] mb-1">Transcrição</p>
                <p className={`text-xs leading-relaxed italic ${isDark ? 'text-[var(--orbit-text)]' : 'text-[var(--orbit-text)] font-medium'}`}>"{p.transcript}"</p>
              </div>
            )}

            {/* Analysis */}
            {ana.summary && (
              <div className="px-3 py-2 space-y-2">
                {/* Sentiment + Urgency */}
                <div className="flex items-center gap-2">
                  {ana.sentiment && (
                    <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border ${sentColor}`}>
                      {ana.sentiment === "positive" ? "Positivo" : ana.sentiment === "negative" ? "Negativo" : "Neutro"}
                    </span>
                  )}
                  {ana.intention && (
                    <span className={`text-[9px] font-medium truncate ${isDark ? 'text-slate-400' : 'text-[var(--orbit-text-muted)]'}`}>{ana.intention}</span>
                  )}
                </div>

                {/* Urgency bar */}
                {typeof ana.urgency === "number" && (
                  <div>
                    <div className="flex justify-between text-[9px] text-[var(--orbit-text-muted)] mb-0.5">
                      <span>Urgência</span><span>{ana.urgency}%</span>
                    </div>
                    <div className={`h-1 w-full rounded-full overflow-hidden ${isDark ? 'bg-[var(--orbit-bg-secondary)]' : 'bg-gray-100'}`}>
                      <div className="h-full bg-[var(--orbit-glow)] rounded-full transition-all duration-700" style={{ width: urgencyWidth }} />
                    </div>
                  </div>
                )}

                {/* Signals */}
                {Array.isArray(ana.signals) && ana.signals.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {ana.signals.map((s: string, i: number) => (
                      <span key={i} className={`text-[9px] border px-2 py-0.5 rounded-full ${
                        isDark ? 'bg-white/5 border-white/10 text-slate-300' : 'bg-gray-50 border-[var(--orbit-line)] text-[var(--orbit-text-muted)]'
                      }`}>
                        {s}
                      </span>
                    ))}
                  </div>
                )}

                {/* Summary */}
                <p className={`text-[10px] leading-relaxed border-l pl-2 ${isDark ? 'text-slate-400 border-[#2ec5ff]/30' : 'text-[var(--orbit-text-muted)] border-[var(--orbit-glow)]/30'}`}>{ana.summary}</p>

                {/* Suggested action */}
                {ana.suggested_action && (
                  <div className={`flex items-start gap-1.5 border rounded-lg px-2 py-1.5 ${
                    isDark ? 'bg-[#d4af35]/5 border-[#d4af35]/20' : 'bg-[var(--orbit-glow)]/5 border-[var(--orbit-glow)]/20'
                  }`}>
                    <Zap className={`h-3 w-3 shrink-0 mt-0.5 ${isDark ? 'text-[#d4af35]' : 'text-[var(--orbit-glow)]'}`} />
                    <p className={`text-[10px] ${isDark ? 'text-[#d4af35]' : 'text-[var(--orbit-glow)] font-bold'}`}>{ana.suggested_action}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }
    if (p.type && p.url) { mediaType = p.type; mediaUrl = p.url; text = p.caption || ""; }
    else if (p.type && p.summary) { manualKind = p.type; text = p.summary; manualNextContact = p.next_contact_at; }
    if (p.type === "property") {
      return (
        <div className="flex flex-col items-end gap-1 self-end max-w-[80%]">
          <div className={`flex border shadow-[var(--orbit-shadow)] rounded-2xl rounded-tr-none overflow-hidden max-w-[280px] ${
            isDark ? 'bg-[var(--orbit-bg)] border-[var(--orbit-line)]' : 'bg-white border-[var(--orbit-line)]'
          }`}>
            {p.cover_image && p.cover_image !== "null" && (
              <div className={`w-20 shrink-0 ${isDark ? 'bg-[var(--orbit-bg-secondary)]' : 'bg-gray-100'}`}>
                <img src={p.cover_image} className="w-full h-full object-cover" alt={p.title} />
              </div>
            )}
            <div className="p-3 flex flex-col justify-center">
              <span className={`text-[10px] uppercase font-bold tracking-wider mb-0.5 ${isDark ? 'text-[var(--orbit-glow)]' : 'text-[var(--orbit-glow)]'}`}>Vincular Imóvel</span>
              <span className={`text-sm font-medium line-clamp-2 leading-tight ${isDark ? 'text-[var(--orbit-text)]' : 'text-[var(--orbit-text)]'}`}>{p.title}</span>
              {p.value && <span className={`text-xs mt-1 ${isDark ? 'text-[var(--orbit-text-muted)]' : 'text-[var(--orbit-text-muted)]'}`}>{formatValue(p.value)}</span>}
            </div>
          </div>
          <span className="text-[10px] text-[var(--orbit-text-muted)] mr-1">{formatTime(msg.timestamp)}</span>
        </div>
      );
    }
    else if (p.type === "property_question") {
      return (
        <div className="flex gap-3 max-w-[90%]">
          <div className={`w-8 h-8 rounded-full border shrink-0 overflow-hidden flex items-center justify-center text-[10px] font-bold ${
            isDark ? 'border-[var(--orbit-line)] bg-[var(--orbit-glow)]/10 text-[var(--orbit-glow)]' : 'border-[var(--orbit-line)] bg-[var(--orbit-glow)]/10 text-[var(--orbit-glow)]'
          }`}>
            {leadPhoto ? <img src={leadPhoto} className="w-full h-full object-cover" alt="" /> : getInitials(leadName)}
          </div>
          <div className="flex flex-col gap-1 w-full">
            <div className={`border rounded-2xl rounded-tl-none overflow-hidden shadow-[var(--orbit-shadow)] ${
              isDark ? 'bg-[var(--orbit-bg)] border-[var(--orbit-glow)]/30' : 'bg-white border-[var(--orbit-glow)]/20 shadow-sm'
            }`}>
              <div className={`flex items-center gap-2 px-3 py-2 border-b ${
                isDark ? 'border-[var(--orbit-line)] bg-[var(--orbit-glow)]/5' : 'border-[var(--orbit-line)] bg-[var(--orbit-bg-secondary)]'
              }`}>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center ${isDark ? 'bg-[var(--orbit-glow)]/20' : 'bg-[var(--orbit-glow)]/10'}`}>
                  <HelpCircle className="h-3 w-3 text-[var(--orbit-glow)]" />
                </div>
                <span className={`text-[10px] font-mono uppercase tracking-widest ${isDark ? 'text-[var(--orbit-glow)]/80' : 'text-[var(--orbit-glow)]'}`}>Dúvida do Portal</span>
              </div>
              <div className="p-4">
                <p className={`text-sm leading-relaxed italic mb-3 ${isDark ? 'text-[var(--orbit-text)]' : 'text-[var(--orbit-text)] font-medium'}`}>"{p.text}"</p>
                <div className={`flex items-center gap-3 p-2 rounded-xl border ${
                  isDark ? 'bg-[var(--orbit-bg-secondary)] border-[var(--orbit-line)]' : 'bg-gray-50 border-[var(--orbit-line)]'
                }`}>
                  <div className={`w-10 h-10 rounded-lg overflow-hidden shrink-0 ${isDark ? 'bg-zinc-800' : 'bg-zinc-200'}`}>
                    {p.propertyCover ? <img src={p.propertyCover} className="w-full h-full object-cover" /> : <Building2 className={`w-4 h-4 m-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />}
                  </div>
                  <div className="min-w-0">
                    <p className={`text-[9px] uppercase tracking-wider mb-0.5 ${isDark ? 'text-[var(--orbit-text-muted)]' : 'text-[var(--orbit-text-muted)]'}`}>Sobre o imóvel</p>
                    <p className={`text-xs font-semibold truncate ${isDark ? 'text-[var(--orbit-glow)]' : 'text-[var(--orbit-glow)]'}`}>{p.propertyTitle || "Imóvel selecionado"}</p>
                  </div>
                </div>
              </div>
            </div>
            <span className="text-[10px] text-[var(--orbit-text-muted)] ml-1">{formatTime(msg.timestamp)}</span>
          </div>
        </div>
      );
    }
  } catch { /* not JSON */ }

  const signalBorder = signal === "positive" ? "border-l-emerald-500"
    : signal === "negative" ? "border-l-red-400" : "border-l-white/10";

  // ── Renderização Unificada de Mídia (WhatsApp ou Operador) ──
  if (mediaType === "audio" || mediaType === "image" || (mediaType === "video" && mediaUrl)) {
    const isOwner = msg.source === "operator";
    return (
      <div className={`flex gap-3 max-w-[85%] ${isOwner ? 'self-end flex-row-reverse' : ''}`}>
        {!isOwner && (
          <div className="w-8 h-8 rounded-full border border-[var(--orbit-line)] shrink-0 overflow-hidden bg-[var(--orbit-glow)]/10 flex items-center justify-center text-[10px] font-bold text-[var(--orbit-glow)]">
            {leadPhoto ? <img src={leadPhoto} className="w-full h-full object-cover" alt="" /> : getInitials(leadName)}
          </div>
        )}
        <div className={`flex flex-col gap-1 ${isOwner ? 'items-end' : ''}`}>
          <div className={`border shadow-[var(--orbit-shadow)] rounded-2xl p-3 ${
            isOwner 
              ? isDark ? 'bg-[var(--orbit-glow)]/10 border-[var(--orbit-glow)]/20 rounded-tr-none' : 'bg-[var(--orbit-glow)]/5 border-[var(--orbit-glow)]/20 rounded-tr-none shadow-sm'
              : `bg-[var(--orbit-bg-secondary)] border-[var(--orbit-line)] border-l-2 ${signalBorder} rounded-tl-none`
          }`}>
            {mediaType === "audio" ? (
              <div className="flex flex-col gap-2 min-w-[240px]">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isDark ? 'bg-white/10' : 'bg-[var(--orbit-glow)]/10'}`}>
                    <Mic className={`h-4 w-4 ${isDark ? 'text-white' : 'text-[var(--orbit-glow)]'}`} />
                  </div>
                  <audio controls src={mediaUrl} className="w-full h-8" style={{ filter: isDark ? "invert(0.9) hue-rotate(180deg) saturate(0.6)" : "none" }} />
                </div>
                {text && text !== "[audio]" && text !== "[Áudio]" && (
                  <p className={`text-xs italic border-l pl-2 py-0.5 mt-1 ${isDark ? 'text-slate-400 border-white/10' : 'text-slate-600 border-[var(--orbit-glow)]/20'}`}>
                    "{text.replace("[Áudio Transcrito] ", "")}"
                  </p>
                )}
              </div>
            ) : mediaType === "image" ? (
               <div className="flex flex-col gap-2">
                 <img src={mediaUrl} alt="" className="rounded-lg max-w-full md:max-w-[260px] max-h-60 object-cover cursor-pointer hover:brightness-110 transition-all" onClick={() => window.open(mediaUrl, '_blank')} />
                 {text && <p className={`text-xs ${isDark ? 'text-slate-300' : 'text-[var(--orbit-text)]'}`}>{text}</p>}
               </div>
            ) : null}
          </div>
          <span className="text-[10px] text-[var(--orbit-text-muted)] mx-1">{formatTime(msg.timestamp)}</span>
        </div>
      </div>
    );
  }

  const MANUAL_ICONS: Record<string, { label: string; colorClass: string; iconChar: string }> = {
    call: { label: "Ligação", colorClass: "text-emerald-400", iconChar: "📞" },
    visit: { label: "Visita", colorClass: "text-[#d4af35]", iconChar: "🏠" },
    meeting: { label: "Reunião", colorClass: "text-blue-400", iconChar: "👥" },
    next_contact: { label: "Próx. Contato", colorClass: "text-amber-400", iconChar: "📅" },
    note: { label: "Anotação", colorClass: "text-slate-400", iconChar: "📝" },
  };

  if (manualKind) {
    const meta = MANUAL_ICONS[manualKind] || MANUAL_ICONS.note;
    return (
      <div className="flex justify-center my-1 w-full">
        <div className={`flex items-start gap-3 rounded-xl px-4 py-3 max-w-[80%] border ${
          isDark ? 'bg-[#d4af35]/5 border-[#d4af35]/20' : 'bg-[var(--orbit-glow)]/5 border-[var(--orbit-glow)]/20 shadow-sm'
        }`}>
          <span className="text-base">{meta.iconChar}</span>
          <div>
            <p className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 ${
              isDark ? meta.colorClass : 'text-[var(--orbit-glow)]'
            }`}>{meta.label}</p>
            <p className={`text-xs ${isDark ? 'text-slate-300' : 'text-[var(--orbit-text)]'}`}>{text}</p>
            {manualNextContact && (
              <p className={`text-[10px] mt-1 ${isDark ? 'text-[#d4af35]/60' : 'text-[var(--orbit-glow)]/60'}`}>
                {new Date(manualNextContact).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (msg.source === "whatsapp") {
    return (
      <div className="flex gap-3 max-w-[80%]">
        <div className="w-8 h-8 rounded-full border border-[var(--orbit-line)] shrink-0 overflow-hidden bg-[var(--orbit-glow)]/10 flex items-center justify-center text-[10px] font-bold text-[var(--orbit-glow)]">
          {leadPhoto ? <img src={leadPhoto} className="w-full h-full object-cover" alt="" /> : getInitials(leadName)}
        </div>
        <div className="flex flex-col gap-1">
          <div className={`bg-[var(--orbit-bg-secondary)] border border-[var(--orbit-line)] border-l-2 ${signalBorder} rounded-2xl rounded-tl-none px-4 py-3 text-sm leading-relaxed shadow-[var(--orbit-shadow)]`}>
            <p className="text-[var(--orbit-text)]">{text}</p>
            {(intention || analysis?.summary) && (
              <div className="mt-2 space-y-2">
                {intention && (
                  <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-bold uppercase tracking-wide ${
                    signal === "positive" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" :
                    signal === "negative" ? "bg-rose-500/10 text-rose-600 border-rose-500/20" :
                    "bg-[var(--orbit-glow)]/10 text-[var(--orbit-glow)] border-[var(--orbit-glow)]/20"
                  }`}>
                    <Brain className="h-2.5 w-2.5" /> {intention}
                  </div>
                )}
                {analysis?.summary && (
                  <p className={`text-[10px] leading-relaxed border-l pl-2 ${isDark ? 'text-slate-400 border-[#2ec5ff]/30' : 'text-[var(--orbit-text-muted)] border-[var(--orbit-glow)]/30'}`}>
                    {analysis.summary}
                  </p>
                )}
              </div>
            )}
          </div>
          <span className="text-[10px] text-[var(--orbit-text-muted)] ml-1">{formatTime(msg.timestamp)}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1 self-end max-w-[80%]">
      <div className={`border rounded-2xl rounded-tr-none px-4 py-3 text-sm leading-relaxed shadow-[var(--orbit-shadow)] ${
        isDark ? 'bg-[var(--orbit-glow)]/10 border-[var(--orbit-glow)]/20 text-[var(--orbit-text)]' : 'bg-[var(--orbit-glow)]/5 border-[var(--orbit-glow)]/20 text-[var(--orbit-text)] font-medium shadow-sm'
      }`}>
        {text}
      </div>
      <span className="text-[10px] text-[var(--orbit-text-muted)] mr-1">{formatTime(msg.timestamp)}</span>
    </div>
  );
});

// ─── Property Card ──────────────────────────────────────────────────────────────
const PropertyCard = memo(function PropertyCard({ interaction }: { interaction: PropertyInteraction }) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const prop = interaction.property;

  if (!prop) return null;

  const typeLabel: Record<string, string> = {
    sent: "Enviado", favorited: "Favoritado", visited: "Visitado",
    discarded: "Descartado", proposal: "Proposta"
  };
  const typeBadge: Record<string, string> = {
    sent: "text-[#d4af35] border-[#d4af35]/30",
    favorited: "text-pink-400 border-pink-400/30",
    visited: "text-emerald-400 border-emerald-400/30",
    discarded: "text-slate-500 border-slate-500/30",
    proposal: "text-blue-400 border-blue-400/30",
  };

  return (
    <div className="flex items-center justify-between p-2.5 bg-[var(--orbit-bg-secondary)] hover:bg-[var(--orbit-bg)] rounded-xl border border-[var(--orbit-line)] transition-all group shadow-sm hover:shadow-[var(--orbit-shadow)]">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg overflow-hidden bg-zinc-200 shrink-0">
          {prop.cover_image
            ? <img src={prop.cover_image} alt="" className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center"><Building2 className="w-4 h-4 text-slate-400" /></div>
          }
        </div>
        <div>
          <a 
            href={`/atlas?id=${prop.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-[var(--orbit-text)] hover:text-[var(--orbit-glow)] transition-colors truncate max-w-[130px] block"
          >
            {prop.title || "Imóvel"}
          </a>
          <p className="text-[10px] text-[var(--orbit-glow)]/70 font-mono">{formatValue(prop.value)}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${typeBadge[interaction.interaction_type] || typeBadge.sent}`}>
          {typeLabel[interaction.interaction_type] || interaction.interaction_type}
        </span>
        {prop.source_link && (
          <a href={prop.source_link} target="_blank" rel="noopener noreferrer"
            className="text-slate-600 hover:text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </div>
  );
});

// ─── GLASS PANEL STYLE (reused) ────────────────────────────────────────────────
const glass = "bg-[var(--orbit-glass)] backdrop-blur-[16px] border border-[var(--orbit-glass-border)] shadow-[var(--orbit-shadow)]";

// ─── Main Component ────────────────────────────────────────────────────────────
export function LeadCognitiveConsole({ leadId, isOpen, onClose }: LeadCognitiveConsoleProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const ringGold = isDark ? "#d4af35" : "var(--orbit-glow)";
  
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isMobile = useIsMobile();
  const [activeMobileTab, setActiveMobileTab] = useState<"chat" | "info">("chat");

  // Data
  const [lead, setLead] = useState<Lead | null>(null);
  const [cognitive, setCognitive] = useState<CognitiveState | null>(null);
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [insights, setInsights] = useState<AiInsight[]>([]);
  const { invokeAtlasMap, isAtlasMapActive } = useOrbitContext();
  const [messages, setMessages] = useState<Message[]>([]);
  const [interactions, setInteractions] = useState<PropertyInteraction[]>([]);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showStageDropdown, setShowStageDropdown] = useState(false);

  // Composer
  const [composerText, setComposerText] = useState("");
  const [sendStatus, setSendStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [interactionMode, setInteractionMode] = useState<"whatsapp" | "note" | "call">("whatsapp");
  const [callStatus, setCallStatus] = useState<"attended" | "missed">("attended");

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'inherit';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(scrollHeight, 200)}px`;
    }
  }, [composerText]);

  // Copy to clipboard
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    if (!aiSuggestion) return;
    navigator.clipboard.writeText(aiSuggestion);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // --- File attachment ---
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleFileAttach = useCallback(() => fileInputRef.current?.click(), []);
  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !leadId) return;

    const localUrl = URL.createObjectURL(file);
    const type = file.type.startsWith("image/") ? "image" : "audio"; // rudimentary check
    
    // 1. Optimistic UI
    const optimisticId = `opt-file-${Date.now()}`;
    const optimistic: Message = {
      id: optimisticId,
      source: "operator",
      content: JSON.stringify({ type, url: localUrl, caption: "Enviando arquivo…" }),
      timestamp: new Date().toISOString(),
      ai_analysis: null,
    };
    setMessages(prev => [...prev, optimistic]);

    try {
      // 2. Upload to Supabase
      const uploadFormData = new FormData();
      uploadFormData.append("file", file);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: uploadFormData });
      if (!uploadRes.ok) throw new Error("Falha no upload");
      const { url: permanentUrl } = await uploadRes.json();

      // 3. Send via WhatsApp
      const sendRes = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: lead?.phone || lead?.lid,
          leadId,
          type,
          mediaUrl: permanentUrl,
          caption: file.name
        })
      });

      if (!sendRes.ok) throw new Error("Falha ao enviar arquivo via WhatsApp");

      // Cleanup optimistic
      setTimeout(() => {
        setMessages(prev => prev.filter(m => m.id !== optimisticId));
      }, 1000);
    } catch (err: any) {
      console.error("[COG] File send error:", err);
      setMessages(prev => prev.map(m => m.id === optimisticId
        ? { ...m, content: JSON.stringify({ type, url: localUrl, caption: `Erro: ${err.message}` }) }
        : m
      ));
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [leadId, lead]);

  // --- Property search via Atlas ---
  const handleAttachProperty = useCallback(async (prop: any) => {
    if (!leadId) return;
    
    // Support both Atlas map Property shape (name, coverImage) and DB shape (title, cover_image)
    const normalizedProp = {
      id: prop.id,
      title: prop.name || prop.title,
      value: prop.value,
      cover_image: prop.coverImage || prop.cover_image
    };

    const content = JSON.stringify({ 
      type: "property", 
      id: normalizedProp.id, 
      title: normalizedProp.title, 
      value: normalizedProp.value, 
      cover_image: normalizedProp.cover_image 
    });

    const optimistic: Message = {
      id: `opt-prop-${Date.now()}`,
      source: "operator",
      content,
      timestamp: new Date().toISOString(),
      ai_analysis: null,
    };
    setMessages(prev => [...prev, optimistic]);

    try {
      // 1. Send via central property-interactions API (triggers WhatsApp)
      await fetch("/api/property-interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId,
          propertyId: normalizedProp.id,
          interaction_type: "sent",
          source: "cognitive_console"
        })
      });
      
      // 2. Also register in older interactions table for backward compatibility if needed, 
      // but the API call above already handled the core logic.
    } catch (err) {
      console.error("Error attaching property:", err);
    }
  }, [leadId]);

  // --- Audio recording ---
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [lastTranscript, setLastTranscript] = useState<{ text: string; analysis: Record<string, unknown> } | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const localUrl = URL.createObjectURL(blob);

        // 1. Show optimistic audio bubble (local only for now)
        const optimisticId = `opt-audio-${Date.now()}`;
        const optimistic: Message = {
          id: optimisticId,
          source: "operator",
          content: JSON.stringify({ type: "audio", url: localUrl, caption: "Enviando e transcrevendo…" }),
          timestamp: new Date().toISOString(),
          ai_analysis: null,
        };
        setMessages(prev => [...prev, optimistic]);

        // 2. Transcribe (background) + Upload & Send (critical)
        setIsTranscribing(true);
        try {
          // A. Transcribe via Whisper
          const transcribeFormData = new FormData();
          transcribeFormData.append("audio", blob, "audio.webm");
          if (leadId) transcribeFormData.append("leadId", leadId);
          transcribeFormData.append("language", "pt");

          const transcribePromise = fetch("/api/transcribe", { method: "POST", body: transcribeFormData })
            .then(res => res.ok ? res.json() : null)
            .catch(() => null);

          // B. Upload to Supabase Storage
          const uploadFormData = new FormData();
          uploadFormData.append("file", blob, `audio-${Date.now()}.webm`);
          const uploadRes = await fetch("/api/upload", { method: "POST", body: uploadFormData });
          
          if (!uploadRes.ok) throw new Error("Falha no upload do áudio");
          const uploadData = await uploadRes.json();
          const permanentUrl = uploadData.url;

          // C. Wait for transcription (optional but good for DB)
          const data = await transcribePromise;
          const transcript = data?.transcript || "";

          // D. Send via WhatsApp API (this also saves to DB via our updated route)
          const sendRes = await fetch("/api/whatsapp/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              phone: lead?.phone || lead?.lid,
              leadId: leadId,
              type: "audio",
              mediaUrl: permanentUrl,
              caption: transcript ? `[Áudio Transcrito] ${transcript}` : "[Áudio]"
            })
          });

          if (!sendRes.ok) throw new Error("Falha ao enviar áudio via WhatsApp");

          // Remove optimistic and let Realtime handle the new permanent message
          setTimeout(() => {
            setMessages(prev => prev.filter(m => m.id !== optimisticId));
          }, 1000);

          if (transcript) {
            setLastTranscript({ text: transcript, analysis: data?.analysis || {} });
          }
        } catch (err: any) {
          console.error("[COG] Audio send error:", err);
          // Update optimistic to error state
          setMessages(prev => prev.map(m => m.id === optimisticId
            ? { ...m, content: JSON.stringify({ type: "audio", url: localUrl, caption: `Erro: ${err.message}` }) }
            : m
          ));
        } finally {
          setIsTranscribing(false);
        }
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => setRecordingSeconds(s => s + 1), 1000);
    } catch {
      alert("Não foi possível acessar o microfone. Verifique as permissões do navegador.");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    setRecordingSeconds(0);
  };

  // Fetch all data
  const fetchAll = useCallback(async () => {
    if (!leadId) return;
    setLoading(true);
    const supabase = getSupabase();

    const [leadRes, cogRes, memRes, insRes, msgRes] = (await Promise.all([
      supabase.from("leads")
        .select("id,name,phone,photo_url,orbit_stage,action_suggested,last_interaction_at,lid")
        .eq("id", leadId).single(),
      supabase.from("lead_cognitive_state")
        .select("interest_score,momentum_score,risk_score,clarity_level,current_state,last_ai_analysis_at,central_conflict,what_not_to_do")
        .eq("lead_id", leadId).maybeSingle(),
      supabase.from("memory_items")
        .select("id,type,content,confidence")
        .eq("lead_id", leadId).order("created_at", { ascending: false }).limit(20),
      supabase.from("ai_insights")
        .select("id,content,urgency,created_at")
        .eq("lead_id", leadId).order("created_at", { ascending: false }).limit(5),
      // Try `messages` table first (newer schema)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from("messages") as any)
        .select("id,source,content,timestamp,ai_analysis")
        .eq("lead_id", leadId).order("timestamp", { ascending: true }).limit(80),
    ])) as any[];

    if (leadRes.data) setLead(leadRes.data as Lead);
    if (cogRes.data) setCognitive(cogRes.data as CognitiveState);
    
    if (memRes.data) {
      console.log(`[COG] Loaded ${memRes.data.length} memories`);
      setMemories(memRes.data as MemoryItem[]);
    } else if (memRes.error) {
      console.error(`[COG] Error loading memories:`, memRes.error);
    }

    if (insRes.data) {
      console.log(`[COG] Loaded ${insRes.data.length} insights`);
      setInsights(insRes.data as AiInsight[]);
    } else if (insRes.error) {
      console.error(`[COG] Error loading insights:`, insRes.error);
    }

    console.log("[COG] Messages response from Promise.all:", msgRes);

    if (msgRes.data && msgRes.data.length > 0) {
      console.log("[COG] Setting messages from NEW schema 'messages'. Count:", msgRes.data.length);
      setMessages(msgRes.data as Message[]);
    } else {
      console.log("[COG] Fallback to 'interactions'. msgRes.data is:", msgRes.data, "error:", msgRes.error);
      // Fallback to `interactions` table (older schema)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const intRes = await (supabase.from("interactions") as any)
        .select("id,content,created_at,direction")
        .eq("lead_id", leadId).order("created_at", { ascending: true }).limit(80);
      
      console.log("[COG] Interactions fallback response:", intRes);

      if (intRes.data) {
        setMessages(intRes.data.map((i: any) => ({
          id: i.id,
          source: i.direction === "inbound" ? "whatsapp" : "operator",
          content: i.content,
          timestamp: i.created_at,
          ai_analysis: null,
        })) as Message[]);
      }
    }

    // Property interactions — removed (OrbitSelectionPanel renders its own data)

    // AI Suggestion — extract only the action part
    try {
      const sugRes = await fetch(`/api/lead/${leadId}/suggest`);
      if (sugRes.ok) {
        const j = await sugRes.json();
        if (j.suggestion) {
          const raw: string = j.suggestion;
          const clean = raw.includes("Próxima ação:")
            ? raw.split("Próxima ação:")[1]?.trim() ?? raw
            : raw.includes("action_description:")
              ? raw.split("action_description:")[1]?.trim() ?? raw
              : raw;
          setAiSuggestion(clean);
        }
      }
    } catch { /* silent */ }

    setLoading(false);
  }, [leadId]);

  useEffect(() => {
    if (isOpen && leadId) {
      isFirstChatLoad.current = true;
      setLead(null);
      setCognitive(null);
      setMemories([]);
      setInsights([]);
      setMessages([]);
      setAiSuggestion(null);
      fetchAll();

      // Mark as read
      fetch(`/api/lead/${leadId}/read`, { method: "POST" })
        .then(() => {
          // Trigger a global refresh to clear urgency lights
          // Since we don't have a direct refetch here, the realtime 
          // subscription on 'leads' table in useSupabaseLeads should handle it,
          // but we can also broadcast a custom event or rely on the next fetchLeads().
          console.log(`[COG] Lead ${leadId} marked as read`);
        })
        .catch(err => 
          console.error("Error marking lead as read:", err)
        );
    }
  }, [isOpen, leadId, fetchAll]);

  // Realtime subscription
  useEffect(() => {
    if (!isOpen || !leadId) return;

    const supabase = getSupabase();
    console.log(`[COG] Starting Realtime for lead: ${leadId}`);
    
    const channel = supabase
      .channel(`lead-console-${leadId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `lead_id=eq.${leadId}` },
        (payload) => {
          console.log("[COG] Message Realtime event:", payload.eventType, payload.new);
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            setMessages(prev => {
              const incoming = payload.new as Message;
              
              // 1. Check if it's already there by real ID
              if (prev.some(m => m.id === incoming.id)) {
                return prev.map(m => m.id === incoming.id ? incoming : m)
                  .sort((a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime());
              }

              // 2. Deduplicate optimistic messages (match by content + source)
              const existingIndex = prev.findIndex(m => 
                m.id.startsWith('opt-') && 
                m.content === incoming.content && 
                m.source === incoming.source
              );

              let newList;
              if (existingIndex !== -1) {
                // Replace optimistic with real
                newList = [...prev];
                newList[existingIndex] = incoming;
              } else {
                // Just append
                newList = [...prev, incoming];
              }

              // 3. Always sort by timestamp to ensure correct timeline
              return newList.sort((a, b) => {
                const timeA = new Date(a.timestamp || 0).getTime();
                const timeB = new Date(b.timestamp || 0).getTime();
                return timeA - timeB;
              });
            });
          }
        }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'lead_cognitive_state', filter: `lead_id=eq.${leadId}` },
        (payload) => { 
          console.log("[COG] Cognitive state Realtime update:", payload.new);
          setCognitive(payload.new as CognitiveState);
          // Refetch everything when cog state changes (analysis loop finished)
          fetchAll();
        }
      )
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ai_insights', filter: `lead_id=eq.${leadId}` },
        (payload) => {
          console.log("[COG] Insight Realtime insert:", payload.new);
          setInsights(prev => {
            const incoming = payload.new as AiInsight;
            if (prev.some(i => i.id === incoming.id)) return prev;
            return [incoming, ...prev];
          });
        }
      )
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'memory_items', filter: `lead_id=eq.${leadId}` },
        (payload) => {
          console.log("[COG] Memory Realtime insert:", payload.new);
          setMemories(prev => {
            const incoming = payload.new as MemoryItem;
            if (prev.some(m => m.id === incoming.id)) return prev;
            return [incoming, ...prev];
          });
        }
      )
      .subscribe((status) => {
        console.log(`[COG] Realtime status: ${status}`);
      });

    return () => {
      console.log(`[COG] Cleaning up Realtime for lead: ${leadId}`);
      supabase.removeChannel(channel);
    };
  }, [isOpen, leadId, fetchAll]);

  const groupedItems = useMemo(() => {
    const groups: (Message | { id: string, isImageGroup: true, items: Message[], source: string, timestamp: string } | { id: string, isDateSeparator: true, dateLabel: string })[] = [];
    let currentImageGroup: { id: string, isImageGroup: true, items: Message[], source: string, timestamp: string } | null = null;
    let lastDate = "";

    const formatDateLabel = (dateStr: string) => {
      const d = new Date(dateStr);
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);
      
      if (d.toDateString() === today.toDateString()) return "Hoje";
      if (d.toDateString() === yesterday.toDateString()) return "Ontem";
      
      const options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'long' };
      if (d.getFullYear() !== today.getFullYear()) {
        options.year = 'numeric';
      }
      
      return d.toLocaleDateString("pt-BR", options);
    };

    messages.forEach((msg) => {
      // 1. Date Separator logic
      const msgDate = msg.timestamp ? new Date(msg.timestamp).toDateString() : "";
      if (msgDate !== lastDate && msgDate !== "") {
        groups.push({ 
          id: `date-${msgDate}`, 
          isDateSeparator: true, 
          dateLabel: formatDateLabel(msg.timestamp) 
        });
        lastDate = msgDate;
      }

      // 2. Image grouping logic
      let isImage = false;
      try {
        const p = JSON.parse(msg.content || "{}");
        if (p.type === "image" && p.url) isImage = true;
      } catch {}

      if (isImage) {
        // Group consecutive images from the same source within the same hour
        const msgHour = msg.timestamp ? msg.timestamp.slice(0, 13) : "";
        const groupHour = currentImageGroup?.timestamp ? currentImageGroup.timestamp.slice(0, 13) : "";

        if (currentImageGroup && currentImageGroup.source === msg.source && msgHour === groupHour && msgHour !== "") {
          currentImageGroup.items.push(msg);
        } else {
          currentImageGroup = {
             id: msg.id + "-group",
             isImageGroup: true,
             source: msg.source,
             timestamp: msg.timestamp,
             items: [msg]
          };
          groups.push(currentImageGroup);
        }
      } else {
        currentImageGroup = null;
        groups.push(msg);
      }
    });
    return groups;
  }, [messages]);

  const isFirstChatLoad = useRef(true);
  useEffect(() => {
    if (!bottomRef.current) return;
    if (isFirstChatLoad.current && messages.length > 0) {
      bottomRef.current.scrollIntoView({ behavior: "instant" });
      isFirstChatLoad.current = false;
    } else if (!isFirstChatLoad.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Send message: bridge Cognitive Terminal -> WhatsApp (via Z-API) + interaction log
  const handleSend = useCallback(async () => {
    if (!composerText.trim() || sendStatus !== "idle" || !leadId) return;
    setSendStatus("sending");
    const supabase = getSupabase();
    const text = composerText.trim();

    // Optimistic UI update
    const optimistic: Message = {
      id: `opt-${Date.now()}`,
      source: interactionMode === "note" ? "internal" : "operator",
      content: text,
      timestamp: new Date().toISOString(),
      ai_analysis: null,
    };
    setMessages(prev => [...prev, optimistic]);
    setComposerText("");

    try {
      if (interactionMode === "note") {
        // Send as Internal Note
        const noteRes = await fetch(`/api/lead/${leadId}/note`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: text }),
        });

        if (!noteRes.ok) {
          throw new Error("Falha ao salvar nota");
        }
      } else if (interactionMode === "call") {
        // Send as Manual Call Interaction
        const callSummary = `[Ligação ${callStatus === "attended" ? "Atendida" : "Não Atendida"}] ${text}`;
        
        // 1. Save to messages table for timeline and AI
        // Using common source 'operator' but metadata content
        const callObj = { 
          type: "call", 
          status: callStatus, 
          summary: text,
          timestamp: new Date().toISOString()
        };

        const { data: newMessage, error: insertError } = await (supabase
          .from("messages") as any)
          .insert({
            lead_id: leadId,
            source: "operator",
            content: JSON.stringify(callObj),
            timestamp: new Date().toISOString(),
          })
          .select("id")
          .single();

        if (insertError) throw insertError;

        // 2. Trigger AI analysis for attended calls
        if (callStatus === "attended") {
          fetch(`/api/lead/${leadId}/note`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: callSummary, skipHistory: true }),
          }).catch(e => console.error("Error triggering AI for call:", e));
        }
      } else if (interactionMode === "whatsapp") {
        // WhatsApp Mode
        const sendTo = (lead?.lid && lead.lid.includes("@lid") ? lead.lid : lead?.lid ? `${lead.lid}@lid` : null) || lead?.phone;
        
        console.log('[SEND DEBUG] WhatsApp Mode', { 
          phone: lead?.phone, 
          lid: lead?.lid, 
          sendTo,
          interactionMode 
        });

        if (!sendTo) {
          alert("Este lead não possui telefone nem identificador do WhatsApp (LID) cadastrados.");
          setSendStatus("error");
          setTimeout(() => setSendStatus("idle"), 2000);
          return;
        }

        // Send via WhatsApp/Z-API
        const whatsappRes = await fetch("/api/whatsapp/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: sendTo, message: text, leadId }),
        });

        if (!whatsappRes.ok) {
          const errorData = await whatsappRes.json().catch(() => ({}));
          console.error("[COG] WhatsApp send failed:", errorData);
          setSendStatus("error");
          setTimeout(() => setSendStatus("idle"), 2000);
          return;
        }
      }

      setSendStatus("done");
      setTimeout(() => {
        setSendStatus("idle");
        // Don't auto-reset note mode unless desired, but usually people send one note and want to keep chatting or vice versa.
        // Let's keep it in the same mode for speed if adding multiple notes.
      }, 2000);
    } catch (e) {
      console.error("[COG] Error sending from Cognitive Terminal:", e);
      setSendStatus("error");
      setTimeout(() => setSendStatus("idle"), 2000);
    }
  }, [composerText, sendStatus, leadId, lead?.phone, lead?.lid]);

  if (!isOpen) return null;

  const cog = cognitive;
  const topInsight = insights[0];
  const profileMems = memories.slice(0, 6);

  return (
    <div
      className="fixed inset-0 flex justify-end transition-all duration-500"
      style={{ 
        background: isAtlasMapActive ? "transparent" : "rgba(0,0,0,0.7)", 
        backdropFilter: isAtlasMapActive ? "none" : "blur(6px)",
        zIndex: isAtlasMapActive ? 1 : 200,
        pointerEvents: isAtlasMapActive ? "none" : "auto"
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 220 }}
        className={`h-full w-full max-w-[1400px] flex flex-col font-sans overflow-hidden border-l ${
          isDark ? 'bg-[#050505] text-slate-100 border-white/[0.06]' : 'bg-[var(--orbit-bg)] text-[var(--orbit-text)] border-[var(--orbit-line)]'
        }`}
      >
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className={`w-8 h-8 animate-spin ${isDark ? 'text-[#d4af35]' : 'text-[var(--orbit-glow)]'}`} />
              <span className={`text-xs uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-[var(--orbit-text-muted)]'}`}>Carregando...</span>
            </div>
          </div>
        ) : (
          <>
            {/* ── TOP BAR ── */}
            <header className="shrink-0 px-2 md:px-6 py-2 md:py-4">
              <div className={`${glass} rounded-xl px-3 md:px-6 py-2 md:py-3 flex items-center justify-between shadow-2xl gap-3 overflow-x-auto custom-scrollbar`}>
                
                {/* Left: close + lead info */}
                <div className="flex items-center gap-5">
                  <button
                    onClick={onClose}
                    className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                      isDark ? 'bg-white/5 border border-white/10 hover:bg-white/10' : 'bg-white border border-[var(--orbit-line)] hover:bg-gray-50 shadow-sm'
                    }`}
                    title="Fechar"
                  >
                    <X className={`w-4 h-4 ${isDark ? 'text-white' : 'text-[var(--orbit-text)]'}`} />
                  </button>

                  <div className={`h-7 w-px ${isDark ? 'bg-white/10' : 'bg-[var(--orbit-line)]'}`} />

                  <div className="flex items-center gap-3">
                    <div className="relative">
                      {lead?.photo_url ? (
                        <img
                          src={lead.photo_url}
                          className={`w-10 h-10 rounded-full border object-cover ${isDark ? 'border-[#d4af35]/30' : 'border-[var(--orbit-glow)]/30'}`}
                          alt=""
                        />
                      ) : (
                        <div className={`w-10 h-10 rounded-full border flex items-center justify-center text-sm font-bold ${
                          isDark ? 'border-[#d4af35]/30 bg-[#d4af35]/10 text-[#d4af35]' : 'border-[var(--orbit-glow)]/30 bg-[var(--orbit-glow)]/10 text-[var(--orbit-glow)]'
                        }`}>
                          {getInitials(lead?.name || null)}
                        </div>
                      )}
                      <div className={`absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 ${isDark ? 'border-[#050505]' : 'border-white'}`} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{lead?.name || "—"}</p>
                      <div className="relative">
                        <button
                          onClick={() => setShowStageDropdown(prev => !prev)}
                          className={`text-[10px] font-medium uppercase tracking-wider transition-colors cursor-pointer ${
                            isDark ? 'text-[#d4af35]/70 hover:text-[#d4af35]' : 'text-[var(--orbit-glow)]/70 hover:text-[var(--orbit-glow)]'
                          }`}
                        >
                          {humanStage(lead?.orbit_stage)}
                        </button>
                        {showStageDropdown && (
                          <div
                            className={`absolute top-6 left-0 z-50 border rounded-xl shadow-2xl p-2 flex flex-col gap-0.5 min-w-[180px] ${
                              isDark ? 'bg-[#0a0a0c] border-white/10' : 'bg-white border-[var(--orbit-line)]'
                            }`}
                            onMouseLeave={() => setShowStageDropdown(false)}
                          >
                            {Object.entries(STAGE_LABELS).filter(([k]) =>
                              !["ativo","quente","frio","decidindo","negociando","explorando","comparando","fechado","perdido","novo"].includes(k)
                            ).map(([key, label]) => (
                              <button
                                key={key}
                                onClick={async () => {
                                  const supabase = getSupabase();
                                  await (supabase.from("leads") as any)
                                    .update({ orbit_stage: key })
                                    .eq("id", leadId);
                                  setLead(prev => prev ? { ...prev, orbit_stage: key } : prev);
                                  setShowStageDropdown(false);
                                }}
                                className={`text-left text-[11px] px-3 py-1.5 rounded-lg transition-colors ${
                                  isDark ? 'hover:bg-white/5 text-slate-300 hover:text-[#d4af35]' : 'hover:bg-[var(--orbit-bg-secondary)] text-[var(--orbit-text)] hover:text-[var(--orbit-glow)]'
                                }`}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                   <div className={`h-7 w-px ${isDark ? 'bg-white/10' : 'bg-[var(--orbit-line)]'}`} />

                  <div>
                    <p className={`text-[9px] uppercase tracking-widest font-bold ${isDark ? 'text-slate-500' : 'text-[var(--orbit-text-muted)]'}`}>ORBIT 3.0</p>
                    <p className={`text-[9px] uppercase tracking-tight ${isDark ? 'text-slate-600' : 'text-[var(--orbit-text-muted)]/60'}`}>Cognitive Terminal</p>
                  </div>
                </div>

                {/* Center: 4 Cognitive Rings */}
                <div className="flex items-center gap-7">
                  <CognitiveRing value={cog?.interest_score ?? 0} label="Interesse" color={ringGold} />
                  <CognitiveRing value={cog?.momentum_score ?? 0} label="Momentum" color={ringGold} />
                  <CognitiveRing value={cog?.risk_score ?? 0} label="Risco" color="#ef4444" />
                  <CognitiveRing value={cog?.clarity_level ?? 0} label="Clareza" color={ringGold} />
                </div>

                {/* Right: last analysis */}
                <div className="flex items-center gap-3">
                  {cog?.last_ai_analysis_at && (
                    <div className="text-right">
                      <p className="text-[9px] text-slate-600 uppercase tracking-widest">Última análise</p>
                      <p className="text-[10px] text-slate-400">
                        {new Date(cog.last_ai_analysis_at).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider">
                      {humanCogState(cog?.current_state)}
                    </span>
                  </div>
                </div>
              </div>
            </header>

            {/* ── MAIN 3-COLUMN GRID ── */}
            <main className="flex-1 flex gap-0 md:gap-5 px-0 md:px-6 pb-0 md:pb-5 min-h-0 overflow-hidden">

              {/* ── LEFT PANEL ── */}
              <aside className="w-72 flex-col gap-4 overflow-y-auto shrink-0 pr-1 custom-scrollbar hidden md:flex">

                {/* Memória */}
                <div className={`${glass} rounded-xl p-5 flex flex-col gap-3`}>
                  <div className="flex items-center gap-2">
                    <Brain className={`w-4 h-4 ${isDark ? 'text-[#d4af35]' : 'text-[var(--orbit-glow)]'}`} />
                    <h3 className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-slate-300' : 'text-[var(--orbit-text)]'}`}>Memória do Cliente</h3>
                  </div>
                  {profileMems.length === 0 ? (
                    <p className={`text-xs italic ${isDark ? 'text-slate-600' : 'text-[var(--orbit-text-muted)]'}`}>Nenhuma memória registrada ainda.</p>
                  ) : (
                    <div className="space-y-2">
                      {profileMems.map(m => (
                        <div key={m.id} className={`rounded-lg p-3 border ${isDark ? 'bg-white/4 border-white/5' : 'bg-[var(--orbit-bg-secondary)] border-[var(--orbit-line)]'}`}>
                          <p className={`text-[9px] uppercase font-bold mb-1 tracking-wider ${isDark ? 'text-slate-500' : 'text-[var(--orbit-text-muted)]'}`}>
                            {m.type.replace(/_/g, " ")}
                          </p>
                          <p className={`text-xs font-medium leading-snug ${isDark ? 'text-slate-200' : 'text-[var(--orbit-text)]'}`}>{m.content}</p>
                          {m.confidence && (
                            <div className={`mt-1.5 h-0.5 rounded-full overflow-hidden ${isDark ? 'bg-white/5' : 'bg-gray-200'}`}>
                              <div
                                className={`h-full rounded-full ${isDark ? 'bg-[#d4af35]/60' : 'bg-[var(--orbit-glow)]/60'}`}
                                style={{ width: `${m.confidence * 100}%` }}
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Insights Cognitivos */}
                <div className={`${glass} rounded-xl p-5 flex flex-col gap-3`}>
                  <div className="flex items-center gap-2">
                    <Zap className={`w-4 h-4 ${isDark ? 'text-[#d4af35]' : 'text-[var(--orbit-glow)]'}`} />
                    <h3 className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-slate-300' : 'text-[var(--orbit-text)]'}`}>Insights Cognitivos</h3>
                  </div>
                  {topInsight ? (
                    <div className="space-y-3">
                      <div className={`p-3 border-l-2 rounded-r-lg ${
                        isDark ? 'border-[#d4af35] bg-[#d4af35]/5' : 'border-[var(--orbit-glow)] bg-[var(--orbit-glow)]/5'
                      }`}>
                        <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-200' : 'text-[var(--orbit-text)]'}`}>{topInsight.content}</p>
                        <p className={`text-[10px] mt-1.5 font-bold uppercase tracking-wider ${
                          isDark ? 'text-[#d4af35]/60' : 'text-[var(--orbit-glow)]/70'
                        }`}>
                          Urgência: {topInsight.urgency}%
                        </p>
                      </div>
                      {insights.length > 1 && (
                        <div className="space-y-1.5">
                          {insights.slice(1).map(ins => (
                            <div key={ins.id} className={`text-[11px] pl-2 border-l ${isDark ? 'text-slate-500 border-white/5' : 'text-[var(--orbit-text-muted)] border-[var(--orbit-line)]'}`}>
                              {ins.content.slice(0, 80)}…
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className={`text-xs italic ${isDark ? 'text-slate-600' : 'text-[var(--orbit-text-muted)]'}`}>Sem insights recentes.</p>
                  )}

                  {/* NOVO: Conflito Central e What Not To Do */}
                  {(cog?.central_conflict || cog?.what_not_to_do) && (
                    <div className="mt-2 space-y-2 border-t border-white/5 pt-3">
                      {cog.central_conflict && (
                        <div className="bg-red-500/5 border border-red-500/20 p-2.5 rounded-lg space-y-1">
                          <p className="text-[9px] font-bold text-red-500 uppercase tracking-widest">Conflito Central</p>
                          <p className="text-[11px] text-red-200 leading-snug">{cog.central_conflict}</p>
                        </div>
                      )}
                      
                      {cog.what_not_to_do && (
                        <div className="bg-orange-500/5 border border-orange-500/20 p-2.5 rounded-lg space-y-1">
                          <p className="text-[9px] font-bold text-orange-500 uppercase tracking-widest">O Que Não Fazer</p>
                          <p className="text-[11px] text-orange-200 leading-snug">{cog.what_not_to_do}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

              </aside>

              {/* ── CENTRAL AREA: Chat ── */}
              <section className={`flex-1 flex-col ${glass} rounded-none md:rounded-xl overflow-hidden min-w-0 ${isMobile && activeMobileTab !== "chat" ? 'hidden' : 'flex'}`}>
                {/* Chat stream */}
                <div className="flex-1 overflow-y-auto p-3 md:p-5 flex flex-col gap-4 custom-scrollbar min-h-0">
                  {messages.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center gap-3 opacity-30">
                      <Brain className={`w-10 h-10 ${isDark ? 'text-[#d4af35]/40' : 'text-[var(--orbit-glow)]/40'}`} />
                      <p className={`text-sm font-mono ${isDark ? 'text-slate-500' : 'text-[var(--orbit-text-muted)]'}`}>Nenhuma interação registrada</p>
                    </div>
                  ) : (
                    groupedItems.map((item, idx) => {
                      if ("isDateSeparator" in item && item.isDateSeparator) {
                        return (
                          <div key={item.id} className="flex items-center gap-4 my-4">
                            <div className={`h-px flex-1 ${isDark ? 'bg-white/5' : 'bg-gray-100'}`} />
                            <span className={`text-[10px] font-bold uppercase tracking-[0.2em] ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                              {item.dateLabel}
                            </span>
                            <div className={`h-px flex-1 ${isDark ? 'bg-white/5' : 'bg-gray-100'}`} />
                          </div>
                        );
                      }
                      if ("isImageGroup" in item && item.isImageGroup) {
                        return <ImageGroupBubble key={item.id} group={item} leadPhoto={lead?.photo_url || null} leadName={lead?.name || null} />;
                      }
                      return <MessageBubble key={item.id + idx} msg={item as Message} leadPhoto={lead?.photo_url || null} leadName={lead?.name || null} />;
                    })
                  )}
                  <div ref={bottomRef} style={{ overflowAnchor: "none" }} />
                </div>

                {/* ── Composer ── */}
                <div className={`px-3 md:px-5 py-3 md:py-4 border-t ${
                  isDark ? 'border-white/[0.06] bg-black/30' : 'border-[var(--orbit-line)] bg-[var(--orbit-bg-secondary)]'
                }`}>
                  {/* Recording indicator */}
                  {isRecording && (
                    <div className="mb-3 flex items-center gap-3 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-xl">
                      <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      <span className="text-xs text-red-400 font-mono">
                        Gravando… {String(Math.floor(recordingSeconds / 60)).padStart(2, "0")}:{String(recordingSeconds % 60).padStart(2, "0")}
                      </span>
                      <button onClick={stopRecording} className="ml-auto flex items-center gap-1 text-red-400 hover:text-red-300 text-[11px] font-bold">
                        <StopCircle className="w-4 h-4" /> Parar
                      </button>
                    </div>
                  )}

                  {/* AI autocomplete chip */}
                  {aiSuggestion && !isRecording && (
                    <div className="mb-3 flex items-start gap-2">
                      <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider pt-1.5 shrink-0">IA:</span>
                      <button
                        onClick={() => setComposerText(aiSuggestion)}
                        className="text-left bg-white/5 hover:bg-[#d4af35]/10 border border-white/10 hover:border-[#d4af35]/30 rounded-full px-3 py-1 text-xs text-slate-300 hover:text-[#d4af35] transition-all line-clamp-1 max-w-[90%]"
                      >
                        "{aiSuggestion.slice(0, 80)}{aiSuggestion.length > 80 ? "…" : ""}"
                      </button>
                    </div>
                  )}

                  {/* Hidden file input */}
                  <input ref={fileInputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileChange} />

                  <div className="flex items-end gap-3 pb-1">
                    {/* File attach */}
                    <button
                      onClick={handleFileAttach}
                      title="Anexar imagem ou arquivo"
                      className={`w-9 h-9 rounded-full flex items-center justify-center transition-all shrink-0 mb-[1px] ${
                        isDark 
                          ? 'bg-white/5 border border-white/10 text-slate-400 hover:text-[#d4af35] hover:border-[#d4af35]/30' 
                          : 'bg-white border border-[var(--orbit-line)] text-[var(--orbit-text-muted)] hover:text-[var(--orbit-glow)] hover:border-[var(--orbit-glow)]/30 shadow-sm'
                      }`}
                    >
                      <Paperclip className="w-4 h-4" />
                    </button>

                    {/* Attach property */ }
                    <button
                      onClick={() => {
                        const url = `/atlas?leadId=${lead?.id}&tab=acervo`;
                        window.open(url, "_blank");
                      }}
                      title="Anexar imóvel"
                      className={`w-9 h-9 rounded-full border flex items-center justify-center transition-all shrink-0 mb-[1px] ${
                        isDark 
                          ? 'bg-white/5 border border-white/10 text-slate-400 hover:text-[#d4af35] hover:border-[#d4af35]/30' 
                          : 'bg-white border border-[var(--orbit-line)] text-[var(--orbit-text-muted)] hover:text-[var(--orbit-glow)] hover:border-[var(--orbit-glow)]/30 shadow-sm'
                      }`}
                    >
                      <Building2 className="w-4 h-4" />
                    </button>

                    {/* Main Interaction UI - Refactored for Modes */}
                    <div className="flex-1 flex flex-col gap-3">
                      {/* Tabs */}
                      <div className={`flex items-center gap-1 p-1 border rounded-xl w-fit ${
                        isDark ? 'bg-white/5 border-white/10' : 'bg-[var(--orbit-bg)] border-[var(--orbit-line)]'
                      }`}>
                        <button
                          onClick={() => setInteractionMode("whatsapp")}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all ${
                            interactionMode === "whatsapp" 
                              ? isDark ? "bg-[#2ec5ff] text-black shadow-[0_0_12px_rgba(46,197,255,0.4)]" : "bg-[var(--orbit-glow)] text-white shadow-sm"
                              : isDark ? "text-slate-400 hover:text-white" : "text-[var(--orbit-text-muted)] hover:text-[var(--orbit-glow)]"
                          }`}
                        >
                          <Zap className="w-3 h-3" /> WhatsApp
                        </button>
                        <button
                          onClick={() => setInteractionMode("note")}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all ${
                            interactionMode === "note" 
                              ? isDark ? "bg-[#d4af35] text-black shadow-[0_0_12px_rgba(212,175,53,0.4)]" : "bg-[var(--orbit-glow)] text-white shadow-sm"
                              : isDark ? "text-slate-400 hover:text-white" : "text-[var(--orbit-text-muted)] hover:text-[var(--orbit-glow)]"
                          }`}
                        >
                          <Star className="w-3 h-3" /> Anotação
                        </button>
                        <button
                          onClick={() => setInteractionMode("call")}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all ${
                            interactionMode === "call" 
                              ? isDark ? "bg-emerald-500 text-black shadow-[0_0_12px_rgba(16,185,129,0.4)]" : "bg-emerald-500 text-white shadow-sm"
                              : isDark ? "text-slate-400 hover:text-white" : "text-[var(--orbit-text-muted)] hover:text-emerald-500"
                          }`}
                        >
                          <Mic className="w-3 h-3" /> Ligação
                        </button>
                      </div>

                      {/* Call Status Selector */}
                      <AnimatePresence>
                        {interactionMode === "call" && (
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="flex items-center gap-4 overflow-hidden"
                          >
                            <label className="flex items-center gap-2 cursor-pointer group">
                              <input 
                                type="radio" 
                                checked={callStatus === "attended"} 
                                onChange={() => setCallStatus("attended")}
                                className="hidden"
                              />
                              <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center transition-all ${callStatus === "attended" ? "border-emerald-500" : "border-slate-600 group-hover:border-slate-500"}`}>
                                {callStatus === "attended" && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                              </div>
                              <span className={`text-[10px] font-bold uppercase tracking-wider ${callStatus === "attended" ? "text-emerald-400" : "text-slate-500"}`}>Atendida</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer group">
                              <input 
                                type="radio" 
                                checked={callStatus === "missed"} 
                                onChange={() => setCallStatus("missed")}
                                className="hidden"
                              />
                              <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center transition-all ${callStatus === "missed" ? "border-red-500" : "border-slate-600 group-hover:border-slate-500"}`}>
                                {callStatus === "missed" && <div className="w-1.5 h-1.5 rounded-full bg-red-500" />}
                              </div>
                              <span className={`text-[10px] font-bold uppercase tracking-wider ${callStatus === "missed" ? "text-red-400" : "text-slate-500"}`}>Não Atendida</span>
                            </label>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <textarea
                        ref={textareaRef}
                        name="message"
                        lang="pt-BR"
                        rows={1}
                        autoComplete="on"
                        autoCorrect="on"
                        spellCheck={true}
                        autoCapitalize="sentences"
                        className={`border rounded-xl px-4 py-2.5 text-sm focus:outline-none transition-all disabled:opacity-50 resize-none min-h-[42px] max-h-[200px] overflow-y-auto leading-relaxed ${
                          isDark ? 'bg-white/5 text-slate-100 placeholder:text-slate-500' : 'bg-[var(--orbit-bg)] text-[var(--orbit-text)] placeholder:text-[var(--orbit-text-muted)]'
                        } ${
                          interactionMode === 'note' ? 'border-[#d4af35]/40 focus:border-[#d4af35]' :
                          interactionMode === 'call' ? 'border-emerald-500/40 focus:border-emerald-500' :
                          isDark ? 'border-white/10 focus:border-[#2ec5ff]/40' : 'border-[var(--orbit-line)] focus:border-[var(--orbit-glow)]/40'
                        }`}
                        placeholder={
                          isTranscribing ? "Processando transcrição…" :
                          isRecording ? "Gravando áudio…" : 
                          interactionMode === "note" ? "Descreva o que aconteceu (reunião, anotação importante)…" : 
                          interactionMode === "call" ? (callStatus === "attended" ? "Resumo da conversa ocorrida..." : "O que aconteceu na ligação não atendida?") :
                          "Digite sua mensagem do WhatsApp…"
                        }
                        value={composerText}
                        disabled={isRecording}
                        onChange={e => setComposerText(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                          }
                        }}
                      />
                    </div>

                    {/* Mic — toggles recording */}
                    {/* Mic — toggles recording */}
                    <button
                      onClick={isRecording ? stopRecording : startRecording}
                      title={isRecording ? "Parar gravação" : "Gravar áudio"}
                      className={`w-9 h-9 rounded-full border flex items-center justify-center transition-all shrink-0 mb-[2px] ${
                        isTranscribing
                          ? isDark ? "bg-[#2ec5ff]/80 border-[#2ec5ff] text-white" : "bg-[var(--orbit-glow)] border-[var(--orbit-glow)] text-white"
                          : isRecording
                            ? "bg-red-500 border-red-500 text-white animate-pulse"
                            : isDark ? "bg-white/5 border-white/10 text-slate-400 hover:text-white hover:border-white/30" : "bg-white border-[var(--orbit-line)] text-[var(--orbit-text-muted)] hover:text-[var(--orbit-text)] hover:border-[var(--orbit-glow)]/40 shadow-sm"
                      }`}
                    >
                      {isTranscribing ? <Loader2 className="w-4 h-4 animate-spin" /> : 
                       isRecording ? <Square className="w-3.5 h-3.5 fill-current" /> : 
                       <Mic className="w-4 h-4" />}
                    </button>

                    {/* Send */}
                     <button
                       onClick={handleSend}
                      disabled={!composerText.trim() || sendStatus === "sending" || isRecording}
                      className={`w-9 h-9 rounded-full flex items-center justify-center transition-all shrink-0 mb-[2px] ${
                        sendStatus === "done" ? "bg-emerald-500 text-black" :
                        composerText.trim() && !isRecording 
                          ? isDark ? "bg-[#d4af35] text-black shadow-[0_0_14px_rgba(212,175,53,0.3)]" : "bg-[var(--orbit-glow)] text-white shadow-[var(--orbit-shadow)]"
                          : isDark ? "bg-white/5 text-white/20" : "bg-gray-100 text-gray-400"
                      }`}
                    >
                      {sendStatus === "sending" ? <Loader2 className="w-4 h-4 animate-spin" /> :
                       sendStatus === "done" ? <Check className="w-4 h-4" /> :
                       <ArrowUp className="w-4 h-4" />}
                    </button>
                  </div>

                  <p className={`text-[9px] text-center mt-2 tracking-widest uppercase ${isDark ? 'text-slate-700' : 'text-[var(--orbit-text-muted)]'}`}>
                    {lead?.phone ? `WhatsApp · ${lead.phone}` : "Sem número — gravando internamente"}
                  </p>
                </div>
              </section>

              {/* ── RIGHT PANEL (Hidden on mobile if "chat" is active, visible on MD) ── */}
              <aside className={`flex flex-col gap-4 overflow-y-auto shrink-0 custom-scrollbar ${
                isMobile 
                  ? (activeMobileTab === "info" ? "w-full focus:outline-none p-4" : "hidden") 
                  : "w-[280px] p-0 border-l border-white/5"
              }`}>

                {/* Seções da direita originais... vamos garantir padding correto */}
                <div className="p-4 flex flex-col gap-4">
                  {/* Próxima Melhor Ação */}
                  <div className={`${glass} border rounded-xl p-5 ${isDark ? 'border-[#d4af35]/15' : 'border-[var(--orbit-line)]'}`}>
                    <div className="flex items-center gap-2 mb-4">
                      <Star className={`w-4 h-4 ${isDark ? 'text-[#d4af35]' : 'text-[var(--orbit-glow)]'}`} />
                      <h3 className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-slate-300' : 'text-[var(--orbit-text)]'}`}>Próxima Melhor Ação</h3>
                    </div>

                    {lead?.action_suggested ? (
                    <div className={`p-3 border rounded-lg mb-4 ${
                      isDark ? 'bg-[#d4af35]/8 border-[#d4af35]/15' : 'bg-[var(--orbit-glow)]/5 border-[var(--orbit-glow)]/10'
                    }`}>
                      <p className={`text-sm font-semibold mb-1 leading-snug ${isDark ? 'text-[#d4af35]' : 'text-[var(--orbit-glow)]'}`}>
                        {cog?.current_state === "deciding" ? "🎯 Acionar Agora" : "💡 Ação Recomendada"}
                      </p>
                      <p className={`text-[11px] leading-relaxed ${isDark ? 'text-slate-300' : 'text-[var(--orbit-text)]'}`}>{lead.action_suggested || "Nenhuma ação sugerida"}</p>
                    </div>
                  ) : (
                    <div className={`p-3 border rounded-lg mb-4 ${isDark ? 'bg-white/3 border-white/5' : 'bg-gray-50 border-[var(--orbit-line)]'}`}>
                      <p className={`text-[11px] italic ${isDark ? 'text-slate-600' : 'text-[var(--orbit-text-muted)]'}`}>Aguardando dados suficientes para recomenda …</p>
                    </div>
                  )}

                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => {
                        const phone = lead?.phone?.replace(/\D/g, "") || lead?.lid?.replace(/\D/g, "");
                        if (!phone) return;
                        const text = aiSuggestion ? encodeURIComponent(aiSuggestion) : "";
                        window.open(`https://wa.me/${phone}${text ? `?text=${text}` : ""}`, "_blank");
                      }}
                      className={`w-full py-2.5 rounded-lg font-bold text-[10px] uppercase tracking-widest transition-all ${
                        isDark ? 'bg-[#d4af35] text-black hover:brightness-110' : 'bg-[var(--orbit-glow)] text-white hover:brightness-110 shadow-sm'
                      }`}
                    >
                      Abrir WhatsApp
                    </button>
                    <button
                      onClick={() => { if (aiSuggestion) setComposerText(aiSuggestion); }}
                      className={`w-full border py-2.5 rounded-lg font-bold text-[10px] uppercase tracking-widest transition-all ${
                        isDark ? 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10' : 'bg-white border-[var(--orbit-line)] text-[var(--orbit-text)] hover:bg-gray-50 shadow-sm'
                      }`}
                    >
                      Usar Sugestão da IA
                    </button>
                  </div>
                </div>
              </div>

                {/* Orbit Selection — protagonista */}
                <div className="flex-1 min-h-0 p-4 pt-0">
                  {leadId && <OrbitSelectionPanel leadId={leadId} />}
                </div>

              </aside>
            </main>

            {/* Mobile Bottom Navigation */}
            {isMobile && (
              <div className={`flex items-center justify-around h-[68px] shrink-0 border-t pb-safe ${
                isDark ? 'bg-[#050505] border-white/10' : 'bg-[var(--orbit-bg)] border-[var(--orbit-line)]'
              }`}>
                <button
                  onClick={() => setActiveMobileTab("chat")}
                  className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all ${
                    activeMobileTab === "chat" 
                      ? (isDark ? 'text-[#d4af35]' : 'text-[var(--orbit-glow)]')
                      : (isDark ? 'text-slate-500 hover:text-slate-300' : 'text-[var(--orbit-text-muted)] hover:text-[var(--orbit-glow)]')
                  }`}
                >
                  <MessageSquare className="w-5 h-5" />
                  <span className="text-[10px] font-bold uppercase tracking-wider mt-0.5">Chat</span>
                </button>
                <div className={`w-px h-6 ${isDark ? 'bg-white/10' : 'bg-[var(--orbit-line)]'}`} />
                <button
                  onClick={() => setActiveMobileTab("info")}
                  className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all ${
                    activeMobileTab === "info" 
                      ? (isDark ? 'text-[#d4af35]' : 'text-[var(--orbit-glow)]')
                      : (isDark ? 'text-slate-500 hover:text-slate-300' : 'text-[var(--orbit-text-muted)] hover:text-[var(--orbit-glow)]')
                  }`}
                >
                  <Building2 className="w-5 h-5" />
                  <span className="text-[10px] font-bold uppercase tracking-wider mt-0.5">Info & Imóveis</span>
                </button>
              </div>
            )}

            {/* Footer status bar (Hidden on mobile to save space) */}
            <div className="hidden md:flex px-6 pb-3 items-center gap-3 shrink-0">
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full border ${
                isDark ? 'bg-black/40 border-white/5' : 'bg-gray-100/50 border-[var(--orbit-line)]'
              }`}>
                <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${isDark ? 'bg-[#d4af35]' : 'bg-[var(--orbit-glow)]'}`} />
                <span className={`text-[9px] uppercase tracking-[0.2em] font-bold ${isDark ? 'text-slate-500' : 'text-[var(--orbit-text-muted)]'}`}>Atlas Neural Network Linked</span>
              </div>
              {lead?.last_interaction_at && (
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full border ${
                  isDark ? 'bg-black/40 border-white/5' : 'bg-gray-100/50 border-[var(--orbit-line)]'
                }`}>
                  <span className={`text-[9px] ${isDark ? 'text-slate-600' : 'text-[var(--orbit-text-muted)]'}`}>
                    Último contato: {new Date(lead.last_interaction_at).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              )}
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
