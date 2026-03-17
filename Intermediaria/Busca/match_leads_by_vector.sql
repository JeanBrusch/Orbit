-- ══════════════════════════════════════════════════════════════════════════
-- RPC: match_leads_by_vector
-- Busca leads cujo semantic_vector (vetor composto acumulado pelo Orbit Core)
-- é semanticamente próximo ao embedding da query do operador.
--
-- O semantic_vector é calculado pelo orbit-core.ts a cada evento com pesos:
--   Context (40%) + Profile (30%) + Conversa (20%) + Events (10%)
--
-- Threshold recomendado: 0.55 (vetores compostos têm densidade diferente de
-- embeddings de texto único — threshold menor que 0.65 é correto aqui)
-- ══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION match_leads_by_vector(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.55,
  match_count int DEFAULT 20
)
RETURNS TABLE (
  lead_id uuid,
  similarity float
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    id AS lead_id,
    1 - (semantic_vector <=> query_embedding) AS similarity
  FROM leads
  WHERE
    semantic_vector IS NOT NULL
    AND state NOT IN ('blocked', 'ignored', 'pending')
    AND 1 - (semantic_vector <=> query_embedding) > match_threshold
  ORDER BY
    semantic_vector <=> query_embedding  -- ascending distance = descending similarity
  LIMIT match_count;
$$;

-- Grants
GRANT EXECUTE ON FUNCTION match_leads_by_vector(vector, float, int) TO anon;
GRANT EXECUTE ON FUNCTION match_leads_by_vector(vector, float, int) TO authenticated;
GRANT EXECUTE ON FUNCTION match_leads_by_vector(vector, float, int) TO service_role;

-- ── Index (if not exists) ─────────────────────────────────────────────────
-- Ensures cosine similarity queries are fast even with 100+ leads.
-- HNSW index with cosine operator for vector(1536).
CREATE INDEX IF NOT EXISTS leads_semantic_vector_hnsw_idx
  ON leads
  USING hnsw (semantic_vector vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
