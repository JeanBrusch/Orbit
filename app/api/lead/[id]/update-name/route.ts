import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })
    }

    const body = await request.json()
    const name = (body.name || '').trim()

    if (!name) {
      return NextResponse.json({ error: 'Nome não pode ser vazio' }, { status: 422 })
    }

    const supabase = getSupabaseServer()
    const { error } = await (supabase
      .from('leads') as any)
      .update({ name })
      .eq('id', id)

    if (error) {
      console.error('[UPDATE_NAME]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, name })
  } catch (err: any) {
    console.error('[UPDATE_NAME] Error:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
