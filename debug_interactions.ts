import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '/Users/jeanbrusch/Orbit Antigravity/.env.local' })

const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supaKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supaUrl || !supaKey) {
  console.error("Missing env vars")
  process.exit(1)
}

const supabase = createClient(supaUrl, supaKey)

async function test() {
  const { data, error } = await supabase
    .from('property_interactions')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(10)
  
  console.log("Error:", error)
  console.log("Interactions:")
  console.log(JSON.stringify(data, null, 2))
}

test()
