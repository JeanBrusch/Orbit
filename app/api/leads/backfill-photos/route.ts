import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getContactProfile } from '@/lib/zapi/client'

export async function GET(request: Request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Buscar leads sem foto
    const { data: leads, error } = await supabase
      .from('leads')
      .select('id, name, phone, lid, photo_url')
      .eq('state', 'approved')
      .is('photo_url', null)
      .or('phone.not.is.null,lid.not.is.null')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Erro ao buscar leads:', error)
      return NextResponse.json({ error: 'Erro ao buscar leads' }, { status: 500 })
    }

    if (!leads || leads.length === 0) {
      return NextResponse.json({ message: 'Nenhum lead precisa de foto' })
    }

    const results = []

    for (const lead of leads) {
      const identifier = lead.lid || lead.phone
      if (!identifier) continue

      try {
        const profile = await getContactProfile(identifier)

        if (profile.photoUrl) {
          const { error: updateError } = await supabase
            .from('leads')
            .update({ photo_url: profile.photoUrl })
            .eq('id', lead.id)

          if (updateError) {
            console.error(`Erro ao atualizar lead ${lead.id}:`, updateError)
            results.push({ id: lead.id, status: 'error', error: updateError.message })
          } else {
            results.push({ id: lead.id, status: 'success', name: lead.name })
          }
        } else {
          results.push({ id: lead.id, status: 'no_photo' })
        }
      } catch (err: any) {
        console.error(`Erro ao processar lead ${lead.id}:`, err)
        results.push({ id: lead.id, status: 'error', error: err.message })
      }
    }

    return NextResponse.json({ 
      processed: leads.length,
      results 
    })
  } catch (error: any) {
    console.error('Erro no backfill:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
