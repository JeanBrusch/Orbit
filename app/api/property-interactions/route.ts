import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'
import { processEventWithCore } from '@/lib/orbit-core'

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
      .from('property_interactions')
      .select('*')
      .eq('lead_id', leadId)
      .order('timestamp', { ascending: false })

    if (error) {
      console.error('[PROP_INT] Error fetching:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ interactions: data || [] })
  } catch (err) {
    console.error('Error in GET /api/property-interactions:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { leadId, propertyId, interaction_type, source } = body

    if (!leadId || !propertyId || !interaction_type) {
      return NextResponse.json(
        { error: 'leadId, propertyId e interaction_type são obrigatórios' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseServer()

    const { data, error } = await supabase
      .from('property_interactions')
      .insert({
        lead_id: leadId,
        property_id: propertyId,
        interaction_type,
        source: source || 'operator'
      })
      .select()
      .single()

    if (error) {
      console.error('[PROP_INT] Error creating:', error)
      return NextResponse.json({ error: 'Erro ao registrar interação' }, { status: 500 })
    }

    // Aciona o Orbit Core de forma assíncrona para analisar a interação
    if (interaction_type !== 'sent') {
      const type = 'property_reaction'
      const content = `Interacao com imovel: ${interaction_type} (property_id: ${propertyId})`
      processEventWithCore(leadId, content, type).catch(() => {})
    }

    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    console.error('Error in POST /api/property-interactions:', err)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
