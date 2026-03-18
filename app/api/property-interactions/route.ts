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
  session_end:       '⏱️ Sessão Encerrada',
}

async function sendInteractionEmail(opts: {
  leadName: string
  leadId: string
  interactionType: string
  propertyTitle?: string
  propertyId: string
  text?: string
  durationSeconds?: number
}) {
  const resendKey = process.env.RESEND_API_KEY
  const notifyEmail = process.env.NOTIFY_EMAIL
  if (!resendKey || !notifyEmail || resendKey.includes('REPLACE')) return

  const label = INTERACTION_LABELS[opts.interactionType] || opts.interactionType
  const when = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })

  const durationRow = opts.durationSeconds != null ? `
  <tr style="border-bottom: 1px solid #f0f0f0;">
    <td style="padding: 8px 0; color: #888;">Duração</td>
    <td style="padding: 8px 0; font-weight: 600;">${formatDurationEmail(opts.durationSeconds)}</td>
  </tr>` : ''

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
          ${durationRow}
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

  console.log('[PROP_INT] Attempting to send email...', { type: opts.interactionType, to: notifyEmail });
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Orbit <onboarding@resend.dev>',
        to: notifyEmail,
        subject: `${label} — ${opts.leadName}`,
        html,
      })
    })

    const resData = await response.json().catch(() => ({}))
    if (!response.ok) {
      console.error('[PROP_INT] Resend API error:', resData)
    } else {
      console.log('[PROP_INT] Email sent successfully:', resData.id)
    }
  } catch (emailErr) {
    console.error('[PROP_INT] Email notification network error:', emailErr)
  }
}

function formatDurationEmail(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m < 60) return s > 0 ? `${m}min ${s}s` : `${m}min`
  const h = Math.floor(m / 60)
  const rm = m % 60
  return rm > 0 ? `${h}h ${rm}min` : `${h}h`
}

// ── GET ─────────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const leadId = searchParams.get('leadId')

    if (!leadId) {
      return NextResponse.json({ error: 'leadId é obrigatório' }, { status: 400 })
    }

    // Usa service role via getSupabaseServer — bypassa RLS completamente
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

// ── POST ────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    // Suporta tanto application/json quanto text/plain (enviado pelo sendBeacon)
    const contentType = request.headers.get('content-type') || ''
    let body: any
    if (contentType.includes('application/json')) {
      body = await request.json()
    } else {
      // sendBeacon envia como text/plain ou application/x-www-form-urlencoded
      const text = await request.text()
      try {
        body = JSON.parse(text)
      } catch {
        return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
      }
    }

    const { leadId, propertyId, interaction_type, source, propertyTitle, propertyCover, text, metadata } = body
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
    if (!propTitle && itype !== 'portal_opened' && itype !== 'session_end') {
      const { data: prop } = await supabase
        .from('properties')
        .select('title, internal_name')
        .eq('id', propertyId)
        .single()
      if (prop) propTitle = (prop as any).title || (prop as any).internal_name
    }

    // 3. Create the interaction record
    // Tenta inserir com metadata; se a coluna não existir, insere sem ela
    let interaction: any = null
    let intError: any = null

    const insertPayload: any = {
      lead_id: leadId,
      property_id: propertyId,
      interaction_type: itype,
      source: source || 'client_portal',
    }

    // Adiciona metadata se existir (ex: duration_seconds para session_end)
    if (metadata && typeof metadata === 'object') {
      insertPayload.metadata = metadata
    }

    // Log de duração de sessão
    if (itype === 'session_end' && metadata?.duration_seconds != null) {
      console.log(`[PROP_INT] session_end — lead: ${leadId}, duração: ${metadata.duration_seconds}s`)
    }

    const result = await supabase
      .from('property_interactions')
      .insert(insertPayload)
      .select()
      .single()

    interaction = result.data
    intError = result.error

    // Se falhou por causa da coluna metadata não existir, tenta sem ela
    if (intError && intError.message?.includes('metadata')) {
      console.warn('[PROP_INT] metadata column not found, retrying without it')
      const fallback = await supabase
        .from('property_interactions')
        .insert({
          lead_id: leadId,
          property_id: propertyId,
          interaction_type: itype,
          source: source || 'client_portal',
        })
        .select()
        .single()
      interaction = fallback.data
      intError = fallback.error
    }

    if (intError) {
      console.error('[PROP_INT] Error creating interaction:', intError)
      return NextResponse.json({ error: 'Erro ao registrar interação' }, { status: 500 })
    }

    // 3b. Sync state to capsule_items for portal consistency and sidebar indicators
    const stateSyncTypes = ['sent', 'favorited', 'visited', 'discarded']
    if (stateSyncTypes.includes(itype)) {
      try {
        // 1) Ensure client_space exists (only strictly needed for 'sent', but harmless for others)
        if (itype === 'sent') {
          const { data: existingSpace } = await supabase
            .from('client_spaces')
            .select('id, slug')
            .eq('lead_id', leadId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          if (!existingSpace) {
            const slug = `lead-${leadId.substring(0, 8)}-${Math.random().toString(36).substring(7)}`
            await supabase.from('client_spaces').insert({
              lead_id: leadId,
              slug,
              theme: 'paper',
              theme_config: { mode: 'light', variant: 'paper' },
              title: `Seleção Orbit`,
            })
          }
        }

        // 2) Upsert capsule_item state
        await supabase
          .from('capsule_items')
          .upsert(
            { lead_id: leadId, property_id: propertyId, state: itype },
            { onConflict: 'lead_id,property_id' }
          )
      } catch (syncErr) {
        console.warn('[PROP_INT] State sync error:', syncErr)
      }
    }

    // 4. Se é pergunta, cria mensagem + insight
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
    const notifyEvents = ['property_question', 'favorited', 'visited', 'visited_site', 'portal_opened', 'session_end']
    if (notifyEvents.includes(itype)) {
      sendInteractionEmail({
        leadName,
        leadId,
        interactionType: itype,
        propertyTitle: propTitle,
        propertyId,
        text,
        durationSeconds: metadata?.duration_seconds,
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
