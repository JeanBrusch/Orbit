"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Phone, Home, Users, Calendar, FileText, Loader2, Check } from "lucide-react"
import { createClient } from "@supabase/supabase-js"
import { processEventWithCore } from "@/lib/orbit-core"

const INTERACTION_TYPES = [
  { id: "call",        label: "Ligação",       Icon: Phone,    color: "text-emerald-400", border: "border-emerald-500/30", bg: "bg-emerald-500/10" },
  { id: "visit",       label: "Visita",        Icon: Home,     color: "text-[#d4af35]",   border: "border-[#d4af35]/30",  bg: "bg-[#d4af35]/10" },
  { id: "meeting",     label: "Reunião",       Icon: Users,    color: "text-blue-400",    border: "border-blue-400/30",   bg: "bg-blue-400/10" },
  { id: "next_contact",label: "Próx. Contato", Icon: Calendar, color: "text-amber-400",   border: "border-amber-400/30",  bg: "bg-amber-400/10" },
  { id: "note",        label: "Anotação",      Icon: FileText, color: "text-slate-400",   border: "border-slate-500/30",  bg: "bg-slate-500/10" },
]

interface Props {
  leadId: string
  leadPhone?: string | null
  onClose: () => void
  onSaved: () => void
}

export function ManualInteractionModal({ leadId, leadPhone, onClose, onSaved }: Props) {
  const [selectedType, setSelectedType] = useState("call")
  const [summary, setSummary] = useState("")
  const [nextContactAt, setNextContactAt] = useState("")
  const [isAttention, setIsAttention] = useState(false)
  const [status, setStatus] = useState<"idle" | "saving" | "done">("idle")

  const selected = INTERACTION_TYPES.find(t => t.id === selectedType)!

  const handleSave = async () => {
    if (!summary.trim()) return
    setStatus("saving")

    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      const content = JSON.stringify({
        type: selectedType,
        summary: summary.trim(),
        next_contact_at: nextContactAt || null,
        is_attention: isAttention
      })

      const { data: msg, error } = await supabase
        .from('messages')
        .insert({
          lead_id: leadId,
          source: 'operator',
          content,
          timestamp: new Date().toISOString(),
          idempotency_key: `manual:${leadId}:${Date.now()}`
        })
        .select('id')
        .single()

      if (!error && msg?.id) {
        // Trigger cognitive processing
        processEventWithCore(leadId, summary.trim(), 'note', msg.id).catch(() => {})
      }

      // Save reminder if next contact date was set
      if (nextContactAt) {
        await supabase.from('reminders').insert({
          lead_id: leadId,
          due_at: nextContactAt,
          type: 'follow_up',
          status: 'pending'
        })
      }

      setStatus("done")
      setTimeout(() => { onSaved(); onClose() }, 800)
    } catch (err) {
      console.error('[MANUAL INTERACTION] Error:', err)
      setStatus("idle")
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4 pb-4 sm:pb-0"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        initial={{ y: 40, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 40, opacity: 0, scale: 0.97 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
        className="w-full max-w-md bg-[#0a0907] border border-[#d4af35]/20 rounded-2xl shadow-[0_0_60px_rgba(212,175,53,0.08)] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#d4af35]/10">
          <div className="flex items-center gap-2.5">
            <div className="w-1.5 h-4 rounded-full bg-[#d4af35]" />
            <h3 className="text-sm font-bold text-white tracking-tight">Registrar Interação</h3>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Type selection */}
          <div className="flex flex-wrap gap-2">
            {INTERACTION_TYPES.map(t => {
              const Icon = t.Icon
              const active = selectedType === t.id
              return (
                <button
                  key={t.id}
                  onClick={() => setSelectedType(t.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-bold transition-all ${
                    active ? `${t.bg} ${t.border} ${t.color}` : 'bg-transparent border-white/10 text-slate-500 hover:border-white/20 hover:text-slate-300'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  {t.label}
                </button>
              )
            })}
          </div>

          {/* Summary textarea */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
              Resumo do contato
            </label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={3}
              placeholder={
                selectedType === 'call' ? 'Ex: Cliente confirmou interesse no apartamento de 3 dormitórios...' :
                selectedType === 'visit' ? 'Ex: Visita realizada, cliente gostou muito da localização...' :
                selectedType === 'next_contact' ? 'Ex: Ligar para confirmar disponibilidade para visita...' :
                'Descreva o que aconteceu...'
              }
              className="w-full px-3 py-2.5 rounded-xl bg-[#14120c] border border-white/8 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-[#d4af35]/40 focus:ring-1 focus:ring-[#d4af35]/20 resize-none transition-all"
            />
          </div>

          {/* Next contact date (shown only for next_contact type) */}
          <AnimatePresence>
            {selectedType === 'next_contact' && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
              >
                <label className="text-[10px] font-bold text-amber-400/70 uppercase tracking-wider block mb-1.5">
                  Data e hora do próximo contato
                </label>
                <input
                  type="datetime-local"
                  value={nextContactAt}
                  onChange={(e) => setNextContactAt(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#14120c] border border-amber-400/20 text-sm text-slate-200 focus:outline-none focus:border-amber-400/40 focus:ring-1 focus:ring-amber-400/20 transition-all"
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Attention toggle */}
          <button
            onClick={() => setIsAttention(!isAttention)}
            className={`flex items-center gap-2 text-xs font-medium transition-colors ${isAttention ? 'text-amber-400' : 'text-slate-500 hover:text-slate-400'}`}
          >
            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${isAttention ? 'bg-amber-400/20 border-amber-400/50' : 'border-white/10'}`}>
              {isAttention && <Check className="w-2.5 h-2.5 text-amber-400" />}
            </div>
            Marcar como ponto de atenção
          </button>

          {/* Action button */}
          <button
            onClick={handleSave}
            disabled={!summary.trim() || status !== 'idle'}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${
              status === 'done'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-[#d4af35] text-[#0a0907] hover:brightness-110 disabled:opacity-40'
            }`}
          >
            {status === 'saving' && <Loader2 className="w-4 h-4 animate-spin" />}
            {status === 'done' && <Check className="w-4 h-4" />}
            {status === 'idle' ? 'Registrar Interação' : status === 'saving' ? 'Salvando...' : 'Salvo!'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
