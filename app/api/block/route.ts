import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { leadId } = body

    if (!leadId) {
      return NextResponse.json(
        { error: 'leadId é obrigatório' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseServer()
    const { error } = await supabase
      .from('leads')
      .update({ state: 'blocked' })
      .eq('id', leadId)

    if (error) {
      throw new Error(`Failed to block lead: ${error.message}`)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error blocking lead:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
