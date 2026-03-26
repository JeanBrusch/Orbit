import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

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

    // 2. Fetch sent properties from property_interactions (source of truth — same as client portal)
    const { data: sentItems } = await (supabase.from('property_interactions') as any)
      .select(`
        property_id,
        interaction_type,
        timestamp,
        metadata,
        properties:property_id (
          id, title, internal_name, internal_code, cover_image, value, source_link
        )
      `)
      .eq('lead_id', leadId)
      .eq('interaction_type', 'sent')
      .order('timestamp', { ascending: false })

    // 3. Fetch context (notes/videos) per property for this space
    let contextMap = new Map<string, any>()
    if (space?.id) {
      const { data: contexts } = await (supabase.from('client_property_context') as any)
        .select('property_id, note, video_url')
        .eq('client_space_id', space.id)
      if (contexts) {
        contexts.forEach((c: any) => contextMap.set(c.property_id, c))
      }
    }

    // Map sent items to the shape expected by client components
    const items = (sentItems || []).map((item: any) => {
      const rawProp = item.properties
      const p = Array.isArray(rawProp) ? rawProp[0] : rawProp
      const ctx = contextMap.get(item.property_id)
      return {
        property_id: item.property_id,
        state: 'sent',
        metadata: { ...item.metadata, note: ctx?.note, video_url: ctx?.video_url },
        properties: p || null,
      }
    })

    // 4. Fetch all interactions for stats (views, likes, discards, session, etc.)
    const { data: interactions } = await (supabase.from('property_interactions') as any)
      .select('interaction_type, property_id, timestamp, metadata')
      .eq('lead_id', leadId)
      .order('timestamp', { ascending: false })

    return NextResponse.json({
      space,
      items,
      interactions: interactions || []
    })
  } catch (err) {
    console.error('[SELECTION_DASHBOARD] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
