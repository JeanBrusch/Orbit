"use client"

import { useState, useCallback, useEffect, useRef, useMemo } from "react"
import { X, MapPin, Check, Building2, Link2, Loader2, AlertCircle, ExternalLink, Search, Stars, ArrowRight, Trash2, Share2, Users } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { type Property, type IngestionStatus, type LocationAccuracy, useOrbitContext } from "./orbit-context"
import { useSupabaseProperties } from "@/hooks/use-supabase-data"
import { getSupabase } from "@/lib/supabase"
import { useTheme } from "next-themes"
import dynamic from "next/dynamic"
import type { MapProperty } from "./atlas/MapAtlas"

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
  
  const { 
    isAtlasMapActive, 
    closeAtlasMap, 
    atlasInvokeContext,
  } = useOrbitContext()
  
  const { properties: supabaseProperties, refetch: refetchProperties } = useSupabaseProperties()
  
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
    position: { x: 50, y: 50 }, // Legacy, used by UI but irrelevant for Mapbox true coords
    url: prop.source_link,
    domain: prop.source_domain || undefined,
    ingestionStatus: prop.ingestion_status as IngestionStatus || 'ready',
    coverImage: prop.cover_image,
    lat: prop.lat,
    lng: prop.lng,
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
                  Atlas <span className="text-zinc-500 font-light">| Engine</span>
                </h2>
                <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-[var(--orbit-text-muted)]'}`}>
                  {leadName 
                    ? `Filtrando para ${leadName}`
                    : `${allProperties.length} imóveis curados`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
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
              <button
                onClick={closeAtlasMap}
                className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
              >
              </button>
            </div>
      </div>

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
                  {/* TABS DE CONTEXTO */}
                  <div className={`flex h-12 border-b ${isDark ? 'border-white/5 bg-white/5' : 'border-[var(--orbit-line)] bg-[var(--orbit-bg-secondary)]'}`}>
                    <button 
                      onClick={() => setActiveContextTab("matches")}
                      className={`flex-1 text-xs font-medium transition-colors ${activeContextTab === "matches" ? (isDark ? "text-[var(--orbit-text)] border-b-2 border-[var(--orbit-glow)]" : "text-[var(--orbit-text)] border-b-2 border-[var(--orbit-glow)]") : (isDark ? "text-[var(--orbit-text-muted)] hover:text-[var(--orbit-text)]" : "text-[var(--orbit-text-muted)] hover:text-[var(--orbit-text)]")}`}
                    >
                      Predictive Matches
                    </button>
                    <button 
                      onClick={() => setActiveContextTab("history")}
                      className={`flex-1 text-xs font-medium transition-colors ${activeContextTab === "history" ? (isDark ? "text-[var(--orbit-text)] border-b-2 border-[var(--orbit-glow)]" : "text-[var(--orbit-text)] border-b-2 border-[var(--orbit-glow)]") : (isDark ? "text-[var(--orbit-text-muted)] hover:text-[var(--orbit-text)]" : "text-[var(--orbit-text-muted)] hover:text-[var(--orbit-text)]")}`}
                    >
                      Histórico
                    </button>
                  </div>

                  {activeContextTab === "matches" ? (
                    /* Match Engine / Leads Compatíveis */
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
                                    ? isDark ? 'bg-[var(--orbit-glow)]/10 border-[var(--orbit-glow)] shadow-[var(--orbit-shadow)]' : 'bg-[var(--orbit-glow)]/10 border-[var(--orbit-glow)] shadow-[var(--orbit-shadow)]'
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
                                  <h5 className={`text-[13px] font-medium truncate ${isDark ? 'text-[var(--orbit-text)]' : 'text-[var(--orbit-text)]'}`}>{match.name}</h5>
                                  <p className={`text-[10px] capitalize flex items-center gap-1 ${isDark ? 'text-[var(--orbit-text-muted)]' : 'text-[var(--orbit-text-muted)]'}`}>
                                    {match.orbit_stage || "Lead"}
                                    <span className={`w-1 h-1 rounded-full ${isDark ? 'bg-[var(--orbit-line)]' : 'bg-[var(--orbit-line)]'}`} />
                                    AI Focus
                                  </p>
                                </div>
                                <div className="shrink-0 flex flex-col items-end gap-1">
                                  <span className={`text-xs font-bold text-transparent bg-clip-text bg-gradient-to-r from-[var(--orbit-glow)] to-[var(--orbit-accent)]`}>
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
                        <div className={`p-4 rounded-xl border border-dashed flex flex-col items-center justify-center text-center gap-2 ${isDark ? 'border-[var(--orbit-line)]' : 'border-[var(--orbit-line)]'}`}>
                           <p className="text-xs text-[var(--orbit-text-muted)]">Nenhum Match Automático</p>
                           <p className="text-[10px] text-[var(--orbit-text-muted)]/60 max-w-[200px]">A IA não encontrou afinidade semântica explícita com os leads latentes.</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <PropertyTimeline propertyId={selectedProperty.id} />
                  )}
                </div>

                {/* Confirm Action Se houver Lead já pre-selecionado (envio ativo) */}
                {atlasInvokeContext?.onPropertySelected && (
                  <div className={`shrink-0 p-5 border-t ${isDark ? 'border-white/5 bg-[#0a0a0c]' : 'border-[var(--orbit-line)] bg-[var(--orbit-bg)]'}`}>
                    <button
                      onClick={handleConfirmSelection}
                      className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium text-sm transition-all ${
                        isDark 
                          ? 'text-white bg-[var(--orbit-glow)] hover:brightness-110 shadow-[var(--orbit-shadow)]' 
                          : 'text-white bg-[var(--orbit-glow)] hover:brightness-110 shadow-[var(--orbit-shadow)]'
                      }`}
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
