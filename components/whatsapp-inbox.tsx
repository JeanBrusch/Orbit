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
      // Buscamos leads pendentes e sua última mensagem
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
        created_at: l.created_at
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

  const handleAction = async (leadId: string, newState: 'approved' | 'ignored' | 'blocked') => {
    try {
      const supabase = getSupabase();
      const { error } = await (supabase.from("leads") as any)
        .update({ state: newState })
        .eq("id", leadId);

      if (error) throw error;

      let title = "";
      let description = "";

      if (newState === 'approved') {
        title = "Lead Aprovado!";
        description = "O contato agora faz parte do Orbit e será analisado.";
      } else if (newState === 'ignored') {
        title = "Lead Ignorado";
        description = "O contato foi movido para a lista de ignorados.";
      } else if (newState === 'blocked') {
        title = "Lead Bloqueado";
        description = "O contato não aparecerá mais na triagem ao enviar mensagens.";
      }

      toast({
        title,
        description,
      });

      // Se aprovado, disparamos a análise inicial via API (opcional se o webhook já tratar isso no futuro, 
      // mas aqui garantimos que a aprovação "acorda" a IA para as mensagens retroativas)
      if (newState === 'approved') {
        fetch(`/api/leads/${leadId}/analyze`, { method: 'POST' }).catch(() => { });
      }

      // Remove da lista local imediatamente (Realtime também vai atualizar)
      setPendingLeads(prev => prev.filter(p => p.id !== leadId));
      setBadgeCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      toast({
        title: "Erro na ação",
        variant: "destructive",
      });
    }
  };

  const displayCount = externalCount !== undefined ? externalCount : badgeCount;

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative hover:bg-[var(--orbit-glow)]/10 text-[var(--orbit-text-muted)] hover:text-[var(--orbit-text)]">
          <Inbox className="h-5 w-5" />
          {displayCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-lg animate-pulse">
              {displayCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[400px] border-[var(--orbit-glass-border)] bg-[var(--orbit-bg)]/95 backdrop-blur-xl text-[var(--orbit-text)]">
        <SheetHeader className="pb-6 border-b border-[var(--orbit-glass-border)]">
          <SheetTitle className="text-xl font-light tracking-tight flex items-center gap-2">
            <Inbox className="h-5 w-5 text-[var(--orbit-glow)]" />
            Triagem WhatsApp
          </SheetTitle>
          <SheetDescription className="text-[var(--orbit-text-muted)] text-xs">
            A IA está silenciada para estes contatos. Aprove-os para integrá-los ao Orbit.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-180px)] mt-4 pr-4">
          <div className="space-y-4">
            {loading && (
              <div className="flex flex-col items-center justify-center py-20 gap-3 text-[var(--orbit-text-muted)]">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="text-xs uppercase tracking-widest">Sincronizando...</span>
              </div>
            )}

            {!loading && pendingLeads.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 gap-4 text-center opacity-30">
                <div className="p-4 rounded-full bg-[var(--orbit-glow)]/5">
                  <MessageSquare className="h-8 w-8 text-[var(--orbit-text-muted)]" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-[var(--orbit-text)]">Nenhuma mensagem nova</p>
                  <p className="text-xs text-[var(--orbit-text-muted)]">Tudo limpo no Inbox.</p>
                </div>
              </div>
            )}

            {pendingLeads.map((lead) => (
              <div 
                key={lead.id} 
                className="group relative p-4 rounded-xl border border-[var(--orbit-glass-border)] bg-[var(--orbit-glass)] hover:bg-[var(--orbit-glow)]/5 transition-all duration-300"
              >
                <div className="flex gap-4">
                  <div className="h-10 w-10 rounded-full bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30 overflow-hidden shrink-0">
                    {lead.photo_url ? (
                      <img src={lead.photo_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-xs font-bold text-indigo-300">
                        {lead.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-sm font-medium truncate pr-2 text-[var(--orbit-text)]">{lead.name}</h4>
                      <span className="text-[10px] text-[var(--orbit-text-muted)] whitespace-nowrap">
                        {new Date(lead.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--orbit-text-muted)] line-clamp-2 leading-relaxed mb-4 italic">
                      "{lead.last_message}"
                    </p>
                    
                    <div className="flex items-center gap-2">
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => handleAction(lead.id, 'approved')}
                        className="h-8 flex-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-[11px] gap-1.5"
                      >
                        <UserPlus className="h-3 w-3" />
                        Cliente
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => handleAction(lead.id, 'ignored')}
                        className="h-8 flex-1 bg-[var(--orbit-glass-border)] hover:bg-[var(--orbit-glow)]/10 text-[var(--orbit-text-muted)] hover:text-[var(--orbit-text)] border border-[var(--orbit-glass-border)] text-[11px] gap-1.5"
                      >
                        <ShieldAlert className="h-3 w-3" />
                        Ignorar
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => handleAction(lead.id, 'blocked')}
                        className="h-8 flex-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-[11px] gap-1.5"
                      >
                        <Ban className="h-3 w-3" />
                        Bloquear
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet >
  );
}
