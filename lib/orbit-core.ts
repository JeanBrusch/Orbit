import OpenAI from "openai";
import { getSupabaseServer } from "./supabase-server";
import { Database } from "./database.types";
import { trackAICall, trackEvent } from "./observability";

let _openaiCache: OpenAI | null = null;
function getOpenAI() {
  if (_openaiCache) return _openaiCache;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === "dummy-key") return null;
  _openaiCache = new OpenAI({ apiKey });
  return _openaiCache;
}

function getSupabase() {
  try {
    return getSupabaseServer();
  } catch (err) {
    console.warn("[ORBIT CORE] Supabase credentials missing.", err);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════

export type EventType =
  | "message_inbound"
  | "message_outbound"
  | "note"
  | "property_sent"
  | "property_reaction";

/** Estado comportamental do lead — controlado pelo State Engine */
export interface LeadBehaviorState {
  lead_phase: "ACTIVE" | "PAUSED" | "DIAGNOSING";
  lead_stage: "DISCOVERY" | "EXPLORATION" | "DIRECTION" | "DECISION";
  next_allowed_action_at: string | null;
  reentry_trigger_type: "date" | "event" | null;
  reentry_trigger_value: string | null;
}

/** Ação real registrada (não só sugestão) */
export interface LeadAction {
  lead_id: string;
  type: "whatsapp" | "note" | "property_sent" | "call";
  content: string;
  sent_at?: string;
  expected_signal?: "reply" | "none";
  outcome?: "pending" | "replied" | "ignored";
  ai_analysis_id?: string;
  metadata?: Record<string, unknown>;
}

interface PauseStrategy {
  should_pause: boolean;
  reason: string;
  resume_at?: string;             // ISO8601
  reentry_trigger?: { type: "date" | "event"; value: string };
}

interface CoreAnalysis {
  analise_interna: {
    estagio_atual: "descoberta" | "exploracao" | "direcionamento" | "decisao" | "manutencao";
    intencao_detectada: string;
    clima_emocional: string;
  };
  acao_sugerida: {
    objetivo_curto_prazo: string;
    mensagem_whatsapp: string;
    gancho_de_possibilidade: string;
  };
  // Campos legados + métricas
  intention: string;
  pain: string | null;
  central_conflict: string | null;
  what_not_to_do: string | null;
  signal: "positive" | "negative" | "neutral";
  urgency: number;          // 0-100
  interest_delta: number;   // -20 a 20
  momentum_delta: number;   // -20 a 20
  risk_delta: number;
  memory_profile: { type: string; content: string }[] | null;
  memory_context: { type: string; content: string }[] | null;
  memory_events: { type: string; content: string }[] | null;
  current_cognitive_state: "latent" | "curious" | "exploring" | "evaluating" | "deciding" | "resolved" | "dormant";
  action_suggested: "needs_attention" | "follow_up" | "none";
  action_description: string;
  summary: string;
  // State Engine v2
  lead_stage_update?: "DISCOVERY" | "EXPLORATION" | "DIRECTION" | "DECISION";
  pause_strategy?: PauseStrategy;
}

// ═══════════════════════════════════════════════════════════
// GATE: shouldRunAI
// ═══════════════════════════════════════════════════════════

/**
 * Determina se o pipeline cognitivo deve rodar.
 * Leads em PAUSED são bloqueados até next_allowed_action_at.
 * Mensagens INBOUND de clientes sempre passam (o cliente respondeu!).
 */
function shouldRunAI(
  leadState: LeadBehaviorState,
  eventType: EventType
): { run: boolean; reason: string } {
  // Mensagem inbound do cliente sempre desbloqueie — cliente falou
  if (eventType === "message_inbound") {
    return { run: true, reason: "inbound_unblocks" };
  }

  if (leadState.lead_phase === "PAUSED") {
    if (!leadState.next_allowed_action_at) {
      return { run: false, reason: "lead_paused_no_date" };
    }
    const allowed = new Date(leadState.next_allowed_action_at).getTime();
    if (Date.now() < allowed) {
      return { run: false, reason: `lead_paused_until_${leadState.next_allowed_action_at}` };
    }
    // Passou do tempo de pausa → reativa
    return { run: true, reason: "pause_expired" };
  }

  return { run: true, reason: "active" };
}

// ═══════════════════════════════════════════════════════════
// VALIDADOR ANTI-RESPOSTA-FRACA
// ═══════════════════════════════════════════════════════════

const WEAK_PATTERNS = [
  "confirmar interesse",
  "ver se ainda",
  "acompanhar",
  "seguir contato",
  "verificar se",
  "checar se",
];

function isWeakAction(action: string): boolean {
  const lower = action.toLowerCase();
  return WEAK_PATTERNS.some((p) => lower.includes(p));
}

// ═══════════════════════════════════════════════════════════
// DECAIMENTO TEMPORAL DE SCORES
// ═══════════════════════════════════════════════════════════

function applyTemporalDecay(
  interestScore: number,
  momentumScore: number,
  lastHumanActionAt: string | null
): { interest: number; momentum: number } {
  if (!lastHumanActionAt) return { interest: interestScore, momentum: momentumScore };

  const daysSince = Math.max(
    0,
    (Date.now() - new Date(lastHumanActionAt).getTime()) / 86_400_000
  );

  if (daysSince <= 2) return { interest: interestScore, momentum: momentumScore };

  const momentumPenalty = Math.min(40, (daysSince - 2) * 3);
  const interestPenalty = daysSince > 5 ? Math.min(20, (daysSince - 5) * 1) : 0;

  return {
    interest: Math.max(0, interestScore - interestPenalty),
    momentum: Math.max(0, momentumScore - momentumPenalty),
  };
}

// ═══════════════════════════════════════════════════════════
// EMBEDDINGS E BUSCA (RAG)
// ═══════════════════════════════════════════════════════════

async function generateEmbedding(text: string): Promise<number[] | null> {
  if (!text || text.trim().length < 2) return null;
  const openai = getOpenAI();
  if (!openai) return null;
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text.replace(/\n/g, " "),
    });
    return response.data[0].embedding;
  } catch (err) {
    console.error("[ORBIT CORE] Erro ao gerar embedding:", err);
    return null;
  }
}

