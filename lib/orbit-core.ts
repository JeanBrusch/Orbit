import OpenAI from "openai";
import { getSupabaseServer } from "./supabase-server";
import { Database } from "./database.types";
import { trackAICall } from "./observability";

let _openaiCache: OpenAI | null = null;
function getOpenAI() {
  if (_openaiCache) return _openaiCache;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === "dummy-key") return null;
  _openaiCache = new OpenAI({ apiKey });
  return _openaiCache;
}

// Always create a fresh client — serverless environments cannot reuse connections safely
function getSupabase() {
  try {
    return getSupabaseServer();
  } catch (err) {
    console.warn("[ORBIT CORE] Supabase credentials missing during access.", err);
    return null;
  }
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type EventType =
  | "message_inbound"
  | "message_outbound"
  | "note"
  | "property_sent"
  | "property_reaction";

interface CoreAnalysis {
  intention: string;
  pain: string | null;
  central_conflict: string | null;
  what_not_to_do: string | null;
  signal: "positive" | "negative" | "neutral";
  urgency: number; // 0-100
  interest_delta: number; // -20 a 20
  momentum_delta: number; // -20 a 20
  risk_delta: number;
  // Memória Tripartite
  memory_profile: { type: string, content: string }[] | null;
  memory_context: { type: string, content: string }[] | null;
  memory_events: { type: string, content: string }[] | null;
  current_cognitive_state: 'latent' | 'curious' | 'exploring' | 'evaluating' | 'deciding' | 'resolved' | 'dormant';
  action_suggested: string;
  action_description: string;
  summary: string; // Resumo curto da interação
}

// ─── Decaimento temporal de scores ───────────────────────────────────────────
// Aplica penalidade progressiva baseada em dias sem interação humana.
// Momentum decai mais rápido (ciclo de decisão curto).
// Interest decai mais devagar (desejo persiste mais).

function applyTemporalDecay(
  interestScore: number,
  momentumScore: number,
  lastHumanActionAt: string | null
): { interest: number; momentum: number } {
  if (!lastHumanActionAt) {
    return { interest: interestScore, momentum: momentumScore }
  }

  const daysSinceLastContact = Math.max(
    0,
    (Date.now() - new Date(lastHumanActionAt).getTime()) / (1000 * 60 * 60 * 24)
  )

  // Sem decaimento nos primeiros 2 dias
  if (daysSinceLastContact <= 2) {
    return { interest: interestScore, momentum: momentumScore }
  }

  // Momentum: -3 por dia após 2 dias de silêncio (ciclo rápido)
  // Interest:  -1 por dia após 5 dias de silêncio (desejo dura mais)
  const momentumPenalty = Math.min(40, (daysSinceLastContact - 2) * 3)
  const interestPenalty = daysSinceLastContact > 5
    ? Math.min(20, (daysSinceLastContact - 5) * 1)
    : 0

  return {
    interest: Math.max(0, interestScore - interestPenalty),
    momentum: Math.max(0, momentumScore - momentumPenalty),
  }
}


// ─── Geração de Embedding ─────────────────────────────────────────────────────

export async function generateEmbedding(text: string): Promise<number[] | null> {
  if (!process.env.OPENAI_API_KEY) {
    console.warn("[ORBIT CORE] OPENAI_API_KEY missing for embedding.");
    return null;
  }
  if (!text || text.trim() === "") return null;
  const start = Date.now();
  try {
    const openai = getOpenAI();
    if (!openai) {
      console.warn("[ORBIT CORE] OpenAI client not initialized for embedding.");
      return null;
    }
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });
    
    const elapsed = Date.now() - start;
    const usage = response.usage;
    
    // Rastrear custo do embedding
    await trackAICall({
      module: 'orbit_core',
      model: 'text-embedding-3-small',
      tokens_input: usage.prompt_tokens,
      tokens_output: 0,
      duration_ms: elapsed,
      metadata: { action: 'generate_embedding' }
    });

    return response.data[0].embedding || null;
  } catch (err: any) {
    if (err.status === 429) {
      console.error("[ORBIT CORE] QUOTA EXCEDIDA (429) na OpenAI (Embeddings).");
    } else {
      console.error("[ORBIT CORE] Erro ao gerar embedding (OpenAI):", err);
    }
    return null;
  }
}

