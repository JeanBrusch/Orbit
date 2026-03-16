
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leadId } = await params
    if (!leadId) {
      return NextResponse.json({ error: 'leadId is required' }, { status: 400 })
    }

    const supabase = getSupabaseServer()

    const { error } = await supabase
      .from('leads')
      .update({ last_event_type: null } as any)
      .eq('id', leadId)

    if (error) {
      console.error(`[READ API] Failed for lead ${leadId}:`, error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log(`[READ API] lead ${leadId} marked as read OK`)
    return NextResponse.json({ success: true, leadId })

  } catch (err) {
    console.error('Error in POST /api/lead/[id]/read:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}