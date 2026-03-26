import { NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'
import { resolvePreviewImage } from '@/lib/resolve-preview-image'
import { generateEmbedding } from '@/lib/orbit-core'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json(
        { error: 'Property ID is required' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseServer()
    
    const { data: property, error: fetchError } = await (supabase.from('properties') as any)
      .select('id, title, internal_name')
      .eq('id', id)
      .single()

    console.log('[DELETE] Fetch result:', { property, fetchError })

    if (fetchError || !property) {
      console.error('[DELETE] Property not found:', id, fetchError)
      return NextResponse.json(
        { error: 'Property not found', details: fetchError?.message },
        { status: 404 }
      )
    }
    
    const propertyName = property.title || property.internal_name || 'Imóvel'

    // 1. Delete property interactions
    const { error: deleteInteractionsError } = await supabase
      .from('property_interactions')
      .delete()
      .eq('property_id', id)

    if (deleteInteractionsError) {
      console.error('Error deleting property interactions:', deleteInteractionsError)
      return NextResponse.json({ error: 'Failed to delete property interactions', details: deleteInteractionsError.message }, { status: 500 })
    }

    // 2. Delete capsule items
    const { error: deleteItemsError } = await supabase
      .from('capsule_items')
      .delete()
      .eq('property_id', id)

    if (deleteItemsError) {
      console.error('Error deleting capsule items:', deleteItemsError)
      return NextResponse.json({ error: 'Failed to delete capsule items', details: deleteItemsError.message }, { status: 500 })
    }

    // 3. Delete embeddings
    const { error: deleteEmbeddingsError } = await supabase
      .from('capsule_embeddings')
      .delete()
      .eq('capsule_item_id', id)

    if (deleteEmbeddingsError) {
      console.error('Error deleting embeddings:', deleteEmbeddingsError)
      return NextResponse.json({ error: 'Failed to delete embeddings', details: deleteEmbeddingsError.message }, { status: 500 })
    }

    const { error: deleteError } = await supabase
      .from('properties')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('Error deleting property:', deleteError)
      return NextResponse.json(
        { error: deleteError.message },
        { status: 500 }
      )
    }

    console.log('[DELETE] Property deleted successfully:', id)
    return NextResponse.json({ 
      success: true, 
      message: `Property "${propertyName}" deleted successfully` 
    })
  } catch (err) {
    console.error('Error in DELETE /api/properties/[id]:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    if (!id) {
      return NextResponse.json(
        { error: 'Property ID is required' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseServer()

    const { data: existingProperty, error: fetchError } = await (supabase.from('properties') as any)
      .select('id, source_link, cover_image')
      .eq('id', id)
      .single()

    if (fetchError || !existingProperty) {
      return NextResponse.json(
        { error: 'Property not found' },
        { status: 404 }
      )
    }

    const { source_link: newSourceLink, ...otherUpdates } = body

    let coverImageUrl = existingProperty.cover_image
    const shouldResolvePreview = 
      newSourceLink && 
      newSourceLink !== existingProperty.source_link

    if (shouldResolvePreview) {
      console.log('[PUT /api/properties] source_link changed, resolving preview...')
      const resolvedImage = await resolvePreviewImage(newSourceLink, id)
      if (resolvedImage) {
        coverImageUrl = resolvedImage
        console.log('[PUT /api/properties] Preview resolved:', resolvedImage)
      }
    }

    const previewWasResolved = coverImageUrl !== existingProperty.cover_image

    // Regenerate Embedding if core structural or descriptive fields are being updated
    let newEmbedding = undefined
    const triggersEmbeddingRegen = [
      'title', 'neighborhood', 'city', 'area_privativa', 'bedrooms', 
      'suites', 'features', 'description', 'value', 'payment_conditions', 'internal_notes'
    ].some(key => Object.keys(otherUpdates).includes(key))

    if (triggersEmbeddingRegen) {
      console.log('[PUT /api/properties] Regenerating embedding due to field updates...')
      
      // We need the merged data of existing + updates to generate a full context
      const { data: fullProp } = await (supabase.from('properties') as any).select('*').eq('id', id).single()
      const merged = { ...fullProp, ...otherUpdates }

      const cleanFeatures = typeof merged.features === 'string' 
        ? merged.features 
        : (merged.features || []).join(", ")

      const pCond = merged.payment_conditions || {}
      let financialContext = ""
      if (merged.value) financialContext += `Valor: R$ ${merged.value}. `
      if (pCond.financing) financialContext += `Aceita Financiamento. `
      if (pCond.exchange) financialContext += `Estuda Permuta. `
      
      let locationContext = ""
      if (merged.neighborhood) locationContext += `No bairro ${merged.neighborhood}`
      if (merged.city) locationContext += `, em ${merged.city}. `
      
      let structuralContext = ""
      if (merged.bedrooms) structuralContext += `${merged.bedrooms} quartos `
      if (merged.suites) structuralContext += `(${merged.suites} suítes). `
      if (merged.area_privativa) structuralContext += `${merged.area_privativa}m². `

      const embeddingText = `
        ${merged.title || merged.internal_name || ""}
        ${locationContext}
        ${structuralContext}
        Amenidades: ${cleanFeatures}
        Descrição: ${merged.description || ""}
        Notas Internas: ${merged.internal_notes || ""}
        ${financialContext}
      `.replace(/\s+/g, ' ').trim()

      try {
        newEmbedding = await generateEmbedding(embeddingText)
      } catch (embErr) {
        console.error('[PUT /api/properties] Error generating new embedding:', embErr)
      }
    }
    
    // Parse features to array if it's sent as comma-separated string from the Modal
    if (typeof otherUpdates.features === 'string') {
      otherUpdates.features = otherUpdates.features.split(',').map((f: string) => f.trim()).filter(Boolean)
    }

    const updateData = {
      ...otherUpdates,
      ...(newSourceLink && { source_link: newSourceLink }),
      ...(previewWasResolved && { 
        cover_image: coverImageUrl,
        preview_captured_at: new Date().toISOString()
      }),
      ...(newEmbedding && { property_embedding: newEmbedding }),
    }

    const { data: updatedProperty, error: updateError } = await (supabase.from('properties') as any)
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating property:', updateError)
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      success: true, 
      property: updatedProperty,
      previewResolved: shouldResolvePreview && !!coverImageUrl
    })
  } catch (err) {
    console.error('Error in PUT /api/properties/[id]:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
