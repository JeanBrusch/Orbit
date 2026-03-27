import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'

export async function GET(
  _req: NextRequest,
  { params }: { params: { leadId: string } }
) {
  try {
    const { leadId } = params

    if (!leadId) {
      return NextResponse.json({ error: 'leadId obrigatório' }, { status: 400 })
    }

    const supabase = getSupabaseServer()

    const [insightsResult, leadResult] = await Promise.all([
      supabase
        .from('ai_insights')
        .select(
          'id, content, urgency, created_at, message_intention, possibility_hook, suggested_whatsapp_message, emotional_climate'
        )
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })
        .limit(1),

      supabase
        .from('leads')
        .select('client_stage, orbit_stage')
        .eq('id', leadId)
        .maybeSingle(),
    ])

    if (insightsResult.error) {
      console.error('[API] Erro ao buscar ai_insights:', insightsResult.error)
      return NextResponse.json({ error: insightsResult.error.message }, { status: 500 })
    }

    return NextResponse.json({
      insights: insightsResult.data || [],
      client_stage: (leadResult.data as any)?.client_stage ?? (leadResult.data as any)?.orbit_stage ?? null,
    })
  } catch (err: any) {
    console.error('[API] Erro GET /api/leads/[leadId]/insights:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

