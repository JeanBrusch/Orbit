"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { 
  Users, 
  MapPin, 
  Moon, 
  Sun, 
  LogOut, 
  Activity,
  CircleDot,
  UserPlus,
  Columns,
  Zap,
  GitBranch
} from "lucide-react";
import { WhatsAppInbox } from "./whatsapp-inbox";
import { Button } from "./ui/button";
import Link from "next/link";
import { BottomNav } from "./bottom-nav";
import { getSupabase } from "@/lib/supabase";
import { useOrbitContext } from "./orbit-context";

interface TopBarProps {
  totalLeads: number;
  isDark: boolean;
  onThemeToggle: () => void;
  onLogout: () => void;
}

export function TopBar({ totalLeads, isDark, onThemeToggle, onLogout }: TopBarProps) {
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const context = useOrbitContext();
  
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !context) return null;

  const { 
    setIsAdminDrawerOpen, 
    setActiveAdminView,
    pendingLeadsCount,
  } = context;

  const handleNewLead = () => {
    setActiveAdminView("lead");
    setIsAdminDrawerOpen(true);
  };

  return (
    <>
    <div className="fixed top-0 left-0 right-0 z-[100] px-4 md:px-6 py-1.5 md:py-2 flex items-center justify-between pointer-events-none">
      {/* LEFT: System Identity */}
      <div className="flex items-center gap-3 pointer-events-auto">
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-[var(--orbit-glass)] border border-[var(--orbit-line)] backdrop-blur-md">
          <CircleDot className="h-2.5 w-2.5 text-[var(--orbit-glow)]" />
          <span className="text-[9px] font-display font-bold tracking-[0.12em] text-[var(--orbit-text)] uppercase hidden sm:inline">Orbit</span>
        </div>
      </div>

      {/* RIGHT: Actions Toolset */}
      <div className="flex items-center gap-1.5 md:gap-2 pointer-events-auto">
        <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-[var(--orbit-glass)] border border-[var(--orbit-line)] backdrop-blur-md shadow-[var(--orbit-shadow)]">

          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleNewLead}
            className="flex items-center gap-1.5 px-2 md:px-3 py-1 h-7 rounded-md hover:bg-[var(--orbit-glow)]/10 text-[var(--orbit-text-muted)] hover:text-[var(--orbit-text)] transition-all duration-300 text-[9px] font-medium"
          >
            <UserPlus className="h-3 w-3" />
            <span className="hidden sm:inline">Novo Lead</span>
          </Button>

          <div className="w-px h-3 bg-[var(--orbit-glass-border)] mx-0.5" />

          {/* WhatsAppInbox recebe o count do Contexto via TopBar ou direto */}
          <WhatsAppInbox externalCount={pendingLeadsCount} />
          
          <div className="w-px h-3 bg-[var(--orbit-glass-border)] mx-0.5 hidden sm:block" />
          
          <Link
            href="/pipeline"
            className="hidden md:flex items-center gap-1.5 px-2 md:px-3 py-1 h-7 rounded-md hover:bg-[var(--orbit-glow)]/10 text-[var(--orbit-text-muted)] hover:text-[var(--orbit-text)] transition-all duration-300 text-[9px] font-medium"
            title="Pipeline de Leads"
          >
            <Columns className="h-3 w-3" />
            <span className="hidden sm:inline">Pipeline</span>
          </Link>

          <Link
            href="/telemetry"
            className="hidden md:flex items-center gap-1.5 px-3 py-1 h-7 rounded-md hover:bg-[var(--orbit-glow)]/10 text-[var(--orbit-text-muted)] hover:text-[var(--orbit-text)] transition-all duration-300 text-[9px] font-medium"
            title="Telemetria do Operador"
          >
            <Activity className="h-3 w-3" />
            <span className="hidden sm:inline">Telemetria</span>
          </Link>

          <Link
            href="/silence"
            className="hidden md:flex items-center gap-1.5 px-2 md:px-3 py-1 h-7 rounded-md hover:bg-rose-500/10 text-rose-500/60 hover:text-rose-400 transition-all duration-300 text-[9px] font-medium"
            title="Análise de Silêncio"
          >
            <Zap className="h-3 w-3" />
            <span className="hidden sm:inline">Silêncio</span>
          </Link>

          <Link
            href="/atlas"
            className={`hidden md:flex items-center gap-1.5 px-2 md:px-3 py-1 h-7 rounded-md transition-all duration-300 text-[9px] font-medium ${
              pathname === '/atlas' 
                ? 'bg-[var(--orbit-glow)] text-white shadow-sm' 
                : 'hover:bg-[var(--orbit-glow)]/10 text-[var(--orbit-text-muted)] hover:text-[var(--orbit-text)]'
            }`}
            title="Mapa Atlas"
          >
            <MapPin className="h-3 w-3" />
            <span className="hidden sm:inline">Atlas</span>
          </Link>

          <Link
            href="/observability"
            className="hidden md:flex items-center gap-1.5 px-2 md:px-3 py-1 h-7 rounded-md hover:bg-[var(--orbit-glow)]/10 text-[var(--orbit-text-muted)] hover:text-[var(--orbit-text)] transition-all duration-300 text-[9px] font-medium"
            title="Observabilidade & Data Lineage"
          >
            <GitBranch className="h-3 w-3" />
            <span className="hidden sm:inline">Trace</span>
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
            className="h-7 w-7 hover:bg-[var(--orbit-glow)]/10 text-[var(--orbit-text-muted)] hover:text-[var(--orbit-text)] transition-all flex items-center justify-center p-0 cursor-pointer"
          >
            {mounted && isDark
              ? <Sun className="h-3.5 w-3.5 text-[var(--orbit-accent)]" />
              : <Moon className="h-3.5 w-3.5 text-[var(--orbit-glow)]" />
            }
          </Button>

          <div className="w-px h-3 bg-[var(--orbit-glass-border)] mx-0.5 hidden md:block" />

          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onLogout}
            className="hidden md:flex h-7 pr-3 pl-2.5 gap-2 hover:bg-rose-500/10 text-[var(--orbit-text-muted)] hover:text-rose-400 transition-all text-[9px] font-medium"
          >
            <LogOut className="h-3 w-3" />
            Sair
          </Button>
        </div>
      </div>
    </div>
    <BottomNav />
    </>
  );
}
