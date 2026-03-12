import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { ZAPIWebhookMessage } from '@/lib/zapi/types'
import { getContactProfile } from '@/lib/zapi/client'
import { normalizePhone, isLidFormat, extractLid, hasRealPhone } from '@/lib/phone-utils'
import { processEventWithCore } from '@/lib/orbit-core'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const leadCreationLocks = new Map<string, Promise<any>>()

async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  while (leadCreationLocks.has(key)) {
    await leadCreationLocks.get(key)
  }
  
  const promise = fn()
  leadCreationLocks.set(key, promise)
  
  try {
    return await promise
  } finally {
    leadCreationLocks.delete(key)
  }
}

function isMessageFromMe(payload: ZAPIWebhookMessage): boolean {
  return payload.fromMe === true || payload.isFromMe === true
}

async function isBlockedByPhoneOrLid(phone: string | null, lid: string | null): Promise<boolean> {
  if (lid) {
    const { data } = await supabase
      .from('leads')
      .select('id, state')
      .eq('lid', lid)
      .maybeSingle()
    if (data?.state === 'blocked') return true
  }
  
  if (phone) {
    const normalized = normalizePhone(phone)
    const { data } = await supabase
      .from('leads')
      .select('id, state')
      .eq('phone', normalized)
      .maybeSingle()
    if (data?.state === 'blocked') return true
  }
  
  return false
}

interface FindLeadParams {
  phone: string
  lid?: string | null
  name?: string
}

async function findOrCreateLeadSafe({ phone, lid, name }: FindLeadParams) {
  const hasPhone = hasRealPhone(phone)
  const normalizedPhone = hasPhone ? normalizePhone(phone) : null
  
  const lockKey = lid || normalizedPhone || phone
  
  return withLock(lockKey, async () => {
    let existingLead = null
    
    if (lid) {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('lid', lid)
        .maybeSingle()
      
      if (error) {
        console.error('[WEBHOOK] Error fetching lead by LID:', error)
      }
      existingLead = data
      
      if (existingLead) {
        console.log('[WEBHOOK] Found lead by LID:', { id: existingLead.id, lid })
        
        if (normalizedPhone && !existingLead.phone) {
          console.log('[WEBHOOK] Linking phone to LID-only lead:', { lid, phone: normalizedPhone })
          await supabase
            .from('leads')
            .update({ phone: normalizedPhone })
            .eq('id', existingLead.id)
          existingLead.phone = normalizedPhone
        }
      }
    }
    
    if (!existingLead && normalizedPhone) {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('phone', normalizedPhone)
        .maybeSingle()
      
      if (error) {
        console.error('[WEBHOOK] Error fetching lead by phone:', error)
      }
      existingLead = data
      
      if (existingLead) {
        console.log('[WEBHOOK] Found lead by phone:', { id: existingLead.id, phone: normalizedPhone })
        
        if (lid && !existingLead.lid) {
          console.log('[WEBHOOK] Linking LID to phone-only lead:', { phone: normalizedPhone, lid })
          await supabase
            .from('leads')
            .update({ lid })
            .eq('id', existingLead.id)
          existingLead.lid = lid
        }
      }
    }
    
    if (existingLead) {
      if (existingLead.state === 'blocked' || existingLead.state === 'ignored') {
        console.log('[WEBHOOK] Ignoring blocked/ignored lead:', existingLead.id)
        return null
      }
      
      const needsProfileUpdate = !existingLead.photo_url || 
        existingLead.name?.startsWith('+')
      
      const profileIdentifier = existingLead.phone || (existingLead.lid ? (existingLead.lid.includes('@lid') ? existingLead.lid : `${existingLead.lid}@lid`) : null) || normalizedPhone
      if (needsProfileUpdate && profileIdentifier) {
        updateLeadProfile(existingLead.id, profileIdentifier).catch(err => 
          console.error('[WEBHOOK] Background profile update failed:', err)
        )
      }
      return existingLead
    }
    
    console.log('[WEBHOOK] Creating new lead:', { phone: normalizedPhone, lid })
    
    let profileName = name
    let profilePhoto: string | undefined
    const profileIdentifier = normalizedPhone || (lid ? (lid.includes('@lid') ? lid : `${lid}@lid`) : null)
    if (profileIdentifier) {
      try {
        const profile = await getContactProfile(profileIdentifier)
        if (profile.name) profileName = profile.name
        if (profile.photoUrl) profilePhoto = profile.photoUrl
        console.log('[WEBHOOK] Z-API profile:', { identifier: profileIdentifier, name: profileName, hasPhoto: !!profilePhoto })
      } catch (err) {
        console.error('[WEBHOOK] Failed to fetch Z-API profile:', err)
      }
    }
    
    const insertData: Record<string, any> = {
      name: profileName || (normalizedPhone ? `+${normalizedPhone}` : `LID:${lid}`),
      photo_url: profilePhoto || null,
      origin: 'whatsapp',
      state: 'pending' // New leads via WhatsApp start as pending
    }
    
    if (normalizedPhone) {
      insertData.phone = normalizedPhone
    }
    if (lid) {
      insertData.lid = lid
    }
    
    const { data: newLead, error: insertError } = await supabase
      .from('leads')
      .insert(insertData)
      .select()
      .single()
    
    if (insertError) {
      if (insertError.code === '23505') {
        console.log('[WEBHOOK] Duplicate key detected, fetching existing')
        
        if (lid) {
          const { data } = await supabase
            .from('leads')
            .select('*')
            .eq('lid', lid)
            .maybeSingle()
          if (data) return data
        }
        if (normalizedPhone) {
          const { data } = await supabase
            .from('leads')
            .select('*')
            .eq('phone', normalizedPhone)
            .maybeSingle()
          if (data) return data
        }
        return null
      }
      console.error('[WEBHOOK] Error creating lead:', insertError)
      return null
    }
    
    console.log('[WEBHOOK] New lead created:', { id: newLead.id, phone: normalizedPhone, lid })
    return newLead
  })
}

