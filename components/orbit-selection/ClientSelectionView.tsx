"use client"
import { useState, useMemo, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Phone, ExternalLink, Map, LayoutGrid, Building2, ChevronRight, X, MessageCircle } from "lucide-react"
import { toast } from "sonner"
import { VideoEmbed } from "./VideoEmbed"
import { SelectionCard } from "./SelectionCard"
import { PropertyChat } from "./PropertyChat"
import dynamic from "next/dynamic"
import "../../styles/themes/jean-brusch.css"

const SelectionMap = dynamic(() => import("./SelectionMap"), {
  ssr: false,
  loading: () => <div className="h-[400px] flex items-center justify-center bg-white/5 rounded-3xl">Carregando mapa…</div>
})

interface SelectionItem {
  id: string;
  capsuleItemId: string;
  title: string;
  price: number | null;
  location: string | null;
  coverImage: string | null;
  url: string | null;
  lat: number | null;
  lng: number | null;
  note?: string;
  videoUrl?: string;
  recommendedReason?: string;
  bedrooms?: number;
  suites?: number;
  areaPrivativa?: number;
}

interface ClientSelectionViewProps {
  data: {
    space: any;
    lead: any;
    preferences: any;
    items: SelectionItem[];
    initialInteractions?: Record<string, string[]>;
  };
  slug: string;
}

