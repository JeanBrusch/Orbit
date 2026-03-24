"use client"
import { useState, useMemo, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Phone, ExternalLink, Map, LayoutGrid, Building2, ChevronRight, X, MessageCircle, Sparkles, MapPin, Ruler, BedDouble, Bath } from "lucide-react"
import { toast } from "sonner"
import { VideoEmbed } from "./VideoEmbed"
import { SelectionCard } from "./SelectionCard"
import { PropertyChat } from "./PropertyChat"
import { PropertyCarousel } from "./PropertyCarousel"
import dynamic from "next/dynamic"
import "../../styles/themes/jean-brusch.css"

const SelectionMap = dynamic(() => import("./SelectionMap"), {
  ssr: false,
  loading: () => <div className="h-[400px] flex items-center justify-center bg-white/5 rounded-3xl">Carregando mapa…</div>
})

interface SelectionItem {
  id: string;
  interactionId: string;
  title: string;
  price: number | null;
  location: string | null;
  coverImage: string | null;
  photos: string[];
  url: string | null;
  lat: number | null;
  lng: number | null;
  note?: string;
  videoUrl?: string;
  recommendedReason?: string;
  bedrooms?: number;
  suites?: number;
  bathrooms?: number;
  areaPrivativa?: number;
  areaTotal?: number;
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

  useEffect(() => {
    console.log("[DEBUG SELECTION] Items and Lead loaded:", { 
      itemsCount: items.length, 
      lead: lead?.name, 
      slug,
      debug: (data as any)._debug 
    })
  }, [items.length, lead?.name, slug, data])

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

