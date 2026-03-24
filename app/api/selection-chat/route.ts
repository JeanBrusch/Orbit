import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

// GET /api/selection-chat?leadId=...&propertyId=...
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const leadId = searchParams.get("leadId");
  const propertyId = searchParams.get("propertyId");

  if (!leadId || !propertyId) {
    return NextResponse.json({ error: "Missing leadId or propertyId" }, { status: 400 });
  }

  const supabase = getSupabaseServer();

  try {
    const { data, error } = await supabase
      .from("orbit_selection_chat")
      .select("*")
      .eq("lead_id", leadId)
      .eq("property_id", propertyId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    return NextResponse.json({ messages: data || [] });
  } catch (err: any) {
    console.error("[selection-chat] GET error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/selection-chat
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { leadId, propertyId, senderType, content } = body;

  if (!leadId || !propertyId || !senderType || !content) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const supabase = getSupabaseServer();

  try {
    const { data, error } = await (supabase.from("orbit_selection_chat") as any)
      .insert({
        lead_id: leadId,
        property_id: propertyId,
        sender_type: senderType, // 'lead' or 'broker'
        content,
      })
      .select()
      .single();

    if (error) throw error;

    // Se for uma mensagem do corretor, poderíamos disparar um webhook para o WhatsApp aqui futuramente

    return NextResponse.json(data);
  } catch (err: any) {
    console.error("[selection-chat] POST error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
