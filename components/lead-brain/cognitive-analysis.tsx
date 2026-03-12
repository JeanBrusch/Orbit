"use client"

import { useState, useEffect } from "react"
import { ChevronRight, ChevronLeft, Brain, MapPin, DollarSign, Star, Clock, AlertCircle, Zap, Loader2 } from "lucide-react"
import { createClient } from "@supabase/supabase-js"
import { motion, AnimatePresence } from "framer-motion"

export interface LeadData {
  id: string
  actionSuggested?: string
  dominantPain?: string
  cognitiveState?: {
    interest_score: number
    momentum_score: number
    risk_score: number
    clarity_level: number
    current_state: string
    last_ai_analysis_at: string | null
  }
}

interface CognitiveAnalysisProps {
  lead: LeadData
}

interface MemoryItem {
  id: string
  type: string
  content: string
  confidence: number | null
  created_at: string | null
}

const PROFILE_TYPES = ['identity', 'budget_range', 'location_preference', 'property_type', 'feature_preference']
const CONTEXT_TYPES = ['current_search', 'location_focus', 'budget', 'priority', 'intent', 'preference']
const EVENT_TYPES   = ['property_sent', 'visited', 'discarded', 'price_objection', 'proposal_made', 'visit_scheduled', 'event']

function typeIcon(type: string) {
  if (PROFILE_TYPES.includes(type)) return <Star className="w-2.5 h-2.5" />
  if (EVENT_TYPES.includes(type)) return <Clock className="w-2.5 h-2.5" />
  return <Zap className="w-2.5 h-2.5" />
}

function typeBadge(type: string) {
  if (PROFILE_TYPES.includes(type)) return "text-[#d4af35] bg-[#d4af35]/10 border-[#d4af35]/20"
  if (EVENT_TYPES.includes(type)) return "text-blue-400 bg-blue-400/10 border-blue-400/20"
  return "text-emerald-400 bg-emerald-400/10 border-emerald-400/20"
}

function MemorySection({ title, items }: { title: string, items: MemoryItem[] }) {
  const [open, setOpen] = useState(true)
  if (items.length === 0) return null
  return (
    <div className="border border-white/5 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full px-3 py-2 flex items-center justify-between bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
        <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">{title}</span>
        <div className={`text-slate-600 transition-transform ${open ? 'rotate-90' : ''}`}>
          <ChevronRight className="w-3 h-3" />
        </div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
            <div className="px-3 py-2 space-y-2">
              {items.map(item => (
                <div key={item.id} className="flex items-start gap-2">
                  <div className={`mt-0.5 p-1 rounded border ${typeBadge(item.type)} shrink-0`}>
                    {typeIcon(item.type)}
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">{item.content}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function CognitiveAnalysis({ lead }: CognitiveAnalysisProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [memories, setMemories] = useState<MemoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const cog = lead.cognitiveState

  // Fetch real memory items with polling
  useEffect(() => {
    let interval: NodeJS.Timeout
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const fetchMemories = async () => {
      const { data } = await supabase
        .from('memory_items')
        .select('id, type, content, confidence, created_at')
        .eq('lead_id', lead.id)
        .order('created_at', { ascending: false })
        .limit(40)
      if (data) setMemories(data as MemoryItem[])
      setLoading(false)
    }

    fetchMemories()
    interval = setInterval(fetchMemories, 15000)
    return () => clearInterval(interval)
  }, [lead.id])

  const profileItems  = memories.filter(m => PROFILE_TYPES.includes(m.type))
  const contextItems  = memories.filter(m => CONTEXT_TYPES.includes(m.type))
  const eventItems    = memories.filter(m => EVENT_TYPES.includes(m.type))

  return (
    <div className={`flex-shrink-0 border-l border-[#d4af35]/10 transition-all duration-300 flex flex-col h-full bg-[#0a0907] ${collapsed ? "w-10" : "w-[280px]"}`}>
      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center py-3 border-b border-[#d4af35]/10 text-slate-600 hover:text-[#d4af35] transition-colors"
      >
        {collapsed ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
      </button>

      {!collapsed && (
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          {/* Section title */}
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-[#d4af35]/50">Contexto Ativo</span>
            {loading && <Loader2 className="w-3 h-3 text-slate-600 animate-spin" />}
          </div>

          {/* Analysis Timestamp */}
          <div className="text-[9px] font-mono text-slate-700">
            {cog?.last_ai_analysis_at
              ? `Analisado · ${new Date(cog.last_ai_analysis_at).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}`
              : 'Aguardando análise da IA'
            }
          </div>

          {/* Cognitive Scores */}
          {cog && (
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Interesse', value: cog.interest_score, color: 'text-emerald-400' },
                { label: 'Momentum', value: cog.momentum_score, color: 'text-blue-400' },
                { label: 'Risco', value: cog.risk_score, color: 'text-amber-400' },
                { label: 'Clareza', value: cog.clarity_level, color: 'text-[#d4af35]' },
              ].map(s => (
                <div key={s.label} className="bg-[#14120c] border border-white/5 rounded-lg px-2.5 py-2 text-center">
                  <div className="text-[8px] text-slate-600 uppercase tracking-wider mb-1">{s.label}</div>
                  <div className={`text-base font-bold font-mono ${s.color}`}>{s.value}</div>
                </div>
              ))}
            </div>
          )}

          {/* Action Suggested */}
          {lead.actionSuggested && (
            <div className="flex items-start gap-2 rounded-xl border border-[#d4af35]/20 bg-[#d4af35]/5 p-3">
              <Zap className="w-3.5 h-3.5 text-[#d4af35] shrink-0 mt-0.5" />
              <p className="text-[11px] text-[#d4af35]/80 leading-relaxed">{lead.actionSuggested}</p>
            </div>
          )}

          {/* Dominant Pain */}
          {lead.dominantPain && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-400/5 p-3">
              <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-400/80 leading-relaxed">{lead.dominantPain}</p>
            </div>
          )}

          {/* Memory Sections */}
          <div className="space-y-2">
            <MemorySection title="Perfil" items={profileItems} />
            <MemorySection title="Contexto Atual" items={contextItems} />
            <MemorySection title="Eventos" items={eventItems} />
          </div>

          {memories.length === 0 && !loading && (
            <div className="text-center py-6">
              <Brain className="w-5 h-5 text-slate-700 mx-auto mb-2" />
              <p className="text-[10px] text-slate-700">Memória vazia. Aguardando interações.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
