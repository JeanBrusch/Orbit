# Patch 4 — SQL Migration (Supabase)

Rodar no SQL Editor do Supabase em ordem.

---

## Migration 001 — Campos novos em `lead_cognitive_state`

```sql
-- Conflito central identificado pela IA
ALTER TABLE lead_cognitive_state
  ADD COLUMN IF NOT EXISTS central_conflict TEXT;

-- Restrição específica para este lead agora
ALTER TABLE lead_cognitive_state
  ADD COLUMN IF NOT EXISTS what_not_to_do TEXT;

-- Comentários para documentação
COMMENT ON COLUMN lead_cognitive_state.central_conflict IS
  'Travamento real identificado pela IA — uma camada abaixo do sintoma superficial';

COMMENT ON COLUMN lead_cognitive_state.what_not_to_do IS
  'Restrição de ação derivada do histórico específico deste lead';
```

---

## Migration 002 — Verificar e garantir `last_human_action_at`

```sql
-- Confirmar que a coluna existe (já deve existir pelo schema)
ALTER TABLE lead_cognitive_state
  ADD COLUMN IF NOT EXISTS last_human_action_at TIMESTAMPTZ;

-- Backfill: para leads que já têm mensagens do operador,
-- preencher last_human_action_at com o timestamp da última mensagem enviada
UPDATE lead_cognitive_state lcs
SET last_human_action_at = (
  SELECT MAX(m.timestamp::timestamptz)
  FROM messages m
  WHERE m.lead_id = lcs.lead_id
    AND m.source = 'operator'
)
WHERE last_human_action_at IS NULL;
```

---

## Migration 003 — Índice para queries de decaimento

```sql
-- Acelerar busca por leads que precisam de recálculo de score
CREATE INDEX IF NOT EXISTS idx_cognitive_last_human_action
  ON lead_cognitive_state (last_human_action_at)
  WHERE last_human_action_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cognitive_current_state
  ON lead_cognitive_state (current_state);
```

---

## Verificação pós-migration

```sql
-- Confirmar estrutura final
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'lead_cognitive_state'
ORDER BY ordinal_position;

-- Verificar backfill
SELECT
  COUNT(*) as total,
  COUNT(last_human_action_at) as com_human_action,
  COUNT(central_conflict) as com_conflict,
  COUNT(what_not_to_do) as com_restriction
FROM lead_cognitive_state;
```