export default function ClientSelectionView({ data, slug }: ClientSelectionViewProps) {
  const { space, lead, preferences, items, initialInteractions } = data
  const [selectedItem, setSelectedItem] = useState<SelectionItem | null>(null)
  const [interactions, setInteractions] = useState<Record<string, string[]>>(initialInteractions || {})
  const [activeView, setActiveView] = useState<'grid' | 'map'>('grid')
  const [chatProperty, setChatProperty] = useState<SelectionItem | null>(null)
  
  const mapItems = items.filter(i => i.lat && i.lng)
  const sessionStartRef = useRef<number>(Date.now())

  // ── Tracking Helpers ─────────────────────────────────────────────────────────
  const trackInteraction = useCallback(async (propertyId: string, type: string, metadata?: any) => {
    if (!lead?.id) return
    try {
      await fetch('/api/property-interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: lead.id,
          propertyId,
          interaction_type: type,
          source: 'client_portal',
          metadata
        })
      })
    } catch (err) {}
  }, [lead?.id])

  // Initial access log
  useEffect(() => {
    if (items[0]?.id) trackInteraction(items[0].id, 'portal_opened')
  }, [])

  // Session end tracking
  useEffect(() => {
    const handleUnload = () => {
      const duration = Math.round((Date.now() - sessionStartRef.current) / 1000)
      if (duration > 2 && items[0]?.id) {
        const payload = JSON.stringify({
          leadId: lead.id,
          propertyId: items[0].id,
          interaction_type: 'session_end',
          source: 'client_portal',
          metadata: { duration_seconds: duration }
        })
        if (navigator.sendBeacon) {
          navigator.sendBeacon('/api/property-interactions', new Blob([payload], { type: 'application/json' }))
        }
      }
    }
    window.addEventListener('beforeunload', handleUnload)
    return () => window.removeEventListener('beforeunload', handleUnload)
  }, [lead?.id, items])

  // Scroll Tracking (The "Thermometer" logic)
  useEffect(() => {
    let lastDepth = 0
    const handleScroll = () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight
      if (scrollHeight <= 0) return
      const depth = Math.round((window.scrollY / scrollHeight) * 100)
      
      // Track in 25% increments to avoid too many requests
      if (depth >= lastDepth + 25) {
        lastDepth = depth
        if (items[0]?.id) trackInteraction(items[0].id, 'scroll_depth', { depth })
      }
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [trackInteraction, items])

  // ── Actions ──────────────────────────────────────────────────────────────────
  const handleInteract = async (item: SelectionItem, state: string) => {
    const current = interactions[item.id] || []
    let next: string[] = []

    if (state === 'discarded') {
      next = current.includes('discarded') ? [] : ['discarded']
    } else {
      next = current.includes(state) 
        ? current.filter(s => s !== state) 
        : [...current.filter(s => s !== 'discarded'), state]
    }

    setInteractions(prev => ({ ...prev, [item.id]: next }))
    trackInteraction(item.id, state)

    if (next.includes('favorited')) toast.success("Adicionado aos favoritos")
    if (next.includes('discarded')) toast.info("Removido da seleção")
  }

  return (
    <div className="min-h-screen bg-[#0c0c0c] text-white selection:bg-[#d4af35]/30">
      {/* Premium Header */}
      <header className="fixed top-0 left-0 right-0 z-[60] bg-[#0c0c0c]/80 backdrop-blur-xl border-b border-white/5 px-6 h-20 flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-[10px] font-bold tracking-[0.2em] text-[#d4af35] uppercase">Orbit Selection</span>
          <span className="text-sm font-medium text-white/60">Curadoria Jean Brusch</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex flex-col items-end mr-2">
            <span className="text-xs text-white/40">Cliente</span>
            <span className="text-sm font-bold text-white/90">{lead?.name || 'Visitante'}</span>
          </div>
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#d4af35] to-[#f5d77b] flex items-center justify-center text-black font-bold text-sm shadow-lg shadow-[#d4af35]/10">
            {lead?.name?.[0] || 'U'}
          </div>
        </div>
      </header>

      <main className="pt-24 pb-32 px-6 max-w-2xl mx-auto">
        {/* Intro */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12"
        >
          <h1 className="text-4xl font-bold leading-tight mb-4">
            Sua nova jornada<br />
            <span className="text-white/40">começa agora.</span>
          </h1>
          <p className="text-white/40 leading-relaxed text-sm">
            Preparei esta curadoria exclusiva baseada no seu perfil. 
            Deslize para explorar e use os botões para indicar seu interesse em cada imóvel.
          </p>
        </motion.div>

        {/* View Toggle */}
        <div className="flex items-center justify-between mb-8">
          <span className="text-xs font-bold text-white/20 uppercase tracking-widest">
            {items.length} Imóveis Disponíveis
          </span>
          <div className="flex bg-white/5 rounded-full p-1 border border-white/5">
            <button 
              onClick={() => setActiveView('grid')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold transition-all ${activeView === 'grid' ? 'bg-white/10 text-white shadow-xl' : 'text-white/40'}`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Geral
            </button>
            <button 
              onClick={() => setActiveView('map')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold transition-all ${activeView === 'map' ? 'bg-white/10 text-white shadow-xl' : 'text-white/40'}`}
            >
              <Map className="w-3.5 h-3.5" />
              Mapa
            </button>
          </div>
        </div>

        {activeView === 'map' ? (
          <SelectionMap 
            items={items} 
            onItemClick={(id) => {
              const item = items.find(i => i.id === id)
              if (item) { setSelectedItem(item); trackInteraction(id, 'viewed'); }
            }} 
          />
        ) : (
          <div className="space-y-6">
            {items.map((item, idx) => (
              <SelectionCard 
                key={item.id}
                item={item}
                interactions={interactions[item.id] || []}
                onInteract={(state) => handleInteract(item, state)}
                onOpenDetails={() => { setSelectedItem(item); trackInteraction(item.id, 'viewed'); }}
                onOpenChat={() => { setChatProperty(item); trackInteraction(item.id, 'chat_opened'); }}
              />
            ))}
          </div>
        )}
      </main>

      {/* Property Details Modal */}
      <AnimatePresence>
        {selectedItem && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-[#0c0c0c] overflow-y-auto"
          >
            <button 
              onClick={() => setSelectedItem(null)}
              className="fixed top-8 right-8 z-[110] w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:text-white"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="max-w-2xl mx-auto py-12 px-6">
              <div className="rounded-[40px] overflow-hidden bg-white/5 border border-white/10 mb-8">
                {selectedItem.coverImage && (
                  <img src={selectedItem.coverImage} alt={selectedItem.title} className="w-full h-auto" />
                )}
              </div>

              <div className="space-y-8">
                <div>
                  <h2 className="text-3xl font-bold mb-2">{selectedItem.title}</h2>
                  <div className="flex items-center gap-2 text-white/40 text-sm">
                    <MapPin className="w-4 h-4" />
                    {selectedItem.location}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/5 rounded-3xl p-6 border border-white/5">
                    <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest block mb-1">Preço</span>
                    <span className="text-xl font-bold text-[#d4af35]">
                      {selectedItem.price ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedItem.price) : 'Sob consulta'}
                    </span>
                  </div>
                  <div className="bg-white/5 rounded-3xl p-6 border border-white/5">
                    <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest block mb-1">Área</span>
                    <span className="text-xl font-bold">{selectedItem.areaPrivativa || '—'}m²</span>
                  </div>
                </div>

                {selectedItem.recommendedReason && (
                  <div className="bg-[#d4af35]/5 rounded-3xl p-8 border border-[#d4af35]/10">
                    <h4 className="text-[10px] font-bold text-[#d4af35] uppercase tracking-widest mb-4">Por que este imóvel?</h4>
                    <p className="text-white/80 leading-relaxed italic">
                      "{selectedItem.recommendedReason}"
                    </p>
                  </div>
                )}

                {selectedItem.videoUrl && (
                  <div>
                    <h4 className="text-[10px] font-bold text-white/20 uppercase tracking-widest mb-6">Apresentação em Vídeo</h4>
                    <VideoEmbed url={selectedItem.videoUrl} className="mb-4" />
                  </div>
                )}

                <div className="pt-8 flex flex-col gap-4 pb-20">
                  <button 
                    onClick={() => { setChatProperty(selectedItem); setSelectedItem(null); }}
                    className="w-full h-16 rounded-2xl bg-[#d4af35] text-black font-bold flex items-center justify-center gap-3 transition-all active:scale-95 shadow-xl shadow-[#d4af35]/10"
                  >
                    <MessageCircle className="w-5 h-5 fill-black" />
                    Enviar dúvida sobre este imóvel
                  </button>
                  {selectedItem.url && (
                    <a 
                      href={selectedItem.url} 
                      target="_blank" 
                      className="w-full h-16 rounded-2xl bg-white/5 border border-white/10 text-white/80 font-bold flex items-center justify-center gap-3 transition-all active:scale-95"
                    >
                      <ExternalLink className="w-5 h-5" />
                      Ver todos os detalhes originais
                    </a>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Persistent WhatsApp FAB - Bottom Zone */}
      <div className="fixed bottom-0 left-0 right-0 p-6 z-50 pointer-events-none">
        <a 
          href={`https://wa.me/5551982237325`}
          target="_blank"
          className="pointer-events-auto h-14 bg-emerald-500 rounded-full flex items-center justify-center gap-3 px-6 text-white font-bold shadow-2xl shadow-emerald-500/20 max-w-sm mx-auto transition-transform active:scale-95"
        >
          <Phone className="w-5 h-5 fill-white" />
          Falar com Jean Brusch
        </a>
      </div>

      {/* Property Chat Drawer */}
      {chatProperty && (
        <PropertyChat 
          isOpen={!!chatProperty}
          onClose={() => setChatProperty(null)}
          leadId={lead?.id}
          propertyId={chatProperty.id}
          propertyTitle={chatProperty.title}
        />
      )}
    </div>
  )
}

function MapPin(props: any) {
  return (
    <svg 
      {...props}
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}
