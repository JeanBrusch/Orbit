"use client";

import { useState, useEffect, useCallback } from "react";
import { Inbox, Check, X, UserPlus, ShieldAlert, MessageSquare, Loader2, Ban } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";

interface PendingLead {
  id: string;
  name: string;
  phone: string | null;
  photo_url: string | null;
  last_message: string | null;
  created_at: string;
}

// FIX: aceita badgeCount externo do TopBar (via Realtime) para sincronizar o badge
interface WhatsAppInboxProps {
  externalCount?: number;
}

export function WhatsAppInbox({ externalCount }: WhatsAppInboxProps) {
  const [pendingLeads, setPendingLeads] = useState<PendingLead[]>([]);
  const [badgeCount, setBadgeCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const fetchPending = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from("leads")
        .select(`
          id, 
          name, 
          phone, 
          photo_url, 
          created_at,
          messages (content, timestamp)
        `)
        .eq("state", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const formatted = (data || []).map((l: any) => ({
        id: l.id,
        name: l.name,
        phone: l.phone,
        photo_url: l.photo_url,
        last_message: l.messages?.sort((a: any, b: any) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        )[0]?.content || "Nova conversa",
        created_at: l.created_at,
      }));

      setPendingLeads(formatted);
      // FIX: atualiza badge com a contagem real da query
      setBadgeCount(formatted.length);
    } catch (err) {
      console.error("Error fetching pending leads:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // FIX: busca inicial ao montar (não só ao abrir)
  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  // FIX: Supabase Realtime — escuta INSERT/UPDATE na tabela leads
  useEffect(() => {
    const supabase = getSupabase();

    const channel = supabase
      .channel("leads-pending-realtime")
      .on(
        "postgres_changes",
        {
          event: "*", // INSERT e UPDATE
          schema: "public",
          table: "leads",
        },
        (payload) => {
          const record = payload.new as any;
          // Se um lead mudou para pending (novo contato chegou) → recarrega
          if (record?.state === "pending") {
            fetchPending();
          }
          // Se um lead saiu de pending (aprovado/bloqueado) → recarrega
          if (payload.eventType === "UPDATE") {
            const old = payload.old as any;
            if (old?.state === "pending" && record?.state !== "pending") {
              fetchPending();
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchPending]);

  // FIX: polling de segurança a cada 30s (fallback caso Realtime falhe)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchPending();
    }, 30_000);
    return () => clearInterval(interval);
  }, [fetchPending]);

  // Sincroniza com contagem externa se fornecida (do TopBar)
  useEffect(() => {
    if (externalCount !== undefined) {
      setBadgeCount(externalCount);
    }
  }, [externalCount]);

  // Ao abrir, sempre recarrega para garantir dados frescos
  useEffect(() => {
    if (isOpen) fetchPending();
  }, [isOpen, fetchPending]);

  const handleAction = async (leadId: string, newState: "approved" | "ignored" | "blocked") => {
    try {
      const supabase = getSupabase();
      const { error } = await supabase
        .from("leads")
        .update({ state: newState } as any)
        .eq("id", leadId);

      if (error) throw error;

      let title = "";
      let description = "";

      if (newState === "approved") {
        title = "Lead Aprovado!";
        description = "O contato agora faz parte do Orbit e será analisado.";
      } else if (newState === "ignored") {
        title = "Lead Ignorado";
        description = "O contato foi movido para a lista de ignorados.";
      } else if (newState === "blocked") {
        title = "Lead Bloqueado";
        description = "O contato não aparecerá mais na triagem ao enviar mensagens.";
      }

      toast({ title, description });

      if (newState === "approved") {
        fetch(`/api/leads/${leadId}/analyze`, { method: "POST" }).catch(() => {});
      }

      // Remove da lista local imediatamente (Realtime também vai atualizar)
      setPendingLeads((prev) => prev.filter((p) => p.id !== leadId));
      setBadgeCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      toast({ title: "Erro na ação", variant: "destructive" });
    }
  };

  const displayCount = externalCount !== undefined ? externalCount : badgeCount;

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative hover:bg-[var(--orbit-glow)]/10 text-[var(--orbit-text-muted)] hover:text-[var(--orbit-text)]"
        >
          <Inbox className="h-5 w-5" />
          {displayCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-lg animate-pulse">
              {displayCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-[400px] border-[var(--orbit-glass-border)] bg-[var(--orbit-bg)]/95 backdrop-blur-xl text-[var(--orbit-text)]"
      >
        <SheetHeader className="pb-6 border-b border-[var(--orbit-glass-border)]">
          <SheetTitle className="text-xl font-light tracking-tight flex items-center gap-2">
            <Inbox className="h-5 w-5 text-[var(--orbit-glow)]" />
            Triagem WhatsApp
          </SheetTitle>
          <SheetDescription className="text-[var(--orbit-text-muted)] text-xs">
            A IA está silenciada para estes contatos. Aprove-os para integrá-los ao Orbit.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-140px)] mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-[var(--orbit-text-muted)]" />
            </div>
          ) : pendingLeads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-[var(--orbit-text-muted)]">
              <Inbox className="h-10 w-10 opacity-20" />
              <p className="text-sm">Nenhum contato aguardando triagem</p>
            </div>
          ) : (
            <div className="space-y-3 pr-2">
              {pendingLeads.map((lead) => (
                <div
                  key={lead.id}
                  className="p-4 rounded-xl border border-[var(--orbit-glass-border)] bg-[var(--orbit-glass)] space-y-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full bg-[var(--orbit-glow)]/10 flex items-center justify-center shrink-0 overflow-hidden">
                      {lead.photo_url ? (
                        <img src={lead.photo_url} alt={lead.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xs font-medium text-[var(--orbit-glow)]">
                          {lead.name?.slice(0, 2).toUpperCase() || "??"}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--orbit-text)] truncate">{lead.name}</p>
                      <p className="text-xs text-[var(--orbit-text-muted)] truncate">{lead.phone || "Sem telefone"}</p>
                    </div>
                    <Badge variant="outline" className="text-[9px] shrink-0 border-amber-500/30 text-amber-400">
                      pendente
                    </Badge>
                  </div>

                  {lead.last_message && (
                    <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-[var(--orbit-bg)]/60">
                      <MessageSquare className="h-3.5 w-3.5 text-[var(--orbit-text-muted)] mt-0.5 shrink-0" />
                      <p className="text-xs text-[var(--orbit-text-muted)] line-clamp-2">{lead.last_message}</p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="flex-1 h-8 text-xs gap-1.5 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10"
                      onClick={() => handleAction(lead.id, "approved")}
                    >
                      <Check className="h-3.5 w-3.5" />
                      Aprovar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-xs gap-1.5 border border-[var(--orbit-glass-border)] text-[var(--orbit-text-muted)] hover:bg-[var(--orbit-glass)]"
                      onClick={() => handleAction(lead.id, "ignored")}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-xs gap-1.5 border border-rose-500/20 text-rose-400 hover:bg-rose-500/10"
                      onClick={() => handleAction(lead.id, "blocked")}
                    >
                      <Ban className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
