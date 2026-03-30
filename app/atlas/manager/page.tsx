"use client"

import { useState, useCallback, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import type { MapProperty } from "@/components/atlas/MapAtlas"
import { useSupabaseProperties, useSupabaseLeads } from "@/hooks/use-supabase-data"
import { useAuth } from "@/hooks/use-auth"
import { motion, AnimatePresence } from "framer-motion"
import { useTheme } from "next-themes"
import { 
  Compass, Search as SearchIcon, Filter, LayoutGrid, Clock, Bell, 
  MoreHorizontal, Heart, Share2, BrainCircuit, TrendingUp, X, MapPin, Sparkles, ArrowRight, Loader2, Plus, 
  ChevronLeft, Globe, SlidersHorizontal
} from "lucide-react"
import { toast } from "sonner"
import { OrbitProvider } from "@/components/orbit-context"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Slider } from "@/components/ui/slider"

// PropertyIngestion unifica Voz e URL (Vistanet/Portais)
const PropertyIngestion = dynamic(() => import("@/components/atlas/PropertyIngestion"), { ssr: false })
const OfferGenerator = dynamic(() => import("@/components/atlas/OfferGenerator"), { ssr: false })

// ── Dynamic Mapbox (client-only) ─────────────────────────────────────────────
const MapAtlas = dynamic(
  () => import("@/components/atlas/MapAtlas").then((m) => m.MapAtlas),
  {
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 flex items-center justify-center bg-[#0a0907]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-[#d4af35]/60 border-t-[#d4af35] animate-spin" />
          <span className="text-[11px] text-[#d4af35]/60 tracking-widest uppercase font-bold">ATLAS ENGINE</span>
        </div>
      </div>
    ),
  }
)

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatValue(value: number | null): string {
  if (!value) return "N/A"
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(0)}k`
  return `R$ ${value}`
}

const glass = "bg-[#14120c]/70 backdrop-blur-md border border-[#d4af35]/15"
const glassDarker = "bg-[#0a0907]/85 backdrop-blur-xl border border-[#d4af35]/10"

function calculateSignalStrength(prop: any): number {
  let score = 50 
  if (prop.lat && prop.lng) score += 15
  if (prop.cover_image) score += 10
  if (prop.value && prop.value > 0) score += 15
  if (prop.features && prop.features.length > 0) score += 10
  return Math.min(score, 98)
}

function AtlasManagerContent() {
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const { isLoading: authLoading, isAuthenticated } = useAuth()
  const { properties, loading: propsLoading, refetch } = useSupabaseProperties()

  // State
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedProperty, setSelectedProperty] = useState<any | null>(null)
  const [placingPropertyId, setPlacingPropertyId] = useState<string | null>(null)
  const [pendingCoords, setPendingCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Ingestion State
  const [isIngestModalOpen, setIsIngestModalOpen] = useState(false)

  // Filter State
  const [filters, setFilters] = useState({
    valueRange: { min: 0, max: 20000000 },
    areaRange: { min: 0, max: 1000 },
    bedrooms: 0
  })
  const [isFilterOpen, setIsFilterOpen] = useState(false)

  // Auth check
  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push("/login")
  }, [authLoading, isAuthenticated, router])

  // List filtering
  const filtered = useMemo(() => properties.filter((p) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      const matchesText = p.title?.toLowerCase().includes(q) ||
        p.internal_name?.toLowerCase().includes(q) ||
        p.location_text?.toLowerCase().includes(q)
      if (!matchesText) return false
    }
    const propVal = p.value || 0
    if (propVal < filters.valueRange.min || propVal > filters.valueRange.max) return false
    
    const propArea = p.area_privativa || p.area_total || 0
    if (propArea < filters.areaRange.min || propArea > filters.areaRange.max) return false
    
    const propBeds = p.bedrooms || 0
    if (filters.bedrooms > 0 && propBeds < filters.bedrooms) return false
    
    return true
  }), [properties, searchQuery, filters])

  const mapProperties: MapProperty[] = useMemo(() => filtered
    .filter((p) => p.lat !== null && p.lng !== null)
    .map((p) => ({
      id: p.id,
      name: p.title || p.internal_name || "Imóvel",
      lat: p.lat,
      lng: p.lng,
      value: p.value,
      locationText: p.location_text,
      coverImage: p.cover_image,
      url: p.source_link,
      features: p.features,
      area_privativa: p.area_privativa,
    })), [filtered])



  const confirmPlace = useCallback(async () => {
    if (!placingPropertyId || !pendingCoords) return
    setIsSaving(true)
    try {
      await fetch(`/api/properties/${placingPropertyId}/location`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pendingCoords),
      })
      await refetch()
      toast.success("Localização atualizada")
    } finally {
      setIsSaving(false)
      setPendingCoords(null)
      setPlacingPropertyId(null)
    }
  }, [placingPropertyId, pendingCoords, refetch])

  if (authLoading || propsLoading) return null

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#0a0907] text-[#f1f5f9]">
      {/* MAPA BASE */}
      <div className="absolute inset-0 z-0">
        <MapAtlas
          properties={mapProperties}
          selectedPropertyId={selectedProperty?.id ?? null}
          onPropertyClick={(prop) => setSelectedProperty(properties.find(p => p.id === prop.id))}
          className="absolute inset-0"
          isPlacing={!!placingPropertyId}
          onMapClick={(lat, lng) => placingPropertyId && setPendingCoords({ lat, lng })}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0907] via-transparent to-[#0a0907]/30 pointer-events-none" />
      </div>

      {/* TOP NAVIGATION */}
      <header className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-6 py-2 ${glass} rounded-full shadow-2xl`}>
        <button onClick={() => router.push('/atlas')} className="pr-4 border-r border-[#d4af35]/20 text-[#d4af35] hover:text-white transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3 pr-4">
          <Compass className="w-5 h-5 text-[#d4af35]" />
          <span className="font-bold tracking-tight text-[#d4af35]">ATLAS MANAGER</span>
        </div>
        
        <div className="hidden md:flex items-center gap-4">
          <div className="relative flex items-center border-r border-[#d4af35]/20 pr-4">
            <SearchIcon className="absolute left-3 w-3.5 h-3.5 text-[#d4af35]/60" />
            <input 
              className="bg-transparent border-none focus:ring-0 text-sm pl-9 pr-4 w-48 placeholder:text-[#d4af35]/30 focus:outline-none" 
              placeholder="Buscar Ativo..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
            <PopoverTrigger asChild>
              <button className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] uppercase tracking-wider font-bold transition-all ${
                filters.valueRange.min > 0 || filters.valueRange.max < 20000000 || filters.areaRange.min > 0 || filters.areaRange.max < 1000 || filters.bedrooms > 0 
                  ? 'bg-[#d4af35]/10 text-[#d4af35]' 
                  : 'text-zinc-400 hover:bg-[#d4af35]/10 hover:text-white'
              }`}>
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Filtros
                {(filters.valueRange.min > 0 || filters.valueRange.max < 20000000 || filters.areaRange.min > 0 || filters.areaRange.max < 1000 || filters.bedrooms > 0) && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#d4af35]" />
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent 
              className="w-80 p-5 z-[500] rounded-2xl bg-[#0a0907] border border-[#d4af35]/20 shadow-[0_20px_50px_rgba(0,0,0,0.5)] outline-none" 
              align="end" 
              sideOffset={15}
            >
              <div className="space-y-6">
                {/* PREÇO */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <h4 className="font-bold text-sm text-white">Faixa de Valor</h4>
                    <span className="text-[10px] text-[#d4af35] uppercase tracking-wider font-mono bg-[#d4af35]/10 px-2 py-1 rounded">
                      {formatValue(filters.valueRange.min)} - {filters.valueRange.max >= 20000000 ? '20M+' : formatValue(filters.valueRange.max)}
                    </span>
                  </div>
                  <Slider 
                    defaultValue={[0, 20000000]}
                    max={20000000}
                    step={100000}
                    value={[filters.valueRange.min, filters.valueRange.max]}
                    onValueChange={(vals) => setFilters({ ...filters, valueRange: { min: vals[0], max: vals[1] } })}
                    className="w-full pt-2"
                  />
                </div>

                {/* ÁREA */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <h4 className="font-bold text-sm text-white">Área Privativa</h4>
                    <span className="text-[10px] text-[#d4af35] uppercase tracking-wider font-mono bg-[#d4af35]/10 px-2 py-1 rounded">
                      {filters.areaRange.min}m² - {filters.areaRange.max >= 1000 ? '1000+m²' : `${filters.areaRange.max}m²`}
                    </span>
                  </div>
                  <Slider 
                    defaultValue={[0, 1000]}
                    max={1000}
                    step={10}
                    value={[filters.areaRange.min, filters.areaRange.max]}
                    onValueChange={(vals) => setFilters({ ...filters, areaRange: { min: vals[0], max: vals[1] } })}
                    className="w-full pt-2"
                  />
                </div>

                {/* DORMITÓRIOS */}
                <div className="space-y-3">
                  <h4 className="font-bold text-sm text-white border-b border-white/5 pb-2">Dormitórios</h4>
                  <div className="flex gap-2">
                    {[0, 1, 2, 3, 4].map((qt) => (
                      <button
                        key={`bed-${qt}`}
                        onClick={() => setFilters({ ...filters, bedrooms: qt })}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          filters.bedrooms === qt
                            ? "bg-[#d4af35] text-black"
                            : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        {qt === 0 ? 'Qualquer' : `${qt}+`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* AÇÕES */}
                <div className="flex justify-between items-center pt-2">
                  <button 
                    onClick={() => setFilters({ 
                      valueRange: { min: 0, max: 20000000 }, 
                      areaRange: { min: 0, max: 1000 }, 
                      bedrooms: 0 
                    })} 
                    className="text-[10px] text-zinc-500 hover:text-white uppercase tracking-wider font-bold"
                  >
                    Resetar
                  </button>
                  <button 
                    onClick={() => setIsFilterOpen(false)}
                    className="px-4 py-2 bg-[#d4af35]/10 text-[#d4af35] rounded-lg text-xs font-bold hover:bg-[#d4af35]/20 transition-colors"
                  >
                    Aplicar
                  </button>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <button 
            onClick={() => setIsIngestModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-[#d4af35] text-[#0a0907] rounded-lg text-xs font-bold hover:brightness-110 transition-all ml-2"
          >
            <Plus className="w-3.5 h-3.5" />
            Novo Ativo
          </button>
        </div>
      </header>

      {/* LEFT PANEL: OPPORTUNITY STREAM */}
      <aside className="fixed left-6 top-24 bottom-24 w-80 z-40 flex flex-col gap-4 pointer-events-none">
        <div className="flex-1 overflow-y-auto pr-2 space-y-3 pointer-events-auto custom-scrollbar">
          {filtered.map((prop) => (
            <div 
              key={prop.id} 
              onClick={() => setSelectedProperty(prop)}
              className={`${glassDarker} p-3 rounded-xl border-l-[3px] ${
                selectedProperty?.id === prop.id ? 'border-l-[#d4af35] bg-[#d4af35]/10' : 'border-l-transparent'
              } cursor-pointer transition-all hover:bg-[#d4af35]/5 group`}
            >
              <div className="flex gap-3 mb-2.5">
                <div className="w-16 h-16 rounded-lg bg-cover bg-center bg-zinc-800 shrink-0" style={{ backgroundImage: prop.cover_image ? `url(${prop.cover_image})` : 'none' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate text-slate-100">{formatValue(prop.value)}</p>
                  <p className="text-[10px] text-slate-400 truncate">{prop.location_text || prop.title || "Sem Localização"}</p>
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-[#d4af35]/10 pt-2">
                <span className="text-[9px] text-slate-500 uppercase font-semibold">Qualidade: {calculateSignalStrength(prop)}%</span>
                {!prop.lat && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); setPlacingPropertyId(prop.id) }}
                    className="px-2 py-0.5 bg-[#d4af35]/10 text-[#d4af35] text-[9px] font-bold rounded uppercase hover:bg-[#d4af35]/20"
                  >
                    Set Local
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* RIGHT PANEL: PROPERTY INTELLIGENCE */}
      <AnimatePresence>
        {selectedProperty && (
          <motion.aside 
            initial={{ x: 400, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 400, opacity: 0 }}
            className={`fixed right-6 top-24 bottom-24 w-96 z-40 ${glassDarker} rounded-2xl flex flex-col overflow-hidden shadow-2xl pointer-events-auto`}
          >
            <div className="relative h-48 shrink-0">
              <img src={selectedProperty.cover_image || ''} className="w-full h-full object-cover" alt="" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0a0907] to-transparent" />
              <button onClick={() => setSelectedProperty(null)} className="absolute top-4 right-4 p-2 bg-black/40 rounded-full text-white/70 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 flex-1 overflow-y-auto">
              <h2 className="text-xl font-bold text-white mb-1">{selectedProperty.title || "Imóvel sem Título"}</h2>
              <p className="text-sm text-[#d4af35] font-bold mb-4">{formatValue(selectedProperty.value)}</p>
              <div className="grid grid-cols-3 gap-2 mb-6">
                {[
                  { label: "Área", val: `${selectedProperty.area_privativa || 0}m²` },
                  { label: "Quartos", val: selectedProperty.bedrooms || 0 },
                  { label: "Suítes", val: selectedProperty.suites || 0 }
                ].map(stat => (
                  <div key={stat.label} className="bg-white/5 p-2 rounded-lg text-center">
                    <p className="text-[10px] text-zinc-500 uppercase">{stat.label}</p>
                    <p className="text-xs font-bold text-white">{stat.val}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed mb-6">{selectedProperty.description}</p>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* PLACING OVERLAY */}
      <AnimatePresence>
        {placingPropertyId && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="absolute bottom-12 left-1/2 -translate-x-1/2 z-50">
            <div className={`p-4 rounded-2xl ${glass} flex items-center gap-4`}>
              <MapPin className="text-[#d4af35] animate-bounce" />
              <span className="text-sm font-medium">Clique no mapa para posicionar</span>
              {pendingCoords && <button onClick={confirmPlace} className="px-4 py-2 bg-[#d4af35] text-black font-bold rounded-lg text-xs">Confirmar</button>}
              <button onClick={() => { setPlacingPropertyId(null); setPendingCoords(null) }} className="p-2 text-white/50 hover:text-white"><X size={16} /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isIngestModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <PropertyIngestion
              onDataExtracted={(data: any) => {
                refetch()
                setIsIngestModalOpen(false)
              }}
              onClose={() => setIsIngestModalOpen(false)}
            />
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function AtlasManagerPage() {
  return (
    <OrbitProvider>
      <AtlasManagerContent />
    </OrbitProvider>
  )
}
