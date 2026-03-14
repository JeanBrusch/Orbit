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
    const { error: rpcError } = await supabase.rpc('mark_lead_as_read_v1', { p_lead_id: leadId })

    if (rpcError) {
      console.log(`[READ API] RPC mark_lead_as_read_v1 not found or failed for lead ${leadId}:`, rpcError.message);
      
      const [r1, r2] = await Promise.all([
        supabase
          .from('leads')
          .update({ last_event_type: null })
          .eq('id', leadId),
        supabase
          .from('leads_center')
          .update({ last_event_type: null })
          .eq('lead_id', leadId)
      ])
      
      console.log(`[READ API] Manual update attempt for lead ${leadId}:`, {
        leads: r1.error ? 'FAILED' : 'OK',
        leads_center: r2.error ? 'FAILED' : 'OK'
      });

      if (r1.error || r2.error) {
        return NextResponse.json({ error: 'Failed' }, { status: 500 })
      }
    } else {
      console.log(`[READ API] RPC mark_lead_as_read_v1 success for lead ${leadId}`);
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Error in POST /api/lead/[id]/read:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
