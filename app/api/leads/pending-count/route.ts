import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET() {
  try {
    const { count, error } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('state', 'pending')
    
    if (error) throw error
    
    return NextResponse.json({ count: count || 0 })
  } catch (error: any) {
    return NextResponse.json({ count: 0, error: error.message }, { status: 500 })
  }
}
