import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { Database } from "./database.types";

let _openaiCache: OpenAI | null = null;
function getOpenAI() {
  if (_openaiCache) return _openaiCache;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === "dummy-key") return null;
  _openaiCache = new OpenAI({ apiKey });
  return _openaiCache;
}

// Lazy Supabase init to prevent top-level crash if env vars are missing
let _supabaseCache: any = null;
function getSupabase() {
  if (_supabaseCache) return _supabaseCache;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Prioriza SERVICE_ROLE_KEY para operações de backend (bypass RLS)
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!url || !key) {
    console.warn("[ORBIT CORE] Supabase credentials missing during access.");
    return null;
  }
  _supabaseCache = createClient<Database>(url, key);
  return _supabaseCache;
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
  signal: "positive" | "negative" | "neutral";
  urgency: number; // 0-100
  interest_delta: number; // -20 a 20
  momentum_delta: number; // -20 a 20
  // Memória Tripartite
  memory_profile: { type: string, content: string }[] | null;
  memory_context: { type: string, content: string }[] | null;
  memory_events: { type: string, content: string }[] | null;
  current_cognitive_state: 'latent' | 'curious' | 'exploring' | 'evaluating' | 'deciding' | 'resolved' | 'dormant';
  action_suggested: string;
}

// ─── Geração de Embedding ─────────────────────────────────────────────────────

