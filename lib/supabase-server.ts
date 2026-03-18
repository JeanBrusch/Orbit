import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

let supabaseServerInstance: SupabaseClient<Database> | null = null

export function getSupabaseServer(): SupabaseClient<Database> {
  if (supabaseServerInstance) return supabaseServerInstance

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  // Use Service Role Key for server-side bypass if available
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase server credentials not configured (URL or keys)')
  }
  
  supabaseServerInstance = createClient<Database>(supabaseUrl, supabaseServiceKey)
  return supabaseServerInstance
}
