import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { trackAICall } from '@/lib/observability'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json()

    if (!text) {
      return NextResponse.json({ error: 'Text content is required' }, { status: 400 })
    }

    const prompt = `Você é um especialista em extração de dados imobiliários. 
Sua tarefa é ler uma descrição de um imóvel (que pode vir de um ditado por voz) e extrair os dados estruturados em JSON.

Descrição: "${text}"

Campos a extrair:
- title: um título curto e atraente (ex: "Casa Moderna no Condomínio X")
- neighborhood: bairro
- city: cidade
- area_privativa: número (apenas o valor em m²)
- bedrooms: número de quartos
- suites: número de suítes
- parking_spots: número de vagas de garagem
- condo_fee: valor do condomínio (número)
- iptu: valor do iptu (número)
- value: valor de venda (número)
- payment: condições de pagamento (ex: 'Aceita financiamento e permuta', '30% entrada + saldo parcelado', etc)
- features: lista de strings (amenidades como Piscina, Churrasqueira, Academia, etc)
- description: uma descrição limpa e corrigida gramaticalmente baseada no que foi dito.

Responda APENAS o JSON puro, sem markdown.`

    const startGPT = Date.now()
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "Você é um assistente que extrai dados imobiliários e responde apenas em JSON." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    })
    const elapsedGPT = Date.now() - startGPT
    const usage = response.usage

    if (usage) {
      await trackAICall({
        module: 'orbit_core',
        model: 'gpt-4o',
        tokens_input: usage.prompt_tokens,
        tokens_output: usage.completion_tokens,
        duration_ms: elapsedGPT,
        metadata: { action: 'voice_ingestion_parsing' }
      })
    }

    const extractedData = JSON.parse(response.choices[0].message.content || "{}")

    return NextResponse.json(extractedData)
    
  } catch (error: any) {
    console.error('Voice ingestion error:', error)
    return NextResponse.json(
      { error: 'Failed to process voice description', details: error.message },
      { status: 500 }
    )
  }
}
