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
    
    // Perform manual updates to both tables to ensure bypass of RLS and consistent state
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
    
    console.log(`[READ API] Direct update for lead ${leadId}:`, {
      leads: r1.error ? `FAILED: ${r1.error.message}` : 'OK',
      leads_center: r2.error ? `FAILED: ${r2.error.message}` : 'OK'
    });

    if (r1.error || r2.error) {
      return NextResponse.json({ 
        error: 'Failed to update database',
        details: { leads: r1.error?.message, leads_center: r2.error?.message }
      }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Error in POST /api/lead/[id]/read:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
