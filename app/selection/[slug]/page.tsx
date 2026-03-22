import { notFound } from 'next/navigation'
import { Home, ExternalLink, MapPin, MessageSquare, Star, Sparkles, Map as MapIcon, Grid } from 'lucide-react'
import { getSupabaseServer } from '@/lib/supabase-server'
import { Metadata } from 'next'
import ClientSelectionView from '@/components/orbit-selection/ClientSelectionView'

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

  // 3. Get Active Items from new Property Interactions table (replaces capsule_items)
  const { data: capsuleItems } = await (supabase
    .from('property_interactions') as any)
    .select(`
      id,
      timestamp,
      property_id,
      properties:property_id (
        id,
        title,
        internal_name,
        source_link,
        cover_image,
        location_text,
        value,
        lat,
        lng,
        bedrooms,
        suites,
        area_privativa
      )
    `)
    .eq('lead_id', leadId)
    .eq('interaction_type', 'sent')
    .order('timestamp', { ascending: false })

  // 4. Get Contextual Data (Notes/Videos)
  const { data: contexts } = await (supabase
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

  const items = (capsuleItems || [])
    .map((item: any) => {
      const prop = item.properties as any || {}
      const ctx = contextMap.get(item.property_id) as any
      return {
        id: prop.id || item.property_id,
        capsuleItemId: item.id, // For interaction tracking
        title: prop.title || prop.internal_name || "Imóvel Desconhecido (Falha no Join)",
        price: prop.value || 0,
        location: prop.location_text || "",
        coverImage: prop.cover_image || "",
        url: prop.source_link || "",
        lat: prop.lat || 0,
        lng: prop.lng || 0,
        note: ctx?.note,
        videoUrl: ctx?.video_url,
        audioUrl: ctx?.audio_url,
        highlightLevel: ctx?.highlight_level || 0,
        recommendedReason: ctx?.recommended_reason,
        bedrooms: prop.bedrooms,
        suites: prop.suites,
        areaPrivativa: prop.area_privativa,
        _debugRow: item
      }
    })

  // Normalize lead — Supabase returns object or array depending on relation
  const leadRaw = space.leads
  const lead = Array.isArray(leadRaw) ? leadRaw[0] : leadRaw

  console.log(`[DEBUG SELECTION] slug=${slug} capsuleItems count:`, capsuleItems?.length, "first item:", capsuleItems?.[0])

  return {
    space,
    lead: lead ? { ...lead, id: lead.id ?? leadId } : { id: leadId, name: null, photo_url: null },
    preferences: prefs,
    items,
    initialInteractions
  }
}

export default async function SelectionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const data = await getSelectionData(slug)

  if (!data) notFound()

  return <ClientSelectionView data={data} slug={slug} />
}
