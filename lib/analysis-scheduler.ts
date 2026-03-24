// lib/analysis-scheduler.ts

export type AnalysisCadence = "realtime" | "batch_hourly" | "batch_2x_daily" | "none";

export function resolveAnalysisCadence(
  leadState: string,
  daysSinceLastInteraction: number,
  messageSignal?: string
): AnalysisCadence {
  // Sinais fortes de compra ou negociação → sempre real-time
  const BUY_SIGNALS = ["visita", "proposta", "quanto", "valor", "aceito", "vamos fechar", "fechar", "preço", "comprar"];
  if (messageSignal && BUY_SIGNALS.some(s => messageSignal.toLowerCase().includes(s))) {
    return "realtime";
  }
  
  // Estados de alta intenção → real-time
  if (["deciding", "evaluating"].includes(leadState)) return "realtime";
  
  // Estados de exploração ou curiosidade → batch hourly
  if (["exploring", "curious", "pending"].includes(leadState)) return "batch_hourly";
  
  // Leads dormentes ou inativos há mais de uma semana → batch 2x daily
  if (daysSinceLastInteraction > 7 || leadState === "dormant") return "batch_2x_daily";
  
  return "batch_hourly"; // Default seguro para os demais casos
}
