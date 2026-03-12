import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Home, ExternalLink, MapPin } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'
import { verifyLeadToken } from '@/lib/lead-token'

export const metadata: Metadata = {
  title: 'Imóveis Selecionados',
  robots: {
    index: false,
    follow: false,
  },
}

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

async function getCapsuleData(token: string): Promise<PublicLeadCapsule | null> {
  try {
    if (!token || token.length < 16) {
      console.error('[getCapsuleData] Invalid token length')
      return null
    }
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('[getCapsuleData] Missing Supabase environment variables')
      return null
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('id, name')
      .eq('public_token', token)
      .limit(1)
    
    if (leadsError) {
      console.error('[getCapsuleData] Error fetching leads by public_token:', leadsError)
      return null
    }
    
    let matchingLead: { id: any; name: any } | undefined = leads?.[0]
    
    if (!matchingLead) {
      console.log('[getCapsuleData] No lead found by public_token, trying fallback verification')
      const { data: allLeads, error: allLeadsError } = await supabase
        .from('leads')
        .select('id, name')
        .limit(100)
      
      if (allLeadsError) {
        console.error('[getCapsuleData] Error in fallback query:', allLeadsError)
        return null
      }
      
      matchingLead = allLeads?.find(lead => verifyLeadToken(token, lead.id))
      
      if (matchingLead) {
        console.log('[getCapsuleData] Lead found via fallback verification:', matchingLead.id)
      }
    }
    
    if (!matchingLead) {
      return null
    }
    
    const { data: capsules, error: capsulesError } = await supabase
      .from('capsules')
      .select('id')
      .eq('lead_id', matchingLead.id)
      .order('started_at', { ascending: false })
      .limit(1)
    
    if (capsulesError) {
      console.error('[getCapsuleData] Error fetching capsules:', capsulesError)
      return null
    }
    
    if (!capsules || capsules.length === 0) {
      console.log('[getCapsuleData] No capsules found for lead:', matchingLead.id)
      return {
        leadName: matchingLead.name,
        items: []
      }
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
      console.error('[getCapsuleData] Error fetching capsule items:', itemsError)
      return null
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
    
    return {
      leadName: matchingLead.name,
      items
    }
  } catch (error) {
    console.error('[getCapsuleData] Error:', error)
    return null
  }
}

function formatPrice(value: number | null): string {
  if (!value) return ''
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value)
}

function PropertyCard({ item }: { item: PublicPropertyCard }) {
  return (
    <a
      href={item.externalUrl || '#'}
      target="_blank"
      rel="noopener noreferrer"
      className="block bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden hover:bg-white/10 transition-colors"
    >
      {item.coverImageUrl ? (
        <div className="relative h-48 bg-neutral-900">
          <img
            src={item.coverImageUrl}
            alt={item.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      ) : (
        <div className="h-48 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center">
          <Home className="w-12 h-12 text-white/30" />
        </div>
      )}
      
      <div className="p-4 space-y-2">
        <h3 className="font-semibold text-white text-lg leading-tight">
          {item.title}
        </h3>
        
        {item.location && (
          <div className="flex items-center gap-1.5 text-white/60 text-sm">
            <MapPin className="w-4 h-4 flex-shrink-0" />
            <span>{item.location}</span>
          </div>
        )}
        
        {item.price && (
          <div className="text-indigo-400 font-semibold">
            {formatPrice(item.price)}
          </div>
        )}
        
        <div className="flex items-center gap-1.5 text-indigo-400 text-sm font-medium pt-2">
          <span>Ver detalhes</span>
          <ExternalLink className="w-4 h-4" />
        </div>
      </div>
    </a>
  )
}

export default async function PublicCapsulePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const data = await getCapsuleData(token)
  
  if (!data) {
    notFound()
  }
  
  const firstName = data.leadName?.split(' ')[0] || 'Cliente'
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-950 to-neutral-900">
      <header className="sticky top-0 z-10 bg-neutral-950/80 backdrop-blur-lg border-b border-white/5">
        <div className="max-w-lg mx-auto px-4 py-4">
          <h1 className="text-xl font-semibold text-white text-center">
            Imóveis para {firstName}
          </h1>
        </div>
      </header>
      
      <main className="max-w-lg mx-auto px-4 py-6">
        {data.items.length === 0 ? (
          <div className="text-center py-12">
            <Home className="w-16 h-16 text-white/20 mx-auto mb-4" />
            <p className="text-white/50">
              Nenhum imóvel selecionado ainda.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-white/60 text-sm text-center mb-6">
              {data.items.length} {data.items.length === 1 ? 'imóvel selecionado' : 'imóveis selecionados'}
            </p>
            
            {data.items.map((item) => (
              <PropertyCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </main>
      
      <footer className="border-t border-white/5 mt-8">
        <div className="max-w-lg mx-auto px-4 py-6">
          <div className="text-center">
            <p className="text-white/40 text-sm">
              Selecionado especialmente para você
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
