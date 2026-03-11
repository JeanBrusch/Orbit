import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    if (!id) {
      return NextResponse.json(
        { error: 'ID do lead é obrigatório' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseServer()
    
    const { data: capsules } = await supabase
      .from('capsules')
      .select('id')
      .eq('lead_id', id)
    
    if (capsules && capsules.length > 0) {
      const capsuleIds = capsules.map(c => c.id)
      await supabase
        .from('capsule_items')
        .delete()
        .in('capsule_id', capsuleIds)
    }
    
    await supabase.from('capsules').delete().eq('lead_id', id)
    await supabase.from('interactions').delete().eq('lead_id', id)
    await supabase.from('internal_notes').delete().eq('lead_id', id)
    await supabase.from('reminders').delete().eq('lead_id', id)
    
    const { error } = await supabase
      .from('leads')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting lead:', error)
      return NextResponse.json(
        { error: 'Erro ao excluir lead' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err) {
    console.error('Error in DELETE /api/lead/[id]:', err)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