async function updateLeadProfile(leadId: string, phone: string) {
  try {
    const profile = await getContactProfile(phone)
    
    const updates: Record<string, any> = {}
    if (profile.name) updates.name = profile.name
    if (profile.photoUrl) updates.photo_url = profile.photoUrl
    
    if (Object.keys(updates).length > 0) {
      const { error } = await supabase
        .from('leads')
        .update(updates)
        .eq('id', leadId)
      
      if (error) {
        console.error('[WEBHOOK] Error updating lead profile:', error)
      } else {
        console.log('[WEBHOOK] Lead profile updated:', leadId, updates)
      }
    }
  } catch (err) {
    console.error('[WEBHOOK] Error in updateLeadProfile:', err)
  }
}

async function saveMessage(
  leadId: string, 
  content: string, 
  source: 'whatsapp' | 'operator', 
  idempotencyKey: string,
  mediaData?: { type: string; url: string; caption?: string }
) {
  const { data: existing } = await supabase
    .from('messages')
    .select('id')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle()
  
  if (existing) {
    console.log('[WEBHOOK] Idempotent skip - already processed:', idempotencyKey)
    if (source === 'whatsapp') {
      // Still need to check if we should process core for existing idempotent message
      const { data: lead } = await supabase.from('leads').select('state').eq('id', leadId).single()
      if (lead?.state !== 'pending' && lead?.state !== 'blocked' && lead?.state !== 'ignored') {
        console.log(`[WEBHOOK] Disparando redeliver de Orbit Core para lead=${leadId}`);
        processEventWithCore(leadId, content, 'message_inbound', existing.id).catch((err) => {
          console.error('[WEBHOOK] Erro no Orbit Core (idempotency fallback):', err);
        })
      }
    }
    return { saved: true, skipped: true, id: existing.id }
  }
  
  let finalContent = content
  
  if (mediaData) {
    finalContent = JSON.stringify({
      type: mediaData.type,
      url: mediaData.url,
      caption: mediaData.caption || content
    })
  }
  
  const { data, error } = await supabase
    .from('messages')
    .insert({
      lead_id: leadId,
      source: source,
      content: finalContent,
      idempotency_key: idempotencyKey,
      timestamp: new Date().toISOString()
    })
    .select('id')
    .single()
  
  if (error) {
    if (error.code === '23505' && error.message?.includes('idempotency')) {
      console.log('[WEBHOOK] Idempotent skip (constraint) - already processed:', idempotencyKey)
      return { saved: true, skipped: true }
    }
    console.error('[WEBHOOK] Error saving message:', error)
    return { saved: false, skipped: false }
  }
  
  if (source === 'whatsapp') {
    // Only trigger Orbit Core analysis if lead is NOT pending
    const { data: lead } = await supabase.from('leads').select('state').eq('id', leadId).single()
    
    if (lead?.state !== 'pending' && lead?.state !== 'blocked' && lead?.state !== 'ignored') {
      await supabase
        .from('leads')
        .update({
          action_suggested: 'needs_attention',
          last_interaction_at: new Date().toISOString(),
        } as any)
        .eq('id', leadId)
      
      // Acionar Orbit Core com o ID da nova mensagem
      console.log(`[WEBHOOK] Disparando Orbit Core para lead=${leadId}`);
      processEventWithCore(leadId, content, 'message_inbound', data.id).catch((err) => {
        console.error('[WEBHOOK] Erro no Orbit Core:', err);
      })
    } else {
      console.log('[WEBHOOK] Skipping Orbit Core for pending/blocked lead')
      await supabase
        .from('leads')
        .update({
          last_interaction_at: new Date().toISOString(),
        } as any)
        .eq('id', leadId)
    }
  } else {
    const { error: updateError } = await supabase
      .from('leads')
      .update({
        last_interaction_at: new Date().toISOString()
      } as any)
      .eq('id', leadId)
    
    if (updateError) {
      console.error('[WEBHOOK] Error updating lead timestamp:', updateError)
    }
  }
  
  return { saved: true, skipped: false, id: data?.id }
}

