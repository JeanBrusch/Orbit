import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  try {
    const { leadId, propertyIds } = await req.json()

    if (!leadId || !Array.isArray(propertyIds) || propertyIds.length === 0) {
      return NextResponse.json({ error: 'leadId e propertyIds são obrigatórios' }, { status: 400 })
    }

    const supabase = getSupabaseServer()

    // 1. Buscar lead
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id, name, phone, lid')
      .eq('id', leadId)
      .single()

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 })
    }

    const leadData = lead as any

    // 2. Buscar ou criar client_space — service role bypassa RLS
    const { data: existingSpaces } = await (supabase
      .from('client_spaces') as any)
      .select('id, slug')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(1)

    let useSlug: string

    if (existingSpaces && existingSpaces.length > 0) {
      useSlug = existingSpaces[0].slug
    } else {
      const slug = `${(leadData.name as string).toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}-${Math.random().toString(36).substring(2, 8)}`

      const { data: newSpace, error: spaceError } = await (supabase
        .from('client_spaces') as any)
        .insert([{
          lead_id: leadId,
          slug,
          theme: 'paper',
          theme_config: { mode: 'light', variant: 'paper' },
          title: `Seleção Orbit - ${leadData.name}`
        }])
        .select('id, slug')
        .single()

      if (spaceError || !newSpace) {
        console.error('[API send-selection] space error:', spaceError)
        return NextResponse.json({ error: `Erro ao criar portal: ${spaceError?.message}` }, { status: 500 })
      }

      useSlug = (newSpace as any).slug
    }

    // 3. Inserir em property_interactions (Tabela Principal Agora)
    const interactions = propertyIds.map((pid: string) => ({
      id: crypto.randomUUID(),
      lead_id: leadId,
      property_id: pid,
      interaction_type: 'sent',
      source: 'atlas_selection_creation'
    }))

    const { error: piError } = await (supabase
      .from('property_interactions') as any)
      .insert(interactions)

    if (piError) {
      console.error('[API send-selection] property_interactions error:', piError)
      return NextResponse.json({ error: `Erro ao registrar property_interactions: ${piError.message}` }, { status: 500 })
    }

    // 4. Inserir em capsule_items (Fallback Legado)
    const oldInserts = propertyIds.map((pid: string) => ({
      id: crypto.randomUUID(),
      lead_id: leadId,
      property_id: pid,
      state: 'sent',
    }))

    const { error: itemsError } = await (supabase
      .from('capsule_items') as any)
      .upsert(oldInserts, { onConflict: 'lead_id,property_id' })

    if (itemsError) {
      console.error('[API send-selection] capsule_items fallback error:', itemsError)
      // We don't return 500 here if it's just legacy fallback failing, but we log it
    }

    // 5. Disparar carousel via WhatsApp (fire-and-forget — não bloqueia a resposta)
    ;(async () => {
      try {
        const { data: properties } = await (supabase
          .from('properties') as any)
          .select('id, title, internal_name, cover_image, value, location_text, source_link, bedrooms, suites, parking_spots, area_privativa, area_total, ui_type, internal_code')
          .in('id', propertyIds)

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
        const selectionUrl = `${appUrl}/selection/${useSlug}`

        const { buildPropertyCarousel } = await import('@/lib/build-property-carousel')
        const carousel = buildPropertyCarousel(properties || [], selectionUrl)

        const sendTo = (leadData.lid
          ? (leadData.lid.includes('@lid') ? leadData.lid : `${leadData.lid}@lid`)
          : null
        ) || leadData.phone

        if (sendTo && carousel.length > 0) {
          const { sendCarousel } = await import('@/lib/zapi/client')
          const firstName = (leadData.name as string)?.split(' ')[0] || ''
          await sendCarousel(
            sendTo,
            `${firstName}, separei uma curadoria especial para você! 🏡`,
            carousel
          )
          console.log('[API send-selection] Carousel sent:', carousel.length, 'cards')
        }
      } catch (err: any) {
        console.error('[API send-selection] Carousel send failed:', err.message)
      }
    })()

    return NextResponse.json({ slug: useSlug, lead: leadData })

  } catch (err: any) {
    console.error('[API send-selection] fatal:', err)
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 })
  }
}

