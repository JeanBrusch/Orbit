import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getSupabaseServer } from "@/lib/supabase-server";
import { resolveStrategy } from "@/lib/strategy-resolver";
import { validateHookQuality } from "@/lib/hook-validator";

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
    const [leadRes, cogRes, memoriesRes, messagesRes] = await Promise.all([
        supabase.from("leads").select("name, semantic_vector, location_focus, property_type_focus").eq("id", leadId).single(),
        supabase.from("lead_cognitive_state").select("interest_score, momentum_score, clarity_level").eq("lead_id", leadId).maybeSingle(),
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
    const cog = cogRes.data;
    const memories = memoriesRes.data || [];
    const messages = messagesRes.data || [];
    const leadFirstName = lead?.name?.split(" ")[0] || "cliente";

    // 2. Resolver Estratégia Determinística
    const strategy = resolveStrategy(
        silence_analysis.silence_reason,
        silence_analysis.days_silent || 0,
        cog?.momentum_score ?? 30
    );

    // Contexto de mensagens reais para o Hook
    const conversationContext = [...messages]
        .reverse()
        .map(m => {
            const role = m.source === "whatsapp" ? "LEAD" : "CORRETOR";
            return `${role}: ${m.content}`;
        })
        .join("\n");

    const memoriesContext = memories
        .map((m: any) => `• [${m.type}] ${m.content} (confiança: ${Math.round((m.confidence || 0) * 100)}%)`)
        .join("\n");

    // 3. Buscar imóveis compatíveis (se permitido pela estratégia)
    let matchedProperties: any[] = [];
    if (silence_analysis.should_include_properties && !strategy.hard_constraints.includes("no_property")) {
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

    // 4. Prompt de Elite (Blindado por Estratégia)
    const systemPrompt = `Você é um corretor de imóveis de elite que usa o framework "Orbit".
Sua fala é curta, humana e impossível de distinguir de um corretor real no WhatsApp.

Você deve gerar mensagens INTRANSFERÍVEIS. Se a mensagem puder ser enviada para outro lead com pequenos ajustes, ela é considerada FALHA.

════════════════════════════════════════
OBJETIVO FIXO
════════════════════════════════════════
${strategy.objective.replace(/_/g, " ").toUpperCase()}

Essa mensagem existe para isso. Nada mais.

════════════════════════════════════════
ÚLTIMAS MENSAGENS REAIS
════════════════════════════════════════
${conversationContext || "Nenhuma mensagem registrada"}

Use o conteúdo acima para o hook. Cite a frase, a data, o dado — não parafraseie.

════════════════════════════════════════
RESTRIÇÕES ABSOLUTAS
════════════════════════════════════════
${strategy.hard_constraints.map(c => `❌ ${c.replace(/_/g, " ").toUpperCase()}`).join("\n")}

════════════════════════════════════════
PADRÕES OBRIGATÓRIOS
════════════════════════════════════════
${strategy.force_patterns.map(p => `✅ ${p.replace(/_/g, " ").toUpperCase()}`).join("\n")}

════════════════════════════════════════
REGRAS ABSOLUTAS
════════════════════════════════════════
1. Máximo 3 frases
2. Sem "espero que esteja bem" ou frases de template
3. Sem mencionar follow-up
4. Use o primeiro nome: ${leadFirstName}`;

    const userPrompt = `Gere a mensagem de reengajamento baseada no diagnóstico de silêncio:

DIAGNÓSTICO:
Motivo: ${silence_analysis.silence_reason}
Estado Emocional: ${silence_analysis.emotional_state}
Intenção Original: ${silence_analysis.last_known_intent}

MEMÓRIAS:
${memoriesContext}

${propertiesContext}

Responda APENAS com JSON:
{
  "message": "...",
  "objective": "${strategy.objective}",
  "hook_type": "${strategy.hook_requirement}",
  "hook_source": "trecho exato do histórico — mínimo 15 chars",
  "force_pattern_used": "qual padrão foi aplicado",
  "specificity_score": 0.0,
  "is_transferable": false,
  "reasoning": "..."
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

    const parsed = JSON.parse(response.choices[0].message.content || "{}");
    
    // 5. Portão de Qualidade: Validar Hook antes de retornar
    const hookValidation = validateHookQuality(parsed.hook_source, parsed.hook_type);
    
    if (!hookValidation.isValid) {
        console.warn("[REENGAGEMENT] Geração rejeitada: WEAK_HOOK", hookValidation.rejection_reason);
        return NextResponse.json({
            error: "Geração rejeitada",
            reason: hookValidation.rejection_reason,
            hook_score: hookValidation.score,
            code: "WEAK_HOOK",
        }, { status: 422 });
    }

    if (parsed.is_transferable === true) {
        console.warn("[REENGAGEMENT] Geração rejeitada: TRANSFERABLE_MESSAGE");
        return NextResponse.json({
            error: "Geração rejeitada",
            reason: "mensagem_transferivel_detectada",
            code: "TRANSFERABLE_MESSAGE",
        }, { status: 422 });
    }

    // Persistir experimento com novos campos
    await supabase.from("reengagement_experiments").insert({
        lead_id: leadId,
        silence_reason: silence_analysis.silence_reason,
        strategy: silence_analysis.strategy,
        objective: strategy.objective,
        hook_type: parsed.hook_type,
        hook_source: parsed.hook_source,
        force_pattern_used: parsed.force_pattern_used,
        constraint_applied: strategy.hard_constraints,
        specificity_score: parsed.specificity_score,
        is_transferable: parsed.is_transferable,
        next_move_if_reply: (strategy as any).next_move_if_reply || null,
        days_silent: silence_analysis.days_silent,
        had_property: matchedProperties.length > 0,
        message_length: parsed.message?.length || 0,
        generated_at: new Date().toISOString()
    } as any);

    return NextResponse.json({ ...parsed, matched_properties: matchedProperties });

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
