import { createClient } from '@supabase/supabase-js'
import { normalizePhone } from './phone-normalizer'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function blockNumber(phone: string, reason?: string): Promise<void> {
  const normalized = normalizePhone(phone)
  
  const { error } = await supabase
    .from('blocked_numbers')
    .upsert({
      phone: normalized,
      reason: reason || 'Blocked by user',
      blocked_at: new Date().toISOString()
    }, { onConflict: 'phone' })
  
  if (error) {
    throw new Error(`Failed to block number: ${error.message}`)
  }
}

export async function unblockNumber(phone: string): Promise<void> {
  const normalized = normalizePhone(phone)
  
  const { error } = await supabase
    .from('blocked_numbers')
    .delete()
    .eq('phone', normalized)
  
  if (error) {
    throw new Error(`Failed to unblock number: ${error.message}`)
  }
}

export async function isBlocked(phone: string): Promise<boolean> {
  const normalized = normalizePhone(phone)
  
  const { data } = await supabase
    .from('blocked_numbers')
    .select('id')
    .eq('phone', normalized)
    .maybeSingle()
  
  return !!data
}
