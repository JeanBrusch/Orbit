import { getSupabaseServer } from '@/lib/supabase-server'

export async function getLeadInteractions(leadId: string) {
  const supabase = getSupabaseServer()

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
