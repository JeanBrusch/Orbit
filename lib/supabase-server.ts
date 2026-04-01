import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export const getSupabaseServer = () => {
  if (!supabaseUrl || !supabaseKey) {
     console.error('Supabase server credentials missing in environment')
  }
  return createClient<Database>(supabaseUrl || 'https://mdjjglffrgrsewehcqph.supabase.co', supabaseKey || 'placeholder')
}

// Support legacy import if any
const supabaseServer = getSupabaseServer()
export default supabaseServer
