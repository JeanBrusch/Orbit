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

    // --- Step 4: Build embedding text ---
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

    const embedding = await generateEmbedding(embeddingText)

    let topics: string[] = []
    if (data.DescricaoWeb) {
      try {
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
        const prompt = `Analise a descrição deste imóvel e liste de 3 a 5 tags impressionantes. Foque em estilo de vida, arquitetura ou diferenciais únicos (ex: "Vista Panorâmica", "Pé Direito Duplo", "Luz Natural"). Máximo de 4 palavras por tag. Retorne APENAS um JSON no formato {"topics": ["tag1", "tag2"]}.\n\nDescrição: ${data.DescricaoWeb}`
        const aiResponse = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
          temperature: 0.2
        })
        const parsed = JSON.parse(aiResponse.choices[0].message.content || '{"topics":[]}')
        topics = Array.isArray(parsed) ? parsed : (parsed.topics || parsed.tags || [])
      } catch (err) {
        console.warn("[VistaNet Import] Falha ao gerar tópicos via IA:", err)
      }
    }

    // --- Step 5: Upsert into properties ---
    const supabase = getSupabaseServer()

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
    }

    const { data: property, error } = await (supabase.from('properties') as any)
      .upsert(payload, { onConflict: 'source_link' })
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