interface CompatibleProperty {
  id: string;
  title: string;
  similarity: number;
  description?: string;
  value?: number;
  neighborhood?: string;
  city?: string;
  bedrooms?: number;
  suites?: number;
  parking?: number;
  area_privativa?: number;
  payment_conditions?: any;
  internal_code?: string;
}

async function findCompatibleProperties(
  leadId: string,
  memory: any[],
  budgetMax: number | null
): Promise<CompatibleProperty[]> {
  const searchTerms = memory
    .filter((m) => ["location_preference", "property_type", "feature_preference"].includes(m.type))
    .map((m) => m.content)
    .join(" ");

  if (searchTerms.length < 5) return [];

  const queryEmbedding = await generateEmbedding(searchTerms);
  if (!queryEmbedding) return [];

  const { data: properties, error } = await (getSupabase()!.rpc("match_properties", {
    query_embedding: queryEmbedding,
    match_threshold: 0.5,
    match_count: 3,
  }) as any);

  if (error) {
    console.error("[ORBIT CORE] Erro na busca RAG:", error);
    return [];
  }

  let top3 = (properties || []) as CompatibleProperty[];
  if (budgetMax && budgetMax > 0) {
    top3 = top3.filter((p) => !p.value || p.value <= budgetMax * 1.15);
  }
  return top3;
}

function formatPropertiesForPrompt(properties: CompatibleProperty[]): string {
  if (properties.length === 0) return "Nenhum imóvel compatível encontrado no portfólio.";

  return properties
    .map((p) => {
      const valor = p.value ? `R$ ${p.value.toLocaleString("pt-BR")}` : "Valor não informado";
      const estrutura = [
        p.bedrooms ? `${p.bedrooms} dorm.` : null,
        p.suites ? `${p.suites} suítes` : null,
        p.area_privativa ? `${p.area_privativa}m²` : null,
      ]
        .filter(Boolean)
        .join(" · ");
      const localizacao = [p.neighborhood, p.city].filter(Boolean).join(", ");
      const condicoes = (() => {
        const cond = p.payment_conditions as any;
        if (!cond) return "Condições não informadas";
        const partes = [];
        if (cond.down_payment_percentage) partes.push(`Entrada ${cond.down_payment_percentage}%`);
        if (cond.installments) partes.push(`${cond.installments}x`);
        if (cond.financing) partes.push("Aceita financiamento");
        if (cond.exchange) partes.push("Estuda permuta");
        return partes.join(" · ") || "Condições não informadas";
      })();
      return `🏠 ${p.title}
   📍 ${localizacao}
   💰 ${valor} · ${estrutura}
   📝 ${p.description || "Sem descrição"}
   🛡️ CONDIÇÕES: ${condicoes}
   🔗 [Visualizar](https://atlas.orbitimoveis.com.br/imovel/${p.id})`;
    })
    .join("\n\n");
}

