import { getSupabaseServer } from "@/lib/supabase-server"
import { NextRequest, NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { lat, lng } = body

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return NextResponse.json(
        { error: 'lat and lng must be numbers' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseServer() as any
    
    const { data, error } = await supabase
      .from('properties')
      .update({
        lat,
        lng,
        location_status: 'manual'
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating property location:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, property: data })
  } catch (err) {
    console.error('Error in PATCH /api/properties/[id]/location:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
