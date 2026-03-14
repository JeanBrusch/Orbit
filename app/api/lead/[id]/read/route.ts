import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const leadId = params.id
    if (!leadId) {
      return NextResponse.json({ error: 'leadId is required' }, { status: 400 })
    }

    const supabase = getSupabaseServer()
    
    // Clear last_event_type in both tables
    const { error } = await supabase.rpc('mark_lead_as_read_v1', { p_lead_id: leadId })

    // Fallback if RPC doesn't exist yet, or just use direct updates
    if (error) {
      console.log('RPC mark_lead_as_read_v1 not found, using direct updates');
      const [r1, r2] = await Promise.all([
        supabase
          .from('leads')
          .update({ last_event_type: null })
          .eq('id', leadId)
          .eq('last_event_type', 'received'),
        supabase
          .from('leads_center')
          .update({ last_event_type: null })
          .eq('lead_id', leadId)
          .eq('last_event_type', 'received')
      ])
      
      if (r1.error || r2.error) {
        console.error('Error marking lead as read (direct):', r1.error || r2.error)
        return NextResponse.json({ error: 'Failed' }, { status: 500 })
      }
    }

    if (error) {
      console.error('Error marking lead as read:', error)
      return NextResponse.json({ error: 'Failed to mark lead as read' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Error in POST /api/lead/[id]/read:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
