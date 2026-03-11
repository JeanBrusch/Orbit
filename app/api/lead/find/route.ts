import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'
import { normalizePhone } from '@/lib/zapi/phone-normalizer'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const phone = searchParams.get('phone')

    if (!phone) {
      return NextResponse.json(
        { error: 'phone é obrigatório' },
        { status: 400 }
      )
    }

    const normalized = normalizePhone(phone)
    const supabase = getSupabaseServer()
    
    const { data, error } = await supabase
      .from('leads')
      .select('id, name, phone, origin, created_at')
      .eq('phone', normalized)
      .single()

    if (error && error.code !== 'PGRST116') {
      throw error
    }

    if (!data) {
      return NextResponse.json({ exists: false, lead: null })
    }

    return NextResponse.json({ exists: true, lead: data })
  } catch (error: any) {
    console.error('Error finding lead by phone:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
