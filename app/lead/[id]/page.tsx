"use client"

import { useState, useEffect, useRef, use, useCallback } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@supabase/supabase-js"
import { motion, AnimatePresence } from "framer-motion"
import {
  ArrowLeft, ArrowUp, Plus, Play, Loader2, Check, Brain,
  Phone, Home, Users, Calendar, FileText, Mic, Bell,
  Zap, Star, Clock, Building2, ExternalLink
} from "lucide-react"
import { ManualInteractionModal } from "@/components/lead-brain/manual-interaction-modal"

// ─── Supabase ─────────────────────────────────────────────────────────────────
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ─── Types ────────────────────────────────────────────────────────────────────
interface Lead {
  id: string
  name: string | null
  phone: string | null
  lid: string | null
  photo_url: string | null
  orbit_stage: string | null
  action_suggested: string | null
  last_interaction_at: string | null
}

interface CognitiveState {
  interest_score: number
  momentum_score: number
  risk_score: number
  clarity_level: number
  current_state: string
  last_ai_analysis_at: string | null
}

interface MemoryItem {
  id: string
  type: string
  content: string
  confidence: number | null
  created_at: string | null
}

interface AiInsight {
  id: string
  content: string
  urgency: number
  created_at: string | null
}

interface Message {
  id: string
  source: "whatsapp" | "operator"
  content: string | null
  timestamp: string
  ai_analysis: any | null
}

interface PropertyInteraction {
  id: string
  interaction_type: string
  timestamp: string
  property?: {
    id: string
    title: string | null
    cover_image: string | null
    value: number | null
    location_text: string | null
    source_link: string
  }
}

interface Reminder {
  id: string
  due_at: string
  type: string | null
  status: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatValue(v: number | null) {
  if (!v) return "—"
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `R$ ${Math.round(v / 1_000)}k`
  return `R$ ${v}`
}

function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
}

