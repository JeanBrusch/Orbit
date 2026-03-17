import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy-key',
})

// ─── Embedding ────────────────────────────────────────────────────────────────

async function generateEmbedding(content: string): Promise<number[] | null> {
  if (!process.env.OPENAI_API_KEY) return null
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: content.slice(0, 2000), // cap to avoid token overflow
    })
    return response.data[0].embedding || null
  } catch {
    return null
  }
}

// ─── Intent Parser ─────────────────────────────────────────────────────────────

interface ParsedIntent {
  nameSearch: string | null
  semanticSearch: string | null
  memoryTypeHints: string[]  // e.g. ["location_preference", "budget_range"]
  filters: {
    estado_atual: string | null
    tem_capsula_ativa: boolean | null
  }
}

async function parseIntent(query: string): Promise<ParsedIntent> {
  if (!process.env.OPENAI_API_KEY) {
    return { nameSearch: query, semanticSearch: query, memoryTypeHints: [], filters: { estado_atual: null, tem_capsula_ativa: null } }
  }

  try {
    const prompt = `You are a search intent parser for a luxury real estate CRM.
Analyze the user's natural language query and extract structured search parameters.

Memory types available: identity, budget_range, location_preference, property_type, feature_preference, current_search, location_focus, budget, priority, intent, preference, constraint, pain

Return JSON with this exact shape:
{
  "nameSearch": string | null,
  "semanticSearch": string | null,
  "memoryTypeHints": string[],
  "filters": {
    "estado_atual": string | null,
    "tem_capsula_ativa": boolean | null
  }
}

Rules:
- nameSearch: only when searching for a specific person by name
- semanticSearch: the conceptual / behavioral query (use even alongside nameSearch)
- memoryTypeHints: which memory types are likely relevant to this query
- filters.estado_atual: map to "ativo", "quente", "morno", "frio", "pausado" if detected
- filters.tem_capsula_ativa: true only if they explicitly mention sent portal/capsule

User Query: "${query}"`

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Real estate CRM intent parser. Respond only in JSON.' },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0,
    })

    const parsed = JSON.parse(response.choices[0].message.content || '{}')
    return {
      nameSearch: parsed.nameSearch || null,
      semanticSearch: parsed.semanticSearch || null,
      memoryTypeHints: parsed.memoryTypeHints || [],
      filters: {
        estado_atual: parsed.filters?.estado_atual || null,
        tem_capsula_ativa: parsed.filters?.tem_capsula_ativa ?? null,
      },
    }
  } catch {
    return { nameSearch: query, semanticSearch: query, memoryTypeHints: [], filters: { estado_atual: null, tem_capsula_ativa: null } }
  }
}

// ─── Enrich lead results with full data ───────────────────────────────────────

async function enrichLeadResults(
  leadMap: Map<string, { leadId: string; relevanceScore: number; matchReason: string; snippet: string }>,
  supabase: ReturnType<typeof getSupabaseServer>
) {
  if (leadMap.size === 0) return []

  const ids = Array.from(leadMap.keys())

  // Fetch full lead data + cognitive state in one query
  const { data: leads } = await (supabase
    .from('leads') as any)
    .select(`
      id, name, photo_url, orbit_stage, last_interaction_at, action_suggested,
      lead_cognitive_state (
        interest_score, momentum_score, risk_score, current_state, last_ai_analysis_at
      )
    `)
    .in('id', ids)

  const leadDataMap = new Map<string, any>()
  for (const l of leads || []) {
    leadDataMap.set(l.id, {
      ...l,
      interest_score: l.lead_cognitive_state?.[0]?.interest_score ?? null,
      momentum_score: l.lead_cognitive_state?.[0]?.momentum_score ?? null,
      current_state: l.lead_cognitive_state?.[0]?.current_state ?? l.orbit_stage ?? null,
      last_ai_analysis_at: l.lead_cognitive_state?.[0]?.last_ai_analysis_at ?? null,
    })
  }

  return Array.from(leadMap.entries())
    .map(([id, result]) => {
      const detail = leadDataMap.get(id) || {}
      return {
        id,
        leadId: id,
        name: detail.name || 'Sem nome',
        photo_url: detail.photo_url || null,
        orbit_stage: detail.current_state || detail.orbit_stage || null,
        current_state: detail.current_state || null,
        last_interaction_at: detail.last_interaction_at || null,
        interest_score: detail.interest_score,
        momentum_score: detail.momentum_score,
        action_suggested: detail.action_suggested,
        relevanceScore: result.relevanceScore,
        matchReason: result.matchReason,
        snippet: result.snippet,
        // Compatibility fields for orbit-context shape
        stage: detail.current_state || detail.orbit_stage || '',
        lastInteraction: detail.last_interaction_at || '',
        intent: result.matchReason,
      }
    })
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
}

