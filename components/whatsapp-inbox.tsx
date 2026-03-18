"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Inbox,
  Check,
  X,
  UserPlus,
  ShieldAlert,
  MessageSquare,
  Loader2,
  Ban,
  Bell,
} from "lucide-react";
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

interface WhatsAppInboxProps {
  /** Count vindo do TopBar (fonte única de verdade via Realtime) */
  externalCount?: number;
  /** Callback para o TopBar atualizar seu count quando inbox faz ação */
  onCountChange?: (count: number) => void;
}

export function WhatsAppInbox({ externalCount, onCountChange }: WhatsAppInboxProps) {
  const [pendingLeads, setPendingLeads] = useState<PendingLead[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // Badge count local — sincroniza com externalCount quando disponível
  const [badgeCount, setBadgeCount] = useState(externalCount ?? 0);
  const prevCountRef = useRef(externalCount ?? 0);
  const channelRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Notificação visual ao receber nova mensagem
  const triggerNewMessageAlert = useCallback(() => {
    toast({
      title: "📨 Nova mensagem no WhatsApp",
      description: "Um novo contato aguarda triagem no inbox.",
      duration: 5000,
    });

    // Toca som se disponível (silencioso em modo sem autoplay)
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio(
          "data:audio/wav;base64,UGRpZ2l0YWwgQXVkaW8gV2F2ZSBGaWxlCg=="
        );
        audioRef.current.volume = 0.3;
      }
      audioRef.current.play().catch(() => {});
    } catch {}
  }, []);

  const formatPreview = (content: string | null) => {
    if (!content) return "Nova conversa";
    try {
      if (content.startsWith("{")) {
        const parsed = JSON.parse(content);
        const types: Record<string, string> = {
          audio: "🎵 Áudio",
          image: "📷 Imagem",
          video: "🎥 Vídeo",
          document: "📄 Documento",
          sticker: "✨ Sticker"
        };
        return types[parsed.type] || "[Mídia]";
      }
    } catch {}
    return content;
  };

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
        last_message: formatPreview(
          l.messages
            ?.sort(
              (a: any, b: any) =>
                new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            )[0]?.content
        ),
        created_at: l.created_at,
      }));

      setPendingLeads(formatted);

      // Atualiza badge local e notifica TopBar
      const count = formatted.length;
      setBadgeCount(count);
      onCountChange?.(count);
    } catch (err) {
      console.error("Error fetching pending leads:", err);
    } finally {
      setLoading(false);
    }
  }, [onCountChange]);

  // Sinc badge com externalCount
  useEffect(() => {
    if (externalCount !== undefined) {
      // Se count mudou (especialmente se aumentou) → reload da lista
      if (externalCount !== prevCountRef.current) {
        if (externalCount > prevCountRef.current) {
          triggerNewMessageAlert();
        }
        fetchPending();
      }
      prevCountRef.current = externalCount;
      setBadgeCount(externalCount);
    }
  }, [externalCount, fetchPending, triggerNewMessageAlert]);

  // Notificação inicial
  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  // Quando abre o painel, sempre recarrega
  useEffect(() => {
    if (isOpen) fetchPending();
  }, [isOpen, fetchPending]);

  const handleAction = async (
    leadId: string,
    newState: "approved" | "ignored" | "blocked"
  ) => {
    // Optimistic update
    setPendingLeads((prev) => prev.filter((l) => l.id !== leadId));
    setBadgeCount((c) => Math.max(0, c - 1));
    onCountChange?.(Math.max(0, (externalCount || 0) - 1));

    try {
      const supabase = getSupabase();
      const { error } = await (supabase as any)
        .from("leads")
        .update({ state: newState })
        .eq("id", leadId);

      if (error) throw error;

      const toastConfigs: Record<string, { title: string; description: string }> = {
        approved: {
          title: "Lead Aprovado!",
          description: "O contato agora faz parte do Orbit e será analisado.",
        },
        ignored: {
          title: "Lead Ignorado",
          description: "O contato foi movido para a lista de ignorados.",
        },
        blocked: {
          title: "Lead Bloqueado",
          description: "O contato não aparecerá mais na triagem.",
        },
      };

      const config = toastConfigs[newState as keyof typeof toastConfigs];
      if (config) toast(config);
    } catch (err) {
      console.error("Error updating lead state:", err);
      // Reverte em caso de erro
      fetchPending();
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o lead. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <button className="relative flex h-8 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-medium text-[var(--orbit-text-muted)] transition-all hover:bg-[var(--orbit-glow)]/10 hover:text-[var(--orbit-text)]">
          <Inbox className="h-3.5 w-3.5" />
          <span>Inbox</span>
          {badgeCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-500 text-[9px] font-bold text-white shadow-[0_0_8px_rgba(99,102,241,0.6)] animate-pulse">
              {badgeCount > 9 ? "9+" : badgeCount}
            </span>
          )}
        </button>
      </SheetTrigger>

      <SheetContent
        side="right"
        className="w-[420px] border-l border-[var(--orbit-glass-border)] bg-[var(--orbit-bg)] p-0"
      >
        <SheetHeader className="border-b border-[var(--orbit-glass-border)] px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/20 border border-indigo-500/30">
                <Inbox className="h-4 w-4 text-indigo-400" />
              </div>
              <div>
                <SheetTitle className="text-sm font-semibold text-[var(--orbit-text)]">
                  WhatsApp Inbox
                </SheetTitle>
                <p className="text-[10px] text-[var(--orbit-text-muted)] mt-0.5">
                  {badgeCount > 0
                    ? `${badgeCount} aguardando triagem`
                    : "Sem pendências"}
                </p>
              </div>
            </div>
            {badgeCount > 0 && (
              <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30 text-[10px]">
                {badgeCount} novo{badgeCount !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>
          <SheetDescription className="text-xs text-[var(--orbit-text-muted)] mt-2">
            Contatos que chegaram via WhatsApp aguardam aprovação. Aprove-os para
            integrá-los ao Orbit.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-180px)] mt-4 pr-4 pl-6">
          <div className="space-y-4 pb-6">
            {loading && pendingLeads.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 gap-3 text-[var(--orbit-text-muted)]">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="text-xs uppercase tracking-widest">
                  Sincronizando...
                </span>
              </div>
            )}

            {!loading && pendingLeads.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 gap-4 text-center opacity-30">
                <div className="p-4 rounded-full bg-[var(--orbit-glow)]/5">
                  <MessageSquare className="h-8 w-8 text-[var(--orbit-text-muted)]" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-[var(--orbit-text)]">
                    Nenhuma mensagem nova
                  </p>
                  <p className="text-xs text-[var(--orbit-text-muted)]">
                    Tudo limpo no Inbox.
                  </p>
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
                      <img
                        src={lead.photo_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-xs font-bold text-indigo-300">
                        {lead.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()}
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-sm font-medium truncate pr-2 text-[var(--orbit-text)]">
                        {lead.name}
                      </h4>
                      <span className="text-[10px] text-[var(--orbit-text-muted)] whitespace-nowrap">
                        {new Date(lead.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    {lead.phone && (
                      <p className="text-[10px] text-[var(--orbit-text-muted)] mb-1 font-mono">
                        {lead.phone}
                      </p>
                    )}

                    <p className="text-xs text-[var(--orbit-text-muted)] line-clamp-2 leading-relaxed mb-4 italic">
                      "{lead.last_message}"
                    </p>

                    <div className="grid grid-cols-3 gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleAction(lead.id, "approved")}
                        className="h-8 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-[10px] gap-1 px-1"
                      >
                        <UserPlus className="h-3 w-3" />
                        Cliente
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleAction(lead.id, "ignored")}
                        className="h-8 bg-[var(--orbit-glass-border)] hover:bg-[var(--orbit-glow)]/10 text-[var(--orbit-text-muted)] hover:text-[var(--orbit-text)] border border-[var(--orbit-glass-border)] text-[10px] gap-1 px-1"
                      >
                        <ShieldAlert className="h-3 w-3" />
                        Ignorar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleAction(lead.id, "blocked")}
                        className="h-8 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-[10px] gap-1 px-1"
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
    </Sheet>
  );
}
