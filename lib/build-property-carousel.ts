import type { CarouselCard } from '@/lib/zapi/client'

export interface PropertyForCarousel {
  id: string
  title: string | null
  internal_name: string | null
  cover_image: string | null
  value: number | null
  location_text: string | null
  source_link: string | null
  bedrooms?: number | null
  suites?: number | null
  parking_spots?: number | null
  area_privativa?: number | null
  ui_type?: string | null
  internal_code?: string | null
}

function formatValue(v: number | null): string {
  if (!v) return 'Sob consulta'
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `R$ ${Math.round(v / 1_000)}k`
  return `R$ ${v}`
}

export function buildPropertyCarousel(
  properties: PropertyForCarousel[],
  selectionUrl?: string
): CarouselCard[] {
  return properties.slice(0, 10).map(prop => {
    const buttons: CarouselCard['buttons'] = []

    if (prop.source_link) {
      buttons.push({
        id: `link-${prop.id}`,
        label: 'Ver detalhes',
        type: 'URL',
        url: prop.source_link
      })
    }

    if (selectionUrl) {
      buttons.push({
        id: `portal-${prop.id}`,
        label: 'Ver seleção completa',
        type: 'URL',
        url: selectionUrl
      })
    }

    buttons.push({
      id: `reply-${prop.id}`,
      label: 'Tenho interesse',
      type: 'REPLY'
    })

    const specs: string[] = []
    
    // Icon based on type
    const typeIcon = prop.ui_type?.toLowerCase().includes('casa') ? '🏡' : '🏢'
    
    // Details line
    const details = [
      prop.bedrooms ? `🛏️ ${prop.bedrooms} Dorm` : null,
      prop.suites ? `(${prop.suites} Suítes)` : null,
      prop.parking_spots ? `🚗 ${prop.parking_spots} Vagas` : null,
      prop.area_privativa ? `📐 ${Math.round(Number(prop.area_privativa))}m²` : null
    ].filter(Boolean).join(' ')

    const textParts = [
      `${typeIcon} *${prop.title || prop.internal_name || 'Imóvel'}*`,
      prop.location_text ? `📍 ${prop.location_text}` : null,
      '', // break
      details || null,
      `💰 *${formatValue(prop.value)}*`,
      '', // break
      prop.internal_code ? `Ref: ${prop.internal_code}` : null
    ].filter(p => p !== null)

    return {
      text: textParts.join('\n'),
      image: prop.cover_image || '',
      buttons: buttons.slice(0, 3) 
    }
  })
}
