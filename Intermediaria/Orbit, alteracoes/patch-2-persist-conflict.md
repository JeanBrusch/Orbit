# Patch 2 — Persistir `what_not_to_do` e `central_conflict`

## Problema
A IA gera `what_not_to_do` e `central_conflict` em cada análise — campos ricos e específicos por lead —
mas eles são descartados. Nunca são salvos em nenhuma tabela.

---

## Passo A — Migração SQL (Supabase)

Rodar no SQL Editor do Supabase:

```sql
-- Adicionar campos na tabela lead_cognitive_state
ALTER TABLE lead_cognitive_state
  ADD COLUMN IF NOT EXISTS central_conflict TEXT,
  ADD COLUMN IF NOT EXISTS what_not_to_do   TEXT;
```

---

## Passo B — Atualizar `database.types.ts`

Na seção `lead_cognitive_state`, adicionar os campos em `Row`, `Insert` e `Update`:

```typescript
// Row
central_conflict: string | null;
what_not_to_do: string | null;

// Insert
central_conflict?: string | null;
what_not_to_do?: string | null;

// Update
central_conflict?: string | null;
what_not_to_do?: string | null;
```

---

## Passo C — Salvar no `orbit-core.ts` (Passo 2)

No upsert do `lead_cognitive_state`, adicionar os dois campos:

```typescript
// ANTES
const r2 = await (getSupabase()?.from("lead_cognitive_state") as any).upsert({
  lead_id: leadId,
  interest_score: newInterest,
  momentum_score: newMomentum,
  current_state: nextState,
  last_ai_analysis_at: new Date().toISOString(),
  risk_score: newRisk,
  clarity_level: cur?.clarity_level ?? 50,
});

// DEPOIS
const r2 = await (getSupabase()?.from("lead_cognitive_state") as any).upsert({
  lead_id: leadId,
  interest_score: newInterest,
  momentum_score: newMomentum,
  current_state: nextState,
  last_ai_analysis_at: new Date().toISOString(),
  risk_score: newRisk,
  clarity_level: cur?.clarity_level ?? 50,
  central_conflict: analysis.central_conflict ?? null,    // ← NOVO
  what_not_to_do: analysis.what_not_to_do ?? null,        // ← NOVO
});
```

---

## Passo D — Expor no `CoreAnalysis` interface

A interface `CoreAnalysis` já tem os campos no JSON do prompt mas não os declara formalmente.
Adicionar:

```typescript
interface CoreAnalysis {
  // ... campos existentes ...
  central_conflict: string | null;   // ← garantir que está declarado
  what_not_to_do: string | null;     // ← garantir que está declarado
  // ...
}
```

---

## Passo E — Exibir no `lead-cognitive-console.tsx`

Localizar onde `cognitive` (CognitiveState) é renderizado — a seção de insights/contexto do painel.
Adicionar após a exibição do insight principal:

```tsx
// Dentro do painel lateral, na seção de análise de IA:
{cog?.central_conflict && (
  <div style={{
    background: "rgba(226,75,74,0.06)",
    border: "0.5px solid rgba(226,75,74,0.2)",
    borderRadius: 10, padding: "10px 12px", marginBottom: 8
  }}>
    <div style={{ fontSize: 9, color: "#E24B4A", textTransform: "uppercase",
      letterSpacing: "0.1em", fontWeight: 700, marginBottom: 5 }}>
      Conflito Central
    </div>
    <p style={{ fontSize: 12, color: "#c87878", lineHeight: 1.5, margin: 0 }}>
      {cog.central_conflict}
    </p>
  </div>
)}

{cog?.what_not_to_do && (
  <div style={{
    background: "rgba(186,117,23,0.06)",
    border: "0.5px solid rgba(186,117,23,0.2)",
    borderRadius: 10, padding: "10px 12px", marginBottom: 8
  }}>
    <div style={{ fontSize: 9, color: "#BA7517", textTransform: "uppercase",
      letterSpacing: "0.1em", fontWeight: 700, marginBottom: 5 }}>
      Não Fazer Agora
    </div>
    <p style={{ fontSize: 12, color: "#c9964a", lineHeight: 1.5, margin: 0 }}>
      {cog.what_not_to_do}
    </p>
  </div>
)}
```

---

## Passo F — Expor no pipeline (orbit-pipeline-view.tsx)

No `LeadDrawer`, após os score tiles, adicionar:

```tsx
{lead.central_conflict && (
  <div style={{ background:"rgba(226,75,74,0.06)", border:"0.5px solid rgba(226,75,74,0.2)",
    borderRadius:11, padding:"11px 13px", marginBottom:10 }}>
    <div style={{ fontSize:9, color:"#E24B4A", textTransform:"uppercase",
      letterSpacing:"0.1em", fontWeight:700, marginBottom:5 }}>Conflito Central</div>
    <p style={{ fontSize:12, color:"#c87878", lineHeight:1.5, margin:0 }}>
      {lead.central_conflict}
    </p>
  </div>
)}
```

Isso exige passar `central_conflict` e `what_not_to_do` na query do pipeline:

```typescript
// Na query que busca leads para o pipeline, adicionar:
supabase
  .from('leads')
  .select(`
    id, name, photo_url, orbit_stage, action_suggested, last_interaction_at,
    lead_cognitive_state (
      interest_score, momentum_score, risk_score,
      current_state, central_conflict, what_not_to_do   // ← adicionar
    )
  `)
```
