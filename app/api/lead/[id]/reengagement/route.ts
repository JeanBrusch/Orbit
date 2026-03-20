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

    // 1. Buscar imóveis compatíveis para o lead (RAG) se necessário
    let matchedProperties: any[] = [];
    if (silence_analysis.should_include_properties) {
        // Buscamos o vetor semântico do lead
        const { data: lead } = await supabase.from("leads").select("semantic_vector").eq("id", leadId).single();
        
        if (lead?.semantic_vector) {
            const { data: properties } = await supabase.rpc("match_properties", {
                query_embedding: lead.semantic_vector,
                match_threshold: 0.65,
                match_count: 2
            });
            matchedProperties = properties || [];
        }
    }

    const propertiesContext = matchedProperties.length > 0
        ? `Imóveis recomendados:\n${matchedProperties.map(p => `- ${p.title} (${p.neighborhood}) - R$ ${p.value?.toLocaleString('pt-BR')}`).join('\n')}`
        : "Nenhum imóvel específico recomendado agora.";

    // 2. Definir Tons
    const tones = ["casual", "curiosity", "direct", "reconnect", "value_anchor"];
    
    const systemPrompt = `Você é um corretor de imóveis de elite que usa psicologia reversa e elegância para reativar leads em silêncio.
Sua comunicação é curta, humana e nunca parece um spam automátizado.
Você usa o "Orbit Core" para basear sua estratégia.`;

    const userPrompt = `Gere uma mensagem de reengajamento para o WhatsApp.

ESTRATÉGIA: ${silence_analysis.strategy}
MOTIVO DO SILÊNCIO: ${silence_analysis.silence_reason}
ESTADO EMOCIONAL: ${silence_analysis.emotional_state}
INTENÇÃO ORIGINAL: ${silence_analysis.last_known_intent}

CONTEXTO DE IMÓVEIS:
${propertiesContext}

DIRETRIZES:
- Máximo 250 caracteres.
- Não use "Olá", "Tudo bem?", "Como vai?". Comece direto no ponto.
- Use um dos tons: ${tones.join(", ")}.
- Se houver imóveis, mencione-os de forma orgânica.
- O objetivo é gerar uma resposta, não vender agora.

Responda APENAS com este JSON:
{
  "message": "...",
  "tone": "...",
  "confidence": 0.0,
  "matched_properties": [],
  "reasoning": "..."
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" },
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
        message_length: result.message.length,
        generated_at: new Date().toISOString()
    });

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
        .single();

    if (latest) {
        await supabase
            .from("reengagement_experiments")
            .update({ 
                sent_at_hour, 
                sent_at: new Date().toISOString() 
            })
            .eq("id", latest.id);
            
        // Também atualizar na silence_analyses para manter o loop de aprendizado legado
        await supabase
            .from("silence_analyses")
            .update({ 
                message_sent: true,
                sent_at: new Date().toISOString(),
                sent_at_hour
            })
            .eq("lead_id", leadId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
