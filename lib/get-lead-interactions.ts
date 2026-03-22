import { getSupabaseServer } from '@/lib/supabase-server'

export async function getLeadInteractions(leadId: string) {
  const supabase = getSupabaseServer()

  // Try messages table first (new schema)
  const { data: messages, error: mError } = await (supabase.from('messages') as any)
    .select('*')
    .eq('lead_id', leadId)
    .order('timestamp', { ascending: true })

  if (!mError && messages && messages.length > 0) {
    return messages.map((m: any) => ({
      id: m.id,
      lead_id: m.lead_id,
      content: m.content,
      direction: m.source === 'whatsapp' ? 'inbound' : 'outbound',
      type: 'message',
      created_at: m.timestamp,
      ai_analysis: m.ai_analysis
    }))
  }

  // Fallback to interactions
  const { data: interactions, error } = await supabase
    .from('interactions')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[getLeadInteractions] Error:', error)
    return []
  }

  return interactions || []
}
