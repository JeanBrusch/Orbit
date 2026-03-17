import { notFound } from 'next/navigation'
import { Home, ExternalLink, MapPin, MessageSquare, Star, Sparkles, Map as MapIcon, Grid } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'
import { Metadata } from 'next'
import ClientSelectionView from '@/components/orbit-selection/ClientSelectionView'

export const metadata: Metadata = {
  title: 'Orbit Selection',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
  robots: { index: false, follow: false }
}

async function getSelectionData(slug: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const supabase = createClient(supabaseUrl, supabaseKey)

  // 1. Get Client Space
  const { data: space, error: spaceError } = await supabase
    .from('client_spaces')
    .select('*, leads(id, name, photo_url)')
    .eq('slug', slug)
    .single()

  if (spaceError || !space) return null

  const leadId = space.lead_id

  // 2. Get Lead Preferences (Insight Bar)
  const { data: prefs } = await supabase
    .from('lead_preferences')
    .select('*')
    .eq('lead_id', leadId)
    .single()

  // 3. Get Active Capsule Items
  const { data: capsuleItems } = await supabase
    .from('capsule_items')
    .select(`
      id,
      created_at,
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
        lng
      )
    `)
    .eq('lead_id', leadId) // Assuming capsule_items are linked directly or via active capsule
    .neq('state', 'discarded')
    .order('created_at', { ascending: false })

  // 4. Get Contextual Data (Notes/Videos)
  const { data: contexts } = await supabase
    .from('client_property_context')
    .select('*')
    .eq('client_space_id', space.id)

  const contextMap = new Map((contexts || []).map(c => [c.property_id, c]))

  const items = (capsuleItems || [])
    .filter(item => item.properties)
    .map(item => {
      const prop = item.properties as any
      const ctx = contextMap.get(prop.id)
      return {
        id: prop.id,
        capsuleItemId: item.id,
        title: prop.title || prop.internal_name,
        price: prop.value,
        location: prop.location_text,
        coverImage: prop.cover_image,
        url: prop.source_link,
        lat: prop.lat,
        lng: prop.lng,
        note: ctx?.note,
        videoUrl: ctx?.video_url,
        audioUrl: ctx?.audio_url,
        highlightLevel: ctx?.highlight_level || 0,
        recommendedReason: ctx?.recommended_reason
      }
    })

  // Normalize lead — Supabase returns object or array depending on relation
  const leadRaw = space.leads
  const lead = Array.isArray(leadRaw) ? leadRaw[0] : leadRaw

  return {
    space,
    lead: lead ? { ...lead, id: lead.id ?? leadId } : { id: leadId, name: null, photo_url: null },
    preferences: prefs,
    items
  }
}

export default async function SelectionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const data = await getSelectionData(slug)

  if (!data) notFound()

  return <ClientSelectionView data={data} slug={slug} />
}
