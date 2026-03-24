import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseServer } from "@/lib/supabase-server"
import { trackAICall } from '@/lib/observability'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseServer() as any
    const { propertyId, leadId } = await request.json()

    if (!propertyId || !leadId) {
      return NextResponse.json({ error: 'propertyId and leadId are required' }, { status: 400 })
    }

    // 1. Fetch Property Data
    const { data: property, error: pError } = await supabase
      .from('properties')
      .select('*')
      .eq('id', propertyId)
      .single()

    // 2. Fetch Lead Preferences
    const { data: preferences, error: prefError } = await supabase
      .from('lead_preferences')
      .select('*')
      .eq('lead_id', leadId)
      .single()

    // 3. Fetch recent memory items for deeper context
    const { data: memories } = await supabase
      .from('memory_items')
      .select('content')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(5)

    if (pError || !property) throw new Error('Property not found')

    const context = `
      PROPRIEDADE:
      Título: ${property.title}
      Bairro: ${property.neighborhood || property.location_text}
      Valor: R$ ${property.value}
      Quartos: ${property.bedrooms}
      Suítes: ${property.suites}
      Área: ${property.area_privativa}m2
      Destaques: ${property.features?.join(', ')}

      LEAD (PREFERÊNCIAS):
      Tipo: ${preferences?.preferred_property_type || 'N/A'}
      Foco: ${preferences?.location_focus || 'N/A'}
      Budget: R$ ${preferences?.price_range || 'N/A'}
      Memória Recente: ${memories?.map((m: any) => m.content).join('; ')}
    `

    const prompt = `Você é o melhor corretor de imóveis de luxo do Brasil, especializado em marketing digital de alto padrão.
Sua missão é criar 3 opções de legendas (captions) estilo Instagram para enviar ao lead via WhatsApp sobre este imóvel específico.

Utilize o contexto abaixo para personalizar ao máximo:
${context}

Opção 1 (Instagram Luxury): Texto curto, magnético, emojis sofisticados (✨, 🏛️, 💎). Foco em exclusividade e status.
Opção 2 (Instagram Lifestyle): Foco na experiência de morar (piscina, churrasqueira, lazer). Use emojis como 🍷, ☀️, 🌊.
Opção 3 (Instagram Direct/Smart): Focada em custo-benefício e detalhes técnicos (R$ p/ m2, suítes, localização). Tom mais direto mas ainda premium.

Responda APENAS em JSON com o seguinte formato:
{
  "offers": [
    { "type": "Luxury", "text": "..." },
    { "type": "Lifestyle", "text": "..." },
    { "type": "Smart", "text": "..." }
  ]
}`

    const startGPT = Date.now()
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Você gera mensagens de vendas persuasivas e altamente personalizadas para o mercado imobiliário." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.8,
    })
    const elapsedGPT = Date.now() - startGPT
    const usage = response.usage

    if (usage) {
      await trackAICall({
        module: 'orbit_core',
        model: 'gpt-4o-mini',
        lead_id: leadId,
        tokens_input: usage.prompt_tokens,
        tokens_output: usage.completion_tokens,
        duration_ms: elapsedGPT,
        metadata: { action: 'offer_generation', property_id: propertyId }
      })
    }

    const result = JSON.parse(response.choices[0].message.content || "{}")

    return NextResponse.json(result)
    
  } catch (error: any) {
    console.error('Offer generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate offer', details: error.message },
      { status: 500 }
    )
  }
}