// ═══════════════════════════════════════════════════════════
// MOTOR COGNITIVO — ANÁLISE COM RETRY
// ═══════════════════════════════════════════════════════════

async function analyzeContext(
  leadId: string,
  content: string,
  type: EventType,
  leadState: LeadBehaviorState,
  context: {
    lastMessages: string;
    memory: string;
    cognitiveState: string;
    propertyInteractions: string;
    compatibleProperties: string;
    lastInsight: string;
    internalPropertyNotes?: string;
  },
  attempt = 1
): Promise<CoreAnalysis | null> {
  if (!process.env.OPENAI_API_KEY) return null;

  try {
    const phaseInstruction =
      leadState.lead_phase === "DIAGNOSING"
        ? `⚠️ LEAD EM DIAGNÓSTICO: Última ação foi ignorada. Identifique o bloqueio real antes de sugerir nova abordagem.`
        : ``;

    const prompt = `Você é o ORBIT, um assistente especialista em condução de clientes no mercado imobiliário.
Sua função é GERENCIAR O COMPORTAMENTO DO LEAD AO LONGO DO TEMPO — não apenas responder.

${phaseInstruction}

════════════════════════════════════════
ESTADO COMPORTAMENTAL DO LEAD
════════════════════════════════════════
Fase Atual: ${leadState.lead_phase}
Estágio de Decisão: ${leadState.lead_stage}
Estado Cognitivo: ${context.cognitiveState}
Memórias Prioritárias: ${context.memory || "Vazia"}
Último Insight: ${context.lastInsight}
Interações com Imóveis: ${context.propertyInteractions || "Nenhuma"}

════════════════════════════════════════
PORTFÓLIO COMPATÍVEL (RAG)
════════════════════════════════════════
${context.compatibleProperties}

${context.internalPropertyNotes ? `════════════════════════════════════════
CONDIÇÕES ESTRATÉGICAS (Notas Internas)
════════════════════════════════════════
${context.internalPropertyNotes}

` : ""}════════════════════════════════════════
CONVERSA RECENTE
════════════════════════════════════════
${context.lastMessages}

════════════════════════════════════════
NOVO EVENTO
════════════════════════════════════════
Tipo: ${type}
Conteúdo: "${content}"

════════════════════════════════════════
REGRAS CRÍTICAS
════════════════════════════════════════

1. CONDUÇÃO: Nunca seja reativo. Toda resposta deve evoluir a decisão.
2. NÃO FORCE VENDA: Conduza com curiosidade, não pressão.
3. GANCHO: Sempre adicione uma possibilidade que o lead não considerou.
4. PAUSA INTELIGENTE:
   Se o lead indicar claramente um momento futuro (ex: "volto em julho", "quando terminar a obra", "depois das férias"):
   - NÃO sugira follow-up imediato
   - Defina pause_strategy.should_pause = true
   - Calcule resume_at = data declarada + 2 dias de margem
   - Sugira UMA última mensagem que prepare o próximo contato
   - Se não houver avanço possível sem fricção → PAUSE obrigatório
5. AÇÃO FORTE: action_description DEVE ser acionável e específica.
   REPROVADO: "confirmar interesse", "acompanhar", "ver se ainda", "seguir contato"
   APROVADO: "[WhatsApp] · Enviar vídeo do terraço — lead mencionou 'área gourmet' duas vezes · Critério: reação ao vídeo"

════════════════════════════════════════
AUTO-CORREÇÃO
════════════════════════════════════════

TESTE 1 — Intenção é específica?
  ✗ "lead quer comprar", "lead interessado" → REPROVADO
  ✓ "lead testando se aceita permuta sem expor que precisa" → APROVADO

TESTE 2 — Conflito é estrutural?
  ✗ "lead indeciso", "sem urgência" → REPROVADO
  ✓ "cônjuge nunca apareceu — decisão travada em terceiro invisível" → APROVADO

TESTE 3 — action_description é acionável?
  ✗ Qualquer padrão fraco → REPROVADO
  ✓ "[canal] · [ação específica] · [critério de sucesso]" → APROVADO

Responda APENAS com JSON puro:
{
  "analise_interna": {
    "estagio_atual": "descoberta|exploracao|direcionamento|decisao|manutencao",
    "intencao_detectada": "string específica com dado da conversa",
    "clima_emocional": "string"
  },
  "acao_sugerida": {
    "objetivo_curto_prazo": "string",
    "mensagem_whatsapp": "string (tom natural, WhatsApp style)",
    "gancho_de_possibilidade": "string"
  },
  "intention": "string",
  "pain": "string ou null",
  "central_conflict": "string ou null",
  "what_not_to_do": "string específica baseada nesta conversa",
  "signal": "positive|negative|neutral",
  "urgency": 0-100,
  "interest_delta": number (-20 a 20),
  "momentum_delta": number (-20 a 20),
  "risk_delta": number (-10 a 10),
  "current_cognitive_state": "latent|curious|exploring|evaluating|deciding|resolved|dormant",
  "memory_profile": [{"type": "string", "content": "string"}],
  "memory_context": [{"type": "string", "content": "string"}],
  "memory_events": [{"type": "string", "content": "string"}],
  "action_suggested": "needs_attention|follow_up|none",
  "action_description": "[canal] · [ação específica] · [critério de sucesso]",
  "summary": "resumo em até 2 frases",
  "rag_property_recommended": "título do imóvel ou null",
  "lead_stage_update": "DISCOVERY|EXPLORATION|DIRECTION|DECISION",
  "pause_strategy": {
    "should_pause": false,
    "reason": "string",
    "resume_at": "ISO8601 ou null",
    "reentry_trigger": { "type": "date|event", "value": "string" }
  },
  "generic_check_passed": true
}`;

    const openai = getOpenAI();
    if (!openai) return null;

    const start = Date.now();
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Você é o ORBIT State Engine. Responda apenas em JSON." },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      temperature: attempt === 1 ? 0.1 : 0.4, // Mais criativo no retry
    });

    const elapsed = Date.now() - start;
    const usage = response.usage;

    if (usage) {
      await trackAICall({
        module: "orbit_core",
        model: "gpt-4o-mini",
        lead_id: leadId,
        tokens_input: usage.prompt_tokens,
        tokens_output: usage.completion_tokens,
        duration_ms: elapsed,
        metadata: {
          step: "decision",
          action: "analyze_context",
          attempt,
          event_type: type,
        },
      });
    }

    const text = response.choices[0].message.content || "{}";
    const analysis = JSON.parse(text) as CoreAnalysis;

    // ── Validador anti-resposta-fraca ─────────────────────
    if (isWeakAction(analysis.action_description)) {
      if (attempt < 2) {
        console.warn(
          `[ORBIT CORE] ação fraca detectada (tentativa ${attempt}): "${analysis.action_description}" — regenerando...`
        );
        return analyzeContext(leadId, content, type, leadState, context, attempt + 1);
      }
      console.warn("[ORBIT CORE] ação ainda fraca após retry — aceitando com cautela.");
    }

    return analysis;
  } catch (err: any) {
    if (err.status === 429) {
      console.error("[ORBIT CORE] QUOTA EXCEDIDA (429).");
    } else {
      console.error("[ORBIT CORE] Erro na análise:", err);
    }
    return null;
  }
}

