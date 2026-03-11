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
    
    const { data: lead } = await supabase
      .from('leads')
      .select('action_suggested')
      .eq('id', leadId)
      .maybeSingle()
    
    if (lead?.action_suggested === 'needs_attention') {
      const { error } = await supabase
        .from('leads')
        .update({ action_suggested: null })
        .eq('id', leadId)

      if (error) {
        throw new Error(`Failed to clear attention: ${error.message}`)
      }
      
      console.log('Cleared needs_attention for lead:', leadId)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error clearing attention:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
