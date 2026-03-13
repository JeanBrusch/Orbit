"use client"

import { Clock, MapPin, TrendingUp, Sparkles, Calendar, FileImage, Calculator } from "lucide-react"

// Flexible lead data type for both page and panel usage
interface LeadData {
  id: string
  name: string
  avatar: string
  emotionalState: "intent" | "curious" | "aware" | "conflicted" | "silentGravity"
  emotionalLabel: string
  property: string
  lastResponse: string
  isPriority: boolean
  isMuted: boolean
}

interface CognitiveAnalysisProps {
  lead: LeadData
}

const stateHistory = [
  { state: "AWARE", timestamp: "Ontem, 14:30" },
  { state: "CURIOUS", timestamp: "Hoje, 09:15" },
  { state: "INTENT", timestamp: "Hoje, 09:45" },
]

const suggestedSteps = [
  { icon: FileImage, label: "Enviar plantas de 3 suítes", color: "text-[#2ec5ff]" },
  { icon: Calendar, label: "Agendar visita ao decorado", color: "text-emerald-400" },
  { icon: Calculator, label: "Apresentar simulação financeira", color: "text-amber-400" },
]

export function CognitiveAnalysis({ lead }: CognitiveAnalysisProps) {
  return (
    <div className="h-full overflow-y-auto p-4 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[rgba(46,197,255,0.2)]">
      <div className="space-y-6">
        {/* Inferred Profile */}
        <section>
          <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#64748b]">
            <TrendingUp className="h-3 w-3" />
            Perfil Inferido
          </h3>
          <div className="space-y-3">
            <div>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-[#94a3b8]">Intenção de Compra</span>
                <span className="font-medium text-emerald-400">85%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-[rgba(46,197,255,0.1)]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400"
                  style={{ width: "85%" }}
                />
              </div>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-[#94a3b8]">Poder de Decisão</span>
                <span className="font-medium text-[#2ec5ff]">Alto</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-[rgba(46,197,255,0.1)]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#2ec5ff] to-cyan-400"
                  style={{ width: "75%" }}
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-[rgba(46,197,255,0.05)] p-2">
              <span className="text-xs text-[#94a3b8]">Orçamento Estimado</span>
              <span className="text-xs font-medium text-[#e6eef6]">R$ 1.2M - R$ 1.8M</span>
            </div>
          </div>
        </section>

        {/* Detected Objections */}
        <section>
          <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#64748b]">
            <Sparkles className="h-3 w-3" />
            Objeções Detectadas
          </h3>
          <div className="space-y-2">
            <div className="flex items-center gap-2 rounded-lg bg-[rgba(46,197,255,0.05)] p-2">
              <Clock className="h-3 w-3 text-amber-400" />
              <span className="text-xs text-[#94a3b8]">Prazo de entrega</span>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-[rgba(46,197,255,0.05)] p-2">
              <MapPin className="h-3 w-3 text-cyan-400" />
              <span className="text-xs text-[#94a3b8]">Localização / distância do trabalho</span>
            </div>
          </div>
        </section>

        {/* Emotional Triggers */}
        <section>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#64748b]">Gatilhos Emocionais</h3>
          <div className="flex flex-wrap gap-2">
            {["Status", "Investimento", "Qualidade de vida", "Vista para o mar"].map((trigger) => (
              <span
                key={trigger}
                className="rounded-full border border-[rgba(46,197,255,0.2)] bg-[rgba(46,197,255,0.05)] px-2 py-1 text-[10px] text-[#94a3b8]"
              >
                {trigger}
              </span>
            ))}
          </div>
        </section>

        {/* State History */}
        <section>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#64748b]">Histórico de Estados</h3>
          <div className="relative pl-4">
            <div className="absolute bottom-0 left-1 top-0 w-px bg-gradient-to-b from-[#2ec5ff] via-[#2ec5ff]/50 to-transparent" />
            <div className="space-y-3">
              {stateHistory.map((item, i) => (
                <div key={i} className="relative">
                  <div
                    className={`absolute -left-4 top-1 h-2 w-2 rounded-full ${
                      i === stateHistory.length - 1
                        ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]"
                        : "bg-[#2ec5ff]/50"
                    }`}
                  />
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-medium ${i === stateHistory.length - 1 ? "text-emerald-400" : "text-[#94a3b8]"}`}
                    >
                      {item.state}
                    </span>
                    <span className="text-[10px] text-[#475569]">{item.timestamp}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Suggested Next Steps */}
        <section>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#64748b]">Próximos Passos</h3>
          <div className="space-y-2">
            {suggestedSteps.map((step, i) => (
              <button
                key={i}
                className="flex w-full items-center gap-3 rounded-lg border border-[rgba(46,197,255,0.15)] bg-[rgba(46,197,255,0.05)] p-3 text-left transition-all duration-240 hover:border-[#2ec5ff]/40 hover:bg-[rgba(46,197,255,0.1)]"
              >
                <step.icon className={`h-4 w-4 ${step.color}`} />
                <span className="text-xs text-[#e6eef6]">{step.label}</span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
