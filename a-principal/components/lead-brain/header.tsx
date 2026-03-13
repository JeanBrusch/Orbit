"use client"

import { ArrowLeft, Star, BellOff, Bell, RotateCcw, X, PanelRightOpen } from "lucide-react"
import type { LeadData } from "@/app/lead/[id]/page"

interface LeadBrainHeaderProps {
  lead: LeadData
  onBack: () => void
  onTogglePriority: () => void
  onToggleMute: () => void
  onToggleMobileSidebar: () => void
}

const emotionalStateColors: Record<string, { bg: string; text: string; glow: string }> = {
  intent: {
    bg: "bg-emerald-500/20",
    text: "text-emerald-400",
    glow: "shadow-[0_0_12px_rgba(52,211,153,0.5)]",
  },
  curious: {
    bg: "bg-amber-500/20",
    text: "text-amber-400",
    glow: "shadow-[0_0_12px_rgba(251,191,36,0.5)]",
  },
  aware: {
    bg: "bg-cyan-500/20",
    text: "text-cyan-400",
    glow: "shadow-[0_0_12px_rgba(34,211,238,0.5)]",
  },
  conflicted: {
    bg: "bg-orange-500/20",
    text: "text-orange-400",
    glow: "shadow-[0_0_12px_rgba(251,146,60,0.5)]",
  },
  silentGravity: {
    bg: "bg-slate-500/20",
    text: "text-slate-400",
    glow: "shadow-[0_0_12px_rgba(148,163,184,0.3)]",
  },
}

export function LeadBrainHeader({
  lead,
  onBack,
  onTogglePriority,
  onToggleMute,
  onToggleMobileSidebar,
}: LeadBrainHeaderProps) {
  const stateColors = emotionalStateColors[lead.emotionalState]

  return (
    <header className="relative flex h-20 shrink-0 items-center justify-between border-b border-[rgba(46,197,255,0.15)] bg-[#0f0f14] px-4 md:px-6">
      {/* Subtle bottom glow */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#2ec5ff]/50 to-transparent" />

      {/* Left - Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-[#94a3b8] transition-colors duration-240 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        <span className="hidden sm:inline">Voltar ao Orbit</span>
      </button>

      {/* Center - Lead info */}
      <div className="flex items-center gap-3">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-full border-2 ${stateColors.text} border-current ${stateColors.glow} bg-[rgba(15,23,42,0.8)] text-sm font-medium`}
        >
          {lead.avatar}
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-medium text-white">{lead.name}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${stateColors.bg} ${stateColors.text} ${stateColors.glow}`}
            >
              {lead.emotionalLabel}
            </span>
          </div>
          <span className="text-xs text-[#64748b]">
            {lead.property} • Última resposta: {lead.lastResponse}
          </span>
        </div>
      </div>

      {/* Right - Quick actions */}
      <div className="flex items-center gap-1">
        <button
          onClick={onTogglePriority}
          className={`rounded-lg p-2 transition-all duration-240 hover:bg-white/5 ${
            lead.isPriority ? "text-amber-400" : "text-[#64748b]"
          }`}
          title="Prioridade"
        >
          <Star className={`h-4 w-4 ${lead.isPriority ? "fill-current" : ""}`} />
        </button>
        <button
          onClick={onToggleMute}
          className={`rounded-lg p-2 transition-all duration-240 hover:bg-white/5 ${
            lead.isMuted ? "text-amber-400" : "text-[#64748b]"
          }`}
          title={lead.isMuted ? "Ativar notificações" : "Silenciar"}
        >
          {lead.isMuted ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
        </button>
        <button
          className="rounded-lg p-2 text-[#64748b] transition-all duration-240 hover:bg-white/5 hover:text-white"
          title="Retornar à atmosfera"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
        <button
          className="rounded-lg p-2 text-[#64748b] transition-all duration-240 hover:bg-white/5 hover:text-rose-400"
          title="Marcar como resolvido"
        >
          <X className="h-4 w-4" />
        </button>
        <button
          onClick={onToggleMobileSidebar}
          className="rounded-lg p-2 text-[#64748b] transition-all duration-240 hover:bg-white/5 hover:text-white lg:hidden"
          title="Mostrar análise"
        >
          <PanelRightOpen className="h-4 w-4" />
        </button>
      </div>
    </header>
  )
}