// ─── Tipos do RAG ─────────────────────────────────────────────────────────────

interface CompatibleProperty {
  id: string;
  title: string | null;
  value: number | null;
  neighborhood: string | null;
  city: string | null;
  bedrooms: number | null;
  suites: number | null;
  area_privativa: number | null;
  payment_conditions: any | null;
  features: string[] | null;
  similarity: number;
}

// ─── PASSO A: Montar vetor de perfil limpo do lead ────────────────────────────

async function buildLeadProfileEmbedding(
  rawMemory: Array<{ type: string; content: string }>
): Promise<number[] | null> {
  const PROFILE_TYPES = [
    "location_preference",
    "property_type",
    "feature_preference",
    "budget_range",
    "current_search",
    "location_focus",
    "budget",
    "priority",
  ];

  const relevantMemories = rawMemory
    .filter((m) => PROFILE_TYPES.includes(m.type))
    .map((m) => m.content)
    .join(". ");

  if (!relevantMemories.trim()) return null;

  console.log(`[ORBIT RAG] Gerando vetor de perfil: "${relevantMemories.slice(0, 120)}..."`);
  return generateEmbedding(relevantMemories);
}

// ─── PASSO B: Buscar imóveis compatíveis via pgvector ────────────────────────

async function findCompatibleProperties(
  leadId: string,
  rawMemory: Array<{ type: string; content: string }>,
  budgetMax?: number | null
): Promise<CompatibleProperty[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  // 1. Montar vetor de perfil do lead
  const profileVector = await buildLeadProfileEmbedding(rawMemory);
  if (!profileVector) {
    console.log(`[ORBIT RAG] Sem memórias de perfil suficientes para lead ${leadId}. Pulando RAG.`);
    return [];
  }

  // 2. Coletar IDs de imóveis descartados pelo lead
  const discardedRes = await (supabase.from("memory_items") as any)
    .select("content")
    .eq("lead_id", leadId)
    .eq("type", "discarded");

  const discardedIds: string[] = (discardedRes?.data || [])
    .map((m: any) => {
      const match = m.content?.match(
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
      );
      return match ? match[0] : null;
    })
    .filter(Boolean);

  console.log(
    `[ORBIT RAG] Buscando imóveis para lead ${leadId}. Descartados: ${discardedIds.length}`
  );

  // 3. Chamar função RPC match_properties no Supabase
  const { data, error } = await (supabase.rpc as any)("match_properties", {
    query_embedding: profileVector,
    match_threshold: 0.60,
    match_count: 5,
    exclude_ids: discardedIds.length > 0 ? discardedIds : [],
  });

  if (error) {
    console.error(`[ORBIT RAG] Erro na busca RPC:`, error);
    return [];
  }

  let results = (data || []) as CompatibleProperty[];

  // 4. Filtro de budget — exclui imóveis acima de 120% do orçamento declarado
  if (budgetMax && budgetMax > 0) {
    results = results.filter(
      (p) => !p.value || p.value <= budgetMax * 1.2
    );
  }

  // 5. Retorna top 3
  const top3 = results.slice(0, 3);
  console.log(
    `[ORBIT RAG] Top ${top3.length} imóveis compatíveis:`,
    top3.map((p) => `${p.title} (score: ${p.similarity.toFixed(2)})`)
  );

  return top3;
}

// ─── PASSO C: Formatar imóveis como texto para o prompt ──────────────────────

