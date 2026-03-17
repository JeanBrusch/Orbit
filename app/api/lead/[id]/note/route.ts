import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { processEventWithCore } from "@/lib/orbit-core";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const leadId = params.id;
  try {
    const { content } = await request.json();

    if (!content || !content.trim()) {
      return NextResponse.json({ error: "Conteúdo é obrigatório" }, { status: 400 });
    }

    const supabase = getSupabaseServer();

    // 1. Insert internal note into messages table
    const { data: newMessage, error: insertError } = await supabase
      .from("messages")
      .insert({
        lead_id: leadId,
        source: "internal" as any, // Cast to any to bypass local type constraint before update
        content: content.trim(),
        timestamp: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("[API NOTE] Error inserting note:", insertError);
      return NextResponse.json({ error: "Erro ao salvar nota interna" }, { status: 500 });
    }

    await supabase
      .from('lead_cognitive_state')
      .upsert({
        lead_id: params.id,
        last_human_action_at: new Date().toISOString(),
      }, { onConflict: 'lead_id', ignoreDuplicates: false })

    // 2. Trigger Orbit Core analysis
    // We use "note" type which already exists in Prompt but needs to be well-handled
    processEventWithCore(leadId, content, "note", newMessage.id).catch((err) => {
      console.error("[API NOTE] Orbit Core error:", err);
    });

    return NextResponse.json({ success: true, messageId: newMessage.id });
  } catch (error: any) {
    console.error("[API NOTE] handler error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
