"use client"

import { useState, useEffect, useCallback } from "react"
import { ChevronRight, ChevronLeft, Star, Clock, Zap, Loader2 } from "lucide-react"
import type { LeadData } from "@/app/lead/[id]/page"
import { getSupabase } from "@/lib/supabase"
import { motion, AnimatePresence } from "framer-motion"

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

  const fetchMemories = useCallback(async () => {
    const supabase = getSupabase()
    const { data } = await supabase
      .from('memory_items')
      .select('id, type, content, confidence, created_at')
      .eq('lead_id', lead.id)
      .order('created_at', { ascending: false })
      .limit(40)
    if (data) setMemories(data as MemoryItem[])
    setLoading(false)
  }, [lead.id])

  useEffect(() => {
    fetchMemories()

    const supabase = getSupabase()

    // Realtime: append new memory_items as they arrive — no polling needed
    const channel = supabase
      .channel(`cognitive-analysis-${lead.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'memory_items', filter: `lead_id=eq.${lead.id}` },
        (payload) => {
          setMemories(prev => {
            const incoming = payload.new as MemoryItem
            if (prev.some(m => m.id === incoming.id)) return prev
            return [incoming, ...prev]
          })
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'memory_items', filter: `lead_id=eq.${lead.id}` },
        () => { fetchMemories() }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [lead.id, fetchMemories])

  const profileItems = memories.filter(m => PROFILE_TYPES.includes(m.type))
  const contextItems = memories.filter(m => CONTEXT_TYPES.includes(m.type))
  const eventItems   = memories.filter(m => EVENT_TYPES.includes(m.type))

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
              ? `Última análise: ${new Date(cog.last_ai_analysis_at).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}`
              : 'Aguardando análise...'}
          </div>

          {/* Cognitive Scores */}
          {cog && (
            <div className="space-y-2">
              {[
                { label: 'Interesse', value: cog.interest_score, color: '#d4af35' },
                { label: 'Momentum', value: cog.momentum_score, color: '#d4af35' },
                { label: 'Risco',    value: cog.risk_score,     color: '#ef4444' },
                { label: 'Clareza', value: cog.clarity_level,  color: '#d4af35' },
              ].map(({ label, value, color }) => (
                <div key={label} className="space-y-1">
                  <div className="flex justify-between text-[9px] text-slate-500">
                    <span>{label}</span>
                    <span>{Math.round(value ?? 0)}%</span>
                  </div>
                  <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${value ?? 0}%`, backgroundColor: color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Memory Sections */}
          {!loading && memories.length === 0 && (
            <p className="text-[10px] text-slate-600 text-center py-4">Nenhuma memória ainda</p>
          )}

          <MemorySection title="Perfil" items={profileItems} />
          <MemorySection title="Contexto" items={contextItems} />
          <MemorySection title="Eventos" items={eventItems} />
        </div>
      )}
    </div>
  )
}
