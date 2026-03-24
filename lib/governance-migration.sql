-- Migração: Orbit AI Governance - Fila de Análise
-- Adiciona suporte para triagem e processamento em lote de mensagens

ALTER TABLE messages 
  ADD COLUMN IF NOT EXISTS analysis_status TEXT DEFAULT 'pending'
    CHECK (analysis_status IN ('pending', 'queued', 'processing', 'done', 'skipped')),
  ADD COLUMN IF NOT EXISTS analysis_queued_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS analysis_batch_id TEXT,
  ADD COLUMN IF NOT EXISTS analysis_cadence TEXT 
    DEFAULT 'realtime'
    CHECK (analysis_cadence IN ('realtime', 'batch_hourly', 'batch_2x_daily', 'skipped'));

-- Índice para performance na busca de mensagens pendentes
CREATE INDEX IF NOT EXISTS idx_messages_analysis_queue 
  ON messages (analysis_status, analysis_cadence, analysis_queued_at)
  WHERE analysis_status IN ('pending', 'queued');

-- View para facilitar o monitoramento
CREATE OR REPLACE VIEW messages_pending_batch AS
SELECT 
  m.id,
  m.lead_id,
  m.content,
  m.timestamp,
  m.source,
  m.analysis_cadence,
  l.orbit_stage,
  l.last_interaction_at
FROM messages m
JOIN leads l ON l.id = m.lead_id
WHERE m.analysis_status = 'queued'
  AND m.ai_analysis IS NULL
ORDER BY m.lead_id, m.timestamp ASC;
