"use client";

import { useState, useEffect } from "react";
import { 
  Wifi, 
  WifiOff, 
  Users, 
  Inbox, 
  MapPin, 
  Moon, 
  Sun, 
  LogOut, 
  Activity,
  CircleDot
} from "lucide-react";
import { WhatsAppInbox } from "./whatsapp-inbox";
import { ThemeToggle } from "./theme-toggle";
import { Button } from "./ui/button";
import { getSupabase } from "@/lib/supabase";
import Link from "next/link";

interface TopBarProps {
  totalLeads: number;
  isDark: boolean;
  onThemeToggle: () => void;
  onLogout: () => void;
}

export function TopBar({ totalLeads, isDark, onThemeToggle, onLogout }: TopBarProps) {
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const supabase = getSupabase();

    // FIX 1: Supabase Realtime para atualizar badge instantaneamente
    const fetchCount = async () => {
      try {
        const { count } = await supabase
          .from("leads")
          .select("*", { count: "exact", head: true })
          .eq("state", "pending");
        setPendingCount(count || 0);
      } catch {}
    };

    fetchCount();

    // Realtime: escuta qualquer mudança em leads
    const channel = supabase
      .channel("topbar-pending-count")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leads" },
        () => {
          // Re-conta sempre que qualquer lead mudar
          fetchCount();
        }
      )
      .subscribe();

    // FIX 2: polling de segurança a cada 30s (fallback caso Realtime falhe)
    const interval = setInterval(fetchCount, 30_000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] px-6 py-4 flex items-center justify-between pointer-events-none">
      {/* LEFT: System Identity & WA Status */}
      <div className="flex items-center gap-4 pointer-events-auto">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--orbit-glass)] border border-[var(--orbit-glass-border)] backdrop-blur-md">
          <CircleDot className="h-3.5 w-3.5 text-indigo-500 animate-pulse" />
          <span className="text-[10px] font-bold tracking-[0.2em] text-[var(--orbit-text)] uppercase">Orbit Core</span>
        </div>

      </div>

      {/* CENTER: Cognitive Metrics */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-8 px-8 py-2 rounded-full bg-[var(--orbit-glass)] border border-[var(--orbit-glass-border)] backdrop-blur-lg">
        <div className="flex items-center gap-2.5">
          <Users className="h-3.5 w-3.5 text-[var(--orbit-text-muted)]" />
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-[var(--orbit-text)] leading-none">{totalLeads}</span>
            <span className="text-[8px] uppercase tracking-tighter text-[var(--orbit-text-muted)]">Leads no Campo</span>
          </div>
        </div>

        <div className="h-4 w-px bg-white/10" />

        <div className="flex items-center gap-2.5">
          <Activity className="h-3.5 w-3.5 text-[var(--orbit-text-muted)]" />
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-[var(--orbit-text)] leading-none">
              {totalLeads > 10 ? 'Alta' : 'Estável'}
            </span>
            <span className="text-[8px] uppercase tracking-tighter text-[var(--orbit-text-muted)]">Carga Mental</span>
          </div>
        </div>
      </div>

      {/* RIGHT: Actions Toolset */}
      <div className="flex items-center gap-2 pointer-events-auto">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--orbit-glass)] border border-[var(--orbit-glass-border)] backdrop-blur-md shadow-2xl">
          <WhatsAppInbox externalCount={pendingCount} />
          
          <div className="w-px h-4 bg-[var(--orbit-glass-border)] mx-1" />
          
          <Link
            href="/atlas"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-[var(--orbit-glow)]/10 text-[var(--orbit-text-muted)] hover:text-[var(--orbit-text)] transition-all duration-300 text-[10px] font-medium"
            title="Mapa Atlas"
          >
            <MapPin className="h-3.5 w-3.5" />
            Atlas
          </Link>

          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onThemeToggle}
            className="h-8 w-8 hover:bg-[var(--orbit-glow)]/10 text-[var(--orbit-text-muted)] hover:text-[var(--orbit-text)] transition-all"
          >
            {isDark ? <Sun className="h-4 w-4 text-[var(--orbit-accent)]" /> : <Moon className="h-4 w-4 text-[var(--orbit-glow)]" />}
          </Button>

          <div className="w-px h-4 bg-[var(--orbit-glass-border)] mx-1" />

          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onLogout}
            className="h-8 pr-3 pl-2.5 gap-2 hover:bg-rose-500/10 text-[var(--orbit-text-muted)] hover:text-rose-400 transition-all text-[10px] font-medium"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sair
          </Button>
        </div>
      </div>
    </div>
  );
}
