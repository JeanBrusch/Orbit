// ─────────────────────────────────────────────────────────────────────────────
// RAG IMÓVEIS — orbit-core.ts
// Passo 2: Adicionar estas funções ao orbit-core.ts existente
//
// ONDE INSERIR: logo depois da função generateEmbedding(), antes de analyzeContext()
// ─────────────────────────────────────────────────────────────────────────────

// ─── Tipos do RAG ─────────────────────────────────────────────────────────────

interface CompatibleProperty {
  id: string;
  title: string | null;
  value: number | null;
  neighborhood: string | null;
  city: string | null;
  bedrooms: number | null;
  suites: number | null;
  area_privativa: number | null;
  payment_conditions: any | null;
  features: string[] | null;
  similarity: number;
}

// ─── PASSO A: Montar vetor de perfil limpo do lead ────────────────────────────
//
// NÃO usa o semantic_vector geral do lead (que inclui momentum, urgência, etc.)
// Usa só as memórias que têm relação direta com busca de imóvel.

async function buildLeadProfileEmbedding(
  rawMemory: Array<{ type: string; content: string }>
): Promise<number[] | null> {

  const PROFILE_TYPES = [
    "location_preference",
    "property_type",
    "feature_preference",
    "budget_range",
    "current_search",
    "location_focus",
    "budget",
    "priority",
  ];

  const relevantMemories = rawMemory
    .filter((m) => PROFILE_TYPES.includes(m.type))
    .map((m) => m.content)
    .join(". ");

  if (!relevantMemories.trim()) return null;

  console.log(`[ORBIT RAG] Gerando vetor de perfil: "${relevantMemories.slice(0, 120)}..."`);
  return generateEmbedding(relevantMemories);
}

// ─── PASSO B: Buscar imóveis compatíveis via pgvector ────────────────────────

async function findCompatibleProperties(
  leadId: string,
  rawMemory: Array<{ type: string; content: string }>,
  budgetMax?: number | null
): Promise<CompatibleProperty[]> {

  const supabase = getSupabase();
  if (!supabase) return [];

  // 1. Montar vetor de perfil do lead
  const profileVector = await buildLeadProfileEmbedding(rawMemory);
  if (!profileVector) {
    console.log(`[ORBIT RAG] Sem memórias de perfil suficientes para lead ${leadId}. Pulando RAG.`);
    return [];
  }

  // 2. Coletar IDs de imóveis descartados pelo lead
  const discardedRes = await (supabase.from("memory_items") as any)
    .select("content")
    .eq("lead_id", leadId)
    .eq("type", "discarded");

  // Tenta extrair IDs de UUID das memórias de descarte
  const discardedIds: string[] = (discardedRes?.data || [])
    .map((m: any) => {
      const match = m.content?.match(
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
      );
      return match ? match[0] : null;
    })
    .filter(Boolean);

  console.log(
    `[ORBIT RAG] Buscando imóveis para lead ${leadId}. Descartados: ${discardedIds.length}`
  );

  // 3. Chamar função RPC match_properties no Supabase
  const { data, error } = await supabase.rpc("match_properties", {
    query_embedding: profileVector,
    match_threshold: 0.60,
    match_count: 5,                           // busca 5, filtra por budget depois
    exclude_ids: discardedIds.length > 0 ? discardedIds : [],
  });

  if (error) {
    console.error(`[ORBIT RAG] Erro na busca RPC:`, error);
    return [];
  }

  let results = (data || []) as CompatibleProperty[];

  // 4. Filtro de budget — exclui imóveis acima de 120% do orçamento declarado
  if (budgetMax && budgetMax > 0) {
    results = results.filter(
      (p) => !p.value || p.value <= budgetMax * 1.2
    );
  }

  // 5. Retorna top 3
  const top3 = results.slice(0, 3);
  console.log(
    `[ORBIT RAG] Top ${top3.length} imóveis compatíveis:`,
    top3.map((p) => `${p.title} (score: ${p.similarity.toFixed(2)})`)
  );

  return top3;
}

// ─── PASSO C: Formatar imóveis como texto para o prompt ──────────────────────

