# Patch 3 — Upgrade para `gpt-4o` + `last_human_action_at` funcional

---

## 3A — Trocar modelo em `orbit-core.ts`

### Problema
`gpt-4o-mini` aprova respostas genéricas que o prompt instrui a reprovar.
O prompt tem testes anti-genérico, `central_conflict`, `what_not_to_do` — tudo isso exige
capacidade de raciocínio que o mini não tem de forma consistente.

### Modificação

Localizar em `analyzeContext`:

```typescript
// ANTES
const response = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [
    { role: "system", content: "Você é o ORBIT Core. Responda apenas em JSON." },
    { role: "user", content: prompt }
  ],
  response_format: { type: "json_object" },
  temperature: 0.1,
});

// DEPOIS
const response = await openai.chat.completions.create({
  model: "gpt-4o",          // ← upgrade
  messages: [
    { role: "system", content: "Você é o ORBIT Core. Responda apenas em JSON." },
    { role: "user", content: prompt }
  ],
  response_format: { type: "json_object" },
  temperature: 0.1,
});
```

### Custo real
Para um corretor com ~30 leads ativos e ~20 mensagens/dia:
- gpt-4o-mini: ~$0.05/dia
- gpt-4o:      ~$0.80/dia

Completamente viável. A diferença de qualidade no `central_conflict` e `what_not_to_do`
justifica o custo com folga — são os campos que mais impactam decisões de vendas.

---

## 3B — `last_human_action_at`: tornar funcional

### Problema
O campo existe no schema mas nunca é atualizado. Isso impede o cálculo de decaimento
do Patch 1 e também o diagnóstico "IA analisou mas corretor nunca agiu".

### Localizar todos os pontos de ação do operador:

**1. `app/api/whatsapp/send/route.ts`**

Após o bloco que confirma inserção da mensagem com sucesso:

```typescript
// Após: console.log('[SEND] Message saved in historical table:', idempotencyKey)
// Adicionar:
await supabase
  .from('lead_cognitive_state')
  .upsert({
    lead_id: leadId,
    last_human_action_at: new Date().toISOString(),
  }, { onConflict: 'lead_id', ignoreDuplicates: false })
  .select()
```

**2. `app/api/lead/[id]/note/route.ts`** (se existir)

No handler POST que salva a nota, após confirmar sucesso:

```typescript
await supabase
  .from('lead_cognitive_state')
  .upsert({
    lead_id: params.id,
    last_human_action_at: new Date().toISOString(),
  }, { onConflict: 'lead_id', ignoreDuplicates: false })
```

**3. `components/lead-cognitive-console.tsx`** — modo `call` (ligação)

No bloco que salva ligação atendida, após `insertError` check:

```typescript
// Após salvar a ligação com sucesso
if (!insertError) {
  await supabase
    .from('lead_cognitive_state')
    .upsert({
      lead_id: leadId,
      last_human_action_at: new Date().toISOString(),
    }, { onConflict: 'lead_id', ignoreDuplicates: false })
}
```

---

## 3C — Usar `last_human_action_at` vs `last_ai_analysis_at` no pipeline

No `orbit-pipeline-view.tsx`, adicionar indicador visual no card quando
"IA analisou mas corretor nunca reagiu":

```typescript
// Na query do pipeline, incluir last_human_action_at e last_ai_analysis_at
// Depois, no LeadCard, calcular:

const aiAnalyzedAt = lead.last_ai_analysis_at
  ? new Date(lead.last_ai_analysis_at).getTime()
  : null
const humanActedAt = lead.last_human_action_at
  ? new Date(lead.last_human_action_at).getTime()
  : null

// Lead tem análise mais recente que última ação humana?
const aiAheadOfHuman = aiAnalyzedAt && (!humanActedAt || aiAnalyzedAt > humanActedAt)
const hoursSinceAnalysis = aiAnalyzedAt
  ? (Date.now() - aiAnalyzedAt) / 3600000
  : null

// Se IA analisou há menos de 24h e corretor não agiu: mostrar indicador
const pendingAction = aiAheadOfHuman && hoursSinceAnalysis !== null && hoursSinceAnalysis < 24
```

Usar `pendingAction` para exibir um anel âmbar no avatar do card:

```tsx
// No avatar do LeadCard:
<div style={{
  // ... estilos existentes ...
  boxShadow: pendingAction ? '0 0 0 2px #EF9F27' : 'none',
}}>
  {initials(lead.name)}
</div>
```
