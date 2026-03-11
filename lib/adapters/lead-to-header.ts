const stageLabels: Record<string, string> = {
  sem_ciclo: 'Sem Ciclo',
  inicio: 'Início',
  explorando: 'Explorando',
  decidindo: 'Decidindo',
  encerrado: 'Encerrado',
  resolvido: 'Resolvido',
}

export function formatLastInteraction(date: Date | string | null): string {
  if (!date) return 'nunca'
  
  const d = new Date(date)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  
  if (diffMins < 1) return 'agora'
  if (diffMins < 60) return `há ${diffMins} min`
  if (diffHours < 24) return `há ${diffHours}h`
  if (diffDays === 1) return 'ontem'
  if (diffDays < 7) return `há ${diffDays} dias`
  return d.toLocaleDateString('pt-BR')
}

export function leadToHeader(lead: any, lastInteractionDate?: Date | string | null) {
  return {
    name: lead?.name || 'Lead',
    stage: stageLabels[lead?.cycle_stage] || lead?.cycle_stage || 'Sem Ciclo',
    lastInteraction: formatLastInteraction(lastInteractionDate || lead?.updated_at),
  }
}
