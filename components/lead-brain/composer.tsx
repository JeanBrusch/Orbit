"use client"

import { useState, useEffect, useCallback } from "react"
import { ArrowUp, Plus, Loader2, Check } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { ManualInteractionModal } from "./manual-interaction-modal"

interface LeadBrainComposerProps {
  leadId: string
  leadPhone?: string | null
  aiSuggestion?: string | null
  onMessageSent?: () => void
}

export function LeadBrainComposer({ leadId, leadPhone, aiSuggestion, onMessageSent }: LeadBrainComposerProps) {
  const [value, setValue] = useState("")
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle")
  const [showModal, setShowModal] = useState(false)

  const handleSend = useCallback(async () => {
    if (!value.trim() || status !== "idle") return

    setStatus("sending")
    try {
      const phone = leadPhone

      if (!phone) {
        // No phone number: save locally as operator message only
        await fetch("/api/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leadId, content: value.trim(), source: "operator" }),
        })
      } else {
        await fetch("/api/whatsapp/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone, message: value.trim(), leadId }),
        })
      }

      setStatus("done")
      setValue("")
      onMessageSent?.()
      setTimeout(() => setStatus("idle"), 1500)
    } catch (err) {
      console.error("[COMPOSER] Send error:", err)
      setStatus("error")
      setTimeout(() => setStatus("idle"), 2000)
    }
  }, [value, status, leadPhone, leadId, onMessageSent])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const applySuggestion = () => {
    if (aiSuggestion) setValue(aiSuggestion)
  }

  return (
    <>
      <div className="flex-shrink-0 border-t border-[#d4af35]/10 bg-[#0a0907]/95 px-5 py-4">
        <div className="max-w-3xl mx-auto space-y-2">

          {/* AI Suggestion ghost */}
          <AnimatePresence>
            {aiSuggestion && !value && (
              <motion.button
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                onClick={applySuggestion}
                className="w-full text-left px-3 py-2 rounded-lg border border-[#d4af35]/15 bg-[#d4af35]/5 text-xs text-[#d4af35]/60 hover:text-[#d4af35]/80 hover:border-[#d4af35]/25 transition-all italic truncate"
              >
                💡 Sugestão: {aiSuggestion}
              </motion.button>
            )}
          </AnimatePresence>

          {/* Composer bar */}
          <div className={`flex items-center gap-2.5 bg-[#14120c] border rounded-xl px-3 py-2.5 transition-all duration-200 ${
            value.trim() ? "border-[#d4af35]/30 shadow-[0_0_16px_rgba(212,175,53,0.07)]" : "border-white/8"
          }`}>

            {/* Manual Interaction button */}
            <button
              onClick={() => setShowModal(true)}
              title="Registrar interação manual"
              className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-[#d4af35] hover:bg-[#d4af35]/10 border border-white/8 hover:border-[#d4af35]/30 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>

            <textarea
              rows={1}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="O que você quer comunicar agora?"
              className="flex-1 bg-transparent text-sm text-slate-200 placeholder-slate-600 outline-none resize-none leading-relaxed max-h-32 overflow-y-auto"
            />

            {/* Send button */}
            <button
              onClick={handleSend}
              disabled={!value.trim() || status !== "idle"}
              className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition-all ${
                status === "done"
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : status === "error"
                  ? "bg-red-500/20 text-red-400 border border-red-500/30"
                  : value.trim()
                  ? "bg-[#d4af35] text-[#0a0907] hover:brightness-110 shadow-[0_0_12px_rgba(212,175,53,0.3)]"
                  : "text-slate-600 border border-white/8"
              }`}
            >
              {status === "sending" ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : status === "done" ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <ArrowUp className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          <p className="text-[9px] text-center text-slate-700 tracking-widest uppercase">
            {leadPhone ? "Enviando via WhatsApp · Z-API" : "Sem número · gravando internamente"}
          </p>
        </div>
      </div>

      {/* Manual Interaction Modal */}
      <AnimatePresence>
        {showModal && (
          <ManualInteractionModal
            leadId={leadId}
            leadPhone={leadPhone}
            onClose={() => setShowModal(false)}
            onSaved={() => { onMessageSent?.(); setShowModal(false) }}
          />
        )}
      </AnimatePresence>
    </>
  )
}
