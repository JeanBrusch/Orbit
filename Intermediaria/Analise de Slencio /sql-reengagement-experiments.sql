-- ══════════════════════════════════════════════════════════════════════════════
-- Reengagement Experiments Table
-- Persists each generated message + outcome for learning loop
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS reengagement_experiments (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id               UUID REFERENCES leads(id) ON DELETE CASCADE,

  -- Classification inputs
  silence_reason        TEXT NOT NULL, -- PRICE_FRICTION | TIMING | TRUST_GAP | etc
  strategy              TEXT NOT NULL, -- REANCHOR_VALUE | CURIOSITY_HOOK | etc
  tone                  TEXT NOT NULL, -- casual | curiosity | direct | reconnect | value_anchor
  days_silent           INTEGER NOT NULL,
  had_property          BOOLEAN DEFAULT false,
  message_length        INTEGER, -- char count

  -- Timing context
  sent_at_hour          INTEGER, -- 0-23, filled when sent
  sent_at               TIMESTAMPTZ,
  generated_at          TIMESTAMPTZ DEFAULT NOW(),

  -- Outcome (filled later via PATCH or webhook)
  had_response          BOOLEAN,
  response_time_minutes INTEGER,
  response_sentiment    TEXT, -- positive | neutral | negative
  converted_to_visit    BOOLEAN,
  experiment_notes      TEXT
);

CREATE INDEX IF NOT EXISTS idx_reengagement_lead ON reengagement_experiments(lead_id);
CREATE INDEX IF NOT EXISTS idx_reengagement_reason ON reengagement_experiments(silence_reason);
CREATE INDEX IF NOT EXISTS idx_reengagement_had_response ON reengagement_experiments(had_response);

-- ── Learning View ─────────────────────────────────────────────────────────────
-- Aggregates what works, by combination of reason + strategy + tone

CREATE OR REPLACE VIEW reengagement_learning AS
SELECT
  silence_reason,
  strategy,
  tone,
  had_property,
  ROUND(AVG(CASE WHEN had_response THEN 1 ELSE 0 END)::numeric * 100, 1) AS response_rate_pct,
  AVG(response_time_minutes) AS avg_response_minutes,
  ROUND(AVG(CASE WHEN converted_to_visit THEN 1 ELSE 0 END)::numeric * 100, 1) AS visit_conversion_pct,
  COUNT(*) AS sample_count,
  -- Best sending hour for this combination
  MODE() WITHIN GROUP (ORDER BY sent_at_hour) AS best_hour
FROM reengagement_experiments
WHERE had_response IS NOT NULL
GROUP BY silence_reason, strategy, tone, had_property
HAVING COUNT(*) >= 3
ORDER BY response_rate_pct DESC;

-- ── Mark experiment response ──────────────────────────────────────────────────
-- Called when a lead replies after a reengagement message was sent

CREATE OR REPLACE FUNCTION mark_reengagement_response(
  p_lead_id UUID,
  p_response_sentiment TEXT DEFAULT 'neutral'
)
RETURNS VOID AS $$
DECLARE
  v_experiment_id UUID;
  v_sent_at TIMESTAMPTZ;
BEGIN
  -- Find the most recent sent experiment for this lead
  SELECT id, sent_at INTO v_experiment_id, v_sent_at
  FROM reengagement_experiments
  WHERE lead_id = p_lead_id
    AND sent_at IS NOT NULL
    AND had_response IS NULL
  ORDER BY sent_at DESC
  LIMIT 1;

  IF v_experiment_id IS NOT NULL THEN
    UPDATE reengagement_experiments
    SET
      had_response = true,
      response_time_minutes = EXTRACT(EPOCH FROM (NOW() - v_sent_at)) / 60,
      response_sentiment = p_response_sentiment
    WHERE id = v_experiment_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

GRANT SELECT ON reengagement_learning TO anon;
GRANT SELECT ON reengagement_learning TO authenticated;
