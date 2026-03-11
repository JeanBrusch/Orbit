export function capsuleItemsToMemory(items: any[]) {
  return items
    .filter(item => item.type === 'note')
    .map(item => ({
      id: item.id,
      content: item.content,
      author: item.author || 'Sistema',
      createdAt: new Date(item.created_at).toLocaleDateString(),
    }))
}
