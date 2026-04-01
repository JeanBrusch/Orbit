import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { trackAICall } from '@/lib/observability'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const { text, leadId } = await request.json()

    if (!text || text.trim().length < 3) {
      return NextResponse.json({ suggestions: [] })
    }

    const prompt = `Você é um especialista em gramática, ortografia e redação publicitária para o mercado imobiliário de luxo no Brasil.
Seu objetivo é analisar o texto abaixo e sugerir melhorias imediatas seguindo a norma culta, mantendo o tom elegante e profissional.

Texto original: "${text}"

Regras:
1. Analise acentuação, pontuação gráfica e concordância.
2. Sugira 3 versões:
   - "Ajustado": Apenas correção gramatical e ortográfica direta.
   - "Elegante": Tom mais formal (norma culta) e sofisticado.
   - "Persuasivo": Focado em vendas, gatilhos de exclusividade e agilidade.

Responda APENAS em JSON no formato:
{
  "suggestions": [
    { "label": "Ajustado", "text": "...", "icon": "check" },
    { "label": "Elegante", "text": "...", "icon": "pen" },
    { "label": "Persuasivo", "text": "...", "icon": "zap" }
  ]
}`

    const startGPT = Date.now()
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Você é um assistente de escrita de alto nível para corretores imobiliários premium." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
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
        metadata: { action: 'writing_correction' }
      })
    }

    const result = JSON.parse(response.choices[0].message.content || "{\"suggestions\": []}")
    return NextResponse.json(result)
    
  } catch (error: any) {
    console.error('Writing assistant error:', error)
    return NextResponse.json({ suggestions: [] }, { status: 500 })
  }
}
