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
    const { leadId, propertyId, interaction_type, source, propertyTitle, propertyCover, text } = body
    const itype = interaction_type || body.interactionType

    if (!leadId || !propertyId || !itype) {
      return NextResponse.json(
        { error: 'leadId, propertyId e itype são obrigatórios' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseServer()

    // 1. Create the interaction record
    const { data: interaction, error: intError } = await supabase
      .from('property_interactions')
      .insert({
        lead_id: leadId,
        property_id: propertyId,
        interaction_type: itype,
        source: source || 'client_portal'
      })
      .select()
      .single()

    if (intError) {
      console.error('[PROP_INT] Error creating interaction:', intError)
      return NextResponse.json({ error: 'Erro ao registrar interação' }, { status: 500 })
    }

    // 2. If it's a question, also create a record in the messages table and ai_insights
    if (itype === 'property_question') {
      const { error: msgError } = await supabase
        .from('messages')
        .insert({
          lead_id: leadId,
          source: 'client_portal',
          content: JSON.stringify({
            type: 'property_question',
            text: text || '',
            propertyId,
            propertyTitle,
            propertyCover
          })
        })
      
      if (msgError) {
        console.error('[PROP_INT] Error creating message:', msgError)
        return NextResponse.json({ error: 'Erro ao registrar pergunta no histórico' }, { status: 500 })
      }

      await supabase.from('ai_insights').insert({
        lead_id: leadId,
        type: 'suggestion',
        content: `Pergunta do cliente no portal sobre imóvel ${propertyTitle || propertyId}: "${text}"`,
        urgency: 5
      })
    }

    // 3. Process with Core (Async)
    // Sinais fortes de portal são enviados para o Core: property_question, favorited, portal_opened
    const coreEvents = ['property_question', 'favorited', 'portal_opened', 'discarded', 'visited']
    if (coreEvents.includes(itype)) {
      const coreType = 'property_reaction'
      let content = `Interacao com imovel: ${itype} (propertyId: ${propertyId})`
      if (itype === 'property_question') {
        content = `Lead fez uma pergunta no portal sobre o imóvel ${propertyTitle || propertyId}: "${text}"`
      } else if (itype === 'portal_opened') {
        content = `Lead acessou o link do Portal Selection (propertyId de entrada: ${propertyId})`
      }
      processEventWithCore(leadId, content, coreType).catch((err) => {
        console.error('[PROP_INT] Error triggering Orbit Core:', err)
      })
    }

    return NextResponse.json(interaction, { status: 201 })
  } catch (err) {
    console.error('Error in POST /api/property-interactions:', err)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
