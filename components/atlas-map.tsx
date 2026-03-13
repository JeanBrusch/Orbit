"use client"

import { useState, useCallback, useEffect, useRef, useMemo } from "react"
import { X, MapPin, Check, Building2, Link2, Loader2, AlertCircle, ExternalLink, Search, Stars, ArrowRight, Trash2, Share2, Users } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { type Property, type IngestionStatus, type LocationAccuracy, useOrbitContext } from "./orbit-context"
import { useSupabaseProperties } from "@/hooks/use-supabase-data"
import { getSupabase } from "@/lib/supabase"
import dynamic from "next/dynamic"
import type { MapProperty } from "./atlas/MapAtlas"

const MapAtlas = dynamic(
  () => import("./atlas/MapAtlas").then((m) => m.MapAtlas),
  { ssr: false, loading: () => <div className="flex-1 bg-[#050505] flex items-center justify-center"><div className="animate-spin h-6 w-6 border-2 border-indigo-400 border-t-transparent rounded-full" /></div> }
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
  const mapAtlasProperties = useMemo(() => supabaseProperties.map((prop): MapProperty => ({
    id: prop.id,
    name: prop.title || prop.internal_name || 'Imóvel sem nome',
    lat: prop.lat,
    lng: prop.lng,
    value: prop.value,
    locationText: prop.location_text,
    coverImage: prop.cover_image,
    url: prop.source_link,
  })), [supabaseProperties])

  const handleMapPropertyClick = useCallback((mapProp: MapProperty) => {
    const fullProp = allProperties.find(p => p.id === mapProp.id)
    if (fullProp) setSelectedProperty(fullProp)
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
      <div className="fixed top-4 left-16 right-16 z-[35] flex items-center justify-between border border-white/10 bg-black/70 backdrop-blur-xl px-4 py-3 rounded-xl shadow-2xl pointer-events-auto">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                <MapPin className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-[15px] font-semibold text-white tracking-wide">
                  Atlas <span className="text-zinc-500 font-light">| Engine</span>
                </h2>
                <p className="text-xs text-zinc-400">
                  {leadName 
                    ? `Filtrando para ${leadName}`
                    : `${allProperties.length} imóveis curados`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Bairro ou Cidade..."
                  value={filterLocation}
                  onChange={(e) => setFilterLocation(e.target.value)}
                  className="w-40 rounded-lg border border-white/10 bg-white/5 py-1.5 px-3 text-xs text-white placeholder:text-zinc-600 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all"
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
            className="fixed right-0 top-0 h-full w-[380px] z-[35] border-l border-white/10 bg-[#0a0a0c]/95 backdrop-blur-2xl flex flex-col overflow-hidden shadow-[-20px_0_50px_rgba(0,0,0,0.5)]"
          >
              <div className="w-[380px] h-full flex flex-col relative">
                
                {/* Visual Header do Imóvel Selecionado */}
                <div className="relative h-48 shrink-0 border-b border-white/5 bg-black">
                  {selectedProperty.coverImage && selectedProperty.coverImage !== "null" ? (
                    <img 
                      src={selectedProperty.coverImage} 
                      className="absolute inset-0 w-full h-full object-cover opacity-60"
                      alt="Capa"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/40 to-black" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0c] via-[#0a0a0c]/60 to-transparent" />
                  
                  <div className="absolute bottom-4 left-5 right-5">
                    <div className="inline-flex px-2 py-1 bg-white/10 backdrop-blur-md rounded border border-white/20 text-[10px] uppercase tracking-wider text-white/80 font-medium mb-2">
                       {selectedProperty.type || "Residencial"}
                    </div>
                    <h3 className="text-lg font-medium text-white leading-tight line-clamp-2 shadow-black drop-shadow-md">
                      {selectedProperty.name}
                    </h3>
                    <div className="mt-1 flex items-center justify-between">
                      <p className="text-xs text-zinc-400 font-light flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {selectedProperty.locationText}
                      </p>
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteProperty();
                          }}
                          disabled={isDeleting}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-colors"
                          title="Excluir Imóvel"
                        >
                          {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                        <span className="text-sm font-semibold text-indigo-300">
                          {formatValue(selectedProperty.value)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Match Engine / Leads Compatíveis */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Stars className="w-4 h-4 text-indigo-400" />
                    <h4 className="text-sm font-medium text-white tracking-wide">
                      Predictive Matches
                    </h4>
                  </div>
                  
                  {isMatching ? (
                    <div className="flex flex-col gap-3">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="h-16 rounded-xl bg-white/5 animate-pulse border border-white/5" />
                      ))}
                    </div>
                  ) : matches.length > 0 ? (
                    <div className="space-y-3">
                      {matches.map((match, i) => (
                        <motion.div 
                          key={match.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.1 }}
                          className="group relative p-3 rounded-xl bg-white/5 border border-white/10 hover:border-indigo-500/50 hover:bg-white/10 transition-colors overflow-hidden"
                        >
                          <div className="flex items-center gap-3 relative z-10">
                            <div className="w-10 h-10 rounded-full border border-white/20 bg-zinc-800 overflow-hidden shrink-0">
                              {match.photo_url && match.photo_url !== "null" ? (
                                <img src={match.photo_url} className="w-full h-full object-cover" alt={match.name} />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-zinc-500 uppercase text-xs font-bold">
                                  {match.name.substring(0,2)}
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h5 className="text-[13px] font-medium text-zinc-100 truncate">{match.name}</h5>
                              <p className="text-[10px] text-zinc-400 capitalize flex items-center gap-1">
                                {match.orbit_stage}
                                <span className="w-1 h-1 rounded-full bg-zinc-700" />
                                Algo Affinity
                              </p>
                            </div>
                            <div className="shrink-0 flex flex-col items-end">
                              <span className="text-xs font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-fuchsia-400">
                                {(match.similarity * 100).toFixed(0)}%
                              </span>
                            </div>
                          </div>
                          {/* Fundo de afinidade sutil */}
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl border border-dashed border-zinc-700/50 flex flex-col items-center justify-center text-center gap-2">
                       <p className="text-xs text-zinc-400">Nenhum Match Automático</p>
                       <p className="text-[10px] text-zinc-500 max-w-[200px]">A IA não encontrou afinidade semântica explícita com os leads latentes.</p>
                    </div>
                  )}
                </div>

                {/* Confirm Action Se houver Lead já pre-selecionado (envio ativo) */}
                {atlasInvokeContext?.onPropertySelected && (
                  <div className="p-5 border-t border-white/5 bg-[#0a0a0c]">
                    <button
                      onClick={handleConfirmSelection}
                      className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium text-sm text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-[0_0_20px_rgba(99,102,241,0.4)]"
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
    </>
  )
}

export default AtlasFocusSurface
