import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from "@/lib/supabase-server"

const supabase = getSupabaseServer() as any

export async function POST(request: NextRequest) {
  try {
    const { data: allLeads, error: fetchError } = await supabase
      .from('leads')
      .select('id, phone, name, created_at, state')
      .order('created_at', { ascending: true })
    
    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }
    
    if (!allLeads || allLeads.length === 0) {
      return NextResponse.json({ message: 'No leads found', deleted: 0, mergedInteractions: 0 })
    }
    
    const phoneToFirstLead = new Map<string, typeof allLeads[0]>()
    const duplicatesToMerge: { duplicateId: string; keepId: string; phone: string }[] = []
    
    for (const lead of allLeads) {
      if (!lead.phone) continue
      
      if (phoneToFirstLead.has(lead.phone)) {
        const keepLead = phoneToFirstLead.get(lead.phone)!
        duplicatesToMerge.push({
          duplicateId: lead.id,
          keepId: keepLead.id,
          phone: lead.phone
        })
      } else {
        phoneToFirstLead.set(lead.phone, lead)
      }
    }
    
    if (duplicatesToMerge.length === 0) {
      return NextResponse.json({ 
        message: 'No duplicates found', 
        totalLeads: allLeads.length,
        uniquePhones: phoneToFirstLead.size,
        deleted: 0,
        mergedInteractions: 0
      })
    }
    
    let totalMergedInteractions = 0
    let totalDeleted = 0
    
    for (const { duplicateId, keepId, phone } of duplicatesToMerge) {
      const { data: interactions, error: fetchIntError } = await supabase
        .from('interactions')
        .select('*')
        .eq('lead_id', duplicateId)
      
      if (fetchIntError) {
        console.error('Error fetching interactions for', duplicateId, fetchIntError)
        continue
      }
      
      if (interactions && interactions.length > 0) {
        const { error: updateError, count } = await supabase
          .from('interactions')
          .update({ lead_id: keepId })
          .eq('lead_id', duplicateId)
        
        if (updateError) {
          console.error('Error merging interactions:', updateError)
        } else {
          totalMergedInteractions += interactions.length
          console.log(`Merged ${interactions.length} interactions from ${duplicateId} to ${keepId}`)
        }
      }
      
      const { error: capsuleError } = await supabase
        .from('capsules')
        .update({ lead_id: keepId })
        .eq('lead_id', duplicateId)
      
      if (capsuleError) {
        console.log('No capsules to merge or error:', capsuleError.message)
      }
      
      const { error: reminderError } = await supabase
        .from('reminders')
        .update({ lead_id: keepId })
        .eq('lead_id', duplicateId)
      
      if (reminderError) {
        console.log('No reminders to merge or error:', reminderError.message)
      }
      
      const { error: noteError } = await supabase
        .from('internal_notes')
        .update({ lead_id: keepId })
        .eq('lead_id', duplicateId)
      
      if (noteError) {
        console.log('No notes to merge or error:', noteError.message)
      }
      
      const { error: deleteError } = await supabase
        .from('leads')
        .delete()
        .eq('id', duplicateId)
      
      if (deleteError) {
        console.error('Error deleting duplicate lead:', duplicateId, deleteError)
      } else {
        totalDeleted++
        console.log(`Deleted duplicate lead ${duplicateId} (phone: ${phone})`)
      }
    }
    
    return NextResponse.json({
      message: 'Cleanup completed with merge',
      totalLeads: allLeads.length,
      uniquePhones: phoneToFirstLead.size,
      duplicatesFound: duplicatesToMerge.length,
      deleted: totalDeleted,
      mergedInteractions: totalMergedInteractions
    })
    
  } catch (error: any) {
    console.error('Cleanup error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function GET() {
  try {
    const { data: allLeads, error: fetchError } = await supabase
      .from('leads')
      .select('id, phone, name, created_at')
      .order('created_at', { ascending: true })
    
    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }
    
    if (!allLeads) {
      return NextResponse.json({ totalLeads: 0, duplicates: 0 })
    }
    
    const phoneCounts = new Map<string, number>()
    for (const lead of allLeads) {
      if (!lead.phone) continue
      phoneCounts.set(lead.phone, (phoneCounts.get(lead.phone) || 0) + 1)
    }
    
    const duplicatePhones = Array.from(phoneCounts.entries())
      .filter(([_, count]) => count > 1)
      .map(([phone, count]) => ({ phone, count }))
      .sort((a, b) => b.count - a.count)
    
    const totalDuplicates = duplicatePhones.reduce((sum, { count }) => sum + count - 1, 0)
    
    return NextResponse.json({
      totalLeads: allLeads.length,
      uniquePhones: phoneCounts.size,
      duplicatePhones: duplicatePhones.length,
      totalDuplicates,
      top10Duplicates: duplicatePhones.slice(0, 10)
    })
    
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
