import { NextRequest, NextResponse } from 'next/server'
import { sendCarousel } from '@/lib/zapi/client'
import { isLidFormat, normalizePhone } from '@/lib/phone-utils'
import { getSupabaseServer } from '@/lib/supabase-server'
import { processEventWithCore } from '@/lib/orbit-core'

export async function POST(request: NextRequest) {
  try {
    const { phone, message, carousel, leadId, propertyIds } = await request.json()

    if (!phone || !message || !carousel?.length) {
      return NextResponse.json(
        { error: 'phone, message e carousel são obrigatórios' },
        { status: 400 }
      )
    }

    const sendTo = isLidFormat(phone) ? phone : normalizePhone(phone)
    const result = await sendCarousel(sendTo, message, carousel)

    // Salvar no histórico de mensagens
    if (leadId) {
      const supabase = getSupabaseServer()
      const idempotencyKey = `zapi:${result.messageId}`

      const content = JSON.stringify({
        type: 'carousel',
        message,
        cards: carousel.map((c: { text: string; image: string }) => ({
          text: c.text,
          image: c.image
        }))
      })

      const { data: newMsg } = await (supabase.from('messages') as any)
        .insert({
          lead_id: leadId,
          source: 'operator',
          content,
          idempotency_key: idempotencyKey,
          timestamp: new Date().toISOString()
        })
        .select('id')
        .single()

      // Registrar interações de propriedades enviadas
      if (propertyIds?.length) {
        const interactions = propertyIds.map((pid: string) => ({
          id: crypto.randomUUID(),
          lead_id: leadId,
          property_id: pid,
          interaction_type: 'sent',
          source: 'carousel'
        }))
        await (supabase.from('property_interactions') as any).insert(interactions)
      }

      processEventWithCore(
        leadId,
        `[Carrossel enviado] ${message} — ${carousel.length} imóveis`,
        'message_outbound',
        newMsg?.id
      ).catch(console.error)
    }

    return NextResponse.json({ success: true, messageId: result.messageId })
  } catch (error: any) {
    console.error('[API send-carousel]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
