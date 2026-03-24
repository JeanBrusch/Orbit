import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const leadId = searchParams.get('leadId')

    if (!leadId) {
      return NextResponse.json({ error: 'leadId is required' }, { status: 400 })
    }

    const supabase = getSupabaseServer()
    const { data: space, error } = await (supabase.from('client_spaces') as any)
      .select('id, slug, created_at, lead_id, title')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('[CLIENT_SPACES] Supabase error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ space })
  } catch (err) {
    console.error('[CLIENT_SPACES] Internal error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