function formatPropertiesForPrompt(properties: CompatibleProperty[]): string {
  if (properties.length === 0) return "Nenhum imóvel compatível encontrado no portfólio atual.";

  return properties
    .map((p, i) => {
      const valor = p.value
        ? `R$ ${p.value.toLocaleString("pt-BR")}`
        : "Valor não informado";

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
        if (cond.down_payment_percentage)
          partes.push(`Entrada ${cond.down_payment_percentage}%`);
        if (cond.installments) partes.push(`${cond.installments}x`);
        if (cond.financing) partes.push("Aceita financiamento");
        if (cond.exchange) partes.push("Estuda permuta");
        return partes.join(" · ") || "Condições não informadas";
      })();

      const features =
        p.features && p.features.length > 0
          ? p.features.slice(0, 4).join(", ")
          : null;

      return [
        `${i + 1}. ${p.title || "Imóvel sem título"} [score: ${(p.similarity * 100).toFixed(0)}%]`,
        `   Valor: ${valor}`,
        `   Estrutura: ${estrutura || "Não informado"}`,
        `   Local: ${localizacao || "Não informado"}`,
        `   Condições: ${condicoes}`,
        features ? `   Destaques: ${features}` : null,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
}

// ─── Análise com OpenAI ───────────────────────────────────────────────────────
async function analyzeContext(
  leadId: string,
  content: string,
  type: EventType,
  context: {
    lastMessages: string;
    memory: string;
    cognitiveState: string;
    propertyInteractions: string;
    compatibleProperties: string;
  }
): Promise<CoreAnalysis | null> {
  if (!process.env.OPENAI_API_KEY) {
    console.warn("[ORBIT CORE] OPENAI_API_KEY missing for analysis.");
    return null;
  }

  try {
    const prompt = `Você é o ORBIT Core — motor de decisão comercial imobiliário.
Sua função não é refletir. É diagnosticar e definir o próximo movimento obrigatório.

════════════════════════════════════════
ESTADO ATUAL DO LEAD
════════════════════════════════════════
Estado Cognitivo: ${context.cognitiveState}
Memórias Acumuladas: ${context.memory || "Vazia"}
Interações com Imóveis: ${context.propertyInteractions || "Nenhuma"}

════════════════════════════════════════
PORTFÓLIO COMPATÍVEL (RAG)
════════════════════════════════════════
${context.compatibleProperties}

════════════════════════════════════════
CONVERSA RECENTE
════════════════════════════════════════
${context.lastMessages}

════════════════════════════════════════
NOVO EVENTO
════════════════════════════════════════
Tipo: ${type}
Conteúdo: "${content}"

════════════════════════════════════════
SUA TAREFA
════════════════════════════════════════

1. ESTADO COGNITIVO — qual o estágio real da decisão:
   - latent: contato inicial ou inativo
   - curious: perguntas genéricas, sem foco
   - exploring: busca ativa, perfil ainda não definido
   - evaluating: comparando opções, analisando detalhes
   - deciding: pede visita, simulação ou proposta
   - resolved: negócio fechado ou definitivamente perdido
   - dormant: sem resposta por longo período

2. MEMÓRIA TRIPARTITE — extraia fatos concretos:
   - Profile (duradouro): identity, budget_range, location_preference, property_type, feature_preference
   - Context (intencao atual): current_search, location_focus, budget, priority
   - Events (ações concretas): property_sent, visited, discarded, price_objection, proposal_made, visit_scheduled

3. CONFLITO CENTRAL — identifique o travamento real.
   Não o que o lead disse. O que está impedindo a decisão.
   Exemplos reais: "quer 4 suítes mas orçamento cobre 3", "depende de vender imóvel próprio primeiro",
   "cônjuge não esteve presente em nenhuma interação", "comparando com produto que já viu e não esquece"

4. O QUE NÃO FAZER — uma restrição específica para este lead agora.
   Exemplos: "não enviar imóvel sem confirmar visita presencial",
   "não fazer follow-up genérico — já recebeu 3 sem resposta",
   "não mencionar preço antes de qualificar orçamento real"

5. PRÓXIMA JOGADA — uma ação só, com canal e critério de sucesso.
   Formato obrigatório: "[canal] · [ação específica com imóvel ou objetivo] · [o que confirma que funcionou]"
   - Se há imóveis compatíveis no portfólio acima: a ação DEVE referenciar um imóvel pelo nome
   - Se não há imóveis compatíveis: a ação deve qualificar melhor o perfil antes de enviar qualquer coisa
   - Nunca: "enviar opções", "perguntar preferências", "fazer follow-up"

6. RISCO — ajuste do risco de perda do lead (-10 a +10):
   +10: lead vai embora, disse não, silêncio longo + competing offer confirmado
   +5:  sem resposta por mais de 7 dias, objeção de preço sem contrapartida
   0:   interação neutra ou inconclusiva
   -5:  visita agendada, proposta aceita parcialmente
   -10: negócio fechado, visita realizada com boa receptividade

════════════════════════════════════════
REGRAS CRÍTICAS
════════════════════════════════════════
- Se o lead disser que não tem interesse ou for rude: signal="negative", deltas negativos, estado "resolved" ou "dormant"
- Se há imóvel compatível com score acima de 75%: urgency mínimo 60
- Se lead está em "deciding" mas não visitou nada: isso é sinal de travamento, não de avanço
- action_suggested: "needs_attention" se precisa resposta agora · "follow_up" se pode esperar · "none" se encerrado

════════════════════════════════════════
TRAVA ANTI-GENÉRICO — LEIA ANTES DE RESPONDER
════════════════════════════════════════
Antes de gerar o JSON, faça esta checagem interna obrigatória:

TESTE 1 — action_description passa nos 3 filtros?
  ✗ REPROVADO se contém qualquer uma destas frases:
    "entrar em contato", "fazer follow-up", "enviar opções", "perguntar preferências",
    "verificar interesse", "retomar contato", "acompanhar lead", "manter relacionamento",
    "enviar informações", "apresentar imóveis", "tirar dúvidas", "checar disponibilidade"
  ✗ REPROVADO se não contém um canal explícito (WhatsApp / Ligação / Visita)
  ✗ REPROVADO se não contém um critério de sucesso ("se X acontecer, funcionou")
  → Se reprovado em qualquer filtro: reescreva com dado concreto da conversa

TESTE 2 — central_conflict é específico?
  ✗ REPROVADO se for: "lead indeciso", "sem urgência", "precisa pensar",
    "aguardando momento certo", "comparando opções", "interesse baixo"
  → Esses são sintomas. O conflito real está uma camada abaixo.
  → Exemplo correto: "cônjuge nunca apareceu — decisão travada em terceiro invisível"
  → Exemplo correto: "budget real é 30% abaixo do imóvel que quer — nunca foi nomeado"

TESTE 3 — what_not_to_do é acionável?
  ✗ REPROVADO se for conselho genérico de vendas
  ✗ REPROVADO se puder se aplicar a qualquer lead
  → Deve ser derivado de algo que JÁ aconteceu nesta conversa específica
  → Exemplo correto: "não ligar — lead pediu para não ser incomodado, respondeu só por texto"
  → Exemplo correto: "não enviar Ventura — foi o segundo imóvel ignorado sem resposta"

Se qualquer teste reprovar, reescreva o campo antes de gerar o JSON final.
Resposta genérica = falha do sistema. Não existe "melhor do que nada" aqui.

Responda APENAS com JSON puro:
{
  "intention": "resumo da intenção real em uma frase — deve conter dado específico da conversa",
  "pain": "dor ou objeção identificada ou null",
  "central_conflict": "travamento real uma camada abaixo do sintoma, ou null se lead novo",
  "what_not_to_do": "restrição derivada de algo que já aconteceu nesta conversa",
  "signal": "positive|negative|neutral",
  "urgency": 0-100,
  "interest_delta": número de -20 a 20,
  "momentum_delta": número de -20 a 20,
  "risk_delta": número de -10 a 10,
  "current_cognitive_state": "latent|curious|exploring|evaluating|deciding|resolved|dormant",
  "memory_profile": [{"type": "identity|budget_range|location_preference|property_type|feature_preference", "content": "string"}] | null,
  "memory_context": [{"type": "current_search|location_focus|budget|priority", "content": "string"}] | null,
  "memory_events": [{"type": "property_sent|visited|discarded|price_objection|proposal_made|visit_scheduled", "content": "string"}] | null,
  "action_suggested": "needs_attention|follow_up|none",
  "action_description": "[canal] · [ação com dado concreto] · [critério de sucesso mensurável]",
  "summary": "resumo desta interação específica em até 2 frases",
  "rag_property_recommended": "título do imóvel recomendado ou null",
  "generic_check_passed": true
}`;

    const openai = getOpenAI();
    if (!openai) {
      console.warn("[ORBIT CORE] OpenAI client not initialized for analysis.");
      return null;
    }

    const start = Date.now();
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "Você é o ORBIT Core. Responda apenas em JSON." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });
    const elapsed = Date.now() - start;
    const usage = response.usage;

    if (usage) {
      await trackAICall({
        module: 'orbit_core',
        model: 'gpt-4o',
        lead_id: leadId,
        tokens_input: usage.prompt_tokens,
        tokens_output: usage.completion_tokens,
        duration_ms: elapsed,
        metadata: { action: 'analyze_context', event_type: type }
      });
    }

    const text = response.choices[0].message.content || "{}";
    return JSON.parse(text) as CoreAnalysis;
  } catch (err: any) {
    if (err.status === 429) {
      console.error("[ORBIT CORE] QUOTA EXCEDIDA (429) na OpenAI (Chat).");
    } else {
      console.error("[ORBIT CORE] Erro na análise OpenAI:", err);
    }
    return null;
  }
}

