import { getSupabaseServer } from '@/lib/supabase-server'

export async function getLeadCapsule(leadId: string) {
  const supabase = getSupabaseServer()

  const { data: capsule, error } = await supabase
    .from('capsules')
    .select('id, lead_id, status, context, started_at, closed_at')
    .eq('lead_id', leadId)
    .order('started_at', { ascending: false })
    .limit(1)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('[getLeadCapsule] Error:', error)
    return null
  }

  return capsule || null
}
