import { NextRequest, NextResponse } from "next/server"
import { getSupabaseServer } from "@/lib/supabase-server"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const neighborhood = searchParams.get("neighborhood")
  const days = parseInt(searchParams.get("days") || "30", 10)

  if (!neighborhood) {
    return NextResponse.json({ error: "neighborhood é obrigatório" }, { status: 400 })
  }

  try {
    const supabase = getSupabaseServer()

    const since = new Date()
    since.setDate(since.getDate() - days)

    // Buscar IDs de imóveis no bairro
    const { data: props } = await (supabase as any)
      .from("properties")
      .select("id")
      .ilike("neighborhood", `%${neighborhood}%`)

    const propertyIds = (props || []).map((p: any) => p.id)

    if (propertyIds.length === 0) {
      return NextResponse.json({ leads: [] })
    }

    // Buscar leads que interagiram com esses imóveis
    const { data: interactions } = await (supabase as any)
      .from("property_interactions")
      .select("lead_id")
      .in("property_id", propertyIds)
      .gte("timestamp", since.toISOString())

    const leadIds = [...new Set((interactions || []).map((i: any) => i.lead_id).filter(Boolean))]

    if (leadIds.length === 0) {
      return NextResponse.json({ leads: [] })
    }

    // Buscar dados dos leads + estado cognitivo
    const { data: leadsData } = await (supabase as any)
      .from("leads")
      .select("id, name, photo_url, orbit_stage")
      .in("id", leadIds.slice(0, 20))

    const { data: cogData } = await (supabase as any)
      .from("lead_cognitive_state")
      .select("lead_id, interest_score, momentum_score, current_state")
      .in("lead_id", leadIds.slice(0, 20))

    const cogMap = new Map<string, any>((cogData || []).map((c: any) => [c.lead_id as string, c as any]))

    const leads = (leadsData || []).map((l: any) => {
      const cog = cogMap.get(l.id)
      return {
        id: l.id,
        name: l.name || "Lead",
        photo_url: l.photo_url,
        orbit_stage: cog?.current_state || l.orbit_stage || "latent",
        interest_score: cog?.interest_score ?? 50,
        momentum_score: cog?.momentum_score ?? 50,
      }
    }).sort((a: any, b: any) => {
      // Ordenar por estágio (deciding primeiro), depois por interest_score
      const stageOrder: Record<string, number> = { deciding: 0, evaluating: 1, exploring: 2, curious: 3, latent: 4, dormant: 5 }
      const aOrder = stageOrder[a.orbit_stage] ?? 6
      const bOrder = stageOrder[b.orbit_stage] ?? 6
      if (aOrder !== bOrder) return aOrder - bOrder
      return b.interest_score - a.interest_score
    })

    return NextResponse.json({ leads })
  } catch (err: any) {
    console.error("[HEATMAP LEADS API] Erro:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
