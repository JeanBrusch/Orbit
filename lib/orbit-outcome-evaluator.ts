/**
 * orbit-outcome-evaluator.ts
 *
 * Responsável por:
 * 1. Avaliar automaticamente o desfecho de ações pendentes (pending → ignored após 48h)
 * 2. Atualizar a fase do lead em função do desfecho (ACTIVE / DIAGNOSING)
 *
 * Deve ser invocado por um cron job — ex: a cada hora via API route ou Supabase Cron.
 */

import { getSupabaseServer } from "./supabase-server";

const IGNORED_TIMEOUT_MS = 48 * 60 * 60 * 1000; // 48 horas

function getSupabase() {
  try {
    return getSupabaseServer();
  } catch {
    return null;
  }
}

/**
 * Avalia todas as lead_actions com outcome=pending e sent_at há mais de 48h.
 * Transição: pending → ignored.
 * Efeito colateral: atualiza lead_phase do lead para DIAGNOSING.
 */
export async function evaluateActionOutcomes(): Promise<{ evaluated: number; errors: number }> {
  const supabase = getSupabase();
  if (!supabase) return { evaluated: 0, errors: 0 };

  const cutoff = new Date(Date.now() - IGNORED_TIMEOUT_MS).toISOString();

  // Busca ações pendentes com sent_at há mais de 48h
  const { data: timedOut, error } = await (supabase as any)
    .from("lead_actions")
    .select("id, lead_id, content, sent_at, outcome")
    .eq("outcome", "pending")
    .not("sent_at", "is", null)
    .lt("sent_at", cutoff);

  if (error) {
    console.error("[ORBIT EVALUATOR] Erro ao buscar ações pendentes:", error);
    return { evaluated: 0, errors: 1 };
  }

  if (!timedOut || timedOut.length === 0) {
    console.log("[ORBIT EVALUATOR] Nenhuma ação pendente expirada.");
    return { evaluated: 0, errors: 0 };
  }

  console.log(`[ORBIT EVALUATOR] ${timedOut.length} ação(ões) expirada(s). Atualizando...`);

  let evaluated = 0;
  let errors = 0;

  for (const action of timedOut) {
    try {
      // Marcar ação como ignorada
      const { error: updateErr } = await (supabase as any)
        .from("lead_actions")
        .update({ outcome: "ignored" })
        .eq("id", action.id);

      if (updateErr) {
        console.error(`[ORBIT EVALUATOR] Erro ao atualizar ação ${action.id}:`, updateErr);
        errors++;
        continue;
      }

      // Atualizar fase do lead para DIAGNOSING
      await updateLeadPhaseByOutcome(action.lead_id, "ignored");

      evaluated++;
    } catch (err) {
      console.error(`[ORBIT EVALUATOR] Erro no processamento da ação ${action.id}:`, err);
      errors++;
    }
  }

  console.log(`[ORBIT EVALUATOR] ✅ ${evaluated} avaliadas | ❌ ${errors} erros`);
  return { evaluated, errors };
}

/**
 * Atualiza a fase comportamental do lead com base no desfecho da ação.
 * replied  → ACTIVE  (lead engajou — contato produtivo)
 * ignored  → DIAGNOSING (silêncio — diagnosticar bloqueio)
 */
export async function updateLeadPhaseByOutcome(
  leadId: string,
  outcome: "replied" | "ignored"
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  const newPhase = outcome === "replied" ? "ACTIVE" : "DIAGNOSING";

  const { error } = await (supabase as any)
    .from("leads")
    .update({
      lead_phase: newPhase,
      // Se voltou para ACTIVE, limpa a pausa
      ...(outcome === "replied"
        ? { next_allowed_action_at: null, reentry_trigger_type: null, reentry_trigger_value: null }
        : {}),
    })
    .eq("id", leadId);

  if (error) {
    console.error(`[ORBIT EVALUATOR] Erro ao atualizar lead_phase (${leadId}):`, error);
    return;
  }

  console.log(`[ORBIT EVALUATOR] Lead ${leadId} → ${newPhase} (outcome: ${outcome})`);
}

/**
 * Marca uma lead_action específica como "replied" quando o lead responder.
 * Deve ser chamado no pipeline de mensagem inbound, após identificar que há ação pendente.
 */
export async function markActionAsReplied(leadId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  // Busca a ação pendente mais recente deste lead
  const { data: pendingAction } = await (supabase as any)
    .from("lead_actions")
    .select("id")
    .eq("lead_id", leadId)
    .eq("outcome", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!pendingAction) return;

  await (supabase as any)
    .from("lead_actions")
    .update({ outcome: "replied" })
    .eq("id", pendingAction.id);

  await updateLeadPhaseByOutcome(leadId, "replied");
}

/**
 * Entrypoint principal para chamada via cron ou API route.
 */
export async function runOutcomeEvaluation(): Promise<{ evaluated: number; errors: number }> {
  console.log("[ORBIT EVALUATOR] 🔄 Iniciando avaliação de desfechos...");
  const result = await evaluateActionOutcomes();
  console.log("[ORBIT EVALUATOR] 🏁 Avaliação concluída:", result);
  return result;
}