function formatRelative(ts: string | null) {
  if (!ts) return "—"
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return "agora"
  if (m < 60) return `${m}min atrás`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h atrás`
  return `${Math.floor(h / 24)}d atrás`
}

function getInitials(name: string | null) {
  if (!name) return "??"
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
}

// ─── Cognitive Ring ───────────────────────────────────────────────────────────
function CognitiveRing({ value, label, color = "#d4af35" }: { value: number; label: string; color?: string }) {
  const r = 18
  const circ = 2 * Math.PI * r
  const offset = circ - (value / 100) * circ
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative flex items-center justify-center">
        <svg className="w-10 h-10 -rotate-90" viewBox="0 0 40 40">
          <circle cx="20" cy="20" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />
          <circle cx="20" cy="20" r={r} fill="none" stroke={color} strokeWidth="2"
            strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
        </svg>
        <span className="absolute text-[10px] font-bold text-white">{value}%</span>
      </div>
      <span className="text-[9px] uppercase tracking-widest text-slate-400">{label}</span>
    </div>
  )
}

// ─── Audio Waveform ───────────────────────────────────────────────────────────
function AudioWaveform() {
  const bars = useRef(Array.from({ length: 18 }, () => Math.random() * 80 + 10))
  return (
    <div className="flex items-center gap-0.5 h-8 flex-1">
      {bars.current.map((h, i) => (
        <div key={i} className="w-0.5 rounded-full bg-[#d4af35]/70" style={{ height: `${h}%` }} />
      ))}
    </div>
  )
}

// ─── Message Bubble ───────────────────────────────────────────────────────────
function MessageBubble({ msg, leadPhoto, leadName }: { msg: Message; leadPhoto: string | null; leadName: string | null }) {
  const analysis = msg.ai_analysis as any
  const signal = analysis?.signal as string | undefined
  const intention = analysis?.intention as string | undefined

  // Parse content
  let text = msg.content || ""
  let mediaType: string | undefined
  let mediaUrl: string | undefined
  let manualKind: string | undefined
  let manualNextContact: string | undefined

  try {
    const p = JSON.parse(text)
    if (p.type && p.url) { mediaType = p.type; mediaUrl = p.url; text = p.caption || "" }
    else if (p.type && p.summary) { manualKind = p.type; text = p.summary; manualNextContact = p.next_contact_at }
  } catch { }

  const signalBorder = signal === "positive" ? "border-l-emerald-500" : signal === "negative" ? "border-l-red-400" : "border-l-white/10"

  const MANUAL_ICONS: Record<string, any> = {
    call: { Icon: Phone, color: "text-emerald-400", label: "Ligação" },
    visit: { Icon: Home, color: "text-[#d4af35]", label: "Visita" },
    meeting: { Icon: Users, color: "text-blue-400", label: "Reunião" },
    next_contact: { Icon: Calendar, color: "text-amber-400", label: "Próx. Contato" },
    note: { Icon: FileText, color: "text-slate-400", label: "Anotação" },
  }

  // Manual interaction card
  if (manualKind) {
    const meta = MANUAL_ICONS[manualKind] || MANUAL_ICONS.note
    const Icon = meta.Icon
    return (
      <div className="flex justify-center my-1">
        <div className="flex items-start gap-3 bg-[#1a1710] border border-[#d4af35]/20 rounded-xl px-4 py-3 max-w-[80%]">
          <div className="p-1.5 rounded-lg bg-[#d4af35]/10 shrink-0">
            <Icon className={`h-3.5 w-3.5 ${meta.color}`} />
          </div>
          <div>
            <p className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 ${meta.color}`}>{meta.label}</p>
            <p className="text-xs text-slate-300">{text}</p>
            {manualNextContact && (
              <p className="text-[10px] text-[#d4af35]/60 mt-1 flex items-center gap-1">
                <Calendar className="h-2.5 w-2.5" />
                {new Date(manualNextContact).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Inbound (client)
  if (msg.source === "whatsapp") {
    return (
      <div className="flex gap-3 max-w-[80%]">
        <div className="w-8 h-8 rounded-full border border-white/10 shrink-0 overflow-hidden bg-[#d4af35]/20 flex items-center justify-center text-[10px] font-bold text-[#d4af35]">
          {leadPhoto
            ? <img src={leadPhoto} className="w-full h-full object-cover" alt="" />
            : getInitials(leadName)
          }
        </div>
        <div className="flex flex-col gap-1">
          <div className={`bg-white/5 border border-white/5 border-l-2 ${signalBorder} rounded-2xl rounded-tl-none px-4 py-3 text-sm leading-relaxed`}>
            {mediaType === "audio" ? (
              <div className="flex items-center gap-3 min-w-[260px]">
                <button className="w-8 h-8 rounded-full bg-[#d4af35] flex items-center justify-center shrink-0">
                  <Play className="h-3.5 w-3.5 fill-current text-[#0a0907]" />
                </button>
                <AudioWaveform />
                <Mic className="h-3 w-3 text-[#d4af35]/50 shrink-0" />
              </div>
            ) : mediaType === "image" ? (
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
    )
  }

  // Outbound (operator)
  return (
    <div className="flex flex-col items-end gap-1 self-end max-w-[80%]">
      <div className="bg-[#d4af35]/10 border border-[#d4af35]/30 rounded-2xl rounded-tr-none px-4 py-3 text-sm leading-relaxed text-slate-200">
        {text}
      </div>
      <span className="text-[10px] text-slate-500 mr-1">{formatTime(msg.timestamp)}</span>
    </div>
  )
}

// ─── Property Card ─────────────────────────────────────────────────────────────
function PropertyInteractionCard({ interaction }: { interaction: PropertyInteraction }) {
  const prop = interaction.property
  if (!prop) return null
  const typeLabel: Record<string, string> = {
    sent: "Imóvel Enviado", favorited: "Favoritado", visited: "Visita Realizada",
    discarded: "Descartado", proposal: "Proposta Feita"
  }
  const typeBadge: Record<string, string> = {
    sent: "text-[#d4af35] bg-[#d4af35]/10 border-[#d4af35]/30",
    favorited: "text-pink-400 bg-pink-400/10 border-pink-400/30",
    visited: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
    discarded: "text-slate-500 bg-slate-500/10 border-slate-500/30",
    proposal: "text-blue-400 bg-blue-400/10 border-blue-400/30",
  }
  return (
    <div className="flex items-center justify-between p-2.5 bg-white/3 hover:bg-white/5 rounded-xl border border-white/5 transition-colors">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg overflow-hidden bg-zinc-800 shrink-0">
          {prop.cover_image
            ? <img src={prop.cover_image} alt="" className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center"><Building2 className="w-4 h-4 text-slate-600" /></div>
          }
        </div>
        <div>
          <p className="text-xs font-medium text-slate-200 truncate max-w-[140px]">{prop.title || "Imóvel"}</p>
          <p className="text-[10px] text-[#d4af35]/70">{formatValue(prop.value)}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${typeBadge[interaction.interaction_type] || typeBadge.sent}`}>
          {typeLabel[interaction.interaction_type] || interaction.interaction_type}
        </span>
        {prop.source_link && (
          <a href={prop.source_link} target="_blank" rel="noopener noreferrer" className="text-slate-600 hover:text-slate-400">
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function LeadTerminalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const bottomRef = useRef<HTMLDivElement>(null)
  const [showModal, setShowModal] = useState(false)

  // Data states
  const [lead, setLead] = useState<Lead | null>(null)
  const [cognitive, setCognitive] = useState<CognitiveState | null>(null)
  const [memories, setMemories] = useState<MemoryItem[]>([])
  const [insights, setInsights] = useState<AiInsight[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [interactions, setInteractions] = useState<PropertyInteraction[]>([])
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Composer state
  const [composerText, setComposerText] = useState("")
  const [sendStatus, setSendStatus] = useState<"idle" | "sending" | "done" | "error">("idle")
  const [timelineKey, setTimelineKey] = useState(0)

  // ── Fetch all data ────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    const [
      leadRes, cogRes, memRes, insRes, msgRes, interRes, remRes
    ] = await Promise.all([
      supabase.from("leads").select("id,name,phone,lid,photo_url,orbit_stage,action_suggested,last_interaction_at").eq("id", id).single(),
      supabase.from("lead_cognitive_state").select("*").eq("lead_id", id).maybeSingle(),
      supabase.from("memory_items").select("id,type,content,confidence,created_at").eq("lead_id", id).order("created_at", { ascending: false }).limit(40),
      supabase.from("ai_insights").select("id,content,urgency,created_at").eq("lead_id", id).order("created_at", { ascending: false }).limit(5),
      supabase.from("messages").select("id,source,content,timestamp,ai_analysis").eq("lead_id", id).order("timestamp", { ascending: true }),
      supabase.from("property_interactions").select("id,interaction_type,timestamp,property_id").eq("lead_id", id).order("timestamp", { ascending: false }).limit(10),
      supabase.from("reminders").select("id,due_at,type,status").eq("lead_id", id).eq("status", "pending").order("due_at", { ascending: true }).limit(3),
    ])

    if (leadRes.data) setLead(leadRes.data as Lead)
    if (cogRes.data) setCognitive(cogRes.data as CognitiveState)
    if (memRes.data) setMemories(memRes.data as MemoryItem[])
    if (insRes.data) setInsights(insRes.data as AiInsight[])
    if (msgRes.data) setMessages(msgRes.data as Message[])
    if (remRes.data) setReminders(remRes.data as Reminder[])

    // Fetch property details for interactions
    if (interRes.data && interRes.data.length > 0) {
      const propIds = [...new Set(interRes.data.map(i => i.property_id).filter(Boolean))] as string[]
      const { data: props } = await supabase
        .from("properties")
        .select("id,title,cover_image,value,location_text,source_link")
        .in("id", propIds)
      const propMap = new Map((props || []).map(p => [p.id, p]))
      const enriched = interRes.data.map(i => ({
        ...i,
        property: propMap.get(i.property_id || "") as any
      }))
      setInteractions(enriched as PropertyInteraction[])
    }

    // AI suggestion
    const sugRes = await fetch(`/api/lead/${id}/suggest`)
    if (sugRes.ok) {
      const j = await sugRes.json()
      if (j.suggestion) setAiSuggestion(j.suggestion)
    }

    setLoading(false)
  }, [id])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Polling every 15s
  useEffect(() => {
    const interval = setInterval(fetchAll, 15000)
    return () => clearInterval(interval)
  }, [fetchAll])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, timelineKey])

  // ── Send message ────────────────────────────────────────────────────────────
  const sendTo = lead?.phone || 
    (lead?.lid ? (lead.lid.includes('@lid') ? lead.lid : `${lead.lid}@lid`) : null)

  const handleSend = async () => {
    if (!composerText.trim() || sendStatus !== "idle") return
    
    if (!sendTo) {
      alert("Este lead não possui telefone nem identificador do WhatsApp (LID) cadastrados.")
      return
    }

    setSendStatus("sending")
    try {
      const response = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: sendTo, message: composerText.trim(), leadId: id })
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error("[TERMINAL] Send error:", errorData.error)
        throw new Error(errorData.error || "Erro ao enviar mensagem")
      }

      setSendStatus("done")
      setComposerText("")
      setTimelineKey(k => k + 1)
      setTimeout(() => { setSendStatus("idle"); fetchAll() }, 1500)
    } catch (err) {
      console.error("[TERMINAL] Error in handleSend:", err)
      setSendStatus("error")
      setTimeout(() => setSendStatus("idle"), 2000)
    }
  }

  // ── Memory grouping ────────────────────────────────────────────────────────
  const PROFILE_TYPES = ["identity", "budget_range", "location_preference", "property_type", "feature_preference"]
  const CONTEXT_TYPES = ["current_search", "location_focus", "budget", "priority", "intent", "preference"]
  const profileMems = memories.filter(m => PROFILE_TYPES.includes(m.type))
  const contextMems = memories.filter(m => CONTEXT_TYPES.includes(m.type))
  const topInsight = insights[0]

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="flex gap-1.5">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-1.5 h-1.5 rounded-full bg-[#d4af35]/50 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    )
  }

  if (!lead) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-slate-500 text-sm">
        Lead não encontrado
      </div>
    )
  }

  const cog = cognitive

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-slate-100 flex flex-col overflow-hidden font-sans"
      style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* ── Background layer ── */}
      <div className="fixed inset-0 z-0 opacity-20" style={{
        backgroundImage: "linear-gradient(to bottom, rgba(18,18,18,0.8), rgba(18,18,18,0.98)), url(https://lh3.googleusercontent.com/aida-public/AB6AXuBG12eYEoA1X05iX4yjqQTPPwuqPt2JyoevNgN4NkMjMuYrFf-ub3GMr6Gnh7zO5aHXiHmEqVTEKfKLsrG7Jb3L91PMF0e_gFZ6zuxL4Dvz6mzG0Ff03d9kHY68YmJud-LKgX03r5RU33sgMn0Gi6UFz2XUXavV2tT_tchDnJXL15pBuoVnKz-yRJwY5A9iQ45BQkFL5_DGj7_v7_h8CiR0Ulc2FfC_ta7L6ABspGU7V8RcH4Lr7sB-t--e0-_lRiYd1_pegnyO54E)",
        backgroundSize: "cover", backgroundPosition: "center"
      }} />

      {/* ── TOP BAR ────────────────────────────────────────────────────────── */}
      <header className="relative z-10 px-6 pt-4 pb-3">
        <div className="max-w-[1600px] mx-auto bg-[rgba(20,20,20,0.8)] backdrop-blur-xl rounded-xl px-5 py-3 flex items-center justify-between shadow-2xl border border-white/8">

          {/* Left: back + lead info */}
          <div className="flex items-center gap-5">
            <button onClick={() => router.push("/")}
              className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>

            <div className="w-px h-7 bg-white/10" />

            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-full border border-[#d4af35]/30 overflow-hidden bg-[#d4af35]/10 flex items-center justify-center text-sm font-bold text-[#d4af35]">
                  {lead.photo_url
                    ? <img src={lead.photo_url} alt="" className="w-full h-full object-cover" />
                    : getInitials(lead.name)
                  }
                </div>
                <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#121212]" />
              </div>
              <div>
                <p className="text-sm font-bold">{lead.name || "Lead"}</p>
                <p className="text-[10px] text-[#d4af35]/80 font-semibold uppercase tracking-wider">
                  {lead.orbit_stage || "Sem estágio"} · {formatRelative(lead.last_interaction_at)}
                </p>
              </div>
            </div>

            <div className="w-px h-7 bg-white/10" />
            <div>
              <p className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">ORBIT 3.0</p>
              <p className="text-[9px] text-slate-600 uppercase tracking-tight">Cognitive Real Estate Terminal</p>
            </div>
          </div>

          {/* Center: 4 cognitive rings */}
          <div className="flex items-center gap-6">
            <CognitiveRing value={cog?.interest_score ?? 0} label="Interesse" color="#d4af35" />
            <CognitiveRing value={cog?.momentum_score ?? 0} label="Momentum" color="#d4af35" />
            <CognitiveRing value={cog?.risk_score ?? 0} label="Risco" color="#ef4444" />
            <CognitiveRing value={cog?.clarity_level ?? 0} label="Clareza" color="#d4af35" />
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-2">
            {reminders.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-400/10 border border-amber-400/20 rounded-lg text-[10px] text-amber-400 font-bold">
                <Bell className="w-3 h-3" />
                {new Date(reminders[0].due_at).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
              </div>
            )}
            <button className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
              <Bell className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ── MAIN 3-COLUMN GRID ─────────────────────────────────────────────── */}
      <main className="relative z-10 flex-1 flex gap-4 px-6 pb-5 min-h-0 overflow-hidden">

        {/* ── LEFT PANEL: Context Intelligence ──────────────────────────── */}
        <aside className="w-72 flex flex-col gap-4 overflow-y-auto pr-1" style={{ scrollbarWidth: "thin", scrollbarColor: "#d4af35/20 transparent" }}>

          {/* Memória do Cliente */}
          <div className="bg-[rgba(20,20,20,0.7)] backdrop-blur-xl rounded-xl p-5 border border-white/8 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-[#d4af35]" />
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-300">Memória do Cliente</h3>
            </div>

            {profileMems.length === 0 && contextMems.length === 0 ? (
              <p className="text-[11px] text-slate-600 italic">Aguardando interações para construir memória...</p>
            ) : (
              <div className="space-y-2">
                {[...profileMems, ...contextMems].slice(0, 6).map(m => (
                  <div key={m.id} className="bg-white/4 rounded-lg p-3 border border-white/5">
                    <p className="text-[9px] uppercase text-slate-500 font-bold mb-1">{m.type.replace(/_/g, " ")}</p>
                    <p className="text-xs font-medium text-slate-200">{m.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Insights Cognitivos */}
          <div className="bg-[rgba(20,20,20,0.7)] backdrop-blur-xl rounded-xl p-5 border border-white/8 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#d4af35]" />
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-300">Insights Cognitivos</h3>
            </div>

            {topInsight ? (
              <>
                <div className="p-3 border-l-2 border-[#d4af35] bg-[#d4af35]/5 rounded-r-lg">
                  <p className="text-sm text-slate-200 leading-relaxed">{topInsight.content}</p>
                  <p className="text-[10px] text-[#d4af35]/70 mt-1.5 uppercase font-bold">
                    Urgência: {topInsight.urgency}%
                  </p>
                </div>

                {/* Engagement mini-bar chart based on last insights count */}
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-400">Análises recentes</span>
                    <span className="text-[10px] text-[#d4af35] font-bold">{insights.length} eventos</span>
                  </div>
                  <div className="h-8 flex items-end gap-1">
                    {insights.slice(0, 6).reverse().map((ins, i) => (
                      <div key={ins.id} className="flex-1 rounded-sm"
                        style={{
                          height: `${Math.max(20, ins.urgency)}%`,
                          backgroundColor: i === insights.length - 1 ? "#d4af35" : `rgba(212,175,53,${0.2 + i * 0.1})`
                        }} />
                    ))}
                    {Array.from({ length: Math.max(0, 6 - insights.length) }).map((_, i) => (
                      <div key={`empty-${i}`} className="flex-1 h-[20%] rounded-sm bg-white/5" />
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <p className="text-[11px] text-slate-600 italic">Aguardando análise da IA...</p>
            )}
          </div>

          {/* Próximos Lembretes */}
          {reminders.length > 0 && (
            <div className="bg-[rgba(20,20,20,0.7)] backdrop-blur-xl rounded-xl p-5 border border-amber-400/20 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-400" />
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-amber-400">Lembretes</h3>
              </div>
              {reminders.map(r => (
                <div key={r.id} className="flex items-center gap-2 text-xs text-slate-300">
                  <Clock className="w-3 h-3 text-amber-400 shrink-0" />
                  {new Date(r.due_at).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                </div>
              ))}
            </div>
          )}
        </aside>

        {/* ── CENTRAL AREA: Chat Engine ──────────────────────────────────── */}
        <section className="flex-1 flex flex-col bg-[rgba(20,20,20,0.7)] backdrop-blur-xl rounded-xl border border-white/8 overflow-hidden shadow-inner min-h-0">

          {/* Chat stream */}
          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4 min-h-0" style={{ scrollbarWidth: "thin", scrollbarColor: "#d4af35/20 transparent" }}>
            {messages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 opacity-40">
                <Brain className="w-10 h-10 text-[#d4af35]/30" />
                <p className="text-sm text-slate-500">Nenhuma interação registrada ainda</p>
              </div>
            ) : (
              messages.map((msg, idx) => (
                <motion.div key={`${msg.id}-${timelineKey}`}
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.02 }}
                >
                  <MessageBubble msg={msg} leadPhoto={lead.photo_url} leadName={lead.name} />
                </motion.div>
              ))
            )}
            <div ref={bottomRef} />
          </div>

          {/* Composer */}
          <div className="p-5 border-t border-white/8 bg-[#0a0a0a]/50 backdrop-blur-md">
            {/* AI suggestion chips */}
            {aiSuggestion && (
              <div className="mb-3 flex flex-wrap gap-2">
                <span className="text-[9px] text-slate-500 font-bold uppercase pt-1.5 mr-1">Sugestão IA:</span>
                <button
                  onClick={() => setComposerText(aiSuggestion)}
                  className="bg-white/5 hover:bg-[#d4af35]/10 border border-white/10 hover:border-[#d4af35]/30 rounded-full px-4 py-1.5 text-xs transition-colors text-slate-300 hover:text-[#d4af35]"
                >
                  "{aiSuggestion.slice(0, 60)}{aiSuggestion.length > 60 ? "..." : ""}"
                </button>
              </div>
            )}

            <div className="flex items-center gap-3">
              {/* Manual interaction button */}
              <button
                onClick={() => setShowModal(true)}
                title="Registrar interação manual"
                className="w-10 h-10 rounded-full bg-white/5 hover:bg-[#d4af35]/10 border border-white/10 hover:border-[#d4af35]/30 flex items-center justify-center text-slate-400 hover:text-[#d4af35] transition-all"
              >
                <Plus className="w-4 h-4" />
              </button>

              <div className="flex-1 relative">
                <input
                  type="text"
                  value={composerText}
                  onChange={e => setComposerText(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                  placeholder="Digite sua mensagem inteligente..."
                  className="w-full bg-white/5 border border-white/10 focus:border-[#d4af35]/50 rounded-xl px-4 py-3 text-sm focus:outline-none placeholder-slate-500 transition-colors"
                />
              </div>

              <button
                onClick={handleSend}
                disabled={!composerText.trim() || sendStatus !== "idle"}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                  sendStatus === "done" ? "bg-emerald-500/20 text-emerald-400" :
                  composerText.trim() ? "bg-[#d4af35] text-[#0a0907] shadow-[0_0_15px_rgba(212,175,53,0.3)]" :
                  "bg-white/5 text-slate-600"
                }`}
              >
                {sendStatus === "sending" ? <Loader2 className="w-4 h-4 animate-spin" /> :
                 sendStatus === "done" ? <Check className="w-4 h-4" /> :
                 <ArrowUp className="w-4 h-4" />}
              </button>
            </div>

            <p className="text-[9px] text-center text-slate-700 mt-2 tracking-widest uppercase">
              {sendTo ? `Enviando via WhatsApp · ${lead?.phone || 'LID'}` : "Sem número ou LID · não é possível enviar pelo WhatsApp"}
            </p>
          </div>
        </section>

        {/* ── RIGHT PANEL: Action Console ────────────────────────────────── */}
        <aside className="w-72 flex flex-col gap-4 overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "#d4af35/20 transparent" }}>

          {/* Próxima Melhor Ação */}
          <div className="bg-[rgba(20,20,20,0.7)] backdrop-blur-xl rounded-xl p-5 border border-[#d4af35]/20 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 text-[#d4af35]" />
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-300">Próxima Melhor Ação</h3>
            </div>

            {lead.action_suggested ? (
              <div className="p-3 bg-[#d4af35]/10 rounded-lg">
                <p className="text-sm font-semibold text-[#d4af35] mb-1">
                  {cog?.current_state === "deciding" ? "🎯 Take Action Now" : "💡 Próxima Ação"}
                </p>
                <p className="text-[11px] text-slate-300 leading-relaxed">{lead.action_suggested}</p>
              </div>
            ) : (
              <p className="text-[11px] text-slate-600 italic">Aguardando dados suficientes para gerar recomendação...</p>
            )}

            {topInsight && (
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => setShowModal(true)}
                  className="w-full bg-[#d4af35] py-2.5 rounded-lg text-[#0a0907] font-bold text-[10px] uppercase tracking-widest hover:brightness-110 transition-all"
                >
                  Registrar Interação
                </button>
                <button
                  onClick={() => setComposerText(aiSuggestion || "")}
                  className="w-full bg-white/5 border border-white/10 py-2.5 rounded-lg text-slate-300 font-bold text-[10px] uppercase tracking-widest hover:bg-white/10 transition-all"
                >
                  Usar Sugestão da IA
                </button>
              </div>
            )}
          </div>

          {/* Escrita Inteligente */}
          {aiSuggestion && (
            <div className="bg-[rgba(20,20,20,0.7)] backdrop-blur-xl rounded-xl p-5 border border-white/8 flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-[#d4af35]" />
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-300">Escrita Inteligente</h3>
              </div>
              <div className="bg-white/4 rounded-lg p-4 border border-white/5">
                <p className="text-xs text-slate-400 italic leading-relaxed">"{aiSuggestion}"</p>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex gap-2">
                  {cog?.current_state && (
                    <span className="text-[9px] text-[#d4af35] border border-[#d4af35]/30 px-2 py-0.5 rounded-full uppercase">
                      {cog.current_state}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setComposerText(aiSuggestion)}
                  className="text-[#d4af35] flex items-center gap-1 text-[10px] font-bold uppercase hover:brightness-110"
                >
                  Usar
                </button>
              </div>
            </div>
          )}

          {/* Histórico de Imóveis */}
          <div className="bg-[rgba(20,20,20,0.7)] backdrop-blur-xl rounded-xl p-5 border border-white/8 flex-1 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#d4af35]" />
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-300">Imóveis Interagidos</h3>
            </div>

            {interactions.length === 0 ? (
              <p className="text-[11px] text-slate-600 italic">Nenhum imóvel enviado ainda</p>
            ) : (
              <div className="space-y-2">
                {interactions.map(i => (
                  <PropertyInteractionCard key={i.id} interaction={i} />
                ))}
              </div>
            )}
          </div>
        </aside>
      </main>

      {/* ── Footer status bar ──────────────────────────────────────────────── */}
      <div className="fixed bottom-4 left-6 z-20 flex gap-3">
        <div className="bg-[rgba(20,20,20,0.8)] backdrop-blur-xl px-3 py-1.5 rounded-full flex items-center gap-2 border border-white/8">
          <div className="w-1.5 h-1.5 rounded-full bg-[#d4af35] animate-pulse" />
          <span className="text-[9px] uppercase tracking-[0.2em] font-bold text-slate-400">Atlas Neural Network Linked</span>
        </div>
        {cog?.last_ai_analysis_at && (
          <div className="bg-[rgba(20,20,20,0.8)] backdrop-blur-xl px-3 py-1.5 rounded-full flex items-center gap-2 border border-white/8">
            <Brain className="w-3 h-3 text-[#d4af35]/60" />
            <span className="text-[9px] text-slate-500">
              Análise: {formatRelative(cog.last_ai_analysis_at)}
            </span>
          </div>
        )}
      </div>

      {/* ── Manual Interaction Modal ───────────────────────────────────────── */}
      <AnimatePresence>
        {showModal && (
          <ManualInteractionModal
            leadId={id}
            leadPhone={sendTo}
            onClose={() => setShowModal(false)}
            onSaved={() => { setShowModal(false); setTimelineKey(k => k + 1); fetchAll() }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
