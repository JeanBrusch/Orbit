"use client"

import { useTheme } from "next-themes"
import { motion, AnimatePresence } from "framer-motion"
import { 
  ChevronLeft, Search, Map as MapIcon, 
  Layers, Filter, Users, LayoutGrid, Plus, Pencil, Globe, SlidersHorizontal
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useOrbitContext } from "@/components/orbit-context"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Slider } from "@/components/ui/slider"

export type MapMode = "inventory" | "intent" | "hybrid"

export interface AtlasFilters {
  valueRange: { min: number; max: number }
  areaRange: { min: number; max: number }
  bedrooms: number
}

interface AtlasTopBarProps {
  mapMode: MapMode
  onMapModeChange: (mode: MapMode) => void
  onOpenSearch: () => void
  onOpenSelections: () => void
  onOpenIngestion: () => void
  filters: AtlasFilters
  onFiltersChange: (filters: AtlasFilters) => void
}

function formatValue(value: number | null): string {
  if (value === null || value === 0) return "R$ 0"
  if (value >= 1_000_000) {
    const m = value / 1_000_000
    return m % 1 === 0 ? `R$ ${m}M` : `R$ ${m.toFixed(1)}M`
  }
  if (value >= 1_000) {
    const k = value / 1_000
    return k % 1 === 0 ? `R$ ${k}k` : `R$ ${k.toFixed(0)}k`
  }
  return `R$ ${value}`
}

