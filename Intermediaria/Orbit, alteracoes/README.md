# Orbit Core — Patches de Correção

## Ordem de aplicação

```
1. patch-4-sql-migration.md     → Supabase SQL Editor (primeiro, sempre)
2. patch-1-score-decay.md       → lib/orbit-core.ts
3. patch-2-persist-conflict.md  → orbit-core.ts + database.types.ts + UI
4. patch-3-model-upgrade.md     → orbit-core.ts + rotas de ação
```

---

## Resumo do que cada patch corrige

| Patch | Problema | Impacto |
|-------|----------|---------|
| 1 — Score Decay | Momentum nunca cai; lead silencioso parece quente | Pipeline mostra prioridades erradas |
| 2 — Persist Conflict | `what_not_to_do` e `central_conflict` gerados e descartados | Dado mais rico da IA some a cada análise |
| 3 — Model + Human Action | `gpt-4o-mini` aprova genéricos; `last_human_action_at` nunca atualizado | Análises fracas; decaimento sem base temporal |
| 4 — SQL | Schema não tem colunas para patches 1-3 | Base para tudo funcionar |

---

## Depois dos patches: o que muda no pipeline

- Cards de leads silenciosos vão mostrar momentum baixo automaticamente
- Todo card terá o **Conflito Central** visível no drawer
- Anel âmbar indica "IA analisou, você ainda não agiu"
- `risk_score` vai variar de verdade conforme o lead responde ou some

---

## Sem breaking changes

Nenhum patch quebra funcionalidade existente:
- Decaimento só aplica quando há `last_human_action_at` — leads sem o campo ficam inalterados
- Campos novos (`central_conflict`, `what_not_to_do`) são nullable
- Upgrade de modelo é drop-in replacement
