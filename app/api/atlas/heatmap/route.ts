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
  
  const minPrice = searchParams.get("minPrice") ? parseInt(searchParams.get("minPrice")!) : null
  const maxPrice = searchParams.get("maxPrice") ? parseInt(searchParams.get("maxPrice")!) : null
  const bedrooms = searchParams.get("bedrooms") ? parseInt(searchParams.get("bedrooms")!) : null
  const neighborhoodsFilter = searchParams.get("neighborhoods") ? searchParams.get("neighborhoods")!.split(",") : []

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
          title,
          value,
          bedrooms
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

    // ── 1b. Buscar propriedades enviadas via Curadoria (capsule_items) ──────
    // Este dado é complementar ao property_interactions pois representa o "envio"
    let capsuleSent: any[] = []
    if (metric === "all" || metric === "sent") {
      const { data: caps } = await (supabase as any)
        .from("capsule_items")
        .select(`
          id,
          lead_id,
          property_id,
          state,
          created_at,
          properties (
            id,
            lat,
            lng,
            neighborhood,
            city,
            title,
            value,
            bedrooms
          )
        `)
        .eq("state", "sent")
        .gte("created_at", sinceIso)
      
      capsuleSent = caps || []
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
    
    // Normaliza os dados de ambas as fontes
    const allDataPoints = [
      ...safeInteractions.map((i: any) => ({
        lead_id: i.lead_id,
        property_id: i.property_id,
        type: i.interaction_type,
        properties: i.properties
      })),
      ...capsuleSent.map((c: any) => ({
        lead_id: c.lead_id,
        property_id: c.property_id,
        type: 'sent', // Normalizado para sent se vem de capsule_items
        properties: c.properties
      }))
    ]

    // De-duplicação por lead/imóvel/tipo de interação para não inflar artificialmente o heatmap
    const uniquePoints = new Map<string, any>()
    for (const p of allDataPoints) {
      const key = `${p.lead_id}-${p.property_id}-${p.type}`
      if (!uniquePoints.has(key)) {
        uniquePoints.set(key, p)
      }
    }

    const processedPoints = Array.from(uniquePoints.values())

    for (const datapoint of processedPoints) {
      const prop = datapoint.properties
      if (!prop || !prop.lat || !prop.lng) continue

      // Aplica filtros de propriedade na agregação do heatmap
      if (minPrice !== null && (prop.value || 0) < minPrice) continue
      if (maxPrice !== null && (prop.value || 0) > maxPrice) continue
      if (bedrooms !== null) {
          const b = prop.bedrooms || 0
          if (bedrooms === 4) { if (b < 4) continue }
          else if (b !== bedrooms) continue
      }
      if (neighborhoodsFilter.length > 0 && prop.neighborhood && !neighborhoodsFilter.includes(prop.neighborhood)) {
          continue
      }

      const key = `${prop.lat.toFixed(4)},${prop.lng.toFixed(4)}`
      const interactionType = datapoint.type as keyof typeof WEIGHTS
      
      let weight = WEIGHTS[interactionType] ?? 1

      // Boost para leads em decisão
      if (decidingLeadIds.has(datapoint.lead_id)) {
        weight += 3
      }

      // Para métrica "deciding", só contar se for lead em estágio avançado
      if (metric === "deciding" && !decidingLeadIds.has(datapoint.lead_id)) {
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
