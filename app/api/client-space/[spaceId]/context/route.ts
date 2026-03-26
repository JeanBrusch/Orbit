import { NextRequest, NextResponse } from "next/server"
import { getSupabaseServer } from "@/lib/supabase-server"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ spaceId: string }> }
) {
  try {
    const { spaceId } = await params
    const body = await req.json()
    const { property_id, note, video_url } = body

    if (!spaceId || !property_id) {
      return NextResponse.json({ error: "spaceId e property_id são obrigatórios" }, { status: 400 })
    }

    const supabase = getSupabaseServer() as any

    const { data, error } = await supabase
      .from("client_property_context")
      .upsert(
        {
          client_space_id: spaceId,
          property_id,
          note: note || null,
          video_url: video_url || null,
        },
        { onConflict: "client_space_id,property_id" }
      )
      .select()
      .single()

    if (error) {
      console.error("[context] Supabase error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (err: any) {
    console.error("[context] Server error:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
