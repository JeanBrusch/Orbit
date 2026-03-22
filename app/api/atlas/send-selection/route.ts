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

    // 3. Upsert capsule_items — sem espaço no onConflict
    const inserts = propertyIds.map((pid: string) => ({
      lead_id: leadId,
      property_id: pid,
      state: 'sent',
    }))

    const { data: upsertData, error: itemsError } = await (supabase
      .from('capsule_items') as any)
      .upsert(inserts, { onConflict: 'lead_id,property_id' })
      .select()

    if (itemsError) {
      console.error('[API send-selection] capsule_items error:', itemsError)
      return NextResponse.json({ error: `Erro ao registrar imóveis: ${itemsError.message}` }, { status: 500 })
    }

    // 4. Salvar também em property_interactions (nova estrutura)
    try {
      const pInteractions = propertyIds.map((pid: string) => ({
        lead_id: leadId,
        property_id: pid,
        interaction_type: 'sent',
        source: 'atlas_selection_creation'
      }))
      await (supabase.from('property_interactions') as any).insert(pInteractions)
    } catch (e) {
      console.error('[API send-selection] aviso: não foi possivel salvar property_interactions', e)
    }

    return NextResponse.json({ slug: useSlug, lead: leadData, debug_upserted: upsertData || [] })
  } catch (err: any) {
    console.error('[API send-selection] fatal:', err)
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 })
  }
}
