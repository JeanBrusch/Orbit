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

    // --- Step 3: Map to Orbit schema ---
    // VistaNet API returns related data as objects with numeric string keys, not arrays.
    const fotosData = data.Foto && typeof data.Foto === 'object' ? Object.values(data.Foto) : []
    const photos: string[] = fotosData
      .sort((a: any, b: any) => (b.Destaque === 'Sim' ? 1 : 0) - (a.Destaque === 'Sim' ? 1 : 0))
      .map((f: any) => f.Foto)
      .filter(Boolean)

    const featuresData = data.Caracteristicas && typeof data.Caracteristicas === 'object' ? data.Caracteristicas : {}

    const features: string[] = [
      ...Object.entries(featuresData).filter(([_, v]) => v === 'Sim').map(([k]) => k),
    ].filter((v): v is string => typeof v === 'string' && v.length > 0)

    let ui_type = null
    let bairro = data.BairroComercial || data.Bairro || null

    if (data.TipoImovel) {
      const tipoLower = data.TipoImovel.toLowerCase()
      if (tipoLower.includes('condomínio') || tipoLower.includes('sobrado')) {
        ui_type = 'Casa Condomínio'
        bairro = 'Condomínio'
      } else if (tipoLower.includes('casa') || tipoLower.includes('duplex') || tipoLower.includes('geminada')) {
        ui_type = 'Casa de Rua'
      } else if (tipoLower.includes('apartamento') || tipoLower.includes('flat') || tipoLower.includes('cobertura')) {
        ui_type = 'Apt'
      }
    }

    const title = [ui_type || data.TipoImovel, bairro, data.Cidade].filter(Boolean).join(' - ')

    // --- Step 4: Scraping Lite & Embedding Optimization ---
    const supabase = getSupabaseServer()
    const { data: existingProperty } = await (supabase
      .from('properties')
      .select('id, topics, property_embedding, title, value, neighborhood, features')
      .eq('internal_name', data.Codigo)
      .maybeSingle() as any)

    if (existingProperty) {
      console.log(`[VistaNet] Imóvel ${data.Codigo} já existe. Verificando necessidade de atualização.`)
      // Se já existe e não houve mudança crítica, podemos pular a IA e o re-embedding
      // Mas para este MVP, vamos focar na deduplicação e economia.
    }

    const embeddingText = [
      ui_type || data.TipoImovel,
      bairro,
      data.Cidade,
      data.Dormitorios ? `${data.Dormitorios} dormitórios` : null,
      data.Suites ? `${data.Suites} suítes` : null,
      data.AreaPrivativa ? `${data.AreaPrivativa}m²` : null,
      data.AreaTotal ? `Lote ${data.AreaTotal}m²` : null,
      ...features.slice(0, 10),
    ].filter(Boolean).join('. ')

    // Só gera embedding se for novo ou se o texto descritivo mudou (simplificado: se for novo)
    const embedding = existingProperty?.property_embedding || await generateEmbedding(embeddingText)

    // Scraping Lite: Extração de tags via Regex (Orbit AI Governance)
    let topics: string[] = []
    const descricao = data.DescricaoWeb || ""
    
    // Regras de Scraping Lite (sem custo de token)
    if (descricao.toLowerCase().includes("pé direito duplo")) topics.push("Pé Direito Duplo")
    if (descricao.toLowerCase().includes("vista mar") || descricao.toLowerCase().includes("frente mar")) topics.push("Vista Mar")
    if (descricao.toLowerCase().includes("piscina privativa")) topics.push("Piscina Privativa")
    if (descricao.toLowerCase().includes("varanda gourmet")) topics.push("Varanda Gourmet")
    if (descricao.toLowerCase().includes("totalmente mobiliado")) topics.push("Mobiliado")
    if (descricao.toLowerCase().includes("climatizado") || descricao.toLowerCase().includes("ar condicionado")) topics.push("Climatizado")

    // Só chama IA se não encontrou tags suficientes via Scraping Lite
    if (topics.length < 2 && descricao.length > 50) {
      try {
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
        const prompt = `Analise a descrição deste imóvel e liste de 3 a 5 tags impressionantes. Retorne APENAS um JSON: {"topics": ["tag1", "tag2"]}.\n\nDescrição: ${descricao}`
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
            metadata: { action: 'extract_topics', property_code: data.Codigo }
          })
        }
        const parsed = JSON.parse(aiResponse.choices[0].message.content || '{"topics":[]}')
        const aiTopics = Array.isArray(parsed) ? parsed : (parsed.topics || [])
        topics = [...new Set([...topics, ...aiTopics])].slice(0, 5)
      } catch (err) {
        console.warn("[VistaNet Import] Falha ao gerar tópicos via IA:", err)
      }
    }

    // Se já existiam tópicos e não mudou a descrição, preserva os antigos se preferir
    if (existingProperty?.topics && topics.length === 0) {
      topics = existingProperty.topics as string[]
    }

    // --- Step 5: Upsert into properties ---

    const payload = {
      source_link: url.trim(),
      internal_name: data.Codigo ?? null,
      title,
      cover_image: photos[0] ?? null,
      value: parseBRL(data.ValorVenda) ?? null,
      neighborhood: bairro,
      city: data.Cidade ?? null,
      area_privativa: data.AreaPrivativa ? parseFloat(data.AreaPrivativa) : null,
      area_total: data.AreaTotal ? parseFloat(data.AreaTotal) : null,
      bedrooms: data.Dormitorios ? parseInt(data.Dormitorios, 10) : null,
      suites: data.Suites ? parseInt(data.Suites, 10) : null,
      features,
      photos,
      ingestion_type: 'vistanet',
      ingestion_status: 'confirmed',
      property_embedding: embedding,
      ui_type,
      topics,
      condo_name: data.Edificio ?? null,
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
      title,
    })
  } catch (err: any) {
    console.error('[VistaNet Import] Unexpected error:', err)
    return NextResponse.json(
      { error: err.message ?? 'Erro interno ao importar imóvel.' },
      { status: 500 },
    )
  }
}
