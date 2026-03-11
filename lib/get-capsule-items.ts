import { getSupabaseServer } from '@/lib/supabase-server'

export async function getCapsuleItems(capsuleId: string) {
  const supabase = getSupabaseServer()

  const { data: items, error } = await supabase
    .from('capsule_items')
    .select('*')
    .eq('capsule_id', capsuleId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[getCapsuleItems] Error:', error)
    return []
  }

  return items || []
}
