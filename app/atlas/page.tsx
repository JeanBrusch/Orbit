"use client"

import { useState, useEffect, Suspense, useMemo, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useSupabaseProperties, useSupabaseLeads, useLeadDetails } from "@/hooks/use-supabase-data"
import { useTheme } from "next-themes"
import { AnimatePresence, motion } from "framer-motion"
import { 
  Loader2, Sparkles, Check, X, Link2, Mic 
} from "lucide-react"
import dynamic from "next/dynamic"

import { OrbitProvider, useOrbitContext } from "@/components/orbit-context"
import type { MapProperty } from "@/components/atlas/MapAtlas"
import { AtlasTopBar, MapMode } from "@/components/atlas/AtlasTopBar"
import { computeMatch } from "@/lib/atlas-utils"

// Lazy loaded modals
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"

// Lazy loaded modals
const EditPropertyModal = dynamic(() => import("@/components/atlas/EditPropertyModal"), { ssr: false })
const ClientSpacesManager = dynamic(() => import("@/components/atlas/ClientSpacesManager"), { ssr: false })
const MapAtlas = dynamic(() => import("@/components/atlas/MapAtlas").then(m => m.MapAtlas), { ssr: false })

// VoiceIngestion — original component
const VoiceIngestion = dynamic(() => import("@/components/atlas/VoiceIngestion"), { ssr: false })
const CognitiveDrawer = dynamic(() => import("@/components/atlas/CognitiveDrawer").then(m => m.CognitiveDrawer), { ssr: false })
const SemanticSearch = dynamic(() => import("@/components/atlas/SemanticSearch").then(m => m.SemanticSearch), { ssr: false })
const LeadCognitiveConsole = dynamic(() => import("@/components/lead-cognitive-console").then(m => m.LeadCognitiveConsole), { ssr: false })

