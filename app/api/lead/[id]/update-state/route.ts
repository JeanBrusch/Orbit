import { NextRequest, NextResponse } from "next/server"
import { getSupabaseServer } from "@/lib/supabase-server"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const { state } = body

    if (!id) {
      return NextResponse.json({ error: "ID missing" }, { status: 400 })
    }

    if (!state || !["approved", "ignored", "blocked", "pending"].includes(state)) {
      return NextResponse.json({ error: "Invalid state" }, { status: 400 })
    }

    const supabase = getSupabaseServer()

    const { data, error } = await (supabase as any)
      .from("leads")
      .update({ state })
      .eq("id", id)
      .select()
      .single()

    if (error) {
      console.error("[update-state] Supabase error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, lead: data })
  } catch (err: any) {
    console.error("[update-state] Server error:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
