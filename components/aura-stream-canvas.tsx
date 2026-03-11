"use client"

import type React from "react"

import { MessageCircle, User, BarChart3, Bell, MoreHorizontal, Activity } from "lucide-react"

interface StreamEvent {
  id: string
  type: "engagement" | "interested" | "insight" | "alert" | "semantic"
  title: string
  description: string
  time: string
  icon: React.ReactNode
  accentColor: string
  iconBg: string
  borderColor: string
}

const streamEvents: StreamEvent[] = [
  {
    id: "1",
    type: "engagement",
    title: "Engajamento",
    description: "Marina respondeu à proposta",
    time: "2min atrás",
    icon: <MessageCircle className="h-3.5 w-3.5" />,
    accentColor: "text-[#2EC5FF]",
    iconBg: "bg-[#2EC5FF]/15",
    borderColor: "border-l-[#2EC5FF]",
  },
  {
    id: "2",
    type: "interested",
    title: "Interessado",
    description: "Lucas visualizou o deck",
    time: "8min atrás",
    icon: <User className="h-3.5 w-3.5" />,
    accentColor: "text-emerald-400",
    iconBg: "bg-emerald-500/15",
    borderColor: "border-l-emerald-400",
  },
  {
    id: "3",
    type: "insight",
    title: "Insight de Mercado",
    description: "Tendência detectada no setor",
    time: "15min atrás",
    icon: <BarChart3 className="h-3.5 w-3.5" />,
    accentColor: "text-[#FFC87A]",
    iconBg: "bg-[#FFC87A]/15",
    borderColor: "border-l-[#FFC87A]",
  },
  {
    id: "4",
    type: "alert",
    title: "Oportunidade Inédita",
    description: "Nova oportunidade identificada",
    time: "23min atrás",
    icon: <Bell className="h-3.5 w-3.5" />,
    accentColor: "text-[#FF7A7A]",
    iconBg: "bg-[#FF7A7A]/15",
    borderColor: "border-l-[#FF7A7A]",
  },
]

export function AuraStreamCanvas() {
  return (
    <div className="absolute right-6 top-1/2 z-30 w-72 -translate-y-1/2">
      <div className="rounded-2xl border border-[var(--orbit-glass-border)] bg-[var(--orbit-glass)] p-4 backdrop-blur-2xl shadow-[var(--orbit-shadow)]">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xs font-light tracking-widest text-[var(--orbit-text-muted)]">AURA STREAM CANVAS</h2>
          <button className="text-[var(--orbit-text-muted)] transition-colors hover:text-[var(--orbit-text)]">
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </div>

        {/* Event Cards */}
        <div className="space-y-3">
          {streamEvents.map((event) => (
            <div
              key={event.id}
              className={`group rounded-xl border border-l-2 ${event.borderColor} border-[var(--orbit-glass-border)] bg-[var(--orbit-bg)]/30 p-3 transition-all duration-[240ms] hover:border-[var(--orbit-glow)]/30 hover:bg-[var(--orbit-bg)]/50`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-lg ${event.iconBg} ${event.accentColor}`}
                  >
                    {event.icon}
                  </div>
                  <div>
                    <div className="text-xs font-light text-[var(--orbit-text)]">{event.title}</div>
                    <div className="mt-0.5 text-[10px] text-[var(--orbit-text-muted)]">{event.description}</div>
                  </div>
                </div>
                <button className="opacity-0 transition-opacity group-hover:opacity-100">
                  <MoreHorizontal className="h-3 w-3 text-[var(--orbit-text-muted)]" />
                </button>
              </div>
              <div className="mt-2 text-right text-[10px] text-[var(--orbit-text-muted)]/50">{event.time}</div>
            </div>
          ))}
        </div>

        {/* Semantic Detection - with wave/pulse icon */}
        <div className="mt-4 rounded-xl border border-l-2 border-l-[#2EC5FF] border-[var(--orbit-glow)]/20 bg-[var(--orbit-glow)]/5 p-3">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Activity className="h-3.5 w-3.5 text-[#2EC5FF]" />
              <div className="absolute inset-0 animate-semantic-pulse rounded-full bg-[#2EC5FF]" />
            </div>
            <div>
              <div className="text-xs font-light text-[var(--orbit-text)]">Detecção Semântica</div>
              <div className="text-[10px] text-[var(--orbit-text-muted)]/50">
                Analisando padrões de comportamento...
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
