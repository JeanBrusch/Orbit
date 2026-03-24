"use client"

import { useState, useEffect, useCallback } from 'react'
import { getSupabase } from '@/lib/supabase'

export interface OrbitEvent {
  id: string
  lead_id: string | null
  timestamp: string
  event_type: string
  source: string
  module: string
  input_size: number | null
  output_size: number | null
  tokens_input: number | null
  tokens_output: number | null
  cost_usd: number | null
  duration_ms: number | null
  metadata_json: any
  step: string | null
  action: string | null
  origin: string | null
  destination: string | null
  has_ai: boolean | null
  saved_data: boolean | null
  leads?: {
    name: string
  }
}

export function useObservability() {
  const [events, setEvents] = useState<OrbitEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalCost: 0,
    totalCalls: 0,
    costByModule: {} as Record<string, number>,
    costByDay: {} as Record<string, number>,
  })

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    const supabase = getSupabase()
    
    const { data, error } = await (supabase
      .from('orbit_events') as any)
      .select('*, leads(name)')
      .order('timestamp', { ascending: false })
      .limit(200)

    if (!error && data) {
      setEvents(data)
      
      // Calcular estatísticas
      let total = 0
      let calls = 0
      const byModule = {} as Record<string, number>
      const byDay = {} as Record<string, number>

      data.forEach((ev: OrbitEvent) => {
        const cost = Number(ev.cost_usd || 0)
        total += cost
        if (ev.event_type === 'ai_call') calls++
        
        byModule[ev.module] = (byModule[ev.module] || 0) + cost
        
        const day = new Date(ev.timestamp).toLocaleDateString('pt-BR')
        byDay[day] = (byDay[day] || 0) + cost
      })

      setStats({
        totalCost: total,
        totalCalls: calls,
        costByModule: byModule,
        costByDay: byDay
      })
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchEvents()
    
    // Realtime integration
    const supabase = getSupabase()
    const channel = supabase
      .channel('orbit_events_changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orbit_events' }, payload => {
        setEvents(prev => [payload.new as OrbitEvent, ...prev].slice(0, 200))
        // Re-calcs stats could be done here or just refetch periodically
        fetchEvents() 
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchEvents])

  return { events, loading, stats, refetch: fetchEvents }
}
