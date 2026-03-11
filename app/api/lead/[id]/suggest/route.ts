import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const { data } = await supabase
      .from('ai_insights')
      .select('content, urgency')
      .eq('lead_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!data) {
      return NextResponse.json({ suggestion: null, urgency: 0 })
    }

    // Extract the action portion after "· Próxima ação: " if present
    const raw = data.content || ''
    const match = raw.match(/Próxima ação:\s*(.+)$/)
    const suggestion = match ? match[1].trim() : raw

    return NextResponse.json({ suggestion, urgency: data.urgency || 0 })
  } catch (err) {
    console.error('[SUGGEST API] Error:', err)
    return NextResponse.json({ suggestion: null, urgency: 0 })
  }
}
