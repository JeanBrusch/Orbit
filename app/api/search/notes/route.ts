import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'
import { generateEmbedding } from '@/lib/orbit-core'

// generateEmbedding is now imported from @/lib/orbit-core

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { query, sourceLeadId, limit = 15 } = body

    if (!query || typeof query !== 'string' || query.trim() === '') {
      return NextResponse.json(
        { error: 'query é obrigatório' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseServer()
    const trimmedQuery = query.trim()
    
    const queryEmbedding = await generateEmbedding(trimmedQuery)
    
    if (!queryEmbedding) {
      const { data: notes } = await supabase
        .from('internal_notes')
        .select('id, lead_id, content, created_at')
        .ilike('content', `%${trimmedQuery}%`)
        .order('created_at', { ascending: false })
        .limit(limit)
      
      const leadMap = new Map<string, { leadId: string; noteSnippet: string; noteCreatedAt: string; relevanceScore: number }>()
      
      for (const note of notes || []) {
        if (note.lead_id && !leadMap.has(note.lead_id)) {
          leadMap.set(note.lead_id, {
            leadId: note.lead_id,
            noteSnippet: note.content.substring(0, 150) + (note.content.length > 150 ? '...' : ''),
            noteCreatedAt: note.created_at || new Date().toISOString(),
            relevanceScore: 0.7,
          })
        }
      }
      
      return NextResponse.json({
        query: trimmedQuery,
        results: Array.from(leadMap.values()),
        method: 'text_search',
      })
    }

    const { data: embeddingResults, error: embeddingError } = await supabase.rpc(
      'match_capsule_embeddings',
      {
        query_embedding: queryEmbedding,
        match_threshold: 0.3,
        match_count: limit * 2,
      }
    )

    if (embeddingError) {
      console.error('[SEARCH] Embedding search error:', embeddingError)
      const { data: notes } = await supabase
        .from('internal_notes')
        .select('id, lead_id, content, created_at')
        .ilike('content', `%${trimmedQuery}%`)
        .order('created_at', { ascending: false })
        .limit(limit)
      
      const leadMap = new Map<string, { leadId: string; noteSnippet: string; noteCreatedAt: string; relevanceScore: number }>()
      
      for (const note of notes || []) {
        if (note.lead_id && !leadMap.has(note.lead_id)) {
          leadMap.set(note.lead_id, {
            leadId: note.lead_id,
            noteSnippet: note.content.substring(0, 150) + (note.content.length > 150 ? '...' : ''),
            noteCreatedAt: note.created_at || new Date().toISOString(),
            relevanceScore: 0.7,
          })
        }
      }
      
      return NextResponse.json({
        query: trimmedQuery,
        results: Array.from(leadMap.values()),
        method: 'text_search_fallback',
      })
    }

    const capsuleItemIds = (embeddingResults || []).map((r: { capsule_item_id: string }) => r.capsule_item_id)
    
    if (capsuleItemIds.length === 0) {
      return NextResponse.json({
        query: trimmedQuery,
        results: [],
        method: 'semantic_search',
      })
    }

    const { data: capsuleItems } = await supabase
      .from('capsule_items')
      .select('id, capsule_id, content, created_at')
      .in('id', capsuleItemIds)
      .eq('type', 'note')

    const capsuleIds = [...new Set((capsuleItems || []).map((item: { capsule_id: string }) => item.capsule_id))]
    
    const { data: capsules } = await supabase
      .from('capsules')
      .select('id, lead_id')
      .in('id', capsuleIds)

    const capsuleToLeadMap = new Map<string, string>()
    for (const capsule of capsules || []) {
      capsuleToLeadMap.set(capsule.id, capsule.lead_id)
    }

    const leadMap = new Map<string, { leadId: string; noteSnippet: string; noteCreatedAt: string; relevanceScore: number }>()
    
    for (const item of capsuleItems || []) {
      const leadId = capsuleToLeadMap.get(item.capsule_id)
      if (!leadId) continue
      
      const similarity = embeddingResults.find((r: { capsule_item_id: string; similarity: number }) => 
        r.capsule_item_id === item.id
      )?.similarity || 0
      
      const existing = leadMap.get(leadId)
      if (!existing || similarity > existing.relevanceScore) {
        leadMap.set(leadId, {
          leadId,
          noteSnippet: item.content.substring(0, 150) + (item.content.length > 150 ? '...' : ''),
          noteCreatedAt: item.created_at || new Date().toISOString(),
          relevanceScore: similarity,
        })
      }
    }

    const results = Array.from(leadMap.values())
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit)

    return NextResponse.json({
      query: trimmedQuery,
      results,
      method: 'semantic_search',
    })
  } catch (err) {
    console.error('Error in POST /api/search/notes:', err)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
