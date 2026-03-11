import { getSupabaseServer } from '@/lib/supabase-server'

export async function getLeadData(leadId: string) {
  const supabase = getSupabaseServer()

  const { data: lead, error } = await supabase
    .from('leads')
    .select('id, name, cycle_stage, created_at')
    .eq('id', leadId)
    .single()

  if (error) {
    console.error('[getLeadData] Error:', error)
    return null
  }

  return lead
}
