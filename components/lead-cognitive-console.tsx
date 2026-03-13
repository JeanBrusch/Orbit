"use client";

import { useRef, useState, useEffect, useCallback, memo, useMemo } from "react";
import {
  X, ArrowUp, Play, Loader2, Check, Brain,
  Mic, Zap, Star, Building2, ExternalLink, Copy, CheckCheck,
  Square, Paperclip, Search, StopCircle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getSupabase } from "@/lib/supabase";
import { useOrbitContext } from "./orbit-context";

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
  source: "whatsapp" | "operator";
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
const CognitiveRing = memo(function CognitiveRing({ value, label, color = "#d4af35" }: { value: number; label: string; color?: string }) {
  const r = 18;
  const circ = 2 * Math.PI * r;
  const offset = circ - ((Math.min(100, Math.max(0, value)) / 100) * circ);
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative flex items-center justify-center">
        <svg className="w-10 h-10 -rotate-90" viewBox="0 0 40 40">
          <circle cx="20" cy="20" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />
          <circle cx="20" cy="20" r={r} fill="none" stroke={color} strokeWidth="2"
            strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
        </svg>
        <span className="absolute text-[10px] font-bold text-white">{Math.round(value)}%</span>
      </div>
      <span className="text-[9px] uppercase tracking-widest text-slate-400">{label}</span>
    </div>
  );
});

// ─── Audio Waveform ────────────────────────────────────────────────────────────
function AudioWaveform() {
  const bars = useRef(Array.from({ length: 16 }, () => Math.random() * 70 + 10));
  return (
    <div className="flex items-center gap-0.5 h-8 flex-1">
      {bars.current.map((h, i) => (
        <div key={i} className="w-0.5 rounded-full bg-[#d4af35]/60" style={{ height: `${h}%` }} />
      ))}
    </div>
  );
}

