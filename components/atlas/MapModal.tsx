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
import type { MapProperty } from "@/components/atlas/MapAtlas"

// ── Dynamic Mapbox ───────────────────────────────────────────────────────────
const MapAtlas = dynamic(
  () => import("@/components/atlas/MapAtlas").then((m) => m.MapAtlas),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center bg-[#0a0907] w-full h-full">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-[#d4af35]/60 border-t-[#d4af35] animate-spin" />
          <span className="text-[10px] text-[#d4af35]/60 tracking-widest uppercase font-mono">Loading Atlas...</span>
        </div>
      </div>
    ),
  }
)

interface MapModalProps {
  isOpen: boolean
  onClose: () => void
  selectedIds: Set<string>
  onToggleSelect: (prop: any) => void
}

const glass = "bg-[#14120c]/70 backdrop-blur-md border border-[#d4af35]/15 text-white"
const glassDarker = "bg-[#0a0907]/85 backdrop-blur-xl border border-[#d4af35]/10 text-white"

export default function MapModal({ isOpen, onClose, selectedIds, onToggleSelect }: MapModalProps) {
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
        className="fixed inset-0 z-[100] bg-[#0a0907] flex flex-col md:flex-row overflow-hidden"
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
              <Search className="h-4 w-4 text-[#d4af35]" />
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
                <div className="w-2 h-2 rounded-full bg-[#d4af35]" />
                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#d4af35]">Modo Visualização Ativo</span>
             </div>
          </div>
        </div>

        {/* Info/List Sidebar (Map Context) */}
        <aside className="w-full md:w-[420px] bg-[#0a0907] border-l border-[#d4af35]/20 flex flex-col order-1 md:order-2 shadow-[-20px_0_40px_rgba(0,0,0,0.5)] z-[105]">
          <div className="p-8 border-b border-[#d4af35]/10 bg-gradient-to-br from-[#14120c] to-black">
            <h2 className="text-[#d4af35] font-mono text-[10px] uppercase tracking-[0.3em] mb-2 font-bold">Contexto Geográfico</h2>
            <h3 className="text-2xl font-serif text-white tracking-tight">Acervo Mapeado</h3>
            <p className="text-xs text-white/40 mt-1">{mapProperties.length} imóveis posicionados no radar</p>
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
                       <span className="text-[9px] font-mono uppercase text-[#d4af35]">Valor</span>
                       <p className="text-lg font-serif">R$ {(selectedProperty.value / 1000000).toFixed(1)}M</p>
                    </div>
                    <div className={`p-4 rounded-xl ${glassDarker}`}>
                       <span className="text-[9px] font-mono uppercase text-[#d4af35]">Status</span>
                       <p className="text-sm font-medium text-emerald-400">Diponível</p>
                    </div>
                 </div>

                 <div className={`p-4 rounded-xl ${glassDarker} space-y-3`}>
                    <div className="flex items-center justify-between">
                       <span className="text-xs font-medium">Linkar ao Orbit Selection</span>
                       <Button 
                         onClick={() => onToggleSelect(selectedProperty)}
                         variant="ghost" 
                         className={`h-9 px-4 gap-2 rounded-lg border border-[#d4af35]/30 ${selectedIds.has(selectedProperty.id) ? 'bg-[#d4af35] text-black' : 'text-[#d4af35] hover:bg-[#d4af35]/10'}`}
                       >
                         {selectedIds.has(selectedProperty.id) ? <Sparkles className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                         <span className="text-[10px] font-bold uppercase tracking-widest">{selectedIds.has(selectedProperty.id) ? 'Selecionado' : 'Selecionar'}</span>
                       </Button>
                    </div>
                    <p className="text-[10px] text-white/40 leading-relaxed italic">
                      A seleção no mapa sincroniza automaticamente com o seu carrinho do Atlas Manager.
                    </p>
                 </div>

                 <div className="space-y-3">
                   <h4 className="text-[10px] font-mono uppercase tracking-widest text-[#d4af35]">Atributos Extraídos</h4>
                   <div className="flex flex-wrap gap-2">
                     {selectedProperty.features?.slice(0, 4).map((f: string) => (
                       <span key={f} className="px-2 py-1 rounded bg-white/5 border border-white/10 text-[10px] uppercase text-white/60">{f}</span>
                     ))}
                   </div>
                 </div>
               </motion.div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-4 px-6">
                <div className="p-4 rounded-full bg-[#d4af35]/10 border border-[#d4af35]/20">
                  <MapPin className="h-8 w-8 text-[#d4af35]" />
                </div>
                <div>
                   <h4 className="text-white font-serif text-lg">Selecione um Ativo</h4>
                   <p className="text-xs text-white/40 mt-2">Explore os pins no mapa para ver detalhes contextuais e vincular a curadorias em andamento.</p>
                </div>
              </div>
            )}
          </div>
          
          {/* Selection Counter in Sidebar */}
          <div className="p-8 border-t border-[#d4af35]/10 bg-black/40">
             <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-mono uppercase tracking-widest text-white/40">Carrinho Atual</span>
                <span className="text-[#d4af35] font-serif text-lg">{selectedIds.size} itens</span>
             </div>
             <Button 
               onClick={onClose}
               className="w-full h-12 bg-[#d4af35] hover:brightness-110 text-[#0a0907] font-bold text-xs gap-2 uppercase tracking-widest rounded-xl shadow-[0_10px_30px_rgba(212,175,53,0.2)]"
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
