import { NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'
import { resolvePreviewImage } from '@/lib/resolve-preview-image'

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
    
    const { data: property, error: fetchError } = await supabase
      .from('properties')
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

    const { data: existingProperty, error: fetchError } = await supabase
      .from('properties')
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
    
    const updateData = {
      ...otherUpdates,
      ...(newSourceLink && { source_link: newSourceLink }),
      ...(previewWasResolved && { 
        cover_image: coverImageUrl,
        preview_captured_at: new Date().toISOString()
      }),
    }

    const { data: updatedProperty, error: updateError } = await supabase
      .from('properties')
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
