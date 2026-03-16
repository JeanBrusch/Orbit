import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { getSupabaseServer } from '@/lib/supabase-server'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json()

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    const supabase = getSupabaseServer()
    const { data: properties, error: dbError } = await supabase
      .from('properties')
      .select('id, title, internal_name, neighborhood, area_privativa, bedrooms, suites, value, features, location_text')

    if (dbError) throw dbError

    const propertiesContext = properties.map(p => ({
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

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "Você é um assistente de busca imobiliária e responde apenas em JSON." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0,
    })

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