// ═══════════════════════════════════════════════════════════
// HELPERS DE CONTEXTO
// ═══════════════════════════════════════════════════════════

async function getLeadBehaviorState(leadId: string): Promise<LeadBehaviorState> {
  const defaults: LeadBehaviorState = {
    lead_phase: "ACTIVE",
    lead_stage: "DISCOVERY",
    next_allowed_action_at: null,
    reentry_trigger_type: null,
    reentry_trigger_value: null,
  };

  try {
    const { data } = await (getSupabase()!
      .from("leads")
      .select("lead_phase, lead_stage, next_allowed_action_at, reentry_trigger_type, reentry_trigger_value")
      .eq("id", leadId)
      .maybeSingle() as any);

    if (!data) return defaults;
    return {
      lead_phase: data.lead_phase ?? "ACTIVE",
      lead_stage: data.lead_stage ?? "DISCOVERY",
      next_allowed_action_at: data.next_allowed_action_at ?? null,
      reentry_trigger_type: data.reentry_trigger_type ?? null,
      reentry_trigger_value: data.reentry_trigger_value ?? null,
    };
  } catch {
    return defaults;
  }
}

async function getContext(leadId: string, leadStateName = "exploring") {
  type MessageRow = Database["public"]["Tables"]["messages"]["Row"];
  type MemoryItemRow = Database["public"]["Tables"]["memory_items"]["Row"];
  type LeadCognitiveStateRow = Database["public"]["Tables"]["lead_cognitive_state"]["Row"];
  type PropertyInteractionRow = Database["public"]["Tables"]["property_interactions"]["Row"];

  const limits: Record<string, number> = {
    deciding: 12, evaluating: 10, exploring: 8, curious: 6, latent: 5, dormant: 3,
  };
  const messageLimit = limits[leadStateName] || 8;

  const [messagesRes, memoryRes, stateRes, interactionsRes, insightsRes] = await Promise.all([
    getSupabase()?.from("messages").select("*").eq("lead_id", leadId).order("timestamp", { ascending: false }).limit(messageLimit),
    getSupabase()?.from("memory_items").select("*").eq("lead_id", leadId).limit(40),
    getSupabase()?.from("lead_cognitive_state").select("*").eq("lead_id", leadId).maybeSingle(),
    getSupabase()?.from("property_interactions").select("*").eq("lead_id", leadId).limit(5),
    getSupabase()?.from("ai_insights").select("*").eq("lead_id", leadId).order("created_at", { ascending: false }).limit(5),
  ]);

  const rawMessages = (messagesRes?.data || []) as MessageRow[];
  const rawMemory = (memoryRes?.data || []) as MemoryItemRow[];
  const cognitiveState = (stateRes?.data || null) as LeadCognitiveStateRow | null;
  const interactions = (interactionsRes?.data || []) as PropertyInteractionRow[];
  const rawInsights = (insightsRes?.data || []) as any[];

  // Notas internas dos imóveis enviados
  let internalPropertyNotes = "";
  try {
    const sentPropertyIds = interactions
      .filter((i: any) => i.interaction_type === "sent")
      .map((i: any) => i.property_id)
      .filter(Boolean);

    if (sentPropertyIds.length > 0) {
      const { data: propNotes } = await (getSupabase() as any)
        .from("properties")
        .select("title, internal_code, internal_notes")
        .in("id", sentPropertyIds)
        .not("internal_notes", "is", null);

      if (propNotes?.length > 0) {
        internalPropertyNotes = propNotes
          .filter((p: any) => p.internal_notes?.trim())
          .map((p: any) => `[${p.internal_code || p.title}] ${p.internal_notes}`)
          .join(" | ");
      }
    }
  } catch (err) {
    console.warn("[ORBIT CORE] Erro notas internas:", err);
  }

  const MEMORY_PRIORITY: Record<string, number> = {
    identity: 1, budget_range: 2, location_preference: 3, property_type: 4, feature_preference: 5,
    current_search: 6, location_focus: 7, budget: 8, priority: 9,
    property_sent: 10, visited: 11, discarded: 12, price_objection: 13,
  };

  const sortedMemories = rawMemory
    .sort((a, b) => (MEMORY_PRIORITY[a.type] || 99) - (MEMORY_PRIORITY[b.type] || 99))
    .slice(0, 15);

  const lastRelevantInsight = rawInsights.find((i) => (i.urgency || 0) >= 3);

  return {
    lastMessages: [...rawMessages]
      .reverse()
      .map((m) => {
        let content = m.content || "";
        if (content.trim().startsWith("{")) {
          try {
            const parsed = JSON.parse(content);
            if (parsed.type === "audio") content = parsed.transcript ? `[Áudio]: "${parsed.transcript}"` : "[Áudio]";
            else if (parsed.type === "image") content = parsed.caption ? `[Imagem]: "${parsed.caption}"` : "[Imagem]";
            else content = parsed.transcript || parsed.caption || parsed.text || content;
          } catch {}
        }
        return `[${m.source}] ${content}`;
      })
      .join("\n"),
    rawMessages,
    memory: sortedMemories.map((m) => `${m.type}: ${m.content}`).join(" | "),
    rawMemory,
    cognitiveState: cognitiveState
      ? `Interest: ${cognitiveState.interest_score}, Momentum: ${cognitiveState.momentum_score}, State: ${cognitiveState.current_state}`
      : "Vazio",
    propertyInteractions: interactions.map((i) => `${i.interaction_type} em ${i.timestamp}`).join(" | "),
    lastInsight: lastRelevantInsight ? `${lastRelevantInsight.content}` : "Nenhum",
    currentState: cognitiveState,
    internalPropertyNotes,
  };
}

