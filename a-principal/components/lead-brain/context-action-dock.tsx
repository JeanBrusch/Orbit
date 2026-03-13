"use client"

import type React from "react"

import { FileText, Calendar, Building2, Zap, Send, Phone, Gift, Clock } from "lucide-react"

interface ContextActionDockProps {
  emotionalState: string
}

const actionsByState: Record<string, Array<{ icon: React.ElementType; label: string; color: string }>> = {
  intent: [
    {
      icon: FileText,
      label: "Enviar Proposta",
      color: "border-emerald-500/30 hover:border-emerald-500/60 text-emerald-400",
    },
    { icon: Calendar, label: "Agendar Visita", color: "border-[#2ec5ff]/30 hover:border-[#2ec5ff]/60 text-[#2ec5ff]" },
    {
      icon: Building2,
      label: "Imóveis Similares",
      color: "border-amber-500/30 hover:border-amber-500/60 text-amber-400",
    },
    { icon: Zap, label: "Criar Urgência", color: "border-rose-500/30 hover:border-rose-500/60 text-rose-400" },
  ],
  curious: [
    { icon: Send, label: "Enviar Material", color: "border-[#2ec5ff]/30 hover:border-[#2ec5ff]/60 text-[#2ec5ff]" },
    {
      icon: Phone,
      label: "Agendar Ligação",
      color: "border-emerald-500/30 hover:border-emerald-500/60 text-emerald-400",
    },
    { icon: Building2, label: "Mostrar Opções", color: "border-amber-500/30 hover:border-amber-500/60 text-amber-400" },
    {
      icon: Gift,
      label: "Oferecer Benefício",
      color: "border-purple-500/30 hover:border-purple-500/60 text-purple-400",
    },
  ],
  aware: [
    { icon: Send, label: "Primeiro Contato", color: "border-[#2ec5ff]/30 hover:border-[#2ec5ff]/60 text-[#2ec5ff]" },
    { icon: Gift, label: "Enviar Brinde", color: "border-amber-500/30 hover:border-amber-500/60 text-amber-400" },
    {
      icon: Calendar,
      label: "Convidar Evento",
      color: "border-emerald-500/30 hover:border-emerald-500/60 text-emerald-400",
    },
  ],
  conflicted: [
    { icon: Phone, label: "Ligar Agora", color: "border-rose-500/30 hover:border-rose-500/60 text-rose-400" },
    {
      icon: FileText,
      label: "Esclarecer Dúvidas",
      color: "border-[#2ec5ff]/30 hover:border-[#2ec5ff]/60 text-[#2ec5ff]",
    },
    { icon: Gift, label: "Oferecer Condição", color: "border-amber-500/30 hover:border-amber-500/60 text-amber-400" },
    { icon: Zap, label: "Criar Urgência", color: "border-purple-500/30 hover:border-purple-500/60 text-purple-400" },
  ],
  silentGravity: [
    { icon: Clock, label: "Reagendar Contato", color: "border-[#2ec5ff]/30 hover:border-[#2ec5ff]/60 text-[#2ec5ff]" },
    { icon: Send, label: "Enviar Lembrete", color: "border-amber-500/30 hover:border-amber-500/60 text-amber-400" },
    {
      icon: Gift,
      label: "Reativar com Oferta",
      color: "border-emerald-500/30 hover:border-emerald-500/60 text-emerald-400",
    },
  ],
}

export function ContextActionDock({ emotionalState }: ContextActionDockProps) {
  const actions = actionsByState[emotionalState] || actionsByState.intent

  return (
    <div className="flex shrink-0 items-center gap-2 overflow-x-auto border-t border-[rgba(46,197,255,0.1)] bg-[rgba(10,10,15,0.8)] px-4 py-3 backdrop-blur-sm md:justify-center md:gap-3 md:px-8">
      {actions.map((action, i) => (
        <button
          key={i}
          className={`flex shrink-0 items-center gap-2 rounded-lg border bg-[rgba(15,23,42,0.6)] px-4 py-2 text-sm transition-all duration-240 hover:bg-[rgba(46,197,255,0.1)] ${action.color}`}
        >
          <action.icon className="h-4 w-4" />
          <span className="whitespace-nowrap">{action.label}</span>
        </button>
      ))}
    </div>
  )
}