export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7)
  
  try {
    const payload: ZAPIWebhookMessage = await request.json()
    
    const fromMe = isMessageFromMe(payload)
    
    console.log(`[WEBHOOK:${requestId}] === INCOMING PAYLOAD ===`)
    console.log(`[WEBHOOK:${requestId}] phone: ${payload.phone}`)
    console.log(`[WEBHOOK:${requestId}] connectedPhone: ${payload.connectedPhone}`)
    console.log(`[WEBHOOK:${requestId}] chatName: ${payload.chatName}`)
    console.log(`[WEBHOOK:${requestId}] messageId: ${payload.messageId}`)
    console.log(`[WEBHOOK:${requestId}] fromMe: ${payload.fromMe}, isFromMe: ${payload.isFromMe} => ${fromMe}`)
    console.log(`[WEBHOOK:${requestId}] isGroup: ${payload.isGroup}`)
    console.log(`[WEBHOOK:${requestId}] isBroadcast: ${payload.isBroadcast}, broadcast: ${payload.broadcast}`)
    console.log(`[WEBHOOK:${requestId}] type: ${payload.type}`)
    console.log(`[WEBHOOK:${requestId}] hasText: ${!!payload.text?.message}`)
    console.log(`[WEBHOOK:${requestId}] hasImage: ${!!payload.image?.imageUrl}`)
    console.log(`[WEBHOOK:${requestId}] hasAudio: ${!!payload.audio?.audioUrl}`)
    console.log(`[WEBHOOK:${requestId}] hasVideo: ${!!payload.video?.videoUrl}`)
    console.log(`[WEBHOOK:${requestId}] hasDocument: ${!!payload.document?.documentUrl}`)
    console.log(`[WEBHOOK:${requestId}] ========================`)
    
    if (payload.isGroup) {
      console.log(`[WEBHOOK:${requestId}] IGNORED: group message`)
      return NextResponse.json({ status: 'ignored', reason: 'group_message' })
    }
    
    const isBroadcast = payload.isBroadcast === true || payload.broadcast === true
    if (isBroadcast) {
      console.log(`[WEBHOOK:${requestId}] IGNORED: broadcast message`)
      return NextResponse.json({ status: 'ignored', reason: 'broadcast_message' })
    }
    
    const lid = extractLid(payload.senderLid, payload.chatLid)
    const phoneIsLid = isLidFormat(payload.phone)
    const hasPhone = hasRealPhone(payload.phone)
    
    console.log(`[WEBHOOK:${requestId}] Identity detection:`, { 
      rawPhone: payload.phone, 
      phoneIsLid, 
      hasPhone, 
      senderLid: payload.senderLid,
      chatLid: payload.chatLid,
      extractedLid: lid 
    })
    
    if (!lid && !hasPhone) {
      console.log(`[WEBHOOK:${requestId}] IGNORED: no valid identifier (no LID and no valid phone)`)
      return NextResponse.json({ status: 'ignored', reason: 'no_valid_identifier' })
    }
    
    const normalizedPhone = hasPhone ? normalizePhone(payload.phone) : null
    
    if (await isBlockedByPhoneOrLid(normalizedPhone, lid)) {
      console.log(`[WEBHOOK:${requestId}] IGNORED: blocked contact - phone=${normalizedPhone}, lid=${lid}`)
      return NextResponse.json({ status: 'ignored', reason: 'blocked' })
    }
    
    let mediaData: { type: string; url: string; caption?: string } | undefined
    let messageText: string
    
    if (payload.text?.message) {
      messageText = payload.text.message
    } else if (payload.image?.imageUrl) {
      messageText = payload.image.caption || ''
      mediaData = { type: 'image', url: payload.image.imageUrl, caption: payload.image.caption }
    } else if (payload.video?.videoUrl) {
      messageText = payload.video.caption || ''
      mediaData = { type: 'video', url: payload.video.videoUrl, caption: payload.video.caption }
    } else if (payload.audio?.audioUrl) {
      messageText = '[audio]'
      mediaData = { type: 'audio', url: payload.audio.audioUrl }
    } else if (payload.document?.documentUrl) {
      messageText = payload.document.caption || '[documento]'
      mediaData = { type: 'document', url: payload.document.documentUrl, caption: payload.document.caption }
    } else if (payload.sticker?.stickerUrl) {
      messageText = ''
      mediaData = { type: 'sticker', url: payload.sticker.stickerUrl }
    } else {
      console.log(`[WEBHOOK:${requestId}] IGNORED: no recognizable content`)
      return NextResponse.json({ status: 'ignored', reason: 'no_content' })
    }
    
    const idempotencyKey = `zapi:${payload.messageId}`
    const direction: 'inbound' | 'outbound' = fromMe ? 'outbound' : 'inbound'
    
    console.log(`[WEBHOOK:${requestId}] Processing: phone=${normalizedPhone}, lid=${lid}, direction=${direction}, key=${idempotencyKey}`)
    
    const lead = await findOrCreateLeadSafe({
      phone: payload.phone,
      lid,
      name: payload.chatName || payload.senderName
    })
    
    if (!lead) {
      console.error(`[WEBHOOK:${requestId}] FAILED: could not get/create lead for phone=${normalizedPhone}, lid=${lid}`)
      return NextResponse.json({ status: 'error', error: 'Failed to create lead' }, { status: 500 })
    }
    
    const result = await saveMessage(lead.id, messageText, fromMe ? 'operator' : 'whatsapp', idempotencyKey, mediaData)
    
    if (fromMe) {
      console.log(`[WEBHOOK:${requestId}] OUTBOUND SYNC: leadId=${lead.id}, saved=${result.saved}, skipped=${result.skipped}`)
    }
    
    console.log(`[WEBHOOK:${requestId}] COMPLETED: leadId=${lead.id}, direction=${direction}, saved=${result.saved}, skipped=${result.skipped}`)
    
    return NextResponse.json({ 
      status: result.skipped ? 'already_processed' : 'processed',
      leadId: lead.id,
      phone: normalizedPhone || lid,
      lid: lid,
      direction: direction,
      idempotencyKey: idempotencyKey
    })
    
  } catch (error: any) {
    console.error(`[WEBHOOK:${requestId}] EXCEPTION:`, error)
    return NextResponse.json({ status: 'error', error: error.message }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ 
    status: 'ok', 
    message: 'Z-API Webhook endpoint ready',
    timestamp: new Date().toISOString(),
    features: [
      'Accepts both fromMe and isFromMe fields',
      'Captures outbound messages (sent by me)',
      'Idempotency via messageId',
      'Phone normalization for Brazil',
      'LID support: links senderLid/chatLid to phone when available',
      'Dual-identifier matching: searches by LID first, then by phone'
    ]
  })
}
