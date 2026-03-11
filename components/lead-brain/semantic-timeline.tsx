"use client"

import { useState, useEffect, useRef } from "react"
import { Bot, Brain, Play, Copy, Flag, Heart, Phone, Home, Calendar, FileText, Users, Mic } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useLeadDetails } from "@/hooks/use-supabase-data"

type MessageType = "client" | "broker" | "ai_action" | "cognitive_insight" | "manual_interaction"
type Signal = "positive" | "negative" | "neutral"

interface TimelineMessage {
  id: string
  type: MessageType
  content: string
  timestamp: string
  date: string
  avatar?: string
  signal?: Signal
  intention?: string
  mediaType?: "audio" | "image" | "video" | "document" | "sticker"
  mediaUrl?: string
  // For manual interactions
  interactionKind?: string
  nextContactAt?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (date.toDateString() === today.toDateString()) return 'Hoje'
  if (date.toDateString() === yesterday.toDateString()) return 'Ontem'
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function getInitials(name: string | null): string {
  if (!name) return '??'
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

function signalColor(signal?: Signal) {
  if (signal === "positive") return "border-l-emerald-500"
  if (signal === "negative") return "border-l-red-400"
  return "border-l-blue-400/40"
}

function signalBadgeStyle(signal?: Signal) {
  if (signal === "positive") return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
  if (signal === "negative") return "bg-red-500/10 text-red-400 border-red-500/20"
  return "bg-blue-500/10 text-blue-400 border-blue-400/20"
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function WaveformBar() {
  const heights = useRef(
    Array.from({ length: 36 }, () => Math.random() * 80 + 10)
  )
  return (
    <div className="flex h-8 items-center gap-0.5">
      {heights.current.map((h, i) => (
        <div
          key={i}
          className="w-0.5 rounded-full bg-[#d4af35] opacity-60"
          style={{ height: `${h}%` }}
        />
      ))}
    </div>
  )
}

function AudioBubble({ url }: { url?: string }) {
  return (
    <div className="mt-2 flex items-center gap-3 rounded-lg bg-[#d4af35]/10 border border-[#d4af35]/20 p-3">
      <button className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#d4af35] text-[#0a0907] transition-transform hover:scale-105">
        <Play className="h-3.5 w-3.5 fill-current" />
      </button>
      <div className="flex-1 overflow-hidden">
        <WaveformBar />
      </div>
      <Mic className="h-3.5 w-3.5 text-[#d4af35]/60 shrink-0" />
    </div>
  )
}

function ImageBubble({ url }: { url?: string }) {
  return (
    <div className="mt-2 rounded-lg overflow-hidden border border-[#d4af35]/20 w-48 h-32 bg-zinc-800 flex items-center justify-center">
      {url ? (
        <img src={url} alt="mídia" className="w-full h-full object-cover" />
      ) : (
        <span className="text-xs text-slate-500">Imagem</span>
      )}
    </div>
  )
}

function ManualInteractionCard({ content, kind, nextContactAt }: { content: string, kind?: string, nextContactAt?: string }) {
  const iconMap: Record<string, { icon: any, color: string, label: string }> = {
    call: { icon: Phone, color: "text-emerald-400", label: "Ligação Realizada" },
    visit: { icon: Home, color: "text-[#d4af35]", label: "Visita Realizada" },
    meeting: { icon: Users, color: "text-blue-400", label: "Reunião / Proposta" },
    next_contact: { icon: Calendar, color: "text-amber-400", label: "Próximo Contato" },
    note: { icon: FileText, color: "text-slate-400", label: "Anotação Interna" },
  }
  const meta = iconMap[kind || "note"] || iconMap.note
  const Icon = meta.icon

  return (
    <div className="flex justify-center">
      <div className="flex items-start gap-3 bg-[#14120c]/80 border border-[#d4af35]/20 rounded-xl px-4 py-3 max-w-[85%] backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.4)]">
        <div className={`p-1.5 rounded-lg bg-[#d4af35]/10 shrink-0 mt-0.5`}>
          <Icon className={`h-3.5 w-3.5 ${meta.color}`} />
        </div>
        <div>
          <p className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 ${meta.color}`}>{meta.label}</p>
          <p className="text-xs text-slate-300">{content}</p>
          {nextContactAt && (
            <p className="text-[10px] text-[#d4af35]/60 mt-1 flex items-center gap-1">
              <Calendar className="h-2.5 w-2.5" />
              Próximo: {new Date(nextContactAt).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function SemanticTimeline({ leadId }: { leadId: string }) {
  const { messages: rawMessages, loading } = useLeadDetails(leadId)
  const [messages, setMessages] = useState<TimelineMessage[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)

  // Convert raw messages to enriched timeline entries
  useEffect(() => {
    if (!rawMessages) return

    const entries: TimelineMessage[] = rawMessages.map(m => {
      const analysis = m.ai_analysis as any

      // Try to parse manual interaction content
      let manualKind: string | undefined
      let manualNextContact: string | undefined
      let parsedContent = m.content || ''

      if (m.source === 'operator') {
        try {
          const parsed = JSON.parse(m.content || '')
          if (parsed.type && parsed.summary) {
            manualKind = parsed.type
            manualNextContact = parsed.next_contact_at
            parsedContent = parsed.summary
          }
        } catch {}
      }

      // Detect media content
      let mediaType: TimelineMessage['mediaType'] | undefined
      let mediaUrl: string | undefined
      try {
        const parsed = JSON.parse(m.content || '')
        if (parsed.type && parsed.url) {
          mediaType = parsed.type as any
          mediaUrl = parsed.url
          parsedContent = parsed.caption || ''
        }
      } catch {}

      return {
        id: m.id,
        type: manualKind
          ? 'manual_interaction'
          : m.source === 'operator'
          ? 'broker'
          : 'client',
        content: parsedContent,
        timestamp: new Date(m.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        date: formatDate(m.timestamp),
        avatar: m.source === 'operator' ? undefined : getInitials(null),
        signal: analysis?.signal as Signal | undefined,
        intention: analysis?.intention,
        mediaType,
        mediaUrl,
        interactionKind: manualKind,
        nextContactAt: manualNextContact,
      }
    })

    setMessages(entries)
  }, [rawMessages])

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex gap-1">
          {[0,1,2].map(i => (
            <div key={i} className="w-1.5 h-1.5 rounded-full bg-[#d4af35]/40 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Bot className="w-8 h-8 text-[#d4af35]/20" />
        <span className="text-sm text-slate-600">Nenhuma interação registrada</span>
      </div>
    )
  }

  let currentDate = ""

  return (
    <div className="space-y-3 pb-4">
      {messages.map((msg, idx) => {
        const showDateSep = msg.date !== currentDate
        currentDate = msg.date

        return (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.025, duration: 0.25 }}
          >
            {/* Date separator */}
            {showDateSep && (
              <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent to-[#d4af35]/15" />
                <span className="text-[10px] font-medium text-[#d4af35]/50 tracking-wider uppercase">{msg.date}</span>
                <div className="h-px flex-1 bg-gradient-to-l from-transparent to-[#d4af35]/15" />
              </div>
            )}

            {/* Manual Interaction */}
            {msg.type === 'manual_interaction' && (
              <ManualInteractionCard content={msg.content} kind={msg.interactionKind} nextContactAt={msg.nextContactAt} />
            )}

            {/* Client Message */}
            {msg.type === "client" && (
              <div className="group flex gap-2.5">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#d4af35]/15 text-[10px] font-bold text-[#d4af35] border border-[#d4af35]/20">
                  {msg.avatar}
                </div>
                <div className="max-w-[75%] space-y-1">
                  <div className={`rounded-xl rounded-tl-sm border-l-2 ${signalColor(msg.signal)} border border-white/5 bg-[#14120c]/70 p-3 backdrop-blur-sm shadow-md`}>
                    {msg.mediaType === 'audio' ? (
                      <AudioBubble url={msg.mediaUrl} />
                    ) : msg.mediaType === 'image' ? (
                      <ImageBubble url={msg.mediaUrl} />
                    ) : (
                      <p className="text-sm text-slate-200 leading-relaxed">{msg.content}</p>
                    )}

                    {/* Cognitive annotation badge */}
                    {msg.intention && (
                      <div className={`mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-bold uppercase tracking-wide ${signalBadgeStyle(msg.signal)}`}>
                        <Brain className="h-2.5 w-2.5" />
                        {msg.intention}
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-600">{msg.timestamp}</span>
                </div>
              </div>
            )}

            {/* Broker/Operator Message */}
            {msg.type === "broker" && (
              <div className="group flex justify-end">
                <div className="max-w-[75%] space-y-1">
                  <div className="rounded-xl rounded-tr-sm border border-[#d4af35]/20 bg-[#d4af35]/8 p-3 backdrop-blur-sm shadow-md"
                    style={{ background: 'rgba(212,175,53,0.07)' }}>
                    <p className="text-sm text-slate-200 leading-relaxed">{msg.content}</p>
                  </div>
                  <span className="text-right block text-[10px] text-slate-600">{msg.timestamp}</span>
                </div>
              </div>
            )}

            {/* Cognitive Insight */}
            {msg.type === "cognitive_insight" && (
              <div className="flex justify-center">
                <div className="flex items-start gap-2 rounded-xl border border-purple-500/20 bg-purple-500/5 px-4 py-2.5 max-w-[85%]">
                  <Brain className="h-3.5 w-3.5 shrink-0 text-purple-400 mt-0.5" />
                  <p className="text-xs text-slate-400">{msg.content}</p>
                </div>
              </div>
            )}
          </motion.div>
        )
      })}
      <div ref={bottomRef} />
    </div>
  )
}