// ─── Helpers de Contexto ─────────────────────────────────────────────────────

async function getContext(leadId: string) {
  type MessageRow = Database['public']['Tables']['messages']['Row'];
  type MemoryItemRow = Database['public']['Tables']['memory_items']['Row'];
  type LeadCognitiveStateRow = Database['public']['Tables']['lead_cognitive_state']['Row'];
  type PropertyInteractionRow = Database['public']['Tables']['property_interactions']['Row'];

  const [messagesRes, memoryRes, stateRes, interactionsRes] = await Promise.all([
    getSupabase()?.from("messages").select("*").eq("lead_id", leadId).order("timestamp", { ascending: false }).limit(10),
    getSupabase()?.from("memory_items").select("*").eq("lead_id", leadId).limit(30),
    getSupabase()?.from("lead_cognitive_state").select("*").eq("lead_id", leadId).maybeSingle(),
    getSupabase()?.from("property_interactions").select("*").eq("lead_id", leadId).limit(10),
  ]);

  const messages = (messagesRes?.data || []) as MessageRow[];
  const memoryItems = (memoryRes?.data || []) as MemoryItemRow[];
  const cognitiveState = (stateRes?.data || null) as LeadCognitiveStateRow | null;
  const interactions = (interactionsRes?.data || []) as PropertyInteractionRow[];

  return {
    lastMessages: [...messages]
      .reverse()
      .map((m) => {
        let content = m.content || "";
        if (content.trim().startsWith("{")) {
          try {
            const parsed = JSON.parse(content);
            content = parsed.transcript || parsed.caption || parsed.text || content;
          } catch {}
        }
        return `[${m.source}] ${content}`;
      })
      .join("\n"),
    rawMessages: messages,
    memory: memoryItems.map((m) => `${m.type}: ${m.content}`).join(" | "),
    rawMemory: memoryItems,
    cognitiveState: cognitiveState 
      ? `Interest: ${cognitiveState.interest_score}, Momentum: ${cognitiveState.momentum_score}, State: ${cognitiveState.current_state}` 
      : "Vazio",
    propertyInteractions: interactions.map((i) => `${i.interaction_type} em ${i.timestamp}`).join(" | "),
    currentState: cognitiveState,
  };
}