// ─── POST Handler ──────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { query, sourceLeadId, limit = 20 } = body

    if (!query || typeof query !== 'string' || !query.trim()) {
      return NextResponse.json({ error: 'query is required' }, { status: 400 })
    }

    const supabase = getSupabaseServer()
    const rawQuery = query.trim()

    // Parse intent (async, parallel with embedding generation)
    const [intent, queryEmbedding] = await Promise.all([
      parseIntent(rawQuery),
      generateEmbedding(rawQuery),
    ])

    const leadResults = new Map<string, {
      leadId: string
      relevanceScore: number
      matchReason: string
      snippet: string
    }>()

    // ── LAYER 1: Semantic Vector Search (highest fidelity) ──────────────────
    // Searches leads.semantic_vector — composite vector updated by orbit-core
    // on every event. Represents full accumulated cognitive profile of the lead.
    if (queryEmbedding) {
      try {
        const { data: vectorMatches, error: vecError } = await (supabase as any).rpc(
          'match_leads_by_vector',
          {
            query_embedding: queryEmbedding,
            match_threshold: 0.55, // calibrated for composite vectors
            match_count: limit,
          }
        )

        if (!vecError && vectorMatches?.length > 0) {
          for (const match of vectorMatches) {
            if (!leadResults.has(match.lead_id)) {
              leadResults.set(match.lead_id, {
                leadId: match.lead_id,
                relevanceScore: Math.min(1.0, match.similarity * 1.1), // slight boost for vector match
                matchReason: 'Perfil cognitivo compatível',
                snippet: `Similaridade semântica: ${Math.round(match.similarity * 100)}%`,
              })
            }
          }
        }
      } catch {
        // RPC may not exist yet — proceed to other layers
      }
    }

    // ── LAYER 2: Memory Items by Type ───────────────────────────────────────
    // Searches memory_items — the structured semantic memory extracted from
    // every conversation. More precise than text search for profiled attributes.
    if (intent.semanticSearch || intent.memoryTypeHints.length > 0) {
      const memoryQuery = intent.semanticSearch || rawQuery

      let memBuilder = (supabase.from('memory_items') as any)
        .select('lead_id, type, content, confidence')
        .ilike('content', `%${memoryQuery}%`)
        .limit(limit * 2)

      // Bias toward relevant memory types if detected
      if (intent.memoryTypeHints.length > 0) {
        memBuilder = memBuilder.in('type', intent.memoryTypeHints)
      }

      const { data: memMatches } = await memBuilder

      for (const mem of memMatches || []) {
        if (!mem.lead_id) continue
        const existing = leadResults.get(mem.lead_id)
        // Memory type match is authoritative — score 0.80, boosted by confidence
        const memScore = 0.75 + ((mem.confidence || 50) / 100) * 0.15
        if (!existing || memScore > existing.relevanceScore) {
          const typeLabel: Record<string, string> = {
            location_preference: 'Preferência de local', budget_range: 'Orçamento compatível',
            property_type: 'Tipo de imóvel', feature_preference: 'Características',
            intent: 'Intenção detectada', preference: 'Preferência', constraint: 'Restrição',
          }
          leadResults.set(mem.lead_id, {
            leadId: mem.lead_id,
            relevanceScore: memScore,
            matchReason: typeLabel[mem.type] || 'Memória compatível',
            snippet: mem.content.substring(0, 140) + (mem.content.length > 140 ? '…' : ''),
          })
        }
      }
    }

    // ── LAYER 3: Name Search ─────────────────────────────────────────────────
    if (intent.nameSearch) {
      let nameBuilder = (supabase.from('leads_center') as any)
        .select('lead_id, name')
        .ilike('name', `%${intent.nameSearch}%`)
      if (intent.filters.estado_atual) nameBuilder = nameBuilder.eq('estado_atual', intent.filters.estado_atual)
      if (intent.filters.tem_capsula_ativa !== null) nameBuilder = nameBuilder.eq('tem_capsula_ativa', intent.filters.tem_capsula_ativa)

      const { data: nameMatches } = await nameBuilder

      for (const row of nameMatches || []) {
        if (!row.lead_id) continue
        // Name match always wins on score
        leadResults.set(row.lead_id, {
          leadId: row.lead_id,
          relevanceScore: 1.0,
          matchReason: 'Nome encontrado',
          snippet: row.name || '',
        })
      }
    }

    // ── LAYER 4: Internal Notes Text Search (fallback) ───────────────────────
    // Only runs if layers 1-3 found fewer than 3 results
    if (leadResults.size < 3 && intent.semanticSearch) {
      const { data: notes } = await (supabase.from('internal_notes') as any)
        .select('lead_id, content')
        .ilike('content', `%${intent.semanticSearch}%`)
        .limit(limit)

      for (const note of notes || []) {
        if (!note.lead_id) continue
        const existing = leadResults.get(note.lead_id)
        if (!existing) {
          leadResults.set(note.lead_id, {
            leadId: note.lead_id,
            relevanceScore: 0.55,
            matchReason: 'Mencionado em notas',
            snippet: note.content.substring(0, 140) + (note.content.length > 140 ? '…' : ''),
          })
        }
      }
    }

    // ── LAYER 5: Status Filter Only ──────────────────────────────────────────
    if (leadResults.size === 0 && (intent.filters.estado_atual || intent.filters.tem_capsula_ativa !== null)) {
      let filterBuilder = (supabase.from('leads_center') as any)
        .select('lead_id, estado_atual, name')
        .limit(limit)
      if (intent.filters.estado_atual) filterBuilder = filterBuilder.eq('estado_atual', intent.filters.estado_atual)
      if (intent.filters.tem_capsula_ativa !== null) filterBuilder = filterBuilder.eq('tem_capsula_ativa', intent.filters.tem_capsula_ativa)

      const { data: filtered } = await filterBuilder
      for (const row of filtered || []) {
        if (row.lead_id && !leadResults.has(row.lead_id)) {
          leadResults.set(row.lead_id, {
            leadId: row.lead_id,
            relevanceScore: 0.5,
            matchReason: 'Filtro de status',
            snippet: `Status: ${row.estado_atual || '—'}`,
          })
        }
      }
    }

    // Apply status filters to results from other layers
    if (intent.filters.estado_atual || intent.filters.tem_capsula_ativa !== null) {
      const ids = Array.from(leadResults.keys())
      if (ids.length > 0) {
        let checkBuilder = (supabase.from('leads_center') as any)
          .select('lead_id, estado_atual, tem_capsula_ativa')
          .in('lead_id', ids)
        const { data: checks } = await checkBuilder
        const validIds = new Set<string>()
        for (const check of checks || []) {
          const passesState = !intent.filters.estado_atual || check.estado_atual === intent.filters.estado_atual
          const passesCapsule = intent.filters.tem_capsula_ativa === null || check.tem_capsula_ativa === intent.filters.tem_capsula_ativa
          if (passesState && passesCapsule) validIds.add(check.lead_id)
        }
        for (const id of ids) {
          if (!validIds.has(id)) leadResults.delete(id)
        }
      }
    }

    // Exclude self if searching from a lead context
    if (sourceLeadId) leadResults.delete(sourceLeadId)

    // ── Enrich and return ────────────────────────────────────────────────────
    const enriched = await enrichLeadResults(leadResults, supabase)
    const finalResults = enriched.slice(0, limit)

    return NextResponse.json({
      query: rawQuery,
      parsedIntent: intent,
      results: finalResults,
      method: 'cognitive_search_v2',
      layers_hit: {
        vector: leadResults.size > 0,
        memory: intent.memoryTypeHints.length > 0,
        name: !!intent.nameSearch,
      },
    })
  } catch (err) {
    console.error('Error in POST /api/search/orbit:', err)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
