"use client"

import { useState, useCallback, useEffect, useMemo } from "react"
import dynamic from "next/dynamic"
import { motion, AnimatePresence } from "framer-motion"
import { 
  X, Search, Filter, MapPin, Sparkles, 
  TrendingUp, Clock, Share2, Heart,
  Building2, ArrowRight, Loader2, Info
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSupabaseProperties } from "@/hooks/use-supabase-data"
import { useTheme } from "next-themes"
import type { MapProperty } from "@/components/atlas/MapAtlas"

// ── Dynamic Mapbox ───────────────────────────────────────────────────────────
const MapAtlas = dynamic(
  () => import("@/components/atlas/MapAtlas").then((m) => m.MapAtlas),
  {
    ssr: false,
    loading: () => {
      const { resolvedTheme } = useTheme()
      const isDark = resolvedTheme === 'dark'
      return (
        <div className={`flex items-center justify-center w-full h-full ${isDark ? 'bg-[#0a0907]' : 'bg-[var(--orbit-bg)]'}`}>
          <div className="flex flex-col items-center gap-3">
            <div className={`h-8 w-8 rounded-full border-2 animate-spin ${isDark ? 'border-[#d4af35]/60 border-t-[#d4af35]' : 'border-[var(--orbit-glow)]/60 border-t-[var(--orbit-glow)]'}`} />
            <span className={`text-[10px] tracking-widest uppercase font-mono ${isDark ? 'text-[#d4af35]/60' : 'text-[var(--orbit-glow)]/60'}`}>Loading Atlas...</span>
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

export default function MapModal({ isOpen, onClose, selectedIds, onToggleSelect }: MapModalProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  
  const glass = isDark 
    ? "bg-[#14120c]/70 backdrop-blur-md border border-[#d4af35]/15 text-white"
    : "bg-[var(--orbit-bg)]/80 backdrop-blur-md border border-[var(--orbit-line)] text-[var(--orbit-text)]"
    
  const glassDarker = isDark
    ? "bg-[#0a0907]/85 backdrop-blur-xl border border-[#d4af35]/10 text-white"
    : "bg-[var(--orbit-bg-secondary)]/90 backdrop-blur-xl border border-[var(--orbit-line)] text-[var(--orbit-text)]"

  const { properties, loading: propsLoading } = useSupabaseProperties()
  const [selectedProperty, setSelectedProperty] = useState<any | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

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

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={`fixed inset-0 z-[100] ${isDark ? 'bg-[#0a0907]' : 'bg-[var(--orbit-bg)]'} flex flex-col md:flex-row overflow-hidden`}
      >
        {/* Close Button Trigger */}
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 z-[110] p-3 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white transition-all shadow-2xl"
        >
          <X className="h-6 w-6" />
        </button>

        {/* Map Area */}
        <div className="flex-1 relative order-2 md:order-1">
          <MapAtlas 
            properties={mapProperties}
            selectedPropertyId={selectedProperty?.id || null}
            onPropertyClick={(p) => {
              const full = properties.find(prop => prop.id === p.id)
              setSelectedProperty(full)
            }}
            className="w-full h-full"
            initialCenter={[-50.0333, -29.8]}
            initialZoom={13}
          />
          
          {/* Top Floating Search in Map */}
          <div className="absolute top-6 left-6 z-[110] w-64 hidden md:block">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${glass} shadow-2xl`}>
              <Search className={`h-4 w-4 ${isDark ? 'text-[#d4af35]' : 'text-[var(--orbit-glow)]'}`} />
              <input 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Explorar mapa..."
                className="bg-transparent border-none text-xs focus:ring-0 placeholder:text-white/30 w-full"
              />
            </div>
          </div>

          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-[110] hidden md:block">
             <div className={`px-6 py-2 rounded-full ${glass} flex items-center gap-3 animate-pulse`}>
                <div className={`w-2 h-2 rounded-full ${isDark ? 'bg-[#d4af35]' : 'bg-[var(--orbit-glow)]'}`} />
                <span className={`text-[10px] font-mono uppercase tracking-[0.2em] ${isDark ? 'text-[#d4af35]' : 'text-[var(--orbit-glow)]'}`}>Modo Visualização Ativo</span>
             </div>
          </div>
        </div>

        {/* Info/List Sidebar (Map Context) */}
        <aside className={`w-full md:w-[420px] ${isDark ? 'bg-[#0a0907]' : 'bg-[var(--orbit-bg)]'} border-l ${isDark ? 'border-[#d4af35]/20' : 'border-[var(--orbit-line)]'} flex flex-col order-1 md:order-2 shadow-[-20px_0_40px_rgba(0,0,0,0.5)] z-[105]`}>
          <div className={`p-8 border-b ${isDark ? 'border-[#d4af35]/10 bg-gradient-to-br from-[#14120c] to-black' : 'border-[var(--orbit-line)] bg-[var(--orbit-bg-secondary)]'}`}>
            <h2 className={`${isDark ? 'text-[#d4af35]' : 'text-[var(--orbit-glow)]'} font-mono text-[10px] uppercase tracking-[0.3em] mb-2 font-bold`}>Contexto Geográfico</h2>
            <h3 className={`text-2xl font-serif ${isDark ? 'text-white' : 'text-[var(--orbit-text)]'} tracking-tight`}>Acervo Mapeado</h3>
            <p className={`text-xs ${isDark ? 'text-white/40' : 'text-[var(--orbit-text-muted)]'} mt-1`}>{mapProperties.length} imóveis posicionados no radar</p>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
            {selectedProperty ? (
               <motion.div 
                 initial={{ opacity: 0, x: 20 }}
                 animate={{ opacity: 1, x: 0 }}
                 className="space-y-6"
               >
                 <div className="aspect-video rounded-2xl overflow-hidden relative border border-white/10 group">
                    <img 
                      src={selectedProperty.cover_image || "/placeholder.jpg"} 
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
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
                       <p className={`text-lg font-serif ${isDark ? 'text-white' : 'text-[var(--orbit-text)]'}`}>R$ {(selectedProperty.value / 1000000).toFixed(1)}M</p>
                    </div>
                    <div className={`p-4 rounded-xl ${glassDarker}`}>
                       <span className={`text-[9px] font-mono uppercase ${isDark ? 'text-[#d4af35]' : 'text-[var(--orbit-glow)]'}`}>Status</span>
                       <p className="text-sm font-medium text-emerald-400">Diponível</p>
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
                         {selectedIds.has(selectedProperty.id) ? <Sparkles className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                         <span className="text-[10px] font-bold uppercase tracking-widest">{selectedIds.has(selectedProperty.id) ? 'Selecionado' : 'Selecionar'}</span>
                       </Button>
                    </div>
                    <p className={`text-[10px] ${isDark ? 'text-white/40' : 'text-[var(--orbit-text-muted)]'} leading-relaxed italic`}>
                      A seleção no mapa sincroniza automaticamente com o seu carrinho do Atlas Manager.
                    </p>
                 </div>

                  <div className="space-y-3">
                    <h4 className={`text-[10px] font-mono uppercase tracking-widest ${isDark ? 'text-[#d4af35]' : 'text-[var(--orbit-glow)]'}`}>Atributos Extraídos</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedProperty.features?.slice(0, 4).map((f: string) => (
                        <span key={f} className={`px-2 py-1 rounded border text-[10px] uppercase ${isDark ? 'bg-white/5 border-white/10 text-white/60' : 'bg-[var(--orbit-bg-secondary)] border-[var(--orbit-line)] text-[var(--orbit-text-muted)]'}`}>{f}</span>
                      ))}
                    </div>
                  </div>
               </motion.div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-4 px-6">
                <div className={`p-4 rounded-full ${isDark ? 'bg-[#d4af35]/10 border border-[#d4af35]/20' : 'bg-[var(--orbit-glow)]/10 border border-[var(--orbit-glow)]/20'}`}>
                  <MapPin className={`h-8 w-8 ${isDark ? 'text-[#d4af35]' : 'text-[var(--orbit-glow)]'}`} />
                </div>
                <div>
                   <h4 className={`font-serif text-lg ${isDark ? 'text-white' : 'text-[var(--orbit-text)]'}`}>Selecione um Ativo</h4>
                   <p className={`text-xs mt-2 ${isDark ? 'text-white/40' : 'text-[var(--orbit-text-muted)]'}`}>Explore os pins no mapa para ver detalhes contextuais e vincular a curadorias em andamento.</p>
                </div>
              </div>
            )}
          </div>
          
          {/* Selection Counter in Sidebar */}
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

function Plus({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
  )
}
