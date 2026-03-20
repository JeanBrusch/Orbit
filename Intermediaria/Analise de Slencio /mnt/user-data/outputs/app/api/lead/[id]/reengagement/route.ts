import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Types ─────────────────────────────────────────────────────────────────────

interface SilenceAnalysis {
  silence_reason: string;
  strategy: string;
  emotional_state: string;
  days_silent: number;
  last_known_intent: string;
  best_contact_window: string;
  next_step_if_reply: string;
  next_step_if_ignore: string;
  confidence: number;
}

interface MatchedProperty {
  id: string;
  title: string | null;
  value: number | null;
  location_text: string | null;
  features: string[] | null;
  cover_image: string | null;
  similarity_score: number;
}

interface ReengagementResult {
  message: string;
  tone: "casual" | "curiosity" | "direct" | "reconnect" | "value_anchor";
  days_silent: number;
  silence_reason: string;
  strategy: string;
  should_include_properties: boolean;
  matched_properties: MatchedProperty[];
  confidence: number;
  next_step_if_reply: string;
  next_step_if_ignore: string;
  reasoning: string;
  generated_at: string;
}

// ─── Helper: should we include properties? ────────────────────────────────────

function shouldIncludeProperties(reason: string, strategy: string): boolean {
  const NO_PROPERTY_REASONS = ["TRUST_GAP", "OVERWHELM", "MISALIGNMENT"];
  const NO_PROPERTY_STRATEGIES = ["REBUILD_TRUST", "SIMPLIFY", "REQUALIFY"];

  if (NO_PROPERTY_REASONS.includes(reason)) return false;
  if (NO_PROPERTY_STRATEGIES.includes(strategy)) return false;
  return true;
}

// ─── Helper: fetch matching properties from Atlas ────────────────────────────

async function fetchMatchingProperties(
  leadId: string,
  supabase: ReturnType<typeof getSupabaseServer>
): Promise<MatchedProperty[]> {
  try {
    // Get lead memories to extract profile
    const { data: memories } = await (supabase.from("memory_items") as any)
      .select("type, content")
      .eq("lead_id", leadId)
      .in("type", [
        "budget_range",
        "budget",
        "location_preference",
        "location_focus",
        "property_type",
        "feature_preference",
      ]);

    if (!memories?.length) return [];

    // Get discarded property IDs to exclude
    const { data: discarded } = await (supabase.from("memory_items") as any)
      .select("content")
      .eq("lead_id", leadId)
      .eq("type", "discarded");

    const discardedIds: string[] = (discarded || [])
      .map((m: any) => {
        const match = m.content?.match(
          /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
        );
        return match ? match[0] : null;
      })
      .filter(Boolean);

    // Extract budget from memories
    const budgetMemory = memories.find(
      (m: any) => m.type === "budget_range" || m.type === "budget"
    );
    const budgetMax = budgetMemory
      ? parseFloat(budgetMemory.content.replace(/\D/g, "")) || null
      : null;

    // Build a keyword query from location + type preferences
    const locationMem = memories.find(
      (m: any) => m.type === "location_preference" || m.type === "location_focus"
    );
    const typeMem = memories.find((m: any) => m.type === "property_type");

    let query = supabase
      .from("properties")
      .select(
        "id, title, value, location_text, features, cover_image, neighborhood, city"
      )
      .not("cover_image", "is", null);

    if (budgetMax && budgetMax > 0) {
      query = query.lte("value", budgetMax * 1.15);
    }

    if (discardedIds.length > 0) {
      query = query.not("id", "in", `(${discardedIds.join(",")})`);
    }

    const { data: properties } = await query
      .order("created_at", { ascending: false })
      .limit(20);

    if (!properties?.length) return [];

    // Score properties by memory match
    const scored = properties.map((p: any) => {
      let score = 0.5; // base

      const locationText = `${p.neighborhood || ""} ${p.city || ""} ${
        p.location_text || ""
      }`.toLowerCase();
      if (
        locationMem &&
        locationText.includes(locationMem.content.toLowerCase().split(" ")[0])
      ) {
        score += 0.3;
      }

      const typeText = `${p.title || ""} ${(p.features || []).join(" ")}`.toLowerCase();
      if (typeMem && typeText.includes(typeMem.content.toLowerCase().split(" ")[0])) {
        score += 0.2;
      }

      return {
        id: p.id,
        title: p.title,
        value: p.value,
        location_text: p.location_text,
        features: p.features,
        cover_image: p.cover_image,
        similarity_score: Math.min(1, score),
      };
    });

    return scored
      .sort((a: any, b: any) => b.similarity_score - a.similarity_score)
      .slice(0, 3);
  } catch (err) {
    console.error("[REENGAGEMENT] Error fetching matching properties:", err);
    return [];
  }
}

// ─── Helper: format properties for prompt ────────────────────────────────────

