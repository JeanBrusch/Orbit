import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'

export async function PUT(request: NextRequest) {
  try {
    const { leadId, visualState } = await request.json()

    if (!leadId) {
      return NextResponse.json({ error: 'leadId is required' }, { status: 400 })
    }

    const supabase = getSupabaseServer()
    
    const { error } = await supabase
      .from('leads')
      .update({ orbit_visual_state: visualState })
      .eq('id', leadId)

    if (error) {
      console.error('Error updating visual state:', error)
      return NextResponse.json({ error: 'Failed to update visual state' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Error in PUT /api/lead/visual-state:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
