import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const propertyId = searchParams.get('propertyId')

    if (!propertyId) {
      return NextResponse.json({ error: 'propertyId is required' }, { status: 400 })
    }

    const supabase = getSupabaseServer()
    const { data, error } = await supabase
      .from('property_history')
      .select('*')
      .eq('property_id', propertyId)
      .order('event_date', { ascending: false })

    if (error) throw error

    return NextResponse.json({ history: data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { property_id, event_type, description, old_value, new_value, lead_id, metadata } = body

    if (!property_id || !event_type) {
      return NextResponse.json({ error: 'property_id and event_type are required' }, { status: 400 })
    }

    const supabase = getSupabaseServer()
    const { data, error } = await supabase
      .from('property_history')
      .insert({
        property_id,
        event_type,
        event_date: new Date().toISOString(),
        description,
        old_value,
        new_value,
        lead_id,
        metadata
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ event: data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
