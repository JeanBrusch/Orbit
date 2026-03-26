import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import {
  decodeShortLink,
  extractV2FromUrl,
  fetchVistaNetProperty,
  parseBRL,
} from '@/lib/vistanet/client'
import { getSupabaseServer } from '@/lib/supabase-server'
import { generateEmbedding } from '@/lib/orbit-core'
import { trackAICall } from '@/lib/observability'
import { enrichmentPipeline, shouldUseAI } from '@/lib/vistanet/enrichment'

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json()
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'Campo "url" obrigatório.' }, { status: 400 })
    }

    // --- Step 1: Resolve the v2 token (following redirects if needed) ---
    let finalUrl = url.trim()

    // Follow redirect if it's a short link without v2
    if (finalUrl.includes('v.imo.bi') && !finalUrl.includes('v2=')) {
      try {
        if (!finalUrl.startsWith('http')) finalUrl = `https://${finalUrl}`
        const r = await fetch(finalUrl, {
          method: 'GET',
          redirect: 'follow',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
          }
        })
        if (r.ok) finalUrl = r.url
      } catch (err) {
        console.warn('[VistaNet] Falha ao resolver redirect:', err)
      }
    }

    const v2 = extractV2FromUrl(finalUrl) ?? finalUrl

    let params
    try {
      // Fix base64url characters just in case
      const normalizedB64 = v2.replace(/-/g, '+').replace(/_/g, '/')
      params = decodeShortLink(normalizedB64)
    } catch {
      return NextResponse.json({ error: 'v2 inválido ou não decodificável como base64.' }, { status: 400 })
    }

    if (!params.key || !params.cod) {
      return NextResponse.json({ error: 'Parâmetros "key" e "cod" não encontrados no v2.' }, { status: 400 })
    }

    // --- Step 2: Fetch from VistaNet ---
    const data = await fetchVistaNetProperty(params.key, params.cod)

    // --- Step 3: Enriched Pipeline ---
    const { 
      description: cleanedDescription,
      features,
      type,
      location_tags,
      semantic_summary,
      score,
      ...normalizedData
    } = enrichmentPipeline(data as any)

    // Preserve photos and agent data (not part of the enrichment logic but needed for the portal)
    const fotosData = data.Foto && typeof data.Foto === 'object' ? Object.values(data.Foto) : []
    const photos: string[] = fotosData
      .sort((a: any, b: any) => (b.Destaque === 'Sim' ? 1 : 0) - (a.Destaque === 'Sim' ? 1 : 0))
      .map((f: any) => f.Foto)
      .filter(Boolean)

    // --- Step 4: Scraping Lite & Embedding Optimization ---
    const supabase = getSupabaseServer()
    const { data: existingProperty } = await (supabase
      .from('properties')
      .select('id, topics, property_embedding, title, value, neighborhood, features, description, internal_code, internal_notes')
      .eq('internal_name', data.Codigo)
      .maybeSingle() as any)

    const embeddingText = [
      type,
      normalizedData.neighborhood,
      normalizedData.city,
      normalizedData.bedrooms ? `${normalizedData.bedrooms} dormitórios` : null,
      normalizedData.suites ? `${normalizedData.suites} suítes` : null,
      normalizedData.area_privativa ? `${normalizedData.area_privativa}m²` : null,
      ...features.slice(0, 10),
      existingProperty?.internal_notes ? `Notas Internas: ${existingProperty.internal_notes}` : null,
    ].filter(Boolean).join('. ')

    // Só gera embedding se for novo ou se a descrição mudou significativamente
    const embedding = existingProperty?.property_embedding || await generateEmbedding(embeddingText)

    // IA Fallback
    let aiTopics: string[] = []
    if (shouldUseAI(features, data.DescricaoWeb || '')) {
      try {
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
        const prompt = `Analise a descrição deste imóvel e liste de 3 a 5 tags impressionantes. Retorne APENAS um JSON: {"topics": ["tag1", "tag2"]}.\n\nDescrição: ${data.DescricaoWeb}`
        const start = Date.now()
        const aiResponse = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
          temperature: 0.2
        })
        const usage = aiResponse.usage
        if (usage) {
          await trackAICall({
            module: 'vistanet_ingest',
            model: 'gpt-4o-mini',
            tokens_input: usage.prompt_tokens,
            tokens_output: usage.completion_tokens,
            duration_ms: Date.now() - start,
            metadata: { 
              action: 'extract_topics', 
              property_code: data.Codigo,
              reason: 'low_feature_density'
            }
          })
        }
        const parsed = JSON.parse(aiResponse.choices[0].message.content || '{"topics":[]}')
        aiTopics = parsed.topics || []
      } catch (err) {
        console.warn("[VistaNet Import] Falha ao gerar tópicos via IA:", err)
      }
    }

    // Merge location tags and AI topics into the 'topics' column
    const finalTopics = [...new Set([...location_tags, ...aiTopics])].slice(0, 8)

    // Preserve or generate internal code sequentially (starting at 100)
    let internalCode = existingProperty?.internal_code;
    if (!internalCode) {
      const { data } = await supabase
        .from('properties')
        .select('internal_code');
      const codesData = data as any[];
      
      let maxCode = 99; // Defaults to starting at 100
      if (codesData) {
        for (const row of codesData) {
          if (row.internal_code && /^\d+$/.test(row.internal_code.trim())) {
            const num = parseInt(row.internal_code.trim(), 10);
            if (num > maxCode) maxCode = num;
          }
        }
      }
      internalCode = (maxCode + 1).toString();
    }

    // --- Step 5: Upsert into properties ---
    const payload = {
      source_link: url.trim(),
      internal_name: normalizedData.id,
      title: normalizedData.title || `${type} em ${normalizedData.neighborhood}`,
      cover_image: photos[0] ?? null,
      value: normalizedData.price,
      neighborhood: normalizedData.neighborhood,
      city: normalizedData.city,
      area_privativa: normalizedData.area_privativa,
      area_total: normalizedData.area_total,
      bedrooms: normalizedData.bedrooms,
      suites: normalizedData.suites,
      description: cleanedDescription,
      features,
      photos,
      ui_type: type,
      topics: finalTopics,
      semantic_summary,
      score,
      property_embedding: embedding,
      ingestion_type: 'vistanet',
      ingestion_status: 'confirmed',
      agent_data: {
        agent_name: data.Corretor?.Nome ?? null,
        agent_phone: data.Corretor?.Fone ?? null,
        agent_email: data.Corretor?.Email ?? null,
        agent_photo: data.Corretor?.Foto ?? null,
      },
      payment_conditions: {
        vistanet_key: params.key,
        vistanet_cod: params.cod,
        vistanet_v2: v2,
      },
      vista_code: params.cod,
      internal_code: internalCode,
      internal_notes: existingProperty?.internal_notes || null,
      status: 'active'
    }

    const { data: property, error } = await (supabase.from('properties') as any)
      .upsert(payload, { onConflict: 'internal_name', ignoreDuplicates: false })
      .select()
      .single()

    if (error) {
      console.error('[VistaNet Import] Supabase upsert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      property,
      photos_count: photos.length,
      agent: data.Corretor?.Nome ?? null,
      title: payload.title,
    })
  } catch (err: any) {
    console.error('[VistaNet Import] Unexpected error:', err)
    return NextResponse.json(
      { error: err.message ?? 'Erro interno ao importar imóvel.' },
      { status: 500 },
    )
  }
}
