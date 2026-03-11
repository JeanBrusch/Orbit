import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const propertyId = searchParams.get('propertyId')
    const limit = parseInt(searchParams.get('limit') || '5', 10)

    if (!propertyId) {
      return NextResponse.json({ error: 'propertyId is required' }, { status: 400 })
    }

    const supabase = getSupabaseServer()

    // 1. Obter o imóvel e seu embedding
    const { data: property, error: propError } = await supabase
      .from('properties')
      .select('id, title, property_embedding, value, neighborhood')
      .eq('id', propertyId)
      .single()

    if (propError || !property) {
      console.error('Property fetch error:', propError)
      return NextResponse.json({ error: 'Property not found' }, { status: 404 })
    }

    if (!property.property_embedding) {
      return NextResponse.json({ 
        matches: [], 
        message: 'Property has no semantic embedding yet' 
      })
    }

    // 2. Buscar Leads Compatíveis via RPC de Similaridade de Cosseno no pgvector
    // Assumimos que a função RPC `match_leads` será criada no banco
    const { data: matches, error: matchError } = await supabase.rpc('match_leads', {
      query_embedding: property.property_embedding,
      match_threshold: 0.75, // Ajuste empírico (75% de similaridade mínima)
      match_count: limit,
    })

    if (matchError) {
      // Fallback: se a RPC não existir ou falhar, buscamos os leads ativos e calculamos similaridade na aplicação (menos eficiente, mas garante funcionamento)
      console.warn('RPC match_leads failed or does not exist. Using fallback application-side matching.', matchError)
      
      const { data: allLeads } = await supabase
        .from('leads')
        .select(`
          id, name, phone, photo_url, orbit_stage, semantic_vector, 
          lead_cognitive_state (current_state)
        `)
        .not('semantic_vector', 'is', null)

      if (!allLeads || allLeads.length === 0) {
        return NextResponse.json({ matches: [] })
      }

      // Função auxiliar para similaridade de cosseno
      const cosineSimilarity = (vecA: number[], vecB: number[]) => {
        let dotProduct = 0; let normA = 0; let normB = 0;
        for (let i = 0; i < Math.min(vecA.length, vecB.length); i++) {
          dotProduct += vecA[i] * vecB[i];
          normA += vecA[i] * vecA[i];
          normB += vecB[i] * vecB[i];
        }
        if (normA === 0 || normB === 0) return 0;
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
      }

      const calculatedMatches = allLeads.map(lead => {
        const similarity = cosineSimilarity(property.property_embedding, lead.semantic_vector as number[])
        return {
          id: lead.id,
          name: lead.name,
          photo_url: lead.photo_url,
          orbit_stage: lead.orbit_stage || lead.lead_cognitive_state?.[0]?.current_state || 'latent',
          similarity: Number(similarity.toFixed(4)),
        }
      })
      .filter(m => m.similarity >= 0.70) // Threshold mais permissivo no fallback
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)

      return NextResponse.json({ matches: calculatedMatches })
    }

    // Se a RPC funcionou, formata o retorno
    return NextResponse.json({ matches })

  } catch (error) {
    console.error('Predictive match error:', error)
    return NextResponse.json(
      { error: 'Failed to compute predictive match' },
      { status: 500 }
    )
  }
}
