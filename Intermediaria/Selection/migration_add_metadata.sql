-- Migration: adiciona coluna metadata à tabela property_interactions
-- Execute no SQL Editor do Supabase

ALTER TABLE property_interactions
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT NULL;

-- Índice para queries futuras em metadata (opcional mas recomendado)
CREATE INDEX IF NOT EXISTS idx_property_interactions_metadata
  ON property_interactions USING gin (metadata);

-- Verifica que session_end não quebra constraints de tipo
-- (Se houver um CHECK constraint no interaction_type, adicione 'session_end' abaixo)
-- Exemplo: ALTER TABLE property_interactions DROP CONSTRAINT IF EXISTS property_interactions_interaction_type_check;
-- ALTER TABLE property_interactions ADD CONSTRAINT property_interactions_interaction_type_check
--   CHECK (interaction_type IN ('viewed','favorited','discarded','visited','visited_site','portal_opened','property_question','session_end','sent'));

-- Confirma
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'property_interactions' AND column_name = 'metadata';
