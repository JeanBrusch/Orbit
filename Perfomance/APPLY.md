# Orbit Performance Fixes — Guia de Aplicação

## Ordem de aplicação

### 1. `next.config.mjs` (substituição direta)
Substitui o arquivo raiz. Remove o no-cache global e aplica cache seletivo por rota.
Impacto: assets estáticos passam a usar cache do browser/CDN. APIs de escrita permanecem sem cache.

### 2. `hooks/use-supabase-data.ts` (substituição direta)
Substitui o arquivo inteiro. Mudanças:
- `useSupabaseLeads`: adiciona canal Realtime para `leads`, `lead_cognitive_state` e `messages`
- `useLeadDetails`: substitui completamente o modelo — novos dados chegam via INSERT payload (zero re-fetch para messages, insights, memories). Cognitive state atualiza via UPDATE. Property interactions ainda fazem refetch pois precisam enriquecer com dados da tabela `properties`.
- Remoção: sem `setInterval` em nenhum lugar deste hook.

### 3. `components/lead-brain/cognitive-analysis.tsx` (substituição direta)
Substitui o arquivo inteiro. Mudanças:
- Remove `createClient` inline (usa `getSupabase()` singleton)
- Remove `setInterval(fetchMemories, 15000)`
- Adiciona canal Realtime `INSERT` para `memory_items` filtrado por `lead_id`
- Bônus: adiciona barras de progresso visuais para os 4 scores cognitivos

### 4. `app/lead/[id]/page.tsx` (edição cirúrgica — 2 blocos)
NÃO substitua o arquivo inteiro. Faça apenas estas mudanças:

**Bloco A** — Substituir os dois useEffect (fetchAll inicial + polling):
```ts
// REMOVER:
useEffect(() => { fetchAll() }, [fetchAll])
useEffect(() => {
  const interval = setInterval(fetchAll, 15000)
  return () => clearInterval(interval)
}, [fetchAll])

// ADICIONAR (único useEffect):
useEffect(() => {
  fetchAll()
  const channel = supabase
    .channel(`lead-terminal-${id}`)
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `lead_id=eq.${id}` },
      (payload) => {
        setMessages(prev => {
          const incoming = payload.new as Message
          if (prev.some(m => m.id === incoming.id)) return prev
          return [...prev, incoming]
        })
        setTimelineKey(k => k + 1)
      }
    )
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'lead_cognitive_state', filter: `lead_id=eq.${id}` },
      (payload) => { setCognitive(payload.new as CognitiveState) }
    )
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'ai_insights', filter: `lead_id=eq.${id}` },
      (payload) => {
        setInsights(prev => {
          const incoming = payload.new as AiInsight
          if (prev.some(i => i.id === incoming.id)) return prev
          return [incoming, ...prev]
        })
      }
    )
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'memory_items', filter: `lead_id=eq.${id}` },
      (payload) => {
        setMemories(prev => {
          const incoming = payload.new as MemoryItem
          if (prev.some(m => m.id === incoming.id)) return prev
          return [incoming, ...prev]
        })
      }
    )
    .subscribe()
  return () => { supabase.removeChannel(channel) }
}, [fetchAll, id])
```

**Bloco B** — No handleSend, remover `fetchAll` do setTimeout:
```ts
// DE:
setTimeout(() => { setSendStatus("idle"); fetchAll() }, 1500)
// PARA:
setTimeout(() => { setSendStatus("idle") }, 1500)
```

### 5. Supabase Dashboard — SQL (opcional mas recomendado)
Cole o conteúdo de `supabase/migrations/20260312_get_orbit_leads_rpc.sql`
no SQL Editor do Supabase e execute.

Depois, atualize `useSupabaseLeads` para usar `supabase.rpc('get_orbit_leads')`
usando o snippet em `hooks/use-supabase-data-rpc-snippet.ts`.
Isso reduz o carregamento inicial de 4 queries para 1.

### 6. Ativar Realtime no Supabase Dashboard
Vá em: Database → Replication → Tables
Ative para as tabelas: `messages`, `lead_cognitive_state`, `ai_insights`, `memory_items`, `leads`

---

## Resultado esperado
| Antes | Depois |
|---|---|
| Dados novos chegam em até 15s | Dados novos chegam em < 1s (Realtime) |
| 2 timers por lead aberto | Zero timers |
| 4 round-trips na tela inicial | 1 round-trip (após RPC) |
| Cache global desativado | Cache seletivo por rota |
| Nova mensagem WhatsApp = 15s de delay | Aparece instantaneamente |
