import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { generateEmbedding, processEventWithCore } from "@/lib/orbit-core";

// generateEmbedding is now imported from @/lib/orbit-core

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { leadId, content, capsuleId } = body;

    if (!leadId || typeof leadId !== "string") {
      return NextResponse.json(
        { error: "leadId é obrigatório" },
        { status: 400 },
      );
    }

    if (!content || typeof content !== "string" || content.trim() === "") {
      return NextResponse.json(
        { error: "content é obrigatório" },
        { status: 400 },
      );
    }

    const supabase = getSupabaseServer();
    const trimmedContent = content.trim();

    // 1. Save to internal_notes (original behavior)
    const { data: note, error: noteError } = await supabase
      .from("internal_notes")
      .insert({
        lead_id: leadId,
        content: trimmedContent,
      })
      .select()
      .single();

    if (noteError) {
      console.error("Error inserting note:", noteError);
      return NextResponse.json(
        { error: "Erro ao salvar nota" },
        { status: 500 },
      );
    }

    let capsuleItemId: string | null = null;
    let embeddingCreated = false;

    // 2. If capsuleId provided, create capsule_item
    if (capsuleId) {
      const { data: capsuleItem, error: capsuleError } = await supabase
        .from("capsule_items")
        .insert({
          capsule_id: capsuleId,
          type: "note",
          content: trimmedContent,
        })
        .select()
        .single();

      if (capsuleError) {
        console.error("Error inserting capsule_item:", capsuleError);
        // Don't fail the request - note was saved successfully
      } else {
        capsuleItemId = capsuleItem.id;

        // 3. Generate embedding (non-blocking, graceful failure)
        const embedding = await generateEmbedding(trimmedContent);

        if (embedding && capsuleItemId) {
          const { error: embeddingError } = await supabase
            .from("capsule_embeddings")
            .insert({
              capsule_item_id: capsuleItemId,
              embedding,
              model: "text-embedding-3-small",
            });

          if (embeddingError) {
            console.error("Error saving embedding:", embeddingError);
          } else {
            embeddingCreated = true;
            console.log("[EMBEDDING] Created for capsule_item:", capsuleItemId);
          }
        }
      }
    }

    return NextResponse.json(
      {
        ...note,
        capsuleItemId,
        embeddingCreated,
      },
      { status: 201 },
    );
    // Dispara o Orbit Core (não bloqueia a resposta)
    processEventWithCore(leadId, trimmedContent, "note").catch(() => {});
  } catch (err) {
    console.error("Error in POST /api/note:", err);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      leadId,
      content,
      capsuleId,
      capsuleItemId: existingCapsuleItemId,
    } = body;

    if (!leadId || typeof leadId !== "string") {
      return NextResponse.json(
        { error: "leadId é obrigatório" },
        { status: 400 },
      );
    }

    const supabase = getSupabaseServer();
    const trimmedContent = content?.trim() || "";

    // Find existing note
    const { data: existing } = await supabase
      .from("internal_notes")
      .select("id, content")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    let note;
    const contentChanged = existing
      ? existing.content !== trimmedContent
      : true;

    if (existing) {
      const { data, error } = await supabase
        .from("internal_notes")
        .update({ content: trimmedContent })
        .eq("id", existing.id)
        .select()
        .single();

      if (error) {
        console.error("Error updating note:", error);
        return NextResponse.json(
          { error: "Erro ao atualizar nota" },
          { status: 500 },
        );
      }
      note = data;
    } else {
      const { data, error } = await supabase
        .from("internal_notes")
        .insert({
          lead_id: leadId,
          content: trimmedContent,
        })
        .select()
        .single();

      if (error) {
        console.error("Error inserting note:", error);
        return NextResponse.json(
          { error: "Erro ao salvar nota" },
          { status: 500 },
        );
      }
      note = data;
    }

    let capsuleItemId = existingCapsuleItemId || null;
    let embeddingCreated = false;

    // Update or create capsule_item if capsuleId provided and content changed
    if (capsuleId && contentChanged && trimmedContent) {
      if (existingCapsuleItemId) {
        // Update existing capsule_item
        const { error: updateError } = await supabase
          .from("capsule_items")
          .update({ content: trimmedContent })
          .eq("id", existingCapsuleItemId);

        if (updateError) {
          console.error("Error updating capsule_item:", updateError);
        } else {
          // Delete old embedding and create new one
          await supabase
            .from("capsule_embeddings")
            .delete()
            .eq("capsule_item_id", existingCapsuleItemId);

          const embedding = await generateEmbedding(trimmedContent);
          if (embedding) {
            const { error: embeddingError } = await supabase
              .from("capsule_embeddings")
              .insert({
                capsule_item_id: existingCapsuleItemId,
                embedding,
                model: "text-embedding-3-small",
              });

            if (!embeddingError) {
              embeddingCreated = true;
              console.log(
                "[EMBEDDING] Updated for capsule_item:",
                existingCapsuleItemId,
              );
            }
          }
        }
      } else {
        // Create new capsule_item
        const { data: capsuleItem, error: capsuleError } = await supabase
          .from("capsule_items")
          .insert({
            capsule_id: capsuleId,
            type: "note",
            content: trimmedContent,
          })
          .select()
          .single();

        if (!capsuleError && capsuleItem) {
          capsuleItemId = capsuleItem.id;

          const embedding = await generateEmbedding(trimmedContent);
          if (embedding) {
            const { error: embeddingError } = await supabase
              .from("capsule_embeddings")
              .insert({
                capsule_item_id: capsuleItemId,
                embedding,
                model: "text-embedding-3-small",
              });

            if (!embeddingError) {
              embeddingCreated = true;
              console.log(
                "[EMBEDDING] Created for capsule_item:",
                capsuleItemId,
              );
            }
          }
        }
      }
    }

    // Dispara o Orbit Core (não bloqueia a resposta)
    if (contentChanged) {
      processEventWithCore(leadId, trimmedContent, "note").catch(() => {});
    }

    return NextResponse.json(
      {
        success: true,
        noteId: note.id,
        capsuleItemId: capsuleItemId || null,
        embeddingCreated,
      },
      { status: existing ? 200 : 201 },
    );
  } catch (err) {
    console.error("Error in PUT /api/note:", err);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 },
    );
  }
}
