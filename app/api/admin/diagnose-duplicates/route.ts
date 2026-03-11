import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'
import { normalizePhone } from '@/lib/phone-utils'

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseServer()
    
    const { data: allLeads, error } = await supabase
      .from('leads')
      .select('id, phone, name, created_at, state')
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
    
    const duplicates: Array<{
      phone: string
      count: number
      leads: typeof allLeads
    }> = []
    
    for (const [phone, leads] of phoneMap) {
      if (leads.length > 1) {
        duplicates.push({
          phone,
          count: leads.length,
          leads
        })
      }
    }
    
    const { data: duplicateInteractions } = await supabase
      .from('interactions')
      .select('id, idempotency_key')
      .not('idempotency_key', 'is', null)
    
    const idempotencyMap = new Map<string, string[]>()
    for (const interaction of duplicateInteractions || []) {
      const key = interaction.idempotency_key
      if (!idempotencyMap.has(key)) {
        idempotencyMap.set(key, [])
      }
      idempotencyMap.get(key)!.push(interaction.id)
    }
    
    const duplicateIdempotency = Array.from(idempotencyMap.entries())
      .filter(([_, ids]) => ids.length > 1)
      .map(([key, ids]) => ({ key, count: ids.length, ids }))
    
    return NextResponse.json({
      status: 'ok',
      totalLeads: allLeads?.length || 0,
      uniquePhones: phoneMap.size,
      duplicatePhones: duplicates.length,
      duplicates: duplicates,
      duplicateInteractions: duplicateIdempotency.length,
      interactionDuplicates: duplicateIdempotency
    })
    
  } catch (error: any) {
    console.error('Error in diagnose-duplicates:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
