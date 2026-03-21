// lib/hook-validator.ts

export interface HookValidation {
  isValid: boolean;
  score: number;
  rejection_reason?: string;
}

/**
 * Padrões que parecem específicos mas são frequentemente usados em contextos genéricos.
 * Se muitos destes aparecerem sem sinais fortes, o hook é considerado fraco.
 */
const WEAK_PATTERNS = [
  "interesse", "imóveis", "opções", "busca", "procura",
  "propriedade", "algum", "alguns", "ver", "mostrar",
  "entrar em contato", "retomar", "acompanhar", "verificar",
];

/**
 * Sinais fortes de ancoragem real no histórico do lead.
 */
const STRONG_SIGNALS = [
  /\d{1,2}\/\d{1,2}/,                        // data específica (ex: 15/03)
  /r\$\s*[\d.,]+/i,                          // valor concreto (ex: R$ 800.000)
  /\d+\s*(quartos?|dorms?|suítes?)/i,         // características concretas (ex: 3 quartos)
  /"[^"]{8,}"/,                              // citação direta do lead (mínimo 8 caracteres entre aspas)
  /\b(disse|falou|perguntou|mencionou)\b/i,   // referência explícita a uma fala real
];

/**
 * Valida a qualidade de um gancho (hook) gerado pela IA.
 * Um hook de qualidade deve ser intransferível e baseado em fatos reais.
 */
export function validateHookQuality(
  hook_source: string,
  hook_type: string
): HookValidation {
  if (!hook_source || hook_source.length < 15) {
    return { isValid: false, score: 0, rejection_reason: "hook_too_short" };
  }

  const lower = hook_source.toLowerCase();

  // Conta quantos padrões fracos e fortes existem
  const weakCount = WEAK_PATTERNS.filter(p => lower.includes(p)).length;
  const strongCount = STRONG_SIGNALS.filter(r => r.test(hook_source)).length;

  // Lead phrase hook precisa de uma citação ou referência forte
  if (hook_type === "lead_phrase" && strongCount === 0 && weakCount > 0) {
    return {
      isValid: false,
      score: 0.2,
      rejection_reason: "lead_phrase_hook_without_citation",
    };
  }

  // Cálculo de score (0 a 1)
  // Base 0.5 + bônus por sinais fortes - penalidade por excesso de padrões fracos
  const score = Math.max(0, Math.min(1,
    0.5
    + (strongCount * 0.25)
    - (weakCount * 0.15)
  ));

  return {
    isValid: score >= 0.6,
    score,
    rejection_reason: score < 0.6 ? "hook_quality_below_threshold" : undefined,
  };
}
