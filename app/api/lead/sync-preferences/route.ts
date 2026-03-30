import { NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'

// POST /api/lead/sync-preferences
// Sincroniza lead_preferences a partir das memory_items
// Pode ser chamado manualmente ou via cron
export async function POST() {
  try {
    const supabase = getSupabaseServer()
    
    // sync_lead_preferences é uma RPC que agrega memory_items → lead_preferences
    // Usando cast genérico porque os types podem não estar atualizados
    const { data: syncResult, error: syncError } = await supabase
      .rpc('sync_lead_preferences' as any)
    
    if (syncError) {
      console.error('[sync-preferences] Error:', syncError)
      return NextResponse.json({ error: syncError.message }, { status: 500 })
    }

    const result = syncResult as unknown as Array<{ synced_count: number }> | { synced_count: number }
    const syncedCount = Array.isArray(result) 
      ? result[0]?.synced_count ?? 0 
      : (result as any)?.synced_count ?? 0
    
    return NextResponse.json({ 
      ok: true, 
      synced: syncedCount,
      timestamp: new Date().toISOString()
    })
  } catch (err: any) {
    console.error('[sync-preferences] Unexpected error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
