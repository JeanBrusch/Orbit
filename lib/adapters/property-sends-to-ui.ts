type CapsuleItem = {
  id: string
  property_id: string
  state: string
  created_at: string
  properties: {
    id: string
    title: string | null
    price: number | null
    neighborhood: string | null
  } | null
}

function formatPrice(price: number | null): string {
  if (!price) return ''
  if (price >= 1_000_000) {
    const m = price / 1_000_000
    return `R$ ${m % 1 === 0 ? m : m.toFixed(1)}M`
  }
  if (price >= 1_000) {
    return `R$ ${Math.floor(price / 1_000)}k`
  }
  return `R$ ${price}`
}

function stateToStatus(state: string): 'enviado' | 'favorito' | 'descartado' | 'visitado' {
  switch (state) {
    case 'favorited': return 'favorito'
    case 'discarded': return 'descartado'
    case 'visited': return 'visitado'
    default: return 'enviado'
  }
}

export function propertySendsToUI(items: CapsuleItem[]) {
  return items.map(i => ({
    id: i.property_id,
    title: i.properties?.title || 'Imóvel enviado',
    price: formatPrice(i.properties?.price || null),
    sentAt: new Date(i.created_at).toLocaleString('pt-BR'),
    status: stateToStatus(i.state),
  }))
}
