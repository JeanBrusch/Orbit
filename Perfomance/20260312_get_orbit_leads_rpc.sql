-- ══════════════════════════════════════════════════════════════════════════════
-- RPC: get_orbit_leads
-- Consolidates 4 round-trips (leads_center + leads + lead_cognitive_state +
-- internal_notes) into a single Supabase RPC call.
--
-- Usage from the client:
--   const { data } = await supabase.rpc('get_orbit_leads')
--
-- Returns one row per active lead with all fields needed to render the Orbit.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_orbit_leads()
RETURNS TABLE (
  -- leads_center fields
  lead_id             uuid,
  name                text,
  phone               text,
  photo_url           text,
  origin              text,
  estado_atual        text,
  acao_sugerida       text,
  last_event_type     text,
  ultima_interacao_at timestamptz,
  dias_sem_interacao  integer,
  tem_capsula_ativa   boolean,
  created_at          timestamptz,

  -- leads table fields
  orbit_stage         text,
  orbit_visual_state  text,
  action_suggested    text,
  cycle_stage         text,
  followup_active     boolean,
  followup_remaining  integer,
  followup_done_today boolean,

  -- lead_cognitive_state fields
  interest_score      numeric,
  momentum_score      numeric,
  risk_score          numeric,
  clarity_level       numeric,
  current_state       text,
  last_ai_analysis_at timestamptz,

  -- mature notes flag (notes older than 45 days)
  has_mature_notes    boolean
)
LANGUAGE sql
STABLE
AS $$
  WITH memory_min_age AS (
    SELECT (NOW() - INTERVAL '45 days') AS threshold
  ),
  mature AS (
    SELECT DISTINCT lead_id
    FROM internal_notes, memory_min_age
    WHERE created_at < memory_min_age.threshold
  )
  SELECT
    lc.lead_id,
    lc.name,
    lc.phone,
    lc.photo_url,
    lc.origin,
    lc.estado_atual,
    lc.acao_sugerida,
    lc.last_event_type,
    lc.ultima_interacao_at,
    lc.dias_sem_interacao,
    lc.tem_capsula_ativa,
    lc.created_at,

    l.orbit_stage,
    l.orbit_visual_state,
    l.action_suggested,
    l.cycle_stage,
    COALESCE(l.followup_active, false)     AS followup_active,
    COALESCE(l.followup_remaining, 0)      AS followup_remaining,
    COALESCE(l.followup_done_today, false) AS followup_done_today,

    COALESCE(cs.interest_score, 0)  AS interest_score,
    COALESCE(cs.momentum_score, 0)  AS momentum_score,
    COALESCE(cs.risk_score, 0)      AS risk_score,
    COALESCE(cs.clarity_level, 0)   AS clarity_level,
    cs.current_state,
    cs.last_ai_analysis_at,

    (m.lead_id IS NOT NULL) AS has_mature_notes

  FROM leads_center lc
  LEFT JOIN leads            l  ON l.id       = lc.lead_id
  LEFT JOIN lead_cognitive_state cs ON cs.lead_id = lc.lead_id
  LEFT JOIN mature           m  ON m.lead_id  = lc.lead_id
  WHERE lc.estado_atual NOT IN ('pending', 'blocked', 'ignored')
     OR lc.estado_atual IS NULL
  ORDER BY lc.created_at DESC;
$$;

-- Grant execute to anon (matches ANON_KEY usage in client)
GRANT EXECUTE ON FUNCTION get_orbit_leads() TO anon;
GRANT EXECUTE ON FUNCTION get_orbit_leads() TO authenticated;
