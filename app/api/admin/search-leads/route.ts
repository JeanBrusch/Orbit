import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const name = searchParams.get('name')
    
    const supabase = getSupabaseServer()
    
    let query = supabase
      .from('leads')
      .select('id, name, phone, created_at, state, origin, photo_url')
      .order('created_at', { ascending: true })
    
    if (name) {
      query = query.ilike('name', `%${name}%`)
    }
    
    const { data: leads, error } = await query
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    const leadsWithDetails = await Promise.all(
      (leads || []).map(async (lead) => {
        const { count: interactionCount } = await supabase
          .from('interactions')
          .select('id', { count: 'exact', head: true })
          .eq('lead_id', lead.id)
        
        return {
          ...lead,
          phoneLength: lead.phone?.length || 0,
          phoneDigits: lead.phone?.replace(/\D/g, ''),
          interactionCount: interactionCount || 0
        }
      })
    )
    
    return NextResponse.json({
      status: 'ok',
      count: leadsWithDetails.length,
      leads: leadsWithDetails
    })
    
  } catch (error: any) {
    console.error('Error in search-leads:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
