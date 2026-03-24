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

    // 1. Fetch Client Space
    const { data: space } = await (supabase.from('client_spaces') as any)
      .select('id, slug, title, created_at')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // 2. Fetch Capsule Items with Properties
    const { data: items } = await (supabase.from('capsule_items') as any)
      .select(`
        property_id,
        state,
        metadata,
        properties:property_id (
          id, title, internal_name, cover_image, value, source_link
        )
      `)
      .eq('lead_id', leadId)
      .neq('state', 'discarded')

    // 3. Fetch Interactions for stats
    const { data: interactions } = await (supabase.from('property_interactions') as any)
      .select('interaction_type, property_id, timestamp, metadata')
      .eq('lead_id', leadId)
      .order('timestamp', { ascending: false })

    return NextResponse.json({
      space,
      items: items || [],
      interactions: interactions || []
    })
  } catch (err) {
    console.error('[SELECTION_DASHBOARD] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
