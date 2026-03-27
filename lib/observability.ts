import { getSupabaseServer } from "./supabase-server";

export type OrbitModule = 
  | 'buffer' 
  | 'classifier' 
  | 'silence_analyzer' 
  | 'orbit_core' 
  | 'vistanet_ingest' 
  | 'property_analysis'
  | 'reengagement'
  | 'system';

export type OrbitEventType = 
  | 'message_received' 
  | 'buffer_flush' 
  | 'ai_call' 
  | 'classification' 
  | 'silence_analysis'
  | 'property_import'
  | 'gate_blocked';


export interface OrbitEventPayload {
  lead_id?: string;
  event_type: OrbitEventType;
  source: 'whatsapp' | 'portal' | 'system';
  module: OrbitModule;
  step?: string;          // ex: inbound, buffer, classifier, decision, persistence
  action?: string;        // ex: message_received, ai_call, saved_to_db
  origin?: string;        // etapa anterior
  destination?: string;   // próxima etapa pretendida
  input_size?: number;
  output_size?: number;
  tokens_input?: number;
  tokens_output?: number;
  cost_usd?: number;
  duration_ms?: number;
  metadata_json?: Record<string, any>;
  has_ai?: boolean;       // envolveu IA?
  saved_data?: boolean;   // houve persistência?
}

const PRICES = {
  'gpt-4o': { in: 2.50 / 1_000_000, out: 10.00 / 1_000_000 },
  'gpt-4o-mini': { in: 0.15 / 1_000_000, out: 0.60 / 1_000_000 },
  'text-embedding-3-small': { in: 0.02 / 1_000_000, out: 0 },
};

/**
 * Calcula o custo estimado de uma chamada de IA
 */
export function calculateAICost(model: string, tokensInput: number, tokensOutput: number = 0): number {
  const modelKey = model.includes('gpt-4o-mini') ? 'gpt-4o-mini' : 
                   model.includes('gpt-4o') ? 'gpt-4o' : 
                   model.includes('embedding') ? 'text-embedding-3-small' : 'gpt-4o-mini';
  
  if (!modelKey) return 0;
  
  const p = PRICES[modelKey as keyof typeof PRICES];
  return (tokensInput * p.in) + (tokensOutput * p.out);
}

/**
 * Registra um evento de observabilidade no banco de dados
 */
export async function trackEvent(payload: OrbitEventPayload) {
  try {
    const supabase = getSupabaseServer();
    const { error } = await (supabase.from('orbit_events') as any).insert([{
      ...payload,
      timestamp: new Date().toISOString()
    }]);

    if (error) {
      console.error("[OBSERVABILITY] Error tracking event:", error);
    }
  } catch (err) {
    console.error("[OBSERVABILITY] Fatal error in trackEvent:", err);
  }
}

/**
 * Helper para rastrear chamadas de OpenAI com cálculo automático de custo
 */
export async function trackAICall(params: {
  module: OrbitModule;
  model: string;
  lead_id?: string;
  tokens_input: number;
  tokens_output: number;
  duration_ms: number;
  metadata?: Record<string, any>;
}) {
  const cost = calculateAICost(params.model, params.tokens_input, params.tokens_output);
  
  await trackEvent({
    lead_id: params.lead_id,
    event_type: 'ai_call',
    source: 'system',
    module: params.module,
    step: params.metadata?.step || 'ai_processing',
    action: 'ai_completion',
    has_ai: true,
    tokens_input: params.tokens_input,
    tokens_output: params.tokens_output,
    cost_usd: cost,
    duration_ms: params.duration_ms,
    metadata_json: {
      model: params.model,
      ...params.metadata
    }
  });
}