// ═══════════════════════════════════════════════════════════
// FUNÇÃO PRINCIPAL
// ═══════════════════════════════════════════════════════════

export async function processEventWithCore(
  leadId: string,
  content: string,
  type: EventType,
  messageId?: string
): Promise<void> {
  if (!content || content.trim() === "") return;

  console.log(`[ORBIT CORE] 🚀 Pipeline iniciado: leadId=${leadId} type=${type}`);

  let cleanContent = content;
  if (content.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(content);
      cleanContent = parsed.transcript || parsed.caption || parsed.text || content;
    } catch {}
  }

  try {
    // ── PASSO 0: Carregar estado comportamental ───────────
    const leadBehaviorState = await getLeadBehaviorState(leadId);

    // ── PASSO 1: Gate shouldRunAI ─────────────────────────
    const gate = shouldRunAI(leadBehaviorState, type);
    if (!gate.run) {
      console.log(`[ORBIT CORE] 🚫 Pipeline bloqueado — ${gate.reason}`);
      await trackEvent({
        lead_id: leadId,
        event_type: "gate_blocked",
        source: "system",
        module: "orbit_core",
        step: "gate",
        action: "blocked",
        metadata_json: { reason: gate.reason, phase: leadBehaviorState.lead_phase },
      });
      return;
    }

    if (gate.reason === "inbound_unblocks" && leadBehaviorState.lead_phase === "PAUSED") {
      // Cliente voltou a responder durante pausa — reativa
      await (getSupabase()?.from("leads") as any)
        .update({ lead_phase: "ACTIVE", next_allowed_action_at: null })
        .eq("id", leadId);
      leadBehaviorState.lead_phase = "ACTIVE";
      console.log(`[ORBIT CORE] ✅ Lead reativado por mensagem inbound`);
    }

    // ── PASSO 2: Contexto e RAG ───────────────────────────
    const { data: initialLead } = await (getSupabase()!
      .from("leads")
      .select("orbit_stage")
      .eq("id", leadId)
      .maybeSingle() as any);

    const context = await getContext(leadId, initialLead?.orbit_stage || "exploring");

    const budgetMemory = context.rawMemory.find(
      (m) => m.type === "budget_range" || m.type === "budget"
    );
    const budgetMax = budgetMemory
      ? parseFloat(budgetMemory.content.replace(/\D/g, "")) || null
      : null;

    const compatibleProps = await findCompatibleProperties(leadId, context.rawMemory, budgetMax);
    const compatiblePropertiesText = formatPropertiesForPrompt(compatibleProps);

    // ── PASSO 3: Análise cognitiva (com retry automático) ──
    const analysis = await analyzeContext(leadId, cleanContent, type, leadBehaviorState, {
      ...context,
      compatibleProperties: compatiblePropertiesText,
      internalPropertyNotes: context.internalPropertyNotes,
    });

    if (!analysis) {
      console.error(`[ORBIT CORE] ❌ Falha na análise: leadId=${leadId}`);
      return;
    }

    console.log(`[ORBIT CORE] ✅ Análise: ${analysis.current_cognitive_state} | pause=${analysis.pause_strategy?.should_pause}`);

    // ── PASSO 4: Atualizar mensagem com embedding ──────────
    if (messageId) {
      const currentEmbedding = await generateEmbedding(cleanContent);
      const r1 = await (getSupabase()?.from("messages") as any)
        .update({ ai_analysis: analysis as any, embedding: currentEmbedding })
        .eq("id", messageId);
      if (r1?.error) console.error(`[ORBIT CORE] Passo 4 ERRO:`, r1.error);
    }

    // ── PASSO 5: Atualizar estado cognitivo ───────────────
    const cur = context.currentState;
    const decayed = applyTemporalDecay(
      cur?.interest_score ?? 50,
      cur?.momentum_score ?? 50,
      cur?.last_human_action_at ?? null
    );
    const newInterest = Math.min(100, Math.max(0, decayed.interest + analysis.interest_delta));
    const newMomentum = Math.min(100, Math.max(0, decayed.momentum + analysis.momentum_delta));
    const newRisk = typeof analysis.risk_delta === "number"
      ? Math.min(100, Math.max(0, (cur?.risk_score ?? 50) + analysis.risk_delta))
      : cur?.risk_score ?? 50;

    const r2 = await (getSupabase()?.from("lead_cognitive_state") as any).upsert({
      lead_id: leadId,
      interest_score: newInterest,
      momentum_score: newMomentum,
      current_state: analysis.current_cognitive_state,
      last_ai_analysis_at: new Date().toISOString(),
      risk_score: newRisk,
      clarity_level: cur?.clarity_level ?? 50,
      central_conflict: analysis.central_conflict ?? null,
      what_not_to_do: analysis.what_not_to_do ?? null,
    });
    if (r2?.error) console.error(`[ORBIT CORE] Passo 5 ERRO:`, r2.error);

    // ── PASSO 6: Gravar insight rico ──────────────────────
    const urgency1to5 = Math.min(5, Math.max(1, Math.round(analysis.urgency / 20)));
    const r3 = await (getSupabase()?.from("ai_insights") as any).insert({
      lead_id: leadId,
      type: "suggestion",
      content: `${analysis.intention} · Próxima ação: ${analysis.action_description}`,
      urgency: urgency1to5,
      message_intention: analysis.analise_interna.intencao_detectada,
      emotional_climate: analysis.analise_interna.clima_emocional,
      possibility_hook: analysis.acao_sugerida.gancho_de_possibilidade,
      suggested_whatsapp_message: analysis.acao_sugerida.mensagem_whatsapp,
    });
    const insightId = r3?.data?.[0]?.id ?? null;
    if (r3?.error) console.error(`[ORBIT CORE] Passo 6 ERRO:`, r3.error);

    // ── PASSO 7: Registrar ação real em lead_actions ───────
    if (analysis.action_suggested !== "none" && analysis.acao_sugerida.mensagem_whatsapp) {
      await (getSupabase()?.from("lead_actions") as any).insert({
        lead_id: leadId,
        type: "whatsapp",
        content: analysis.acao_sugerida.mensagem_whatsapp,
        expected_signal: "reply",
        outcome: "pending",
        ai_analysis_id: insightId,
        metadata: {
          action_description: analysis.action_description,
          urgency: analysis.urgency,
          stage: analysis.analise_interna.estagio_atual,
        },
      });
    }

    // ── PASSO 8: Gravar memórias ───────────────────────────
    const VALID_MEMORY_TYPES = [
      "intent", "preference", "budget", "constraint", "pain", "event", "objection",
      "identity", "budget_range", "location_preference", "property_type", "feature_preference",
      "current_search", "location_focus", "priority", "property_sent", "visited", "discarded",
      "price_objection", "proposal_made", "visit_scheduled",
    ];
    const memoriesToSave = [
      ...(analysis.memory_profile || []).filter((m) => VALID_MEMORY_TYPES.includes(m.type)),
      ...(analysis.memory_context || []).filter((m) => VALID_MEMORY_TYPES.includes(m.type)),
      ...(analysis.memory_events || []).map((m) => ({ ...m, type: "event" })),
    ];
    for (const mem of memoriesToSave) {
      await (getSupabase()?.from("memory_items") as any).insert({
        lead_id: leadId,
        type: mem.type as any,
        content: mem.content,
        confidence: Math.round(analysis.urgency),
        source_message_id: messageId || null,
      });
    }

    // ── PASSO 9: Vetor semântico ───────────────────────────
    const contextString = (analysis.memory_context || []).map((m) => m.content).join(" ");
    const profileString = (analysis.memory_profile || []).map((m) => m.content).join(" ");
    const [embContext, embProfile, embConv, embEvents] = await Promise.all([
      generateEmbedding(contextString),
      generateEmbedding(profileString),
      generateEmbedding(context.lastMessages),
      generateEmbedding((analysis.memory_events || []).map((m) => m.content).join(" ")),
    ]);

    if (embContext || embProfile || embConv || embEvents) {
      const vectorSize = embContext?.length || embProfile?.length || embConv?.length || embEvents?.length || 0;
      if (vectorSize > 0) {
        const compositeVector = new Array(vectorSize).fill(0);
        for (let i = 0; i < vectorSize; i++) {
          compositeVector[i] =
            ((embContext?.[i] || 0) * 0.4) +
            ((embProfile?.[i] || 0) * 0.3) +
            ((embConv?.[i] || 0) * 0.2) +
            ((embEvents?.[i] || 0) * 0.1);
        }
        const r5 = await (getSupabase()?.from("leads") as any)
          .update({ semantic_vector: compositeVector })
          .eq("id", leadId);
        if (r5?.error) console.error(`[ORBIT CORE] Passo 9 ERRO:`, r5.error);
      }
    }

    // ── PASSO 10: Atualizar lead (fase + estágio + pausa) ──
    const leadUpdates: Record<string, any> = {
      action_suggested: analysis.action_description,
      last_evaluated_at: new Date().toISOString(),
      orbit_stage: analysis.current_cognitive_state,
      client_stage: analysis.analise_interna.estagio_atual,
    };

    // Atualizar estágio de decisão se a IA sugerir upgrade
    if (analysis.lead_stage_update) {
      leadUpdates.lead_stage = analysis.lead_stage_update;
    }

    // Aplicar pausa inteligente
    if (analysis.pause_strategy?.should_pause) {
      leadUpdates.lead_phase = "PAUSED";
      leadUpdates.next_allowed_action_at = analysis.pause_strategy.resume_at ?? null;
      if (analysis.pause_strategy.reentry_trigger) {
        leadUpdates.reentry_trigger_type = analysis.pause_strategy.reentry_trigger.type;
        leadUpdates.reentry_trigger_value = analysis.pause_strategy.reentry_trigger.value;
      }
      console.log(`[ORBIT CORE] ⏸️ Lead pausado até ${analysis.pause_strategy.resume_at} — motivo: ${analysis.pause_strategy.reason}`);
    } else if (leadBehaviorState.lead_phase !== "PAUSED") {
      // Manter ACTIVE (não sobrescrever PAUSED que acabou de ser definido)
      leadUpdates.lead_phase = "ACTIVE";
    }

    const r6 = await (getSupabase()?.from("leads") as any)
      .update(leadUpdates)
      .eq("id", leadId);
    if (r6?.error) console.error(`[ORBIT CORE] Passo 10 ERRO:`, r6.error);

    // ── PASSO 11: Track cognitivo ──────────────────────────
    await trackEvent({
      lead_id: leadId,
      event_type: "classification",
      source: "system",
      module: "orbit_core",
      step: "cognition",
      action: "state_updated",
      origin: "decision",
      destination: "suggested_action",
      saved_data: true,
      metadata_json: {
        state: analysis.current_cognitive_state,
        interest: newInterest,
        momentum: newMomentum,
        phase: leadUpdates.lead_phase,
        paused: analysis.pause_strategy?.should_pause ?? false,
      },
    });

    console.log(
      `[ORBIT CORE] 🏁 Concluído: ${analysis.current_cognitive_state} | phase=${leadUpdates.lead_phase} | I:${newInterest} M:${newMomentum}`
    );
  } catch (err) {
    console.error("[ORBIT CORE] ❌ Erro crítico no pipeline:", err);
  }
}