import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'
import { normalizePhone } from '@/lib/phone-utils'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { dryRun = true } = body
    
    const supabase = getSupabaseServer()
    
    const { data: allLeads, error } = await supabase
      .from('leads')
      .select('id, phone, name, photo_url, created_at, state, origin')
      .order('created_at', { ascending: true })
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    const phoneMap = new Map<string, typeof allLeads>()
    
    for (const lead of allLeads || []) {
      const normalized = normalizePhone(lead.phone || '')
      
      if (!phoneMap.has(normalized)) {
        phoneMap.set(normalized, [])
      }
      phoneMap.get(normalized)!.push(lead)
    }
    
    const mergeResults: Array<{
      phone: string
      primaryId: string
      mergedIds: string[]
      interactionsMoved: number
      capsulesMoved: number
      remindersMoved: number
      notesMoved: number
    }> = []
    
    for (const [phone, leads] of phoneMap) {
      if (leads.length <= 1) continue
      
      const sortedLeads = leads.sort((a, b) => {
        const aHasPhoto = a.photo_url ? 1 : 0
        const bHasPhoto = b.photo_url ? 1 : 0
        if (aHasPhoto !== bHasPhoto) return bHasPhoto - aHasPhoto
        
        const aHasName = a.name && !a.name.startsWith('+') ? 1 : 0
        const bHasName = b.name && !b.name.startsWith('+') ? 1 : 0
        if (aHasName !== bHasName) return bHasName - aHasName
        
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      })
      
      const primary = sortedLeads[0]
      const duplicates = sortedLeads.slice(1)
      const duplicateIds = duplicates.map(d => d.id)
      
      let interactionsMoved = 0
      let capsulesMoved = 0
      let remindersMoved = 0
      let notesMoved = 0
      
      if (!dryRun && duplicateIds.length > 0) {
        const { data: movedInteractions, error: intError } = await supabase
          .from('interactions')
          .update({ lead_id: primary.id })
          .in('lead_id', duplicateIds)
          .select('id')
        
        if (intError) {
          console.error('Error moving interactions:', intError)
        } else {
          interactionsMoved = movedInteractions?.length || 0
        }
        
        const { data: movedCapsules, error: capError } = await supabase
          .from('capsules')
          .update({ lead_id: primary.id })
          .in('lead_id', duplicateIds)
          .select('id')
        
        if (capError) {
          console.error('Error moving capsules:', capError)
        } else {
          capsulesMoved = movedCapsules?.length || 0
        }
        
        const { data: movedReminders, error: remError } = await supabase
          .from('reminders')
          .update({ lead_id: primary.id })
          .in('lead_id', duplicateIds)
          .select('id')
        
        if (remError) {
          console.error('Error moving reminders:', remError)
        } else {
          remindersMoved = movedReminders?.length || 0
        }
        
        const { data: movedNotes, error: noteError } = await supabase
          .from('internal_notes')
          .update({ lead_id: primary.id })
          .in('lead_id', duplicateIds)
          .select('id')
        
        if (noteError) {
          console.error('Error moving notes:', noteError)
        } else {
          notesMoved = movedNotes?.length || 0
        }
        
        const { error: deleteError } = await supabase
          .from('leads')
          .delete()
          .in('id', duplicateIds)
        
        if (deleteError) {
          console.error('Error deleting duplicate leads:', deleteError)
        }
        
        if (!primary.photo_url) {
          const withPhoto = duplicates.find(d => d.photo_url)
          if (withPhoto) {
            await supabase
              .from('leads')
              .update({ photo_url: withPhoto.photo_url })
              .eq('id', primary.id)
          }
        }
        
        if (primary.name?.startsWith('+')) {
          const withName = duplicates.find(d => d.name && !d.name.startsWith('+'))
          if (withName) {
            await supabase
              .from('leads')
              .update({ name: withName.name })
              .eq('id', primary.id)
          }
        }
      } else {
        const { count: intCount } = await supabase
          .from('interactions')
          .select('id', { count: 'exact', head: true })
          .in('lead_id', duplicateIds)
        interactionsMoved = intCount || 0
        
        const { count: capCount } = await supabase
          .from('capsules')
          .select('id', { count: 'exact', head: true })
          .in('lead_id', duplicateIds)
        capsulesMoved = capCount || 0
        
        const { count: remCount } = await supabase
          .from('reminders')
          .select('id', { count: 'exact', head: true })
          .in('lead_id', duplicateIds)
        remindersMoved = remCount || 0
        
        const { count: noteCount } = await supabase
          .from('internal_notes')
          .select('id', { count: 'exact', head: true })
          .in('lead_id', duplicateIds)
        notesMoved = noteCount || 0
      }
      
      mergeResults.push({
        phone,
        primaryId: primary.id,
        mergedIds: duplicateIds,
        interactionsMoved,
        capsulesMoved,
        remindersMoved,
        notesMoved
      })
    }
    
    return NextResponse.json({
      status: dryRun ? 'dry_run' : 'executed',
      message: dryRun 
        ? 'Este é um dry run. Nenhuma alteração foi feita. Envie { "dryRun": false } para executar.'
        : 'Merge concluído com sucesso.',
      totalDuplicateGroups: mergeResults.length,
      totalLeadsMerged: mergeResults.reduce((acc, r) => acc + r.mergedIds.length, 0),
      results: mergeResults
    })
    
  } catch (error: any) {
    console.error('Error in merge-duplicates:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
