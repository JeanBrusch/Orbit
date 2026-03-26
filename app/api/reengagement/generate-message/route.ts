import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { trackAICall } from '@/lib/observability';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { leadName, propertyTitle, propertyNeighborhood, styleIndex } = await request.json();

    const prompt = `Você é um corretor de imóveis experiente no Brasil. 
Sua tarefa é gerar uma mensagem de reativação para um lead frio que nunca respondeu.

DADOS:
- Nome do Lead: ${leadName}
- Imóvel de referência: ${propertyTitle && propertyNeighborhood ? `${propertyTitle} em ${propertyNeighborhood}` : 'Nenhum (usar abordagem neutra)'}

ESTRUTURA OBRIGATÓRIA (MOLDE):
1. [Abertura leve]: Curta e direta, sem formalidade ("Oi [Nome]", "Tudo bem, [Nome]?").
2. [Gancho indireto]: Focar em timing e lembrança, não em venda. Ex: "Vi algo que me lembrou aquele perfil de imóvel que você olhou..." ou "Passando para atualizar uma lista que acho que faz sentido pra você".
3. [Fechamento neutro]: Sem pressão, sem convites. Ex: "Se fizer sentido, te mostro depois." ou "Qualquer coisa me avisa".

REGRAS CRÍTICAS:
- Máximo de 2 linhas curtas.
- Proibido: "Prezado", "Gostaria de agendar", "Café", "Visita", "Oportunidade única".
- O imóvel (se houver) é apenas um suporte opcional, não o centro da mensagem.
- O tom deve ser: "Lembrei de você", não "Quero te vender".

Gere APENAS a mensagem final, sem aspas ou comentários.`;

    const start = Date.now();
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Você gera mensagens de vendas curtas e naturais para WhatsApp." },
        { role: "user", content: prompt }
      ],
      temperature: 0.8,
    });
    const elapsed = Date.now() - start;

    if (response.usage) {
      await trackAICall({
        module: 'reengagement',
        model: 'gpt-4o-mini',
        tokens_input: response.usage.prompt_tokens,
        tokens_output: response.usage.completion_tokens,
        duration_ms: elapsed,
        metadata: { action: 'generate_cold_message' }
      });
    }

    return NextResponse.json({
      message: response.choices[0].message.content?.trim()
    });

  } catch (error: any) {
    console.error('Message generation error:', error);
    return NextResponse.json({ error: 'Failed to generate message' }, { status: 500 });
  }
}
