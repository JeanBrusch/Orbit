"use client"

import { useState } from "react"
import { Sparkles, Send, ImageIcon, Video, FileText, Link2, Clock } from "lucide-react"

const intentChips = ["Nutrir interesse", "Responder dúvida", "Criar urgência", "Agendar visita", "Enviar material"]

const toneOptions = ["Formal", "Consultivo", "Próximo", "Direto"]

const aiSuggestions = [
  "Marina, temos uma condição especial para unidades no 18º andar esta semana. Posso enviar os detalhes?",
  "Que tal agendarmos uma visita ao decorado amanhã às 15h? O apartamento de 158m² é impressionante!",
  "Preparei uma simulação personalizada com as melhores condições de pagamento. Posso compartilhar?",
]

export function LeadBrainComposer() {
  const [isExpanded, setIsExpanded] = useState(false)
  const [message, setMessage] = useState("")
  const [selectedIntent, setSelectedIntent] = useState<string | null>(null)
  const [selectedTone, setSelectedTone] = useState("Consultivo")
  const [scheduleEnabled, setScheduleEnabled] = useState(false)

  return (
    <div
      className={`shrink-0 border-t border-[rgba(46,197,255,0.15)] bg-[rgba(10,10,15,0.95)] backdrop-blur-xl transition-all duration-300 ${
        isExpanded ? "max-h-[320px]" : "max-h-[70px]"
      }`}
    >
      <div className="mx-auto max-w-4xl p-4">
        {/* Expanded Content */}
        {isExpanded && (
          <div className="mb-3 space-y-3 animate-text-fade-in">
            {/* Intent Chips */}
            <div className="flex flex-wrap gap-2">
              {intentChips.map((intent) => (
                <button
                  key={intent}
                  onClick={() => setSelectedIntent(selectedIntent === intent ? null : intent)}
                  className={`rounded-full border px-3 py-1 text-xs transition-all duration-240 ${
                    selectedIntent === intent
                      ? "border-[#2ec5ff] bg-[#2ec5ff]/20 text-[#2ec5ff]"
                      : "border-[rgba(46,197,255,0.2)] text-[#94a3b8] hover:border-[#2ec5ff]/50"
                  }`}
                >
                  {intent}
                </button>
              ))}
            </div>

            {/* AI Suggestions */}
            <div className="space-y-2">
              <span className="text-[10px] uppercase tracking-wider text-[#475569]">Sugestões da IA</span>
              {aiSuggestions.map((suggestion, i) => (
                <div
                  key={i}
                  className="group flex items-start justify-between gap-3 rounded-lg border border-[rgba(46,197,255,0.1)] bg-[rgba(46,197,255,0.03)] p-2"
                >
                  <p className="text-xs text-[#94a3b8]">{suggestion}</p>
                  <button
                    onClick={() => setMessage(suggestion)}
                    className="shrink-0 rounded bg-[#2ec5ff]/20 px-2 py-1 text-[10px] text-[#2ec5ff] opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    Usar
                  </button>
                </div>
              ))}
            </div>

            {/* Tone Selector + Media + Schedule */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wider text-[#475569]">Tom:</span>
                {toneOptions.map((tone) => (
                  <button
                    key={tone}
                    onClick={() => setSelectedTone(tone)}
                    className={`rounded px-2 py-1 text-[10px] transition-all duration-240 ${
                      selectedTone === tone ? "bg-[#2ec5ff]/20 text-[#2ec5ff]" : "text-[#64748b] hover:text-[#94a3b8]"
                    }`}
                  >
                    {tone}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button className="rounded p-1.5 text-[#64748b] transition-colors hover:bg-white/5 hover:text-white">
                  <ImageIcon className="h-4 w-4" />
                </button>
                <button className="rounded p-1.5 text-[#64748b] transition-colors hover:bg-white/5 hover:text-white">
                  <Video className="h-4 w-4" />
                </button>
                <button className="rounded p-1.5 text-[#64748b] transition-colors hover:bg-white/5 hover:text-white">
                  <FileText className="h-4 w-4" />
                </button>
                <button className="rounded p-1.5 text-[#64748b] transition-colors hover:bg-white/5 hover:text-white">
                  <Link2 className="h-4 w-4" />
                </button>
                <div className="ml-2 h-4 w-px bg-[rgba(46,197,255,0.2)]" />
                <button
                  onClick={() => setScheduleEnabled(!scheduleEnabled)}
                  className={`flex items-center gap-1 rounded px-2 py-1 text-[10px] transition-all duration-240 ${
                    scheduleEnabled ? "bg-amber-500/20 text-amber-400" : "text-[#64748b] hover:text-[#94a3b8]"
                  }`}
                >
                  <Clock className="h-3 w-3" />
                  Agendar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Input Row */}
        <div
          className={`flex items-center gap-3 rounded-xl border bg-[rgba(15,23,42,0.6)] px-4 py-3 transition-all duration-300 ${
            isExpanded
              ? "border-[#2ec5ff]/40 shadow-[0_0_20px_rgba(46,197,255,0.15)]"
              : "border-[rgba(46,197,255,0.15)]"
          }`}
        >
          <Sparkles
            className={`h-5 w-5 shrink-0 text-[#2ec5ff] ${isExpanded ? "drop-shadow-[0_0_8px_rgba(46,197,255,0.6)]" : "animate-sparkle-pulse"}`}
          />
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onFocus={() => setIsExpanded(true)}
            onBlur={() => !message && setIsExpanded(false)}
            placeholder="O que você quer provocar agora?"
            className="flex-1 bg-transparent text-sm text-[#e6eef6] placeholder-[#64748b] outline-none"
          />
          <button
            disabled={!message}
            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-240 ${
              message ? "bg-[#2ec5ff] text-[#0a0a0f] hover:scale-105" : "bg-[rgba(46,197,255,0.1)] text-[#64748b]"
            }`}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
