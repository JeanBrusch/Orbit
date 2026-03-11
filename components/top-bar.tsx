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
import Link from "next/link";

interface TopBarProps {
  totalLeads: number;
  isDark: boolean;
  onThemeToggle: () => void;
  onLogout: () => void;
}

export function TopBar({ totalLeads, isDark, onThemeToggle, onLogout }: TopBarProps) {
  const [wsStatus, setWsStatus] = useState<{ connected: boolean; loading: boolean }>({
    connected: false,
    loading: true
  });
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch("/api/zapi/status");
        const data = await res.json();
        setWsStatus({ connected: data.connected, loading: false });
      } catch {
        setWsStatus({ connected: false, loading: false });
      }
    };

    const fetchPending = async () => {
      try {
        const res = await fetch("/api/leads/pending-count");
        const data = await res.json();
        setPendingCount(data.count || 0);
      } catch {}
    };

    checkStatus();
    fetchPending();
    const interval = setInterval(() => {
      checkStatus();
      fetchPending();
    }, 30000); 
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] px-6 py-4 flex items-center justify-between pointer-events-none">
      {/* LEFT: System Identity & WA Status */}
      <div className="flex items-center gap-4 pointer-events-auto">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
          <CircleDot className="h-3.5 w-3.5 text-indigo-500 animate-pulse" />
          <span className="text-[10px] font-bold tracking-[0.2em] text-white/90 uppercase">Orbit Core</span>
        </div>

        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border backdrop-blur-md transition-all duration-500 ${
          wsStatus.connected 
            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
            : "bg-rose-500/10 border-rose-500/20 text-rose-400"
        }`}>
          {wsStatus.connected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
          <span className="text-[9px] font-bold uppercase tracking-wider">
            {wsStatus.loading ? "Sincronizando..." : wsStatus.connected ? "Z-API ON" : "Z-API OFF"}
          </span>
        </div>
      </div>

      {/* CENTER: Cognitive Metrics */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-8 px-8 py-2 rounded-full bg-white/[0.03] border border-white/5 backdrop-blur-lg">
        <div className="flex items-center gap-2.5">
          <Users className="h-3.5 w-3.5 text-white/40" />
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-white/90 leading-none">{totalLeads}</span>
            <span className="text-[8px] uppercase tracking-tighter text-white/30">Leads no Campo</span>
          </div>
        </div>

        <div className="h-4 w-px bg-white/10" />

        <div className="flex items-center gap-2.5">
          <Activity className="h-3.5 w-3.5 text-white/40" />
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-white/90 leading-none">
              {totalLeads > 10 ? 'Alta' : 'Estável'}
            </span>
            <span className="text-[8px] uppercase tracking-tighter text-white/30">Carga Mental</span>
          </div>
        </div>
      </div>

      {/* RIGHT: Actions Toolset */}
      <div className="flex items-center gap-2 pointer-events-auto">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md shadow-2xl">
          <WhatsAppInbox />
          
          <div className="w-px h-4 bg-white/10 mx-1" />
          
          <Link
            href="/atlas"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-white/5 text-white/60 hover:text-white transition-all duration-300 text-[10px] font-medium"
            title="Mapa Atlas"
          >
            <MapPin className="h-3.5 w-3.5" />
            Atlas
          </Link>

          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onThemeToggle}
            className="h-8 w-8 hover:bg-white/5 text-white/60 hover:text-white transition-all"
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          <div className="w-px h-4 bg-white/10 mx-1" />

          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onLogout}
            className="h-8 pr-3 pl-2.5 gap-2 hover:bg-rose-500/10 text-white/40 hover:text-rose-400 transition-all text-[10px] font-medium"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sair
          </Button>
        </div>
      </div>
    </div>
  );
}
