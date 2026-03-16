"use client"

import { useState, useCallback } from "react"
import { OrbitCore } from "@/components/orbit-core"
import { LeadNodes } from "@/components/lead-nodes"
import { ParticleBackground } from "@/components/particle-background"
import { ThemeToggle } from "@/components/theme-toggle"
import { ConnectionLines } from "@/components/connection-lines"
import { LeadFocusPanel } from "@/components/lead-focus-panel"
import { OrbitProvider, useOrbitContext } from "@/components/orbit-context"
import { AdminTrigger } from "@/components/admin/admin-trigger"
import { OrbitStatusBar } from "@/components/orbit-status-bar"

export interface Lead {
  id: string
  name: string
  role: string
  avatar: string
  position: { top: string; left: string }
  badge?: "campaign" | "target" | "hot"
  badgeColor?: string
  delay: number
  emotionalState: "engaged" | "warm" | "neutral" | "cooling"
  keywords: string[] // For query matching
}

export const leadsData: Lead[] = [
  {
    id: "1",
    name: "Marina Costa",
    role: "Líder de Produto",
    avatar: "MC",
    position: { top: "18%", left: "20%" },
    badge: "campaign",
    badgeColor: "bg-[var(--orbit-glow)]",
    delay: 0,
    emotionalState: "engaged",
    keywords: ["quente", "hot", "engajado", "respondeu", "ativo", "intenção", "compra", "prioridade"],
  },
  {
    id: "2",
    name: "Lucas Ferreira",
    role: "Cliente Enterprise",
    avatar: "LF",
    position: { top: "25%", left: "65%" },
    delay: 0.8,
    emotionalState: "warm",
    keywords: ["quente", "warm", "respondeu", "hoje", "ativo", "atmosfera"],
  },
  {
    id: "3",
    name: "Ana Rodrigues",
    role: "Parceira Estratégica",
    avatar: "AR",
    position: { top: "60%", left: "15%" },
    badge: "target",
    badgeColor: "bg-[var(--orbit-accent)]",
    delay: 1.2,
    emotionalState: "engaged",
    keywords: ["target", "alvo", "estratégico", "intenção", "compra", "prioridade", "engajado"],
  },
  {
    id: "4",
    name: "Pedro Santos",
    role: "Consultor Técnico",
    avatar: "PS",
    position: { top: "70%", left: "55%" },
    delay: 2,
    emotionalState: "neutral",
    keywords: ["silencioso", "neutro", "sem resposta", "atenção"],
  },
  {
    id: "5",
    name: "Julia Mendes",
    role: "Relações com Investidores",
    avatar: "JM",
    position: { top: "40%", left: "8%" },
    badge: "hot",
    badgeColor: "bg-rose-500",
    delay: 1.6,
    emotionalState: "warm",
    keywords: ["quente", "hot", "intenção", "compra", "prioridade", "ativo", "atmosfera"],
  },
]

export type CoreState = "idle" | "listening" | "processing" | "responding"

function OrbitInterfaceContent() {
  const [isDark, setIsDark] = useState(true)
  const [coreState, setCoreState] = useState<CoreState>("idle")
  const [highlightedLeads, setHighlightedLeads] = useState<string[]>([])
  const [coreMessage, setCoreMessage] = useState<string>("Campo Cognitivo Ativo")
  const [activeLeadCount] = useState<number>(leadsData.length)
  
  // Get orbit context for Lead Focus Panel
  const {
    selectedLeadId,
    isLeadPanelOpen,
    openLeadPanel,
    closeLeadPanel,
  } = useOrbitContext()

  const toggleTheme = () => {
    setIsDark(!isDark)
    document.documentElement.classList.toggle("dark")
  }

  const processQuery = useCallback((query: string) => {
    const normalizedQuery = query
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")

    const matchingLeads = leadsData.filter((lead) =>
      lead.keywords.some((keyword) =>
        normalizedQuery.includes(
          keyword
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, ""),
        ),
      ),
    )

    return matchingLeads.map((lead) => lead.id)
  }, [])

  const handleCoreActivate = useCallback(() => {
    if (coreState === "idle") {
      setCoreState("listening")
      setCoreMessage("O que você quer saber?")
    }
  }, [coreState])

  const handleQuerySubmit = useCallback(
    (query: string) => {
      setCoreState("processing")
      setCoreMessage("Analisando...")

      setTimeout(() => {
        const matchedIds = processQuery(query)
        setHighlightedLeads(matchedIds)
        setCoreState("responding")

        if (matchedIds.length > 0) {
          setCoreMessage(
            `${matchedIds.length} lead${matchedIds.length > 1 ? "s" : ""} encontrado${matchedIds.length > 1 ? "s" : ""}`,
          )
        } else {
          setCoreMessage("Nenhum lead encontrado")
        }

        // Return to idle after 4s
        setTimeout(() => {
          setCoreState("idle")
          setHighlightedLeads([])
          setCoreMessage("Campo Cognitivo Ativo")
        }, 4000)
      }, 1200)
    },
    [processQuery],
  )

  const handleCoreCancel = useCallback(() => {
    setCoreState("idle")
    setCoreMessage("Campo Cognitivo Ativo")
    setHighlightedLeads([])
  }, [])

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[var(--orbit-bg)]">
      {/* Particle Background */}
      <ParticleBackground />

      {/* Status Bar - Discreet top signals */}
      <OrbitStatusBar />

      {/* Theme Toggle */}
      <ThemeToggle isDark={isDark} onToggle={toggleTheme} />

      {/* Connection Lines Layer - now with highlighting support */}
      <ConnectionLines highlightedLeads={highlightedLeads} coreState={coreState} />

      {/* Central Orbit Core - now interactive */}
      <OrbitCore
        state={coreState}
        message={coreMessage}
        activeCount={activeLeadCount}
        onActivate={handleCoreActivate}
        onQuerySubmit={handleQuerySubmit}
        onCancel={handleCoreCancel}
      />

      {/* Lead Nodes - now with highlighting support and click handler */}
      <LeadNodes 
        highlightedLeads={highlightedLeads} 
        coreState={coreState} 
        onLeadClick={openLeadPanel}
      />

      {/* Lead Focus Panel - Overlay that keeps Orbit View visible */}
      <LeadFocusPanel
        leadId={selectedLeadId}
        isOpen={isLeadPanelOpen}
        onClose={closeLeadPanel}
      />

      {/* Admin Trigger - Discreet backstage access */}
      <AdminTrigger />

    </div>
  )
}

// Wrap with OrbitProvider for context access
export default function OrbitInterface() {
  return (
    <OrbitProvider>
      <OrbitInterfaceContent />
    </OrbitProvider>
  )
}
