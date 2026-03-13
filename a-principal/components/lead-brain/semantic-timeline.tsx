"use client"

import { useState } from "react"
import { Bot, Brain, Play, Copy, Flag, Heart } from "lucide-react"

type MessageType = "client" | "broker" | "ai_action" | "cognitive_insight"

interface TimelineMessage {
  id: string
  type: MessageType
  content: string
  timestamp: string
  date: string
  avatar?: string
  media?: {
    type: "audio" | "image" | "video" | "pdf" | "link"
    url?: string
    title?: string
    description?: string
    duration?: string
  }
}

const timelineData: Record<string, TimelineMessage[]> = {
  "1": [
    {
      id: "m1",
      type: "client",
      content: "Olá! Vi o anúncio do Laguna Premium e fiquei interessada. Vocês têm plantas disponíveis?",
      timestamp: "09:15",
      date: "Hoje",
      avatar: "MC",
    },
    {
      id: "m2",
      type: "broker",
      content:
        "Bom dia, Marina! Que bom saber do seu interesse. Temos sim, vou enviar o material completo. Qual metragem você está buscando?",
      timestamp: "09:18",
      date: "Hoje",
    },
    {
      id: "m3",
      type: "ai_action",
      content: "IA enviou: Folder Laguna Premium.pdf",
      timestamp: "09:18",
      date: "Hoje",
    },
    {
      id: "m4",
      type: "client",
      content:
        "Estou buscando algo acima de 120m², de preferência com 3 suítes. O empreendimento tem vista para o mar?",
      timestamp: "09:25",
      date: "Hoje",
      avatar: "MC",
    },
    {
      id: "m5",
      type: "cognitive_insight",
      content: "Detecção: Marina demonstrou interesse em plantas acima de 120m² com preferência por 3 suítes",
      timestamp: "09:25",
      date: "Hoje",
    },
    {
      id: "m6",
      type: "broker",
      content:
        "Sim! As unidades do 15º andar em diante têm vista panorâmica para o mar. Temos opções de 135m² e 158m² com 3 suítes. Posso agendar uma visita ao decorado?",
      timestamp: "09:30",
      date: "Hoje",
    },
    {
      id: "m7",
      type: "client",
      content: "A de 158m² parece perfeita! Quero ver as plantas e condições de pagamento.",
      timestamp: "09:45",
      date: "Hoje",
      avatar: "MC",
      media: {
        type: "audio",
        duration: "0:45",
        title: "Áudio de Marina",
      },
    },
    {
      id: "m8",
      type: "cognitive_insight",
      content: "Alta intenção de compra detectada. Lead avançou de CURIOUS para INTENT.",
      timestamp: "09:45",
      date: "Hoje",
    },
  ],
}

function AudioPlayer({ duration }: { duration?: string }) {
  return (
    <div className="mt-2 flex items-center gap-3 rounded-lg bg-[rgba(46,197,255,0.1)] p-3">
      <button className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2ec5ff] text-[#0a0a0f] transition-transform hover:scale-105">
        <Play className="h-4 w-4 fill-current" />
      </button>
      <div className="flex-1">
        <div className="h-8 w-full rounded bg-[rgba(46,197,255,0.2)]">
          {/* Waveform visualization placeholder */}
          <div className="flex h-full items-center justify-center gap-0.5 px-2">
            {Array.from({ length: 40 }).map((_, i) => (
              <div
                key={i}
                className="w-0.5 rounded-full bg-[#2ec5ff]"
                style={{ height: `${Math.random() * 100}%`, opacity: 0.6 + Math.random() * 0.4 }}
              />
            ))}
          </div>
        </div>
      </div>
      <span className="text-xs text-[#64748b]">{duration}</span>
      <button className="text-xs text-[#2ec5ff] hover:underline">Ver transcrição</button>
    </div>
  )
}

