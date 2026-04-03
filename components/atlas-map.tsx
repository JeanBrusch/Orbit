"use client"

import { useState, useCallback, useEffect, useRef, useMemo } from "react"
import { X, MapPin, Check, Building2, Link2, Loader2, AlertCircle, ExternalLink, Search, Stars, ArrowRight, Trash2, Share2, Users, Flame, BarChart3 } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { type Property, type IngestionStatus, type LocationAccuracy, useOrbitContext } from "./orbit-context"
import { useSupabaseProperties } from "@/hooks/use-supabase-data"
import { getSupabase } from "@/lib/supabase"
import { useTheme } from "next-themes"
import dynamic from "next/dynamic"
import type { MapProperty } from "./atlas/MapAtlas"
import { NeighborhoodInsightPanel, type NeighborhoodData } from "./atlas/NeighborhoodInsightPanel"
import { PropertyCarousel } from "./atlas/PropertyCarousel"

const ClientSpacesManager = dynamic(() => import("./atlas/ClientSpacesManager"), { ssr: false })
const PropertyTimeline = dynamic(() => import("./atlas/PropertyTimeline"), { ssr: false })

const MapAtlas = dynamic(
  () => import("./atlas/MapAtlas").then((m) => m.MapAtlas),
  { ssr: false, loading: () => <div className="flex-1 bg-[var(--orbit-bg)] flex items-center justify-center"><div className="animate-spin h-6 w-6 border-2 border-[var(--orbit-glow)] border-t-transparent rounded-full" /></div> }
)

export type { Property }

// Helper to format values elegantly
const formatValue = (value: number | null): string => {
  if (value === null || value === 0) return ''
  if (value >= 1_000_000) {
    const millions = value / 1_000_000
    return millions % 1 === 0 ? `R$ ${millions}M` : `R$ ${millions.toFixed(1)}M`
  }
  if (value >= 1_000) {
    const thousands = value / 1_000
    return thousands % 1 === 0 ? `R$ ${thousands}k` : `R$ ${thousands.toFixed(0)}k`
  }
  return `R$ ${value.toString()}`
}

