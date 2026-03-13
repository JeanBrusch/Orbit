// ══════════════════════════════════════════════════════════════════════════════
// PATCH PROFUNDIDADE — components/lead-nodes.tsx
// Leads frios recuam: menores, mais opacos, mais dessaturados.
// Apenas 1 bloco muda: a lógica activityOpacity no LeadNodeItem.
// ══════════════════════════════════════════════════════════════════════════════


// ─── SUBSTITUIÇÃO ÚNICA ────────────────────────────────────────────────────────
// Encontre este trecho no LeadNodeItem (logo antes do return):
//
//   const activityOpacity = orbitViewStatus.isUnrelated
//     ? "opacity-40"
//     : node.currentState === "dormant"
//       ? "opacity-30 grayscale"
//       : node.currentState === "latent"
//         ? "opacity-50 grayscale-[0.4]"
//         : "opacity-100";
//
// SUBSTITUA POR:

const getFadeDepth = (days: number | undefined, needsAttention: boolean): string => {
  if (needsAttention) return ""                                  // sempre pleno
  const d = days ?? 0
  if (d <= 3)  return ""                                         // pleno
  if (d <= 7)  return "opacity-90"                               // quase pleno
  if (d <= 15) return "opacity-70 scale-[0.97]"                  // começa a recuar
  if (d <= 30) return "opacity-50 scale-[0.94] grayscale-[0.3]"  // recuado
  return            "opacity-30 scale-[0.90] grayscale-[0.6]"    // esvaecido, menor
}

const activityOpacity = orbitViewStatus.isUnrelated
  ? "opacity-40 scale-[0.95]"
  : getFadeDepth(node.daysSinceInteraction, !!node.needsAttention)

// ──────────────────────────────────────────────────────────────────────────────
// NADA MAIS MUDA.
// O wrapper <div> já usa activityOpacity via className — o scale e grayscale
// chegam automaticamente. O nome abaixo do nó fica implicitamente mais apagado
// porque está dentro do mesmo wrapper que recebe opacity.
// ──────────────────────────────────────────────────────────────────────────────
//
// RESULTADO VISUAL:
//   ≤ 3 dias  → 100% tamanho, 100% cor        (próximo, vivo)
//   4–7 dias  → 100% tamanho, 90% opacidade   (levemente apagado)
//   8–15 dias → 97% tamanho, 70% opacidade    (recua um pouco)
//   16–30 dias → 94% tamanho, 50%, leve grey  (claramente distante)
//   > 30 dias → 90% tamanho, 30%, mais grey   (quase fantasma)
