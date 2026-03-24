import type { CarouselCard } from '@/lib/zapi/client'

export interface PropertyForCarousel {
  id: string
  title: string | null
  internal_name: string | null
  cover_image: string | null
  value: number | null
  location_text: string | null
  source_link: string | null
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

    return {
      text: [
        prop.title || prop.internal_name || 'Imóvel',
        formatValue(prop.value),
        prop.location_text || ''
      ].filter(Boolean).join('\n'),
      image: prop.cover_image || '',
      buttons: buttons.slice(0, 3) // máx 3 botões por card
    }
  })
}
