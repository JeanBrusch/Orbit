import { notFound } from 'next/navigation'
import { Home, ExternalLink, MapPin, MessageSquare, Star, Sparkles, Map as MapIcon, Grid } from 'lucide-react'
import { getSupabaseServer } from '@/lib/supabase-server'
import { Metadata } from 'next'
import ClientSelectionView from '@/components/orbit-selection/ClientSelectionViewV2'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const supabase = getSupabaseServer()
  const { data: space } = await supabase
    .from('client_spaces')
    .select('*, leads(name)')
    .eq('slug', slug)
    .single()

  const leadName = (space as any)?.leads?.name || 'Cliente'
  const title = `Seleção Exclusiva para ${leadName} — Jean Brusch`
  const description = 'Curadoria imobiliária personalizada com foco no seu perfil e objetivos.'

  return {
    title,
    description,
    viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      images: [{ url: '/og-luxury-selection.png', width: 1200, height: 630, alt: 'Seleção Jean Brusch' }],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['/og-luxury-selection.png'],
    }
  }
}

async function getSelectionData(slug: string) {
  const supabase = getSupabaseServer()

  // 1. Get Client Space
  const { data: space, error: spaceError } = await (supabase
    .from('client_spaces') as any)
    .select('*, leads(id, name, photo_url)')
    .eq('slug', slug)
    .single()

  if (spaceError || !space) return null

  const leadId = space.lead_id

  // 2. Get Lead Preferences (Insight Bar)
  const { data: prefs } = await (supabase
    .from('lead_preferences') as any)
    .select('*')
    .eq('lead_id', leadId)
    .single()

  // 3. Get Items from property_interactions (Source of Truth for Sent Properties)
  const { data: sentItems, error: sentError } = await (supabase
    .from('property_interactions') as any)
    .select(`
      id,
      interaction_type,
      property_id,
      properties (
        id,
        title,
        internal_name,
        value,
        location_text,
        cover_image,
        photos,
        source_link,
        lat,
        lng,
        bedrooms,
        suites,
        area_privativa,
        area_total
      )
    `)
    .eq('lead_id', leadId)
    .eq('interaction_type', 'sent')
    .order('timestamp', { ascending: false })

  if (sentError) {
    console.error("[DEBUG SELECTION] Error fetching sentItems:", sentError)
  }

  // 4. Get Contextual Data (Notes/Videos)
  const { data: contexts, error: contextsError } = await (supabase
    .from('client_property_context') as any)
    .select('*')
    .eq('client_space_id', space.id)

    // 5. Get Historical Interactions for Persistence
  const { data: interactionsRaw } = await (supabase
    .from('property_interactions') as any)
    .select('property_id, interaction_type')
    .eq('lead_id', leadId)

  const initialInteractions: Record<string, string[]> = {}
  if (interactionsRaw) {
    interactionsRaw.forEach((int: any) => {
      if (!initialInteractions[int.property_id]) {
        initialInteractions[int.property_id] = []
      }
      if (!initialInteractions[int.property_id].includes(int.interaction_type)) {
        initialInteractions[int.property_id].push(int.interaction_type)
      }
    })
  }

  const contextMap = new Map((contexts || []).map((c: any) => [c.property_id, c]))
 
  const items = (sentItems || [])
    .map((item: any) => {
      const propRaw = item.properties
      const prop = (Array.isArray(propRaw) ? propRaw[0] : propRaw) || {}
      const ctx = contextMap.get(item.property_id) as any
      
      // Transform photos to { url, alt }
      const photosArray = Array.isArray(prop.photos) ? prop.photos : []
      const photos = photosArray.map((url: string, idx: number) => ({
        url,
        alt: `${prop.title || 'Imóvel'} - Foto ${idx + 1}`
      }))

      return {
        id: prop.id || item.property_id,
        title: prop.title || prop.internal_name || "Imóvel Desconhecido",
        price: prop.value || 0,
        bedrooms: prop.bedrooms || 0,
        bathrooms: prop.suites || 0, // Fallback suites as bathrooms
        area: prop.area_privativa || prop.area_total || 0,
        location: prop.location_text || "",
        note: ctx?.note,
        videoUrl: ctx?.video_url,
        url: prop.source_link || "",
        coverImage: prop.cover_image || "",
        photos: photos.length > 0 ? photos : [{ url: prop.cover_image, alt: 'Capa' }],
        recommendedReason: ctx?.recommended_reason,
        _debugRow: item
      }
    })

  const leadRaw = (space as any).leads
  const lead = (Array.isArray(leadRaw) ? leadRaw[0] : leadRaw) || { id: leadId, name: 'Cliente' }
  const firstName = lead?.name?.split(' ')[0] || 'Visitante'

  return {
    space,
    lead: { ...lead, id: lead.id ?? leadId, firstName },
    preferences: prefs,
    items,
    initialInteractions: {
      favorited: Array.from(new Set((interactionsRaw || []).filter((i: any) => i.interaction_type === 'liked').map((i: any) => String(i.property_id)))),
      discarded: Array.from(new Set((interactionsRaw || []).filter((i: any) => i.interaction_type === 'disliked').map((i: any) => String(i.property_id)))),
      viewed: Array.from(new Set((interactionsRaw || []).filter((i: any) => i.interaction_type === 'viewed').map((i: any) => String(i.property_id))))
    }
  }
}

export default async function SelectionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const data = await getSelectionData(slug)

  if (!data) notFound()

  return <ClientSelectionView data={data as any} slug={slug} />
}
