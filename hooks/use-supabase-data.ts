"use client"

import { useState, useEffect, useCallback, useRef } from 'react'
import { getSupabase } from '@/lib/supabase'

export interface OrbitLead {
  id: string
  name: string
  role: string
  avatar: string
  position: { top: string; left: string }
  badge?: "campaign" | "target" | "hot"
  badgeColor?: string
  delay: number
  emotionalState: "engaged" | "warm" | "neutral" | "cooling"
  keywords: string[]
  phone?: string
  lid?: string
  photoUrl?: string
  origin?: string
  state?: string
  actionSuggested?: string
  lastEventType?: string
  lastInteractionAt?: string
  hasCapsuleActive?: boolean
  daysSinceInteraction?: number
  orbitStage?: string | null
  orbitVisualState?: string | null
  needsAttention?: boolean
  interestScore?: number
  momentumScore?: number
  riskScore?: number
  clarityLevel?: number
  currentState?: 'latent' | 'curious' | 'exploring' | 'evaluating' | 'deciding' | 'resolved' | 'dormant'
  lastAiAnalysisAt?: string | null
  hasMatureNotes?: boolean
  cycleStage?: string
  followupActive?: boolean
  followupRemaining?: number
  followupDoneToday?: boolean
}

function mapStateToEmotionalState(state: string | null): "engaged" | "warm" | "neutral" | "cooling" {
  switch (state?.toLowerCase()) {
    case 'ativo':
    case 'quente':
    case 'hot':
      return 'engaged'
    case 'morno':
    case 'warm':
    case 'aguardando':
      return 'warm'
    case 'frio':
    case 'cold':
    case 'pausado':
      return 'cooling'
    default:
      return 'neutral'
  }
}

function mapStateToBadge(state: string | null, actionSuggested: string | null): { badge?: "campaign" | "target" | "hot", badgeColor?: string } {
  if (state === 'quente' || state === 'hot' || state === 'ativo') {
    return { badge: 'hot', badgeColor: 'bg-rose-500' }
  }
  if (actionSuggested?.toLowerCase().includes('prioridade') || actionSuggested?.toLowerCase().includes('target')) {
    return { badge: 'target', badgeColor: 'bg-[var(--orbit-accent)]' }
  }
  if (state === 'campanha' || state === 'campaign') {
    return { badge: 'campaign', badgeColor: 'bg-[var(--orbit-glow)]' }
  }
  return {}
}

function generatePosition(index: number, total: number): { top: string; left: string } {
  const angle = (2 * Math.PI * index) / Math.max(total, 1)
  const radius = 28 + (index % 3) * 5
  const centerX = 50
  const centerY = 50
  const x = centerX + Math.cos(angle) * radius
  const y = centerY + Math.sin(angle) * radius
  return { top: `${y}%`, left: `${x}%` }
}

