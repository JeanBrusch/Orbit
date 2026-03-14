import { createClient } from '@supabase/supabase-js'

export function getSupabaseServer() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase server credentials not configured (URL or SERVICE_ROLE_KEY)')
  }
  
  return createClient(supabaseUrl, supabaseServiceKey)
}
