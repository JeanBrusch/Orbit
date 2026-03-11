"use client"

import { supabase } from './supabase'
import type { Database, Json } from './database.types'

export type Lead = Database['public']['Tables']['leads']['Row']
export type MessageRow = Database['public']['Tables']['messages']['Row']
export type MemoryItemRow = Database['public']['Tables']['memory_items']['Row']
export type LeadCognitiveStateRow = Database['public']['Tables']['lead_cognitive_state']['Row']
export type AIInsightRow = Database['public']['Tables']['ai_insights']['Row']

export async function fetchLeads() {
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .order('last_evaluated_at', { ascending: false })
  
  if (error) {
    console.error('Error fetching leads:', error)
    return []
  }
  return data || []
}

export async function fetchMessagesByLead(leadId: string) {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('lead_id', leadId)
    .order('timestamp', { ascending: true })
  
  if (error) {
    console.error('Error fetching messages:', error)
    return []
  }
  return data || []
}

export async function fetchMemoriesByLead(leadId: string) {
  const { data, error } = await supabase
    .from('memory_items')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })
  
  if (error) {
    console.error('Error fetching memories:', error)
    return []
  }
  return data || []
}

export async function fetchCognitiveState(leadId: string) {
  const { data, error } = await supabase
    .from('lead_cognitive_state')
    .select('*')
    .eq('lead_id', leadId)
    .maybeSingle()
  
  if (error) {
    console.error('Error fetching cognitive state:', error)
    return null
  }
  return data
}

export async function fetchInsightsByLead(leadId: string) {
  const { data, error } = await supabase
    .from('ai_insights')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })
  
  if (error) {
    console.error('Error fetching insights:', error)
    return []
  }
  return data || []
}

export async function createMessage(
  leadId: string,
  source: 'whatsapp' | 'operator',
  content: string,
  aiAnalysis?: Json
) {
  const { data, error } = await (supabase.from('messages') as any)
    .insert({
      lead_id: leadId,
      source,
      content,
      ai_analysis: aiAnalysis || null,
    })
    .select()
    .single()
  
  if (error) {
    console.error('Error creating message:', error)
    return null
  }
  return data
}

export async function updateLeadState(
  leadId: string,
  stage: string
) {
  const { data, error } = await (supabase.from('leads') as any)
    .update({ orbit_stage: stage })
    .eq('id', leadId)
    .select()
    .single()
  
  if (error) {
    console.error('Error updating lead stage:', error)
    return null
  }
  return data
}