function getInitials(name: string | null): string {
  if (!name) return '??'
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

interface LeadCenterRow {
  lead_id: string | null
  name: string | null
  phone: string | null
  lid: string | null
  photo_url: string | null
  origin: string | null
  estado_atual: string | null
  acao_sugerida: string | null
  last_event_type: string | null
  ultima_interacao_at: string | null
  dias_sem_interacao: number | null
  tem_capsula_ativa: boolean | null
  last_evaluated_at: string | null
  created_at: string | null
}

interface OrbitDataEntry {
  orbit_stage: string | null
  orbit_visual_state: string | null
  action_suggested: string | null
  last_event_type: string | null
  cycle_stage?: string | null
  followup_active?: boolean | null
  followup_remaining?: number | null
  followup_done_today?: boolean | null
  interest_score?: number
  momentum_score?: number
  risk_score?: number
  clarity_level?: number
  current_state?: string
  last_ai_analysis_at?: string | null
}

interface Options {
  disableInterval?: boolean;
  disableRealtime?: boolean;
}

export function useSupabaseLeads(options: Options = {}) {
  const [leads, setLeads] = useState<OrbitLead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const leadsRef = useRef<OrbitLead[]>([])
  leadsRef.current = leads

  const fetchLeads = useCallback(async (forceLoading = false) => {
    try {
      if (forceLoading || (leadsRef.current && leadsRef.current.length === 0)) {
        setLoading(true)
      }

      const supabase = getSupabase()

      // RPC consolidada: 4 queries em 1 (leads_center + leads + cognitive + notes flag)
      const { data, error: fetchError } = await supabase.rpc('get_orbit_leads')

      if (fetchError) throw fetchError

      const rows = (data || []) as any[]

      const mappedLeads: OrbitLead[] = rows.map((row, index) => {
        // Mapeamento compatível com o restante do sistema
        const badgeInfo = mapStateToBadge(row.estado_atual, row.acao_sugerida)
        
        return {
          id: row.lead_id,
          lid: row.lead_id,
          name: row.name || 'Sem nome',
          role: row.origin || 'Lead',
          avatar: getInitials(row.name),
          state: row.estado_atual || 'lead',
          badge: badgeInfo.badge,
          badgeColor: badgeInfo.badgeColor,
          
          // UI Layout props
          position: generatePosition(index, rows.length),
          delay: index * 0.1,
          emotionalState: mapStateToEmotionalState(row.estado_atual),
          keywords: [
            row.estado_atual || '',
            row.acao_sugerida || '',
            row.origin || '',
            row.last_event_type || '',
          ].filter(Boolean),

          // Core fields
          photoUrl: row.photo_url,
          lastEventType: row.last_event_type,
          hasMatureNotes: row.has_mature_notes,
          lastInteractionAt: row.ultima_interacao_at,
          
          // Cognitive & Status
          interestScore: row.interest_score,
          momentumScore: row.momentum_score,
          riskScore: row.risk_score,
          clarityLevel: row.clarity_level,
          currentState: row.current_state,
          lastAiAnalysisAt: row.last_ai_analysis_at,
          needsAttention: row.last_event_type === 'received',

          // Orbit/Cycle logic
          orbitStage: row.orbit_stage,
          orbitVisualState: row.orbit_visual_state,
          cycleStage: row.cycle_stage,
          followupActive: row.followup_active,
          followupRemaining: row.followup_remaining,
          followupDoneToday: row.followup_done_today,
          hasCapsuleActive: row.tem_capsula_ativa,
          daysSinceInteraction: row.dias_sem_interacao,
        }
      })

      setLeads(mappedLeads)
      setError(null)
    } catch (err) {
      console.error('Error in useSupabaseLeads:', err)
      setError(err instanceof Error ? err : new Error('Unknown error fetching leads'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLeads(true)

    if (options.disableRealtime) return;

    const supabase = getSupabase()
    console.log('[REALTIME] Initializing leads-orbit-realtime channel...')

    const channel = supabase
      .channel('leads-orbit-realtime')
      .on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table: 'leads_center' },
        (payload) => {
          console.log('[REALTIME] Update from leads_center:', payload)
          fetchLeads()
        }
      )
      .on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table: 'leads' },
        (payload) => {
          console.log('[REALTIME] Update from leads:', payload)
          fetchLeads()
        }
      )
      .subscribe((status) => {
        console.log('[REALTIME] Subscription status:', status)
      })

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchLeads()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      if (!options.disableRealtime) {
        supabase.removeChannel(channel)
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [fetchLeads, options.disableInterval, options.disableRealtime])

  const removeLead = useCallback((leadId: string) => {
    setLeads(prev => prev.filter(lead => lead.id !== leadId))
  }, [])

  return { leads, loading, error, refetch: fetchLeads, removeLead }
}

// ─── Properties ──────────────────────────────────────────────────────────────

interface PropertyRow {
  id: string
  source_link: string
  internal_name: string | null
  title: string | null
  cover_image: string | null
  source_domain: string | null
  ingestion_type: string | null
  ingestion_status: string | null
  lat: number | null
  lng: number | null
  location_status: string | null
  visibility: string | null
  created_at: string | null
  value: number | null
  location_text: string | null
  features?: string[]
  payment_conditions?: Record<string, any>
  area_privativa?: number
}

export function useSupabaseProperties() {
  const [properties, setProperties] = useState<PropertyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchProperties = useCallback(async () => {
    try {
      setLoading(true)
      const supabase = getSupabase()
      const { data, error: fetchError } = await supabase
        .from('properties')
        .select('*')
        .order('created_at', { ascending: false })
      if (fetchError) throw fetchError
      setProperties((data || []) as PropertyRow[])
      setError(null)
    } catch (err) {
      console.error('Error fetching properties:', err)
      setError(err instanceof Error ? err : new Error('Failed to fetch properties'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProperties()

    const supabase = getSupabase()
    const channel = supabase
      .channel('orbit-properties-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'properties' },
        () => { fetchProperties() }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchProperties])

  return { properties, loading, error, refetch: fetchProperties }
}

// ─── Message / Interaction types ─────────────────────────────────────────────

export interface MessageRow {
  id: string
  lead_id: string | null
  source: 'whatsapp' | 'operator'
  content: string | null
  timestamp: string
  ai_analysis: any
}

export interface PropertyInteractionRow {
  id: string
  lead_id: string | null
  property_id: string | null
  interaction_type: 'sent' | 'favorited' | 'visited' | 'discarded' | 'proposal'
  timestamp: string
  source: string | null
  property?: {
    id: string
    title: string | null
    cover_image: string | null
    source_link: string | null
    source_domain: string | null
    value: number | null
    location_text: string | null
  } | null
}

export interface AIInsightRow {
  id: string
  lead_id: string | null
  type: string
  content: string
  urgency: number
  created_at: string
}

export interface MemoryItemRow {
  id: string
  lead_id: string | null
  type: string
  content: string
  confidence: number
  created_at: string
}

export interface LeadCognitiveStateRow {
  lead_id: string
  interest_score: number
  momentum_score: number
  current_state: string
  last_ai_analysis_at: string | null
}

// ─── useLeadDetails — with Realtime ──────────────────────────────────────────

export function useLeadDetails(leadId: string | null) {
  const [propertyInteractions, setPropertyInteractions] = useState<PropertyInteractionRow[]>([])
  const [messages, setMessages] = useState<MessageRow[]>([])
  const [memories, setMemories] = useState<MemoryItemRow[]>([])
  const [insights, setInsights] = useState<AIInsightRow[]>([])
  const [cognitiveState, setCognitiveState] = useState<LeadCognitiveStateRow | null>(null)
  const [internalNote, setInternalNote] = useState<{ id: string, content: string } | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchDetails = useCallback(async () => {
    if (!leadId) {
      setMessages([])
      setMemories([])
      setInsights([])
      setCognitiveState(null)
      setInternalNote(null)
      return
    }

    setLoading(true)
    try {
      const supabase = getSupabase()
      const [propIntRes, messagesRes, memoryRes, insightsRes, cognitiveRes, noteRes] = await Promise.all([
        supabase.from('property_interactions').select('*').eq('lead_id', leadId).order('timestamp', { ascending: false }),
        supabase.from('messages').select('*').eq('lead_id', leadId).order('timestamp', { ascending: true }),
        supabase.from('memory_items').select('*').eq('lead_id', leadId).order('created_at', { ascending: false }),
        supabase.from('ai_insights').select('*').eq('lead_id', leadId).order('created_at', { ascending: false }),
        supabase.from('lead_cognitive_state').select('*').eq('lead_id', leadId).maybeSingle(),
        supabase.from('internal_notes').select('id, content').eq('lead_id', leadId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ])

      const propIntRows = (propIntRes.data || []) as PropertyInteractionRow[]

      if (propIntRows.length > 0) {
        const propertyIds = [...new Set(propIntRows.map(i => i.property_id).filter(Boolean))] as string[]
        const { data: propsData } = await supabase
          .from('properties')
          .select('id, title, cover_image, source_link, source_domain, value, location_text')
          .in('id', propertyIds)

        const propsMap = new Map(((propsData as PropertyRow[]) || []).map(p => [p.id, p]))
        for (const inter of propIntRows) {
          if (inter.property_id) {
            inter.property = propsMap.get(inter.property_id) as any
          }
        }
      }

      setPropertyInteractions(propIntRows)
      setMessages((messagesRes.data || []) as MessageRow[])
      setMemories((memoryRes.data || []) as MemoryItemRow[])
      setInsights((insightsRes.data || []) as AIInsightRow[])
      setCognitiveState(cognitiveRes.data as LeadCognitiveStateRow | null)
      setInternalNote(noteRes.data as { id: string, content: string } | null)
    } catch (err) {
      console.error('Error fetching lead details:', err)
    } finally {
      setLoading(false)
    }
  }, [leadId])

  useEffect(() => {
    fetchDetails()

    if (!leadId) return

    const supabase = getSupabase()

    const channel = supabase
      .channel(`lead-details-${leadId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `lead_id=eq.${leadId}` },
        (payload) => {
          setMessages(prev => {
            const exists = prev.some(m => m.id === (payload.new as MessageRow).id)
            if (exists) return prev
            return [...prev, payload.new as MessageRow]
          })
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lead_cognitive_state', filter: `lead_id=eq.${leadId}` },
        (payload) => {
          setCognitiveState(payload.new as LeadCognitiveStateRow)
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ai_insights', filter: `lead_id=eq.${leadId}` },
        (payload) => {
          setInsights(prev => {
            const exists = prev.some(i => i.id === (payload.new as AIInsightRow).id)
            if (exists) return prev
            return [payload.new as AIInsightRow, ...prev]
          })
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'memory_items', filter: `lead_id=eq.${leadId}` },
        (payload) => {
          setMemories(prev => {
            const exists = prev.some(m => m.id === (payload.new as MemoryItemRow).id)
            if (exists) return prev
            return [payload.new as MemoryItemRow, ...prev]
          })
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'property_interactions', filter: `lead_id=eq.${leadId}` },
        () => {
          fetchDetails()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'internal_notes', filter: `lead_id=eq.${leadId}` },
        () => {
          fetchDetails()
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [leadId, fetchDetails])

  return { propertyInteractions, messages, memories, insights, cognitiveState, internalNote, loading, refetch: fetchDetails }
}

