# Patch 1 — Decaimento temporal de momentum + risk_score calculado

## Arquivo: `lib/orbit-core.ts`

### Problema
- `momentum_score` acumula infinitamente sem considerar silêncio do lead
- `risk_score` nunca muda — sempre herda `cur?.risk_score || 50`
- `interest_score` não decai mesmo depois de semanas sem resposta

### Modificação 1 — Adicionar `risk_delta` no `CoreAnalysis`

Localizar a interface `CoreAnalysis` e adicionar o campo:

```typescript
// ANTES
interface CoreAnalysis {
  intention: string;
  pain: string | null;
  signal: "positive" | "negative" | "neutral";
  urgency: number;
  interest_delta: number;
  momentum_delta: number;
  // ...
}

// DEPOIS
interface CoreAnalysis {
  intention: string;
  pain: string | null;
  central_conflict: string | null;     // já existe no prompt, faltava na interface
  what_not_to_do: string | null;       // já existe no prompt, faltava na interface
  signal: "positive" | "negative" | "neutral";
  urgency: number;
  interest_delta: number;
  momentum_delta: number;
  risk_delta: number;                  // ← NOVO: -10 a 10
  // ...
}
```

---

### Modificação 2 — Função de decaimento temporal

Adicionar esta função logo após os imports, antes de `getOpenAI()`:

```typescript
// ─── Decaimento temporal de scores ───────────────────────────────────────────
// Aplica penalidade progressiva baseada em dias sem interação humana.
// Momentum decai mais rápido (ciclo de decisão curto).
// Interest decai mais devagar (desejo persiste mais).

function applyTemporalDecay(
  interestScore: number,
  momentumScore: number,
  lastHumanActionAt: string | null
): { interest: number; momentum: number } {
  if (!lastHumanActionAt) {
    return { interest: interestScore, momentum: momentumScore }
  }

  const daysSinceLastContact = Math.max(
    0,
    (Date.now() - new Date(lastHumanActionAt).getTime()) / (1000 * 60 * 60 * 24)
  )

  // Sem decaimento nos primeiros 2 dias
  if (daysSinceLastContact <= 2) {
    return { interest: interestScore, momentum: momentumScore }
  }

  // Momentum: -3 por dia após 2 dias de silêncio (ciclo rápido)
  // Interest:  -1 por dia após 5 dias de silêncio (desejo dura mais)
  const momentumPenalty = Math.min(40, (daysSinceLastContact - 2) * 3)
  const interestPenalty = daysSinceLastContact > 5
    ? Math.min(20, (daysSinceLastContact - 5) * 1)
    : 0

  return {
    interest: Math.max(0, interestScore - interestPenalty),
    momentum: Math.max(0, momentumScore - momentumPenalty),
  }
}
```

---

### Modificação 3 — Aplicar decaimento no Passo 2 de `processEventWithCore`

Localizar o bloco "Passo 2 - upsert cognitive state" e substituir:

```typescript
// ANTES
const cur = context.currentState;
const newInterest = Math.min(100, Math.max(0, (cur?.interest_score || 50) + analysis.interest_delta));
const newMomentum = Math.min(100, Math.max(0, (cur?.momentum_score || 50) + analysis.momentum_delta));
const nextState = analysis.current_cognitive_state;
const r2 = await (getSupabase()?.from("lead_cognitive_state") as any).upsert({
  lead_id: leadId,
  interest_score: newInterest,
  momentum_score: newMomentum,
  current_state: nextState,
  last_ai_analysis_at: new Date().toISOString(),
  risk_score: cur?.risk_score || 50,      // ← BUG: nunca muda
  clarity_level: cur?.clarity_level || 50,
});

// DEPOIS
const cur = context.currentState;

// 1. Aplicar decaimento temporal ANTES de somar os deltas
const decayed = applyTemporalDecay(
  cur?.interest_score ?? 50,
  cur?.momentum_score ?? 50,
  cur?.last_human_action_at ?? null
)

// 2. Somar deltas da análise sobre base já decaída
const newInterest  = Math.min(100, Math.max(0, decayed.interest  + analysis.interest_delta))
const newMomentum  = Math.min(100, Math.max(0, decayed.momentum  + analysis.momentum_delta))

// 3. Risk score agora calculado pela IA — com fallback
const newRisk = typeof analysis.risk_delta === 'number'
  ? Math.min(100, Math.max(0, (cur?.risk_score ?? 50) + analysis.risk_delta))
  : cur?.risk_score ?? 50

const nextState = analysis.current_cognitive_state;
const r2 = await (getSupabase()?.from("lead_cognitive_state") as any).upsert({
  lead_id: leadId,
  interest_score: newInterest,
  momentum_score: newMomentum,
  current_state: nextState,
  last_ai_analysis_at: new Date().toISOString(),
  risk_score: newRisk,                     // ← CORRIGIDO
  clarity_level: cur?.clarity_level ?? 50,
  // last_human_action_at NÃO é atualizado aqui — só quando for ação do operador
});
```

---

### Modificação 4 — Atualizar `last_human_action_at` nas rotas de ação do operador

Em `app/api/whatsapp/send/route.ts`, no bloco que salva a mensagem enviada, adicionar ao update da tabela `lead_cognitive_state`:

```typescript
// Após salvar a mensagem do operador com sucesso, atualizar last_human_action_at
await supabase
  .from('lead_cognitive_state')
  .update({ last_human_action_at: new Date().toISOString() })
  .eq('lead_id', leadId)
```

O mesmo deve ser feito em `app/api/lead/[id]/note/route.ts` quando salvar nota do operador.

---

### Modificação 5 — Adicionar `risk_delta` no prompt

No prompt de `analyzeContext`, dentro do bloco JSON de resposta, adicionar:

```
"risk_delta": número de -10 a 10,
```

E adicionar esta instrução na seção de tarefas do prompt:

```
6. RISCO — ajuste do risco de perda do lead (-10 a +10):
   +10: lead vai embora, disse não, silêncio longo + competing offer confirmado
   +5:  sem resposta por mais de 7 dias, objeção de preço sem contrapartida
   0:   interação neutra ou inconclusiva
   -5:  visita agendada, proposta aceita parcialmente
   -10: negócio fechado, visita realizada com boa receptividade
```
