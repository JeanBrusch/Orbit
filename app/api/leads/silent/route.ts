import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseServer();

    // Buscar leads que não tiveram interação nos últimos 3 dias
    // E que não estão em estágio 'resolved'
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const { data, error } = await supabase
      .from("leads")
      .select(`
        id,
        name,
        phone,
        photo_url,
        last_interaction_at,
        orbit_stage,
        lead_cognitive_state (
            interest_score,
            momentum_score,
            current_state,
            central_conflict
        ),
        silence_analyses (
            silence_reason,
            strategy,
            analyzed_at
        )
      `)
      .not("orbit_stage", "eq", "resolved")
      .lt("last_interaction_at", threeDaysAgo.toISOString())
      .order("last_interaction_at", { ascending: false });

    if (error) throw error;

    // Mapear para o formato esperado pelo frontend
    const leads = (data || []).map((l: any) => {
      const lastInteraction = new Date(l.last_interaction_at);
      const daysSilent = Math.floor((Date.now() - lastInteraction.getTime()) / (1000 * 60 * 60 * 24));
      
      const cog = l.lead_cognitive_state?.[0] || l.lead_cognitive_state || {};
      const analysis = l.silence_analyses?.[0] || l.silence_analyses || null;

      return {
        id: l.id,
        name: l.name,
        phone: l.phone,
        photo_url: l.photo_url,
        days_silent: daysSilent,
        interest_score: cog.interest_score || 0,
        momentum_score: cog.momentum_score || 0,
        current_state: l.orbit_stage,
        silence_reason: analysis?.silence_reason || null,
        strategy: analysis?.strategy || null,
        has_fresh_analysis: !!analysis,
        // Score de prioridade simples: Interesse + (Dias de Silêncio * 2)
        priority_score: (cog.interest_score || 0) + (daysSilent * 2)
      };
    });

    // Ordenar por prioridade
    leads.sort((a, b) => b.priority_score - a.priority_score);

    return NextResponse.json(leads);
  } catch (error) {
    console.error("[SILENT LEADS] Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
