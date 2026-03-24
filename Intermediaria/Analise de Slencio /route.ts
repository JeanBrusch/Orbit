import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { getSupabaseServer } from "@/lib/supabase-server"

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
  | "UNKNOWN"             // Dados insuficientes para classificar

export type ReengagementStrategy =
  | "REANCHOR_VALUE"      // Reposicionar valor sem falar de preço diretamente
  | "SURFACE_NEW_ASSET"   // Apresentar imóvel novo que bate com o perfil
  | "OPEN_QUESTION"       // Pergunta aberta sobre o momento de vida
  | "TRUST_REBUILD"       // Reconexão humana, sem agenda comercial
  | "GENTLE_CLOSE"        // Verificar se ainda faz sentido continuar
  | "WAIT"                // Não fazer nada agora — timing errado
  | "RELEASE"             // Desengajar com elegância

export interface SilenceAnalysis {
  lead_id: string
  days_silent: number
  silence_reason: SilenceReason
  confidence: number           // 0.0 - 1.0
  reasoning: string            // raciocínio livre do modelo
  emotional_state: string      // o estado emocional inferido do lead
  last_known_intent: string    // qual era a intenção antes do silêncio
  strategy: ReengagementStrategy
  should_include_properties: boolean
  urgency: "high" | "medium" | "low" | "none"
  best_contact_window: string  // ex: "tarde, após 17h" ou "manhã"
  next_step_if_reply: string
  next_step_if_ignore: string
  analyzed_at: string
}

