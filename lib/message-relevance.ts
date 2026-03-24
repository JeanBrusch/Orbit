// lib/message-relevance.ts

export interface MessageContext {
  leadState?: string;
  daysSinceInteraction?: number;
  recentHashes?: string[];
  isFromLead?: boolean; // false = mensagem do operador
}

export interface RelevanceResult {
  relevant: boolean;
  reason?: string;
  priority?: "high" | "normal" | "low";
  suggestedCadence?: "realtime" | "batch_hourly" | "batch_2x_daily";
}

// Padrões de ruído definidos na documentação
const SIMPLE_CONFIRMATIONS = [
  /^(ok|okay|oka|k|kk|kkk|tudo|tá|ta|blz|beleza|certo|entendido|entendi|perfeito|ótimo|otimo|boa|excelente|show|legal|bacana|top|massa)\.?[!?]*$/i,
  /^(não|nao|nope|neg|negativo|impossível|impossivel)\.?[!?]*$/i,
  /^(sim|s|yes|não|nao|no|n)\.?[!?]*$/i,
  /^(recebi|recebido|vi|visto|ok recebi|ok entendido)\.?[!?]*$/i,
];

const GREETINGS_WITHOUT_CONTENT = [
  /^(oi|ola|olá|hey|ei|eai|e aí|e ai|ae|opa)\.?[!?]*$/i,
  /^(bom dia|boa tarde|boa noite)\.?[!?]*$/i,
  /^(oi boa tarde|ola bom dia|oi boa noite)\.?[!?]*$/i,
  /^(tudo bem|tudo bom|como vai|como estás|como esta)[\?!\.]*$/i,
  /^(até mais|até logo|tchau|falou|valeu|flw|vlw)[\?!\.]*$/i,
];

const EMOJI_ONLY_PATTERN = /^[\p{Emoji_Presentation}\p{Extended_Pictographic}\s]+$/u;

const FORCE_ANALYSIS_TERMS = [
  "visita", "visitei", "visitar", "ver pessoalmente",
  "proposta", "propor", "fechar", "comprar", "alugar",
  "aceito", "topei", "topo", "quero",
  "valor", "preço", "quanto", "desconto", "condição", "entrada", "parcela",
  "gostei", "adorei", "perfeito", "ideal", "esse mesmo",
  "não tenho", "muito caro", "não gostei", "não quero", "mudei de ideia",
  "desisti", "caro demais", "achei outro",
];

export function assessMessageRelevance(
  content: string,
  context?: MessageContext
): RelevanceResult {
  const text = content?.trim() || "";
  
  // === FASE 1: Filtros absolutos (sempre ignorar análise isolada) ===
  
  if (text.length < 2) 
    return { relevant: false, reason: "empty_or_single_char" };
  
  if (EMOJI_ONLY_PATTERN.test(text)) 
    return { relevant: false, reason: "emoji_only" };
  
  if ([...SIMPLE_CONFIRMATIONS, ...GREETINGS_WITHOUT_CONTENT].some(p => p.test(text))) {
    return { relevant: false, reason: "noise_pattern" };
  }
  
  // === FASE 2: Força análise imediata (sinais de compra) ===
  
  const hasForceSignal = FORCE_ANALYSIS_TERMS.some(
    t => text.toLowerCase().includes(t)
  );
  
  if (hasForceSignal) {
    return { relevant: true, priority: "high", suggestedCadence: "realtime" };
  }
  
  // === FASE 3: Análise contextual ===
  
  // Lead em estado crítico (perto de fechar) → analisar tudo em tempo real
  if (["deciding", "evaluating"].includes(context?.leadState || "")) {
    return { relevant: true, priority: "high", suggestedCadence: "realtime" };
  }
  
  // Mensagem duplicada recente
  const contentHash = simpleHash(text.toLowerCase());
  if (context?.recentHashes?.includes(contentHash)) {
    return { relevant: false, reason: "duplicate_recent" };
  }
  
  // Mensagem curta sem sinal forte → Batch Hourly
  if (text.length < 30) {
    return { 
      relevant: true, 
      priority: "low", 
      suggestedCadence: "batch_hourly",
      reason: "short_no_signal" 
    };
  }
  
  return { relevant: true, priority: "normal", suggestedCadence: "batch_hourly" };
}

export function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash = hash & hash;
  }
  return hash.toString(36);
}
