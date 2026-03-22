import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { leadId, content, direction, type, idempotencyKey } = body

    if (!leadId || typeof leadId !== 'string') {
      return NextResponse.json(
        { error: 'leadId é obrigatório' },
        { status: 400 }
      )
    }

    if (!content || typeof content !== 'string' || content.trim() === '') {
      return NextResponse.json(
        { error: 'content é obrigatório' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseServer()

    // Idempotency check: if key provided, check if already processed
    if (idempotencyKey) {
      const { data: existing } = await supabase
        .from('interactions')
        .select('id')
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle()
      
      if (existing) {
        console.log('[INTERACTION] Idempotent skip:', idempotencyKey)
        return NextResponse.json(
          { id: existing.id, skipped: true, message: 'Already processed' },
          { status: 200 }
        )
      }
    }

    const validDirections = ['outbound', 'inbound']
    const validTypes = ['message', 'note']
    
    // Mapping interaction to messages schema
    const insertData: any = {
      lead_id: leadId,
      content: content.trim(),
      source: direction === 'inbound' ? 'whatsapp' : (type === 'note' ? 'internal' : 'operator'),
      timestamp: new Date().toISOString()
    }
    
    if (idempotencyKey) {
      insertData.idempotency_key = idempotencyKey
    }
    
    const { data, error } = await (supabase.from('messages') as any)
      .insert(insertData)
      .select()
      .single()

    if (error) {
      // Handle duplicate key error - already processed
      if (error.code === '23505') {
        return NextResponse.json(
          { skipped: true, message: 'Already processed' },
          { status: 200 }
        )
      }
      console.error('Error inserting message from interaction API:', error)
      return NextResponse.json(
        { error: 'Erro ao salvar mensagem' },
        { status: 500 }
      )
    }

    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    console.error('Error in POST /api/interaction:', err)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
