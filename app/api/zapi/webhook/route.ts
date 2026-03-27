import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from "@/lib/supabase-server"
import type { ZAPIWebhookMessage } from '@/lib/zapi/types'
import { getContactProfile } from '@/lib/zapi/client'
import { normalizePhone, isLidFormat, extractLid, hasRealPhone } from '@/lib/phone-utils'
import { processEventWithCore } from '@/lib/orbit-core'
import { trackAICall, trackEvent } from '@/lib/observability'
import { markActionAsReplied } from '@/lib/orbit-outcome-evaluator'
import OpenAI from "openai"

// Orbit AI Governance imports
import { assessMessageRelevance, simpleHash } from "@/lib/message-relevance"
import { resolveAnalysisCadence } from "@/lib/analysis-scheduler"
import { enqueueForBatchAnalysis, markAsSkipped } from "@/lib/analysis-queue"

const supabase = getSupabaseServer() as any
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

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

// ── Fechamento do loop de reengajamento ───────────────────────────────────────

async function closeReengagementLoop(
  leadId: string,
  incomingMessage: string,
  supabase: any
) {
  try {
    // Busca experimento enviado e ainda sem resposta
    const { data: experiment, error: fetchError } = await supabase
      .from("reengagement_experiments")
      .select("id, objective, sent_at")
      .eq("lead_id", leadId)
      .not("sent_at", "is", null)
      .is("had_response", null)
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (fetchError || !experiment) return

    const startGPT = Date.now()
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { 
          role: "system", 
          content: "Você classifica respostas de leads imobiliários após uma abordagem de reengajamento. Responda APENAS com JSON puro." 
        },
        {
          role: "user",
          content: `Objetivo da mensagem enviada: "${experiment.objective}"
Respostas do lead: "${incomingMessage}"

Classifique em exatamente um valor:
- "positive_progress": abre caminho, avança o objetivo
- "neutral_reply": responde mas não avança nem recua
- "deflection": desvia sem rejeitar (ex: "tô ocupado", "depois vejo")
- "rejection": recusa direta ou encerra
- "confusion": não faz sentido no contexto

Retorne: {"response_type": "...", "confidence": 0.0, "signal": "palavra ou frase que determinou a classificação"}`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0,
    });
    const elapsedGPT = Date.now() - startGPT
    const usage = response.usage

    if (usage) {
      await trackAICall({
        module: 'classifier',
        model: 'gpt-4o-mini',
        lead_id: leadId,
        tokens_input: usage.prompt_tokens,
        tokens_output: usage.completion_tokens,
        duration_ms: elapsedGPT,
        metadata: { action: 'reengagement_classification', experiment_id: experiment.id }
      })
    }

    const classification = JSON.parse(response.choices[0].message.content || "{}");

    if (!classification.response_type) return;

    const sentAt = new Date(experiment.sent_at);
    const responseTimeMinutes = Math.round((Date.now() - sentAt.getTime()) / 60000);

    await supabase
      .from("reengagement_experiments")
      .update({
        had_response: true,
        response_type: classification.response_type,
        response_signal: classification.signal,
        response_confidence: classification.confidence,
        response_time_minutes: responseTimeMinutes,
      })
      .eq("id", experiment.id);

    console.log(`[REENGAGEMENT LOOP] Lead ${leadId} respondeu. Tipo: ${classification.response_type}`);
  } catch (err) {
    console.error("[REENGAGEMENT LOOP] Error:", err);
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
    // Buscar dados do lead para contextualizar a governança de IA
    const { data: lead } = await supabase
      .from('leads')
      .select('state, orbit_stage, days_since_interaction')
      .eq('id', leadId)
      .single()
    
    // Status que NUNCA devem ser analisados
    if (lead?.state === 'blocked' || lead?.state === 'ignored') {
      console.log(`[WEBHOOK] Contato bloqueado/ignorado (${lead.state}), pulando governança.`)
      return { saved: true, skipped: false, id: data?.id }
    }

    // --- GOVERNANÇA DE IA ---
    // Buscar hashes de mensagens recentes para filtro de duplicidade
    const { data: recentMessages } = await supabase
      .from('messages')
      .select('content')
      .eq('lead_id', leadId)
      .order('timestamp', { ascending: false })
      .limit(5)
    
    const context = {
      leadState: lead?.orbit_stage,
      daysSinceInteraction: lead?.days_since_interaction,
      recentHashes: recentMessages?.map((m: any) => simpleHash((m.content || "").toLowerCase()))
    }

    const relevance = assessMessageRelevance(content, context)

    if (!relevance.relevant) {
      await markAsSkipped(data.id, relevance.reason || "irrelevant")
      // Apenas registrar interação, sem disparar IA
      await Promise.all([
        supabase.from('leads').update({ last_interaction_at: new Date().toISOString(), last_event_type: 'received' }).eq('id', leadId),
        supabase.from('leads_center').update({ last_event_type: 'received', ultima_interacao_at: new Date().toISOString() }).eq('lead_id', leadId)
      ])
      return { saved: true, skipped: false, id: data?.id }
    }

    const cadence = relevance.suggestedCadence || 
      resolveAnalysisCadence(lead?.orbit_stage || 'pending', lead?.days_since_interaction || 0, content)

    if (cadence === "realtime" || lead?.state === 'pending') {
      // Leads pendentes sempre recebem atenção real-time na base, mas orbit core fica pausado
      console.log(`[WEBHOOK] Atualizando base para lead=${leadId} | Cadência: Real-time`);
      
      await Promise.all([
        supabase
          .from('leads')
          .update({
            action_suggested: 'needs_attention',
            last_event_type: 'received',
            last_interaction_at: new Date().toISOString(),
          } as any)
          .eq('id', leadId),
        supabase
          .from('leads_center')
          .update({
            last_event_type: 'received',
            ultima_interacao_at: new Date().toISOString()
          } as any)
          .eq('lead_id', leadId)
      ])

      const isPending = lead?.state === 'pending'
      
      if (!isPending) {
          // Fechar loop de desfecho — lead respondeu → atualiza outcome da ação pendente
          markActionAsReplied(leadId).catch(err =>
            console.error('[ORBIT STATE ENGINE] Erro ao fechar ação pendente:', err)
          )

          // Fechamento do loop de reengajamento
          closeReengagementLoop(leadId, content, supabase).catch(err =>
            console.error("[REENGAGEMENT LOOP]", err)
          )

          processEventWithCore(leadId, content, 'message_inbound', data.id).catch((err) => {
            console.error('[WEBHOOK] Erro no Orbit Core:', err);
          })
      } else {
        console.log(`[WEBHOOK] Lead pendente (${leadId}): Pulando Orbit Core e Loop de Reengajamento até aprovação.`);
      }
    } else {
      // Enfileirar para análise em lote (Batch)
      console.log(`[WEBHOOK] Enfileirando para batch: lead=${leadId} | Cadência: ${cadence}`);
      await enqueueForBatchAnalysis(leadId, data.id, cadence as "batch_hourly" | "batch_2x_daily")
      
      await Promise.all([
        supabase.from('leads').update({ last_interaction_at: new Date().toISOString(), last_event_type: 'received' }).eq('id', leadId),
        supabase.from('leads_center').update({ last_event_type: 'received', ultima_interacao_at: new Date().toISOString() }).eq('lead_id', leadId)
      ])
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
    
    // ── Early Idempotency Check ──
    const idempotencyKey = `zapi:${payload.messageId}`
    const supabaseClient = getSupabaseServer() as any
    const { data: existingMsg } = await supabaseClient
      .from('messages')
      .select('id')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle()
      
    if (existingMsg) {
      console.log(`[WEBHOOK:${requestId}] EARLY Idempotent skip: ${idempotencyKey}`)
      return NextResponse.json({ status: 'already_processed', id: existingMsg.id })
    }

    // ── Trace: Inbound ──
    await trackEvent({
      event_type: 'message_received',
      source: 'whatsapp',
      module: 'system',
      step: 'inbound',
      action: 'webhook_received',
      origin: 'whatsapp',
      destination: 'lead_identification',
      metadata_json: { message_id: payload.messageId, type: payload.type }
    })
    
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
    
    const lead = await findOrCreateLeadSafe({
      phone: payload.phone,
      lid,
      name: payload.chatName || payload.senderName
    })
    
    if (!lead) {
      console.error(`[WEBHOOK:${requestId}] FAILED: could not get/create lead for phone=${normalizedPhone}, lid=${lid}`)
      return NextResponse.json({ status: 'error', error: 'Failed to create lead' }, { status: 500 })
    }

    // ── Trace: Lead Identified ──
    await trackEvent({
      lead_id: lead.id,
      event_type: 'message_received',
      source: 'whatsapp',
      module: 'system',
      step: 'processing',
      action: 'lead_identified',
      origin: 'lead_identification',
      destination: 'content_extraction',
      metadata_json: { lead_name: lead.name }
    })

    if (payload.text?.message) {
      messageText = payload.text.message
    } else if (payload.image?.imageUrl) {
      messageText = payload.image.caption || ''
      mediaData = { type: 'image', url: payload.image.imageUrl, caption: payload.image.caption }
    } else if (payload.video?.videoUrl) {
      messageText = payload.video.caption || ''
      mediaData = { type: 'video', url: payload.video.videoUrl, caption: payload.video.caption }
    } else if (payload.audio?.audioUrl) {
      let transcript = '[audio]'
      try {
        const audioUrl = payload.audio.audioUrl;
        const openaiApiKey = process.env.OPENAI_API_KEY;
        if (openaiApiKey && openaiApiKey !== "dummy-key") {
           console.log(`[WEBHOOK:${requestId}] Downloading audio for transcription...`);
           const audioRes = await fetch(audioUrl);
           const audioBlob = await audioRes.blob();
           const whisperForm = new FormData();
           whisperForm.append("file", audioBlob, "audio.ogg");
           whisperForm.append("model", "whisper-1");
           whisperForm.append("language", "pt");
           
            const startWhisper = Date.now()
            console.log(`[WEBHOOK:${requestId}] Sending to OpenAI Whisper...`);
            const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
              method: "POST",
              headers: { Authorization: `Bearer ${openaiApiKey}` },
              body: whisperForm,
            });
            const elapsedWhisper = Date.now() - startWhisper
            
            if (whisperRes.ok) {
              const whisperData = await whisperRes.json();
              
              await trackAICall({
                lead_id: lead.id,
                module: 'orbit_core',
                model: 'whisper-1',
                tokens_input: 0, // Whisper doesn't use tokens
                tokens_output: 0,
                duration_ms: elapsedWhisper,
                metadata: { 
                  step: 'processing', 
                  action: 'transcription',
                  origin: 'content_extraction',
                  destination: 'message_persistence'
                }
              })

              if (whisperData.text) {
                transcript = `[Áudio Transcrito] ${whisperData.text}`;
                console.log(`[WEBHOOK:${requestId}] Audio transcribed successfully.`);
              }
            } else {
              console.error(`[WEBHOOK:${requestId}] Whisper failed:`, await whisperRes.text());
            }
        }
      } catch (e) {
         console.error(`[WEBHOOK:${requestId}] Error transcribing audio:`, e);
      }
      messageText = transcript;
      mediaData = { type: 'audio', url: payload.audio.audioUrl, caption: transcript !== '[audio]' ? transcript : undefined }
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
    
    const direction: 'inbound' | 'outbound' = fromMe ? 'outbound' : 'inbound'
    

    const result = await saveMessage(lead.id, messageText, fromMe ? 'operator' : 'whatsapp', idempotencyKey, mediaData)
    
    // ── Trace: Persisted ──
    await trackEvent({
      lead_id: lead.id,
      event_type: direction === 'inbound' ? 'message_received' : 'ai_call',
      source: 'system',
      module: 'system',
      step: 'persistence',
      action: 'message_saved',
      origin: direction === 'inbound' ? 'content_extraction' : 'ai_response',
      destination: direction === 'inbound' ? 'orbit_core' : 'client',
      saved_data: true,
      metadata_json: { message_id: result.id, skipped: result.skipped }
    })
    
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
