import { NextRequest, NextResponse } from "next/server"
import { runOutcomeEvaluation } from "@/lib/orbit-outcome-evaluator"

// Proteção simples via CRON_SECRET — configure no .env e nas variáveis de ambiente Vercel
export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret")
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const result = await runOutcomeEvaluation()
  return NextResponse.json({ ok: true, ...result })
}
