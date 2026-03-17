import { NextRequest, NextResponse } from 'next/server'
import { sendMessage } from '@/lib/zapi/client'
import { normalizePhone, isLidFormat } from '@/lib/phone-utils'
import { getSupabaseServer } from '@/lib/supabase-server'
import { processEventWithCore } from '@/lib/orbit-core'

export async function POST(request: NextRequest) {
  console.log('[SEND] API route hit')
  try {
    const body = await request.json()
    const { phone, message, leadId, skipInteraction } = body
    console.log('[SEND] Request data:', { phone, messageId: !!message, leadId, skipInteraction })

    if (!phone || !message) {
      return NextResponse.json(
        { error: 'phone e message são obrigatórios' },
        { status: 400 }
      )
    }

    // Backend safety check: Prevent malformed LIDs (e.g., abc@lid@lid)
    if (isLidFormat(phone) && phone.split('@lid').length > 2) {
      return NextResponse.json(
        { error: `Identificador inválido: ${phone}` },
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
      
      // We check 'messages' because that's what the chat UI displays.
      // Checking 'interactions' was causing a mismatch if the interaction existed but the message didn't.
      const { data: existing } = await supabase
        .from('messages')
        .select('id')
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle()
      
      if (!existing) {
        console.log('[SEND] Message not found in history, inserting:', idempotencyKey)
        const { data: newMessage, error } = await supabase.from('messages').insert({
          lead_id: leadId,
          source: 'operator',
          content: message,
          idempotency_key: idempotencyKey,
          timestamp: new Date().toISOString()
        }).select('id').single()
        
        if (error) {
          if (error.code === '23505' && error.message?.includes('idempotency')) {
            console.log('[SEND] Message already exists (race condition/constraint):', idempotencyKey)
          } else {
            console.error('[SEND] Error saving message to historical table:', error)
            return NextResponse.json(
              { error: `Mensagem enviada no WhatsApp (${result.messageId}), mas falhou ao salvar no histórico: ${error.message}` },
              { status: 500 }
            )
          }
        } else {
          console.log('[SEND] Message saved in historical table:', idempotencyKey)
          
          await supabase
            .from('lead_cognitive_state')
            .upsert({
              lead_id: leadId,
              last_human_action_at: new Date().toISOString(),
            }, { onConflict: 'lead_id', ignoreDuplicates: false })

          await supabase
            .from('leads')
            .update({ 
              last_interaction_at: new Date().toISOString() 
            })
            .eq('id', leadId)

          processEventWithCore(leadId, message, 'message_outbound', newMessage?.id).catch((e) => {
             console.error('[SEND] Orbit Core processing error:', e)
          })
        }
      } else {
        console.log('[SEND] Message already exists in historical table (idempotency):', idempotencyKey)
      }
    }

    console.log('[SEND] Message process successful')
    return NextResponse.json({ 
      success: true, 
      messageId: result.messageId,
      phone: sendTo
    })
  } catch (error: any) {
    console.error('[SEND] POST handler error:', error.message)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
