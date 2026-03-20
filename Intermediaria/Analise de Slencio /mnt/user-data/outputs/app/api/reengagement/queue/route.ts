import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

// GET /api/reengagement/queue
// Returns silent leads prioritized by urgency for the reengagement page

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseServer();
    const url = new URL(req.url);
    const minDays = parseInt(url.searchParams.get("min_days") || "3");
    const limit = parseInt(url.searchParams.get("limit") || "15");

    const cutoffDate = new Date(
      Date.now() - minDays * 24 * 60 * 60 * 1000
    ).toISOString();

    // Fetch leads that have gone silent — not pending/blocked/ignored
    const { data: leads, error } = await supabase
      .from("leads")
      .select(
        `
        id,
        name,
        phone,
        photo_url,
        orbit_stage,
        last_interaction_at,
        action_suggested
      `
      )
      .not("state", "in", '("pending","blocked","ignored")')
      .lt("last_interaction_at", cutoffDate)
      .not("last_interaction_at", "is", null)
      .order("last_interaction_at", { ascending: true }) // oldest silence first
      .limit(limit * 2); // over-fetch to allow filtering

    if (error) throw error;
    if (!leads?.length) return NextResponse.json({ leads: [] });

    const leadIds = leads.map((l) => l.id);

    // Fetch cognitive states in batch
    const { data: cogStates } = await supabase
      .from("lead_cognitive_state")
      .select("lead_id, interest_score, momentum_score, current_state")
      .in("lead_id", leadIds);

    const cogMap = new Map(
      (cogStates || []).map((c) => [c.lead_id, c])
    );

    // Fetch latest silence analysis for each lead
    const { data: analyses } = await (supabase
      .from("silence_analyses") as any)
      .select(
        "lead_id, silence_reason, strategy, emotional_state, confidence, days_silent, analyzed_at"
      )
      .in("lead_id", leadIds)
      .order("analyzed_at", { ascending: false });

    // Keep only the most recent analysis per lead
    const analysisMap = new Map<string, any>();
    for (const a of analyses || []) {
      if (!analysisMap.has(a.lead_id)) {
        analysisMap.set(a.lead_id, a);
      }
    }

    // Build enriched lead items with priority score
    const enriched = leads
      .map((lead) => {
        const cog = cogMap.get(lead.id);
        const analysis = analysisMap.get(lead.id);

        const daysSilent = lead.last_interaction_at
          ? Math.floor(
              (Date.now() - new Date(lead.last_interaction_at).getTime()) /
                86400000
            )
          : 0;

        // Priority score: higher = more urgent to reengage
        // Formula: interest × (1 - momentum_decay) × time_weight
        const interest = cog?.interest_score ?? 40;
        const momentum = cog?.momentum_score ?? 30;

        // Time weight: peaks at 7-14 days (window of opportunity), decays after 30
        let timeWeight = 0.5;
        if (daysSilent >= 3 && daysSilent <= 7) timeWeight = 0.7;
        if (daysSilent > 7 && daysSilent <= 14) timeWeight = 1.0;
        if (daysSilent > 14 && daysSilent <= 30) timeWeight = 0.8;
        if (daysSilent > 30) timeWeight = 0.4;

        // Dormant/resolved stages get deprioritized
        const stageMultiplier =
          cog?.current_state === "dormant" || cog?.current_state === "resolved"
            ? 0.3
            : 1.0;

        const priorityScore =
          ((interest / 100) * timeWeight * stageMultiplier * 100) | 0;

        return {
          id: lead.id,
          name: lead.name,
          phone: lead.phone,
          photo_url: lead.photo_url,
          orbit_stage: lead.orbit_stage,
          last_interaction_at: lead.last_interaction_at,
          days_silent: daysSilent,
          interest_score: interest,
          momentum_score: momentum,
          current_state: cog?.current_state || null,
          silence_reason: analysis?.silence_reason || null,
          strategy: analysis?.strategy || null,
          emotional_state: analysis?.emotional_state || null,
          analysis_confidence: analysis?.confidence || null,
          has_fresh_analysis:
            analysis
              ? (Date.now() - new Date(analysis.analyzed_at).getTime()) /
                  3600000 <
                24
              : false,
          priority_score: priorityScore,
        };
      })
      .filter((l) => l.days_silent >= minDays)
      .sort((a, b) => b.priority_score - a.priority_score)
      .slice(0, limit);

    return NextResponse.json({
      leads: enriched,
      total: enriched.length,
      generated_at: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[REENGAGEMENT QUEUE]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