// ─── Route Handler ─────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: leadId } = await params

  if (!leadId) {
    return NextResponse.json({ error: "Lead ID required" }, { status: 400 })
  }

  try {
    // ── CONFIGURAÇÃO DE GOVERNANÇA: IA DESATIVADA ──────────────────────────
    return NextResponse.json(
      { error: "Análise de Silêncio desativada por governança." },
      { status: 403 }
    );

    const supabase = getSupabaseServer()

    // ── 1. Buscar dados completos do lead ──────────────────────────────────
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
        .order("created_at", { ascending: false })
        .limit(20),

      supabase
        .from("messages")
        .select("source, content, timestamp, ai_analysis")
        .eq("lead_id", leadId)
        .order("timestamp", { ascending: false })
        .limit(10),

      supabase
        .from("ai_insights")
        .select("content, urgency, created_at")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false })
        .limit(5),
    ])

    if (!leadRes.data) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 })
    }

    const lead = leadRes.data
    const cog = cogRes.data
    const memories = memoriesRes.data || []
    const messages = messagesRes.data || []
    const insights = insightsRes.data || []

    // ── 2. Calcular dias de silêncio ───────────────────────────────────────
    const lastInteraction = lead.last_interaction_at
      ? new Date(lead.last_interaction_at)
      : null

    const daysSilent = lastInteraction
      ? Math.floor((Date.now() - lastInteraction.getTime()) / (1000 * 60 * 60 * 24))
      : 999

    // ── 3. Preparar contexto para o modelo ────────────────────────────────
    // Mensagens em ordem cronológica para leitura do Claude
    const conversationContext = [...messages]
      .reverse()
      .map(m => {
        const role = m.source === "whatsapp" ? "LEAD" : "CORRETOR"
        const time = new Date(m.timestamp).toLocaleDateString("pt-BR", {
          day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"
        })
        return `[${time}] ${role}: ${m.content || "(mídia sem texto)"}`
      })
      .join("\n")

    const memoriesContext = memories
      .map(m => `• [${m.type}] ${m.content} (confiança: ${Math.round((m.confidence || 0) * 100)}%)`)
      .join("\n")

    const insightsContext = insights
      .map(i => `• ${i.content} (urgência: ${i.urgency})`)
      .join("\n")

    // ── 4. Prompt para o classificador ────────────────────────────────────
    const systemPrompt = `Você é um analista de comportamento humano especializado em decisões imobiliárias.
Sua função é interpretar o silêncio de um potencial comprador/locatário como um analista clínico — não como um sistema de CRM.

Você não categoriza leads. Você lê pessoas.

Você deve raciocinar em voz alta, como um psicólogo que observa padrões de comportamento, antes de chegar a qualquer conclusão.

Responda APENAS com um objeto JSON válido. Sem markdown, sem explicações fora do JSON.`

    const userPrompt = `Analise o silêncio deste lead e classifique o motivo com precisão clínica.

═══════════════════════════════════════
DADOS DO LEAD
═══════════════════════════════════════
Nome: ${lead.name || "Desconhecido"}
Estágio: ${lead.orbit_stage || "desconhecido"}
Dias em silêncio: ${daysSilent}
Última interação: ${lastInteraction?.toLocaleDateString("pt-BR") || "desconhecida"}

═══════════════════════════════════════
ESTADO COGNITIVO (última análise da IA)
═══════════════════════════════════════
Interest Score: ${cog?.interest_score ?? "N/A"}
Momentum Score: ${cog?.momentum_score ?? "N/A"}
Risk Score: ${cog?.risk_score ?? "N/A"}
Estado atual: ${cog?.current_state || "desconhecido"}
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
3. O que o conflito central e as memórias revelam sobre o bloqueio?
4. Qual é a temperatura emocional inferida deste lead agora?
5. O silêncio é evitação, timing, desinteresse ou outra coisa?

Classifique usando APENAS um destes valores para silence_reason:
PRICE_FRICTION | MISALIGNMENT | TIMING | TRUST_GAP | OVERWHELM | LOW_INTENT | COMPETITOR | RESOLVED_ELSEWHERE | UNKNOWN

Classifique usando APENAS um destes valores para strategy:
REANCHOR_VALUE | SURFACE_NEW_ASSET | OPEN_QUESTION | TRUST_REBUILD | GENTLE_CLOSE | WAIT | RELEASE

Para should_include_properties:
- true: apenas se o lead tinha interesse alto e o silêncio não é por desalinhamento ou confiança
- false: em todos os outros casos

Para urgency:
- high: janela de reativação curta, lead valia muito
- medium: vale tentar, mas sem pressa
- low: baixo sinal, tente uma vez
- none: não tente agora

Responda APENAS com este JSON:
{
  "reasoning": "seu raciocínio clínico livre, como um analista pensando em voz alta, mínimo 3 parágrafos",
  "silence_reason": "...",
  "confidence": 0.0,
  "emotional_state": "descrição do estado emocional inferido",
  "last_known_intent": "qual era a intenção real antes do silêncio",
  "strategy": "...",
  "should_include_properties": false,
  "urgency": "...",
  "best_contact_window": "quando contatar (ex: tarde após 17h, manhã)",
  "next_step_if_reply": "o que fazer se ele responder",
  "next_step_if_ignore": "quando e como tentar de novo se ignorar"
}`

    // ── 5. Chamar o modelo ─────────────────────────────────────────────────
    const anthropic = new Anthropic()

    const response = await anthropic.messages.create({
      model: "gpt-4o-mini",
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    })

    const rawContent = response.content[0]
    if (rawContent.type !== "text") {
      throw new Error("Unexpected response type from model")
    }

    // ── 6. Parsear resposta ────────────────────────────────────────────────
    let parsed: Omit<SilenceAnalysis, "lead_id" | "days_silent" | "analyzed_at">

    try {
      const clean = rawContent.text
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim()
      parsed = JSON.parse(clean)
    } catch {
      throw new Error(`Failed to parse model response: ${rawContent.text.slice(0, 200)}`)
    }

    // ── 7. Montar resposta final ───────────────────────────────────────────
    const analysis: SilenceAnalysis = {
      lead_id: leadId,
      days_silent: daysSilent,
      analyzed_at: new Date().toISOString(),
      ...parsed,
    }

    // ── 8. Persistir no Supabase para histórico e aprendizado ─────────────
    await supabase.from("silence_analyses").upsert({
      lead_id: leadId,
      days_silent: daysSilent,
      silence_reason: analysis.silence_reason,
      confidence: analysis.confidence,
      strategy: analysis.strategy,
      urgency: analysis.urgency,
      should_include_properties: analysis.should_include_properties,
      reasoning: analysis.reasoning,
      emotional_state: analysis.emotional_state,
      last_known_intent: analysis.last_known_intent,
      best_contact_window: analysis.best_contact_window,
      next_step_if_reply: analysis.next_step_if_reply,
      next_step_if_ignore: analysis.next_step_if_ignore,
      analyzed_at: analysis.analyzed_at,
      // campos para aprendizado futuro (preenchidos após envio)
      message_sent: false,
      had_response: null,
      response_time_minutes: null,
    }, { onConflict: "lead_id" })

    return NextResponse.json(analysis)

  } catch (error) {
    console.error("[SILENCE ANALYSIS] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    )
  }
}
