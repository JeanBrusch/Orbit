import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'
import { getContactProfile } from '@/lib/zapi/client'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, phone, origin, note, action, leadId } = body

    // Handle action-based requests
    if (action === 'refresh-profile' && leadId) {
      const supabase = getSupabaseServer()
      const { data: lead } = await supabase
        .from('leads')
        .select('phone, lid')
        .eq('id', leadId)
        .single()

      const profileIdentifier = lead?.phone || (lead?.lid ? (lead.lid.includes('@lid') ? lead.lid : `${lead.lid}@lid`) : null)
      if (!lead || !profileIdentifier) {
        return NextResponse.json({ error: 'Lead not found or has no phone/LID' }, { status: 404 })
      }

      const profile = await getContactProfile(profileIdentifier)
      console.log('Refresh profile result:', { leadId, profile })

      const updates: Record<string, any> = {}
      if (profile.name) updates.name = profile.name
      if (profile.photoUrl) updates.photo_url = profile.photoUrl

      if (Object.keys(updates).length > 0) {
        const { error } = await supabase
          .from('leads')
          .update(updates)
          .eq('id', leadId)

        if (error) {
          console.error('Error updating lead profile:', error)
          return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ success: true, updated: updates })
      }

      return NextResponse.json({ success: true, message: 'No profile data found' })
    }

    // Handle lead creation
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json(
        { error: 'name é obrigatório' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseServer()
    
    const insertData: Record<string, any> = {
      name: name.trim(),
      phone: phone?.trim() || null,
      origin: origin?.trim() || 'manual',
    }
    
    const { data, error } = await supabase
      .from('leads')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      console.error('Error inserting lead:', error)
      return NextResponse.json(
        { error: 'Erro ao criar lead' },
        { status: 500 }
      )
    }

    if (note && note.trim()) {
      await supabase
        .from('internal_notes')
        .insert({
          lead_id: data.id,
          content: note.trim(),
        })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    console.error('Error in POST /api/lead:', err)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { leadId, name, photoUrl } = body

    if (!leadId) {
      return NextResponse.json({ error: 'leadId is required' }, { status: 400 })
    }

    const supabase = getSupabaseServer()
    const updates: Record<string, any> = {}
    
    if (name !== undefined) {
      updates.name = name
    }
    if (photoUrl !== undefined) {
      updates.photo_url = photoUrl
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('leads')
      .update(updates)
      .eq('id', leadId)
      .select()
      .single()

    if (error) {
      console.error('Error updating lead:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, lead: data })
  } catch (error: any) {
    console.error('PUT /api/lead error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
