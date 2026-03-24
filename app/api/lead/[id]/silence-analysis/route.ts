import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getSupabaseServer } from "@/lib/supabase-server";
import { trackAICall } from "@/lib/observability";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SilenceReason =
  | "PRICE_FRICTION"      // Travou no preço, não quis confrontar
  | "MISALIGNMENT"        // O que foi oferecido não bateu com o que ele queria
  | "TIMING"              // Momento de vida errado — viagem, trabalho, família
  | "TRUST_GAP"           // Não confiou o suficiente para continuar
  | "OVERWHELM"           // Excesso de informação, não sabe decidir
  | "LOW_INTENT"          // Nunca teve intenção real, estava só explorando
  | "COMPETITOR"          // Provavelmente foi para outro corretor ou imobiliária
  | "RESOLVED_ELSEWHERE"  // Resolveu o problema fora (comprou, alugou, desistiu)
  | "UNKNOWN";            // Dados insuficientes para classificar

export type ReengagementStrategy =
  | "REANCHOR_VALUE"      // Reposicionar valor sem falar de preço diretamente
  | "SURFACE_NEW_ASSET"   // Apresentar imóvel novo que bate com o perfil
  | "OPEN_QUESTION"       // Pergunta aberta sobre o momento de vida
  | "TRUST_REBUILD"       // Reconexão humana, sem agenda comercial
  | "GENTLE_CLOSE"        // Verificar se ainda faz sentido continuar
  | "WAIT"                // Não fazer nada agora — timing errado
  | "RELEASE";             // Desengajar com elegância

export interface SilenceAnalysis {
  lead_id: string;
  days_silent: number;
  silence_reason: SilenceReason;
  confidence: number;           // 0.0 - 1.0
  reasoning: string;            // raciocínio livre do modelo
  emotional_state: string;      // o estado emocional inferido do lead
  last_known_intent: string;    // qual era a intenção antes do silêncio
  strategy: ReengagementStrategy;
  should_include_properties: boolean;
  urgency: "high" | "medium" | "low" | "none";
  best_contact_window: string;  // ex: "tarde, após 17h" ou "manhã"
  next_step_if_reply: string;
  next_step_if_ignore: string;
  analyzed_at: string;
}

