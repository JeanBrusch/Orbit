-- ─── Tabela de análises de silêncio ──────────────────────────────────────────
-- Persiste cada análise e os resultados após envio
-- Isso é o que permite o sistema aprender ao longo do tempo

CREATE TABLE IF NOT EXISTS silence_analyses (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id         uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,

  -- Contexto no momento da análise
  days_silent     integer NOT NULL,
  analyzed_at     timestamptz NOT NULL DEFAULT now(),

  -- Classificação
  silence_reason  text NOT NULL,   -- PRICE_FRICTION | MISALIGNMENT | TIMING | ...
  confidence      numeric(3,2),    -- 0.00 - 1.00
  emotional_state text,
  last_known_intent text,

  -- Estratégia recomendada
  strategy                  text NOT NULL,
  should_include_properties boolean NOT NULL DEFAULT false,
  urgency                   text NOT NULL,  -- high | medium | low | none
  best_contact_window       text,
  next_step_if_reply        text,
  next_step_if_ignore       text,
  reasoning                 text,

  -- Resultado após envio (para aprendizado)
  message_sent              boolean DEFAULT false,
  message_text              text,           -- a mensagem que foi enviada
  had_property              boolean,        -- incluiu imóvel?
  sent_at                   timestamptz,
  sent_at_hour              smallint,       -- 0-23 para análise de janela
  had_response              boolean,        -- o lead respondeu?
  response_time_minutes     integer,        -- quanto tempo levou para responder

  -- Unique por lead — uma análise ativa por vez
  UNIQUE(lead_id)
);

-- Índices para as queries de aprendizado
CREATE INDEX IF NOT EXISTS idx_silence_analyses_reason   ON silence_analyses(silence_reason);
CREATE INDEX IF NOT EXISTS idx_silence_analyses_strategy ON silence_analyses(strategy);
CREATE INDEX IF NOT EXISTS idx_silence_analyses_urgency  ON silence_analyses(urgency);
CREATE INDEX IF NOT EXISTS idx_silence_analyses_sent     ON silence_analyses(message_sent, had_response);

-- ─── View para aprendizado agregado ───────────────────────────────────────────
-- "PRICE_FRICTION com estratégia REANCHOR_VALUE tem 68% de resposta"
CREATE OR REPLACE VIEW silence_learning AS
SELECT
  silence_reason,
  strategy,
  had_property,
  urgency,
  COUNT(*)                                          AS total_sent,
  COUNT(*) FILTER (WHERE had_response = true)       AS total_replied,
  ROUND(
    COUNT(*) FILTER (WHERE had_response = true)::numeric
    / NULLIF(COUNT(*), 0) * 100, 1
  )                                                 AS reply_rate_pct,
  ROUND(AVG(response_time_minutes) FILTER (
    WHERE had_response = true AND response_time_minutes IS NOT NULL
  ))                                                AS avg_response_min,
  MODE() WITHIN GROUP (ORDER BY sent_at_hour)       AS best_hour
FROM silence_analyses
WHERE message_sent = true
GROUP BY silence_reason, strategy, had_property, urgency
ORDER BY reply_rate_pct DESC NULLS LAST;
