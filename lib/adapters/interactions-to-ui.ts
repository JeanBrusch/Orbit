export function interactionsToUI(items: any[]) {
  return items.map(item => ({
    id: item.id,
    fromMe: item.direction === 'outbound',
    content: item.content,
    type: item.type || 'text',
    createdAt: new Date(item.created_at).toLocaleString('pt-BR'),
  }))
}