  // Scroll Tracking
  useEffect(() => {
    let lastDepth = 0
    const handleScroll = () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight
      if (scrollHeight <= 0) return
      const depth = Math.round((window.scrollY / scrollHeight) * 100)
      
      if (depth >= lastDepth + 25) {
        lastDepth = depth
        if (items[0]?.id) trackInteraction(items[0].id, 'scroll_depth', { depth })
      }
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [trackInteraction, items])

  // Video Track when modal opens
  useEffect(() => {
    if (selectedItem?.videoUrl) {
      trackInteraction(selectedItem.id, 'video_viewed')
    }
  }, [selectedItem?.id, trackInteraction])

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

  const formatPrice = (value: number | null) => {
    if (!value) return "Sob consulta";
    return new Intl.NumberFormat("pt-BR", { 
      style: "currency", 
      currency: "BRL", 
      maximumFractionDigits: 0 
    }).format(value);
  };

  return (
    <div className="min-h-screen bg-[#FBFBFB] text-[#1A1A1A] selection:bg-[#C9A84C]/20">
      {/* Premium Header */}
      <header className="fixed top-0 left-0 right-0 z-[60] bg-white/70 backdrop-blur-2xl border-b border-gray-100 px-6 h-20 flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-[9px] font-black tracking-[0.3em] text-[#C9A84C] uppercase">Atlas Intelligence</span>
          <span className="text-[13px] font-bold text-[#1A1A1A]">Orbit Selection</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-[9px] text-[#A1A1A1] font-bold uppercase tracking-widest">Consultor</span>
            <span className="text-[13px] font-bold text-[#1A1A1A]">Jean Brusch</span>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#1A1A1A] flex items-center justify-center text-white font-bold text-[13px] border border-white/10 shadow-lg shadow-black/5">
            JB
          </div>
        </div>
      </header>

      <main className="pt-28 pb-32 px-6 max-w-2xl mx-auto">
        {/* Intro */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-14"
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="h-[1px] w-8 bg-[#C9A84C]" />
            <span className="text-[10px] font-black tracking-[0.2em] text-[#C9A84C] uppercase">Exclusive Access</span>
          </div>
          <h1 className="text-[38px] font-bold leading-[1.1] mb-6 tracking-tight font-serif text-[#1A1A1A]">
            Olá, {lead?.firstName || 'Visitante'}.<br />
            <span className="text-[#A1A1A1] italic font-normal">Sua seleção está pronta.</span>
          </h1>
          <p className="text-[#666] leading-relaxed text-[15px] font-medium max-w-[90%]">
            Fizemos uma curadoria minuciosa baseada no seu perfil. 
            Deslize para explorar cada detalhe e utilize as interações para nos guiar até sua próxima conquista.
          </p>
        </motion.div>

        {/* View Toggle */}
        <div className="flex items-center justify-between mb-10">
          <div className="flex flex-col">
            <span className="text-[11px] font-bold text-[#1A1A1A] tracking-tight">Catalogo Curado</span>
            <span className="text-[10px] font-medium text-[#A1A1A1] uppercase tracking-[0.05em]">{items.length} Imóveis selecionados</span>
          </div>
          <div className="flex bg-[#F1F1F1] p-1 rounded-[14px]">
            <button 
              onClick={() => setActiveView('grid')}
              className={`flex items-center gap-2 px-4 py-2 rounded-[11px] text-[10px] font-bold transition-all ${activeView === 'grid' ? 'bg-white text-[#1A1A1A] shadow-sm' : 'text-[#A1A1A1] hover:text-[#666]'}`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Lista
            </button>
            <button 
              onClick={() => setActiveView('map')}
              className={`flex items-center gap-2 px-4 py-2 rounded-[11px] text-[10px] font-bold transition-all ${activeView === 'map' ? 'bg-white text-[#1A1A1A] shadow-sm' : 'text-[#A1A1A1] hover:text-[#666]'}`}
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
          <div className="space-y-4">
            {items.length > 0 ? (
              items.map((item) => (
                <SelectionCard 
                  key={item.id}
                  item={item}
                  interactions={interactions[item.id] || []}
                  onInteract={(state) => handleInteract(item, state)}
                  onOpenDetails={() => { setSelectedItem(item); trackInteraction(item.id, 'viewed'); }}
                  onOpenChat={() => { setChatProperty(item); trackInteraction(item.id, 'chat_opened'); }}
                />
              ))
            ) : (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-[32px] p-12 text-center border border-gray-100 shadow-sm"
              >
                <div className="w-16 h-16 bg-[#FBFBFB] rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Sparkles className="w-8 h-8 text-[#C9A84C]" />
                </div>
                <h3 className="text-lg font-bold text-[#1A1A1A] mb-2">Preparando sua curadoria</h3>
                <p className="text-[#A1A1A1] text-[14px] max-w-[280px] mx-auto leading-relaxed">
                  Trabalhamos para selecionar os imóveis perfeitos. Assim que finalizarmos, eles aparecerão aqui.
                </p>
              </motion.div>
            )}
          </div>
        )}
      </main>

      {/* Property Details Modal */}
      <AnimatePresence>
        {selectedItem && (
          <motion.div 
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-[100] bg-white overflow-y-auto"
          >
            {/* Header Fixed Inside Modal */}
            <div className="sticky top-0 left-0 right-0 z-[110] bg-white/80 backdrop-blur-xl border-b border-gray-100 flex items-center justify-between h-20 px-6">
              <span className="text-[11px] font-bold tracking-tight text-[#1A1A1A] uppercase">Detalhes da Unidade</span>
              <button 
                onClick={() => setSelectedItem(null)}
                className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 hover:text-gray-900 transition-colors"
                aria-label="Voltar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="max-w-2xl mx-auto py-8 px-6">
              <div className="rounded-[32px] overflow-hidden bg-[#FBFBF9] border border-gray-100 mb-10 shadow-xl shadow-[#DEDDDA]/20">
                <PropertyCarousel 
                  photos={selectedItem.photos || []} 
                  coverImage={selectedItem.coverImage || ""} 
                  title={selectedItem.title} 
                />
              </div>

              <div className="space-y-10">
                <div className="border-b border-gray-100 pb-8">
                  <h2 className="text-[32px] font-bold leading-tight mb-4 tracking-tight font-serif text-[#1A1A1A]">{selectedItem.title}</h2>
                  <div className="flex items-center gap-2 text-[#A1A1A1] text-xs font-bold uppercase tracking-[0.1em]">
                    <MapPin className="w-3.5 h-3.5" />
                    {selectedItem.location}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[#FBFBF9] rounded-[24px] p-6 border border-gray-100">
                    <span className="text-[9px] font-bold text-[#A1A1A1] uppercase tracking-widest block mb-2">Valor do Imóvel</span>
                    <span className="text-xl font-bold text-[#1A1A1A] tracking-tight">
                      {formatPrice(selectedItem.price)}
                    </span>
                  </div>
                  <div className="bg-[#FBFBF9] rounded-[24px] p-6 border border-gray-100">
                    <span className="text-[9px] font-bold text-[#A1A1A1] uppercase tracking-widest block mb-2">Área Privativa</span>
                    <span className="text-xl font-bold text-[#1A1A1A] tracking-tight">{selectedItem.areaPrivativa || '—'} m²</span>
                  </div>
                </div>

                {/* Badges Line */}
                <div className="flex items-center gap-8 py-4 border-y border-gray-50">
                  <div className="flex items-center gap-2.5">
                    <BedDouble className="w-4 h-4 text-[#C9A84C]" />
                    <span className="text-[13px] font-bold">{selectedItem.bedrooms || 0} Dorms</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Bath className="w-4 h-4 text-[#C9A84C]" />
                    <span className="text-[13px] font-bold">{selectedItem.bathrooms || selectedItem.suites || 0} Banheiros</span>
                  </div>
                  {selectedItem.areaTotal && (
                    <div className="flex items-center gap-2.5">
                      <Ruler className="w-4 h-4 text-[#C9A84C]" />
                      <span className="text-[13px] font-bold">Lote: {selectedItem.areaTotal}m²</span>
                    </div>
                  )}
                </div>

                {selectedItem.recommendedReason && (
                  <div className="bg-[#FBFBF9] rounded-[28px] p-8 border border-[#EBEBEB]">
                    <div className="flex items-center gap-2.5 mb-5">
                      <div className="w-2 h-2 rounded-full bg-[#C9A84C]" />
                      <h4 className="text-[10px] font-black text-[#1A1A1A] uppercase tracking-[0.2em] flex items-center gap-2">
                        Por que recomendamos
                      </h4>
                    </div>
                    <p className="text-[#444] leading-relaxed italic text-lg font-serif">
                      "{selectedItem.recommendedReason}"
                    </p>
                  </div>
                )}

                {selectedItem.videoUrl && (
                  <div>
                    <h4 className="text-[10px] font-black text-[#A1A1A1] uppercase tracking-[0.25em] mb-6 pl-1">Apresentação Exclusiva</h4>
                    <VideoEmbed url={selectedItem.videoUrl} className="mb-4 rounded-[28px] shadow-lg" />
                  </div>
                )}

                <div className="pt-8 flex flex-col gap-4 pb-28">
                  <button 
                    onClick={() => { setChatProperty(selectedItem); setSelectedItem(null); trackInteraction(selectedItem.id, 'chat_opened'); }}
                    className="w-full h-16 rounded-[20px] bg-[#1A1A1A] text-white text-[15px] font-bold flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-xl shadow-black/10"
                  >
                    <MessageCircle className="w-5 h-5" />
                    Consultar Agente Atlas
                  </button>
                  {selectedItem.url && (
                    <a 
                      href={selectedItem.url} 
                      target="_blank" 
                      className="w-full h-16 rounded-[20px] bg-white border border-[#EDEDED] text-[#666] text-[15px] font-bold flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
                    >
                      <ExternalLink className="w-5 h-5" />
                      Especificações Técnicas
                    </a>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Persistent WhatsApp FAB - Bottom Zone */}
      <div className="fixed bottom-0 left-0 right-0 p-8 z-50 pointer-events-none">
        <a 
          href={`https://wa.me/5551982237325`}
          target="_blank"
          className="pointer-events-auto h-16 bg-[#25D366] rounded-full flex items-center justify-center gap-4 px-8 text-white font-black text-[15px] shadow-2xl shadow-green-500/30 max-w-md mx-auto transition-transform active:scale-95 group"
        >
          <Phone className="w-5 h-5 fill-white group-hover:scale-110 transition-transform" />
          FALAR COM JEAN BRUSCH
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
