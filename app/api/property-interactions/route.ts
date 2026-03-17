import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'
import { processEventWithCore } from '@/lib/orbit-core'

// ── Email helper ────────────────────────────────────────────────────────────
const INTERACTION_LABELS: Record<string, string> = {
  portal_opened:     '👁️ Portal Acessado',
  favorited:         '❤️ Imóvel Curtido',
  discarded:         '❌ Imóvel Descartado',
  visited:           '📅 Visita Solicitada',
  visited_site:      '🌐 Site Externo Visitado',
  viewed:            '🔍 Imóvel Visualizado',
  property_question: '💬 Pergunta Enviada',
}

async function sendInteractionEmail(opts: {
  leadName: string
  leadId: string
  interactionType: string
  propertyTitle?: string
  propertyId: string
  text?: string
}) {
  const resendKey = process.env.RESEND_API_KEY
  const notifyEmail = process.env.NOTIFY_EMAIL
  if (!resendKey || !notifyEmail || resendKey.includes('REPLACE')) return

  const label = INTERACTION_LABELS[opts.interactionType] || opts.interactionType
  const when = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })

  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 520px; margin: 0 auto; color: #1a1a1a;">
      <div style="background: #05060a; padding: 24px; border-radius: 12px 12px 0 0;">
        <p style="color: #2ec5ff; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; margin: 0;">Orbit · Portal Notification</p>
      </div>
      <div style="border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 12px 12px; padding: 28px;">
        <h2 style="font-size: 22px; margin: 0 0 6px 0;">${label}</h2>
        <p style="color: #666; font-size: 13px; margin: 0 0 20px;">Lead <strong>${opts.leadName}</strong> interagiu no portal</p>

        <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 20px;">
          <tr style="border-bottom: 1px solid #f0f0f0;">
            <td style="padding: 8px 0; color: #888; width: 40%;">Lead</td>
            <td style="padding: 8px 0; font-weight: 600;">${opts.leadName}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f0f0f0;">
            <td style="padding: 8px 0; color: #888;">Ação</td>
            <td style="padding: 8px 0; font-weight: 600;">${label}</td>
          </tr>
          ${opts.propertyTitle ? `
          <tr style="border-bottom: 1px solid #f0f0f0;">
            <td style="padding: 8px 0; color: #888;">Imóvel</td>
            <td style="padding: 8px 0;">${opts.propertyTitle}</td>
          </tr>` : ''}
          ${opts.text ? `
          <tr style="border-bottom: 1px solid #f0f0f0;">
            <td style="padding: 8px 0; color: #888;">Mensagem</td>
            <td style="padding: 8px 0; font-style: italic;">"${opts.text}"</td>
          </tr>` : ''}
          <tr>
            <td style="padding: 8px 0; color: #888;">Horário</td>
            <td style="padding: 8px 0;">${when}</td>
          </tr>
        </table>

        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/lead/${opts.leadId}" 
           style="display: inline-block; background: #05060a; color: #2ec5ff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 12px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;">
          Abrir Lead Console →
        </a>
      </div>
    </div>
  `

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Orbit <notifications@orbit.house>',
        to: notifyEmail,
        subject: `${label} — ${opts.leadName}`,
        html,
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('[PROP_INT] Resend API error:', errorData)
    }
  } catch (emailErr) {
    console.error('[PROP_INT] Email notification network error:', emailErr)
  }
}

// ── GET ─────────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const leadId = searchParams.get('leadId')

    if (!leadId) {
      return NextResponse.json({ error: 'leadId é obrigatório' }, { status: 400 })
    }

    console.log("[API GET PROP_INT] Fetching for leadId:", leadId);
    const supabase = getSupabaseServer()
    const { data, error } = await supabase
      .from('property_interactions')
      .select('*')
      .eq('lead_id', leadId)
      .order('timestamp', { ascending: false })

    console.log("[API GET PROP_INT] Query result length:", data?.length || 0);
    if (error) console.error("[API GET PROP_INT] Supabase error:", error);

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

// ── POST ────────────────────────────────────────────────────────────────────
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

    // 1. Get lead name for notification
    const { data: lead } = await supabase
      .from('leads')
      .select('name')
      .eq('id', leadId)
      .single()
    const leadName = (lead as any)?.name || 'Lead desconhecido'

    // 2. Get property title if not provided
    let propTitle = propertyTitle
    if (!propTitle && itype !== 'portal_opened') {
      const { data: prop } = await supabase
        .from('properties')
        .select('title, internal_name')
        .eq('id', propertyId)
        .single()
      if (prop) propTitle = (prop as any).title || (prop as any).internal_name
    }

    // 3. Create the interaction record
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

    // 4. If it's a question, also create a message record + ai_insight
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
            propertyTitle: propTitle,
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
        content: `Pergunta do cliente no portal sobre imóvel ${propTitle || propertyId}: "${text}"`,
        urgency: 5
      })
    }

    // 5. Fire email notification (non-blocking)
    const notifyEvents = ['property_question', 'favorited', 'visited', 'visited_site', 'portal_opened']
    if (notifyEvents.includes(itype)) {
      sendInteractionEmail({
        leadName,
        leadId,
        interactionType: itype,
        propertyTitle: propTitle,
        propertyId,
        text
      }).catch(err => console.error('[PROP_INT] Email send failed:', err))
    }

    // 6. Process with Orbit Core (async)
    const coreEvents = ['property_question', 'favorited', 'portal_opened', 'discarded', 'visited']
    if (coreEvents.includes(itype)) {
      let content = `Interacao com imovel: ${itype} (propertyId: ${propertyId})`
      if (itype === 'property_question') {
        content = `Lead fez uma pergunta no portal sobre o imóvel ${propTitle || propertyId}: "${text}"`
      } else if (itype === 'portal_opened') {
        content = `Lead acessou o link do Portal Selection (propertyId de entrada: ${propertyId})`
      }
      processEventWithCore(leadId, content, 'property_reaction').catch((err) => {
        console.error('[PROP_INT] Error triggering Orbit Core:', err)
      })
    }

    return NextResponse.json(interaction, { status: 201 })
  } catch (err) {
    console.error('Error in POST /api/property-interactions:', err)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
