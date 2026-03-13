"use client"

import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import { LeadBrainHeader } from "@/components/lead-brain/header"
import { SemanticTimeline } from "@/components/lead-brain/semantic-timeline"
import { CognitiveAnalysis } from "@/components/lead-brain/cognitive-analysis"
import { ContextActionDock } from "@/components/lead-brain/context-action-dock"
import { LeadBrainComposer } from "@/components/lead-brain/composer"

export interface LeadData {
  id: string
  name: string
  avatar: string
  emotionalState: "intent" | "curious" | "aware" | "conflicted" | "silentGravity"
  emotionalLabel: string
  property: string
  lastResponse: string
  isPriority: boolean
  isMuted: boolean
}

const leadsDatabase: Record<string, LeadData> = {
  "1": {
    id: "1",
    name: "Marina Costa",
    avatar: "MC",
    emotionalState: "intent",
    emotionalLabel: "INTENT",
    property: "Laguna Premium",
    lastResponse: "2min atrás",
    isPriority: true,
    isMuted: false,
  },
  "2": {
    id: "2",
    name: "Lucas Ferreira",
    avatar: "LF",
    emotionalState: "curious",
    emotionalLabel: "CURIOUS",
    property: "Cobertura 402",
    lastResponse: "15min atrás",
    isPriority: false,
    isMuted: false,
  },
  "3": {
    id: "3",
    name: "Ana Rodrigues",
    avatar: "AR",
    emotionalState: "aware",
    emotionalLabel: "AWARE",
    property: "Torre Oceano",
    lastResponse: "1h atrás",
    isPriority: false,
    isMuted: false,
  },
  "4": {
    id: "4",
    name: "Pedro Santos",
    avatar: "PS",
    emotionalState: "silentGravity",
    emotionalLabel: "SILENT",
    property: "Vista Mar",
    lastResponse: "3h atrás",
    isPriority: false,
    isMuted: true,
  },
  "5": {
    id: "5",
    name: "Julia Mendes",
    avatar: "JM",
    emotionalState: "conflicted",
    emotionalLabel: "CONFLICTED",
    property: "Residencial Park",
    lastResponse: "30min atrás",
    isPriority: true,
    isMuted: false,
  },
}

export default function LeadBrainPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [lead, setLead] = useState<LeadData | null>(null)
  const [showMobileSidebar, setShowMobileSidebar] = useState(false)

  useEffect(() => {
    const leadData = leadsDatabase[id]
    if (leadData) {
      setLead(leadData)
    }
  }, [id])

  const handleBack = () => {
    router.push("/")
  }

  const handleTogglePriority = () => {
    if (lead) {
      setLead({ ...lead, isPriority: !lead.isPriority })
    }
  }

  const handleToggleMute = () => {
    if (lead) {
      setLead({ ...lead, isMuted: !lead.isMuted })
    }
  }

  if (!lead) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-b from-[#0a0a0f] to-[#050508]">
        <div className="text-[var(--orbit-text-muted)]">Carregando...</div>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col bg-gradient-to-b from-[#0a0a0f] to-[#050508] text-white">
      {/* Header */}
      <LeadBrainHeader
        lead={lead}
        onBack={handleBack}
        onTogglePriority={handleTogglePriority}
        onToggleMute={handleToggleMute}
        onToggleMobileSidebar={() => setShowMobileSidebar(!showMobileSidebar)}
      />

      {/* Main Content */}
      <div className="relative flex flex-1 overflow-hidden">
        {/* Left Column - Semantic Timeline */}
        <div className="flex-1 overflow-y-auto px-4 pb-[200px] pt-4 md:px-8 lg:w-[60%]">
          <SemanticTimeline leadId={lead.id} />
        </div>

        {/* Right Column - Cognitive Analysis */}
        <div
          className={`absolute right-0 top-0 z-30 h-full w-[300px] transform border-l border-[rgba(46,197,255,0.15)] bg-[rgba(10,10,15,0.95)] backdrop-blur-xl transition-transform duration-300 lg:relative lg:block lg:w-[25%] lg:translate-x-0 ${
            showMobileSidebar ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <CognitiveAnalysis lead={lead} />
        </div>

        {/* Mobile overlay */}
        {showMobileSidebar && (
          <div className="absolute inset-0 z-20 bg-black/50 lg:hidden" onClick={() => setShowMobileSidebar(false)} />
        )}
      </div>

      {/* Context Action Dock */}
      <ContextActionDock emotionalState={lead.emotionalState} />

      {/* Composer */}
      <LeadBrainComposer />
    </div>
  )
}
