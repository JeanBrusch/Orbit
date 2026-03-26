import { NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'
import { resolvePreviewImage } from '@/lib/resolve-preview-image'
import { generateEmbedding } from '@/lib/orbit-core'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const supabase = getSupabaseServer()

    const { source_link, ...otherData } = body

    // 1. Inserir primeiro para pegar o ID
    const { data: insertData, error: insertError } = await (supabase.from('properties') as any)
      .insert({
        ...otherData,
        source_link: source_link || null,
        status: 'active'
      })
      .select()
      .single()

    if (insertError || !insertData) {
      console.error('[POST /api/properties] Error creating property:', insertError)
      return NextResponse.json(
        { error: insertError?.message || 'Failed to create property' },
        { status: 500 }
      )
    }

    const newProperty = insertData as any
    const propertyId = newProperty.id
    let updates: any = {}

    // 2. Resolver imagem de preview se houver link
    if (source_link) {
      console.log('[POST /api/properties] Resolving preview image for:', source_link)
      const resolvedImage = await resolvePreviewImage(source_link, propertyId)
      if (resolvedImage) {
        updates.cover_image = resolvedImage
        updates.preview_captured_at = new Date().toISOString()
      }
    }

    // 3. Gerar embedding
    const cleanFeatures = typeof newProperty.features === 'string' 
      ? newProperty.features 
      : (newProperty.features || []).join(", ")

    const pCond = newProperty.payment_conditions || {}
    let financialContext = ""
    if (newProperty.value) financialContext += `Valor: R$ ${newProperty.value}. `
    
    let locationContext = ""
    if (newProperty.neighborhood) locationContext += `No bairro ${newProperty.neighborhood}`
    if (newProperty.city) locationContext += `, em ${newProperty.city}. `
    
    let structuralContext = ""
    if (newProperty.bedrooms) structuralContext += `${newProperty.bedrooms} quartos `
    if (newProperty.area_privativa) structuralContext += `${newProperty.area_privativa}m². `

    const embeddingText = `
      ${newProperty.title || newProperty.internal_name || ""}
      ${locationContext}
      ${structuralContext}
      Amenidades: ${cleanFeatures}
      Descrição: ${newProperty.description || ""}
      Notas Internas: ${newProperty.internal_notes || ""}
      ${financialContext}
    `.replace(/\s+/g, ' ').trim()

    try {
      const embedding = await generateEmbedding(embeddingText)
      if (embedding) {
        updates.property_embedding = embedding
      }
    } catch (embErr) {
      console.error('[POST /api/properties] Error generating embedding:', embErr)
    }

    // 4. Aplicar updates (image + embedding)
    if (Object.keys(updates).length > 0) {
      await (supabase.from('properties') as any)
        .update(updates)
        .eq('id', propertyId)
    }

    return NextResponse.json({ 
      success: true, 
      property: { ...newProperty, ...updates }
    })

  } catch (err) {
    console.error('Error in POST /api/properties:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