// ─── Message Bubble ────────────────────────────────────────────────────────────
const MessageBubble = memo(function MessageBubble({ msg, leadPhoto, leadName }: { msg: Message; leadPhoto: string | null; leadName: string | null }) {
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
    if (p.type && p.url) { mediaType = p.type; mediaUrl = p.url; text = p.caption || ""; }
    else if (p.type && p.summary) { manualKind = p.type; text = p.summary; manualNextContact = p.next_contact_at; }
    else if (p.type === "property") {
      return (
        <div className="flex flex-col items-end gap-1 self-end max-w-[80%]">
          <div className="flex bg-[#d4af35]/10 border border-[#d4af35]/30 rounded-2xl rounded-tr-none overflow-hidden max-w-[280px]">
            {p.cover_image && p.cover_image !== "null" && (
              <div className="w-20 shrink-0 bg-black/40">
                <img src={p.cover_image} className="w-full h-full object-cover" alt={p.title} />
              </div>
            )}
            <div className="p-3 flex flex-col justify-center">
              <span className="text-[10px] text-[#d4af35] uppercase font-bold tracking-wider mb-0.5">Vincular Imóvel</span>
              <span className="text-sm font-medium text-slate-200 line-clamp-2 leading-tight">{p.title}</span>
              {p.value && <span className="text-xs text-slate-400 mt-1">R$ {(p.value / 1000000).toFixed(1)}M</span>}
            </div>
          </div>
          <span className="text-[10px] text-slate-500 mr-1">{formatTime(msg.timestamp)}</span>
        </div>
      );
    }
  } catch { /* not JSON */ }

  const signalBorder = signal === "positive" ? "border-l-emerald-500"
    : signal === "negative" ? "border-l-red-400" : "border-l-white/10";

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
      <div className="flex justify-center my-1">
        <div className="flex items-start gap-3 bg-[#d4af35]/5 border border-[#d4af35]/20 rounded-xl px-4 py-3 max-w-[80%]">
          <span className="text-base">{meta.iconChar}</span>
          <div>
            <p className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 ${meta.colorClass}`}>{meta.label}</p>
            <p className="text-xs text-slate-300">{text}</p>
            {manualNextContact && (
              <p className="text-[10px] text-[#d4af35]/60 mt-1">
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
        <div className="w-8 h-8 rounded-full border border-white/10 shrink-0 overflow-hidden bg-[#d4af35]/20 flex items-center justify-center text-[10px] font-bold text-[#d4af35]">
          {leadPhoto ? <img src={leadPhoto} className="w-full h-full object-cover" alt="" /> : getInitials(leadName)}
        </div>
        <div className="flex flex-col gap-1">
          <div className={`bg-white/5 border border-white/5 border-l-2 ${signalBorder} rounded-2xl rounded-tl-none px-4 py-3 text-sm leading-relaxed`}>
            {mediaType === "audio" ? (
              <div className="flex items-center gap-3 min-w-[240px]">
                <button className="w-8 h-8 rounded-full bg-[#d4af35] flex items-center justify-center shrink-0 hover:brightness-110 transition-all">
                  <Play className="h-3.5 w-3.5 fill-current text-black" />
                </button>
                <AudioWaveform />
                <Mic className="h-3 w-3 text-[#d4af35]/50 shrink-0" />
              </div>
            ) : (mediaType === "image" && mediaUrl) ? (
              <img src={mediaUrl} alt="" className="rounded-lg max-w-[240px] max-h-40 object-cover" />
            ) : (
              <p className="text-slate-200">{text || "[mídia]"}</p>
            )}
            {intention && (
              <div className={`mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-bold uppercase tracking-wide ${
                signal === "positive" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                signal === "negative" ? "bg-red-500/10 text-red-400 border-red-500/20" :
                "bg-blue-500/10 text-blue-400 border-blue-400/20"
              }`}>
                <Brain className="h-2.5 w-2.5" /> {intention}
              </div>
            )}
          </div>
          <span className="text-[10px] text-slate-500 ml-1">{formatTime(msg.timestamp)}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1 self-end max-w-[80%]">
      <div className="bg-[#d4af35]/10 border border-[#d4af35]/30 rounded-2xl rounded-tr-none px-4 py-3 text-sm leading-relaxed text-slate-200">
        {text}
      </div>
      <span className="text-[10px] text-slate-500 mr-1">{formatTime(msg.timestamp)}</span>
    </div>
  );
});

// ─── Property Card ──────────────────────────────────────────────────────────────
const PropertyCard = memo(function PropertyCard({ interaction }: { interaction: PropertyInteraction }) {
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
    <div className="flex items-center justify-between p-2.5 bg-white/5 hover:bg-white/8 rounded-xl border border-white/5 transition-colors group">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg overflow-hidden bg-zinc-800 shrink-0">
          {prop.cover_image
            ? <img src={prop.cover_image} alt="" className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center"><Building2 className="w-4 h-4 text-slate-600" /></div>
          }
        </div>
        <div>
          <p className="text-xs font-medium text-slate-200 truncate max-w-[130px]">{prop.title || "Imóvel"}</p>
          <p className="text-[10px] text-[#d4af35]/70">{formatValue(prop.value)}</p>
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
const glass = "bg-[rgba(12,12,12,0.85)] backdrop-blur-[16px] border border-white/[0.07]";

// ─── Main Component ────────────────────────────────────────────────────────────
export function LeadCognitiveConsole({ leadId, isOpen, onClose }: LeadCognitiveConsoleProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

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

  // Composer
  const [composerText, setComposerText] = useState("");
  const [sendStatus, setSendStatus] = useState<"idle" | "sending" | "done" | "error">("idle");

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
    const supabase = getSupabase();
    // Optimistic: show local object URL in chat
    const localUrl = URL.createObjectURL(file);
    const isImage = file.type.startsWith("image/");
    const optimistic: Message = {
      id: `opt-file-${Date.now()}`,
      source: "operator",
      content: JSON.stringify({ type: isImage ? "image" : "file", url: localUrl, caption: file.name }),
      timestamp: new Date().toISOString(),
      ai_analysis: null,
    };
    setMessages(prev => [...prev, optimistic]);
    // Persist as interaction
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from("interactions") as any).insert({
        lead_id: leadId,
        content: JSON.stringify({ type: isImage ? "image" : "file", url: localUrl, caption: file.name }),
        direction: "outbound",
        channel: "manual",
      });
    } catch { /* silent */ }
    // Clear file input
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [leadId]);

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

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        const optimistic: Message = {
          id: `opt-audio-${Date.now()}`,
          source: "operator",
          content: JSON.stringify({ type: "audio", url, caption: "" }),
          timestamp: new Date().toISOString(),
          ai_analysis: null,
        };
        setMessages(prev => [...prev, optimistic]);
        if (leadId) {
          const supabase = getSupabase();
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase.from("interactions") as any).insert({
              lead_id: leadId,
              content: JSON.stringify({ type: "audio", url, caption: "[Áudio gravado]" }),
              direction: "outbound",
              channel: "manual",
            });
          } catch { /* silent */ }
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
        .select("id,name,phone,photo_url,orbit_stage,action_suggested,last_interaction_at")
        .eq("id", leadId).single(),
      supabase.from("lead_cognitive_state")
        .select("interest_score,momentum_score,risk_score,clarity_level,current_state,last_ai_analysis_at")
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

    if (msgRes.data && msgRes.data.length > 0) {
      setMessages(msgRes.data as Message[]);
    } else {
      // Fallback to `interactions` table (older schema)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const intRes = await (supabase.from("interactions") as any)
        .select("id,content,created_at,direction")
        .eq("lead_id", leadId).order("created_at", { ascending: true }).limit(80);
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

    // Property interactions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const propRes = await (supabase.from("property_interactions") as any)
      .select("id,interaction_type,timestamp,property_id")
      .eq("lead_id", leadId).order("timestamp", { ascending: false }).limit(10);

    if (propRes.data && propRes.data.length > 0) {
      const propIds = [...new Set((propRes.data as any[]).map((i: any) => i.property_id).filter(Boolean))] as string[];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: props } = await (supabase.from("properties") as any)
        .select("id,title,cover_image,value,location_text,source_link")
        .in("id", propIds);
      const propMap = new Map(((props || []) as any[]).map((p: any) => [p.id, p]));
      setInteractions((propRes.data as any[]).map((i: any) => ({
        id: i.id,
        interaction_type: i.interaction_type,
        timestamp: i.timestamp,
        property: propMap.get(i.property_id || "") as PropertyInteraction["property"],
      })));
    } else {
      // Fallback to property_sends
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const psRes = await (supabase.from("property_sends") as any)
        .select("id,property_id,sent_at,lead_status,properties(title,cover_image,value,location_text,source_link)")
        .eq("lead_id", leadId).order("sent_at", { ascending: false }).limit(10);
      if (psRes.data) {
        setInteractions((psRes.data as any[]).map((i: any) => ({
          id: i.id,
          interaction_type: (i.lead_status as string) || "sent",
          timestamp: i.sent_at,
          property: {
            id: i.property_id,
            ...(i.properties as object | null ?? {}),
          } as PropertyInteraction["property"],
        })));
      }
    }

    // AI Suggestion
    try {
      const sugRes = await fetch(`/api/lead/${leadId}/suggest`);
      if (sugRes.ok) {
        const j = await sugRes.json();
        if (j.suggestion) setAiSuggestion(j.suggestion);
      }
    } catch { /* silent */ }

    setLoading(false);
  }, [leadId]);

  useEffect(() => {
    if (isOpen && leadId) {
      setLead(null);
      setCognitive(null);
      setMemories([]);
      setInsights([]);
      setMessages([]);
      setInteractions([]);
      setAiSuggestion(null);
      fetchAll();
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
              if (prev.some(m => m.id === incoming.id)) {
                // Update existing if it was an update (e.g. AI analysis added)
                return prev.map(m => m.id === incoming.id ? incoming : m);
              }
              return [...prev, incoming];
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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
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
      source: "operator",
      content: text,
      timestamp: new Date().toISOString(),
      ai_analysis: null,
    };
    setMessages(prev => [...prev, optimistic]);
    setComposerText("");

    try {
      // Prefer LID over phone for WhatsApp routing
      const sendTo =
        (lead?.lid ? (lead.lid.includes("@lid") ? lead.lid : `${lead.lid}@lid`) : null) ||
        lead?.phone;

      console.log("[COG] lead.lid:", lead?.lid);
      console.log("[COG] lead.phone:", lead?.phone);
      console.log("[COG] sendTo:", sendTo);

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

      // Log interaction for cognitive history
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from("interactions") as any).insert({
        lead_id: leadId,
        content: text,
        direction: "outbound",
        channel: "whatsapp",
      });

      setSendStatus("done");
      setTimeout(() => setSendStatus("idle"), 2000);
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
        className="h-full w-full max-w-[1400px] bg-[#050505] text-slate-100 flex flex-col font-sans overflow-hidden border-l border-white/[0.06]"
      >
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 text-[#d4af35] animate-spin" />
              <span className="text-xs text-slate-500 uppercase tracking-widest">Carregando...</span>
            </div>
          </div>
        ) : (
          <>
            {/* ── TOP BAR ── */}
            <header className="shrink-0 px-6 py-4">
              <div className={`${glass} rounded-xl px-6 py-3 flex items-center justify-between shadow-2xl`}>
                
                {/* Left: close + lead info */}
                <div className="flex items-center gap-5">
                  <button
                    onClick={onClose}
                    className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors"
                    title="Fechar"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>

                  <div className="h-7 w-px bg-white/10" />

                  <div className="flex items-center gap-3">
                    <div className="relative">
                      {lead?.photo_url ? (
                        <img
                          src={lead.photo_url}
                          className="w-10 h-10 rounded-full border border-[#d4af35]/30 object-cover"
                          alt=""
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full border border-[#d4af35]/30 bg-[#d4af35]/10 flex items-center justify-center text-sm font-bold text-[#d4af35]">
                          {getInitials(lead?.name || null)}
                        </div>
                      )}
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#050505]" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{lead?.name || "—"}</p>
                      <p className="text-[11px] text-[#d4af35]/70 font-medium uppercase tracking-wider">
                        {humanStage(lead?.orbit_stage)}
                      </p>
                    </div>
                  </div>

                  <div className="h-7 w-px bg-white/10" />

                  <div>
                    <p className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">ORBIT 3.0</p>
                    <p className="text-[9px] text-slate-600 uppercase tracking-tight">Cognitive Terminal</p>
                  </div>
                </div>

                {/* Center: 4 Cognitive Rings */}
                <div className="flex items-center gap-7">
                  <CognitiveRing value={cog?.interest_score ?? 0} label="Interesse" color="#d4af35" />
                  <CognitiveRing value={cog?.momentum_score ?? 0} label="Momentum" color="#d4af35" />
                  <CognitiveRing value={cog?.risk_score ?? 0} label="Risco" color="#ef4444" />
                  <CognitiveRing value={cog?.clarity_level ?? 0} label="Clareza" color="#d4af35" />
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
            <main className="flex-1 flex gap-5 px-6 pb-5 min-h-0 overflow-hidden">

              {/* ── LEFT PANEL ── */}
              <aside className="w-72 flex flex-col gap-4 overflow-y-auto shrink-0 pr-1 custom-scrollbar">

                {/* Memória */}
                <div className={`${glass} rounded-xl p-5 flex flex-col gap-3`}>
                  <div className="flex items-center gap-2">
                    <Brain className="w-4 h-4 text-[#d4af35]" />
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-300">Memória do Cliente</h3>
                  </div>
                  {profileMems.length === 0 ? (
                    <p className="text-xs text-slate-600 italic">Nenhuma memória registrada ainda.</p>
                  ) : (
                    <div className="space-y-2">
                      {profileMems.map(m => (
                        <div key={m.id} className="bg-white/4 rounded-lg p-3 border border-white/5">
                          <p className="text-[9px] uppercase text-slate-500 font-bold mb-1 tracking-wider">
                            {m.type.replace(/_/g, " ")}
                          </p>
                          <p className="text-xs font-medium text-slate-200 leading-snug">{m.content}</p>
                          {m.confidence && (
                            <div className="mt-1.5 h-0.5 bg-white/5 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-[#d4af35]/60 rounded-full"
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
                    <Zap className="w-4 h-4 text-[#d4af35]" />
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-300">Insights Cognitivos</h3>
                  </div>
                  {topInsight ? (
                    <div className="space-y-3">
                      <div className="p-3 border-l-2 border-[#d4af35] bg-[#d4af35]/5 rounded-r-lg">
                        <p className="text-xs text-slate-200 leading-relaxed">{topInsight.content}</p>
                        <p className="text-[10px] text-[#d4af35]/60 mt-1.5 font-bold uppercase tracking-wider">
                          Urgência: {topInsight.urgency}%
                        </p>
                      </div>
                      {insights.length > 1 && (
                        <div className="space-y-1.5">
                          {insights.slice(1).map(ins => (
                            <div key={ins.id} className="text-[11px] text-slate-500 pl-2 border-l border-white/5">
                              {ins.content.slice(0, 80)}…
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-600 italic">Sem insights recentes.</p>
                  )}
                </div>

                {/* Imóveis Acessados */}
                <div className={`${glass} rounded-xl p-5 flex flex-col gap-3`}>
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-[#d4af35]" />
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-300">Imóveis Acessados</h3>
                  </div>
                  {interactions.length > 0 ? (
                    <div className="space-y-2">
                      {interactions.map(inter => (
                        <PropertyCard key={inter.id} interaction={inter} />
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-600 italic">Nenhum imóvel acessado.</p>
                  )}
                </div>

                  {/* Mini engagement chart based on insights urgency */}
                  <div className="flex flex-col gap-1.5 mt-1">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-slate-500">Atividade Cognitiva</span>
                      <span className="text-[10px] text-[#d4af35] font-bold">{insights.length} eventos</span>
                    </div>
                    <div className="h-8 flex items-end gap-1">
                      {(insights.length > 0 ? insights.slice(0, 6).reverse() : Array(6).fill({ urgency: 20 })).map((ins, i) => (
                        <div key={i} className="flex-1 rounded-sm transition-all"
                          style={{
                            height: `${Math.max(15, (ins as AiInsight).urgency ?? 20)}%`,
                            backgroundColor: i === 5 ? "#d4af35" : `rgba(212,175,53,${0.15 + i * 0.1})`,
                          }}
                        />
                      ))}
                    </div>
                  </div>
              </aside>

              {/* ── CENTRAL AREA: Chat ── */}
              <section className={`flex-1 flex flex-col ${glass} rounded-xl overflow-hidden min-w-0`}>
                {/* Chat stream */}
                <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4 custom-scrollbar min-h-0">
                  {messages.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center gap-3 opacity-30">
                      <Brain className="w-10 h-10 text-[#d4af35]/40" />
                      <p className="text-sm text-slate-500 font-mono">Nenhuma interação registrada</p>
                    </div>
                  ) : (
                    messages.map((msg, idx) => (
                      <MessageBubble key={msg.id + idx} msg={msg} leadPhoto={lead?.photo_url || null} leadName={lead?.name || null} />
                    ))
                  )}
                  <div ref={bottomRef} />
                </div>

                {/* ── Composer ── */}
                <div className="px-5 py-4 border-t border-white/[0.06] bg-black/30">
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

                  <div className="flex items-center gap-3">
                    {/* File attach */}
                    <button
                      onClick={handleFileAttach}
                      title="Anexar imagem ou arquivo"
                      className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-[#d4af35] hover:border-[#d4af35]/30 transition-all"
                    >
                      <Paperclip className="w-4 h-4" />
                    </button>

                    {/* Attach property */}
                    <button
                      onClick={() => invokeAtlasMap({ leadId: lead?.id, leadName: lead?.name || undefined, onPropertySelected: handleAttachProperty })}
                      title="Anexar imóvel"
                      className="w-9 h-9 rounded-full border bg-white/5 border-white/10 flex items-center justify-center text-slate-400 hover:text-[#d4af35] hover:border-[#d4af35]/30 transition-all"
                    >
                      <Building2 className="w-4 h-4" />
                    </button>

                    {/* Text input (Using textarea for better native autocorrect support) */}
                    <textarea
                      name="message"
                      lang="pt-BR"
                      rows={1}
                      autoComplete="on"
                      autoCorrect="on"
                      spellCheck={true}
                      autoCapitalize="sentences"
                      className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#d4af35]/40 placeholder-slate-600 transition-colors disabled:opacity-50 resize-none min-h-[42px] leading-relaxed"
                      placeholder={isRecording ? "Gravando áudio…" : "Digite sua mensagem inteligente…"}
                      value={composerText}
                      disabled={isRecording}
                      onChange={e => {
                        setComposerText(e.target.value);
                        // Auto-resize hint
                        e.target.style.height = 'inherit';
                        e.target.style.height = `${e.target.scrollHeight}px`;
                      }}
                      onKeyDown={e => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                          e.currentTarget.style.height = 'inherit';
                        }
                      }}
                    />

                    {/* Mic — toggles recording */}
                    <button
                      onClick={isRecording ? stopRecording : startRecording}
                      title={isRecording ? "Parar gravação" : "Gravar áudio"}
                      className={`w-9 h-9 rounded-full border flex items-center justify-center transition-all ${
                        isRecording
                          ? "bg-red-500 border-red-500 text-white animate-pulse"
                          : "bg-white/5 border-white/10 text-slate-400 hover:text-white hover:border-white/30"
                      }`}
                    >
                      {isRecording ? <Square className="w-3.5 h-3.5 fill-current" /> : <Mic className="w-4 h-4" />}
                    </button>

                    {/* Send */}
                     <button
                       onClick={handleSend}
                      disabled={!composerText.trim() || sendStatus === "sending" || isRecording}
                      className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                        sendStatus === "done" ? "bg-emerald-500 text-black" :
                        composerText.trim() && !isRecording ? "bg-[#d4af35] text-black shadow-[0_0_14px_rgba(212,175,53,0.3)]" :
                        "bg-white/5 text-white/20"
                      }`}
                    >
                      {sendStatus === "sending" ? <Loader2 className="w-4 h-4 animate-spin" /> :
                       sendStatus === "done" ? <Check className="w-4 h-4" /> :
                       <ArrowUp className="w-4 h-4" />}
                    </button>
                  </div>

                  <p className="text-[9px] text-center text-slate-700 mt-2 tracking-widest uppercase">
                    {lead?.phone ? `WhatsApp · ${lead.phone}` : "Sem número — gravando internamente"}
                  </p>
                </div>
              </section>

              {/* ── RIGHT PANEL ── */}
              <aside className="w-72 flex flex-col gap-4 overflow-y-auto shrink-0 custom-scrollbar">

                {/* Próxima Melhor Ação */}
                <div className={`${glass} border-[#d4af35]/15 border rounded-xl p-5`}>
                  <div className="flex items-center gap-2 mb-4">
                    <Star className="w-4 h-4 text-[#d4af35]" />
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-300">Próxima Melhor Ação</h3>
                  </div>

                  {lead?.action_suggested ? (
                    <div className="p-3 bg-[#d4af35]/8 border border-[#d4af35]/15 rounded-lg mb-4">
                      <p className="text-sm font-semibold text-[#d4af35] mb-1 leading-snug">
                        {cog?.current_state === "deciding" ? "🎯 Acionar Agora" : "💡 Ação Recomendada"}
                      </p>
                      <p className="text-[11px] text-slate-300 leading-relaxed">{lead.action_suggested || "Nenhuma ação sugerida"}</p>
                    </div>
                  ) : (
                    <div className="p-3 bg-white/3 border border-white/5 rounded-lg mb-4">
                      <p className="text-[11px] text-slate-600 italic">Aguardando dados suficientes para recomenda …</p>
                    </div>
                  )}

                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => {
                        if (lead?.phone) {
                          window.open(`https://wa.me/${lead.phone.replace(/\D/g, "")}`, "_blank");
                        }
                      }}
                      className="w-full bg-[#d4af35] py-2.5 rounded-lg text-black font-bold text-[10px] uppercase tracking-widest hover:brightness-110 transition-all"
                    >
                      Abrir WhatsApp
                    </button>
                    <button
                      onClick={() => { if (aiSuggestion) setComposerText(aiSuggestion); }}
                      className="w-full bg-white/5 border border-white/10 py-2.5 rounded-lg text-slate-300 font-bold text-[10px] uppercase tracking-widest hover:bg-white/10 transition-all"
                    >
                      Usar Sugestão da IA
                    </button>
                  </div>
                </div>

                {/* Escrita Inteligente */}
                <div className={`${glass} rounded-xl p-5`}>
                  <div className="flex items-center gap-2 mb-4">
                    <Zap className="w-4 h-4 text-[#d4af35]" />
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-300">Escrita Inteligente</h3>
                  </div>

                  <div className="bg-white/4 border border-white/5 rounded-lg p-3.5 mb-3 min-h-[60px]">
                    <p className="text-xs text-slate-400 italic leading-relaxed">
                      {aiSuggestion ? `"${aiSuggestion}"` : "Nenhuma sugestão gerada ainda."}
                    </p>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex gap-1">
                      {["Formal", "Conciso", "Direto"].map((tone, i) => (
                        <button key={tone}
                          className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${
                            i === 1
                              ? "bg-[#d4af35]/10 text-[#d4af35] border border-[#d4af35]/30"
                              : "text-slate-500 hover:text-[#d4af35]"
                          }`}
                        >
                          {tone}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={handleCopy}
                      className="text-[#d4af35] hover:brightness-110 flex items-center gap-1 transition-all"
                    >
                      {copied ? <CheckCheck className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span className="text-[10px] font-bold uppercase">{copied ? "Copiado!" : "Copiar"}</span>
                    </button>
                  </div>
                </div>

                {/* Histórico de Imóveis */}
                <div className={`${glass} rounded-xl p-5 flex-1`}>
                  <div className="flex items-center gap-2 mb-4">
                    <Building2 className="w-4 h-4 text-[#d4af35]" />
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-300">Imóveis Interagidos</h3>
                  </div>

                  {interactions.length === 0 ? (
                    <p className="text-xs text-slate-600 italic">Nenhum imóvel enviado ou interagido.</p>
                  ) : (
                    <div className="space-y-2">
                      {interactions.map(i => <PropertyCard key={i.id} interaction={i} />)}
                    </div>
                  )}
                </div>
              </aside>
            </main>

            {/* Footer status bar */}
            <div className="px-6 pb-3 flex items-center gap-3 shrink-0">
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-black/40 border border-white/5">
                <div className="w-1.5 h-1.5 rounded-full bg-[#d4af35] animate-pulse" />
                <span className="text-[9px] uppercase tracking-[0.2em] font-bold text-slate-500">Atlas Neural Network Linked</span>
              </div>
              {lead?.last_interaction_at && (
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-black/40 border border-white/5">
                  <span className="text-[9px] text-slate-600">
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
