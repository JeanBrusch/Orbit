"use client"

import { useState, useEffect, Suspense, useMemo } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useSupabaseProperties, useSupabaseLeads, useLeadDetails } from "@/hooks/use-supabase-data"
import { useTheme } from "next-themes"
import { AnimatePresence } from "framer-motion"
import { Loader2 } from "lucide-react"
import dynamic from "next/dynamic"

import { OrbitProvider, useOrbitContext } from "@/components/orbit-context"
import type { MapProperty } from "@/components/atlas/MapAtlas"
import { AtlasTopBar, MapMode } from "@/components/atlas/AtlasTopBar"
import { computeMatch } from "@/lib/atlas-utils"

// Lazy loaded modals
const EditPropertyModal = dynamic(() => import("@/components/atlas/EditPropertyModal"), { ssr: false })
const ClientSpacesManager = dynamic(() => import("@/components/atlas/ClientSpacesManager"), { ssr: false })
const MapAtlas = dynamic(() => import("@/components/atlas/MapAtlas").then(m => m.MapAtlas), { ssr: false })

// VoiceIngestion wrapper — adapta a API ao novo uso
const VoiceIngestion = dynamic(() => import("@/components/atlas/VoiceIngestion"), { ssr: false })
const CognitiveDrawer = dynamic(() => import("@/components/atlas/CognitiveDrawer").then(m => m.CognitiveDrawer), { ssr: false })
const SemanticSearch = dynamic(() => import("@/components/atlas/SemanticSearch").then(m => m.SemanticSearch), { ssr: false })

function AtlasManagerContent() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const router = useRouter()
  const searchParams = useSearchParams()

  const { properties, loading: propsLoading, refetch: refetchProps } = useSupabaseProperties()
  const { leads, loading: leadsLoading } = useSupabaseLeads()
  const { selectedLeadId, openLeadPanel } = useOrbitContext()
  
  // States newly introduced for Map-First logic
  const [mapMode, setMapMode] = useState<MapMode>("hybrid")
  const [isSearchOpen, setIsSearchOpen] = useState(false) // for semantic search
  
  // Modal states
  const [isSelectionsOpen, setIsSelectionsOpen] = useState(false)
  const [isIngestModalOpen, setIsIngestModalOpen] = useState(false)
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false)
  
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingProperty, setEditingProperty] = useState<any>(null)
  const [selectedProperty, setSelectedProperty] = useState<any>(null)
  
  // Managing Selections logic
  const [managingLeadId, setManagingLeadId] = useState<string | null>(null)

  const activeLead = useMemo(() => leads?.find(l => l.id === selectedLeadId), [leads, selectedLeadId])

  const mappedProperties = useMemo(() => {
    return (properties || []).map((p: any): MapProperty => {
      const match = activeLead ? computeMatch(p, activeLead) : null;
      return {
        id: p.id,
        name: p.title || p.internal_name || p.name || '',
        lat: p.lat ?? null,
        lng: p.lng ?? null,
        value: p.value ?? null,
        locationText: p.location_text ?? null,
        coverImage: p.cover_image ?? null,
        photos: p.photos ?? [],
        url: p.source_link ?? null,
        features: p.features ?? [],
        area_privativa: p.area_privativa ?? undefined,
        area_total: p.area_total ?? undefined,
        bedrooms: p.bedrooms ?? undefined,
        suites: p.suites ?? undefined,
        internalCode: p.internal_code ?? null,
        matchScore: match?.scorePercentage ?? undefined,
        status: p.status || "available",
        lastInteractionAt: p.updated_at || p.created_at,
      };
    });
  }, [properties, activeLead]);

  // Handlers
  const handleOpenSearch = () => setIsSearchOpen(true)
  const handleOpenSelections = () => {
    if (selectedLeadId && !managingLeadId) {
       setManagingLeadId(selectedLeadId)
    } else {
       // if no lead is selected, maybe open an empty manager or redirect. For now open manager null or handle state
       setManagingLeadId(selectedLeadId || 'ALL')
    }
  }
  const handleOpenIngestion = () => setIsVoiceModalOpen(true) // Opening Voice/URL modal as default ingestion.

  // Effects
  useEffect(() => {
    const lId = searchParams.get('leadId')
    if (lId) {
      openLeadPanel(lId)
    }
  }, [searchParams, openLeadPanel])

  // Keyboard shortcut for Semantic Search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        handleOpenSearch()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className={`relative w-full h-screen overflow-hidden ${isDark ? 'bg-[#0A0A0F]' : 'bg-[#F7F7F9]'}`}>
      
      {/* LAYER 1: MAP — Fullscreen, underlying reality layer */}
      <div className="absolute inset-0 z-[0]">
        <MapAtlas
          mapMode={mapMode}
          properties={mappedProperties}
          activeLeadId={selectedLeadId}
          onPropertyClick={(p) => setSelectedProperty(p)}
          selectedPropertyId={selectedProperty?.id}
        />
      </div>

      {/* LAYER 2: COGNITIVE DRAWER — High-context operational panel */}
      <CognitiveDrawer
        property={selectedProperty}
        lead={activeLead}
        isOpen={Boolean(selectedProperty)}
        onClose={() => setSelectedProperty(null)}
        isDark={isDark}
      />

      {/* 
        LAYER 2: TOP FLOATING BAR 
        Identity, Search Trigger, Map Modes
      */}
      <AtlasTopBar 
        mapMode={mapMode}
        onMapModeChange={setMapMode}
        onOpenSearch={handleOpenSearch}
        onOpenSelections={handleOpenSelections}
        onOpenIngestion={handleOpenIngestion}
      />

      {/* 
        MODALS & OVERLAYS 
      */}
      
      <SemanticSearch
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        isDark={isDark}
        leads={leads || []}
        properties={properties || []}
        onSelectLead={(id) => openLeadPanel(id)}
        onSelectProperty={(p) => {
          setSelectedProperty(p)
        }}
      />

      <AnimatePresence>
        {isEditModalOpen && editingProperty && (
          <EditPropertyModal 
            isOpen={isEditModalOpen}
            property={editingProperty}
            onClose={() => {
              setIsEditModalOpen(false)
              setEditingProperty(null)
            }}
            onSave={async (update: any) => {
              refetchProps()
              setIsEditModalOpen(false)
              setEditingProperty(null)
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isVoiceModalOpen && (
          <div className="fixed inset-0 z-[50] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <VoiceIngestion
              onDataExtracted={(data: any) => {
                refetchProps()
                setIsVoiceModalOpen(false)
              }}
              onClose={() => setIsVoiceModalOpen(false)}
            />
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {managingLeadId && (
          <ClientSpacesManager
            leadId={managingLeadId !== 'ALL' ? managingLeadId : undefined}
            onClose={() => setManagingLeadId(null)}
          />
        )}
      </AnimatePresence>

    </div>
  )
}

export default function AtlasManager() {
  return (
    <OrbitProvider>
      <Suspense fallback={
        <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--orbit-glow)]" />
        </div>
      }>
        <AtlasManagerContent />
      </Suspense>
    </OrbitProvider>
  )
}
