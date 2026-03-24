// app/api/property/import-vistanet/route.ts
import { NextRequest, NextResponse } from 'next/server'
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
        const r = await fetch(finalUrl, { method: 'HEAD', redirect: 'follow' })
        finalUrl = r.url
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
    const fotos: string[] = ((data.fotos as any[]) || [])
      .sort((a: any, b: any) => (b.Destaque ?? 0) - (a.Destaque ?? 0))
      .map((f: any) => f.Foto)
      .filter(Boolean)

    const features: string[] = [
      ...((data.Caracteristicas as any[]) || []).map((c: any) => c.Caracteristica).filter(Boolean),
      ...((data.Infraestrutura as any[]) || []).map((c: any) => c.Caracteristica).filter(Boolean),
      data.Vagas ? `${data.Vagas} vaga(s)` : null,
      data.VagasCob ? `${data.VagasCob} vaga(s) coberta(s)` : null,
    ].filter((v): v is string => typeof v === 'string' && v.length > 0)

    const bairro = data.BairroComercial || data.Bairro || null
    const title = [data.TipoImovel, bairro, data.Cidade].filter(Boolean).join(' - ')

    // --- Step 4: Build embedding text ---
    const embeddingText = [
      data.TipoImovel,
      bairro,
      data.Cidade,
      data.Dormitorio ? `${data.Dormitorio} dormitórios` : null,
      data.Suites ? `${data.Suites} suítes` : null,
      data.AreaPrivativa ? `${data.AreaPrivativa}m²` : null,
      ...features.slice(0, 10),
    ].filter(Boolean).join('. ')

    const embedding = await generateEmbedding(embeddingText)

    // --- Step 5: Upsert into properties ---
    const supabase = getSupabaseServer()

    const payload = {
      source_link: url.trim(),
      internal_name: data.Codigo ?? null,
      title,
      cover_image: fotos[0] ?? null,
      value: parseBRL(data.ValorVenda) ?? parseBRL(data.ValorLocacao),
      neighborhood: bairro,
      city: data.Cidade ?? null,
      area_privativa: data.AreaPrivativa ? parseFloat(data.AreaPrivativa) : null,
      bedrooms: data.Dormitorio ? parseInt(data.Dormitorio, 10) : null,
      suites: data.Suites ? parseInt(data.Suites, 10) : null,
      parking_spots: data.Vagas ? parseInt(data.Vagas, 10) : null,
      condo_fee: parseBRL(data.Condominio),
      iptu: parseBRL(data.IPTU),
      features,
      ingestion_type: 'vistanet',
      ingestion_status: 'confirmed',
      property_embedding: embedding,
      // payment_conditions stores agent metadata + all photos + vistanet identifiers
      payment_conditions: {
        agent_name: data.Corretor?.Nome ?? null,
        agent_phone: data.Corretor?.Fone ?? null,
        agent_email: data.Corretor?.Email ?? null,
        agent_photo: data.Corretor?.Foto ?? null,
        vistanet_key: params.key,
        vistanet_cod: params.cod,
        vistanet_v2: v2,
        all_photos: fotos,
        description: data.Descricao ?? null,
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
      photos_count: fotos.length,
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
