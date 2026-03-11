import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { generateLeadToken } from '@/lib/lead-token'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('orbit_session')?.value
    
    if (!sessionToken) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    const { id } = await params
    
    if (!id) {
      return NextResponse.json(
        { error: 'Lead ID is required' },
        { status: 400 }
      )
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    const { data: lead } = await supabase
      .from('leads')
      .select('id, public_token')
      .eq('id', id)
      .single()
    
    if (!lead) {
      return NextResponse.json(
        { error: 'Lead not found' },
        { status: 404 }
      )
    }
    
    let token = lead.public_token
    
    if (!token) {
      token = generateLeadToken(id)
      
      await supabase
        .from('leads')
        .update({ public_token: token })
        .eq('id', id)
    }
    
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
      (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : '')
    
    const capsuleUrl = `${baseUrl}/l/${token}`
    
    return NextResponse.json({ 
      token,
      url: capsuleUrl
    })
  } catch (error) {
    console.error('[GET /api/lead/[id]/capsule-link] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