function MessageActions() {
  const [show, setShow] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setShow(!show)}
        className="absolute -right-2 top-0 opacity-0 transition-opacity group-hover:opacity-100"
      >
        <div className="flex gap-1 rounded-lg bg-[rgba(15,23,42,0.9)] p-1 shadow-lg">
          <button className="rounded p-1 text-[#64748b] hover:bg-white/5 hover:text-white">
            <Copy className="h-3 w-3" />
          </button>
          <button className="rounded p-1 text-[#64748b] hover:bg-white/5 hover:text-rose-400">
            <Heart className="h-3 w-3" />
          </button>
          <button className="rounded p-1 text-[#64748b] hover:bg-white/5 hover:text-amber-400">
            <Flag className="h-3 w-3" />
          </button>
        </div>
      </button>
    </div>
  )
}

export function SemanticTimeline({ leadId }: { leadId: string }) {
  const messages = timelineData[leadId] || timelineData["1"]
  let currentDate = ""

  return (
    <div className="space-y-4">
      {messages.map((message) => {
        const showDateSeparator = message.date !== currentDate
        currentDate = message.date

        return (
          <div key={message.id}>
            {showDateSeparator && (
              <div className="my-6 flex items-center gap-4">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent to-[rgba(46,197,255,0.2)]" />
                <span className="text-xs font-medium text-[#64748b]">{message.date}</span>
                <div className="h-px flex-1 bg-gradient-to-l from-transparent to-[rgba(46,197,255,0.2)]" />
              </div>
            )}

            {/* Client Message */}
            {message.type === "client" && (
              <div className="group flex gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[rgba(46,197,255,0.2)] text-[10px] font-medium text-[#2ec5ff]">
                  {message.avatar}
                </div>
                <div className="relative max-w-[80%]">
                  <div className="rounded-xl rounded-tl-sm border border-[rgba(46,197,255,0.15)] bg-[rgba(15,23,42,0.6)] p-3 backdrop-blur-sm">
                    <p className="text-sm text-[#e6eef6]">{message.content}</p>
                    {message.media?.type === "audio" && <AudioPlayer duration={message.media.duration} />}
                  </div>
                  <span className="mt-1 block text-[10px] text-[#475569]">{message.timestamp}</span>
                  <MessageActions />
                </div>
              </div>
            )}

            {/* Broker Message */}
            {message.type === "broker" && (
              <div className="group flex justify-end">
                <div className="relative max-w-[80%]">
                  <div className="rounded-xl rounded-tr-sm border border-[#2ec5ff]/30 bg-[rgba(46,197,255,0.08)] p-3 backdrop-blur-sm">
                    <p className="text-sm text-[#e6eef6]">{message.content}</p>
                  </div>
                  <span className="mt-1 block text-right text-[10px] text-[#475569]">{message.timestamp}</span>
                  <MessageActions />
                </div>
              </div>
            )}

            {/* AI Automated Action */}
            {message.type === "ai_action" && (
              <div className="flex justify-center">
                <div className="flex items-center gap-2 rounded-full bg-[rgba(46,197,255,0.05)] px-4 py-2">
                  <Bot className="h-3 w-3 text-[#64748b]" />
                  <span className="text-xs text-[#64748b]">{message.content}</span>
                </div>
              </div>
            )}

            {/* Cognitive Insight */}
            {message.type === "cognitive_insight" && (
              <div className="flex justify-center">
                <div className="relative max-w-[90%] overflow-hidden rounded-xl border border-transparent bg-gradient-to-r from-[#2ec5ff]/10 to-[#a855f7]/10 p-[1px]">
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-[#2ec5ff]/30 to-[#a855f7]/30" />
                  <div className="relative flex items-start gap-3 rounded-xl bg-[rgba(10,10,15,0.9)] p-3 backdrop-blur-sm">
                    <Brain className="h-4 w-4 shrink-0 text-[#a855f7]" />
                    <div>
                      <p className="text-xs text-[#e6eef6]">{message.content}</p>
                      <span className="mt-1 block text-[10px] text-[#475569]">{message.timestamp}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