function formatPropertiesForPrompt(properties: MatchedProperty[]): string {
  if (!properties.length) return "Nenhum imóvel compatível no acervo atual.";

  return properties
    .map((p, i) => {
      const value = p.value
        ? `R$ ${(p.value / 1000).toFixed(0)}k`
        : "Valor a confirmar";
      const features =
        p.features?.slice(0, 3).join(", ") || "características não listadas";
      return `${i + 1}. ${p.title || "Imóvel sem título"} | ${value} | ${
        p.location_text || "Localização a confirmar"
      } | ${features}`;
    })
    .join("\n");
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const leadId = params.id;

  try {
    const supabase = getSupabaseServer();
    const body = await req.json().catch(() => ({}));

    // Accept pre-computed silence analysis or compute fresh
    let silenceAnalysis: SilenceAnalysis | null = body.silence_analysis || null;

    // If no pre-computed analysis, fetch the latest from DB
    if (!silenceAnalysis) {
      const { data: latestAnalysis } = await (supabase
        .from("silence_analyses") as any)
        .select("*")
        .eq("lead_id", leadId)
        .order("analyzed_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestAnalysis) {
        const hoursOld =
          (Date.now() - new Date(latestAnalysis.analyzed_at).getTime()) /
          3600000;

        // Use cached analysis if less than 6h old
        if (hoursOld < 6) {
          silenceAnalysis = latestAnalysis as SilenceAnalysis;
        }
      }
    }

    // If still no analysis, we need one — return 400 to force caller to run silence-analysis first
    if (!silenceAnalysis) {
      return NextResponse.json(
        {
          error:
            "Silence analysis required. Run POST /api/lead/{id}/silence-analysis first.",
          code: "ANALYSIS_REQUIRED",
        },
        { status: 400 }
      );
    }

    // ── Fetch lead context ──────────────────────────────────────────────────
    const [leadRes, cogRes, memRes] = await Promise.all([
      supabase
        .from("leads")
        .select("id, name, phone, orbit_stage, action_suggested")
        .eq("id", leadId)
        .single(),
      supabase
        .from("lead_cognitive_state")
        .select(
          "interest_score, momentum_score, current_state, central_conflict, what_not_to_do"
        )
        .eq("lead_id", leadId)
        .maybeSingle(),
      (supabase.from("memory_items") as any)
        .select("type, content")
        .eq("lead_id", leadId)
        .in("type", [
          "budget_range",
          "location_preference",
          "property_type",
          "feature_preference",
          "identity",
        ])
        .limit(8),
    ]);

    const lead = leadRes.data;
    const cog = cogRes.data;
    const memories: { type: string; content: string }[] = memRes.data || [];

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const leadFirstName = lead.name?.split(" ")[0] || "você";
    const memoryText = memories
      .map((m) => `${m.type.replace(/_/g, " ")}: ${m.content}`)
      .join("\n");

    // ── Decide whether to include properties ───────────────────────────────
    const includeProperties = shouldIncludeProperties(
      silenceAnalysis.silence_reason,
      silenceAnalysis.strategy
    );

    let matchedProperties: MatchedProperty[] = [];
    if (includeProperties) {
      matchedProperties = await fetchMatchingProperties(leadId, supabase);
    }

    const propertiesContext = includeProperties
      ? formatPropertiesForPrompt(matchedProperties)
      : null;

    // ── Build tone guidance from silence analysis ──────────────────────────
    const toneMap: Record<string, string> = {
      PRICE_FRICTION:
        "direto e honesto, reconhece o atrito de valor sem ceder preço, reancora em benefício real",
      TIMING:
        "leve e casual, não pressiona, abre porta sem exigir resposta imediata",
      TRUST_GAP:
        "humano, sem agenda comercial visível, simplesmente existe sem vender",
      LOW_INTENT:
        "curto, zero pressão, pergunta aberta que custa zero responder",
      OVERWHELM:
        "simples, uma coisa só, tira o peso da decisão complexa",
      MISALIGNMENT:
        "honesto sobre o reajuste de perfil, sem julgamento",
      COMPETING_OFFER:
        "confiante, diferencia sem atacar, ancora no relacionamento construído",
    };

    const toneGuidance =
      toneMap[silenceAnalysis.silence_reason] ||
      "natural, direto, humano — como um profissional que se importa, não um sistema automatizado";

    // ── Prompt ────────────────────────────────────────────────────────────
    const prompt = `Você é o motor de reengajamento do Orbit — um sistema imobiliário de inteligência cognitiva.

Seu trabalho: escrever UMA mensagem de WhatsApp que um corretor de alto nível enviaria naturalmente.

════════════════════════════════════════
DIAGNÓSTICO DO SILÊNCIO
════════════════════════════════════════
Lead: ${leadFirstName}
Dias em silêncio: ${silenceAnalysis.days_silent}
Motivo classificado: ${silenceAnalysis.silence_reason}
Estado emocional atual: ${silenceAnalysis.emotional_state}
Última intenção conhecida: ${silenceAnalysis.last_known_intent}
Estratégia indicada: ${silenceAnalysis.strategy}
Confiança da análise: ${Math.round(silenceAnalysis.confidence * 100)}%

════════════════════════════════════════
PERFIL ACUMULADO
════════════════════════════════════════
${memoryText || "Perfil ainda em construção"}

${cog?.central_conflict ? `Conflito central identificado: ${cog.central_conflict}` : ""}
${cog?.what_not_to_do ? `O que NÃO fazer: ${cog.what_not_to_do}` : ""}
Interesse atual: ${cog?.interest_score ?? 0}% | Momentum: ${cog?.momentum_score ?? 0}%

════════════════════════════════════════
${includeProperties ? "IMÓVEIS COMPATÍVEIS NO ACERVO" : "NOTA: NÃO incluir imóveis nesta mensagem"}
════════════════════════════════════════
${propertiesContext || "(estratégia não recomenda incluir imóvel agora)"}

════════════════════════════════════════
DIRETRIZES DE TOM
════════════════════════════════════════
Tom indicado: ${toneGuidance}

${
  includeProperties && matchedProperties.length > 0
    ? `Se mencionar imóvel: cite o primeiro da lista pelo nome ou característica marcante.
Não liste todos. Máximo um imóvel citado.`
    : "Não mencione imóveis. O objetivo desta mensagem é reabrir o canal, não vender."
}

════════════════════════════════════════
REGRAS ABSOLUTAS — NUNCA VIOLE
════════════════════════════════════════
1. A mensagem deve parecer escrita por uma pessoa, não um sistema
2. Máximo 3 frases. Menor é mais poderoso.
3. Nenhuma pressão direta para responder
4. Sem emojis excessivos (zero ou máximo 1 se natural ao contexto)
5. Sem "espero que esteja bem" ou frases de template
6. Sem mencionar que é uma mensagem de follow-up
7. Use o primeiro nome do lead: ${leadFirstName}
8. Deve existir um motivo real para entrar em contato (imóvel novo, janela de negociação, informação relevante) — nunca "só aparecendo"

════════════════════════════════════════
ESTRUTURA DO JSON DE RESPOSTA
════════════════════════════════════════
Responda APENAS com JSON puro:
{
  "message": "a mensagem completa, pronta para enviar",
  "tone": "casual|curiosity|direct|reconnect|value_anchor",
  "reasoning": "por que essa abordagem funciona para esse lead nesse momento — 1 parágrafo objetivo",
  "what_makes_it_work": "o elemento específico que torna essa mensagem diferente de template",
  "risk_if_sent": "o maior risco desta mensagem e como mitigar"
}`;

    const response = await anthropic.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const rawText =
      response.content[0].type === "text" ? response.content[0].text : "{}";

    let parsed: any = {};
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    } catch {
      return NextResponse.json(
        { error: "Failed to parse AI response" },
        { status: 500 }
      );
    }

    // ── Compose final result ───────────────────────────────────────────────
    const result: ReengagementResult = {
      message: parsed.message || "",
      tone: parsed.tone || "reconnect",
      days_silent: silenceAnalysis.days_silent,
      silence_reason: silenceAnalysis.silence_reason,
      strategy: silenceAnalysis.strategy,
      should_include_properties: includeProperties,
      matched_properties: includeProperties ? matchedProperties : [],
      confidence: silenceAnalysis.confidence,
      next_step_if_reply: silenceAnalysis.next_step_if_reply,
      next_step_if_ignore: silenceAnalysis.next_step_if_ignore,
      reasoning: parsed.reasoning || "",
      generated_at: new Date().toISOString(),
    };

    // ── Persist experiment log (for future learning) ───────────────────────
    try {
      await (supabase.from("reengagement_experiments") as any).insert({
        lead_id: leadId,
        silence_reason: result.silence_reason,
        strategy: result.strategy,
        tone: result.tone,
        days_silent: result.days_silent,
        had_property: result.should_include_properties && result.matched_properties.length > 0,
        message_length: result.message.length,
        sent_at_hour: null, // filled when actually sent
        had_response: null, // filled later
        response_time_minutes: null, // filled later
        generated_at: result.generated_at,
      });
    } catch {
      // Non-critical — don't fail the request
    }

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[REENGAGEMENT] Error:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// ─── PATCH: mark experiment as sent + hour ────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const leadId = params.id;

  try {
    const body = await req.json();
    const { sent_at_hour, experiment_id } = body;

    const supabase = getSupabaseServer();

    if (experiment_id) {
      await (supabase.from("reengagement_experiments") as any)
        .update({ sent_at_hour, sent_at: new Date().toISOString() })
        .eq("id", experiment_id);
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
