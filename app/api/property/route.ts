import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'
import { generateEmbedding } from '@/lib/orbit-core'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      title, 
      coverImage, 
      sourceLink, 
      sourceDomain,
      neighborhood,
      city,
      area_privativa,
      bedrooms,
      suites,
      parking_spots,
      payment_conditions,
      condo_fee,
      iptu,
      features,
      value,
      internal_notes
    } = body
    
    if (!sourceLink) {
      return NextResponse.json({ error: 'source_link is required' }, { status: 400 })
    }

    // Gerar string descritiva para o Embedding Semântico
    const cleanFeatures = (features || []).join(", ")
    const pCond = payment_conditions || {}
    let financialContext = ""
    if (value) financialContext += `Valor: R$ ${value}. `
    if (pCond.financing) financialContext += `Aceita Financiamento. `
    if (pCond.exchange) financialContext += `Estuda Permuta. `
    
    let locationContext = ""
    if (neighborhood) locationContext += `No bairro ${neighborhood}`
    if (city) locationContext += `, em ${city}. `
    
    let structuralContext = ""
    if (bedrooms) structuralContext += `${bedrooms} quartos `
    if (suites) structuralContext += `(${suites} suítes). `
    if (area_privativa) structuralContext += `${area_privativa}m². `

    const embeddingText = `
      ${title || ""}
      ${locationContext}
      ${structuralContext}
      Amenidades: ${cleanFeatures}
      Notas Internas: ${internal_notes || ""}
      ${financialContext}
    `.replace(/\s+/g, ' ').trim()

    // Chamar Gemini-Core para gerar a assinatura do imóvel
    const property_embedding = await generateEmbedding(embeddingText)

    const supabase = getSupabaseServer()
    
    const { data, error } = await (supabase.from('properties') as any)
      .insert({
        source_link: sourceLink,
        internal_name: title || sourceDomain || 'Imóvel sem título',
        title: title || null,
        cover_image: coverImage || null,
        source_domain: sourceDomain || null,
        ingestion_type: 'assisted',
        ingestion_status: 'confirmed',
        neighborhood: neighborhood || null,
        city: city || null,
        area_privativa: area_privativa || null,
        bedrooms: bedrooms || null,
        suites: suites || null,
        parking_spots: parking_spots || null,
        payment_conditions: payment_conditions || null,
        condo_fee: condo_fee || null,
        iptu: iptu || null,
        features: features || [],
        value: value || null,
        internal_notes: internal_notes || null,
        property_embedding: property_embedding || null
      })
      .select()
      .single()

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ property: data })
    
  } catch (error) {
    console.error('Property creation error:', error)
    return NextResponse.json(
      { error: 'Failed to create property' },
      { status: 500 }
    )
  }
}
