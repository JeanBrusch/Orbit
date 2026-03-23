import { NextRequest, NextResponse } from 'next/server'
import { sendMessage, sendImage, sendAudio } from '@/lib/zapi/client'
import { normalizePhone, isLidFormat } from '@/lib/phone-utils'
import { getSupabaseServer } from '@/lib/supabase-server'
import { processEventWithCore } from '@/lib/orbit-core'

export async function POST(request: NextRequest) {
  console.log('[SEND] API route hit')
  try {
    const body = await request.json()
    const { phone, message, leadId, skipInteraction, type = 'text', mediaUrl, caption } = body
    console.log('[SEND] Request data:', { phone, type, hasMessage: !!message, hasMedia: !!mediaUrl, leadId })

    if (!phone || (type === 'text' && !message) || (type !== 'text' && !mediaUrl)) {
      return NextResponse.json(
        { error: 'Parâmetros obrigatórios ausentes (phone, message ou mediaUrl)' },
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
    console.log(`[SEND] Sending ${type} to:`, sendTo)
    
    let result: any
    let dbContent: string

    if (type === 'image') {
      result = await sendImage(sendTo, mediaUrl!, caption)
      dbContent = JSON.stringify({ type: 'image', url: mediaUrl, caption: caption || '' })
    } else if (type === 'audio') {
      result = await sendAudio(sendTo, mediaUrl!)
      dbContent = JSON.stringify({ type: 'audio', url: mediaUrl, caption: caption || '[Áudio]' })
    } else {
      result = await sendMessage(sendTo, message!)
      dbContent = message!
    }

    console.log('[SEND] Z-API result:', result)

    if (leadId && !skipInteraction) {
      const supabase = getSupabaseServer()
      const idempotencyKey = `zapi:${result.messageId}`
      
      const { data: existing } = await (supabase
        .from('messages') as any)
        .select('id')
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle()
      
      if (!existing) {
        console.log('[SEND] Message not found in history, inserting:', idempotencyKey)
        const { data: newMessage, error } = await (supabase.from('messages') as any).insert({
          lead_id: leadId,
          source: 'operator',
          content: dbContent,
          idempotency_key: idempotencyKey,
          timestamp: new Date().toISOString()
        }).select('id').single()
        
        if (error) {
          if (error.code === '23505' && error.message?.includes('idempotency')) {
            console.log('[SEND] Message already exists (race condition/constraint):', idempotencyKey)
          } else {
            console.error('[SEND] Error saving message to historical table:', error)
            return NextResponse.json({ 
              success: true, 
              messageId: result.messageId,
              phone: sendTo,
              warning: 'Mensagem enviada, mas houve um erro ao salvar no histórico'
            })
          }
        } else {
          console.log('[SEND] Message saved in historical table:', idempotencyKey)
          
          await Promise.all([
            (supabase.from('lead_cognitive_state') as any).upsert({
              lead_id: leadId,
              last_human_action_at: new Date().toISOString(),
            }, { onConflict: 'lead_id' }),
            (supabase.from('leads') as any).update({ 
              last_interaction_at: new Date().toISOString() 
            }).eq('id', leadId)
          ])

          processEventWithCore(leadId, type === 'text' ? message! : `[Mídia: ${type}]`, 'message_outbound', (newMessage as any)?.id).catch((e) => {
             console.error('[SEND] Orbit Core processing error:', e)
          })
        }
      }
    }

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
