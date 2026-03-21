import { NextRequest, NextResponse } from "next/server"
import { getSupabaseServer } from "@/lib/supabase-server"

// ── Pesos por tipo de interação ────────────────────────────────────────────────
const WEIGHTS = {
  sent: 1,
  favorited: 2,
  visited: 4,
  proposal: 3,
  discarded: 0,
}

// Peso extra para leads em estágio avançado
const STAGE_WEIGHTS: Record<string, number> = {
  deciding: 5,
  evaluating: 3,
  exploring: 1,
  curious: 1,
  latent: 0,
  dormant: 0,
  resolved: 0,
}

export type HeatmapMetric = "all" | "sent" | "favorited" | "visited" | "deciding"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const metric = (searchParams.get("metric") || "all") as HeatmapMetric
  const days = parseInt(searchParams.get("days") || "30", 10)

  try {
    const supabase = getSupabaseServer()

    const since = new Date()
    since.setDate(since.getDate() - days)
    const sinceIso = since.toISOString()

    // ── 1. Buscar interações com propriedades e coordenadas ──────────────────
    let interactionsQuery = (supabase as any)
      .from("property_interactions")
      .select(`
        id,
        lead_id,
        property_id,
        interaction_type,
        timestamp,
        properties (
          id,
          lat,
          lng,
          neighborhood,
          city,
          title
        )
      `)
      .gte("timestamp", sinceIso)

    // Filtro por tipo de métrica
    if (metric === "sent") interactionsQuery = interactionsQuery.eq("interaction_type", "sent")
    if (metric === "favorited") interactionsQuery = interactionsQuery.eq("interaction_type", "favorited")
    if (metric === "visited") interactionsQuery = interactionsQuery.eq("interaction_type", "visited")

    const { data: interactions, error: intError } = await interactionsQuery

    if (intError) {
      console.error("[HEATMAP API] Erro ao buscar interações:", intError)
      return NextResponse.json({ error: intError.message }, { status: 500 })
    }

    // ── 2. Buscar leads em estágio avançado (para métrica "deciding") ────────
    let cognitiveLeads: any[] = []
    if (metric === "deciding" || metric === "all") {
      const { data: cog } = await (supabase as any)
        .from("lead_cognitive_state")
        .select("lead_id, current_state, interest_score")
        .in("current_state", ["deciding", "evaluating"])
      cognitiveLeads = cog || []
    }

    const decidingLeadIds = new Set(cognitiveLeads.map((l: any) => l.lead_id))

    // ── 3. Agregar pontos por localização ────────────────────────────────────
    // Cada imóvel com lat/lng vira um ponto. O peso varia por métrica.
    const pointMap = new Map<string, {
      lat: number
      lng: number
      neighborhood: string
      city: string
      weight: number
      count: number
    }>()

    const safeInteractions = interactions || []

    for (const interaction of safeInteractions) {
      const prop = (interaction as any).properties
      if (!prop || !prop.lat || !prop.lng) continue

      const key = `${prop.lat.toFixed(4)},${prop.lng.toFixed(4)}`
      const interactionType = interaction.interaction_type as keyof typeof WEIGHTS
      
      let weight = WEIGHTS[interactionType] ?? 1

      // Boost para leads em decisão
      if (decidingLeadIds.has(interaction.lead_id)) {
        weight += 3
      }

      // Para métrica "deciding", só contar se for lead em estágio avançado
      if (metric === "deciding" && !decidingLeadIds.has(interaction.lead_id)) {
        continue
      }

      const existing = pointMap.get(key)
      if (existing) {
        existing.weight += weight
        existing.count += 1
      } else {
        pointMap.set(key, {
          lat: prop.lat,
          lng: prop.lng,
          neighborhood: prop.neighborhood || "Não identificado",
          city: prop.city || "",
          weight,
          count: 1,
        })
      }
    }

    // ── 4. Normalizar pesos para 0–1 ─────────────────────────────────────────
    const points = Array.from(pointMap.values())
    const maxWeight = points.reduce((max, p) => Math.max(max, p.weight), 1)

    // ── 5. Montar GeoJSON ─────────────────────────────────────────────────────
    const geojson = {
      type: "FeatureCollection",
      features: points.map((p) => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [p.lng, p.lat],
        },
        properties: {
          weight: p.weight / maxWeight,
          rawWeight: p.weight,
          count: p.count,
          neighborhood: p.neighborhood,
          city: p.city,
        },
      })),
    }

    // ── 6. Agregar por bairro para o painel lateral ───────────────────────────
    const neighborhoodMap = new Map<string, {
      neighborhood: string
      city: string
      totalWeight: number
      totalCount: number
      lat: number
      lng: number
    }>()

    for (const p of points) {
      const key = p.neighborhood || "Não identificado"
      const existing = neighborhoodMap.get(key)
      if (existing) {
        existing.totalWeight += p.weight
        existing.totalCount += p.count
      } else {
        neighborhoodMap.set(key, {
          neighborhood: p.neighborhood,
          city: p.city,
          totalWeight: p.weight,
          totalCount: p.count,
          lat: p.lat,
          lng: p.lng,
        })
      }
    }

    const neighborhoods = Array.from(neighborhoodMap.values())
      .sort((a, b) => b.totalWeight - a.totalWeight)
      .slice(0, 20)
      .map((n) => ({
        ...n,
        score: Math.round((n.totalWeight / maxWeight) * 100),
      }))

    return NextResponse.json({
      geojson,
      neighborhoods,
      totalPoints: points.length,
      metric,
      days,
    })
  } catch (err: any) {
    console.error("[HEATMAP API] Erro crítico:", err)
    return NextResponse.json({ error: err.message || "Erro interno" }, { status: 500 })
  }
}
