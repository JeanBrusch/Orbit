// lib/interaction-governance.ts
import { getSupabaseServer } from "./supabase-server";

export interface InteractionContext {
  leadId: string;
  itype: string;
  propertyId: string;
}

export interface GovernanceResult {
  shouldProcess: boolean;
  reason?: string;
}

/**
 * Decide se uma interação do portal deve disparar o Orbit Core (IA).
 * Objetivo: Reduzir consumo de tokens em eventos redundantes ou de baixo sinal.
 */
export async function assessInteractionGovernance(
  ctx: InteractionContext
): Promise<GovernanceResult> {
  const { leadId, itype, propertyId } = ctx;
  const supabase = getSupabaseServer();

  // 1. Eventos Críticos: SEMPRE processar (Alta Intenção)
  const CRITICAL_EVENTS = ['property_question', 'visited', 'favorited'];
  if (CRITICAL_EVENTS.includes(itype)) {
    return { shouldProcess: true, reason: 'critical_event' };
  }

  // 2. Eventos de Baixo Sinal: NUNCA processar (IA ignorada)
  const LOW_SIGNAL_EVENTS = ['viewed', 'scroll_depth', 'photo_view', 'video_play'];
  if (LOW_SIGNAL_EVENTS.includes(itype)) {
    return { shouldProcess: false, reason: 'low_signal' };
  }

  // 3. portal_opened e discarded: Aplicar Throttle (Filtro Temporal)
  // Se houve um evento similar nas últimas 12 horas, não processar novamente pela IA.
  if (itype === 'portal_opened' || itype === 'discarded') {
    const { data: recent } = await (supabase
      .from('property_interactions') as any)
      .select('timestamp')
      .eq('lead_id', leadId)
      .eq('interaction_type', itype)
      .order('timestamp', { ascending: false })
      .limit(2); // Pega o atual (que acabou de ser inserido) e o anterior

    if (recent && recent.length > 1) {
      const lastTime = new Date(recent[1].timestamp).getTime();
      const now = Date.now();
      const hoursSinceLast = (now - lastTime) / (1000 * 60 * 60);

      if (hoursSinceLast < 12) {
        return { 
          shouldProcess: false, 
          reason: `throttle_${itype}_${Math.round(hoursSinceLast)}h` 
        };
      }
    }
    
    return { shouldProcess: true, reason: 'fresh_interaction' };
  }

  return { shouldProcess: false, reason: 'unhandled_type' };
}
