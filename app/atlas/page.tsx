"use client"

import { useState, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import type { MapProperty } from "@/components/atlas/MapAtlas"
import { useSupabaseProperties } from "@/hooks/use-supabase-data"
import { useAuth } from "@/hooks/use-auth"
import { motion, AnimatePresence } from "framer-motion"
// We'll use next-themes for safe hook checks, and lucide-react for consistent UI.
import { useTheme } from "next-themes"
import { 
  Compass, Search as SearchIcon, Filter, LayoutGrid, Clock, Bell, 
  MoreHorizontal, Heart, Share2, BrainCircuit, TrendingUp, X, MapPin, Sparkles, ArrowRight, Loader2, Plus, Link as LinkIcon
} from "lucide-react"
import { toast } from "sonner"

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
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}k`
  return `$${value}`
}

// ── Types ────────────────────────────────────────────────────────────────────
interface SupabaseProperty {
  id: string
  title: string | null
  internal_name: string | null
  cover_image: string | null
  value: number | null
  location_text: string | null
  lat: number | null
  lng: number | null
  source_link: string | null
  features?: string[]
  payment_conditions?: Record<string, any>
  area_privativa?: number
}

interface MatchResult {
  id: string
  name: string
  photo_url?: string
  orbit_stage?: string
  similarity: number
}

// ── Classes base do Stitch ───────────────────────────────────────────────────
const glass = "bg-[#14120c]/70 backdrop-blur-md border border-[#d4af35]/15"
const glassDarker = "bg-[#0a0907]/85 backdrop-blur-xl border border-[#d4af35]/10"

// Helper calculation for signal strength heuristic
function calculateSignalStrength(prop: SupabaseProperty): number {
  let score = 50 // Base score for existing
  if (prop.lat && prop.lng) score += 15
  if (prop.cover_image) score += 10
  if (prop.value && prop.value > 0) score += 15
  if (prop.features && prop.features.length > 0) score += 10
  return Math.min(score, 98) // Max 98% for realism
}

export default function AtlasPage() {
  const router = useRouter()
  const { isLoading: authLoading, isAuthenticated } = useAuth()
  const { properties, loading: propsLoading, refetch } = useSupabaseProperties()

  // State
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedProperty, setSelectedProperty] = useState<SupabaseProperty | null>(null)
  
  // Placement State
  const [placingPropertyId, setPlacingPropertyId] = useState<string | null>(null)
  const [pendingCoords, setPendingCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Matches State & Cache
  const [matches, setMatches] = useState<MatchResult[]>([])
  const [isMatching, setIsMatching] = useState(false)
  const [matchCache, setMatchCache] = useState<Record<string, MatchResult[]>>({})

  // Ingestion State
  const [isIngestModalOpen, setIsIngestModalOpen] = useState(false)
  const [ingestUrl, setIngestUrl] = useState("")
  const [ingestStatus, setIngestStatus] = useState<"idle" | "processing" | "complete" | "failed">("idle")
  const [ingestStep, setIngestStep] = useState<"url" | "review">("url")
  const [scrapedData, setScrapedData] = useState<{title: string, image: string, value: string, condo_name: string, payment: string}>({
    title: "", image: "", value: "", condo_name: "", payment: ""
  })

  // Filter State
  const [valueRange, setValueRange] = useState<{min: number, max: number}>({ min: 0, max: 20000000 })

  // Auth check
  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push("/login")
  }, [authLoading, isAuthenticated, router])

  // Golden Matches Fetcher (With Caching)
  useEffect(() => {
    if (!selectedProperty?.id) { setMatches([]); return }
    
    // Check Cache First
    if (matchCache[selectedProperty.id]) {
      setMatches(matchCache[selectedProperty.id])
      return
    }

    setIsMatching(true)
    fetch(`/api/match/property?propertyId=${selectedProperty.id}&limit=3`)
      .then(r => r.ok ? r.json() : { matches: [] })
      .then(data => {
        const results = data.matches || []
        setMatchCache(prev => ({ ...prev, [selectedProperty.id]: results }))
        setTimeout(() => { setMatches(results); setIsMatching(false) }, 400) // slight delay for UX
      })
      .catch((e) => {
        console.error("Match fetch failed", e)
        setIsMatching(false)
      })
  }, [selectedProperty?.id, matchCache])

  // Map Click (for placing property coordinates)
  const handleMapClick = useCallback((coords: { lat: number; lng: number }) => {
    if (!placingPropertyId) return
    setPendingCoords(coords)
  }, [placingPropertyId])

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
    } finally {
      setIsSaving(false)
      setPendingCoords(null)
      setPlacingPropertyId(null)
    }
  }, [placingPropertyId, pendingCoords, refetch])

  // List filtering
  const filtered = properties.filter((p) => {
    // 1. Text Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      const matchesText = p.title?.toLowerCase().includes(q) ||
        p.internal_name?.toLowerCase().includes(q) ||
        p.location_text?.toLowerCase().includes(q)
      if (!matchesText) return false
    }
    
    // 2. Value Range
    const propVal = p.value || 0
    if (propVal < valueRange.min || propVal > valueRange.max) return false

    return true
  })

  // Map markers mapping — derived from `filtered` so pins react to search + value range
  const mapProperties: MapProperty[] = filtered
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
      payment_conditions: p.payment_conditions,
      area_privativa: p.area_privativa,
    }))

  const positionedCount = mapProperties.length

  const handleIngestSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ingestUrl) return
    setIngestStatus("processing")
    
    try {
      // 1. Fetch metadata from external link
      const previewRes = await fetch("/api/link-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: ingestUrl })
      })
      const previewData = previewRes.ok ? await previewRes.json() : {}

      // Move to review Step
      setScrapedData({
        title: previewData.title || "Imóvel Extraído por IA",
        image: previewData.image || "",
        value: previewData.price ? previewData.price.toString() : "",
        condo_name: "",
        payment: ""
      })
      
      setIngestStatus("idle")
      setIngestStep("review")

    } catch(err) {
      setIngestStatus("failed")
      toast.error("Falha na Ingestão", { description: "Ocorreu um erro ao raspar a URL." })
    }
  }

  const handleConfirmIngest = async (e: React.FormEvent) => {
    e.preventDefault()
    setIngestStatus("processing")
    
    try {
      const payload = { 
        sourceLink: ingestUrl, 
        title: scrapedData.title,
        coverImage: scrapedData.image || null,
        value: parseFloat(scrapedData.value) || null,
        location_text: scrapedData.condo_name || null,
        payment_conditions: scrapedData.payment ? { custom: scrapedData.payment } : null
      }

      const res = await fetch("/api/property", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      
      if (!res.ok) throw new Error("Ingestion Failed")
      
      setIngestStatus("complete")
      toast.success("Ativo Inserido", { description: "Propriedade validada corporativamente e inserida no Vector DB." })
      await refetch()
      setTimeout(() => {
        setIsIngestModalOpen(false)
        setIngestUrl("")
        setIngestStatus("idle")
        setIngestStep("url")
        setScrapedData({ title: "", image: "", value: "", condo_name: "", payment: "" })
      }, 1500)
    } catch(err) {
      setIngestStatus("failed")
      toast.error("Falha ao Salvar", { description: "Ocorreu um erro ao inserir no banco." })
    }
  }

  if (authLoading || propsLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#0a0907]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative h-16 w-16">
            <div className="absolute inset-0 rounded-full border border-[#d4af35]/20 animate-ping" />
            <div className="absolute inset-4 rounded-full bg-[#d4af35]/20 border border-[#d4af35]" />
          </div>
          <span className="text-xs text-[#d4af35]/60 tracking-[0.3em] uppercase font-bold">ATLAS INIT</span>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) return null

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#0a0907] text-[#f1f5f9]" style={{ cursor: placingPropertyId ? "crosshair" : "default", fontFamily: "'Inter', sans-serif" }}>

      {/* ── MAPA MAPBOX BASE ──────────────────────────────────────────────────────── */}
      <div className="absolute inset-0 grayscale-[0.3]">
        <MapAtlas
          properties={mapProperties}
          selectedPropertyId={selectedProperty?.id ?? null}
          onPropertyClick={(prop) => {
            if (placingPropertyId) return
            const full = properties.find((p) => p.id === prop.id) ?? null
            setSelectedProperty(full)
          }}
          className="absolute inset-0 opacity-80"
          initialCenter={[-50.0333, -29.8]}
          initialZoom={13}
          previewMarker={pendingCoords ?? null}
          isPlacing={!!placingPropertyId}
          onMapClick={(lat, lng) => {
            if (placingPropertyId) {
              setPendingCoords({ lat, lng })
            }
          }}
        />
        {/* Subtle dark gradient overlay as in Stitch design, hidden in Light mode */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0907] via-transparent to-[#0a0907]/60 pointer-events-none z-0 dark:block hidden" />
      </div>

      {/* ── 1. TOP CONTEXT BAR ─────────────────────────────────────────────────────── */}
      <header className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-6 py-2 ${glass} rounded-full w-fit max-w-[95%] shadow-[0_20px_40px_rgba(0,0,0,0.5)]`}>
        <div className="flex items-center gap-3 border-r border-[#d4af35]/20 pr-4 cursor-pointer" onClick={() => router.push('/')}>
          <Compass className="w-5 h-5 text-[#d4af35]" />
          <span className="font-bold tracking-tight text-[#d4af35]">ATLAS</span>
          <span className="bg-[#d4af35]/20 text-[#d4af35] text-[10px] px-2 py-0.5 rounded-full font-bold">LIVE</span>
        </div>
        
        <div className="hidden md:flex items-center gap-2 px-2">
          <span className="text-xs text-[#d4af35]/60 font-medium uppercase tracking-widest">Global</span>
          <span className="text-sm font-semibold">{positionedCount} Imóveis</span>
        </div>
        
        <div className="hidden md:block h-6 w-[1px] bg-[#d4af35]/20"></div>
        
        <div className="flex items-center gap-4">
          <div className="relative hidden sm:flex items-center">
            <SearchIcon className="absolute left-3 w-3.5 h-3.5 text-[#d4af35]/60" />
            <input 
              className="bg-transparent border-none focus:ring-0 text-sm pl-9 pr-4 w-40 md:w-32 placeholder:text-[#d4af35]/30 focus:outline-none" 
              placeholder="Buscar Ativo..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              type="text"
            />
          </div>

          {/* Value Filter Segment */}
          <div className="hidden lg:flex items-center gap-2 bg-[#0a0907]/60 px-3 py-1.5 rounded-xl border border-[#d4af35]/20 shadow-inner">
             <span className="text-[9px] font-bold text-[#d4af35] uppercase tracking-wider mr-1">R$</span>
             <input 
               type="number" 
               placeholder="Min" 
               value={valueRange.min === 0 ? "" : valueRange.min}
               onChange={(e) => setValueRange({ ...valueRange, min: e.target.value ? Number(e.target.value) : 0 })}
               className="w-20 bg-transparent border-none p-0 text-xs font-semibold text-white placeholder-slate-600 focus:ring-0 text-right" 
             />
             <span className="text-slate-500 font-bold px-1 text-xs">-</span>
             <input 
               type="number" 
               placeholder="Max" 
               value={valueRange.max === 20000000 ? "" : valueRange.max}
               onChange={(e) => setValueRange({ ...valueRange, max: e.target.value ? Number(e.target.value) : 20000000 })}
               className="w-20 bg-transparent border-none p-0 text-xs font-semibold text-white placeholder-slate-600 focus:ring-0 text-left" 
             />
          </div>

          <button 
            onClick={() => setIsIngestModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#d4af35] text-[#0a0907] rounded-lg text-xs font-bold hover:brightness-110 transition-all shadow-[0_0_15px_rgba(212,175,53,0.3)] shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Novo Ativo</span>
          </button>
        </div>

        <div className="h-6 w-[1px] bg-[#d4af35]/20"></div>
        
        <div className="flex items-center gap-3 pl-2">
          <div className="size-8 rounded-full bg-[#d4af35]/10 border border-[#d4af35]/20 flex items-center justify-center cursor-pointer hover:bg-[#d4af35]/20 transition-colors">
            <Bell className="w-4 h-4 text-[#d4af35]" />
          </div>
          <div className="size-8 rounded-full overflow-hidden border border-[#d4af35]/30 cursor-pointer">
            <div className="w-full h-full bg-[#d4af35] flex items-center justify-center text-xs text-[#0a0907] font-bold">ME</div>
          </div>
        </div>
      </header>

      {/* ── INGESTION MODAL ──────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isIngestModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className={`w-full max-w-md ${glassDarker} dark:bg-[#0a0907] bg-white rounded-2xl p-6 shadow-2xl overflow-hidden relative border border-[#d4af35]/30`}
            >
              {(ingestStatus === "processing" || ingestStatus === "complete") && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-[#d4af35]/20">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: ingestStatus === "complete" ? "100%" : "85%" }}
                    transition={{ duration: ingestStatus === "complete" ? 0.3 : 10, ease: "circOut" }}
                    className="h-full bg-[#d4af35]"
                  />
                </div>
              )}

              <div className="flex justify-between items-center mb-5">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-[#d4af35]" />
                  <h3 className="font-bold text-lg dark:text-white text-zinc-900 tracking-tight">Ingerir Ativo</h3>
                </div>
                <button 
                  onClick={() => { 
                    setIsIngestModalOpen(false); 
                    setIngestStatus("idle"); 
                    setIngestUrl(""); 
                    setIngestStep("url"); 
                  }} 
                  disabled={ingestStatus === "processing"}
                  className="text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {ingestStep === "url" ? (
                <>
                  <p className="text-sm dark:text-slate-400 text-slate-600 mb-6 font-medium">
                    Cole o link de um imóvel de qualquer portal (ZAP, VivaReal, etc). O Orbit Engine extrairá dados e fotos para validação antes da indexação.
                  </p>

              <form onSubmit={handleIngestSubmit} className="space-y-4">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <LinkIcon className="h-4 w-4 dark:text-slate-500 text-slate-400" />
                  </div>
                  <input
                    type="url"
                    required
                    value={ingestUrl}
                    onChange={(e) => setIngestUrl(e.target.value)}
                    disabled={ingestStatus !== "idle" && ingestStatus !== "failed"}
                    className="block w-full pl-10 pr-3 py-3 border dark:border-zinc-800 border-zinc-200 rounded-xl leading-5 dark:bg-zinc-900/50 bg-zinc-50 dark:text-slate-200 text-zinc-900 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#d4af35] focus:border-[#d4af35] sm:text-sm transition-all shadow-inner focus:shadow-[0_0_15px_rgba(212,175,53,0.15)] disabled:opacity-50"
                    placeholder="https://imobiliaria.com.br/imovel/123"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={ingestStatus === "processing" || !ingestUrl || ingestStatus === "complete"}
                    className="w-full flex justify-center py-3 px-4 rounded-xl shadow-lg border border-transparent text-sm font-bold text-[#0a0907] bg-[#d4af35] hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#d4af35] focus:ring-offset-[#0a0907] disabled:opacity-50 transition-all"
                  >
                    {ingestStatus === "processing" ? (
                      <span className="flex items-center gap-2 pt-0.5"><Loader2 className="w-4 h-4 animate-spin"/> Extraindo Metadados...</span>
                    ) : ingestStatus === "failed" ? (
                      "Tentar Novamente"
                    ) : (
                      "Buscar Dados Primários"
                    )}
                  </button>
                </div>
              </form>
              </>
              ) : (
              <form onSubmit={handleConfirmIngest} className="space-y-4 animate-in fade-in zoom-in duration-300">
                <div className="flex gap-4 items-center p-3 rounded-lg bg-zinc-900/40 border border-[#d4af35]/10">
                  <div className="w-16 h-16 rounded bg-zinc-800 bg-cover bg-center shrink-0 border border-white/5" style={{ backgroundImage: scrapedData.image ? `url(${scrapedData.image})` : 'none' }}></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-0.5">Scraped Title</p>
                    <input 
                      type="text" 
                      value={scrapedData.title}
                      onChange={(e) => setScrapedData({...scrapedData, title: e.target.value})}
                      className="w-full bg-transparent border-none p-0 text-sm font-semibold focus:ring-0" 
                      placeholder="Título extraído..." 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Valor do Imóvel (R$)</label>
                    <input
                      type="number"
                      value={scrapedData.value}
                      onChange={(e) => setScrapedData({...scrapedData, value: e.target.value})}
                      className="w-full px-3 py-2 border dark:border-zinc-800 border-zinc-200 rounded-lg dark:bg-zinc-900/50 bg-zinc-50 dark:text-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#d4af35]"
                      placeholder="Ex: 1500000"
                    />
                  </div>
                  <div>
                     <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Nome do Condomínio</label>
                    <input
                      type="text"
                      value={scrapedData.condo_name}
                      onChange={(e) => setScrapedData({...scrapedData, condo_name: e.target.value})}
                      className="w-full px-3 py-2 border dark:border-zinc-800 border-zinc-200 rounded-lg dark:bg-zinc-900/50 bg-zinc-50 dark:text-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#d4af35]"
                      placeholder="Cond. Enseada"
                    />
                  </div>
                </div>
                
                <div className="mb-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Condições de Pagamento</label>
                    <input
                      type="text"
                      value={scrapedData.payment}
                      onChange={(e) => setScrapedData({...scrapedData, payment: e.target.value})}
                      className="w-full px-3 py-2 border dark:border-zinc-800 border-zinc-200 rounded-lg dark:bg-zinc-900/50 bg-zinc-50 dark:text-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#d4af35]"
                      placeholder="Ex: Aceita 30% e saldo em 36x"
                    />
                </div>

                <div className="pt-4 flex gap-2">
                   <button
                    type="button"
                    onClick={() => { setIngestStep("url"); setIngestStatus("idle") }}
                    disabled={ingestStatus === "processing"}
                    className="px-4 py-2.5 rounded-xl border border-zinc-700 text-xs font-bold text-slate-300 hover:bg-zinc-800 disabled:opacity-50 transition-all"
                  >
                    Voltar
                  </button>
                  <button
                    type="submit"
                    disabled={ingestStatus === "processing" || ingestStatus === "complete"}
                    className="flex-1 flex justify-center py-2.5 px-4 rounded-xl shadow-lg text-sm font-bold text-[#0a0907] bg-[#d4af35] hover:brightness-110 focus:outline-none disabled:opacity-50 transition-all"
                  >
                    {ingestStatus === "processing" ? (
                      <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin"/> Gerando Embeddings DB...</span>
                    ) : ingestStatus === "complete" ? (
                      <span className="flex items-center gap-2 pt-0.5"><Sparkles className="w-4 h-4"/> Rastreamento Iniciado</span>
                    ) : (
                       "Confirmar Validação Inteligente"
                    )}
                  </button>
                </div>
              </form>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── PLACING MODE OVERLAY ───────────────────────────────────────────────────── */}
      <AnimatePresence>
        {placingPropertyId && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="absolute bottom-24 left-1/2 z-50 -translate-x-1/2">
            <div className={`flex items-center gap-3 rounded-2xl ${glass} px-5 py-3 shadow-2xl`}>
              <MapPin className="h-4 w-4 text-[#d4af35] animate-bounce shrink-0" />
              <span className="text-sm text-[#d4af35]/80 font-medium">Clique no mapa para posicionar</span>
              <button onClick={() => { setPlacingPropertyId(null); setPendingCoords(null) }} className="ml-2 text-white/50 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {pendingCoords && placingPropertyId && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="absolute bottom-40 left-1/2 -translate-x-1/2 z-50">
            <div className={`flex items-center gap-3 rounded-xl ${glassDarker} px-4 py-2.5 shadow-2xl`}>
              <span className="text-xs text-[#d4af35]/60 font-mono">{pendingCoords.lat.toFixed(4)}, {pendingCoords.lng.toFixed(4)}</span>
              <button onClick={confirmPlace} disabled={isSaving} className="flex items-center gap-1.5 rounded-lg bg-[#d4af35] px-3 py-1 text-xs font-bold text-[#0a0907] hover:brightness-110 transition-all disabled:opacity-50">
                {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : null} Confirmar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>


      {/* ── 2. OPPORTUNITY STREAM (Left Panel) ────────────────────────────────────── */}
      <aside className="fixed left-6 top-24 bottom-24 w-80 z-40 flex flex-col gap-4 pointer-events-none">
        <div className="flex items-center justify-between px-2 pointer-events-auto">
          <h3 className="text-xs font-bold tracking-widest text-[#d4af35]/80 uppercase">Fluxo de Oportunidades</h3>
          <MoreHorizontal className="w-4 h-4 text-[#d4af35]/60" />
        </div>
        
        <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar pointer-events-auto">
          {filtered.map((prop, idx) => {
            const hasCoords = prop.lat !== null && prop.lng !== null
            const isSelected = selectedProperty?.id === prop.id
            const isPlacing = placingPropertyId === prop.id

            // Randomize Badges for mockup/visual richness based on id hash logic
            const badgeType = prop.value ? (prop.value > 2000000 ? 'NOVO' : 'OPORTUNIDADE') : 'QUEDA DE PREÇO'
            const badgeColor = badgeType === 'OPORTUNIDADE' ? 'text-[#d4af35] bg-[#d4af35]/10 border-[#d4af35]' : badgeType === 'QUEDA DE PREÇO' ? 'text-blue-400 bg-blue-400/10 border-blue-400' : 'text-slate-300 bg-slate-700 border-slate-500'

            return (
              <div 
                key={prop.id} 
                onClick={() => setSelectedProperty(prop)}
                className={`${glassDarker} p-3 rounded-xl border-l-[3px] ${
                  isSelected ? 'border-l-[#d4af35] bg-[#d4af35]/10' : 
                  !hasCoords ? 'border-l-slate-700/50' : 
                  badgeType === 'QUEDA DE PREÇO' ? 'border-l-blue-400 hover:bg-blue-400/5' : 'border-l-[#d4af35] hover:bg-[#d4af35]/5'
                } cursor-pointer transition-all group`}
              >
                <div className="flex gap-3 mb-2.5">
                  <div className="w-16 h-16 rounded-lg bg-cover bg-center bg-zinc-800 shrink-0" style={{ backgroundImage: prop.cover_image ? `url(${prop.cover_image})` : 'none' }}>
                    {!prop.cover_image && <div className="w-full h-full flex items-center justify-center text-[#d4af35]/30"><Compass className="w-6 h-6"/></div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${badgeColor}`}>{badgeType}</span>
                      <span className="text-[9px] text-slate-500">Ativo</span>
                    </div>
                    <p className={`text-sm font-bold mt-1 truncate ${badgeType === 'QUEDA DE PREÇO' ? 'text-blue-400' : 'text-slate-100'}`}>
                      {formatValue(prop.value)}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">{prop.location_text || prop.title || "Sem Localização"}</p>
                  </div>
                </div>
                
                <div className="flex items-center justify-between border-t border-[#d4af35]/10 pt-2">
                  <div className="flex flex-col">
                    <span className="text-[9px] text-slate-500 uppercase font-semibold">Qualidade de Dados</span>
                    <span className="text-xs font-bold text-emerald-400">{calculateSignalStrength(prop)}%</span>
                  </div>
                  
                  {/* Action button if no coords */}
                  {!hasCoords ? (
                    <button 
                      onClick={(e) => { e.stopPropagation(); setPlacingPropertyId(isPlacing ? null : prop.id) }} 
                      className={`px-3 py-1 rounded text-[10px] font-bold uppercase transition-colors ${isPlacing ? 'bg-[#d4af35] text-[#0a0907]' : 'bg-[#d4af35]/10 text-[#d4af35] hover:bg-[#d4af35]/20'}`}
                    >
                      {isPlacing ? 'Cancelar' : 'Definir Local'}
                    </button>
                  ) : (
                    <div className="w-20 h-6 opacity-60">
                      <svg className="w-full h-full" viewBox="0 0 100 30">
                        <path className="opacity-80 drop-shadow-[0_0_5px_#d4af35]" d="M0 25 Q 25 25, 40 10 T 70 20 T 100 5" fill="none" stroke={badgeType==='QUEDA DE PREÇO'?'#60a5fa':'#d4af35'} strokeWidth="2"></path>
                      </svg>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </aside>

      {/* ── 3. PROPERTY INTELLIGENCE (Right Panel) ───────────────────────────────── */}
      <AnimatePresence>
        {selectedProperty && (
          <motion.aside 
            initial={{ x: 400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 400, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className={`fixed right-6 top-24 bottom-24 w-96 z-40 ${glassDarker} rounded-2xl flex flex-col overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)]`}
          >
            {/* Hero Image */}
            <div className="relative h-48 shrink-0">
              <img 
                className="w-full h-full object-cover" 
                src={selectedProperty.cover_image || 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&q=80'} 
                alt=""
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0a0907] to-transparent"></div>
              
              <button onClick={() => setSelectedProperty(null)} className="absolute top-4 left-4 size-8 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center text-white/70 hover:text-white border border-white/10 transition-all z-10">
                <X className="w-4 h-4" />
              </button>

              <button className="absolute top-4 right-4 size-8 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-[#d4af35]/30 hover:bg-[#d4af35]/20 transition-all z-10">
                <Heart className="w-4 h-4" />
              </button>

              <div className="absolute bottom-4 left-5 right-5">
                <h2 className="text-lg font-bold leading-tight">{selectedProperty.title || selectedProperty.internal_name}</h2>
                <p className="text-[11px] text-slate-300 mt-1">{selectedProperty.location_text}</p>
              </div>
            </div>

            {/* Details & Intelligence */}
            <div className="p-5 flex-1 overflow-y-auto space-y-6 custom-scrollbar">
              <div className="flex items-end justify-between">
                <div>
                  <span className="text-[9px] uppercase tracking-widest text-[#d4af35] font-bold">Valor Atual</span>
                  <p className="text-3xl font-bold tracking-tight text-white">{formatValue(selectedProperty.value)}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-emerald-400 flex items-center justify-end font-bold">
                    <TrendingUp className="w-3.5 h-3.5 mr-1" /> 4.2%
                  </span>
                  <p className="text-[10px] text-slate-500 italic mt-0.5">vs média da região</p>
                </div>
              </div>

              {/* Real Property Data */}
              <div className="grid grid-cols-2 gap-3">
                <div className={`${glass} p-3 rounded-lg flex flex-col items-center bg-[#14120c]/40 dark:bg-[#14120c]/40 bg-white/40`}>
                  <span className="text-[8px] uppercase text-slate-500 font-bold mb-1.5 tracking-wider">Área Privativa</span>
                  <div className="flex items-center justify-center">
                    <span className="text-[14px] font-bold dark:text-white text-zinc-900">{selectedProperty.area_privativa ? `${selectedProperty.area_privativa} m²` : 'N/A'}</span>
                  </div>
                </div>
                <div className={`${glass} p-3 rounded-lg flex flex-col items-center bg-[#14120c]/40 dark:bg-[#14120c]/40 bg-white/40`}>
                  <span className="text-[8px] uppercase text-slate-500 font-bold mb-1.5 tracking-wider">Condições</span>
                  <div className="flex flex-col items-center justify-center gap-1">
                     {selectedProperty.payment_conditions?.financing && <span className="text-[10px] font-bold text-emerald-500">Aceita Financiamento</span>}
                     {selectedProperty.payment_conditions?.exchange && <span className="text-[10px] font-bold text-blue-400">Estuda Permuta</span>}
                     {!selectedProperty.payment_conditions?.financing && !selectedProperty.payment_conditions?.exchange && <span className="text-[10px] font-bold text-slate-400">Padrão</span>}
                  </div>
                </div>
              </div>
              
              {selectedProperty.features && selectedProperty.features.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {selectedProperty.features.slice(0, 6).map((f, i) => (
                    <span key={i} className="text-[9px] px-2 py-1 rounded bg-[#d4af35]/10 text-[#d4af35] border border-[#d4af35]/20 font-medium">
                      {f}
                    </span>
                  ))}
                  {selectedProperty.features.length > 6 && (
                    <span className="text-[9px] px-2 py-1 rounded bg-zinc-800/50 text-zinc-400 border border-zinc-700/50 font-medium">
                      +{selectedProperty.features.length - 6}
                    </span>
                  )}
                </div>
              )}

              {/* Orbit AI Predictive Matches (replaces the text block from Stitch for real functionality) */}
              <div className="bg-[#d4af35]/5 border border-[#d4af35]/20 rounded-xl p-4 relative overflow-hidden">
                {/* Decorative background glow */}
                <div className="absolute -top-10 -right-10 w-24 h-24 bg-[#d4af35]/20 blur-2xl rounded-full pointer-events-none"></div>
                
                <div className="flex items-center gap-2 mb-3">
                  <BrainCircuit className="w-4 h-4 text-[#d4af35]" />
                  <span className="text-[11px] font-bold text-[#d4af35] uppercase tracking-wider">Leads Preditos (Match Semântico)</span>
                </div>

                {isMatching ? (
                  <div className="space-y-3">
                    {[1, 2].map(i => <div key={i} className="h-10 rounded bg-[#d4af35]/10 animate-pulse border border-[#d4af35]/5" />)}
                  </div>
                ) : matches.length > 0 ? (
                  <div className="space-y-2">
                    {matches.map(m => (
                      <div key={m.id} className="flex items-center gap-3 bg-[#0a0907]/60 border border-[#d4af35]/10 p-2 rounded-lg group hover:border-[#d4af35]/40 transition-colors cursor-pointer">
                        <div className="w-8 h-8 rounded border border-white/10 bg-zinc-800 overflow-hidden shrink-0">
                           {m.photo_url ? <img src={m.photo_url} className="w-full h-full object-cover" alt="" /> : <span className="text-[9px] uppercase w-full h-full flex items-center justify-center font-bold text-zinc-600">{m.name.substring(0,2)}</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-bold text-slate-200 truncate">{m.name}</p>
                          <p className="text-[9px] text-[#d4af35] flex items-center gap-1">Afinidade {(m.similarity * 100).toFixed(0)}%</p>
                        </div>
                        <button className="w-6 h-6 rounded bg-[#d4af35]/20 text-[#d4af35] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] leading-relaxed text-slate-400 border-l-2 border-[#d4af35] pl-3 py-1 bg-black/20">
                    Nenhum lead latente com alta afinidade encontrado no vector database para este ativo.
                  </p>
                )}
              </div>

              {/* Removed Static History Chart */}
            </div>

            {/* Actions */}
            <div className="p-4 bg-[#14120c] dark:bg-[#14120c] bg-white border-t border-[#d4af35]/20 flex gap-2">
              <button 
                onClick={() => toast.success("Offer Engine Started", { description: "IA está formulando uma abordagem de venda..." })}
                className="flex-1 py-2.5 bg-[#d4af35] text-[#0a0907] font-bold text-xs uppercase tracking-wider rounded-lg hover:brightness-110 shadow-[0_0_20px_rgba(212,175,53,0.3)] transition-all"
              >
                Generate Offer
              </button>
              <button 
                onClick={() => {
                   navigator.clipboard.writeText(selectedProperty.source_link || "")
                   toast.info("Link Copied")
                }}
                className={`px-4 py-2 ${glass} rounded-lg flex items-center justify-center hover:bg-[#d4af35]/20 transition-colors`}
              >
                <Share2 className="w-4 h-4 text-[#d4af35]" />
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* ── 4. OPPORTUNITY RADAR (Bottom Center) ─────────────────────────────────── */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-2 pointer-events-none">
        <div className={`relative size-28 ${glass} rounded-full flex items-center justify-center border-2 border-[#d4af35]/30 shadow-[0_0_30px_rgba(212,175,53,0.1)]`}>
          {/* Radar Sweep */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-[#d4af35]/20 to-transparent animate-spin" style={{ animationDuration: '4s' }}></div>
          {/* Circles */}
          <div className="absolute size-20 border border-[#d4af35]/10 rounded-full"></div>
          <div className="absolute size-10 border border-[#d4af35]/10 rounded-full"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-1 bg-[#d4af35] shadow-[0_0_10px_#d4af35] rounded-full"></div>
          
          <div className="z-10 text-center mt-0.5">
            <p className="text-[7px] font-bold text-[#d4af35]/60 uppercase tracking-widest drop-shadow-md">Pulse</p>
            <p className="text-[9px] font-bold text-white drop-shadow-md tracking-wider">LIVE</p>
          </div>
        </div>
      </div>

      {/* ── 5. MAP SIGNAL LEGEND (Bottom Left) ───────────────────────────────────── */}
      <div className={`fixed bottom-8 left-6 z-40 ${glass} p-3 px-4 rounded-xl flex items-center gap-5 shadow-2xl`}>
        <div className="flex items-center gap-2">
          <div className="size-2 bg-[#d4af35] rounded-full shadow-[0_0_8px_#d4af35]"></div>
          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-300">Undervalued</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="size-2 bg-blue-400 rounded-full shadow-[0_0_8px_#60a5fa]"></div>
          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-300">Price Drop</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="size-2 bg-slate-400 rounded-full"></div>
          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Neutral</span>
        </div>
      </div>

      {/* Custom scrollbar for local panels */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(212,175,53,0.15); border-radius: 99px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(212,175,53,0.3); }
      `}</style>
    </div>
  )
}