export async function generateEmbedding(text: string): Promise<number[] | null> {
  if (!process.env.OPENAI_API_KEY) {
    console.warn("[ORBIT CORE] OPENAI_API_KEY missing for embedding.");
    return null;
  }
  if (!text || text.trim() === "") return null;
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
  }
): Promise<CoreAnalysis | null> {
  if (!process.env.OPENAI_API_KEY) {
    console.warn("[ORBIT CORE] OPENAI_API_KEY missing for analysis.");
    return null;
  }

  try {
    const prompt = `Você é o ORBIT Core, o cérebro cognitivo de um ecossistema imobiliário de luxo.
Sua missão é interpretar a relação com o lead através de 5 camadas: messages, memory_profile, memory_context, memory_events e cognitive_state.

DADOS ATUAIS DO LEAD:
- Estado Cognitivo Atual: ${context.cognitiveState}
- Memórias Existentes: ${context.memory || "Vazia"}
- Interações com Imóveis: ${context.propertyInteractions || "Nenhuma"}

CONTEXTO DA CONVERSA (últimas mensagens):
${context.lastMessages}

NOVO EVENTO A ANALISAR:
- Tipo: ${type}
- Conteúdo: "${content}"

Sua tarefa:
1. Extraia o estado cognitivo baseado na maturidade da decisão:
   - latent: apenas contato inicial ou inativo.
   - curious: faz perguntas genéricas.
   - exploring: busca ativa, mas sem foco definido.
   - evaluating: comparando opções, analisando detalhes.
   - deciding: forte intenção de compra, pede visitas ou proposta.
   - resolved: negócio fechado ou perdido.
   - dormant: sem resposta por longo período.

2. Identifique fatos para as 3 categorias de memória:
   - Profile: Informações duráveis (identity, budget_range, location_preference, property_type, feature_preference).
   - Context: Intencao atual (current_search, location_focus, budget, priority).
   - Events: Ações concretas (property_sent, visited, discarded, price_objection, proposal_made, visit_scheduled).

3. Calcule o delta de interesse (interesse no tema) e momentum (velocidade para a decisão).

Responda APENAS com um JSON puro contendo estas chaves:
{
  "intention": "resumo da intenção real",
  "pain": "dor ou objeção identificada ou null",
  "signal": "positive|negative|neutral",
  "urgency": 0-100,
  "interest_delta": número de -20 a 20 (use valores negativos para desinteresse/negativas),
  "momentum_delta": número de -20 a 20 (use valores negativos se o lead esfriar),
  "current_cognitive_state": "latent|curious|exploring|evaluating|deciding|resolved|dormant",
  "memory_profile": [{"type": "identity|budget_range|location_preference|property_type|feature_preference", "content": "string"}] | null,
  "memory_context": [{"type": "current_search|location_focus|budget|priority", "content": "string"}] | null,
  "memory_events": [{"type": "property_sent|visited|discarded|price_objection|proposal_made|visit_scheduled", "content": "string"}] | null,
  "action_suggested": "needs_attention|follow_up|none",
  "action_description": "descrição curta da ação sugerida"
}

IMPORTANTE: 
- Use "needs_attention" sempre que o lead fizer uma pergunta, demonstrar interesse imediato ou o usuário precisar responder.
- Use "follow_up" para contatos que não exigem resposta imediata mas devem ser acompanhados.
- Use "none" para interações encerradas ou sem necessidade de ação.

IMPORTANTE: Se o lead disser que não tem interesse ou for rude, use signal="negative", baixe o interesse e momentum (deltas negativos) e mude o estado para "resolved" ou "dormant".`;

    const openai = getOpenAI();
    if (!openai) {
      console.warn("[ORBIT CORE] OpenAI client not initialized for analysis.");
      return null;
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Você é o ORBIT Core. Responda apenas em JSON." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

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

  const messages = (messagesRes.data || []) as MessageRow[];
  const memoryItems = (memoryRes.data || []) as MemoryItemRow[];
  const cognitiveState = (stateRes.data || null) as LeadCognitiveStateRow | null;
  const interactions = (interactionsRes.data || []) as PropertyInteractionRow[];

  return {
    lastMessages: [...messages]
      .reverse()
      .map((m) => `[${m.source}] ${m.content}`)
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

  try {
    const context = await getContext(leadId);


    const analysis = await analyzeContext(leadId, content, type, context);
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
      const currentEmbedding = await generateEmbedding(content);
      const r1 = await (getSupabase()?.from("messages") as any)
        .update({ ai_analysis: analysis as any, embedding: currentEmbedding })
        .eq("id", messageId);
      if (r1?.error) console.error(`[ORBIT CORE] Passo 1 ERRO:`, r1.error);
    }

    // 2. Atualizar Estado Cognitivo
    console.log(`[ORBIT CORE] Passo 2 - upsert cognitive state...`);
    const cur = context.currentState;
    const newInterest = Math.min(100, Math.max(0, (cur?.interest_score || 50) + analysis.interest_delta));
    const newMomentum = Math.min(100, Math.max(0, (cur?.momentum_score || 50) + analysis.momentum_delta));
    const nextState = analysis.current_cognitive_state;
    const r2 = await (getSupabase()?.from("lead_cognitive_state") as any).upsert({
      lead_id: leadId,
      interest_score: newInterest,
      momentum_score: newMomentum,
      current_state: nextState,
      last_ai_analysis_at: new Date().toISOString(),
      risk_score: cur?.risk_score || 50,
      clarity_level: cur?.clarity_level || 50,
    });
    if (r2?.error) console.error(`[ORBIT CORE] Passo 2 ERRO:`, r2.error);

    // 3. Gravar Insight
    console.log(`[ORBIT CORE] Passo 3 - inserindo insight...`);
    const r3 = await (getSupabase()?.from("ai_insights") as any).insert({
      lead_id: leadId,
      type: "suggestion",
      content: `${analysis.intention} · Próxima ação: ${analysis.action_suggested}`,
      urgency: analysis.urgency,
    });
    if (r3?.error) console.error(`[ORBIT CORE] Passo 3 ERRO:`, r3.error);

    // 4. Gravar Memórias
    console.log(`[ORBIT CORE] Passo 4 - gravando memórias...`, {
      profile: analysis.memory_profile?.length || 0,
      context: analysis.memory_context?.length || 0,
      events: analysis.memory_events?.length || 0,
    });
    const memoriesToSave = [
      ...(analysis.memory_profile || []).map(m => ({ ...m, type: "ai" })),
      ...(analysis.memory_context || []).map(m => ({ ...m, type: "ai" })),
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
      if (rm?.error) console.error(`[ORBIT CORE] Memória ERRO (tipo: ${mem.type}):`, rm.error);
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
        action_suggested: analysis.action_suggested,
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