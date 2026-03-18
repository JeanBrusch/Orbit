"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import { motion } from "framer-motion"
import { Star, Phone, X, MapPin, Maximize2, Share2, Sparkles, Heart, XCircle, Calendar, Send, CheckCircle2, MessageSquare, ExternalLink } from "lucide-react"
import { getSupabase } from "@/lib/supabase"
import { toast } from "sonner"
import { AnimatePresence } from "framer-motion"
import "../../styles/themes/orbit-selection.css"
import { VideoEmbed } from "./VideoEmbed"

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
  audioUrl?: string;
  highlightLevel?: number;
  recommendedReason?: string;
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
  const theme = space.theme || "paper"
  const [selectedItem, setSelectedItem] = useState<SelectionItem | null>(null)
  const [interactions, setInteractions] = useState<Record<string, string[]>>(initialInteractions || {})
  const [questionText, setQuestionText] = useState<string>("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [chatContext, setChatContext] = useState<SelectionItem | null>(null)

  // ── Session tracking ─────────────────────────────────────────────────────────
  const sessionStartRef = useRef<number>(Date.now())

  const sendSessionEnd = (durationSeconds: number) => {
    if (!lead?.id || !items[0]?.id) return
    const payload = JSON.stringify({
      leadId: lead.id,
      propertyId: items[0].id,
      interaction_type: 'session_end',
      source: 'client_portal',
      metadata: { duration_seconds: durationSeconds },
    })
    // Usa sendBeacon para garantir envio mesmo ao fechar a aba
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' })
      navigator.sendBeacon('/api/property-interactions', blob)
    } else {
      // Fallback: fetch com keepalive
      fetch('/api/property-interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch(() => {})
    }
  }

  useEffect(() => {
    if (!lead?.id || !items[0]?.id) return

    sessionStartRef.current = Date.now()

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        const durationSeconds = Math.round((Date.now() - sessionStartRef.current) / 1000)
        if (durationSeconds >= 2) {
          sendSessionEnd(durationSeconds)
          console.log(`[SessionTracker] Duração: ${durationSeconds}s (visibilitychange)`)
        }
      }
    }

    const handleBeforeUnload = () => {
      const durationSeconds = Math.round((Date.now() - sessionStartRef.current) / 1000)
      if (durationSeconds >= 2) {
        sendSessionEnd(durationSeconds)
        console.log(`[SessionTracker] Duração: ${durationSeconds}s (beforeunload)`)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead?.id])

  const firstName = lead?.name?.split(" ")[0] || "Cliente"

  const formatPrice = (value: number | null) => {
    if (!value) return "Sob consulta"
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    }).format(value)
  }

  const handleWhatsApp = (item?: SelectionItem) => {
    // If the space has a linked operator phone, or fallback to environment variable
    const phone = space?.operator_phone || process.env.NEXT_PUBLIC_CONSULTANT_PHONE || "555182237325"
    let text = `Olá! Estou vendo o seu espaço Orbit Selection.`
    if (item) {
      text += ` Gostaria de saber mais sobre o imóvel: ${item.title}`
      text += `\nLink: ${window.location.origin}/selection/${slug}?prop=${item.id}`
    }
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, "_blank")
  }

  const handleInteraction = async (itemId: string, capsuleItemId: string, state: string) => {
    if (!lead?.id) { toast.error("Erro: sessão sem identificador de lead"); return; }
    
    const currentStates = interactions[itemId] || []
    const isAdding = !currentStates.includes(state)
    
    try {
      // Optimistic update: toggle state
      setInteractions(prev => {
        const entry = prev[itemId] || []
        const next = isAdding 
          ? [...entry, state]
          : entry.filter(s => s !== state)
        return { ...prev, [itemId]: next }
      })
      
      // If adding 'discarded', we might want to remove 'favorited'/'visited', 
      // but user said they should be concomitant. Discard is usually exclusive though.
      // For now, let's keep them all parallel as requested.

      const response = await fetch('/api/property-interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: lead.id,
          propertyId: itemId,
          interaction_type: state, // If it's already there, we send it anyway to refresh timestamp/intent?
          // Note: Backend currently doesn't have a "DELETE" interaction. 
          // We just send the action.
          source: 'client_portal'
        })
      })

      if (!response.ok) throw new Error("Falha ao registrar")
      
      if (isAdding) {
        toast.success(state === 'favorited' ? "Imóvel curtido!" : state === 'visited' ? "Visita solicitada!" : "Interação registrada")
      }
    } catch (err: any) {
      // Revert optimistic update
      setInteractions(prev => ({
        ...prev,
        [itemId]: currentStates
      }))
      toast.error("Erro ao registrar interação")
      console.error(err)
    }
  }

  const trackView = async (itemId: string) => {
    if (!lead?.id) return
    try {
      await fetch('/api/property-interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: lead.id,
          propertyId: itemId,
          interaction_type: 'viewed',
          source: 'client_portal'
        })
      })
    } catch(err) {
      console.error("Failed to track view:", err)
    }
  }

  const trackExternalLink = async (itemId: string) => {
    if (!lead?.id) return
    console.log(`[ClickTracker] Acessar Página Original clicado — propertyId: ${itemId}`)
    try {
      await fetch('/api/property-interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: lead.id,
          propertyId: itemId,
          interaction_type: 'visited_site',
          source: 'client_portal'
        })
      })
    } catch(err) {
      console.error("Failed to track external link:", err)
    }
  }

  useEffect(() => {
    // Log portal access when component mounts
    if (!lead?.id || !items[0]?.id) return
    const logPortalAccess = async () => {
      try {
        await fetch('/api/property-interactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            leadId: lead.id,
            propertyId: items[0].id,
            interaction_type: 'portal_opened',
            source: 'client_portal'
          })
        })
      } catch (err) {
        console.error("Failed to log portal access:", err)
      }
    }
    logPortalAccess()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead?.id])

  const handleAskQuestion = async (item?: SelectionItem | null) => {
    const text = questionText.trim()
    if (!text) return

    setIsSubmitting(true)

    try {
      const response = await fetch('/api/property-interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: lead?.id,
          propertyId: item?.id || items[0]?.id,
          interaction_type: 'property_question',
          source: 'client_portal',
          propertyTitle: item?.title || 'Dúvida Geral',
          propertyCover: item?.coverImage,
          text: text
        })
      })

      if (!response.ok) throw new Error("Falha ao enviar pergunta")
      
      toast.success("Pergunta enviada ao consultor!")
      setQuestionText("")
      // Close chat after a short delay if it was a general question or just leave it open?
      // For UX, better to clear text and maybe close drawer or show a success state.
    } catch (err: any) {
      toast.error("Erro ao enviar pergunta")
      console.error(err)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="orbit-selection-root" data-selection-theme={theme}>
      <div className="selection-container min-h-screen relative">
        
        {/* HEADER */}
        <header className="selection-header">
          <a href="#" className="flex items-center gap-2 group">
            <div className="w-[22px] h-[22px] border-2 border-[var(--gold)] rounded-full flex items-center justify-center">
              <div className="w-[6px] h-[6px] bg-[var(--gold)] rounded-full animate-pulse" />
            </div>
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--ink2)] font-light">Orbit</span>
          </a>

          <div className="flex items-center gap-3">
            <span className="text-[13px] text-[var(--ink2)] font-light hidden sm:block">{lead?.name}</span>
            <div className="w-8 h-8 rounded-full bg-[var(--gold-bg)] border-[1.5px] border-[var(--gold-bd)] flex items-center justify-center text-[var(--gold)] font-serif text-[14px]">
              {firstName[0]}
            </div>
            <a 
              href={`https://wa.me/${space?.operator_phone || process.env.NEXT_PUBLIC_CONSULTANT_PHONE || "555182237325"}?text=Olá, ${firstName}! Estou vendo o portal.`} 
              target="_blank"
              className="flex items-center gap-2 px-[14px] py-[6px] rounded-[8px] bg-[var(--match-bg)] border border-[rgba(90,122,74,0.18)] text-[var(--match)] text-xs font-medium hover:bg-[rgba(90,122,74,0.14)] transition-all ml-2"
            >
              <Phone size={14} className="fill-current" />
              Conversar
            </a>
          </div>
        </header>

        <main className="max-w-[1100px] mx-auto pt-[58px]">
          <div className="pb-20">
            {/* HERO */}
            <section className="px-6 lg:px-[72px] pt-[72px] pb-[56px] fu fu1">
              <div className="flex items-center gap-[10px] mb-5">
                <div className="w-7 h-[1px] bg-[var(--ink4)]" />
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--ink4)]">orbit.house / {firstName.toLowerCase()} · espaço privado</span>
              </div>
              <h1 className="text-[clamp(52px,6vw,80px)] font-serif font-light leading-[1.04] tracking-[-0.02em] text-[var(--ink)] mb-4">
                Seu <br />
                <em className="italic text-[var(--gold)] font-normal">próximo imóvel</em> <br />
                <strong>está aqui.</strong>
              </h1>
              <p className="text-[16px] text-[var(--ink3)] font-light leading-[1.7] max-w-[460px]">
                Reuni casas que realmente fazem sentido para você — não um catálogo, uma curadoria feita com atenção.
              </p>
            </section>

            {/* INSIGHT BAR */}
            <section className="mx-6 lg:mx-[72px] mb-[56px] bg-[var(--cream)] border border-[var(--gold-bd)] rounded-[16px] p-[22px_28px] flex items-center gap-6 fu fu2">
              <div className="w-10 h-10 rounded-[10px] bg-[var(--gold-bg)] border border-[var(--gold-bd)] flex items-center justify-center text-lg shrink-0">
                ✦
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-[var(--ink)] mb-2">O que aprendi sobre o que você busca</p>
                <div className="flex flex-wrap gap-1.5">
                  {preferences?.preferred_property_type && <span className="px-3 py-0.5 rounded-full bg-[var(--gold-bg)] border border-[var(--gold-bd)] text-[var(--gold2)] text-xs font-medium">{preferences.preferred_property_type}</span>}
                  {preferences?.preferred_area && <span className="px-3 py-0.5 rounded-full bg-[var(--gold-bg)] border border-[var(--gold-bd)] text-[var(--gold2)] text-xs font-medium">{preferences.preferred_area}</span>}
                  {preferences?.preferred_features?.map((f: string) => (
                    <span key={f} className="px-3 py-0.5 rounded-full bg-[var(--gold-bg)] border border-[var(--gold-bd)] text-[var(--gold2)] text-xs font-medium">{f}</span>
                  ))}
                </div>
              </div>
            </section>

            {/* MAIN GRID */}
            <section className="px-6 lg:px-[72px] pb-[72px]">
              <div className="flex items-baseline justify-between mb-8 pb-[18px] border-bottom border-[rgba(28,24,18,0.08)]">
                <h2 className="text-[30px] font-serif font-normal tracking-[-0.01em]">Casas que selecionei para você</h2>
                <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--ink4)]">curadas · não filtradas</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {items.map((item, idx) => (
                  <motion.div 
                    key={item.id}
                    className={`selection-card group fu fu${(idx % 4) + 1}`}
                  >
                    <div className="w-full overflow-hidden relative aspect-[4/3]">
                      {item.coverImage ? (
                        <img src={item.coverImage} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt={item.title} />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-[#e8ddd2] to-[#cfc3b0] flex items-center justify-center text-5xl">🏠</div>
                      )}
                    </div>
                    
                    <div className="p-[20px_22px_22px]">
                      <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--gold)] mb-2 block">Curado para você</span>
                      <h3 className="text-[21px] font-serif font-normal leading-tight text-[var(--ink)] mb-2 group-hover:text-[var(--gold)] transition-colors">{item.title}</h3>
                      
                      <div className="flex flex-wrap gap-x-3 gap-y-1 mb-3 text-xs text-[var(--ink3)]">
                        <span className="border-r border-[var(--ink4)] pr-3 last:border-0">{item.location}</span>
                        <span className="border-r border-[var(--ink4)] pr-3 last:border-0">3 Suítes</span>
                        <span className="pr-3">420m²</span>
                      </div>

                      <div className="text-[24px] font-serif font-medium tracking-tight text-[var(--ink)] mb-4">
                        {formatPrice(item.price)}
                      </div>

                      {/* Insight / Note */}
                      {(item.note || item.recommendedReason) && (
                        <div className="mb-4 p-[12px_14px] bg-[rgba(255,248,235,0.8)] border border-[rgba(160,120,40,0.15)] border-l-[3px] border-l-[var(--gold2)] rounded-[0_8px_8px_0] text-[13px] text-[var(--ink2)] leading-[1.65] font-serif italic">
                          <strong className="block not-italic font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--gold)] mb-1.5 font-normal">Insight do Especialista</strong>
                          "{item.note || item.recommendedReason}"
                        </div>
                      )}

                      {/* Video Embed */}
                      {item.videoUrl && (
                        <div className="mb-6">
                           <VideoEmbed url={item.videoUrl} className="shadow-lg" />
                        </div>
                      )}

                      <div className="flex gap-2 mb-4">
                        <button 
                          onClick={() => {
                            setSelectedItem(item)
                            trackView(item.id)
                          }}
                          className="flex-1 py-2.5 rounded-lg bg-[var(--ink)] text-[var(--paper)] text-xs font-medium hover:bg-[#2d2920] transition-all"
                        >
                          Ver Detalhes
                        </button>
                        {item.url && (
                          <a 
                            href={item.url}
                            target="_blank"
                            onClick={() => trackExternalLink(item.id)}
                            className="px-3.5 py-2.5 rounded-lg border border-[rgba(28,24,18,0.12)] text-[var(--ink3)] hover:bg-[rgba(28,24,18,0.05)] transition-all flex items-center justify-center"
                            title="Acessar link externo"
                          >
                            <ExternalLink size={18} />
                          </a>
                        )}
                        <button 
                          onClick={() => handleInteraction(item.id, item.capsuleItemId, 'favorited')}
                          className={`px-3.5 py-2.5 rounded-lg border border-[rgba(28,24,18,0.12)] transition-all ${interactions[item.id]?.includes('favorited') ? 'bg-rose-50 text-rose-500 border-rose-200' : 'text-[var(--ink3)] hover:bg-[rgba(28,24,18,0.05)]'}`}
                        >
                          <Heart size={18} className={interactions[item.id]?.includes('favorited') ? 'fill-current' : ''} />
                        </button>
                        <button 
                          onClick={() => handleInteraction(item.id, item.capsuleItemId, 'visited')}
                          className={`px-3.5 py-2.5 rounded-lg border border-[rgba(28,24,18,0.12)] transition-all ${interactions[item.id]?.includes('visited') ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'text-[var(--ink3)] hover:bg-[rgba(28,24,18,0.05)]'}`}
                        >
                          <Calendar size={18} />
                        </button>
                        <button 
                          onClick={() => handleInteraction(item.id, item.capsuleItemId, 'discarded')}
                          className={`px-3.5 py-2.5 rounded-lg border border-[rgba(28,24,18,0.12)] transition-all ${interactions[item.id]?.includes('discarded') ? 'bg-gray-100 text-gray-500 border-gray-300' : 'text-[var(--ink3)] hover:bg-[rgba(28,24,18,0.05)]'}`}
                        >
                          <XCircle size={18} />
                        </button>
                      </div>

                      {/* Quick Question Button */}
                      <button 
                        onClick={() => {
                          setChatContext(item)
                          setIsChatOpen(true)
                        }}
                        className="w-full py-2.5 rounded-xl border border-[var(--gold)]/30 text-[var(--gold)] text-xs font-medium hover:bg-[var(--gold-bg)] transition-all flex items-center justify-center gap-2"
                      >
                        <MessageSquare size={14} /> Tem uma dúvida?
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </section>

            {/* COMPARISON PLACEHOLDER */}
            <section className="mx-6 lg:mx-[72px] mb-[72px] bg-white border border-[rgba(28,24,18,0.08)] rounded-[20px] overflow-hidden">
              <div className="p-[24px_28px] border-b border-[rgba(28,24,18,0.07)] flex items-baseline justify-between">
                <h3 className="text-[22px] font-serif font-normal text-[var(--ink)]">Destaques da Curadoria</h3>
                <span className="text-xs text-[var(--ink4)]">Comparativo técnico</span>
              </div>
              <div className="p-8 text-center text-[var(--ink4)] italic font-serif">
                Selecione um imóvel para ver o comparativo detalhado.
              </div>
            </section>
          </div>
        </main>

        <footer className="py-20 border-t border-[var(--selection-border)] opacity-30 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em]">Orbit house · Curadoria imobiliária privada</p>
        </footer>

        {/* PROPERTY DETAIL MODAL */}
        <AnimatePresence>
          {selectedItem && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[500] flex items-center justify-center p-4 sm:p-6"
            >
              <div 
                className="absolute inset-0 bg-[var(--ink)]/40 backdrop-blur-md" 
                onClick={() => setSelectedItem(null)}
              />
              
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-[var(--paper)] w-full max-w-4xl max-h-[90vh] rounded-[24px] shadow-2xl overflow-hidden relative border border-[var(--ink)]/10 flex flex-col md:flex-row"
              >
                <button 
                  onClick={() => setSelectedItem(null)}
                  className="absolute top-5 right-5 z-10 w-10 h-10 rounded-full bg-white/80 backdrop-blur-md border border-black/5 flex items-center justify-center text-[var(--ink)] hover:bg-white hover:scale-110 transition-all shadow-sm"
                >
                  <X size={20} />
                </button>

                <div className="w-full md:w-1/2 aspect-[4/3] md:aspect-auto bg-[var(--paper2)] overflow-hidden relative">
                  {selectedItem.coverImage ? (
                    <img 
                      src={selectedItem.coverImage} 
                      className="w-full h-full object-cover" 
                      alt={selectedItem.title} 
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-6xl">🏢</div>
                  )}
                  
                  <div className="absolute bottom-6 left-6 right-6">
                    <div className="px-3 py-1.5 rounded-full bg-white/90 backdrop-blur-md border border-[rgba(90,122,74,0.2)] inline-flex items-center gap-1.5 font-mono text-[10px] font-medium text-[var(--match)] shadow-sm">
                      <div className="w-1 h-1 rounded-full bg-[var(--match)]" />
                      ORBIT CURATED SELECTION
                    </div>
                  </div>
                </div>

                <div className="w-full md:w-1/2 p-8 md:p-10 overflow-y-auto">
                  <div className="mb-8">
                    <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--gold)] mb-3 block">Detalhes do Imóvel</span>
                    <h2 className="text-[32px] font-serif font-normal leading-tight text-[var(--ink)] mb-3">{selectedItem.title}</h2>
                    <div className="flex items-center gap-2 text-[var(--ink3)] text-sm mb-6">
                      <MapPin size={16} className="text-[var(--gold)]" />
                      {selectedItem.location || "Localização Privada"}
                    </div>
                    
                    <div className="text-[36px] font-serif font-medium tracking-tight text-[var(--ink)] mb-8 border-b border-[var(--ink)]/5 pb-6">
                      {formatPrice(selectedItem.price)}
                    </div>

                    <div className="grid grid-cols-2 gap-y-6 gap-x-4 mb-8">
                      <div>
                        <p className="font-mono text-[9px] uppercase tracking-widest text-[var(--ink4)] mb-1">Dormitórios</p>
                        <p className="text-[17px] font-medium text-[var(--ink2)]">3 Dorms</p>
                      </div>
                      <div>
                        <p className="font-mono text-[9px] uppercase tracking-widest text-[var(--ink4)] mb-1">Área Total</p>
                        <p className="text-[17px] font-medium text-[var(--ink2)]">420 m²</p>
                      </div>
                      <div>
                        <p className="font-mono text-[9px] uppercase tracking-widest text-[var(--ink4)] mb-1">Tipo</p>
                        <p className="text-[17px] font-medium text-[var(--ink2)]">Residencial</p>
                      </div>
                      <div>
                        <p className="font-mono text-[9px] uppercase tracking-widest text-[var(--ink4)] mb-1">Match ID</p>
                        <p className="text-[17px] font-medium text-[var(--ink2)]">#{selectedItem.id.slice(0, 8)}</p>
                      </div>
                    </div>

                    {selectedItem.recommendedReason && (
                      <div className="p-5 bg-[var(--gold-bg)] border border-[var(--gold-bd)] rounded-2xl mb-8">
                        <div className="flex items-center gap-2 mb-2">
                          <Sparkles size={16} className="text-[var(--gold)]" />
                          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--gold)] font-medium">Por que esta casa?</p>
                        </div>
                        <p className="text-[14px] text-[var(--ink2)] leading-[1.6] italic font-serif">
                          "{selectedItem.recommendedReason}"
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div className="flex gap-3">
                      <button 
                        onClick={() => handleInteraction(selectedItem.id, selectedItem.capsuleItemId, 'favorited')}
                        className={`flex-1 py-3.5 rounded-xl border transition-all flex flex-col items-center gap-1 ${interactions[selectedItem.id]?.includes('favorited') ? 'bg-rose-50 border-rose-200 text-rose-500' : 'border-[rgba(28,24,18,0.12)] text-[var(--ink3)] hover:bg-[rgba(28,24,18,0.02)]'}`}
                      >
                        <Heart size={20} className={interactions[selectedItem.id]?.includes('favorited') ? 'fill-current' : ''} />
                        <span className="text-[10px] font-mono uppercase tracking-widest font-medium">Curtir</span>
                      </button>
                      <button 
                        onClick={() => handleInteraction(selectedItem.id, selectedItem.capsuleItemId, 'visited')}
                        className={`flex-1 py-3.5 rounded-xl border transition-all flex flex-col items-center gap-1 ${interactions[selectedItem.id]?.includes('visited') ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'border-[rgba(28,24,18,0.12)] text-[var(--ink3)] hover:bg-[rgba(28,24,18,0.02)]'}`}
                      >
                        <Calendar size={20} />
                        <span className="text-[10px] font-mono uppercase tracking-widest font-medium">Visitar</span>
                      </button>
                      <button 
                        onClick={() => handleInteraction(selectedItem.id, selectedItem.capsuleItemId, 'discarded')}
                        className={`flex-1 py-3.5 rounded-xl border transition-all flex flex-col items-center gap-1 ${interactions[selectedItem.id]?.includes('discarded') ? 'bg-gray-100 border-gray-300 text-gray-500' : 'border-[rgba(28,24,18,0.12)] text-[var(--ink3)] hover:bg-[rgba(28,24,18,0.02)]'}`}
                      >
                        <XCircle size={20} />
                        <span className="text-[10px] font-mono uppercase tracking-widest font-medium">Ignorar</span>
                      </button>
                    </div>

                    <button 
                      onClick={() => {
                        setChatContext(selectedItem)
                        setIsChatOpen(true)
                      }}
                      className="w-full py-4 rounded-xl border-2 border-[var(--gold)]/50 text-[var(--gold)] text-sm font-bold hover:bg-[var(--gold-bg)] transition-all flex items-center justify-center gap-2"
                    >
                      <MessageSquare size={18} />
                      Tirar dúvida sobre este imóvel
                    </button>

                    <button 
                      onClick={() => handleWhatsApp(selectedItem)}
                      className="w-full py-4 rounded-xl bg-[var(--match-bg)] text-[var(--match)] border border-[rgba(90,122,74,0.18)] text-sm font-medium hover:bg-[rgba(90,122,74,0.14)] transition-all flex items-center justify-center gap-2 shadow-sm"
                    >
                      <Phone size={18} />
                      Conversar pelo WhatsApp
                    </button>
                    {selectedItem?.url && (
                      <a 
                        href={selectedItem.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => trackExternalLink(selectedItem.id)}
                        className="mt-3 w-full py-4 rounded-xl bg-white border border-[rgba(28,24,18,0.1)] text-[var(--ink2)] text-sm font-medium hover:bg-[rgba(28,24,18,0.02)] transition-all flex items-center justify-center gap-2 shadow-sm"
                      >
                        <ExternalLink size={18} />
                        Acessar Página Original
                      </a>
                    )}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* FLOATING ACTION BUTTON (FAB) */}
        <button 
          onClick={() => {
            setChatContext(null)
            setIsChatOpen(true)
          }}
          className="fixed bottom-6 right-6 z-[400] w-14 h-14 rounded-full bg-[var(--gold)] text-[#0a0907] shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all group lg:bottom-10 lg:right-10"
          title="Falar com consultor"
        >
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-[var(--paper)] animate-pulse" />
          <MessageSquare size={24} className="group-hover:rotate-12 transition-transform" />
        </button>

        {/* SELECTION CHAT PANEL (Drawer) */}
        <AnimatePresence>
          {isChatOpen && (
            <>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsChatOpen(false)}
                className="fixed inset-0 z-[600] bg-black/40 backdrop-blur-sm lg:backdrop-blur-[2px]"
              />
              <motion.div 
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="fixed top-0 right-0 bottom-0 z-[700] w-full max-w-md bg-[var(--paper)] shadow-2xl flex flex-col border-l border-[var(--selection-border)]"
              >
                {/* Chat Header */}
                <div className="p-6 border-b border-[var(--selection-border)] flex items-center justify-between bg-[var(--gold-bg)]">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[var(--gold)]/20 flex items-center justify-center text-[var(--gold)]">
                      <Sparkles size={20} />
                    </div>
                    <div>
                      <h3 className="font-serif text-lg text-[var(--ink)]">Orbit Assistant</h3>
                      <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--gold)]">Especialista disponível</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsChatOpen(false)}
                    className="w-10 h-10 rounded-full flex items-center justify-center text-[var(--ink3)] hover:bg-black/5 transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Chat Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  <div className="bg-[var(--paper2)] p-4 rounded-2xl border border-[var(--selection-border)]">
                    <p className="text-sm text-[var(--ink2)] leading-relaxed">
                      Olá {firstName}! Sou seu consultor Orbit. Como posso ajudar você hoje? Se tiver dúvida sobre algum dos imóveis selecionados, pode perguntar por aqui.
                    </p>
                  </div>

                  {chatContext && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3 rounded-xl border border-[var(--gold)]/30 bg-[var(--gold-bg)] flex items-center gap-3"
                    >
                      <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 border border-[var(--gold)]/20">
                        {chatContext.coverImage ? (
                          <img src={chatContext.coverImage} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-black/5 flex items-center justify-center">🏢</div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] font-mono uppercase text-[var(--gold2)] font-bold">Em foco</p>
                        <p className="text-[13px] text-[var(--ink)] font-medium truncate">{chatContext.title}</p>
                      </div>
                      <button 
                        onClick={() => setChatContext(null)}
                        className="text-[var(--ink4)] hover:text-[var(--ink2)]"
                      >
                        <X size={14} />
                      </button>
                    </motion.div>
                  )}
                </div>

                {/* Chat Composer */}
                <div className="p-6 border-t border-[var(--selection-border)] bg-[var(--paper2)]">
                  <div className="relative">
                    <textarea 
                      value={questionText}
                      onChange={e => setQuestionText(e.target.value)}
                      placeholder={chatContext ? "Sua dúvida sobre este imóvel..." : "Escreva sua mensagem..."}
                      className="w-full bg-[var(--paper)] border border-[var(--selection-border)] rounded-2xl p-4 pr-12 text-sm outline-none focus:border-[var(--gold)] transition-all resize-none h-32 shadow-inner"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          handleAskQuestion(chatContext)
                        }
                      }}
                    />
                    <button 
                      onClick={() => handleAskQuestion(chatContext)}
                      disabled={!questionText.trim() || isSubmitting}
                      className="absolute bottom-4 right-4 w-10 h-10 rounded-xl bg-[var(--gold)] text-[#0a0907] flex items-center justify-center hover:scale-105 active:scale-95 disabled:opacity-30 transition-all shadow-md"
                    >
                      <Send size={18} />
                    </button>
                  </div>
                  <p className="mt-3 text-[10px] text-[var(--ink4)] text-center font-mono uppercase tracking-widest">
                    Resposta em poucos minutos
                  </p>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
