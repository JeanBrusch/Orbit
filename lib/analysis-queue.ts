// lib/analysis-queue.ts
import { getSupabaseServer } from "@/lib/supabase-server";

export async function enqueueForBatchAnalysis(
  leadId: string,
  messageId: string,
  cadence: "batch_hourly" | "batch_2x_daily"
): Promise<void> {
  const supabase = getSupabaseServer();
  
  const { error } = await (supabase.from("messages") as any)
    .update({
      analysis_status: "queued",
      analysis_cadence: cadence,
      analysis_queued_at: new Date().toISOString(),
    })
    .eq("id", messageId);
  
  if (error) {
    console.error(`[QUEUE] Error enqueuing message ${messageId}:`, error);
  } else {
    console.log(`[QUEUE] Enqueued message ${messageId} for lead ${leadId} | cadence: ${cadence}`);
  }
}

export async function markAsSkipped(messageId: string, reason: string): Promise<void> {
  const supabase = getSupabaseServer();
  await (supabase.from("messages") as any)
    .update({
      analysis_status: "skipped",
      analysis_cadence: "skipped"
    })
    .eq("id", messageId);
  
  console.log(`[GOVERNANCE] Analysis skipped for message ${messageId}: ${reason}`);
}
