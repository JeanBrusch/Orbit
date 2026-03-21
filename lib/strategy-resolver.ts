// lib/strategy-resolver.ts

export type Objective =
  | "validate_timing"
  | "reduce_pressure"
  | "reset_direction"
  | "test_intent"
  | "rebuild_trust"
  | "reopen_channel"
  | "anchor_value"
  | "surface_asset";

export type Constraint =
  | "no_property" | "no_price" | "no_push" | "no_urgency"
  | "no_agenda" | "no_cta" | "no_list" | "no_options"
  | "no_price_mention" | "no_discount" | "no_competitor_mention"
  | "max_two_sentences" | "max_one_question";

export type ForcePattern =
  | "timeline_reference"   // citar algo específico do histórico temporal
  | "low_pressure_question" // pergunta que custa zero responder
  | "single_choice"        // uma coisa só, não lista
  | "decision_relief"      // tirar peso da decisão
  | "human_reconnect"      // sem agenda comercial visível
  | "value_reframe"        // reposicionar valor sem citar preço
  | "curiosity_open";       // abrir com algo que gera curiosidade real

export type HookRequirement = "lead_phrase" | "timeline_reference" | "new_asset" | "market_event";

export interface ResolvedStrategy {
  objective: Objective;
  force_patterns: ForcePattern[];
  hard_constraints: Constraint[];
  hook_requirement: HookRequirement;
}

const STRATEGY_MAP: Record<string, Omit<ResolvedStrategy, "objective"> & { objective: Objective }> = {
  TIMING: {
    objective: "validate_timing",
    hard_constraints: ["no_property", "no_push", "no_urgency", "no_cta"],
    force_patterns: ["timeline_reference", "low_pressure_question"],
    hook_requirement: "timeline_reference",
  },
  OVERWHELM: {
    objective: "reduce_pressure",
    hard_constraints: ["no_property", "no_list", "no_options", "max_one_question"],
    force_patterns: ["single_choice", "decision_relief"],
    hook_requirement: "lead_phrase",
  },
  MISALIGNMENT: {
    objective: "reset_direction",
    hard_constraints: ["no_property", "no_price", "no_push"],
    force_patterns: ["human_reconnect", "low_pressure_question"],
    hook_requirement: "lead_phrase",
  },
  LOW_INTENT: {
    objective: "test_intent",
    hard_constraints: ["no_property", "no_cta", "max_two_sentences"],
    force_patterns: ["low_pressure_question", "curiosity_open"],
    hook_requirement: "lead_phrase",
  },
  TRUST_GAP: {
    objective: "rebuild_trust",
    hard_constraints: ["no_property", "no_price", "no_agenda", "no_cta"],
    force_patterns: ["human_reconnect"],
    hook_requirement: "lead_phrase",
  },
  PRICE_FRICTION: {
    objective: "anchor_value",
    hard_constraints: ["no_price_mention", "no_discount"],
    force_patterns: ["value_reframe", "timeline_reference"],
    hook_requirement: "timeline_reference",
  },
  COMPETING_OFFER: {
    objective: "anchor_value",
    hard_constraints: ["no_competitor_mention", "no_urgency", "no_price"],
    force_patterns: ["value_reframe", "human_reconnect"],
    hook_requirement: "lead_phrase",
  },
};

export function resolveStrategy(
  silence_reason: string,
  days_silent: number,
  momentum_score: number
): ResolvedStrategy {
  const base = STRATEGY_MAP[silence_reason];

  if (!base) {
    // Fallback por tempo
    if (days_silent > 30) {
      return {
        objective: "reopen_channel",
        hard_constraints: ["no_push", "no_urgency", "max_two_sentences"],
        force_patterns: ["human_reconnect", "low_pressure_question"],
        hook_requirement: "lead_phrase",
      };
    }
    return {
      objective: "test_intent",
      hard_constraints: ["no_push", "no_urgency"],
      force_patterns: ["curiosity_open"],
      hook_requirement: "lead_phrase",
    };
  }

  // Ajuste por momentum muito baixo — lead frio demais para push
  if (momentum_score < 20 && !base.hard_constraints.includes("no_push")) {
    const updatedConstraints = Array.from(new Set([...base.hard_constraints, "no_push", "no_urgency"])) as Constraint[];
    return {
      ...base,
      hard_constraints: updatedConstraints,
    };
  }

  return {
      objective: base.objective,
      force_patterns: base.force_patterns,
      hard_constraints: base.hard_constraints,
      hook_requirement: base.hook_requirement
  };
}
