"use client";

import { useState, useEffect, useRef } from "react";
import { 
  Users, 
  MapPin, 
  Moon, 
  Sun, 
  LogOut, 
  Activity,
  CircleDot,
  UserPlus,
  Columns
} from "lucide-react";
import { WhatsAppInbox } from "./whatsapp-inbox";
import { Button } from "./ui/button";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { useOrbitContext } from "./orbit-context";

interface TopBarProps {
  totalLeads: number;
  isDark: boolean;
  onThemeToggle: () => void;
  onLogout: () => void;
}

export function TopBar({ totalLeads, isDark, onThemeToggle, onLogout }: TopBarProps) {
  const { 
    setIsAdminDrawerOpen, 
    setActiveAdminView,
    pendingLeadsCount,
  } = useOrbitContext();

  const handleNewLead = () => {
    setActiveAdminView("lead");
    setIsAdminDrawerOpen(true);
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] px-4 md:px-6 py-3 md:py-4 flex items-center justify-between pointer-events-none">
      {/* LEFT: System Identity */}
      <div className="flex items-center gap-4 pointer-events-auto">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--orbit-glass)] border border-[var(--orbit-line)] backdrop-blur-md">
          <CircleDot className="h-3.5 w-3.5 text-[var(--orbit-glow)]" />
          <span className="text-[11px] font-display font-bold tracking-[0.08em] text-[var(--orbit-text)] uppercase hidden sm:inline">Orbit</span>
        </div>
      </div>

      {/* CENTER: Cognitive Metrics (Hidden on Mobile) */}
      <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 items-center gap-8 px-8 py-2 rounded-full bg-[var(--orbit-glass)] border border-[var(--orbit-line)] backdrop-blur-lg">
        <div className="flex items-center gap-2.5">
          <Users className="h-3.5 w-3.5 text-[var(--orbit-text-muted)]" />
          <div className="flex flex-col">
            <span className="text-[13px] font-display font-medium text-[var(--orbit-text)] leading-none">{totalLeads}</span>
            <span className="text-[8px] uppercase tracking-tighter text-[var(--orbit-text-muted)] font-sans">Leads no Campo</span>
          </div>
        </div>

        <div className="h-4 w-px bg-[var(--orbit-line)]" />

        <div className="flex items-center gap-2.5">
          <Activity className="h-3.5 w-3.5 text-[var(--orbit-text-muted)]" />
          <div className="flex flex-col">
            <span className="text-[13px] font-display font-medium text-[var(--orbit-text)] leading-none">
              {totalLeads > 10 ? "Alta" : "Estável"}
            </span>
            <span className="text-[8px] uppercase tracking-tighter text-[var(--orbit-text-muted)] font-sans">Carga Mental</span>
          </div>
        </div>
      </div>

      {/* RIGHT: Actions Toolset */}
      <div className="flex items-center gap-1.5 md:gap-2 pointer-events-auto">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--orbit-glass)] border border-[var(--orbit-line)] backdrop-blur-md shadow-[var(--orbit-shadow)]">

          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleNewLead}
            className="flex items-center gap-1.5 px-2 md:px-3 py-1.5 h-8 rounded-lg hover:bg-[var(--orbit-glow)]/10 text-[var(--orbit-text-muted)] hover:text-[var(--orbit-text)] transition-all duration-300 text-[10px] font-medium"
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Novo Lead</span>
          </Button>

          <div className="w-px h-4 bg-[var(--orbit-glass-border)] mx-0.5 md:mx-1" />

          {/* WhatsAppInbox recebe o count do Contexto via TopBar ou direto */}
          <WhatsAppInbox externalCount={pendingLeadsCount} />
          
          <div className="w-px h-4 bg-[var(--orbit-glass-border)] mx-0.5 md:mx-1 hidden sm:block" />
          
          <Link
            href="/pipeline"
            className="flex items-center gap-1.5 px-2 md:px-3 py-1.5 rounded-lg hover:bg-[var(--orbit-glow)]/10 text-[var(--orbit-text-muted)] hover:text-[var(--orbit-text)] transition-all duration-300 text-[10px] font-medium"
            title="Pipeline de Leads"
          >
            <Columns className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Pipeline</span>
          </Link>

          <Link
            href="/telemetry"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-[var(--orbit-glow)]/10 text-[var(--orbit-text-muted)] hover:text-[var(--orbit-text)] transition-all duration-300 text-[10px] font-medium"
            title="Telemetria do Operador"
          >
            <Activity className="h-3.5 w-3.5" />
            Telemetria
          </Link>

          <Link
            href="/atlas"
            className="flex items-center gap-1.5 px-2 md:px-3 py-1.5 rounded-lg hover:bg-[var(--orbit-glow)]/10 text-[var(--orbit-text-muted)] hover:text-[var(--orbit-text)] transition-all duration-300 text-[10px] font-medium"
            title="Mapa Atlas"
          >
            <MapPin className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Atlas</span>
          </Link>

          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => {
              const html = document.documentElement;
              const isCurrentlyDark = html.classList.contains('dark');
              const nextTheme = isCurrentlyDark ? 'light' : 'dark';
              
              html.classList.remove('dark', 'light');
              html.classList.add(nextTheme);
              localStorage.setItem('orbit-theme', nextTheme);
              onThemeToggle(); // Mantém o callback se necessário, mas a lógica agora é explícita aqui
            }}
            className="h-8 w-8 hover:bg-[var(--orbit-glow)]/10 text-[var(--orbit-text-muted)] hover:text-[var(--orbit-text)] transition-all"
          >
            {isDark
              ? <Sun className="h-4 w-4 text-[#d97706]" />
              : <Moon className="h-4 w-4 text-[#4f46e5]" />
            }
          </Button>

          <div className="w-px h-4 bg-[var(--orbit-glass-border)] mx-0.5 md:mx-1 hidden md:block" />

          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onLogout}
            className="hidden md:flex h-8 pr-3 pl-2.5 gap-2 hover:bg-rose-500/10 text-[var(--orbit-text-muted)] hover:text-rose-400 transition-all text-[10px] font-medium"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sair
          </Button>
        </div>
      </div>
    </div>
  );
}
