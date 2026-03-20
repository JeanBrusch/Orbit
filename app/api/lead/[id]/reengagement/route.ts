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

    // 1. Buscar dados essenciais do lead (Nome, Memórias, e Histórico real)
    const [leadRes, memoriesRes, messagesRes] = await Promise.all([
        supabase.from("leads").select("name, semantic_vector, location_focus, property_type_focus").eq("id", leadId).single(),
        supabase.from("memory_items")
            .select("type, content, confidence")
            .eq("lead_id", leadId)
            .order("confidence", { ascending: false })
            .limit(20),
        supabase.from("messages")
            .select("source, content, timestamp")
            .eq("lead_id", leadId)
            .order("timestamp", { ascending: false })
            .limit(8)
    ]) as any[];

    const lead = leadRes.data;
    const memories = memoriesRes.data || [];
    const messages = messagesRes.data || [];

    // Contexto de mensagens reais (Problema 1)
    const conversationContext = [...messages]
        .reverse()
        .map((m: any) => `${m.source === 'whatsapp' ? 'LEAD' : 'CORRETOR'}: ${m.content}`)
        .join("\n");

    // Contexto de memórias expandido (Problema 2)
    const memoriesContext = memories
        .map((m: any) => `• [${m.type}] ${m.content} (confiança: ${Math.round((m.confidence || 0) * 100)}%)`)
        .join("\n");

    // 2. Buscar imóveis compatíveis (Melhorado - Problema 5)
    let matchedProperties: any[] = [];
    if (silence_analysis.should_include_properties) {
        if (lead?.semantic_vector) {
            const { data: properties } = await supabase.rpc("match_properties", {
                query_embedding: lead.semantic_vector,
                match_threshold: 0.65,
                match_count: 3
            }) as any;
            matchedProperties = properties || [];
        }
    }

    const propertiesContext = matchedProperties.length > 0
        ? `IMÓVEIS REAIS DISPONÍVEIS:\n${matchedProperties.map(p => `- ${p.title} em ${p.neighborhood} (R$ ${p.value?.toLocaleString('pt-BR')})`).join('\n')}`
        : "NÃO HÁ IMÓVEIS NOVOS PARA CITAR AGORA.";

    // 3. Prompt de Elite (Correção Problemas 3, 4 e 6)
    const systemPrompt = `Você é um corretor de imóveis de elite que usa o framework "Orbit".
Sua fala é curta, humana e impossível de distinguir de um corretor real no WhatsApp.

DIRETRIZES DE ESCRITA:
1. SEM PRETEXTOS FALSOS: Se não houver imóveis reais na lista, não invente que "chegou algo". Use reconexão humana.
2. ÂNCORA DE INTENÇÃO: Se sabe que o lead queria "3 quartos no Itaim", use isso para contextualizar a volta.
3. CONVERSA CONTÍNUA: A mensagem deve soar como se você tivesse acabado de lembrar de algo relativo à última conversa real.
4. ZERO FORMALIDADE: Sem "Olá", "Tudo bem?", "Espero que esteja bem". Vá direto ao ponto.

EXEMPLOS DE CONTRASTE:
- RUIM (Genérico): "Olá [Nome], tudo bem? Vi que não nos falamos mais. Tem interesse em continuar?"
- BOM (Personalizado): "[Nome], lembrei do que você falou sobre a garagem. Vi um aqui no Itaim que resolve exatamente aquele ponto. Consegue ver o link?"
- BOM (Sem imóvel): "[Nome], sumiu! Faz tempo que não nos falamos. O plano do apartamento novo ainda faz sentido ou mudou o foco?"`;

    const userPrompt = `Gere uma mensagem de reengajamento baseada em fatos reais.

════════════════════════════
HISTÓRICO REAL DA CONVERSA
════════════════════════════
${conversationContext || "Nenhuma mensagem registrada."}

════════════════════════════
DIAGNÓSTICO DO SILÊNCIO
════════════════════════════
Motivo: ${silence_analysis.silence_reason}
Estado Emocional: ${silence_analysis.emotional_state}
Intenção Original: ${silence_analysis.last_known_intent}

════════════════════════════
CONTEXTO DE MEMÓRIA E ATIVOS
════════════════════════════
Memórias:
${memoriesContext}

${propertiesContext}

TAREFA:
Escreva a mensagem. Se houver imóveis, cite-os de forma orgânica. 
Se NÃO houver, foque na intenção original (${silence_analysis.last_known_intent}) ou no estado emocional (${silence_analysis.emotional_state}).

Responda APENAS com este JSON:
{
  "message": "...",
  "tone": "...",
  "reasoning": "...",
  "what_makes_it_work": "Por que esta abordagem específica quebrará o silêncio deste lead?",
  "risk_if_sent": "Qual o risco desta mensagem (ex: parecer insistente)?"
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