// ─── FUNÇÃO PRINCIPAL ─────────────────────────────────────────────────────────

export async function processEventWithCore(
  leadId: string,
  content: string,
  type: EventType,
  messageId?: string
): Promise<void> {
  if (!content || content.trim() === "") return;

  console.log(`[ORBIT CORE] Iniciando análise de 5 camadas: leadId=${leadId}`);
  
  let cleanContent = content;
  if (content.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(content);
      cleanContent = parsed.transcript || parsed.caption || parsed.text || content;
    } catch {}
  }

  try {
    const context = await getContext(leadId);

    // Extrair budget da memória para filtro RAG
    const budgetMemory = context.rawMemory.find(
      (m) => m.type === "budget_range" || m.type === "budget"
    );
    const budgetMax = budgetMemory
      ? parseFloat(budgetMemory.content.replace(/\D/g, "")) || null
      : null;

    // Buscar imóveis compatíveis (RAG)
    const compatibleProps = await findCompatibleProperties(
      leadId,
      context.rawMemory,
      budgetMax
    );
    const compatiblePropertiesText = formatPropertiesForPrompt(compatibleProps);

    // Passar para analyzeContext
    const analysis = await analyzeContext(leadId, cleanContent, type, {
      ...context,
      compatibleProperties: compatiblePropertiesText,
    });
    if (!analysis) {
      console.error(`[ORBIT CORE] Falha ao obter análise para leadId=${leadId}`);
      return;
    }

    console.log(`[ORBIT CORE] Análise gerada para ${leadId}:`, {
      intention: analysis.intention,
      state: analysis.current_cognitive_state,
      deltas: `I:${analysis.interest_delta}, M:${analysis.momentum_delta}`
    });

    // 1. Atualizar Mensagem
    console.log(`[ORBIT CORE] Passo 1 - atualizando mensagem...`);
    if (messageId) {
      const currentEmbedding = await generateEmbedding(cleanContent);
      const r1 = await (getSupabase()?.from("messages") as any)
        .update({ ai_analysis: analysis as any, embedding: currentEmbedding })
        .eq("id", messageId);
      if (r1?.error) console.error(`[ORBIT CORE] Passo 1 ERRO:`, r1.error);
    }

    // 2. Atualizar Estado Cognitivo
    console.log(`[ORBIT CORE] Passo 2 - upsert cognitive state...`);
    const cur = context.currentState;
    
    const decayed = applyTemporalDecay(
      cur?.interest_score ?? 50,
      cur?.momentum_score ?? 50,
      cur?.last_human_action_at ?? null
    );

    const newInterest = Math.min(100, Math.max(0, decayed.interest + analysis.interest_delta));
    const newMomentum = Math.min(100, Math.max(0, decayed.momentum + analysis.momentum_delta));
    
    const newRisk = typeof analysis.risk_delta === 'number'
      ? Math.min(100, Math.max(0, (cur?.risk_score ?? 50) + analysis.risk_delta))
      : cur?.risk_score ?? 50;

    const nextState = analysis.current_cognitive_state;
    const r2 = await (getSupabase()?.from("lead_cognitive_state") as any).upsert({
      lead_id: leadId,
      interest_score: newInterest,
      momentum_score: newMomentum,
      current_state: nextState,
      last_ai_analysis_at: new Date().toISOString(),
      risk_score: newRisk,
      clarity_level: cur?.clarity_level ?? 50,
      central_conflict: analysis.central_conflict ?? null,
      what_not_to_do: analysis.what_not_to_do ?? null,
    });
    if (r2?.error) console.error(`[ORBIT CORE] Passo 2 ERRO:`, r2.error);

    // 3. Gravar Insight
    console.log(`[ORBIT CORE] Passo 3 - inserindo insight...`);
    const urgency1to5 = Math.min(5, Math.max(1, Math.round(analysis.urgency / 20)));
    const r3 = await (getSupabase()?.from("ai_insights") as any).insert({
      lead_id: leadId,
      type: "suggestion",
      content: `${analysis.intention} · Próxima ação: ${analysis.action_description}`,
      urgency: urgency1to5,
    });
    if (r3?.error) {
      console.error(`[ORBIT CORE] Passo 3 ERRO (ai_insights):`, JSON.stringify(r3.error));
    } else {
      console.log(`[ORBIT CORE] Passo 3 OK - insight salvo`);
    }

    // 4. Gravar Memórias
    console.log(`[ORBIT CORE] Passo 4 - gravando memórias...`, {
      profile: analysis.memory_profile?.length || 0,
      context: analysis.memory_context?.length || 0,
      events: analysis.memory_events?.length || 0,
    });
    const VALID_MEMORY_TYPES = ['intent','preference','budget','constraint','pain','event','objection','identity','budget_range','location_preference','property_type','feature_preference','current_search','location_focus','priority','property_sent','visited','discarded','price_objection','proposal_made','visit_scheduled'];
    const memoriesToSave = [
      ...(analysis.memory_profile || []).filter(m => VALID_MEMORY_TYPES.includes(m.type)),
      ...(analysis.memory_context || []).filter(m => VALID_MEMORY_TYPES.includes(m.type)),
      ...(analysis.memory_events || []).map(m => ({ ...m, type: "event" })),
    ];
    for (const mem of memoriesToSave) {
      console.log(`[ORBIT CORE] Inserindo memória tipo: ${mem.type}`);
      const rm = await (getSupabase()?.from("memory_items") as any).insert({
        lead_id: leadId,
        type: mem.type as any,
        content: mem.content,
        confidence: Math.round(analysis.urgency),
        source_message_id: messageId || null,
      });
      if (rm?.error) {
        console.error(`[ORBIT CORE] Memória ERRO (tipo: ${mem.type}):`, JSON.stringify(rm.error));
      } else {
        console.log(`[ORBIT CORE] Memória OK: tipo=${mem.type}`);
      }
    }

    // 5. Cálculo do Lead Vector
    console.log(`[ORBIT CORE] Passo 5 - calculando semantic vector...`);
    const contextString = (analysis.memory_context || []).map(m => m.content).join(" ");
    const profileString = (analysis.memory_profile || []).map(m => m.content).join(" ");
    const conversationString = context.lastMessages;
    const eventsString = (analysis.memory_events || []).map(m => m.content).join(" ");

    const [embContext, embProfile, embConv, embEvents] = await Promise.all([
      generateEmbedding(contextString),
      generateEmbedding(profileString),
      generateEmbedding(conversationString),
      generateEmbedding(eventsString)
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
        if (r5?.error) console.error(`[ORBIT CORE] Passo 5 ERRO:`, r5.error);
      }
    }

    // 6. Atualizar Lead
    console.log(`[ORBIT CORE] Passo 6 - atualizando lead...`);
    const r6 = await (getSupabase()?.from("leads") as any)
      .update({
        action_suggested: analysis.action_description,
        last_evaluated_at: new Date().toISOString(),
        orbit_stage: nextState,
      })
      .eq("id", leadId);
    if (r6?.error) console.error(`[ORBIT CORE] Passo 6 ERRO:`, r6.error);

    console.log(`[ORBIT CORE] Análise concluída: ${nextState} (Interest: ${newInterest}, Momentum: ${newMomentum})`);
  } catch (err) {
    console.error("[ORBIT CORE] Erro crítico no pipeline semântico:", err);
  }
}