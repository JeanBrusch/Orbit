"use client"

import { useState, useEffect, useCallback } from 'react'
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
  // Cognitive State Layer
  interestScore?: number
  momentumScore?: number
  riskScore?: number
  clarityLevel?: number
  currentState?: 'latent' | 'curious' | 'exploring' | 'evaluating' | 'deciding' | 'resolved' | 'dormant'
  lastAiAnalysisAt?: string | null
  hasMatureNotes?: boolean
  cycleStage?: string
  contactCycle?: 'verde' | 'azul' | 'amarelo' | 'laranja' | 'vermelho' | 'cinza'
  followupActive?: boolean
  followupRemaining?: number
  followupDoneToday?: boolean
}

function calculateContactCycle(needsAttention: boolean, daysSince: number | undefined): 'verde' | 'azul' | 'amarelo' | 'laranja' | 'vermelho' | 'cinza' {
  if (needsAttention) return 'verde'
  if (daysSince === undefined) return 'azul'
  if (daysSince <= 3) return 'azul'
  if (daysSince <= 7) return 'amarelo'
  if (daysSince <= 15) return 'laranja'
  if (daysSince <= 30) return 'vermelho'
  return 'cinza'
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

export function useSupabaseLeads() {
  const [leads, setLeads] = useState<OrbitLead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchLeads = useCallback(async () => {
    try {
      setLoading(true)
      
      const supabase = getSupabase()
      
      // Fetch leads_center - Exclude only those explicitly in triage or blocked
      const { data, error: fetchError } = await supabase
        .from('leads_center')
        .select('*')
        .not('estado_atual', 'in', '("pending","blocked","ignored")')
        .order('created_at', { ascending: false })
      
      if (fetchError) throw fetchError

      const rows = (data || []) as LeadCenterRow[]
      
      // Fetch orbit fields and cognitive state
      const leadIds = rows.map(r => r.lead_id).filter(Boolean) as string[]
      let orbitDataMap: Record<string, { 
        orbit_stage: string | null; 
        orbit_visual_state: string | null; 
        action_suggested: string | null;
        cycle_stage?: string | null;
        followup_active?: boolean | null;
        followup_remaining?: number | null;
        followup_done_today?: boolean | null;
        interest_score?: number;
        momentum_score?: number;
        risk_score?: number;
        clarity_level?: number;
        current_state?: string;
        last_ai_analysis_at?: string | null;
      }> = {}
      let matureNotesMap: Record<string, boolean> = {}
      
      if (leadIds.length > 0) {
        const [leadsRes, cognitiveRes] = await Promise.all([
          supabase
            .from('leads')
            .select('id, orbit_stage, orbit_visual_state, action_suggested, cycle_stage, followup_active, followup_remaining, followup_done_today')
            .in('id', leadIds),
          supabase
            .from('lead_cognitive_state')
            .select('*')
            .in('lead_id', leadIds)
        ])
        
        if (leadsRes.data) {
          for (const lead of leadsRes.data as any[]) {
            orbitDataMap[lead.id] = {
              ...orbitDataMap[lead.id],
              orbit_stage: lead.orbit_stage || null,
              orbit_visual_state: lead.orbit_visual_state || null,
              action_suggested: lead.action_suggested || null,
              cycle_stage: lead.cycle_stage || null,
              followup_active: lead.followup_active ?? false,
              followup_remaining: lead.followup_remaining ?? 0,
              followup_done_today: lead.followup_done_today ?? false,
            }
          }
        }

        if (cognitiveRes.data) {
          for (const state of cognitiveRes.data as any[]) {
            if (state.lead_id) {
              const prev = orbitDataMap[state.lead_id] || { 
                orbit_stage: null, 
                orbit_visual_state: null, 
                action_suggested: null,
                cycle_stage: null,
                followup_active: false,
                followup_remaining: 0,
                followup_done_today: false
              };
              orbitDataMap[state.lead_id] = {
                ...prev,
                interest_score: state.interest_score,
                momentum_score: state.momentum_score,
                risk_score: state.risk_score,
                clarity_level: state.clarity_level,
                current_state: state.current_state,
                last_ai_analysis_at: state.last_ai_analysis_at
              }
            }
          }
        }
        
        // Fetch mature notes (notes older than 45 days - MEMORY_MIN_AGE)
        const MEMORY_MIN_AGE_DAYS = 45
        const memoryMinAge = new Date(Date.now() - MEMORY_MIN_AGE_DAYS * 24 * 60 * 60 * 1000).toISOString()
        const { data: notesData } = await supabase
          .from('internal_notes')
          .select('lead_id')
          .in('lead_id', leadIds)
          .lt('created_at', memoryMinAge)
        
        if (notesData) {
          for (const note of notesData as { lead_id: string | null }[]) {
            if (note.lead_id) {
              matureNotesMap[note.lead_id] = true
            }
          }
        }
      }
      
      const mappedLeads: OrbitLead[] = rows.map((lead, index) => {
        const badgeInfo = mapStateToBadge(lead.estado_atual, lead.acao_sugerida)
        const orbitData = lead.lead_id ? orbitDataMap[lead.lead_id] : undefined
        return {
          id: lead.lead_id || `lead-${index}`,
          name: lead.name || 'Sem nome',
          role: lead.origin || 'Lead',
          avatar: getInitials(lead.name),
          position: generatePosition(index, rows.length),
          ...badgeInfo,
          delay: index * 0.3,
          emotionalState: mapStateToEmotionalState(lead.estado_atual),
          keywords: [
            lead.estado_atual || '',
            lead.acao_sugerida || '',
            lead.origin || '',
            lead.last_event_type || '',
          ].filter(Boolean),
          phone: lead.phone || undefined,
          photoUrl: lead.photo_url || undefined,
          origin: lead.origin || undefined,
          state: lead.estado_atual || undefined,
          actionSuggested: lead.acao_sugerida || undefined,
          lastEventType: lead.last_event_type || undefined,
          lastInteractionAt: lead.ultima_interacao_at || undefined,
          hasCapsuleActive: lead.tem_capsula_ativa || false,
          daysSinceInteraction: lead.dias_sem_interacao || undefined,
          orbitStage: orbitData?.orbit_stage,
          orbitVisualState: orbitData?.orbit_visual_state,
          needsAttention: orbitData?.action_suggested === 'needs_attention',
          contactCycle: calculateContactCycle(orbitData?.action_suggested === 'needs_attention', lead.dias_sem_interacao || 0),
          cycleStage: orbitData?.cycle_stage || 'sem_ciclo',
          followupActive: orbitData?.followup_active || false,
          followupRemaining: orbitData?.followup_remaining || 0,
          followupDoneToday: orbitData?.followup_done_today || false,
          interestScore: orbitData?.interest_score,
          momentumScore: orbitData?.momentum_score,
          riskScore: orbitData?.risk_score,
          clarityLevel: orbitData?.clarity_level,
          currentState: orbitData?.current_state as any,
          lastAiAnalysisAt: orbitData?.last_ai_analysis_at,
          hasMatureNotes: lead.lead_id ? matureNotesMap[lead.lead_id] || false : false,
        }
      })

      setLeads(mappedLeads)
      setError(null)
    } catch (err) {
      console.error('Error fetching leads:', err)
      console.error('Error details:', JSON.stringify(err, null, 2))
      setError(err instanceof Error ? err : new Error('Failed to fetch leads'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLeads()
    
    // Refetch when tab regains focus (after being away)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('Tab focused - light refetch')
        fetchLeads()
      }
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [fetchLeads])

  const removeLead = useCallback((leadId: string) => {
    setLeads(prev => prev.filter(lead => lead.id !== leadId))
  }, [])

  return { leads, loading, error, refetch: fetchLeads, removeLead }
}

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
  }, [fetchProperties])

  return { properties, loading, error, refetch: fetchProperties }
}

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


interface ReminderRow {
  id: string
  lead_id: string | null
  due_at: string
  type: string | null
  status: string | null
  created_at: string | null
}

interface InternalNoteRow {
  id: string
  lead_id: string | null
  capsule_id: string | null
  content: string
  created_at: string | null
}

export function useLeadDetails(leadId: string | null) {
  const [propertyInteractions, setPropertyInteractions] = useState<PropertyInteractionRow[]>([])
  const [messages, setMessages] = useState<MessageRow[]>([])
  const [memories, setMemories] = useState<MemoryItemRow[]>([])
  const [insights, setInsights] = useState<AIInsightRow[]>([])
  const [cognitiveState, setCognitiveState] = useState<LeadCognitiveStateRow | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchDetails = useCallback(async () => {
    if (!leadId) {
      setMessages([])
      setMemories([])
      setInsights([])
      setCognitiveState(null)
      return
    }

    setLoading(true)
    try {
      const supabase = getSupabase()
      const [propIntRes, messagesRes, memoryRes, insightsRes, cognitiveRes] = await Promise.all([
        supabase.from('property_interactions').select('*').eq('lead_id', leadId).order('timestamp', { ascending: false }),
        supabase.from('messages').select('*').eq('lead_id', leadId).order('timestamp', { ascending: true }),
        supabase.from('memory_items').select('*').eq('lead_id', leadId).order('created_at', { ascending: false }),
        supabase.from('ai_insights').select('*').eq('lead_id', leadId).order('created_at', { ascending: false }),
        supabase.from('lead_cognitive_state').select('*').eq('lead_id', leadId).maybeSingle(),
      ])

      const propIntRows = (propIntRes.data || []) as PropertyInteractionRow[]

      // Fetch property data for each interaction
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
    } catch (err) {
      console.error('Error fetching lead details:', err)
    } finally {
      setLoading(false)
    }
  }, [leadId])

  useEffect(() => {
    fetchDetails()
  }, [fetchDetails])

  return { propertyInteractions, messages, memories, insights, cognitiveState, loading, refetch: fetchDetails }
}
