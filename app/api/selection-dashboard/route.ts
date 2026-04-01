import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'
import { computeMatch } from '@/lib/atlas-utils'

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

    // 3.5 Fetch Lead for Match Calculation
    const { data: leadRaw } = await (supabase.from('leads') as any)
      .select('id, budget, preferred_features, preferred_area, desired_bedrooms')
      .eq('id', leadId)
      .single()

    // Map sent items to the shape expected by client components
    const items = (sentItems || []).map((item: any) => {
      const rawProp = item.properties
      const p = Array.isArray(rawProp) ? rawProp[0] : rawProp
      const ctx = contextMap.get(item.property_id)
      
      // Dynamic Match Calculation for Transparency
      const match = (p && leadRaw) ? computeMatch(p, leadRaw) : null

      return {
        property_id: item.property_id,
        state: 'sent',
        metadata: { 
          ...item.metadata, 
          note: ctx?.note, 
          video_url: ctx?.video_url,
          match_score: match?.scorePercentage || 0,
          match_reasons: match?.reasons || []
        },
        properties: p || null,
      }
    })

    // 4. Fetch all interactions for stats (views, likes, discards, session, etc.)
    const { data: interactions } = await (supabase.from('property_interactions') as any)
      .select('interaction_type, property_id, timestamp, metadata')
      .eq('lead_id', leadId)
      .order('timestamp', { ascending: false })

    const totalInteractions = (interactions || [])
    
    // Aggregated Stats for Manager Console
    const stats = {
      views: totalInteractions.filter((i: any) => i.interaction_type === 'viewed').length,
      likes: totalInteractions.filter((i: any) => i.interaction_type === 'favorited').length,
      discards: totalInteractions.filter((i: any) => i.interaction_type === 'discarded').length,
      visits: totalInteractions.filter((i: any) => i.interaction_type === 'visited' || i.interaction_type === 'property_question').length,
    }

    // Calculate total session time from session_end metadata
    const sessions = totalInteractions.filter((i: any) => i.interaction_type === 'session_end')
    const totalSeconds = sessions.reduce((acc: number, curr: any) => acc + (curr.metadata?.duration_seconds || 0), 0)
    
    // Intensity: weighted activity score (0-100)
    const intensity = Math.min(100, (stats.likes * 15 + stats.views * 2 + stats.visits * 25))

    return NextResponse.json({
      space,
      items,
      interactions: totalInteractions,
      stats,
      tracking: {
        session_time: totalSeconds,
        last_active: totalInteractions.length > 0 ? totalInteractions[0].timestamp : null
      },
      intensity
    })
  } catch (err) {
    console.error('[SELECTION_DASHBOARD] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