export function AtlasTopBar({
  mapMode,
  onMapModeChange,
  onOpenSearch,
  onOpenSelections,
  onOpenIngestion,
  filters,
  onFiltersChange
}: AtlasTopBarProps) {
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"
  const { selectedLeadId, leadStates } = useOrbitContext()
  
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isFilterOpen, setIsFilterOpen] = useState(false)

  const activeLead = selectedLeadId ? leadStates[selectedLeadId] : null

  return (
    <div className="fixed top-0 left-0 right-0 z-[20] pointer-events-none p-4 md:p-6 flex items-start justify-between">
      
      {/* LEFT: Identity / Back */}
      <div className="pointer-events-auto flex items-center gap-3">
        <button
          onClick={() => router.push("/")}
          className={`w-12 h-12 flex items-center justify-center rounded-2xl backdrop-blur-md transition-all ${
            isDark 
              ? "bg-[#12121A]/80 border border-white/5 text-white/70 hover:text-white hover:bg-white/10" 
              : "bg-white/80 border border-black/5 text-black/70 hover:text-black hover:bg-black/5"
          }`}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Lead Selector / Status */}
        <div className={`h-12 flex items-center gap-3 pl-3 pr-4 rounded-2xl backdrop-blur-md border ${
          isDark 
            ? "bg-[#12121A]/80 border-white/5" 
            : "bg-white/80 border-black/5"
        }`}>
          {activeLead ? (
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-[var(--orbit-glow)]/20 flex items-center justify-center text-[10px] font-bold text-[var(--orbit-glow)]">
                {activeLead.adminData?.avatar || "L"}
              </div>
              <span className={`text-sm font-medium ${isDark ? "text-white" : "text-black"}`}>
                {activeLead.adminData?.name || "Lead Ativo"}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Users className={`w-4 h-4 ${isDark ? "text-white/40" : "text-black/40"}`} />
              <span className={`text-sm font-medium ${isDark ? "text-white/40" : "text-black/40"}`}>
                Nenhum lead ativo
              </span>
            </div>
          )}
        </div>
      </div>

      {/* CENTER: Semantic Search — Responsive */}
      <div className="pointer-events-auto absolute left-1/2 top-4 md:top-6 -translate-x-1/2 z-[30]">
        <button
          onClick={onOpenSearch}
          className={`h-12 flex items-center justify-between rounded-2xl backdrop-blur-md border transition-all ${
            isDark 
              ? "bg-[#12121A]/80 border-white/5 text-white/40 hover:text-white/70 hover:bg-white/5 shadow-2xl" 
              : "bg-white/80 border-black/5 text-black/40 hover:text-black/70 hover:bg-black/5 shadow-lg"
          } ${/* Width logic: single icon on mob, wide on desktop */
             'w-12 md:w-80 px-0 md:px-4'
          }`}
        >
          <div className="flex items-center gap-2 w-full justify-center md:justify-start">
            <Search className="w-5 h-5 md:w-4 md:h-4 text-[#C9A84C]" />
            <span className="hidden md:inline text-sm">Reinterpretar mapa...</span>
          </div>
          <div className="hidden md:flex gap-1">
            <kbd className={`px-2 py-1 rounded-md text-[10px] font-mono ${isDark ? "bg-white/10" : "bg-black/5"}`}>⌘</kbd>
            <kbd className={`px-2 py-1 rounded-md text-[10px] font-mono ${isDark ? "bg-white/10" : "bg-black/5"}`}>K</kbd>
          </div>
        </button>
      </div>

      {/* RIGHT: Modes & Menu */}
      <div className="pointer-events-auto flex flex-col items-end gap-3">
        {/* Actions Row: Map Modes + Filters + Menu */}
        <div className="flex items-center gap-3">
          {/* Map Modes */}
          <div className={`p-1 flex rounded-2xl backdrop-blur-md border ${
            isDark ? "bg-[#12121A]/80 border-white/5" : "bg-white/80 border-black/5"
          }`}>
          {[
            { id: "inventory", icon: MapIcon, label: "Realidade" },
            { id: "hybrid", icon: Layers, label: "Híbrido" },
            { id: "intent", icon: Filter, label: "Intenção" }
          ].map((mode) => {
            const isActive = mapMode === mode.id
            return (
              <button
                key={mode.id}
                onClick={() => onMapModeChange(mode.id as MapMode)}
                className={`relative px-4 py-2 text-xs font-medium rounded-xl transition-all ${
                  isActive 
                    ? isDark ? "text-[var(--orbit-glow)]" : "text-blue-600"
                    : isDark ? "text-white/40 hover:text-white/70" : "text-black/40 hover:text-black/70"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="mode-pill"
                    className={`absolute inset-0 rounded-xl ${
                      isDark ? "bg-[var(--orbit-glow)]/10" : "bg-blue-600/10"
                    }`}
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5 px-1 md:px-0">
                  <mode.icon className="w-4 h-4 md:w-3.5 md:h-3.5" />
                  <span className="hidden md:inline">{mode.label}</span>
                </span>
              </button>
            )
          })}
        </div>

        {/* Filter Popover */}
        <div className="relative">
          <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
            <PopoverTrigger asChild>
              <button className={`w-12 h-12 flex items-center justify-center rounded-2xl backdrop-blur-md border transition-all ${
                filters.valueRange.min > 0 || filters.valueRange.max < 20000000 || filters.areaRange.min > 0 || filters.areaRange.max < 1000 || filters.bedrooms > 0
                  ? (isDark ? "bg-[#d4af35]/10 border-[#d4af35]/30 text-[#d4af35]" : "bg-blue-600/10 border-blue-600/30 text-blue-600")
                  : (isDark ? "bg-[#12121A]/80 border-white/5 text-white/70 hover:text-white" : "bg-white/80 border-black/5 text-black/70 hover:text-black")
              }`}>
                <SlidersHorizontal className="w-5 h-5" />
                {(filters.valueRange.min > 0 || filters.valueRange.max < 20000000 || filters.areaRange.min > 0 || filters.areaRange.max < 1000 || filters.bedrooms > 0) && (
                  <span className={`absolute top-3 right-3 w-2 h-2 rounded-full ${isDark ? 'bg-[#d4af35]' : 'bg-blue-600'}`} />
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent 
              className={`w-80 p-5 z-[500] rounded-2xl border shadow-2xl outline-none ${
                isDark ? "bg-[#12121A]/95 border-white/10" : "bg-white/95 border-black/10"
              }`} 
              align="end" 
              sideOffset={15}
            >
              <div className="space-y-6">
                
                {/* PREÇO */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b pb-2 border-white/5">
                    <h4 className={`font-bold text-sm ${isDark ? "text-white" : "text-black"}`}>Preço</h4>
                    <span className={`text-[10px] uppercase tracking-wider font-mono px-2 py-1 rounded ${
                      isDark ? "bg-white/5 text-white/60" : "bg-black/5 text-black/60"
                    }`}>
                      {formatValue(filters.valueRange.min)} - {filters.valueRange.max >= 20000000 ? '20M+' : formatValue(filters.valueRange.max)}
                    </span>
                  </div>
                  <Slider 
                    defaultValue={[0, 20000000]}
                    max={20000000}
                    step={100000}
                    value={[filters.valueRange.min, filters.valueRange.max]}
                    onValueChange={(vals) => onFiltersChange({ ...filters, valueRange: { min: vals[0], max: vals[1] } })}
                    className="w-full pt-2"
                  />
                </div>

                {/* ÁREA */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b pb-2 border-white/5">
                    <h4 className={`font-bold text-sm ${isDark ? "text-white" : "text-black"}`}>Área Privativa</h4>
                    <span className={`text-[10px] uppercase tracking-wider font-mono px-2 py-1 rounded ${
                      isDark ? "bg-white/5 text-white/60" : "bg-black/5 text-black/60"
                    }`}>
                      {filters.areaRange.min}m² - {filters.areaRange.max >= 1000 ? '1000+m²' : `${filters.areaRange.max}m²`}
                    </span>
                  </div>
                  <Slider 
                    defaultValue={[0, 1000]}
                    max={1000}
                    step={10}
                    value={[filters.areaRange.min, filters.areaRange.max]}
                    onValueChange={(vals) => onFiltersChange({ ...filters, areaRange: { min: vals[0], max: vals[1] } })}
                    className="w-full pt-2"
                  />
                </div>

                {/* DORMITÓRIOS */}
                <div className="space-y-3">
                  <h4 className={`font-bold text-sm border-b pb-2 border-white/5 ${isDark ? "text-white" : "text-black"}`}>Dormitórios</h4>
                  <div className="flex gap-2">
                    {[0, 1, 2, 3, 4].map((qt) => (
                      <button
                        key={`bed-${qt}`}
                        onClick={() => onFiltersChange({ ...filters, bedrooms: qt })}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          filters.bedrooms === qt
                            ? (isDark ? "bg-[#d4af35] text-black" : "bg-blue-600 text-white")
                            : (isDark ? "bg-white/5 text-white/60 hover:bg-white/10" : "bg-black/5 text-black/60 hover:bg-black/10")
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
                    onClick={() => onFiltersChange({ 
                      valueRange: { min: 0, max: 20000000 }, 
                      areaRange: { min: 0, max: 1000 }, 
                      bedrooms: 0 
                    })} 
                    className={`text-[10px] uppercase tracking-wider font-bold ${
                      isDark ? "text-white/50 hover:text-white" : "text-black/50 hover:text-black"
                    }`}
                  >
                    Resetar
                  </button>
                  <button 
                    onClick={() => setIsFilterOpen(false)}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
                      isDark ? "bg-[#d4af35]/10 text-[#d4af35] hover:bg-[#d4af35]/20" : "bg-blue-600/10 text-blue-600 hover:bg-blue-600/20"
                    }`}
                  >
                    Aplicar
                  </button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Expandable Menu */}
        <div className="relative">
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className={`w-12 h-12 flex items-center justify-center rounded-2xl backdrop-blur-md border transition-all ${
              isDark 
                ? "bg-[#12121A]/80 border-white/5 text-white/70 hover:text-white hover:bg-white/10" 
                : "bg-white/80 border-black/5 text-black/70 hover:text-black hover:bg-black/5"
            }`}
          >
            <LayoutGrid className="w-5 h-5" />
          </button>

          <AnimatePresence>
            {isMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className={`absolute right-0 top-14 w-48 p-2 rounded-2xl backdrop-blur-2xl border shadow-2xl ${
                  isDark ? "bg-[#12121A]/95 border-white/10" : "bg-white/95 border-black/10"
                }`}
              >
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => {
                      onOpenSelections()
                      setIsMenuOpen(false)
                    }}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                      isDark ? "text-white/70 hover:text-white hover:bg-white/5" : "text-black/70 hover:text-black hover:bg-black/5"
                    }`}
                  >
                    <Layers className="w-4 h-4" />
                    Curadoria
                  </button>
                  <button
                    onClick={() => {
                      onOpenIngestion()
                      setIsMenuOpen(false)
                    }}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                      isDark ? "text-white/70 hover:text-white hover:bg-white/5" : "text-black/70 hover:text-black hover:bg-black/5"
                    }`}
                  >
                    <Plus className="w-4 h-4" />
                    Ingestão Imóveis
                  </button>
                  <button
                    onClick={() => {
                      router.push('/atlas/manager')
                      setIsMenuOpen(false)
                    }}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                      isDark ? "text-white/70 hover:text-white hover:bg-emerald-500/10" : "text-black/70 hover:text-black hover:bg-emerald-500/10"
                    }`}
                  >
                    <LayoutGrid className="w-4 h-4 text-emerald-500" />
                    Gerenciador Atlas
                  </button>
                  <button
                    onClick={() => {
                      onOpenIngestion() // Por enquanto abre a mesma modal, mas o plano diz para adicionar vistanet lá
                      setIsMenuOpen(false)
                    }}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                      isDark ? "text-white/70 hover:text-white hover:bg-blue-500/10" : "text-black/70 hover:text-black hover:bg-blue-500/10"
                    }`}
                  >
                    <Globe className="w-4 h-4 text-blue-500" />
                    Busca Vistanet
                  </button>
                  <button
                    onClick={() => setIsMenuOpen(false)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                      isDark ? "text-white/70 hover:text-white hover:bg-white/5" : "text-black/70 hover:text-black hover:bg-black/5"
                    }`}
                  >
                    <Pencil className="w-4 h-4" />
                    Edição Rápida
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        </div>
      </div>
    </div>
  )
}
