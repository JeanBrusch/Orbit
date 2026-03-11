import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyLeadToken } from '@/lib/lead-token'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

interface PublicPropertyCard {
  id: string
  title: string
  externalUrl: string | null
  coverImageUrl: string | null
  location: string | null
  price: number | null
  sentAt: string | null
}

interface PublicLeadCapsule {
  leadName: string | null
  items: PublicPropertyCard[]
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    
    if (!token || token.length < 16) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { 
          status: 400,
          headers: { 'X-Robots-Tag': 'noindex' }
        }
      )
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('id, name, public_token')
      .eq('public_token', token)
      .limit(1)
    
    if (leadsError) {
      console.error('[GET /api/public/lead] Error fetching leads by public_token:', leadsError)
      return NextResponse.json(
        { error: 'Internal error' },
        { 
          status: 500,
          headers: { 'X-Robots-Tag': 'noindex' }
        }
      )
    }
    
    let matchingLead = leads?.[0]
    
    if (!matchingLead) {
      const { data: allLeads, error: allLeadsError } = await supabase
        .from('leads')
        .select('id, name')
        .limit(100)
      
      if (allLeadsError) {
        console.error('[GET /api/public/lead] Error in fallback query:', allLeadsError)
        return NextResponse.json(
          { error: 'Internal error' },
          { 
            status: 500,
            headers: { 'X-Robots-Tag': 'noindex' }
          }
        )
      }
      
      matchingLead = allLeads?.find(lead => verifyLeadToken(token, lead.id))
    }
    
    if (!matchingLead) {
      return NextResponse.json(
        { error: 'Capsule not found' },
        { 
          status: 404,
          headers: { 'X-Robots-Tag': 'noindex' }
        }
      )
    }
    
    const { data: capsules, error: capsulesError } = await supabase
      .from('capsules')
      .select('id')
      .eq('lead_id', matchingLead.id)
      .order('started_at', { ascending: false })
      .limit(1)
    
    if (capsulesError || !capsules || capsules.length === 0) {
      return NextResponse.json<PublicLeadCapsule>({
        leadName: matchingLead.name,
        items: []
      }, {
        headers: { 'X-Robots-Tag': 'noindex' }
      })
    }
    
    const capsuleId = capsules[0].id
    
    const { data: capsuleItems, error: itemsError } = await supabase
      .from('capsule_items')
      .select(`
        id,
        created_at,
        properties:property_id (
          id,
          title,
          internal_name,
          source_link,
          cover_image,
          location_text,
          value
        )
      `)
      .eq('capsule_id', capsuleId)
      .not('property_id', 'is', null)
      .is('type', null) // STRICT: only property items, never notes
      .neq('state', 'discarded')
      .order('created_at', { ascending: true })
    
    if (itemsError) {
      console.error('[GET /api/public/lead] Error fetching capsule items:', itemsError)
      return NextResponse.json(
        { error: 'Internal error' },
        { 
          status: 500,
          headers: { 'X-Robots-Tag': 'noindex' }
        }
      )
    }
    
    const items: PublicPropertyCard[] = (capsuleItems || [])
      .filter(item => item.properties)
      .map(item => {
        const prop = item.properties as any
        return {
          id: item.id,
          title: prop.title || prop.internal_name || 'Imóvel',
          externalUrl: prop.source_link,
          coverImageUrl: prop.cover_image,
          location: prop.location_text,
          price: prop.value,
          sentAt: item.created_at
        }
      })
    
    const response: PublicLeadCapsule = {
      leadName: matchingLead.name,
      items
    }
    
    return NextResponse.json(response, {
      headers: {
        'X-Robots-Tag': 'noindex',
        'Cache-Control': 'private, no-cache, no-store, must-revalidate'
      }
    })
  } catch (error) {
    console.error('[GET /api/public/lead] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { 
        status: 500,
        headers: { 'X-Robots-Tag': 'noindex' }
      }
    )
  }
}
