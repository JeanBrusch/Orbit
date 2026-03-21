"use client"

import { useState, useCallback, useEffect, useMemo, useRef } from "react"
import dynamic from "next/dynamic"
import { motion, AnimatePresence } from "framer-motion"
import { 
  X, Search, MapPin, Loader2, Flame, BarChart3,
  Users, TrendingUp, ArrowRight, Building2, Sparkles, Check
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSupabaseProperties } from "@/hooks/use-supabase-data"
import { useTheme } from "next-themes"
import type { MapProperty } from "@/components/atlas/MapAtlas"
import { HeatmapLayer } from "@/components/atlas/HeatmapLayer"

// ── Dynamic Mapbox ───────────────────────────────────────────────────────────
const MapAtlas = dynamic(
  () => import("@/components/atlas/MapAtlas").then((m) => m.MapAtlas),
  {
    ssr: false,
    loading: () => {
      return (
        <div className="flex items-center justify-center w-full h-full bg-[#0a0907]">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 rounded-full border-2 animate-spin border-[#d4af35]/60 border-t-[#d4af35]" />
            <span className="text-[10px] tracking-widest uppercase font-mono text-[#d4af35]/60">Carregando Atlas...</span>
          </div>
        </div>
      )
    },
  }
)

interface MapModalProps {
  isOpen: boolean
  onClose: () => void
  selectedIds: Set<string>
  onToggleSelect: (prop: any) => void
}

type HeatmapMetric = "all" | "sent" | "favorited" | "visited" | "deciding"

const METRIC_LABELS: Record<HeatmapMetric, string> = {
  all: "Total",
  sent: "Enviados",
  favorited: "Favoritos",
  visited: "Visitas",
  deciding: "Em Decisão",
}

// Score → cor heatmap
function getScoreColor(score: number) {
  if (score >= 80) return "#ff3030"
  if (score >= 60) return "#ff7820"
  if (score >= 40) return "#ffc830"
  if (score >= 20) return "#00e6b4"
  return "#00d4ff"
}

export default function MapModal({ isOpen, onClose, selectedIds, onToggleSelect }: MapModalProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const mapRef = useRef<any>(null)

  const glass = isDark 
    ? "bg-[#14120c]/70 backdrop-blur-md border border-[#d4af35]/15 text-white"
    : "bg-[var(--orbit-bg)]/80 backdrop-blur-md border border-[var(--orbit-line)] text-[var(--orbit-text)]"
    
  const glassDarker = isDark
    ? "bg-[#0a0907]/85 backdrop-blur-xl border border-[#d4af35]/10 text-white"
    : "bg-[var(--orbit-bg-secondary)]/90 backdrop-blur-xl border border-[var(--orbit-line)] text-[var(--orbit-text)]"

  const { properties, loading: propsLoading } = useSupabaseProperties()
  const [selectedProperty, setSelectedProperty] = useState<any | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  // ── Heatmap State ─────────────────────────────────────────────────────────
  const [heatmapActive, setHeatmapActive] = useState(false)
  const [heatmapMetric, setHeatmapMetric] = useState<HeatmapMetric>("all")
  const [heatmapGeoJSON, setHeatmapGeoJSON] = useState<any>(null)
  const [heatmapNeighborhoods, setHeatmapNeighborhoods] = useState<any[]>([])
  const [isLoadingHeatmap, setIsLoadingHeatmap] = useState(false)
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<any>(null)

  const filtered = useMemo(() => {
    return properties?.filter(p => 
      !searchQuery || 
      p.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.location_text?.toLowerCase().includes(searchQuery.toLowerCase())
    ) || []
  }, [properties, searchQuery])

  const mapProperties: MapProperty[] = useMemo(() => {
    return filtered
      .filter(p => p.lat !== null && p.lng !== null)
      .map(p => ({
        id: p.id,
        name: p.title || p.internal_name || "Imóvel",
        lat: p.lat,
        lng: p.lng,
        value: p.value,
        locationText: p.location_text,
        coverImage: p.cover_image,
      }))
  }, [filtered])

  // ── Fetch heatmap data ────────────────────────────────────────────────────
  const fetchHeatmap = useCallback(async (metric: string) => {
    setIsLoadingHeatmap(true)
    try {
      const res = await fetch(`/api/atlas/heatmap?metric=${metric}&days=30`)
      const data = await res.json()
      setHeatmapGeoJSON(data.geojson || null)
      setHeatmapNeighborhoods(data.neighborhoods || [])
    } catch (err) {
      console.error("[HEATMAP] Erro:", err)
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

  // Clique no mapa → bairro mais próximo
  const handleHeatmapMapClick = useCallback((lat: number, lng: number) => {
    if (!heatmapActive || heatmapNeighborhoods.length === 0) return
    const closest = heatmapNeighborhoods.reduce((prev: any, curr: any) => {
      const prevDist = Math.abs(prev.lat - lat) + Math.abs(prev.lng - lng)
      const currDist = Math.abs(curr.lat - lat) + Math.abs(curr.lng - lng)
      return currDist < prevDist ? curr : prev
    })
    setSelectedNeighborhood(closest)
    setSelectedProperty(null)
  }, [heatmapActive, heatmapNeighborhoods])

  if (!isOpen) return null

  const scoreColor = selectedNeighborhood ? getScoreColor(selectedNeighborhood.score) : "#00d4ff"

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={`fixed inset-0 z-[100] ${isDark ? 'bg-[#0a0907]' : 'bg-[var(--orbit-bg)]'} flex flex-col md:flex-row overflow-hidden`}
      >
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 z-[110] p-3 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white transition-all shadow-2xl"
        >
          <X className="h-6 w-6" />
        </button>

        {/* Map Area */}
        <div className="flex-1 relative order-2 md:order-1">
          <MapAtlas 
            ref={mapRef}
            properties={heatmapActive ? [] : mapProperties}
            selectedPropertyId={selectedProperty?.id || null}
            onPropertyClick={(p) => {
              if (heatmapActive) return
              const full = properties.find(prop => prop.id === p.id)
              setSelectedProperty(full)
            }}
            onMapClick={heatmapActive ? handleHeatmapMapClick : undefined}
            heatmapVisible={heatmapActive}
            heatmapGeoJSON={heatmapGeoJSON}
            heatmapMetric={heatmapMetric}
            className="w-full h-full"
            initialCenter={[-50.0333, -29.8]}
            initialZoom={13}
          />
          
          {/* Search Bar */}
          {!heatmapActive && (
            <div className="absolute top-6 left-6 z-[110] w-64 hidden md:block">
              <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${glass} shadow-2xl`}>
                <Search className={`h-4 w-4 ${isDark ? 'text-[#d4af35]' : 'text-[var(--orbit-glow)]'}`} />
                <input 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Explorar mapa..."
                  className="bg-transparent border-none text-xs focus:ring-0 placeholder:text-white/30 w-full outline-none"
                />
              </div>
            </div>
          )}

          {/* Heatmap Toggle Button — flutuante no topo centro */}
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[110] hidden md:flex items-center gap-2">
            <button
              onClick={toggleHeatmap}
              className={`flex items-center gap-2 h-9 px-4 rounded-full border text-[11px] font-mono uppercase tracking-wider transition-all shadow-2xl ${
                heatmapActive
                  ? 'bg-orange-500/25 border-orange-500/60 text-orange-400 shadow-[0_0_20px_rgba(249,115,22,0.4)]'
                  : isDark
                  ? 'bg-[#14120c]/80 border-[#d4af35]/20 text-[#d4af35]/60 hover:text-[#d4af35] hover:border-[#d4af35]/40 backdrop-blur-md'
                  : 'bg-white/80 border-[var(--orbit-line)] text-[var(--orbit-text-muted)] hover:text-[var(--orbit-text)] backdrop-blur-md'
              }`}
            >
              {isLoadingHeatmap
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Flame className="h-3.5 w-3.5" />}
              {heatmapActive ? 'Heatmap Ativo' : 'Interesse por Bairro'}
            </button>
          </div>

          {/* Metric Switcher — flutua abaixo do botão toggle */}
          <AnimatePresence>
            {heatmapActive && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className={`absolute top-20 left-1/2 -translate-x-1/2 z-[110] hidden md:flex items-center gap-1 p-1 rounded-xl border shadow-2xl ${
                  isDark ? 'bg-[#0a0907]/90 border-[#d4af35]/15 backdrop-blur-xl' : 'bg-white/90 border-[var(--orbit-line)] backdrop-blur-xl'
                }`}
              >
                {(["all", "sent", "favorited", "visited", "deciding"] as HeatmapMetric[]).map((id) => (
                  <button
                    key={id}
                    onClick={() => setHeatmapMetric(id)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-mono uppercase tracking-wide transition-all ${
                      heatmapMetric === id
                        ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40'
                        : isDark
                        ? 'text-white/40 hover:text-white/70 hover:bg-white/5'
                        : 'text-[var(--orbit-text-muted)] hover:text-[var(--orbit-text)] hover:bg-black/5'
                    }`}
                  >
                    {METRIC_LABELS[id]}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Status badge no rodapé */}
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-[110] hidden md:block">
            {heatmapActive ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`px-6 py-2 rounded-full ${glass} flex items-center gap-3`}
              >
                <div className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-orange-400">
                  Modo Heatmap — {METRIC_LABELS[heatmapMetric]}
                </span>
              </motion.div>
            ) : (
              <div className={`px-6 py-2 rounded-full ${glass} flex items-center gap-3 animate-pulse`}>
                <div className={`w-2 h-2 rounded-full ${isDark ? 'bg-[#d4af35]' : 'bg-[var(--orbit-glow)]'}`} />
                <span className={`text-[10px] font-mono uppercase tracking-[0.2em] ${isDark ? 'text-[#d4af35]' : 'text-[var(--orbit-glow)]'}`}>
                  Modo Visualização Ativo
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <aside className={`w-full md:w-[420px] ${isDark ? 'bg-[#0a0907]' : 'bg-[var(--orbit-bg)]'} border-l ${isDark ? 'border-[#d4af35]/20' : 'border-[var(--orbit-line)]'} flex flex-col order-1 md:order-2 shadow-[-20px_0_40px_rgba(0,0,0,0.5)] z-[105]`}>
          
          {/* Header */}
          <div className={`p-8 border-b ${isDark ? 'border-[#d4af35]/10 bg-gradient-to-br from-[#14120c] to-black' : 'border-[var(--orbit-line)] bg-[var(--orbit-bg-secondary)]'}`}
            style={heatmapActive && selectedNeighborhood ? {
              background: isDark
                ? `linear-gradient(135deg, ${scoreColor}15 0%, #0a0907 60%)`
                : `linear-gradient(135deg, ${scoreColor}08 0%, var(--orbit-bg-secondary) 60%)`
            } : undefined}
          >
            <h2 className={`font-mono text-[10px] uppercase tracking-[0.3em] mb-2 font-bold ${
              heatmapActive && selectedNeighborhood ? '' : isDark ? 'text-[#d4af35]' : 'text-[var(--orbit-glow)]'
            }`} style={heatmapActive && selectedNeighborhood ? { color: scoreColor } : undefined}>
              {heatmapActive ? 'Heatmap de Demanda' : 'Contexto Geográfico'}
            </h2>
            <h3 className={`text-2xl font-serif ${isDark ? 'text-white' : 'text-[var(--orbit-text)]'} tracking-tight`}>
              {heatmapActive
                ? selectedNeighborhood ? selectedNeighborhood.neighborhood : 'Interesse por Bairro'
                : 'Acervo Mapeado'}
            </h3>
            <p className={`text-xs ${isDark ? 'text-white/40' : 'text-[var(--orbit-text-muted)]'} mt-1`}>
              {heatmapActive
                ? selectedNeighborhood
                  ? `Score ${selectedNeighborhood.score}/100 · ${selectedNeighborhood.totalCount} interações`
                  : `${heatmapNeighborhoods.length} bairros com demanda ativa`
                : `${mapProperties.length} imóveis posicionados no radar`}
            </p>

            {/* Score bar quando bairro selecionado */}
            {heatmapActive && selectedNeighborhood && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4">
                <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${selectedNeighborhood.score}%` }}
                    transition={{ duration: 0.8, ease: [0.19, 1, 0.22, 1] }}
                    className="h-full rounded-full"
                    style={{ background: `linear-gradient(to right, #00d4ff, ${scoreColor})` }}
                  />
                </div>
              </motion.div>
            )}
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {heatmapActive ? (
              /* HEATMAP MODE: Lista de bairros ou bairro selecionado */
              selectedNeighborhood ? (
                <NeighborhoodLeadsPanel
                  neighborhood={selectedNeighborhood}
                  isDark={isDark}
                  glassDarker={glassDarker}
                  onBack={() => setSelectedNeighborhood(null)}
                />
              ) : isLoadingHeatmap ? (
                <div className="flex flex-col gap-3">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className={`h-16 rounded-xl animate-pulse ${isDark ? 'bg-white/5' : 'bg-black/5'}`} />
                  ))}
                </div>
              ) : heatmapNeighborhoods.length > 0 ? (
                <div className="space-y-2">
                  <p className={`text-[10px] font-mono uppercase tracking-wider mb-3 ${isDark ? 'text-white/30' : 'text-[var(--orbit-text-muted)]'}`}>
                    Top Bairros por Demanda
                  </p>
                  {heatmapNeighborhoods.slice(0, 10).map((n: any, i: number) => {
                    const color = getScoreColor(n.score)
                    return (
                      <motion.button
                        key={n.neighborhood}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        onClick={() => setSelectedNeighborhood(n)}
                        className={`w-full flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all group ${
                          isDark
                            ? 'border-white/5 hover:border-white/15 hover:bg-white/5'
                            : 'border-[var(--orbit-line)] hover:border-[var(--orbit-glow)]/30 hover:bg-[var(--orbit-glow)]/3'
                        }`}
                      >
                        {/* Rank */}
                        <span className={`text-[11px] font-mono w-5 shrink-0 ${isDark ? 'text-white/20' : 'text-[var(--orbit-text-muted)]'}`}>
                          {i + 1}
                        </span>
                        {/* Color flame */}
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}20`, border: `1px solid ${color}40` }}>
                          <Flame className="w-3.5 h-3.5" style={{ color }} />
                        </div>
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className={`text-[13px] font-medium truncate ${isDark ? 'text-white/90' : 'text-[var(--orbit-text)]'}`}>
                            {n.neighborhood}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <div className={`flex-1 h-1 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-black/10'}`}>
                              <div className="h-full rounded-full" style={{ width: `${n.score}%`, background: color }} />
                            </div>
                            <span className={`text-[10px] font-mono tabular-nums ${isDark ? 'text-white/30' : 'text-[var(--orbit-text-muted)]'}`}>
                              {n.score}
                            </span>
                          </div>
                        </div>
                        <ArrowRight className={`w-3.5 h-3.5 shrink-0 transition-transform group-hover:translate-x-0.5 ${isDark ? 'text-white/20 group-hover:text-white/50' : 'text-[var(--orbit-text-muted)]/40'}`} />
                      </motion.button>
                    )
                  })}
                </div>
              ) : (
                <div className={`flex flex-col items-center justify-center py-16 gap-4 rounded-xl border border-dashed ${isDark ? 'border-white/10' : 'border-[var(--orbit-line)]'}`}>
                  <Flame className={`w-10 h-10 ${isDark ? 'text-white/10' : 'text-[var(--orbit-text-muted)]/20'}`} />
                  <p className={`text-xs text-center max-w-[200px] ${isDark ? 'text-white/30' : 'text-[var(--orbit-text-muted)]'}`}>
                    Nenhum dado de interesse encontrado nos últimos 30 dias
                  </p>
                </div>
              )
            ) : (
              /* NORMAL MODE: Imóvel selecionado ou placeholder */
              selectedProperty ? (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                  <div className="aspect-video rounded-2xl overflow-hidden relative border border-white/10 group">
                    <img
                      src={selectedProperty.cover_image || "/placeholder.jpg"}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      alt={selectedProperty.title}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    <button
                      onClick={() => setSelectedProperty(null)}
                      className="absolute top-3 left-3 p-1.5 rounded-full bg-black/40 text-white/50 hover:text-white"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <div className="absolute bottom-4 left-4">
                      <p className="text-xl font-serif text-white">{selectedProperty.title || selectedProperty.internal_name}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className={`p-4 rounded-xl ${glassDarker}`}>
                      <span className={`text-[9px] font-mono uppercase ${isDark ? 'text-[#d4af35]' : 'text-[var(--orbit-glow)]'}`}>Valor</span>
                      <p className={`text-lg font-serif ${isDark ? 'text-white' : 'text-[var(--orbit-text)]'}`}>
                        {selectedProperty.value ? `R$ ${(selectedProperty.value / 1000000).toFixed(1)}M` : 'Sob consulta'}
                      </p>
                    </div>
                    <div className={`p-4 rounded-xl ${glassDarker}`}>
                      <span className={`text-[9px] font-mono uppercase ${isDark ? 'text-[#d4af35]' : 'text-[var(--orbit-glow)]'}`}>Status</span>
                      <p className="text-sm font-medium text-emerald-400">Disponível</p>
                    </div>
                  </div>

                  <div className={`p-4 rounded-xl ${glassDarker} space-y-3`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">Linkar ao Orbit Selection</span>
                      <Button
                        onClick={() => onToggleSelect(selectedProperty)}
                        variant="ghost"
                        className={`h-9 px-4 gap-2 rounded-lg border transition-all ${
                          selectedIds.has(selectedProperty.id)
                            ? isDark ? 'bg-[#d4af35] border-[#d4af35] text-black' : 'bg-[var(--orbit-glow)] border-[var(--orbit-glow)] text-white'
                            : isDark ? 'text-[#d4af35] border-[#d4af35]/30 hover:bg-[#d4af35]/10' : 'text-[var(--orbit-glow)] border-[var(--orbit-glow)]/30 hover:bg-[var(--orbit-glow)]/10'
                        }`}
                      >
                        {selectedIds.has(selectedProperty.id) ? <Sparkles className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                        <span className="text-[10px] font-bold uppercase tracking-widest">
                          {selectedIds.has(selectedProperty.id) ? 'Selecionado' : 'Selecionar'}
                        </span>
                      </Button>
                    </div>
                    {selectedProperty.features?.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-2">
                        {selectedProperty.features.slice(0, 4).map((f: string) => (
                          <span key={f} className={`px-2 py-1 rounded border text-[10px] uppercase ${isDark ? 'bg-white/5 border-white/10 text-white/60' : 'bg-[var(--orbit-bg-secondary)] border-[var(--orbit-line)] text-[var(--orbit-text-muted)]'}`}>{f}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4 px-6">
                  <div className={`p-4 rounded-full ${isDark ? 'bg-[#d4af35]/10 border border-[#d4af35]/20' : 'bg-[var(--orbit-glow)]/10 border border-[var(--orbit-glow)]/20'}`}>
                    <MapPin className={`h-8 w-8 ${isDark ? 'text-[#d4af35]' : 'text-[var(--orbit-glow)]'}`} />
                  </div>
                  <div>
                    <h4 className={`font-serif text-lg ${isDark ? 'text-white' : 'text-[var(--orbit-text)]'}`}>Selecione um Ativo</h4>
                    <p className={`text-xs mt-2 ${isDark ? 'text-white/40' : 'text-[var(--orbit-text-muted)]'}`}>
                      Explore os pins no mapa para ver detalhes contextuais e vincular a curadorias em andamento.
                    </p>
                  </div>
                  <p className={`text-[10px] font-mono uppercase tracking-wider pt-2 ${isDark ? 'text-white/20' : 'text-[var(--orbit-text-muted)]'}`}>
                    ou ative o <span className="text-orange-400">Interesse por Bairro</span> acima
                  </p>
                </div>
              )
            )}
          </div>

          {/* Footer */}
          <div className={`p-8 border-t ${isDark ? 'border-[#d4af35]/10 bg-black/40' : 'border-[var(--orbit-line)] bg-[var(--orbit-bg-secondary)]/60'}`}>
            <div className="flex items-center justify-between mb-4">
              <span className={`text-[10px] font-mono uppercase tracking-widest ${isDark ? 'text-white/40' : 'text-[var(--orbit-text-muted)]'}`}>Carrinho Atual</span>
              <span className={`${isDark ? 'text-[#d4af35]' : 'text-[var(--orbit-glow)]'} font-serif text-lg`}>{selectedIds.size} itens</span>
            </div>
            <Button
              onClick={onClose}
              className={`w-full h-12 font-bold text-xs gap-2 uppercase tracking-widest rounded-xl transition-all ${
                isDark
                  ? 'bg-[#d4af35] hover:brightness-110 text-[#0a0907] shadow-[0_10px_30px_rgba(212,175,53,0.2)]'
                  : 'bg-[var(--orbit-glow)] text-white shadow-[var(--orbit-shadow)]'
              }`}
            >
              Concluir Seleção e Voltar
            </Button>
          </div>
        </aside>
      </motion.div>
    </AnimatePresence>
  )
}

// ── Sub-componente: leads de um bairro ───────────────────────────────────────
function NeighborhoodLeadsPanel({ neighborhood, isDark, glassDarker, onBack }: any) {
  const [leads, setLeads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/atlas/heatmap/leads?neighborhood=${encodeURIComponent(neighborhood.neighborhood)}&days=30`)
      .then(r => r.json())
      .then(d => setLeads(d.leads || []))
      .catch(() => setLeads([]))
      .finally(() => setLoading(false))
  }, [neighborhood.neighborhood])

  const STAGE_CONFIG: Record<string, { color: string; label: string }> = {
    deciding: { color: "#ff3b30", label: "Decidindo" },
    evaluating: { color: "#ff9500", label: "Avaliando" },
    exploring: { color: "#34c759", label: "Explorando" },
    curious: { color: "#5ac8fa", label: "Curioso" },
    latent: { color: "#8e8e93", label: "Latente" },
    dormant: { color: "#636366", label: "Dormente" },
  }

  return (
    <div className="space-y-3">
      <button
        onClick={onBack}
        className={`flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider transition-colors ${isDark ? 'text-white/30 hover:text-white/60' : 'text-[var(--orbit-text-muted)] hover:text-[var(--orbit-text)]'}`}
      >
        ← Todos os bairros
      </button>

      <p className={`text-[10px] font-mono uppercase tracking-wider ${isDark ? 'text-white/30' : 'text-[var(--orbit-text-muted)]'}`}>
        Leads ativos neste bairro
      </p>

      {loading ? (
        [1, 2, 3].map(i => (
          <div key={i} className={`h-14 rounded-xl animate-pulse ${isDark ? 'bg-white/5' : 'bg-black/5'}`} />
        ))
      ) : leads.length > 0 ? (
        leads.map((lead, i) => {
          const stage = STAGE_CONFIG[lead.orbit_stage] || STAGE_CONFIG.latent
          return (
            <motion.div
              key={lead.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className={`flex items-center gap-3 p-3.5 rounded-xl border ${isDark ? 'border-white/5 bg-white/2' : 'border-[var(--orbit-line)]'}`}
            >
              <div className={`w-9 h-9 rounded-lg shrink-0 flex items-center justify-center text-xs font-bold overflow-hidden ${isDark ? 'bg-white/10' : 'bg-[var(--orbit-bg-secondary)]'}`}>
                {lead.photo_url
                  ? <img src={lead.photo_url} alt={lead.name} className="w-full h-full object-cover" />
                  : <span className={isDark ? 'text-white/50' : 'text-[var(--orbit-text-muted)]'}>{lead.name?.slice(0, 2).toUpperCase()}</span>}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-[13px] font-medium truncate ${isDark ? 'text-white/90' : 'text-[var(--orbit-text)]'}`}>{lead.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="inline-flex px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase" style={{ color: stage.color, background: `${stage.color}18` }}>
                    {stage.label}
                  </span>
                  <div className={`flex-1 h-1 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-black/10'}`}>
                    <div className="h-full rounded-full" style={{ width: `${lead.interest_score}%`, background: stage.color }} />
                  </div>
                  <span className={`text-[9px] font-mono tabular-nums ${isDark ? 'text-white/30' : 'text-[var(--orbit-text-muted)]'}`}>{lead.interest_score}</span>
                </div>
              </div>
            </motion.div>
          )
        })
      ) : (
        <div className={`flex flex-col items-center justify-center py-10 gap-3 rounded-xl border border-dashed ${isDark ? 'border-white/10' : 'border-[var(--orbit-line)]'}`}>
          <Users className={`w-7 h-7 ${isDark ? 'text-white/10' : 'text-[var(--orbit-text-muted)]/20'}`} />
          <p className={`text-xs text-center max-w-[180px] ${isDark ? 'text-white/30' : 'text-[var(--orbit-text-muted)]'}`}>
            Nenhum lead ativo neste bairro nos últimos 30 dias
          </p>
        </div>
      )}
    </div>
  )
}
