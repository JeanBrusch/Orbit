"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { OrbitCore } from "@/components/orbit-core";
import { LeadNodes } from "@/components/lead-nodes";
import { ParticleBackground } from "@/components/particle-background";
import { ThemeToggle } from "@/components/theme-toggle";
import { LeadCognitiveConsole } from "@/components/lead-cognitive-console";
import { OrbitProvider, useOrbitContext } from "@/components/orbit-context";
import { AdminTrigger } from "@/components/admin/admin-trigger";
import { useSupabaseLeads, type OrbitLead } from "@/hooks/use-supabase-data";
import { useAuth } from "@/hooks/use-auth";
import { TopBar } from "@/components/top-bar";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import * as d3 from "d3-zoom";
import { select } from "d3-selection";

export interface Lead {
  id: string;
  name: string;
  role: string;
  avatar: string;
  position: { top: string; left: string };
  badge?: "campaign" | "target" | "hot";
  badgeColor?: string;
  delay: number;
  emotionalState: "engaged" | "warm" | "neutral" | "cooling";
  keywords: string[];
}

export type CoreState = "idle" | "listening" | "processing" | "responding";

function OrbitInterfaceContent() {
  const [isDark, setIsDark] = useState(true);
  const [coreState, setCoreState] = useState<CoreState>("idle");
  const [highlightedLeads, setHighlightedLeads] = useState<string[]>([]);
  const [coreMessage, setCoreMessage] = useState<string>("Campo Cognitivo Ativo");


  const { user, isLoading: authLoading, isAuthenticated, logout } = useAuth();
  const { leads: supabaseLeads, loading, removeLead } = useSupabaseLeads();

  // ── Refs for the zoom layer (nodes only) ──────────────────────────────────
  const nodesContainerRef = useRef<HTMLDivElement>(null);
  const nodesLayerRef = useRef<HTMLDivElement>(null);

  const {
    selectedLeadId,
    isLeadPanelOpen,
    openLeadPanel,
    closeLeadPanel,
    initializeLeadStates,
    activateOrbitView,
    deactivateOrbitView,
  } = useOrbitContext();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      window.location.href = "/login";
    }
  }, [authLoading, isAuthenticated]);

  const activeLeadCount = supabaseLeads.length;

  useEffect(() => {
    if (supabaseLeads.length > 0 && !loading) {
      const leadsForInit = supabaseLeads.map((lead) => ({
        id: lead.id,
        orbit_stage: lead.orbitStage,
        orbit_visual_state: lead.orbitVisualState,
      }));
      initializeLeadStates(leadsForInit);
    }
  }, [supabaseLeads, loading, initializeLeadStates]);

  // ── D3 zoom applied ONLY to the nodesLayer ───────────────────────────────
  useEffect(() => {
    if (!nodesContainerRef.current || !nodesLayerRef.current) return;

    const isMobile = window.innerWidth < 768;

    const zoom = d3.zoom<HTMLDivElement, unknown>()
      .scaleExtent(isMobile ? [0.5, 1.2] : [0.8, 1.6])
      .filter((event) => {
        // Allow wheel zoom, allow drag only if not a button/interactive element
        if (event.type === "wheel") return !isMobile; // Disable trackpad zooming on mobile to prevent accidental scrolls
        if (event.type === "mousedown" || event.type === "touchstart") {
          const target = event.target as HTMLElement;
          // Se for scroll container do Lead Console, não previne o default
          if (target.closest('.overflow-y-auto')) return false;
          return !target.closest("button, a, input, [role='button']");
        }
        return true;
      })
      .on("zoom", (event) => {
        if (nodesLayerRef.current) {
          const { x, y, k } = event.transform;
          nodesLayerRef.current.style.transform = `translate(${x}px, ${y}px) scale(${k})`;
        }
      });

    select(nodesContainerRef.current).call(zoom);

    // On mobile, start zoomed out so all nodes fit on screen immediately
    const initialScale = isMobile ? 0.65 : 1;
    select(nodesContainerRef.current).call(
      zoom.transform,
      d3.zoomIdentity.scale(initialScale)
    );

    return () => {
      select(nodesContainerRef.current!).on(".zoom", null);
    };
  }, []);

  const toggleTheme = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle("dark");
  };

  const handleCoreActivate = useCallback(() => {
    if (coreState === "idle") {
      setCoreState("listening");
      setCoreMessage("O que você quer saber?");
    }
  }, [coreState]);

  const handleQuerySubmit = useCallback(
    async (query: string) => {
      setCoreState("processing");
      setCoreMessage("Analisando...");

      try {
        const resultsCount = await activateOrbitView(query);
        setCoreState("responding");

        if (resultsCount > 0) {
          setCoreMessage(
            `${resultsCount} lead${resultsCount > 1 ? "s" : ""} encontrado${resultsCount > 1 ? "s" : ""}`,
          );
        } else {
          setCoreMessage("Nenhum lead encontrado");
        }

        setTimeout(() => {
          setCoreState("idle");
          setCoreMessage("Campo Cognitivo Ativo");
        }, 5000); // Only resets the orb to idle, orbit view results remain active
      } catch (err) {
        console.error("Cognitive search error:", err);
        setCoreState("idle");
        setCoreMessage("Erro na busca cognitiva");
      }
    },
    [activateOrbitView],
  );

  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleCoreCancel = useCallback(() => {
    setCoreState("idle");
    setCoreMessage("Campo Cognitivo Ativo");
    setHighlightedLeads([]);
    deactivateOrbitView();
  }, [deactivateOrbitView]);

  if (!isMounted) return null;

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[var(--orbit-bg)]">
      {/* ── Layer 0: Particles (static, never zoomed) ─────────────────────── */}
      <ParticleBackground />

      {/* ── Layer 2: Top Command Center ────────────────────────────────── */}
      <TopBar 
        totalLeads={supabaseLeads.length}
        isDark={isDark}
        onThemeToggle={toggleTheme}
        onLogout={logout}
      />

      {/* ── Layer 2: Orbit rings + Core (static, NOT zoomed) ─────────────── */}
      <div className="absolute inset-0 z-[60] pointer-events-none flex items-center justify-center">
        <div className="pointer-events-auto scale-75 md:scale-100 transition-transform origin-center translate-y-[-20%] md:translate-y-0">
          <OrbitCore
            state={coreState}
            message={coreMessage}
            activeCount={activeLeadCount}
            onActivate={handleCoreActivate}
            onQuerySubmit={handleQuerySubmit}
            onCancel={handleCoreCancel}
          />
        </div>
      </div>
      

      {/* ── Layer 2: nodesLayer (D3 zoom applied here) ────────────────────── */}
      <div
        ref={nodesContainerRef}
        className="absolute inset-0 z-[50] cursor-grab active:cursor-grabbing outline-none transition-opacity duration-500"
        style={{ 
          touchAction: "none",
          opacity: 1,
          pointerEvents: "auto",
        }}
      >
        <div
          ref={nodesLayerRef}
          className="absolute inset-0 will-change-transform pointer-events-none"
          style={{ transformOrigin: "center center" }}
        >
          <LeadNodes
            highlightedLeads={highlightedLeads}
            coreState={coreState}
            onLeadClick={openLeadPanel}
          />
        </div>
      </div>

      {selectedLeadId && (
        <LeadCognitiveConsole
          leadId={selectedLeadId}
          isOpen={isLeadPanelOpen}
          onClose={closeLeadPanel}
        />
      )}
      <AdminTrigger />
    </div>
  );
}

export default function OrbitInterface() {
  return (
    <OrbitProvider>
      <OrbitInterfaceContent />
    </OrbitProvider>
  );
}