function AtlasManagerContent() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const router = useRouter()
  const searchParams = useSearchParams()

  const { properties, loading: propsLoading, refetch: refetchProps } = useSupabaseProperties()
  const { leads, loading: leadsLoading } = useSupabaseLeads()
  const { selectedLeadId, isLeadPanelOpen, openLeadPanel, closeLeadPanel, initializeLeadStates, atlasInvokeContext, closeAtlasMap, setSelectedLeadId } = useOrbitContext()
  
  // State for spaces manager
  const [managingLeadId, setManagingLeadId] = useState<string | null>(null)

  // Ingestion states
  const [isIngestModalOpen, setIsIngestModalOpen] = useState(false)
  const [ingestUrl, setIngestUrl] = useState("")
  const [ingestStatus, setIngestStatus] = useState<"idle" | "processing" | "complete" | "failed">("idle")
  const [ingestStep, setIngestStep] = useState<"url" | "review">("url")
  const [scrapedData, setScrapedData] = useState<any>({ title: "", image: "", value: "", condo_name: "", payment: "", photos: [] })
  
  // Ativa o lead como campo gravitacional no mapa, SEM abrir o LeadPanel
  const handleActivateLeadOnMap = useCallback((leadId: string) => {
    setSelectedLeadId(leadId)
    setIsSearchOpen(false)
    setSearchResultIds(null) // Clear search when focusing a lead
  }, [setSelectedLeadId])
  
  // States newly introduced for Map-First logic
  const [mapMode, setMapMode] = useState<MapMode>("hybrid")
  const [isSearchOpen, setIsSearchOpen] = useState(false) // for semantic search
  const [searchResultIds, setSearchResultIds] = useState<string[] | null>(null)
  
  const handleOpenSearch = useCallback(() => setIsSearchOpen(true), [])
  const handleOpenSelections = useCallback(() => {
    if (selectedLeadId && !managingLeadId) {
       setManagingLeadId(selectedLeadId)
    } else {
       setManagingLeadId(selectedLeadId || 'ALL')
    }
  }, [selectedLeadId, managingLeadId])
  const handleOpenUrlIngestion = useCallback(() => {
    setIngestStep("url")
    setIsIngestModalOpen(true)
  }, [])
  const handleOpenVoiceIngestion = useCallback(() => setIsVoiceModalOpen(true), [])

  const handleSearchResults = useCallback((ids: string[]) => {
    setSearchResultIds(ids.length > 0 ? ids : [])
  }, [])

  const handleClearSearch = useCallback(() => {
    setSearchResultIds(null)
  }, [])

  const [filters, setFilters] = useState({
    valueRange: { min: 0, max: 20000000 },
    areaRange: { min: 0, max: 1000 },
    bedrooms: 0
  })
  
  // Modal states
  const [isSelectionsOpen, setIsSelectionsOpen] = useState(false)
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingProperty, setEditingProperty] = useState<any>(null)
  const [selectedProperty, setSelectedProperty] = useState<any>(null)
  
  // Memória de Interações do Lead Selecionado (Reflexão no Mapa)
  const [leadInteractions, setLeadInteractions] = useState<Record<string, 'sent' | 'favorited' | 'portal'>>({})
  const [loadingInteractions, setLoadingInteractions] = useState(false)
  
  // Memory states remain below...

  // 1. Critical Sync: Synchronize Supabase leads with OrbitContext state
  // This ensures AtlasTopBar and other components see lead names and data
  useEffect(() => {
    if (leads && leads.length > 0) {
      initializeLeadStates(leads.map(l => ({
        id: l.id,
        orbit_stage: l.orbitStage, // Using mapped camelCase from OrbitLead
        orbit_visual_state: l.orbitVisualState
      })))
    }
  }, [leads, initializeLeadStates])

  // 1.1 Sincronização de Memória Operacional (Interações do Lead no Mapa)
  useEffect(() => {
    if (!selectedLeadId) {
      setLeadInteractions({})
      return
    }

    const fetchLeadHistory = async () => {
      setLoadingInteractions(true)
      try {
        const supabase = await import("@/lib/supabase").then(m => m.getSupabase())
        const { data, error } = await supabase
          .from('property_interactions')
          .select('property_id, interaction_type')
          .eq('lead_id', selectedLeadId)
          .in('interaction_type', ['sent', 'acervo', 'favorited', 'portal_opened'])

        if (error) throw error

        const mapping: Record<string, 'sent' | 'favorited' | 'portal'> = {}
        data?.forEach((item: any) => {
          if (item.property_id) {
            let type: 'sent' | 'favorited' | 'portal' = 'sent'
            
            if (item.interaction_type === 'acervo' || item.interaction_type === 'favorited') {
              type = 'favorited'
            } else if (item.interaction_type === 'portal_opened') {
              type = 'portal'
            } else if (item.interaction_type === 'sent') {
              type = 'sent'
            }
            
            mapping[item.property_id] = type
          }
        })
        setLeadInteractions(mapping)
      } catch (err) {
        console.error("[ATLAS] Erro ao carregar histórico do lead:", err)
      } finally {
        setLoadingInteractions(false)
      }
    }

    fetchLeadHistory()
  }, [selectedLeadId])

  // 2. Active Lead Resolution
  // We prioritize the lead from the local Supabase array, but cross-reference with context selection
  const activeLead = useMemo(() => {
    if (!selectedLeadId) return null
    return leads?.find(l => l.id === selectedLeadId) || null
  }, [leads, selectedLeadId])

  // 3. Filter Properties Logic
  const mappedProperties = useMemo(() => {
    return (properties || [])
      .filter((p: any) => {
        // 1. Price/Area/Beds filters
        const propVal = p.value || 0
        if (propVal < filters.valueRange.min || propVal > filters.valueRange.max) return false
        
        const propArea = p.area_privativa || p.area_total || 0
        if (propArea < filters.areaRange.min || propArea > filters.areaRange.max) return false
        
        const propBeds = p.bedrooms || 0
        if (filters.bedrooms > 0 && propBeds < filters.bedrooms) return false

        // 2. Semantic Search Filter
        if (searchResultIds !== null) {
          if (!searchResultIds.includes(p.id)) return false
        }

        // Apply Map Mode Intelligent Logic
        if (mapMode === "intent" && activeLead) {
          const match = computeMatch(p, activeLead);
          // Only show properties with significant resonance (> 40%)
          if (!match || match.scorePercentage < 40) return false;
        }

        return true
      })
      .map((p: any): MapProperty => {
        const match = activeLead ? computeMatch(p, activeLead) : null;
      return {
        id: p.id,
        name: p.title || p.internal_name || p.name || '',
        lat: p.lat ?? null,
        lng: p.lng ?? null,
        value: p.value ?? null,
        locationText: p.location_text ?? null,
        neighborhood: p.neighborhood ?? null,
        coverImage: p.cover_image ?? null,
        photos: p.photos ?? [],
        url: p.source_link ?? null,
        features: p.features ?? [],
        area_privativa: p.area_privativa ?? undefined,
        area_total: p.area_total ?? undefined,
        bedrooms: p.bedrooms ?? undefined,
        suites: p.suites ?? undefined,
        parking_spots: p.parking_spots ?? undefined,
        internalCode: p.internal_code ?? null,
        matchScore: match?.scorePercentage ?? undefined,
        matchReasons: match?.reasons ?? undefined,
        matchWarnings: match?.warnings ?? undefined,
        status: p.status || "available",
        lastInteractionAt: p.updated_at || p.created_at,
        interactionType: leadInteractions[p.id]
      };
    });
  }, [properties, activeLead, filters, mapMode]);

  // Handlers
  // ── Handlers (Legacy Ingestion) ─────────────────────────────────────────────
  const handleIngestSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ingestUrl) return
    setIngestStatus("processing")
    try {
      const isVistaNet = ingestUrl.includes('novovista') || ingestUrl.includes('v.imo.bi') || ingestUrl.includes('v2=')
      if (isVistaNet) {
        const res = await fetch("/api/property/import-vistanet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: ingestUrl }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Erro na importação nativa do VistaNet")
        toast.info(`Confirme a localização no mapa: ${data.title}`)
        setIngestStatus("complete")
        setTimeout(() => {
          setIsIngestModalOpen(false)
          setIngestStatus("idle")
          setIngestUrl("")
          setEditingProperty(data.property)
          setIsEditModalOpen(true)
        }, 1000)
        return
      }
      const previewRes = await fetch("/api/link-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: ingestUrl }),
      })
      const data = await previewRes.json()
      if (!previewRes.ok) throw new Error(data.error || "Erro ao capturar dados do link")
      setScrapedData({
        title: data.title || "",
        image: data.image || "",
        value: data.price ? data.price.toString() : "",
        neighborhood: data.neighborhood || "",
        city: data.city || "",
        area_privativa: data.area_privativa || null,
        area_total: data.area_total || null,
        bedrooms: data.bedrooms || null,
        suites: data.suites || "",
        parking_spots: data.parking_spots || "",
        condo_fee: data.condo_fee || "",
        iptu: data.iptu || "",
        features: data.features || [],
        photos: data.photos || [],
        description: data.description || "",
        source_link: ingestUrl,
      })
      setIngestStep("review")
      setIngestStatus("idle")
    } catch (err: any) {
      setIngestStatus("failed")
      toast.error(err.message || "Falha ao capturar dados do link")
      setTimeout(() => setIngestStatus("idle"), 2000)
    }
  }

  const handleConfirmIngest = async (e: React.FormEvent) => {
    e.preventDefault()
    setIngestStatus("processing")
    try {
      const payload = {
        ...scrapedData,
        value: parseFloat(scrapedData.value) || null,
        status: 'active'
      }
      toast.info("Confirme os detalhes finais")
      setIngestStatus("complete")
      setTimeout(() => {
        setIsIngestModalOpen(false)
        setIngestStatus("idle")
        setIngestUrl("")
        setIngestStep("url")
        setEditingProperty(payload)
        setIsEditModalOpen(true)
      }, 1000)
    } catch (err: any) {
      setIngestStatus("failed")
      toast.error(`Erro ao preparar: ${err.message}`)
    }
  }


  const handleCognitiveAction = useCallback(async (type: 'acervo' | 'propor' | 'ver-ficha', propertyId?: string, leadId?: string) => {
    // If IDs are missing, try to resolve from active state
    const finalPropId = propertyId || selectedProperty?.id
    const finalLeadId = leadId || selectedLeadId

    if (type === 'ver-ficha') {
      if (finalLeadId) {
        openLeadPanel(finalLeadId)
      } else {
        toast.error("Lead não selecionado.")
      }
      return
    }

    if (!finalPropId || !finalLeadId) {
       toast.error("Selecione um lead e um imóvel para esta ação.")
       return
    }

    const action = type === 'acervo' ? 'favorited' : 'sent'
    const loadingToast = toast.loading(type === 'acervo' ? "Salvando no acervo..." : "Preparando proposta...")

    try {
      const res = await fetch("/api/property/interact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId: finalPropId, leadId: finalLeadId, action })
      })

      if (!res.ok) throw new Error("Erro na interação")

      toast.success(type === 'acervo' ? "Salvo no acervo!" : "Imóvel proposto com sucesso!", { id: loadingToast })
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`, { id: loadingToast })
    }
  }, [selectedProperty, selectedLeadId, router])

  const handleUpdateProperty = async (updatedData: any) => {
    try {
      const isNew = !updatedData.id;
      const url = isNew ? "/api/properties" : `/api/properties/${updatedData.id}`;
      const method = isNew ? "POST" : "PUT";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...updatedData,
          value: parseFloat(updatedData.value) || null,
          bedrooms: parseInt(updatedData.bedrooms) || null,
          suites: parseInt(updatedData.suites) || null,
          area_privativa: parseFloat(updatedData.area_privativa) || null,
          area_total: parseFloat(updatedData.area_total) || null,
          parking_spots: parseInt(updatedData.parking_spots) || null,
          condo_fee: parseFloat(updatedData.condo_fee) || null,
          iptu: parseFloat(updatedData.iptu) || null
        })
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || `Erro na API (${res.status})`)
      }

      toast.success(isNew ? "Imóvel cadastrado!" : "Imóvel atualizado!")
      refetchProps()
      setIsEditModalOpen(false)
      setEditingProperty(null)
    } catch (err: any) {
      toast.error(`Falha ao salvar: ${err.message}`)
    }
  }

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
          properties={mappedProperties as any[]} 
          activeLeadId={selectedLeadId}
          leadInteractions={leadInteractions}
          mapMode={mapMode}
          onPropertyClick={(p) => setSelectedProperty(p)}
          onPropertyDeselect={() => setSelectedProperty(null)}
          selectedPropertyId={selectedProperty?.id}
        />
      </div>

      {/* LAYER 2: COGNITIVE DRAWER — Only when a lead is active */}
      {activeLead && (
        <CognitiveDrawer
          property={selectedProperty}
          lead={activeLead}
          isOpen={Boolean(selectedProperty)}
          onClose={() => setSelectedProperty(null)}
          isDark={isDark}
          onAction={handleCognitiveAction}
        />
      )}

      {/* LAYER 2 ALT: PROPERTY DETAIL PANEL — When no lead is active */}
      <AnimatePresence>
        {selectedProperty && !activeLead && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedProperty(null)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[90]"
            />
            <motion.div
              initial={{ y: "100%", x: 0 }}
              animate={{ y: 0, x: 0, transition: { type: "spring", damping: 30, stiffness: 300 } }}
              exit={{ y: "100%" }}
              className={`fixed bottom-0 md:top-0 md:right-0 h-[85vh] md:h-screen w-full md:max-w-[400px] z-[100] border-t md:border-t-0 md:border-l shadow-2xl flex flex-col rounded-t-[32px] md:rounded-t-none overflow-hidden ${
                isDark ? 'bg-[#0A0A0B] border-white/10' : 'bg-white border-slate-200'
              }`}
            >
              {/* Mobile Handle */}
              <div className="w-full flex justify-center pt-3 pb-1 md:hidden">
                <div className={`w-12 h-1.5 rounded-full ${isDark ? 'bg-white/10' : 'bg-slate-200'}`} />
              </div>

              {/* Header */}
              <div className={`p-5 border-b shrink-0 flex items-center justify-between ${isDark ? 'bg-white/2 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-[#C9A84C]/20 text-[#C9A84C]">
                    <Sparkles size={18} />
                  </div>
                  <div>
                    <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Ficha do Imóvel</h3>
                    <p className={`text-[10px] uppercase tracking-widest ${isDark ? 'text-white/40' : 'text-slate-500'}`}>Property Detail</p>
                  </div>
                </div>
                <button onClick={() => setSelectedProperty(null)} className={`p-2 rounded-full hover:bg-black/10 transition-colors ${isDark ? 'text-white/40' : 'text-slate-400'}`}>
                  <X size={18} />
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                {/* Photos */}
                {selectedProperty.photos && selectedProperty.photos.length > 0 && (
                  <div className={`relative h-52 w-full border-b ${isDark ? 'border-white/5 bg-black' : 'border-slate-100 bg-slate-50'}`}>
                    {(() => {
                      const { PropertyCarousel } = require("@/components/atlas/PropertyCarousel")
                      return <PropertyCarousel photos={selectedProperty.photos} isDark={isDark} height="h-52" />
                    })()}
                  </div>
                )}

                <div className="p-6 space-y-6">
                  {/* Name & Location */}
                  <div className="space-y-1.5">
                    <h3 className={`text-lg font-bold leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {selectedProperty.name}
                    </h3>
                    <p className={`text-[11px] uppercase tracking-[0.1em] opacity-60 ${isDark ? 'text-white' : 'text-slate-500'}`}>
                      {selectedProperty.locationText || selectedProperty.neighborhood || 'Endereço indisponível'}
                    </p>
                  </div>

                  {/* Price */}
                  <div className={`pb-4 border-b ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
                    <span className={`text-[9px] uppercase tracking-widest font-mono opacity-50 ${isDark ? 'text-white' : 'text-black'}`}>
                      Valor de Investimento
                    </span>
                    <div className="text-2xl font-bold tracking-tight" style={{ color: '#C9A84C' }}>
                      {selectedProperty.value
                        ? `R$ ${selectedProperty.value.toLocaleString('pt-BR')}`
                        : 'Sob Consulta'}
                    </div>
                  </div>

                  {/* Technical Grid */}
                  <div>
                    <h4 className={`text-[9px] uppercase tracking-widest font-mono opacity-50 mb-2.5 ${isDark ? 'text-white' : 'text-black'}`}>
                      Dados Técnicos
                    </h4>
                    <div className="grid grid-cols-3 gap-2">
                      {(selectedProperty.area_privativa || selectedProperty.area_total) && (
                        <div className={`p-3 rounded-2xl flex flex-col items-center justify-center gap-1 border ${isDark ? 'bg-white/3 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                          <span className={`text-sm font-mono font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            {Math.round(selectedProperty.area_privativa || selectedProperty.area_total || 0)}m²
                          </span>
                          <span className="text-[7px] uppercase tracking-tighter opacity-40">Área</span>
                        </div>
                      )}
                      {Number(selectedProperty.bedrooms ?? 0) > 0 && (
                        <div className={`p-3 rounded-2xl flex flex-col items-center justify-center gap-1 border ${isDark ? 'bg-white/3 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                          <span className={`text-sm font-mono font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            {selectedProperty.bedrooms}
                          </span>
                          <span className="text-[7px] uppercase tracking-tighter opacity-40">Dorms</span>
                        </div>
                      )}
                      {Number(selectedProperty.suites ?? 0) > 0 && (
                        <div className={`p-3 rounded-2xl flex flex-col items-center justify-center gap-1 border ${isDark ? 'bg-white/3 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                          <span className={`text-sm font-mono font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            {selectedProperty.suites}
                          </span>
                          <span className="text-[7px] uppercase tracking-tighter opacity-40">Suítes</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Features */}
                  {selectedProperty.features && selectedProperty.features.length > 0 && (
                    <div>
                      <h4 className={`text-[9px] uppercase tracking-widest font-mono opacity-50 mb-2.5 ${isDark ? 'text-white' : 'text-black'}`}>
                        Características
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedProperty.features.map((feat: string, i: number) => (
                          <span key={i} className={`px-2.5 py-1 rounded-lg text-[10px] font-medium border ${isDark ? 'bg-white/5 border-white/10 text-white/70' : 'bg-slate-50 border-slate-100 text-slate-600'}`}>
                            {feat}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className={`pt-4 border-t space-y-3 ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
                    <h4 className={`text-[9px] uppercase tracking-widest font-mono opacity-50 mb-2.5 ${isDark ? 'text-white' : 'text-black'}`}>
                      Ações
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      {selectedProperty.url && (
                        <a
                          href={selectedProperty.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`flex items-center justify-center gap-2 px-3 py-3 rounded-2xl border text-xs font-medium transition-all ${isDark ? 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white' : 'border-slate-200 bg-white text-slate-500 hover:text-slate-900'}`}
                        >
                          <Link2 className="w-3.5 h-3.5 opacity-60" />
                          Link Original
                        </a>
                      )}
                      <button
                        onClick={() => {
                          setEditingProperty(selectedProperty)
                          setIsEditModalOpen(true)
                        }}
                        className={`flex items-center justify-center gap-2 px-3 py-3 rounded-2xl border text-xs font-medium transition-all ${isDark ? 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white' : 'border-slate-200 bg-white text-slate-500 hover:text-slate-900'}`}
                      >
                        <Sparkles className="w-3.5 h-3.5 opacity-60" />
                        Editar
                      </button>
                    </div>
                  </div>

                  {/* Internal code */}
                  {selectedProperty.internalCode && (
                    <div className={`flex items-center gap-2 text-[10px] font-mono opacity-30 ${isDark ? 'text-white' : 'text-slate-500'}`}>
                      <span className="uppercase tracking-wider">Código:</span>
                      <span>{selectedProperty.internalCode}</span>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 
        LAYER 2: TOP FLOATING BAR 
        Identity, Search Trigger, Map Modes
      */}
      <AtlasTopBar 
        mapMode={mapMode}
        onMapModeChange={setMapMode}
        onOpenSearch={handleOpenSearch}
        onOpenSelections={handleOpenSelections}
        onOpenUrlIngestion={handleOpenUrlIngestion}
        onOpenVoiceIngestion={handleOpenVoiceIngestion}
        filters={filters}
        onFiltersChange={setFilters}
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
        onSelectLead={(id) => handleActivateLeadOnMap(id)}
        onSelectProperty={(p) => {
          setSelectedProperty(p)
          setIsSearchOpen(false)
        }}
        onResultsFound={handleSearchResults}
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
            onSave={handleUpdateProperty}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isVoiceModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <VoiceIngestion
              onClose={() => setIsVoiceModalOpen(false)}
              onDataExtracted={(data) => {
                setScrapedData({
                  title: data.title || "",
                  image: "",
                  value: data.value ? data.value.toString() : "",
                  neighborhood: data.neighborhood || "",
                  city: data.city || "",
                  area_privativa: data.area_privativa || null,
                  area_total: data.area_total || null,
                  bedrooms: data.bedrooms || null,
                  suites: data.suites || "",
                  parking_spots: data.parking_spots || "",
                  condo_fee: data.condo_fee || "",
                  iptu: data.iptu || "",
                  features: data.features || [],
                  description: data.description || "",
                  payment: data.payment || ""
                })
                setIsVoiceModalOpen(false)
                setIngestStep("review")
                setIsIngestModalOpen(true)
              }}
            />
          </div>
        )}

        {isIngestModalOpen && (
            <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-[#0b1220] border border-[rgba(46,197,255,0.2)] rounded-3xl shadow-[0_0_60px_rgba(46,197,255,0.1)] w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]"
              >
                <div className="p-6 border-b border-[rgba(46,197,255,0.12)] flex items-center justify-between bg-[#05060a]/60">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-[#d4af35]/10 border border-[#d4af35]/20 text-[#d4af35]">
                      <Sparkles size={18} />
                    </div>
                    <div>
                      <h3 className="font-sans font-semibold text-lg text-white">Cadastro Integrado</h3>
                      <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">IA Processing & Vistanet Sync</p>
                    </div>
                  </div>
                  <button onClick={() => setIsIngestModalOpen(false)} className="p-2 hover:bg-white/5 rounded-full text-zinc-500 transition-colors">
                    <X size={18} />
                  </button>
                </div>

                {ingestStep === 'url' ? (
                  <form onSubmit={handleIngestSubmit} className="p-8 space-y-6">
                    <div className="space-y-3">
                      <label className="text-[10px] font-mono uppercase tracking-widest text-[#94a3b8]">URL do Imóvel</label>
                      <div className="relative group">
                        <Link2 className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#d4af35]/40 group-focus-within:text-[#d4af35] transition-colors" />
                        <Input
                          value={ingestUrl}
                          onChange={(e) => setIngestUrl(e.target.value)}
                          placeholder="Link Vistanet, Zap, VivaReal..."
                          className="w-full pl-12 h-14 bg-[#05060a]/60 border border-[rgba(212,175,53,0.15)] rounded-2xl text-xs text-white focus:border-[#d4af35]/40"
                        />
                      </div>
                    </div>

                    <Button
                      type="submit"
                      disabled={ingestStatus === "processing" || !ingestUrl}
                      className="w-full h-14 bg-[#d4af35] hover:bg-[#d4af35]/90 text-black gap-3 font-bold uppercase tracking-widest text-[11px] rounded-2xl shadow-[0_0_20px_rgba(212,175,53,0.2)]"
                    >
                      {ingestStatus === "processing" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
                      Processar via AI/Vistanet
                    </Button>
                  </form>
                ) : (
                  <form onSubmit={handleConfirmIngest} className="p-8 overflow-y-auto space-y-6">
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex gap-4">
                       {scrapedData.image && <img src={scrapedData.image} className="w-16 h-16 rounded-lg object-cover" />}
                       <div>
                         <h4 className="text-sm font-bold text-white">{scrapedData.title}</h4>
                         <p className="text-xs text-[#d4af35] font-bold mt-1">R$ {parseFloat(scrapedData.value).toLocaleString('pt-BR')}</p>
                       </div>
                    </div>
                    <Button
                      type="submit"
                      disabled={ingestStatus === "processing"}
                      className="w-full h-14 bg-[#d4af35] hover:bg-[#d4af35]/90 text-black gap-3 font-bold uppercase tracking-widest text-[11px] rounded-2xl shadow-[0_0_20px_rgba(212,175,53,0.2)]"
                    >
                      {ingestStatus === "processing" ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                      Confirmar Detalhes
                    </Button>
                  </form>
                )}
              </motion.div>
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

      {selectedLeadId && (
        <LeadCognitiveConsole
          leadId={selectedLeadId}
          isOpen={isLeadPanelOpen}
          onClose={closeLeadPanel}
        />
      )}
      
      {/* 
        SELECTION CONFIRMATION OVERLAY 
        Shown when a selection flow is active (atlasInvokeContext)
      */}
      <AnimatePresence>
        {selectedProperty && atlasInvokeContext?.onPropertySelected && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] flex flex-col md:flex-row items-center gap-4 bg-[#0a0a0c] border border-[#d4af35]/40 rounded-3xl p-5 shadow-[0_0_80px_rgba(212,175,53,0.15)] backdrop-blur-xl min-w-[320px] md:min-w-[450px]"
          >
             <div className="flex-1">
               <p className="text-[10px] text-[#d4af35] font-bold uppercase tracking-[0.2em] mb-1">Vincular para o Atlas</p>
               <h4 className="text-sm font-semibold text-white truncate max-w-[250px] md:max-w-none">
                 Vincular <span className="text-[#2ec5ff]">{selectedProperty.name}</span> ao Lead <span className="text-[#d4af35]">{atlasInvokeContext.leadName || "Ativo"}</span>?
               </h4>
             </div>
             <div className="flex items-center gap-3 shrink-0">
               <button 
                 onClick={() => setSelectedProperty(null)}
                 className="px-5 py-2.5 rounded-2xl text-[11px] font-bold uppercase tracking-wider text-slate-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
               >
                 Cancelar
               </button>
               <button 
                 onClick={() => {
                   atlasInvokeContext.onPropertySelected?.(selectedProperty)
                   setSelectedProperty(null)
                   closeAtlasMap()
                 }}
                 className="px-7 py-2.5 rounded-2xl bg-[#d4af35] text-black text-[11px] font-bold uppercase tracking-widest shadow-[0_0_20px_rgba(212,175,53,0.3)] hover:scale-105 active:scale-95 transition-all cursor-pointer"
               >
                 Confirmar Vínculo
               </button>
             </div>
          </motion.div>
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
