import { NextRequest, NextResponse } from 'next/server'
import { sendMessage } from '@/lib/zapi/client'
import { normalizePhone, isLidFormat } from '@/lib/phone-utils'
import { getSupabaseServer } from '@/lib/supabase-server'
import { processEventWithCore } from '@/lib/orbit-core'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { phone, message, leadId, skipInteraction } = body

    if (!phone || !message) {
      return NextResponse.json(
        { error: 'phone e message são obrigatórios' },
        { status: 400 }
      )
    }

    // If phone is LID format, use as-is; otherwise normalize
    const sendTo = isLidFormat(phone) ? phone : normalizePhone(phone)
    console.log('[SEND] Sending message to:', sendTo, isLidFormat(phone) ? '(LID)' : '(phone)')
    
    const result = await sendMessage(sendTo, message)
    console.log('[SEND] Z-API result:', result)

    if (leadId && !skipInteraction) {
      const supabase = getSupabaseServer()
      const idempotencyKey = `zapi:${result.messageId}`
      
      const { data: existing } = await supabase
        .from('interactions')
        .select('id')
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle()
      
      if (!existing) {
      const { data: newMessage, error } = await supabase.from('messages').insert({
        lead_id: leadId,
        source: 'operator',
        content: message,
        idempotency_key: idempotencyKey,
        timestamp: new Date().toISOString()
      }).select('id').single()
      
      if (error) {
        if (error.code === '23505' && error.message?.includes('idempotency')) {
          console.log('[SEND] Message already exists (constraint):', idempotencyKey)
        } else {
          console.error('[SEND] Error saving message:', error)
        }
      } else {
        console.log('[SEND] Message saved with key:', idempotencyKey)
        
        await supabase
          .from('leads')
          .update({ 
            last_interaction_at: new Date().toISOString() 
          })
          .eq('id', leadId)

        // Opcional: Acionar Orbit Core para outbound (embora ignore por enquanto)
        processEventWithCore(leadId, message, 'message_outbound', newMessage?.id).catch(() => {})
      }
      } else {
        console.log('[SEND] Interaction already exists (query check):', idempotencyKey)
      }
    }

    return NextResponse.json({ 
      success: true, 
      messageId: result.messageId,
      phone: sendTo
    })
  } catch (error: any) {
    console.error('[SEND] Error:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
