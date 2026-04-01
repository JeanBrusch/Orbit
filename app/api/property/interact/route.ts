import { getSupabaseServer } from "@/lib/supabase-server"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const supabase = getSupabaseServer()
    const { propertyId, leadId, action, metadata = {} } = await req.json()

    if (!propertyId || !leadId || !action) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // 1. Registro em property_interactions
    // Tipos suportados: 'sent', 'favorited', 'viewed', etc.
    const { error: interactionError } = await supabase
      .from("property_interactions")
      .insert({
        property_id: propertyId,
        lead_id: leadId,
        interaction_type: action,
        source: "atlas_terminal",
        metadata: metadata
      })

    if (interactionError) throw interactionError

    // 2. Se for 'sent' (Propor), também registrar em lead_actions
    if (action === "sent") {
      const { error: actionError } = await supabase
        .from("lead_actions")
        .insert({
          lead_id: leadId,
          type: "property_sent",
          content: `Imóvel proposto via Atlas Terminal: ${propertyId}`,
          outcome: "pending",
          metadata: { ...metadata, property_id: propertyId }
        })

      if (actionError) throw actionError

      // Opcional: Atualizar a última interação do lead
      await supabase
        .from("leads")
        .update({ last_interaction_at: new Date().toISOString() })
        .eq("id", leadId)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Interaction API Error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
