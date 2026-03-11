import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const leadId = searchParams.get('leadId')

    if (!leadId) {
      return NextResponse.json(
        { error: 'leadId é obrigatório' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseServer()

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('lead_id', leadId)
      .order('timestamp', { ascending: true })

    if (error) {
      console.error('[MESSAGES] Error fetching:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ messages: data || [] })
  } catch (err) {
    console.error('Error in GET /api/messages:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
