import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import { Database } from "./database.types";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "dummy-key",
});

// Lazy Supabase init to prevent top-level crash if env vars are missing
let _supabaseCache: any = null;
function getSupabase() {
  if (_supabaseCache) return _supabaseCache;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.warn("[ORBIT CORE] Supabase credentials missing during access. Using mock.");
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
  if (!process.env.GEMINI_API_KEY || !text || text.trim() === "") return null;
  try {
    const response = await ai.models.embedContent({
      model: "text-embedding-004",
      contents: [text],
    });
    
    // O SDK 1.44.0 retorna um objeto com 'embeddings' (plural) no caso de múltiplos inputs, 
    // ou conforme a estrutura retornada pelo backend.
    // Baseado no d.ts: embedContent returns types.EmbedContentResponse which contains embeddings?: Array<Embedding>
    const embeddings = (response as any).embeddings;
    if (embeddings && embeddings.length > 0) {
      return embeddings[0].values || null;
    }
    return null;
  } catch (err) {
    console.error("[ORBIT CORE] Erro ao gerar embedding:", err);
    return null;
  }
}

// ─── Análise com Gemini ───────────────────────────────────────────────────────

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
  if (!process.env.GEMINI_API_KEY) return null;

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

Responda APENAS com um JSON (sem blocos de código markdown):
{
  "intention": "resumo da intenção real",
  "pain": "dor ou objeção identificada ou null",
  "signal": "positive|negative|neutral",
  "urgency": 0-100,
  "interest_delta": número de -20 a 20,
  "momentum_delta": número de -20 a 20,
  "memory_profile": [{"type": "string", "content": "string"}] | null,
  "memory_context": [{"type": "string", "content": "string"}] | null,
  "memory_events": [{"type": "string", "content": "string"}] | null,
  "current_cognitive_state": "latent|curious|exploring|evaluating|deciding|resolved|dormant",
  "action_suggested": "próxima ação sugerida"
}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: {
        temperature: 0.2,
      },
    });

    const text = response.text || "";
    // Limpa possível markdown do JSON
    const cleanJson = text.replace(/```json|```/g, "").trim();
    return JSON.parse(cleanJson) as CoreAnalysis;
  } catch (err) {
    console.error("[ORBIT CORE] Erro na análise Gemini:", err);
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
  // Ignora conteúdos vazios
  if (!content || content.trim() === "") return;

  console.log(`[ORBIT CORE] Iniciando análise de 5 camadas: leadId=${leadId}`);

  try {
    const context = await getContext(leadId);
    
    // Geração de embedding para a mensagem atual
    const currentEmbedding = await generateEmbedding(content);

    const analysis = await analyzeContext(leadId, content, type, context);
    if (!analysis) return;

    // 1. Atualizar Mensagem
    if (messageId) {
      await (getSupabase()?.from("messages") as any)
        .update({ 
          ai_analysis: analysis as any,
          embedding: currentEmbedding 
        })
        .eq("id", messageId);
    }

    // 2. Atualizar Estado Cognitivo (Interest & Momentum)
    const cur = context.currentState;
    const newInterest = Math.min(100, Math.max(0, (cur?.interest_score || 50) + analysis.interest_delta));
    const newMomentum = Math.min(100, Math.max(0, (cur?.momentum_score || 50) + analysis.momentum_delta));
    const nextState = analysis.current_cognitive_state;

    await (getSupabase()?.from("lead_cognitive_state") as any).upsert({
      lead_id: leadId,
      interest_score: newInterest,
      momentum_score: newMomentum,
      current_state: nextState,
      last_ai_analysis_at: new Date().toISOString(),
      risk_score: cur?.risk_score || 50,
      clarity_level: cur?.clarity_level || 50,
    });

    // 3. Gravar Insight
    await (getSupabase()?.from("ai_insights") as any).insert({
      lead_id: leadId,
      type: "cognitive_update",
      content: `${analysis.intention} · Próxima ação: ${analysis.action_suggested}`,
      urgency: analysis.urgency,
    });

    // 4. Gravar Memórias Tripartites
    const memoriesToSave = [
      ...(analysis.memory_profile || []),
      ...(analysis.memory_context || []),
      ...(analysis.memory_events || [])
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

    // 5. Cálculo do Lead Vector (Semantic Vector)
    // lead_vector = 0.4 context + 0.3 profile + 0.2 conversation + 0.1 events
    
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
      // Simplificação do cálculo vetorial (média ponderada se disponíveis)
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

        await (getSupabase()?.from("leads") as any)
          .update({ semantic_vector: compositeVector })
          .eq("id", leadId);
      }
    }

    // 6. Atualizar Sugestão Final no Lead
    await (getSupabase()?.from("leads") as any)
      .update({
        action_suggested: analysis.action_suggested,
        last_evaluated_at: new Date().toISOString(),
        orbit_stage: nextState,
      })
      .eq("id", leadId);

    console.log(`[ORBIT CORE] Análise concluída: ${nextState} (Interest: ${newInterest}, Momentum: ${newMomentum})`);
  } catch (err) {
    console.error("[ORBIT CORE] Erro crítico no pipeline semântico:", err);
  }
}