function formatPropertiesForPrompt(properties: CompatibleProperty[]): string {
  if (properties.length === 0) return "Nenhum imóvel compatível encontrado no portfólio atual.";

  return properties
    .map((p, i) => {
      const valor = p.value
        ? `R$ ${p.value.toLocaleString("pt-BR")}`
        : "Valor não informado";

      const estrutura = [
        p.bedrooms ? `${p.bedrooms} dorm.` : null,
        p.suites ? `${p.suites} suítes` : null,
        p.area_privativa ? `${p.area_privativa}m²` : null,
      ]
        .filter(Boolean)
        .join(" · ");

      const localizacao = [p.neighborhood, p.city].filter(Boolean).join(", ");

      const condicoes = (() => {
        const cond = p.payment_conditions as any;
        if (!cond) return "Condições não informadas";
        const partes = [];
        if (cond.down_payment_percentage)
          partes.push(`Entrada ${cond.down_payment_percentage}%`);
        if (cond.installments) partes.push(`${cond.installments}x`);
        if (cond.financing) partes.push("Aceita financiamento");
        if (cond.exchange) partes.push("Estuda permuta");
        return partes.join(" · ") || "Condições não informadas";
      })();

      const features =
        p.features && p.features.length > 0
          ? p.features.slice(0, 4).join(", ")
          : null;

      return [
        `${i + 1}. ${p.title || "Imóvel sem título"} [score: ${(p.similarity * 100).toFixed(0)}%]`,
        `   Valor: ${valor}`,
        `   Estrutura: ${estrutura || "Não informado"}`,
        `   Local: ${localizacao || "Não informado"}`,
        `   Condições: ${condicoes}`,
        features ? `   Destaques: ${features}` : null,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// PASSO D: Modificações na função analyzeContext() existente
//
// 1. Adicionar parâmetro `compatibleProperties` na assinatura:
//
//   async function analyzeContext(
//     leadId: string,
//     content: string,
//     type: EventType,
//     context: {
//       lastMessages: string;
//       memory: string;
//       cognitiveState: string;
//       propertyInteractions: string;
//       compatibleProperties: string;  // ← ADICIONAR ESTE CAMPO
//     }
//   ): Promise<CoreAnalysis | null>
//
// 2. Adicionar no prompt, depois de "Interações com Imóveis":
//
//   - Imóveis Compatíveis (RAG): ${context.compatibleProperties}
//
// 3. Adicionar instrução no final do prompt:
//
//   REGRA DE OURO PARA action_description:
//   Se há imóveis compatíveis listados acima, a ação deve referenciar
//   um imóvel específico pelo nome — nunca uma ação genérica como
//   "enviar opções" ou "perguntar sobre preferências".
//   Formato obrigatório: "[canal] · [ação com imóvel específico] · [critério de sucesso]"
//   Exemplo: "WhatsApp · Enviar Casa Ventura 4 suítes — única do perfil disponível · Se pedir simulação, tem negócio"
// ─────────────────────────────────────────────────────────────────────────────

// ─── PASSO E: Modificações em getContext() e processEventWithCore() ──────────
//
// Em getContext(), adicionar ao retorno:
//   rawMemory: memoryItems,  ← já existe, só confirmar
//
// Em processEventWithCore(), antes de chamar analyzeContext():
//
//   // Extrair budget da memória para filtro RAG
//   const budgetMemory = context.rawMemory.find(
//     (m) => m.type === "budget_range" || m.type === "budget"
//   );
//   const budgetMax = budgetMemory
//     ? parseFloat(budgetMemory.content.replace(/\D/g, "")) || null
//     : null;
//
//   // Buscar imóveis compatíveis (RAG)
//   const compatibleProps = await findCompatibleProperties(
//     leadId,
//     context.rawMemory,
//     budgetMax
//   );
//   const compatiblePropertiesText = formatPropertiesForPrompt(compatibleProps);
//
//   // Passar para analyzeContext
//   const analysis = await analyzeContext(leadId, content, type, {
//     ...context,
//     compatibleProperties: compatiblePropertiesText,
//   });
