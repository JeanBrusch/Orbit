import { getSupabaseServer } from '@/lib/supabase-server'

export async function getLeadPropertySends(leadId: string) {
  const supabase = getSupabaseServer()

  // First get the capsule for this lead
  const { data: capsule, error: capsuleError } = await supabase
    .from('capsules')
    .select('id')
    .eq('lead_id', leadId)
    .single()

  if (capsuleError || !capsule) {
    console.error('[getLeadPropertySends] No capsule found for lead:', leadId)
    return []
  }

  // Then get all capsule items with property_id (sent properties)
  const { data: capsuleItems, error } = await supabase
    .from('capsule_items')
    .select(`
      id,
      property_id,
      state,
      created_at,
      properties:property_id (
        id,
        title,
        value,
        location_text
      )
    `)
    .eq('capsule_id', capsule.id)
    .not('property_id', 'is', null)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[getLeadPropertySends] Error:', error)
    return []
  }

  return capsuleItems || []
}
