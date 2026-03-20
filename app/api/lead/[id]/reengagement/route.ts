import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getSupabaseServer } from "@/lib/supabase-server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: leadId } = await params;
  const { silence_analysis } = await req.json();

  if (!leadId || !silence_analysis) {
    return NextResponse.json({ error: "Lead ID and analysis required" }, { status: 400 });
  }

  try {
    const supabase = getSupabaseServer();
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // 1. Buscar dados essenciais do lead (Nome e Histórico recente)
    const { data: lead } = await supabase
        .from("leads")
        .select("name, semantic_vector")
        .eq("id", leadId)
        .single() as any;

    const { data: messages } = await supabase
        .from("messages")
        .select("source, content, timestamp")
        .eq("lead_id", leadId)
        .order("timestamp", { ascending: false })
        .limit(6) as any;

    const historyContext = (messages || [])
        .reverse()
        .map((m: any) => `${m.source === 'whatsapp' ? 'LEAD' : 'CORRETOR'}: ${m.content}`)
        .join("\n");

    // 2. Buscar imóveis compatíveis para o lead (RAG) se necessário
    let matchedProperties: any[] = [];
    if (silence_analysis.should_include_properties && lead?.semantic_vector) {
        const { data: properties } = await supabase.rpc("match_properties", {
            query_embedding: lead.semantic_vector,
            match_threshold: 0.65,
            match_count: 2
        }) as any;
        matchedProperties = properties || [];
    }

    const propertiesContext = matchedProperties.length > 0
        ? `Imóveis recomendados:\n${matchedProperties.map(p => `- ${p.title} (${p.neighborhood}) - R$ ${p.value?.toLocaleString('pt-BR')}`).join('\n')}`
        : "Nenhum imóvel específico recomendado agora.";

    // 3. Definir Tons e Prompt
    const tones = ["casual", "curiosity", "direct", "reconnect", "value_anchor"];
    
    const systemPrompt = `Você é um corretor de imóveis de elite que usa o framework "Orbit" para reativação de leads.
Sua comunicação segue a técnica da "Escrita Invisível": parece uma mensagem real de um humano no WhatsApp, não um bot.

REGRAS DE OURO:
1. CURTO E DIRETO: Máximo 200 caracteres. No WhatsApp, menos é mais.
2. SEM FORMALIDADES: Nunca use "Olá", "Tudo bem?", "Espero que esteja bem", "Atenciosamente". Comece como se estivesse continuando uma conversa.
3. MINIMALISMO DE EMOJI: Use no máximo um emoji, ou nenhum.
4. LINGUAGEM NATURAL: Use termos como "vi aqui", "lembrei", "faz sentido?", "conseguiu ver?".
5. FOCO NA RESPOSTA: O objetivo é apenas que o lead responda algo.`;

    const userPrompt = `Gere uma mensagem de reengajamento altamente personalizada.

DADOS DO LEAD:
Nome: ${lead?.name || "Cliente"}
Últimas mensagens:
${historyContext || "Sem histórico recente."}

ESTRATÉGIA: ${silence_analysis.strategy}
MOTIVO DO SILÊNCIO: ${silence_analysis.silence_reason}
ESTADO EMOCIONAL: ${silence_analysis.emotional_state}
INTENÇÃO ORIGINAL: ${silence_analysis.last_known_intent}

CONTEXTO DE IMÓVEIS:
${propertiesContext}

DIRETRIZES:
- Use o nome dele: ${lead?.name || ""} (opcional, se soar natural no contexto).
- Se houver imóveis, NÃO diga "Temos estes imóveis", diga algo como "Vi um aqui no [Bairro] que parece muito com o que a gente falou".
- Se o silêncio for por PREÇO, tente reancorar valor ou perguntar do momento, sem pressionar.
- Escolha um dos tons: ${tones.join(", ")}.

Responda APENAS com este JSON:
{
  "message": "...",
  "tone": "...",
  "confidence": 0.0,
  "matched_properties": [],
  "reasoning": "Explique por que essa mensagem quebrará o silêncio baseado no histórico."
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    result.matched_properties = matchedProperties;

    // Persistir experimento
    await supabase.from("reengagement_experiments").insert({
        lead_id: leadId,
        silence_reason: silence_analysis.silence_reason,
        strategy: silence_analysis.strategy,
        tone: result.tone,
        days_silent: silence_analysis.days_silent,
        had_property: matchedProperties.length > 0,
        message_length: result.message.length || 0,
        generated_at: new Date().toISOString()
    } as any);

    return NextResponse.json(result);

  } catch (error) {
    console.error("[REENGAGEMENT] Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: leadId } = await params;
  const { sent_at_hour } = await req.json();

  try {
    const supabase = getSupabaseServer();
    
    // Atualizar o experimento mais recente
    const { data: latest } = await supabase
        .from("reengagement_experiments")
        .select("id")
        .eq("lead_id", leadId)
        .order("generated_at", { ascending: false })
        .limit(1)
        .single() as any;

    if (latest) {
        await supabase
            .from("reengagement_experiments")
            .update({ 
                sent_at_hour, 
                sent_at: new Date().toISOString() 
            } as any)
            .eq("id", latest.id);
            
        // Também atualizar na silence_analyses para manter o loop de aprendizado legado
        await supabase
            .from("silence_analyses")
            .update({ 
                message_sent: true,
                sent_at: new Date().toISOString(),
                sent_at_hour
            } as any)
            .eq("lead_id", leadId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
