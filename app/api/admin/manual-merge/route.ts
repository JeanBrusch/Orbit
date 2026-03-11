import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { primaryId, duplicateId, dryRun = true } = body
    
    if (!primaryId || !duplicateId) {
      return NextResponse.json({ 
        error: 'primaryId e duplicateId são obrigatórios' 
      }, { status: 400 })
    }
    
    const supabase = getSupabaseServer()
    
    const { data: primary } = await supabase
      .from('leads')
      .select('*')
      .eq('id', primaryId)
      .single()
    
    const { data: duplicate } = await supabase
      .from('leads')
      .select('*')
      .eq('id', duplicateId)
      .single()
    
    if (!primary || !duplicate) {
      return NextResponse.json({ 
        error: 'Lead não encontrado',
        primary: !!primary,
        duplicate: !!duplicate
      }, { status: 404 })
    }
    
    const { count: primaryInteractions } = await supabase
      .from('interactions')
      .select('id', { count: 'exact', head: true })
      .eq('lead_id', primaryId)
    
    const { count: duplicateInteractions } = await supabase
      .from('interactions')
      .select('id', { count: 'exact', head: true })
      .eq('lead_id', duplicateId)
    
    const { count: duplicateCapsules } = await supabase
      .from('capsules')
      .select('id', { count: 'exact', head: true })
      .eq('lead_id', duplicateId)
    
    const { count: duplicateReminders } = await supabase
      .from('reminders')
      .select('id', { count: 'exact', head: true })
      .eq('lead_id', duplicateId)
    
    const { count: duplicateNotes } = await supabase
      .from('internal_notes')
      .select('id', { count: 'exact', head: true })
      .eq('lead_id', duplicateId)
    
    const summary = {
      primary: {
        id: primary.id,
        name: primary.name,
        phone: primary.phone,
        interactionCount: primaryInteractions || 0
      },
      duplicate: {
        id: duplicate.id,
        name: duplicate.name,
        phone: duplicate.phone,
        interactionCount: duplicateInteractions || 0
      },
      toMove: {
        interactions: duplicateInteractions || 0,
        capsules: duplicateCapsules || 0,
        reminders: duplicateReminders || 0,
        notes: duplicateNotes || 0
      }
    }
    
    if (dryRun) {
      return NextResponse.json({
        status: 'dry_run',
        message: 'Preview do merge. Envie { "dryRun": false } para executar.',
        summary
      })
    }
    
    const { error: intError } = await supabase
      .from('interactions')
      .update({ lead_id: primaryId })
      .eq('lead_id', duplicateId)
    
    if (intError) {
      console.error('Error moving interactions:', intError)
    }
    
    const { error: capError } = await supabase
      .from('capsules')
      .update({ lead_id: primaryId })
      .eq('lead_id', duplicateId)
    
    if (capError) {
      console.error('Error moving capsules:', capError)
    }
    
    const { error: remError } = await supabase
      .from('reminders')
      .update({ lead_id: primaryId })
      .eq('lead_id', duplicateId)
    
    if (remError) {
      console.error('Error moving reminders:', remError)
    }
    
    const { error: noteError } = await supabase
      .from('internal_notes')
      .update({ lead_id: primaryId })
      .eq('lead_id', duplicateId)
    
    if (noteError) {
      console.error('Error moving notes:', noteError)
    }
    
    if (duplicate.photo_url && duplicate.photo_url !== 'null' && (!primary.photo_url || primary.photo_url === 'null')) {
      await supabase
        .from('leads')
        .update({ photo_url: duplicate.photo_url })
        .eq('id', primaryId)
    }
    
    const { error: deleteError } = await supabase
      .from('leads')
      .delete()
      .eq('id', duplicateId)
    
    if (deleteError) {
      console.error('Error deleting duplicate:', deleteError)
      return NextResponse.json({
        status: 'partial',
        message: 'Dados movidos, mas erro ao deletar duplicado',
        error: deleteError.message,
        summary
      })
    }
    
    return NextResponse.json({
      status: 'success',
      message: 'Merge concluído com sucesso!',
      summary
    })
    
  } catch (error: any) {
    console.error('Error in manual-merge:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
