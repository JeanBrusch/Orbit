import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy-key',
})

async function generateEmbedding(content: string): Promise<number[] | null> {
  if (!process.env.OPENAI_API_KEY) {
    return null
  }
  
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: content,
    })
    return response.data[0].embedding || null
  } catch (err) {
    console.error('[SEARCH] Error generating query embedding with OpenAI:', err)
    return null
  }
}

interface ParsedIntent {
  nameSearch: string | null;
  semanticSearch: string | null;
  filters: {
    estado_atual: string | null;
    tem_capsula_ativa: boolean | null;
  }
}

async function parseIntent(query: string): Promise<ParsedIntent> {
  if (!process.env.OPENAI_API_KEY) {
    return {
      nameSearch: query,
      semanticSearch: query,
      filters: { estado_atual: null, tem_capsula_ativa: null }
    }
  }

  try {
    const prompt = `You are a search intent parser for a real estate CRM.
Analyze the user's natural language query and extract structured search parameters.
Return a JSON object exactly with this shape:
{
  "nameSearch": string | null, // If they are looking for a specific person's name or part of it (e.g., "joão silva", "maria")
  "semanticSearch": string | null, // The concept or property type they want (e.g., "apartamento com piscina", "vista mar")
  "filters": {
    "estado_atual": string | null, // Try to map to: "ativo", "quente", "morno", "frio", "pausado"
    "tem_capsula_ativa": boolean | null // True if they mention they sent a properties capsule
  }
}
If a field is not present in the intent, leave it as null.

User Query: "${query}"`

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a search intent parser for a real estate CRM. Respond only in JSON." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0,
    })
    
    const parsed = JSON.parse(response.choices[0].message.content || "{}")
    return {
      nameSearch: parsed.nameSearch || null,
      semanticSearch: parsed.semanticSearch || null,
      filters: {
        estado_atual: parsed.filters?.estado_atual || null,
        tem_capsula_ativa: parsed.filters?.tem_capsula_ativa !== undefined ? parsed.filters.tem_capsula_ativa : null
      }
    }
  } catch (err) {
    console.error('[SEARCH] Error parsing intent with OpenAI:', err)
    // Fallback
    return {
      nameSearch: query,
      semanticSearch: query,
      filters: { estado_atual: null, tem_capsula_ativa: null }
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { query, sourceLeadId, limit = 20 } = body

    if (!query || typeof query !== 'string' || query.trim() === '') {
      return NextResponse.json(
        { error: 'query is required' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseServer()
    const rawQuery = query.trim()
    
    // Parse Intent via AI
    const intent = await parseIntent(rawQuery)
    
    const leadResults = new Map<string, {
      leadId: string
      relevanceScore: number
      matchReason: string
      snippet: string
    }>()

    // 1. Exact/Partial Name Search
    if (intent.nameSearch) {
      let queryBuilder = supabase.from('leads_center').select('lead_id, name').ilike('name', `%${intent.nameSearch}%`)
      if (intent.filters.estado_atual) queryBuilder = queryBuilder.eq('estado_atual', intent.filters.estado_atual)
      if (intent.filters.tem_capsula_ativa !== null) queryBuilder = queryBuilder.eq('tem_capsula_ativa', intent.filters.tem_capsula_ativa)

      const { data: nameMatches } = await queryBuilder

      for (const row of nameMatches || []) {
        if (row.lead_id && !leadResults.has(row.lead_id)) {
          leadResults.set(row.lead_id, {
            leadId: row.lead_id,
            relevanceScore: 1.0, // Exact name match is highest priority
            matchReason: "Nome encontrado",
            snippet: row.name || ''
          })
        }
      }
    }

    // 2. Semantic Search (Notes & Capsules)
    if (intent.semanticSearch) {
      const queryEmbedding = await generateEmbedding(intent.semanticSearch)
      
      if (queryEmbedding) {
        // Try embedding search on capsules
        const { data: embeddingResults, error: embeddingError } = await supabase.rpc(
          'match_capsule_embeddings',
          {
            query_embedding: queryEmbedding,
            match_threshold: 0.3,
            match_count: limit,
          }
        )

        if (!embeddingError && embeddingResults?.length > 0) {
          const capsuleItemIds = embeddingResults.map((r: any) => r.capsule_item_id)
          const { data: capsuleItems } = await supabase
            .from('capsule_items')
            .select('id, capsule_id, content')
            .in('id', capsuleItemIds)
          
          const capsuleIds = [...new Set((capsuleItems || []).map((i: any) => i.capsule_id))]
          const { data: capsules } = await supabase.from('capsules').select('id, lead_id').in('id', capsuleIds)
          
          const capsuleToLeadMap = new Map<string, string>()
          for (const c of capsules || []) capsuleToLeadMap.set(c.id, c.lead_id)

          for (const item of capsuleItems || []) {
            const leadId = capsuleToLeadMap.get(item.capsule_id)
            if (!leadId) continue

            const similarity = embeddingResults.find((r: any) => r.capsule_item_id === item.id)?.similarity || 0.4
            
            // Apply Intent Filters on the Lead
            if (intent.filters.estado_atual || intent.filters.tem_capsula_ativa !== null) {
              const { data: leadCheck } = await supabase.from('leads_center').select('estado_atual, tem_capsula_ativa').eq('lead_id', leadId).single()
              
              if (leadCheck) {
                if (intent.filters.estado_atual && leadCheck.estado_atual !== intent.filters.estado_atual) continue
                if (intent.filters.tem_capsula_ativa !== null && leadCheck.tem_capsula_ativa !== intent.filters.tem_capsula_ativa) continue
              }
            }

            const existing = leadResults.get(leadId)
            if (!existing || similarity > existing.relevanceScore) {
              leadResults.set(leadId, {
                leadId,
                relevanceScore: similarity,
                matchReason: "Contexto imobiliário similar",
                snippet: item.content?.substring(0, 150) + (item.content?.length > 150 ? '...' : '') || 'Encontrado no contexto',
              })
            }
          }
        }
      }

      // 3. Fallback/Extra Text Search in Internal Notes
      if (!queryEmbedding || leadResults.size === 0) {
        let noteQuery = supabase.from('internal_notes').select('lead_id, content').ilike('content', `%${intent.semanticSearch}%`).limit(limit)
        const { data: notes } = await noteQuery

        for (const note of notes || []) {
          if (note.lead_id) {
            
            // Apply Intent Filters on the Lead
            if (intent.filters.estado_atual || intent.filters.tem_capsula_ativa !== null) {
              const { data: leadCheck } = await supabase.from('leads_center').select('estado_atual, tem_capsula_ativa').eq('lead_id', note.lead_id).single()
              
              if (leadCheck) {
                if (intent.filters.estado_atual && leadCheck.estado_atual !== intent.filters.estado_atual) continue
                if (intent.filters.tem_capsula_ativa !== null && leadCheck.tem_capsula_ativa !== intent.filters.tem_capsula_ativa) continue
              }
            }

            const existing = leadResults.get(note.lead_id)
            if (!existing || 0.6 > existing.relevanceScore) {
              leadResults.set(note.lead_id, {
                leadId: note.lead_id,
                relevanceScore: 0.6,
                matchReason: "Mencionado em notas",
                snippet: note.content.substring(0, 150) + (note.content.length > 150 ? '...' : '')
              })
            }
          }
        }
      }
    }

    // If only filters were caught, apply them directly
    if (!intent.nameSearch && !intent.semanticSearch && (intent.filters.estado_atual || intent.filters.tem_capsula_ativa !== null)) {
      let queryBuilder = supabase.from('leads_center').select('lead_id, estado_atual, tem_capsula_ativa').limit(limit)
      
      if (intent.filters.estado_atual) queryBuilder = queryBuilder.eq('estado_atual', intent.filters.estado_atual)
      if (intent.filters.tem_capsula_ativa !== null) queryBuilder = queryBuilder.eq('tem_capsula_ativa', intent.filters.tem_capsula_ativa)
      
      const { data: filtered } = await queryBuilder
      
      for (const row of filtered || []) {
        if (row.lead_id && !leadResults.has(row.lead_id)) {
          leadResults.set(row.lead_id, {
            leadId: row.lead_id,
            relevanceScore: 0.5,
            matchReason: "Filtro de status aplicado",
            snippet: `Lead com estado ${row.estado_atual}`
          })
        }
      }
    }

    // Sort by relevance
    const results = Array.from(leadResults.values())
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit)

    return NextResponse.json({
      query: rawQuery,
      parsedIntent: intent,
      results,
      method: 'cognitive_search',
    })

  } catch (err) {
    console.error('Error in POST /api/search/orbit:', err)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
