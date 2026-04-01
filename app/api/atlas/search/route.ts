import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { getSupabaseServer } from '@/lib/supabase-server'
import { trackAICall } from '@/lib/observability'

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
    
    // 1. Fetch Properties Context
    const { data: properties } = await (supabase
      .from('properties') as any)
      .select('id, title, internal_name, neighborhood, bedrooms, value, features')
      .limit(50)

    // 2. Fetch Leads Context
    const { data: leads } = await (supabase
      .from('leads') as any)
      .select('id, name, budget, preferred_features, preferred_area')
      .limit(30)

    const context = {
      properties: (properties || []).map((p: any) => ({
        id: p.id,
        type: 'property',
        text: `${p.title || p.internal_name} em ${p.neighborhood}. ${p.bedrooms} quartos. R$ ${p.value}. ${p.features?.join(', ')}`
      })),
      leads: (leads || []).map((l: any) => ({
        id: l.id,
        type: 'lead',
        text: `Lead: ${l.name}. Busca em ${l.preferred_area}. Budget: R$ ${l.budget}. Prefere: ${l.preferred_features?.join(', ')}`
      }))
    }

    const prompt = `Você é o motor de busca cognitiva do sistema Atlas. 
Sua tarefa é identificar quais imóveis OU leads melhor correspondem à consulta em linguagem natural.

Consulta: "${query}"

Contexto:
${JSON.stringify(context)}

Retorne um JSON com:
1. "matchingPropertyIds": lista de IDs de imóveis relevantes.
2. "matchingLeadIds": lista de IDs de leads relevantes.

Seja criterioso. Se a busca for por um nome de pessoa, foque em leads. Se for por características de casa, foque em imóveis. Se for 'quem busca X', foque em leads.`

    const startGPT = Date.now()
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Você é um motor de busca semântica imobiliária e responde apenas em JSON." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0,
    })
    const elapsedGPT = Date.now() - startGPT
    
    const result = JSON.parse(response.choices[0].message.content || "{}")

    return NextResponse.json({
      matchingIds: result.matchingPropertyIds || [],
      matchingLeadIds: result.matchingLeadIds || []
    })
    
  } catch (error: any) {
    console.error('Semantic search error:', error)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
