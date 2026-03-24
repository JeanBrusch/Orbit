import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { getSupabaseServer } from '@/lib/supabase-server'
import { trackAICall } from '@/lib/observability'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const { query, minPrice, maxPrice, bedrooms, neighborhoods } = await request.json()

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    const supabase = getSupabaseServer()
    let dbQuery = supabase
      .from('properties')
      .select('id, title, internal_name, neighborhood, area_privativa, bedrooms, suites, value, features, location_text')

    if (minPrice !== null && minPrice !== undefined) {
      dbQuery = dbQuery.gte('value', minPrice)
    }
    if (maxPrice !== null && maxPrice !== undefined) {
      dbQuery = dbQuery.lte('value', maxPrice)
    }
    if (bedrooms !== null && bedrooms !== undefined) {
      if (bedrooms === 4) {
        dbQuery = dbQuery.gte('bedrooms', 4)
      } else {
        dbQuery = dbQuery.eq('bedrooms', bedrooms)
      }
    }
    if (neighborhoods && Array.isArray(neighborhoods) && neighborhoods.length > 0) {
      dbQuery = dbQuery.in('neighborhood', neighborhoods)
    }

    const { data, error: dbError } = await (dbQuery as any)
    const properties = data || []

    if (dbError) throw dbError

    const propertiesContext = properties.map((p: any) => ({
      id: p.id,
      text: `${p.title || p.internal_name} em ${p.neighborhood || p.location_text}. ${p.bedrooms} quartos, ${p.suites} suítes, ${p.area_privativa}m². Valor: R$ ${p.value}. Features: ${p.features?.join(', ')}`
    }))

    const prompt = `Você é um assistente de busca imobiliária inteligente. 
Sua tarefa é filtrar uma lista de imóveis com base na consulta do usuário em linguagem natural.

Consulta do Usuário: "${query}"

Lista de Imóveis:
${JSON.stringify(propertiesContext)}

Retorne um JSON contendo apenas o campo "matchingIds", que é uma lista dos IDs dos imóveis que melhor atendem aos critérios do usuário.
Se nenhum imóvel for compatível, retorne uma lista vazia.
Considere proximidade de valores, número de quartos e características mencionadas.

Responda APENAS o JSON puro.`

    const startGPT = Date.now()
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Você é um assistente de busca imobiliária e responde apenas em JSON." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0,
    })
    const elapsedGPT = Date.now() - startGPT
    const usage = response.usage

    if (usage) {
      await trackAICall({
        module: 'orbit_core',
        model: 'gpt-4o-mini',
        tokens_input: usage.prompt_tokens,
        tokens_output: usage.completion_tokens,
        duration_ms: elapsedGPT,
        metadata: { action: 'atlas_semantic_search', query }
      })
    }

    const result = JSON.parse(response.choices[0].message.content || "{}")

    return NextResponse.json({
      matchingIds: result.matchingIds || []
    })
    
  } catch (error: any) {
    console.error('Semantic search error:', error)
    return NextResponse.json(
      { error: 'Failed to process semantic search', details: error.message },
      { status: 500 }
    )
  }
}