// ─── Route Handler ─────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: leadId } = await params;

  if (!leadId) {
    return NextResponse.json({ error: "Lead ID required" }, { status: 400 });
  }

  try {
    const supabase = getSupabaseServer();

    // ── 1. Buscar dados completos do lead ──────────────────────────────────
    // Correção: SELECT limpo, sem ai_analysis. Memórias ordenadas por confidence.
    const [leadRes, cogRes, memoriesRes, messagesRes, insightsRes] = await Promise.all([
      supabase
        .from("leads")
        .select("id, name, phone, lid, orbit_stage, last_interaction_at, action_suggested")
        .eq("id", leadId)
        .single(),

      supabase
        .from("lead_cognitive_state")
        .select("interest_score, momentum_score, risk_score, clarity_level, current_state, central_conflict, what_not_to_do, last_ai_analysis_at")
        .eq("lead_id", leadId)
        .maybeSingle(),

      supabase
        .from("memory_items")
        .select("type, content, confidence, created_at")
        .eq("lead_id", leadId)
        .order("confidence", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(15),

      supabase
        .from("messages")
        .select("source, content, timestamp")
        .eq("lead_id", leadId)
        .order("timestamp", { ascending: false })
        .limit(10),

      supabase
        .from("ai_insights")
        .select("content, urgency, created_at")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false })
        .limit(5),
    ]) as any[];

    if (!leadRes.data) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const lead = leadRes.data;
    const cog = cogRes.data;
    const memories = memoriesRes.data || [];
    const messages = messagesRes.data || [];
    const insights = insightsRes.data || [];

    // ── 2. Calcular dias de silêncio (Correção: sem fallback de 999 dias) ────
    const lastInteraction = lead.last_interaction_at
      ? new Date(lead.last_interaction_at)
      : null;

    if (!lastInteraction) {
      return NextResponse.json({ error: "Lead sem interação registrada (nada a analisar)" }, { status: 422 });
    }

    const daysSilent = Math.floor((Date.now() - lastInteraction.getTime()) / (1000 * 60 * 60 * 24));

    // ── 3. Traduzir Estágio (Mapeamento para o prompt) ──────────────────────
    const stageLabels: Record<string, string> = {
        "lead": "novo contato, apenas informações básicas",
        "qualified": "perfil qualificado, aguardando avanço",
        "visiting": "em fase de visitas aos imóveis",
        "negotiating": "em negociação ativa de valores/contrato",
        "closed": "venda/aluguel concluído",
        "lost": "lead perdido ou descartado"
    };
    const stageDescription = stageLabels[lead.orbit_stage as string] ?? lead.orbit_stage;

    // ── 4. Preparar contexto para o modelo ────────────────────────────────
    const conversationContext = [...messages]
      .reverse()
      .map(m => {
        const role = m.source === "whatsapp" ? "LEAD" : "CORRETOR";
        const time = new Date(m.timestamp as string).toLocaleDateString("pt-BR", {
          day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"
        });
        return `[${time}] ${role}: ${m.content || "(mídia sem texto)"}`;
      })
      .join("\n");

    const memoriesContext = memories
      .map((m: any) => `• [${m.type}] ${m.content} (confiança: ${Math.round((m.confidence || 0) * 100)}%)`)
      .join("\n");

    const insightsContext = insights
      .map((i: any) => `• ${i.content} (urgência: ${i.urgency})`)
      .join("\n");

    // ── 5. Prompt para o classificador ────────────────────────────────────
    const systemPrompt = `Você é um analista de comportamento humano especializado em decisões imobiliárias.
Sua função é interpretar o silêncio de um potencial comprador/locatário como um analista clínico.

Você não categoriza leads. Você lê pessoas.
Você deve raciocinar em voz alta antes de chegar a qualquer conclusão.

Responda APENAS com um objeto JSON válido.`;

    const userPrompt = `Analise o silêncio deste lead e classifique o motivo com precisão clínica.

═══════════════════════════════════════
DADOS DO LEAD
═══════════════════════════════════════
Nome: ${lead.name || "Desconhecido"}
Estágio: ${stageDescription} (Original: ${lead.orbit_stage})
Dias em silêncio: ${daysSilent}
Última interação: ${lastInteraction.toLocaleDateString("pt-BR")}

═══════════════════════════════════════
ESTADO COGNITIVO (última análise da IA)
═══════════════════════════════════════
Interest Score: ${cog?.interest_score ?? "50"}
Momentum Score: ${cog?.momentum_score ?? "50"}
Risk Score: ${cog?.risk_score ?? "50"}
Clarity Level: ${cog?.clarity_level ?? "0.5"} (0.0 a 1.0 - quanto ele entende do processo)
Estado atual: ${cog?.current_state || "latent"}
Conflito central: ${cog?.central_conflict || "não identificado"}
O que NÃO fazer: ${cog?.what_not_to_do || "não registrado"}

═══════════════════════════════════════
MEMÓRIA PERSISTIDA DO LEAD
═══════════════════════════════════════
${memoriesContext || "Nenhuma memória registrada"}

═══════════════════════════════════════
ÚLTIMAS MENSAGENS (cronológica)
═══════════════════════════════════════
${conversationContext || "Nenhuma mensagem registrada"}

═══════════════════════════════════════
INSIGHTS COGNITIVOS RECENTES
═══════════════════════════════════════
${insightsContext || "Nenhum insight registrado"}

═══════════════════════════════════════
SUA TAREFA
═══════════════════════════════════════

Raciocine em etapas antes de classificar:
1. O que estava acontecendo ANTES do silêncio? Qual era o momentum?
2. Quem enviou a última mensagem? O que isso sinaliza?
3. O que o conflito central e o Clarity Level (${cog?.clarity_level ?? "0.5"}) revelam sobre o bloqueio?
4. Qual é a temperatura emocional inferida deste lead agora?
5. O silêncio é evitação, timing, desinteresse ou overwelhm (excesso de opções)?

Classifique usando silence_reason: PRICE_FRICTION | MISALIGNMENT | TIMING | TRUST_GAP | OVERWHELM | LOW_INTENT | COMPETITOR | RESOLVED_ELSEWHERE | UNKNOWN
E strategy: REANCHOR_VALUE | SURFACE_NEW_ASSET | OPEN_QUESTION | TRUST_REBUILD | GENTLE_CLOSE | WAIT | RELEASE

Responda APENAS com este formato JSON:
{
  "reasoning": "seu raciocínio clínico",
  "silence_reason": "...",
  "confidence": 0.0,
  "emotional_state": "descrição",
  "last_known_intent": "intenção real",
  "strategy": "...",
  "should_include_properties": false,
  "urgency": "high|medium|low|none",
  "best_contact_window": "janela de tempo",
  "next_step_if_reply": "o que fazer se responder",
  "next_step_if_ignore": "o que fazer se ignorar"
}`;

    // ── 6. Chamar o modelo (GPT-4) ─────────────────────────────────────────
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const startGPT = Date.now();
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });
    const elapsedGPT = Date.now() - startGPT;
    const usage = response.usage;

    if (usage) {
      await trackAICall({
        module: 'silence_analyzer',
        model: 'gpt-4o',
        lead_id: leadId,
        tokens_input: usage.prompt_tokens,
        tokens_output: usage.completion_tokens,
        duration_ms: elapsedGPT,
        metadata: { action: 'silence_analysis' }
      });
    }

    const rawContent = response.choices[0].message.content || "{}";
    const parsed = JSON.parse(rawContent);

    // ── 7. Montar resposta final ───────────────────────────────────────────
    const { resolveStrategy } = await import("@/lib/strategy-resolver");
    const strategyDef = resolveStrategy(
      parsed.silence_reason,
      daysSilent,
      cog?.momentum_score ?? 50
    );

    const finalAnalysis: SilenceAnalysis & { 
      objective: string;
      force_patterns: string[];
      hard_constraints: string[];
      hook_requirement: string;
    } = {
      lead_id: leadId,
      days_silent: daysSilent,
      analyzed_at: new Date().toISOString(),
      ...parsed,
      objective: strategyDef.objective,
      force_patterns: strategyDef.force_patterns,
      hard_constraints: strategyDef.hard_constraints,
      hook_requirement: strategyDef.hook_requirement,
    };

    // ── 8. Persistir no Supabase (Correção: insert simples para série histórica)
    await supabase.from("silence_analyses").insert({
      lead_id: leadId,
      days_silent: daysSilent,
      silence_reason: finalAnalysis.silence_reason,
      confidence: finalAnalysis.confidence,
      strategy: finalAnalysis.strategy,
      urgency: finalAnalysis.urgency,
      should_include_properties: finalAnalysis.should_include_properties,
      reasoning: finalAnalysis.reasoning,
      emotional_state: finalAnalysis.emotional_state,
      last_known_intent: finalAnalysis.last_known_intent,
      best_contact_window: finalAnalysis.best_contact_window,
      next_step_if_reply: finalAnalysis.next_step_if_reply,
      next_step_if_ignore: finalAnalysis.next_step_if_ignore,
      analyzed_at: finalAnalysis.analyzed_at,
      metadata: {
        objective: finalAnalysis.objective,
        force_patterns: finalAnalysis.force_patterns,
        hard_constraints: finalAnalysis.hard_constraints,
        hook_requirement: finalAnalysis.hook_requirement
      },
      message_sent: false,
    } as any);

    return NextResponse.json(finalAnalysis);

  } catch (error) {
    console.error("[SILENCE ANALYSIS] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