export function AtlasFocusSurface() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null)
  const [filterMinValue, setFilterMinValue] = useState<string>('')
  const [filterMaxValue, setFilterMaxValue] = useState<string>('')
  const [filterLocation, setFilterLocation] = useState<string>('')

  const [matches, setMatches] = useState<any[]>([])
  const [isMatching, setIsMatching] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  
  // Lead Search for manual sharing
  const [leadSearchQuery, setLeadSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isSearchingLeads, setIsSearchingLeads] = useState(false)
  const [showLeadSearch, setShowLeadSearch] = useState(false)
  const [showClientSpaceFor, setShowClientSpaceFor] = useState<string | null>(null)
  const [activeContextTab, setActiveContextTab] = useState<"matches" | "history">("matches")

  // ── Heatmap State ──────────────────────────────────────────────────────────
  type HeatmapMetric = "all" | "sent" | "favorited" | "visited" | "deciding"
  const [heatmapActive, setHeatmapActive] = useState(false)
  const [heatmapMetric, setHeatmapMetric] = useState<HeatmapMetric>("all")
  const [heatmapGeoJSON, setHeatmapGeoJSON] = useState<GeoJSON.FeatureCollection | null>(null)
  const [heatmapNeighborhoods, setHeatmapNeighborhoods] = useState<NeighborhoodData[]>([])
  const [isLoadingHeatmap, setIsLoadingHeatmap] = useState(false)
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<NeighborhoodData | null>(null)
  
  const {
    isAtlasMapActive,
    closeAtlasMap,
    atlasInvokeContext,
    openLeadPanel,
  } = useOrbitContext()
  
  const { properties: supabaseProperties, refetch: refetchProperties } = useSupabaseProperties()

  // ── Fetch Heatmap Data ────────────────────────────────────────────────────
  const fetchHeatmap = useCallback(async (metric: string) => {
    setIsLoadingHeatmap(true)
    try {
      const res = await fetch(`/api/atlas/heatmap?metric=${metric}&days=30`)
      const data = await res.json()
      setHeatmapGeoJSON(data.geojson || null)
      setHeatmapNeighborhoods(data.neighborhoods || [])
    } catch (err) {
      console.error("[HEATMAP] Erro ao buscar heatmap:", err)
    } finally {
      setIsLoadingHeatmap(false)
    }
  }, [])

  useEffect(() => {
    if (heatmapActive) fetchHeatmap(heatmapMetric)
  }, [heatmapActive, heatmapMetric, fetchHeatmap])

  const toggleHeatmap = useCallback(() => {
    setHeatmapActive(prev => !prev)
    setSelectedNeighborhood(null)
    if (selectedProperty) setSelectedProperty(null)
  }, [selectedProperty])

  // Ao clicar no mapa em modo heatmap → encontrar bairro mais próximo
  const handleHeatmapMapClick = useCallback((lat: number, lng: number) => {
    if (!heatmapActive || heatmapNeighborhoods.length === 0) return
    // Encontra o bairro mais próximo clicado
    const closest = heatmapNeighborhoods.reduce((prev, curr) => {
      const prevDist = Math.abs(prev.lat - lat) + Math.abs(prev.lng - lng)
      const currDist = Math.abs(curr.lat - lat) + Math.abs(curr.lng - lng)
      return currDist < prevDist ? curr : prev
    })
    setSelectedNeighborhood(closest)
  }, [heatmapActive, heatmapNeighborhoods])
  
  useEffect(() => {
    if (isAtlasMapActive) {
      refetchProperties()
    }
  }, [isAtlasMapActive, refetchProperties])
  
  // Convert properties format
  const allPropertiesRaw: Property[] = useMemo(() => supabaseProperties.map(prop => ({
    id: prop.id,
    name: prop.title || prop.internal_name || 'Imóvel sem nome',
    locationText: prop.location_text,
    type: 'apartment' as const,
    value: prop.value,
    position: { x: 50, y: 50 },
    url: prop.source_link,
    domain: prop.source_domain || undefined,
    ingestionStatus: prop.ingestion_status as IngestionStatus || 'ready',
    coverImage: prop.cover_image,
    lat: prop.lat,
    lng: prop.lng,
    // Technical data
    photos: prop.photos,
    area_privativa: prop.area_privativa,
    area_total: prop.area_total,
    bedrooms: prop.bedrooms,
    suites: prop.suites,
    neighborhood: prop.neighborhood,
    features: prop.features,
    internal_code: prop.internal_code,
    condo_fee: prop.condo_fee,
  })), [supabaseProperties])

  const minValueNum = filterMinValue ? parseInt(filterMinValue.replace(/\D/g, ''), 10) || 0 : 0
  const maxValueNum = filterMaxValue ? parseInt(filterMaxValue.replace(/\D/g, ''), 10) || Infinity : Infinity
  const locationSearchLower = filterLocation.toLowerCase().trim()

  const allProperties = useMemo(() => allPropertiesRaw.filter(prop => {
    const valueOk = prop.value === null || (prop.value >= minValueNum && prop.value <= maxValueNum)
    const locationOk = !locationSearchLower || (prop.locationText?.toLowerCase().includes(locationSearchLower) ?? false)
    return valueOk && locationOk
  }), [allPropertiesRaw, minValueNum, maxValueNum, locationSearchLower])

  // Golden Match API Fetch
  useEffect(() => {
    async function fetchMatches() {
      if (!selectedProperty?.id) {
        setMatches([])
        return
      }
      setIsMatching(true)
      try {
        const res = await fetch(`/api/match/property?propertyId=${selectedProperty.id}&limit=5`)
        if (res.ok) {
          const data = await res.json()
          // Animação gradual com um delayzinho falso para UX "AI Processing" 
          setTimeout(() => {
            setMatches(data.matches || [])
            setIsMatching(false)
          }, 800)
        } else {
          setIsMatching(false)
        }
      } catch (err) {
        console.error("Match error", err)
        setIsMatching(false)
      }
    }
    fetchMatches()
  }, [selectedProperty?.id])

  useEffect(() => {
    if (!isAtlasMapActive) {
      setSelectedProperty(null)
      setMatches([])
    }
  }, [isAtlasMapActive])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isAtlasMapActive) {
        if (selectedProperty) {
          setSelectedProperty(null)
        } else {
          closeAtlasMap()
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isAtlasMapActive, closeAtlasMap, selectedProperty])

  const handleConfirmSelection = useCallback(() => {
    if (selectedProperty && atlasInvokeContext?.onPropertySelected) {
      atlasInvokeContext.onPropertySelected(selectedProperty)
      closeAtlasMap()
    }
  }, [selectedProperty, atlasInvokeContext, closeAtlasMap])

  const handleDeleteProperty = async () => {
    if (!selectedProperty || !window.confirm(`Deseja realmente excluir "${selectedProperty.name}"?`)) return
    
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/properties/${selectedProperty.id}`, { method: 'DELETE' })
      if (res.ok) {
        setSelectedProperty(null)
        refetchProperties()
        alert(`Imóvel "${selectedProperty.name}" excluído com sucesso.`)
      } else {
        const err = await res.json()
        alert(`Erro ao excluir: ${err.error || 'Erro desconhecido'}`)
      }
    } catch (err) {
      console.error("Delete error", err)
      alert("Erro ao excluir imóvel.")
    } finally {
      setIsDeleting(false)
    }
  }

  // Lead Search Logic
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (leadSearchQuery.length < 2) {
        setSearchResults([])
        return
      }
      setIsSearchingLeads(true)
      try {
        const supabase = getSupabase()
        const { data, error } = await supabase
          .from('leads')
          .select('id, name, photo_url, orbit_stage')
          .ilike('name', `%${leadSearchQuery}%`)
          .limit(5)
        
        if (!error) setSearchResults(data || [])
      } catch (err) {
        console.error("Search error", err)
      } finally {
        setIsSearchingLeads(false)
      }
    }, 300)

    return () => clearTimeout(delayDebounceFn)
  }, [leadSearchQuery])

  const handleSendToLead = async (lead: any) => {
    if (!selectedProperty) return
    
    try {
      const res = await fetch('/api/property-interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: lead.id,
          propertyId: selectedProperty.id,
          interaction_type: 'sent',
          source: 'atlas'
        })
      })
      
      if (res.ok) {
        alert(`Imóvel enviado com sucesso para ${lead.name}`)
        setShowLeadSearch(false)
        setLeadSearchQuery('')
      } else {
        const errorData = await res.json().catch(() => ({}))
        alert(`Erro ao registrar envio: ${errorData.error || 'Erro desconhecido'}`)
      }
    } catch (err) {
      console.error("Send error", err)
    }
  }


  const leadName = atlasInvokeContext?.leadName

  // ── Hooks extracted from JSX to avoid conditional hook violation ─────────
  const mapAtlasProperties = useMemo(() => allProperties.map((prop): MapProperty => ({
    id: prop.id,
    name: prop.name,
    lat: prop.lat ?? null,
    lng: prop.lng ?? null,
    value: prop.value,
    locationText: prop.locationText,
    coverImage: prop.coverImage,
    url: prop.url,
  })), [allProperties])

  const handleMapPropertyClick = useCallback((mapProp: MapProperty) => {
    const fullProp = allProperties.find(p => p.id === mapProp.id)
    if (fullProp) setSelectedProperty(fullProp);
  }, [allProperties])

  // ── Guard: render nothing until Atlas is active ─────────────────────────
  if (!isAtlasMapActive) return null

  return (
    <>
      {/* ── Atlas Map: full-screen background layer under the Orbit nodes ─── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[10]"
      >
        <MapAtlas
          properties={mapAtlasProperties}
          selectedPropertyId={selectedProperty?.id}
          onPropertyClick={handleMapPropertyClick}
          onMapClick={heatmapActive ? handleHeatmapMapClick : undefined}
          heatmapVisible={heatmapActive}
          heatmapGeoJSON={heatmapGeoJSON}
          heatmapMetric={heatmapMetric}
          className="absolute inset-0"
        />
      </motion.div>

      {/* ── Top navbar floating over nodes ─────────────────────────────────── */}
      <div className={`fixed top-4 left-16 right-16 z-[35] flex items-center justify-between border ${isDark ? 'border-white/10 bg-black/70' : 'border-[var(--orbit-line)] bg-[var(--orbit-bg-secondary)]/80'} backdrop-blur-xl px-4 py-3 rounded-xl shadow-2xl pointer-events-auto`}>
            <div className={`flex items-center gap-3`}>
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg border ${isDark ? 'bg-[var(--orbit-glow)]/10 text-[var(--orbit-glow)] border-[var(--orbit-glow)]/20' : 'bg-[var(--orbit-glow)]/10 text-[var(--orbit-glow)] border-[var(--orbit-glow)]/20'}`}>
                <MapPin className="h-5 w-5" />
              </div>
              <div>
                <h2 className={`text-[15px] font-semibold ${isDark ? 'text-white' : 'text-[var(--orbit-text)]'} tracking-wide`}>
                  Atlas <span className="text-zinc-500 font-light">{heatmapActive ? '| Heatmap' : '| Engine'}</span>
                </h2>
                <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-[var(--orbit-text-muted)]'}`}>
                  {heatmapActive
                    ? `${heatmapNeighborhoods.length} bairros com demanda ativa`
                    : leadName
                    ? `Filtrando para ${leadName}`
                    : `${allProperties.length} imóveis curados`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Heatmap Toggle */}
              <button
                onClick={toggleHeatmap}
                className={`flex items-center gap-2 h-8 px-3 rounded-lg border text-[11px] font-mono uppercase tracking-wider transition-all ${
                  heatmapActive
                    ? 'bg-orange-500/20 border-orange-500/50 text-orange-400 shadow-[0_0_12px_rgba(249,115,22,0.3)]'
                    : isDark
                    ? 'border-white/10 text-white/40 hover:text-white/70 hover:border-white/20'
                    : 'border-[var(--orbit-line)] text-[var(--orbit-text-muted)] hover:text-[var(--orbit-text)] hover:border-[var(--orbit-glow)]/30'
                }`}
              >
                {isLoadingHeatmap
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Flame className="h-3.5 w-3.5" />}
                Interesse
              </button>

              {/* Location Filter — só quando heatmap desativado */}
              {!heatmapActive && (
                <div className="flex items-center gap-2">
                  <Search className={`h-4 w-4 ${isDark ? 'text-zinc-500' : 'text-[var(--orbit-text-muted)]'}`} />
                  <input
                    type="text"
                    placeholder="Bairro ou Cidade..."
                    value={filterLocation}
                    onChange={(e) => setFilterLocation(e.target.value)}
                    className={`w-40 rounded-lg border py-1.5 px-3 text-xs focus:outline-none focus:ring-1 transition-all ${
                      isDark
                        ? 'border-[var(--orbit-line)] bg-white/5 text-[var(--orbit-text)] placeholder:text-[var(--orbit-text-muted)]/40 focus:border-[var(--orbit-glow)]/50 focus:ring-[var(--orbit-glow)]/50'
                        : 'border-[var(--orbit-line)] bg-[var(--orbit-bg)] text-[var(--orbit-text)] placeholder:text-[var(--orbit-text-muted)] focus:border-[var(--orbit-glow)]/50 focus:ring-[var(--orbit-glow)]/50'
                    }`}
                  />
                </div>
              )}

              <button
                onClick={closeAtlasMap}
                className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
      </div>

      {/* ── Metric Switcher — flutua abaixo do header quando heatmap ativo ── */}
      <AnimatePresence>
        {heatmapActive && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25, ease: [0.19, 1, 0.22, 1] }}
            className={`fixed top-24 left-1/2 -translate-x-1/2 z-[36] flex items-center gap-1 p-1 rounded-xl border shadow-2xl pointer-events-auto ${
              isDark ? 'bg-black/80 border-white/10 backdrop-blur-xl' : 'bg-white/90 border-[var(--orbit-line)] backdrop-blur-xl'
            }`}
          >
            {([
              { id: 'all', label: 'Total' },
              { id: 'sent', label: 'Enviados' },
              { id: 'favorited', label: 'Favoritos' },
              { id: 'visited', label: 'Visitas' },
              { id: 'deciding', label: 'Em Decisão' },
            ] as const).map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setHeatmapMetric(id)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-mono uppercase tracking-wide transition-all ${
                  heatmapMetric === id
                    ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40 shadow-[0_0_8px_rgba(249,115,22,0.25)]'
                    : isDark
                    ? 'text-white/40 hover:text-white/70 hover:bg-white/5'
                    : 'text-[var(--orbit-text-muted)] hover:text-[var(--orbit-text)] hover:bg-black/5'
                }`}
              >
                {label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Property Detail Panel: slides in from the right at z-[35] ───────── */}
      <AnimatePresence>
        {selectedProperty && (
          <motion.div 
            initial={{ x: 380, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 380, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className={`fixed right-0 top-0 h-full w-[420px] z-[35] border-l flex flex-col overflow-hidden shadow-[var(--orbit-shadow)] pointer-events-auto ${
              isDark ? 'border-[var(--orbit-line)] bg-[var(--orbit-bg-secondary)]/95 backdrop-blur-2xl' : 'border-[var(--orbit-line)] bg-[var(--orbit-bg)]/95 backdrop-blur-2xl'
            }`}
          >
              <div className="w-full h-full flex flex-col relative">
                
                {/* Visual Header do Imóvel Selecionado */}
                <div className={`relative h-48 shrink-0 border-b ${isDark ? 'border-white/5 bg-black' : 'border-[var(--orbit-line)] bg-[var(--orbit-bg-secondary)]'}`}>
                  {selectedProperty.coverImage && selectedProperty.coverImage !== "null" ? (
                    <img 
                      src={selectedProperty.coverImage} 
                      className="absolute inset-0 w-full h-full object-cover opacity-60"
                      alt="Capa"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-[var(--orbit-glow)]/20 to-transparent" />
                  )}
                  <div className={`absolute inset-0 bg-gradient-to-t via-transparent to-transparent ${isDark ? 'from-[var(--orbit-bg)]' : 'from-[var(--orbit-bg)]'}`} />
                  
                  <div className="absolute bottom-4 left-5 right-5">
                    <div className="inline-flex px-2 py-1 bg-white/10 backdrop-blur-md rounded border border-white/20 text-[10px] uppercase tracking-wider text-white/80 font-medium mb-2">
                       {selectedProperty.type || "Residencial"}
                    </div>
                    <div className="flex items-start justify-between">
                      <h3 className={`text-lg font-medium tracking-tight leading-tight line-clamp-2 ${isDark ? 'text-white drop-shadow-md' : 'text-[var(--orbit-text)]'}`}>
                        {selectedProperty.name}
                      </h3>
                      <button onClick={() => setSelectedProperty(null)} className="p-1 text-zinc-500 hover:text-white"><X size={18} /></button>
                    </div>
                    <div className="mt-1 flex items-center justify-between">
                      <p className={`text-xs font-light flex items-center gap-1 ${isDark ? 'text-zinc-400' : 'text-[var(--orbit-text-muted)]'}`}>
                        <MapPin className="w-3 h-3" /> {selectedProperty.locationText}
                      </p>
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteProperty();
                          }}
                          disabled={isDeleting}
                          className={`p-1.5 rounded-lg transition-colors ${isDark ? 'bg-white/5 text-zinc-400 hover:bg-red-500/20 hover:text-red-400' : 'bg-[var(--orbit-line)] text-[var(--orbit-text-muted)] hover:bg-red-500/10 hover:text-red-500'}`}
                          title="Excluir Imóvel"
                        >
                          {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                        <span className={`text-sm font-semibold ${isDark ? 'text-[var(--orbit-glow)]' : 'text-[var(--orbit-glow)]'}`}>
                          {formatValue(selectedProperty.value)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
                  {atlasInvokeContext?.leadId ? (
                    /* ═══ MODE: LEAD ATIVO — Match Engine + Timeline ═══ */
                    <>
                      <div className={`flex h-12 border-b ${isDark ? 'border-white/5 bg-white/5' : 'border-[var(--orbit-line)] bg-[var(--orbit-bg-secondary)]'}`}>
                        <button 
                          onClick={() => setActiveContextTab("matches")}
                          className={`flex-1 text-xs font-medium transition-colors ${activeContextTab === "matches" ? "text-[var(--orbit-text)] border-b-2 border-[var(--orbit-glow)]" : "text-[var(--orbit-text-muted)] hover:text-[var(--orbit-text)]"}`}
                        >
                          Predictive Matches
                        </button>
                        <button 
                          onClick={() => setActiveContextTab("history")}
                          className={`flex-1 text-xs font-medium transition-colors ${activeContextTab === "history" ? "text-[var(--orbit-text)] border-b-2 border-[var(--orbit-glow)]" : "text-[var(--orbit-text-muted)] hover:text-[var(--orbit-text)]"}`}
                        >
                          Histórico
                        </button>
                      </div>

                      {activeContextTab === "matches" ? (
                        <div className="p-5">
                          <div className="flex items-center gap-2 mb-4">
                            <Stars className={`w-4 h-4 ${isDark ? 'text-indigo-400' : 'text-[var(--orbit-glow)]'}`} />
                            <h4 className={`text-sm font-medium tracking-wide ${isDark ? 'text-white' : 'text-[var(--orbit-text)]'}`}>
                              Predictive Matches
                            </h4>
                          </div>
                          
                          {isMatching ? (
                            <div className="flex flex-col gap-3">
                              {[1, 2, 3].map(i => (
                                <div key={i} className="h-16 rounded-xl bg-white/5 animate-pulse border border-white/5" />
                              ))}
                            </div>
                          ) : (matches.length > 0 || atlasInvokeContext?.leadId) ? (
                            <div className="space-y-3">
                              {matches.map((match, i) => (
                                <motion.div 
                                    key={match.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.1 }}
                                    className={`group relative p-3 rounded-xl border transition-all overflow-hidden ${
                                      atlasInvokeContext?.leadId === match.id 
                                        ? 'bg-[var(--orbit-glow)]/10 border-[var(--orbit-glow)] shadow-[var(--orbit-shadow)]'
                                        : isDark ? 'bg-[var(--orbit-bg-secondary)] border-[var(--orbit-line)] hover:border-[var(--orbit-glow)]/50 hover:bg-[var(--orbit-line)]' : 'bg-[var(--orbit-bg-secondary)] border-[var(--orbit-line)] hover:border-[var(--orbit-glow)]/50 hover:bg-[var(--orbit-line)]'
                                    }`}
                                  >
                                  <div className="flex items-center gap-3 relative z-10">
                                    <div className="w-10 h-10 rounded-full border border-[var(--orbit-line)] bg-[var(--orbit-bg)] overflow-hidden shrink-0">
                                      {match.photo_url && match.photo_url !== "null" ? (
                                        <img src={match.photo_url} className="w-full h-full object-cover" alt={match.name} />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center text-[var(--orbit-text-muted)] uppercase text-xs font-bold">
                                          {match.name.substring(0,2)}
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <h5 className={`text-[13px] font-medium truncate text-[var(--orbit-text)]`}>{match.name}</h5>
                                      <p className={`text-[10px] capitalize flex items-center gap-1 text-[var(--orbit-text-muted)]`}>
                                        {match.orbit_stage || "Lead"}
                                        <span className="w-1 h-1 rounded-full bg-[var(--orbit-line)]" />
                                        AI Focus
                                      </p>
                                    </div>
                                    <div className="shrink-0 flex flex-col items-end gap-1">
                                      <span className="text-xs font-bold text-transparent bg-clip-text bg-gradient-to-r from-[var(--orbit-glow)] to-[var(--orbit-accent)]">
                                        {(match.similarity ? (match.similarity * 100).toFixed(0) : "95")}%
                                      </span>
                                      <button 
                                        onClick={() => setShowClientSpaceFor(match.id)}
                                        className={`p-1 rounded text-[9px] uppercase font-bold tracking-tighter transition-colors ${isDark ? 'bg-white/5 text-[var(--orbit-text-muted)] hover:bg-[var(--orbit-glow)]/40 hover:text-white' : 'bg-[var(--orbit-line)] text-[var(--orbit-text-muted)] hover:bg-[var(--orbit-glow)]/20 hover:text-[var(--orbit-glow)]'}`}
                                      >
                                        Selection
                                      </button>
                                    </div>
                                  </div>
                                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </motion.div>
                              ))}
                            </div>
                          ) : (
                            <div className={`p-4 rounded-xl border border-dashed flex flex-col items-center justify-center text-center gap-2 border-[var(--orbit-line)]`}>
                               <p className="text-xs text-[var(--orbit-text-muted)]">Nenhum Match Automático</p>
                               <p className="text-[10px] text-[var(--orbit-text-muted)]/60 max-w-[200px]">A IA não encontrou afinidade semântica explícita com os leads latentes.</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <PropertyTimeline propertyId={selectedProperty.id} />
                      )}
                    </>
                  ) : (
                    /* ═══ MODE: SEM LEAD — Ficha do Imóvel ═══ */
                    <div className="flex flex-col">
                      {/* Photo Carousel */}
                      {(selectedProperty.photos && selectedProperty.photos.length > 0) && (
                        <div className={`relative h-52 w-full border-b ${isDark ? 'border-white/5 bg-black' : 'border-[var(--orbit-line)] bg-[var(--orbit-bg-secondary)]'}`}>
                          <div className="absolute inset-0">
                            <PropertyCarousel photos={selectedProperty.photos || []} isDark={isDark} height="h-52" />
                          </div>
                        </div>
                      )}

                      {/* Ficha Técnica */}
                      <div className="p-5 space-y-5">
                        {/* Valor */}
                        <div>
                          <span className={`text-[9px] uppercase tracking-widest font-mono opacity-50 ${isDark ? 'text-white' : 'text-black'}`}>
                            Valor de Investimento
                          </span>
                          <div className="text-2xl font-bold tracking-tight" style={{ color: '#C9A84C' }}>
                            {selectedProperty.value 
                              ? `R$ ${selectedProperty.value.toLocaleString('pt-BR')}`
                              : 'Sob Consulta'}
                          </div>
                          {selectedProperty.condo_fee && (
                            <span className={`text-[10px] font-mono opacity-40 ${isDark ? 'text-white' : 'text-slate-600'}`}>
                              Condomínio: R$ {Number(selectedProperty.condo_fee).toLocaleString('pt-BR')}
                            </span>
                          )}
                        </div>

                        {/* Localização */}
                        <div className={`flex items-center gap-2 p-3 rounded-xl border ${isDark ? 'bg-white/3 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                          <MapPin className="w-4 h-4 opacity-40 shrink-0" />
                          <div>
                            <p className={`text-xs font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>
                              {selectedProperty.locationText || 'Endereço não informado'}
                            </p>
                            {selectedProperty.neighborhood && (
                              <p className={`text-[10px] opacity-50 ${isDark ? 'text-white' : 'text-slate-500'}`}>
                                {selectedProperty.neighborhood}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Dados Técnicos Grid */}
                        <div>
                          <h4 className={`text-[9px] uppercase tracking-widest font-mono opacity-50 mb-2.5 ${isDark ? 'text-white' : 'text-black'}`}>
                            Dados Técnicos
                          </h4>
                          <div className="grid grid-cols-2 gap-2">
                            {selectedProperty.area_privativa && (
                              <div className={`p-3 rounded-xl border flex items-center gap-2.5 ${isDark ? 'bg-white/3 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'bg-white/5' : 'bg-slate-100'}`}>
                                  <Building2 className="w-3.5 h-3.5 opacity-50" />
                                </div>
                                <div>
                                  <span className={`text-sm font-bold font-mono ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                    {Math.round(selectedProperty.area_privativa)}m²
                                  </span>
                                  <p className="text-[8px] uppercase tracking-wider opacity-40">Área Privat.</p>
                                </div>
                              </div>
                            )}
                            {selectedProperty.area_total && (
                              <div className={`p-3 rounded-xl border flex items-center gap-2.5 ${isDark ? 'bg-white/3 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'bg-white/5' : 'bg-slate-100'}`}>
                                  <Building2 className="w-3.5 h-3.5 opacity-50" />
                                </div>
                                <div>
                                  <span className={`text-sm font-bold font-mono ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                    {Math.round(selectedProperty.area_total)}m²
                                  </span>
                                  <p className="text-[8px] uppercase tracking-wider opacity-40">Área Total</p>
                                </div>
                              </div>
                            )}
                            {Number(selectedProperty.bedrooms ?? 0) > 0 && (
                              <div className={`p-3 rounded-xl border flex items-center gap-2.5 ${isDark ? 'bg-white/3 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'bg-white/5' : 'bg-slate-100'}`}>
                                  <span className="text-xs opacity-50">🛏️</span>
                                </div>
                                <div>
                                  <span className={`text-sm font-bold font-mono ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                    {selectedProperty.bedrooms}
                                  </span>
                                  <p className="text-[8px] uppercase tracking-wider opacity-40">Dormitórios</p>
                                </div>
                              </div>
                            )}
                            {Number(selectedProperty.suites ?? 0) > 0 && (
                              <div className={`p-3 rounded-xl border flex items-center gap-2.5 ${isDark ? 'bg-white/3 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'bg-white/5' : 'bg-slate-100'}`}>
                                  <span className="text-xs opacity-50">🚿</span>
                                </div>
                                <div>
                                  <span className={`text-sm font-bold font-mono ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                    {selectedProperty.suites}
                                  </span>
                                  <p className="text-[8px] uppercase tracking-wider opacity-40">Suítes</p>
                                </div>
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
                              {selectedProperty.features.map((feat, i) => (
                                <span
                                  key={i}
                                  className={`px-2.5 py-1 rounded-lg text-[10px] font-medium border ${isDark ? 'bg-white/5 border-white/10 text-white/70' : 'bg-slate-50 border-slate-100 text-slate-600'}`}
                                >
                                  {feat}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Ações */}
                        <div className={`pt-4 border-t space-y-2 ${isDark ? 'border-white/5' : 'border-[var(--orbit-line)]'}`}>
                          <h4 className={`text-[9px] uppercase tracking-widest font-mono opacity-50 mb-2.5 ${isDark ? 'text-white' : 'text-black'}`}>
                            Ações
                          </h4>
                          <div className="grid grid-cols-2 gap-2">
                            {selectedProperty.url && (
                              <a
                                href={selectedProperty.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-medium transition-all ${isDark ? 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white' : 'border-[var(--orbit-line)] bg-[var(--orbit-bg-secondary)] text-[var(--orbit-text-muted)] hover:text-[var(--orbit-text)]'}`}
                              >
                                <ExternalLink className="w-3.5 h-3.5 opacity-60" />
                                Link Original
                              </a>
                            )}
                            <button
                              onClick={() => setShowLeadSearch(!showLeadSearch)}
                              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-medium transition-all ${isDark ? 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white' : 'border-[var(--orbit-line)] bg-[var(--orbit-bg-secondary)] text-[var(--orbit-text-muted)] hover:text-[var(--orbit-text)]'}`}
                            >
                              <Share2 className="w-3.5 h-3.5 opacity-60" />
                              Enviar para Lead
                            </button>
                          </div>

                          {/* Inline Lead Search */}
                          <AnimatePresence>
                            {showLeadSearch && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                              >
                                <div className={`mt-2 p-3 rounded-xl border space-y-3 ${isDark ? 'bg-white/5 border-white/10' : 'bg-[var(--orbit-bg-secondary)] border-[var(--orbit-line)]'}`}>
                                  <div className="flex items-center gap-2">
                                    <Search className="w-3.5 h-3.5 opacity-40" />
                                    <input
                                      type="text"
                                      placeholder="Buscar lead pelo nome..."
                                      value={leadSearchQuery}
                                      onChange={(e) => setLeadSearchQuery(e.target.value)}
                                      className={`flex-1 text-xs bg-transparent focus:outline-none ${isDark ? 'text-white placeholder:text-zinc-600' : 'text-[var(--orbit-text)] placeholder:text-[var(--orbit-text-muted)]'}`}
                                    />
                                  </div>
                                  {isSearchingLeads && (
                                    <div className="flex justify-center py-2">
                                      <Loader2 className="w-4 h-4 animate-spin opacity-40" />
                                    </div>
                                  )}
                                  {searchResults.map(lead => (
                                    <button
                                      key={lead.id}
                                      onClick={() => handleSendToLead(lead)}
                                      className={`w-full flex items-center gap-2.5 p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10' : 'hover:bg-[var(--orbit-line)]'}`}
                                    >
                                      <div className="w-7 h-7 rounded-full bg-[var(--orbit-glow)]/10 flex items-center justify-center text-[9px] font-bold text-[var(--orbit-glow)]">
                                        {lead.name.substring(0, 2).toUpperCase()}
                                      </div>
                                      <div className="flex-1 text-left">
                                        <p className={`text-xs font-medium ${isDark ? 'text-white' : 'text-[var(--orbit-text)]'}`}>{lead.name}</p>
                                        <p className="text-[9px] text-[var(--orbit-text-muted)] capitalize">{lead.orbit_stage || 'Lead'}</p>
                                      </div>
                                      <ArrowRight className="w-3 h-3 opacity-30" />
                                    </button>
                                  ))}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        {/* Internal code */}
                        {selectedProperty.internal_code && (
                          <div className={`flex items-center gap-2 text-[10px] font-mono opacity-30 ${isDark ? 'text-white' : 'text-slate-500'}`}>
                            <span className="uppercase tracking-wider">Código:</span>
                            <span>{selectedProperty.internal_code}</span>
                          </div>
                        )}
                      </div>

                      {/* Timeline inline, sem tabs */}
                      <div className={`border-t ${isDark ? 'border-white/5' : 'border-[var(--orbit-line)]'}`}>
                        <PropertyTimeline propertyId={selectedProperty.id} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Confirm Action — só quando há Lead pré-selecionado */}
                {atlasInvokeContext?.onPropertySelected && (
                  <div className={`shrink-0 p-5 border-t ${isDark ? 'border-white/5 bg-[#0a0a0c]' : 'border-[var(--orbit-line)] bg-[var(--orbit-bg)]'}`}>
                    <button
                      onClick={handleConfirmSelection}
                      className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium text-sm transition-all text-white bg-[var(--orbit-glow)] hover:brightness-110 shadow-[var(--orbit-shadow)]`}
                    >
                      <Check className="w-4 h-4" />
                      Vincular a {leadName || "Lead Atual"}
                    </button>
                  </div>
                )}
              </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Neighborhood Insight Panel ─────────────────────────────────────── */}
      <NeighborhoodInsightPanel
        neighborhood={selectedNeighborhood}
        metric={heatmapMetric}
        onClose={() => setSelectedNeighborhood(null)}
        onLeadClick={(leadId) => {
          setSelectedNeighborhood(null)
          openLeadPanel(leadId)
        }}
      />

      {/* Orbit Selection Canvas (Client Spaces Manager) */}
      <AnimatePresence>
        {showClientSpaceFor && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[50] flex items-center justify-end bg-black/40 backdrop-blur-sm pointer-events-auto"
            onClick={() => setShowClientSpaceFor(null)}
          >
            <motion.div
              initial={{ x: 420 }}
              animate={{ x: 0 }}
              exit={{ x: 420 }}
              className={`w-[420px] h-full border-l shadow-2xl ${isDark ? 'bg-[#0a0a0c] border-white/10' : 'bg-[var(--orbit-bg)] border-[var(--orbit-line)]'}`}
              onClick={(e) => e.stopPropagation()}
            >
              <ClientSpacesManager 
                leadId={showClientSpaceFor} 
                onClose={() => setShowClientSpaceFor(null)} 
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

export default AtlasFocusSurface
