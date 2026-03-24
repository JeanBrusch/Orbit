// app/api/cron/process-batch/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase-server';
import { processEventWithCore } from '@/lib/orbit-core';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Verificação de segurança simplificada
  const authHeader = req.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseServer();

  try {
    // 1. Buscar mensagens na fila de batch
    const { data: queuedMessages, error: listError } = await (supabase
      .from('messages')
      .select('id, lead_id, content, timestamp, source')
      .eq('analysis_status', 'queued')
      .order('timestamp', { ascending: true }) as any);

    if (listError) throw listError;
    if (!queuedMessages || queuedMessages.length === 0) {
      return NextResponse.json({ ok: true, processed: 0, message: 'Fila vazia' });
    }

    // 2. Agrupar por Lead
    const leadsToProcess = new Map<string, any[]>();
    for (const msg of queuedMessages) {
      if (!leadsToProcess.has(msg.lead_id)) {
        leadsToProcess.set(msg.lead_id, []);
      }
      leadsToProcess.get(msg.lead_id)!.push(msg);
    }

    console.log(`[BATCH] Processando ${leadsToProcess.size} leads com mensagens em fila.`);

    const results = [];

    // 3. Processar cada lead
    for (const [leadId, messages] of leadsToProcess.entries()) {
      try {
        // Concatenar mensagens para análise resumida
        const batchContent = messages.map(m => m.content).join(' | ');
        const lastSource = messages[messages.length - 1].source;

        console.log(`[BATCH] Processando lead ${leadId} (${messages.length} mensagens)`);

        // Disparar análise core
        // Nota: O Core já busca o contexto (mensagens recentes), mas aqui passamos o conteúdo acumulado
        await processEventWithCore(leadId, batchContent, lastSource);

        // 4. Marcar como concluído no banco
        const messageIds = messages.map(m => m.id);
        await (supabase
          .from('messages')
          .update({ analysis_status: 'completed', analysis_completed_at: new Date().toISOString() })
          .in('id', messageIds) as any);

        results.push({ leadId, status: 'success', count: messages.length });
      } catch (err: any) {
        console.error(`[BATCH] Erro no lead ${leadId}:`, err);
        results.push({ leadId, status: 'error', error: err.message });
      }
    }

    return NextResponse.json({
      ok: true,
      processed_leads: leadsToProcess.size,
      total_messages: queuedMessages.length,
      details: results
    });

  } catch (err: any) {
    console.error('[BATCH] Fatal error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
