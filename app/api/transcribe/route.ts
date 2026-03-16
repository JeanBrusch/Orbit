import { NextRequest, NextResponse } from "next/server";
import { processEventWithCore } from "@/lib/orbit-core";
import { getSupabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get("audio") as File | null;
    const leadId = formData.get("leadId") as string | null;
    const language = (formData.get("language") as string) || "pt";

    if (!audioFile) {
      return NextResponse.json({ error: "Arquivo de áudio é obrigatório" }, { status: 400 });
    }

    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return NextResponse.json({ error: "OPENAI_API_KEY não configurada" }, { status: 500 });
    }

    // ── 1. Transcrição via Whisper ──────────────────────────────────────────
    const whisperForm = new FormData();
    whisperForm.append("file", audioFile, audioFile.name || "audio.webm");
    whisperForm.append("model", "whisper-1");
    whisperForm.append("language", language);
    whisperForm.append("response_format", "json");

    const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiApiKey}` },
      body: whisperForm,
    });

    if (!whisperRes.ok) {
      const err = await whisperRes.json().catch(() => ({}));
      console.error("[TRANSCRIBE] Whisper error:", err);
      return NextResponse.json({ error: "Falha na transcrição do áudio" }, { status: 502 });
    }

    const whisperData = await whisperRes.json();
    const transcript: string = whisperData.text?.trim() || "";

    if (!transcript) {
      return NextResponse.json({ error: "Transcrição vazia", transcript: "" }, { status: 200 });
    }

    // ── 2. Análise via GPT-4o-mini ──────────────────────────────────────────
    const analysisRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.2,
        max_tokens: 400,
        messages: [
          {
            role: "system",
            content: `Você é um assistente de CRM especializado em imóveis de alto padrão. 
Analise o trecho de áudio transcrito abaixo (pode ser uma ligação, reunião ou nota de voz do gestor).
Extraia informações valiosas e responda em JSON com exatamente estas chaves:
- "sentiment": "positive" | "neutral" | "negative"
- "intention": string (resumo em até 8 palavras do que o lead deseja/disse)
- "urgency": número de 0 a 100 indicando urgência
- "signals": array de até 3 strings com sinais detectados (ex: "interesse em apartamento", "objeção de preço")
- "suggested_action": string com a ação recomendada para o gestor (1 frase)
- "summary": string com resumo da conversa em até 3 frases

Responda SOMENTE com o JSON, sem markdown.`,
          },
          {
            role: "user",
            content: `Transcrição: "${transcript}"`,
          },
        ],
      }),
    });

    let analysis: Record<string, unknown> = {};
    if (analysisRes.ok) {
      const analysisData = await analysisRes.json();
      const rawContent = analysisData.choices?.[0]?.message?.content || "{}";
      try {
        analysis = JSON.parse(rawContent);
      } catch {
        analysis = { summary: rawContent };
      }
    }

    // ── 3. Salvar no banco como mensagem interna (se leadId fornecido) ───────
    if (leadId) {
      const supabase = getSupabaseServer();
      const content = JSON.stringify({
        type: "audio_transcript",
        transcript,
        analysis,
        timestamp: new Date().toISOString(),
      });

      await (supabase.from("messages") as any).insert({
        lead_id: leadId,
        source: "operator",
        content,
        timestamp: new Date().toISOString(),
        ai_analysis: analysis,
      });

      // Dispara o Orbit Core para atualizar memória e scores
      processEventWithCore(leadId, `[Transcrição de áudio] ${transcript}`, "note").catch(() => {});
    }

    return NextResponse.json({ transcript, analysis }, { status: 200 });
  } catch (err) {
    console.error("[TRANSCRIBE] Error:", err);
    return NextResponse.json({ error: "Erro interno no servidor" }, { status: 500 });
  }
}
