import { NextResponse } from 'next/server'
import { getSupabaseServer } from "@/lib/supabase-server"

const supabase = getSupabaseServer() as any

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
