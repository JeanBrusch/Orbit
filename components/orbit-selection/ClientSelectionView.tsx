"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Phone, ExternalLink } from "lucide-react"
import { toast } from "sonner"
import { VideoEmbed } from "./VideoEmbed"
import dynamic from "next/dynamic"
import "../../styles/themes/jean-brusch.css"

const SelectionMap = dynamic(() => import("./SelectionMap"), {
  ssr: false,
  loading: () => <div className="jb-map-loading">Carregando mapa…</div>
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
  audioUrl?: string;
  highlightLevel?: number;
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
  const [questionText, setQuestionText] = useState<string>("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [chatContext, setChatContext] = useState<SelectionItem | null>(null)
  const [activeView, setActiveView] = useState<'grid' | 'map'>('grid')
  
  const mapItems = items.filter(i => i.lat && i.lng)
  
  // Custom messages for the Drawer to simulate the chat requested in HTML
  const [chatMessages, setChatMessages] = useState<{text: string, title?: string}[]>([])

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
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' })
      navigator.sendBeacon('/api/property-interactions', blob)
    } else {
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
        }
      }
    }
    const handleBeforeUnload = () => {
      const durationSeconds = Math.round((Date.now() - sessionStartRef.current) / 1000)
      if (durationSeconds >= 2) {
        sendSessionEnd(durationSeconds)
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [lead?.id])

  // Initial tracking
  useEffect(() => {
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
      } catch (err) {}
    }
    logPortalAccess()
  }, [lead?.id])

  const formatPrice = (value: number | null) => {
    if (!value) return "Sob consulta"
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value)
  }

  const handleInteraction = async (itemId: string, capsuleItemId: string, state: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!lead?.id) { toast.error("Sessão inválida"); return; }
    
    const currentStates = interactions[itemId] || []
    
    // HTML Design logic: if discarded, remove others. If fav/visit, remove discarded.
    let isAdding = true;
    let nextStates = [...currentStates];
    
    if (state === 'discarded') {
      isAdding = !currentStates.includes('discarded')
      if (isAdding) {
        nextStates = ['discarded']
      } else {
        nextStates = nextStates.filter(s => s !== 'discarded')
      }
    } else {
      isAdding = !currentStates.includes(state)
      if (isAdding) {
        nextStates = [...nextStates.filter(s => s !== 'discarded'), state]
      } else {
        nextStates = nextStates.filter(s => s !== state)
      }
    }
    
    try {
      setInteractions(prev => ({ ...prev, [itemId]: nextStates }))
      
      const response = await fetch('/api/property-interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: lead.id,
          propertyId: itemId,
          interaction_type: state,
          source: 'client_portal'
        })
      })

      if (!response.ok) throw new Error("Falha ao registrar")
      if (isAdding) {
        toast.success(state === 'favorited' ? "Imóvel curtido!" : state === 'visited' ? "Visita solicitada!" : "Interação registrada")
      }
    } catch (err) {
      setInteractions(prev => ({ ...prev, [itemId]: currentStates }))
      toast.error("Erro ao registrar interação")
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
    } catch(err) {}
  }

  const handleAskQuestion = async () => {
    const text = questionText.trim()
    if (!text) return
    setIsSubmitting(true)
    try {
      const response = await fetch('/api/property-interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: lead?.id,
          propertyId: chatContext?.id || items[0]?.id,
          interaction_type: 'property_question',
          source: 'client_portal',
          propertyTitle: chatContext?.title || 'Dúvida Geral',
          propertyCover: chatContext?.coverImage,
          text: text
        })
      })

      if (!response.ok) throw new Error("Falha ao enviar pergunta")
      
      setChatMessages(prev => [...prev, { text, title: chatContext?.title }])
      setQuestionText("")
      setTimeout(() => {
        const drawerBody = document.getElementById('jb-drawer-body')
        if (drawerBody) drawerBody.scrollTop = drawerBody.scrollHeight
      }, 100)
    } catch (err) {
      toast.error("Erro ao enviar pergunta")
    } finally {
      setIsSubmitting(false)
    }
  }

  const firstName = lead?.name?.split(" ")[0] || "Cliente"
  const consultantName = "Jean Brusch"
  const consultantPhone = "5551982237325" // WhatsApp: +55 51 98223-7325
  const consultantWhatsAppUrl = `https://wa.me/${consultantPhone}`
  const currentDate = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })
  
  // Close modal via Escape
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isChatOpen) setSelectedItem(null)
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [isChatOpen])

  return (
    <div className="jean-brusch-portal">
      {/* HEADER */}
      <header className="jb-header">
        <a href="#" className="jb-brand">
          <div className="jb-brand-name">{consultantName}</div>
          <div className="jb-brand-sub">Consultoria Imobiliária</div>
        </a>
        <div className="jb-header-right">
          <div className="jb-header-date">{currentDate}</div>
          <div className="jb-header-divider"></div>
          <div className="jb-client-pill">
            <div className="jb-client-avatar">{firstName[0]}</div>
            <span className="jb-client-name">{lead?.name || 'Cliente'}</span>
          </div>
        </div>
      </header>

      <div className="jb-page">
        {/* COVER */}
        <div className="jb-cover">
          <div className="jb-cover-bg"></div>
          <div className="jb-cover-rule"></div>
          <div className="jb-cover-number">{String(items.length).padStart(2, '0')}</div>
          <div className="jb-cover-content">
            <div className="jb-cover-eyebrow">Seleção Exclusiva</div>
            <h1 className="jb-cover-title">Uma curadoria feita com atenção<br /><em>ao que você busca</em></h1>
            <p className="jb-cover-byline">Cada imóvel nesta página passou pelo meu olhar pessoal. Não são opções colhidas em portais — são propostas construídas a partir do que aprendi sobre você.</p>
          </div>
        </div>

        {/* PREFS */}
        <div className="jb-prefs">
          <span className="jb-prefs-label">Perfil</span>
          {preferences?.preferred_property_type && <span className="jb-pref-chip">{preferences.preferred_property_type}</span>}
          {preferences?.preferred_area && <span className="jb-pref-chip">{preferences.preferred_area}</span>}
          {preferences?.preferred_features?.map((f: string) => (
            <span key={f} className="jb-pref-chip">{f}</span>
          ))}
          {!preferences?.preferred_property_type && !preferences?.preferred_area && (
            <span className="jb-pref-chip">Alto Padrão</span>
          )}
        </div>

        {/* SECTION */}
        <div className="jb-section">
          <div className="jb-section-row">
            <h2 className="jb-section-h">Imóveis selecionados</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <span className="jb-section-count">{items.length} imóveis</span>
              {/* Toggle Imóveis / Mapa */}
              <div className="jb-view-toggle">
                <button
                  className={`jb-toggle-btn ${activeView === 'grid' ? 'active' : ''}`}
                  onClick={() => setActiveView('grid')}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                    <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
                  </svg>
                  Imóveis
                </button>
                <button
                  className={`jb-toggle-btn ${activeView === 'map' ? 'active' : ''}`}
                  onClick={() => setActiveView('map')}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/>
                    <line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>
                  </svg>
                  Mapa
                  {mapItems.length > 0 && <span className="jb-toggle-count">{mapItems.length}</span>}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* MAP VIEW */}
        {activeView === 'map' && (
          <div className="jb-map-section">
            <SelectionMap
              items={items}
              onItemClick={(id) => {
                const item = items.find(i => i.id === id)
                if (item) { setSelectedItem(item); trackView(id) }
              }}
            />
          </div>
        )}

        {/* GRID */}
        {activeView === 'grid' && <div className="jb-grid">
          {items.map((item, idx) => {
            const hasFav = interactions[item.id]?.includes('favorited')
            const hasVisit = interactions[item.id]?.includes('visited')
            const hasPass = interactions[item.id]?.includes('discarded')
            
            return (
              <div 
                key={item.id} 
                className={`jb-grid-cell jb-cell-${(idx % 6) + 1}`}
                onClick={() => { setSelectedItem(item); trackView(item.id); }}
              >
                <div className="jb-cell-img">
                  {item.coverImage ? (
                    <img src={item.coverImage} alt={item.title} loading="lazy" />
                  ) : (
                    <div style={{width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center'}}>🏢</div>
                  )}
                  <div className="jb-cell-img-gradient"></div>
                  {(item.highlightLevel || 0) > 0 && (
                    <div className="jb-cell-hl"><div className="jb-cell-hl-dot"></div>Em destaque</div>
                  )}
                </div>
                
                <div className="jb-cell-meta">
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  {item.location}
                </div>
                
                <div className="jb-cell-title">{item.title}</div>
                <div className="jb-cell-price">{formatPrice(item.price)}</div>
                
                {(item.note || item.recommendedReason) && (
                  <div className="jb-cell-note">{item.note || item.recommendedReason}</div>
                )}
                
                <div className="jb-cell-actions">
                  <button className={`jb-cta ${hasFav ? 'on-fav' : ''}`} onClick={(e) => handleInteraction(item.id, item.capsuleItemId, 'favorited', e)}>
                    <svg className="jb-cta-icon" viewBox="0 0 24 24" fill={hasFav ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
                    Curtir
                  </button>
                  <button className={`jb-cta ${hasVisit ? 'on-visit' : ''}`} onClick={(e) => handleInteraction(item.id, item.capsuleItemId, 'visited', e)}>
                    <svg className="jb-cta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    Visitar
                  </button>
                  <button className={`jb-cta ${hasPass ? 'on-pass' : ''}`} onClick={(e) => handleInteraction(item.id, item.capsuleItemId, 'discarded', e)}>
                    <svg className="jb-cta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    Descartar
                  </button>
                </div>
              </div>
            )
          })}
        </div>}

        {/* FOOTER */}
        <div className="jb-foot">{consultantName}<span>·</span>Curadoria Imobiliária Privada<span>·</span>Confidencial</div>
      </div>

      {/* MODAL */}
      <div className={`jb-overlay ${selectedItem ? 'open' : ''}`} onClick={(e) => { if(e.target === e.currentTarget) setSelectedItem(null) }}>
        <div className="jb-modal">
          <button className="jb-modal-close" onClick={() => setSelectedItem(null)}>✕</button>
          
          <div className="jb-modal-left">
            {selectedItem?.coverImage && <img src={selectedItem.coverImage} alt={selectedItem.title} />}
            <div className="jb-modal-left-overlay"></div>
            <div className="jb-modal-curated">
              <div className="jb-modal-curated-dot"></div>
              <span>Seleção {consultantName}</span>
            </div>
          </div>
          
          <div className="jb-modal-right">
            {selectedItem && (() => {
              const hasFav = interactions[selectedItem.id]?.includes('favorited')
              const hasVisit = interactions[selectedItem.id]?.includes('visited')
              return (
                <>
                  <div className="jb-modal-eyebrow">Detalhes do Imóvel</div>
                  <div className="jb-modal-title">{selectedItem.title}</div>
                  <div className="jb-modal-loc">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    {selectedItem.location}
                  </div>
                  <div className="jb-modal-price">{formatPrice(selectedItem.price)}</div>
                  
                  <dl className="jb-modal-specs">
                    <div className="jb-spec">
                      <dt>Dormitórios</dt>
                      <dd>
                        {selectedItem.bedrooms || 0} {selectedItem.bedrooms === 1 ? 'Quarto' : 'Quartos'}
                        {selectedItem.suites ? ` (${selectedItem.suites} ${selectedItem.suites === 1 ? 'Suíte' : 'Suítes'})` : ''}
                      </dd>
                    </div>
                    <div className="jb-spec">
                      <dt>Área Útil</dt>
                      <dd>{selectedItem.areaPrivativa ? `${selectedItem.areaPrivativa} m²` : 'Sob consulta'}</dd>
                    </div>
                    <div className="jb-spec"><dt>Identificador</dt><dd>#{selectedItem.id.slice(0, 8)}</dd></div>
                    <div className="jb-spec"><dt>Tipo</dt><dd>Residencial</dd></div>
                  </dl>
                  
                  {selectedItem.recommendedReason && (
                    <div className="jb-modal-why">
                      <div className="jb-modal-why-label">Por que este imóvel?</div>
                      <p>"{selectedItem.recommendedReason}"</p>
                    </div>
                  )}

                  {selectedItem.videoUrl && (
                    <div style={{ marginBottom: 22 }}>
                      <VideoEmbed url={selectedItem.videoUrl} />
                    </div>
                  )}
                  
                  <div className="jb-modal-acts">
                    <button className={`jb-m-act ${hasFav ? 'on-fav' : ''}`} onClick={() => handleInteraction(selectedItem.id, selectedItem.capsuleItemId, 'favorited')}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill={hasFav ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
                      {hasFav ? 'Curtido' : 'Curtir'}
                    </button>
                    <button className={`jb-m-act ${hasVisit ? 'on-visit' : ''}`} onClick={() => handleInteraction(selectedItem.id, selectedItem.capsuleItemId, 'visited')}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                      {hasVisit ? 'Visita solicitada' : 'Solicitar visita'}
                    </button>
                  </div>
                  
                  {selectedItem.url && (
                    <button className="jb-m-ext" onClick={() => {
                        if (selectedItem.url) window.open(selectedItem.url, '_blank');
                        fetch('/api/property-interactions', {
                          method: 'POST', headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ leadId: lead.id, propertyId: selectedItem.id, interaction_type: 'visited_site', source: 'client_portal'})
                        }).catch(()=>{})
                    }}>
                      <ExternalLink width="12" height="12" />
                      Acessar Página Original
                    </button>
                  )}
                  
                  <button className="jb-m-ext" style={{ marginTop: 8, background: 'var(--paper2)', color: 'var(--muted)', borderColor: 'var(--line2)' }} onClick={() => {
                    setChatContext(selectedItem)
                    setSelectedItem(null)
                    setIsChatOpen(true)
                  }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                    Perguntar ao consultor sobre este imóvel
                  </button>
                </>
              )
            })()}
          </div>
        </div>
      </div>

      {/* FAB */}
      <button className="jb-fab" onClick={() => { setChatContext(null); setIsChatOpen(true); }}>
        <svg className="jb-fab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        <div className="jb-fab-dot"></div>
        Falar com Jean Brusch
      </button>

      {/* DRAWER */}
      <div className={`jb-drawer-mask ${isChatOpen ? 'open' : ''}`} onClick={() => setIsChatOpen(false)}></div>
      <div className={`jb-drawer ${isChatOpen ? 'open' : ''}`}>
        <div className="jb-drawer-head">
          <div className="jb-drawer-consultant">
            <div className="jb-consultant-av">{consultantName[0]}</div>
            <div>
              <div className="jb-consultant-name">{consultantName}</div>
              <div className="jb-consultant-status">disponível agora</div>
            </div>
          </div>
          <button className="jb-drawer-close" onClick={() => setIsChatOpen(false)}>✕</button>
        </div>
        
        <div className="jb-drawer-body" id="jb-drawer-body">
          <div className="jb-drawer-greeting">
            "Olá! Estou aqui para responder qualquer dúvida sobre os imóveis que selecionei para você. Me conte o que quiser saber."
          </div>
          
          {chatContext && (
            <div className="jb-drawer-ctx">
              <img src={chatContext.coverImage || ""} alt={chatContext.title} />
              <div className="jb-drawer-ctx-info">
                <div className="jb-label">Sobre este imóvel</div>
                <div className="jb-name">{chatContext.title}</div>
              </div>
              <button className="jb-ctx-remove" onClick={() => setChatContext(null)}>✕</button>
            </div>
          )}

          {chatMessages.map((msg, i) => (
            <div className="jb-sent-msg" key={i}>
              {msg.title && <p style={{fontSize:10, color:'var(--green)', marginBottom:4, fontStyle:'normal'}}>Sobre: {msg.title}</p>}
              <p>&#34;{msg.text}&#34;</p>
              <p className="jb-sent-msg-meta">Mensagem enviada · resposta em breve</p>
            </div>
          ))}
        </div>
        
        <div className="jb-drawer-foot">
          <a 
            href={consultantWhatsAppUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="jb-whatsapp-btn"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.47 14.38c-.28-.14-1.66-.82-1.92-.91-.26-.1-.45-.14-.64.14-.2.28-.74.91-.9 1.1-.17.19-.34.2-.62.07-.28-.14-1.19-.44-2.26-1.4-.84-.74-1.4-1.66-1.56-1.94-.17-.28-.02-.43.12-.57.13-.13.28-.34.42-.51.14-.17.18-.29.28-.48.09-.19.05-.36-.02-.5-.07-.14-.64-1.54-.87-2.1-.23-.55-.46-.48-.64-.49-.17 0-.36-.01-.56-.01-.19 0-.5.07-.77.36-.26.28-1 1-.99 2.44.01 1.44 1.04 2.83 1.18 3.03.14.19 2.04 3.1 4.93 4.35.69.3 1.22.47 1.64.6.69.22 1.32.19 1.81.12.55-.08 1.7-.7 1.94-1.37.24-.67.24-1.25.17-1.37-.07-.11-.26-.18-.54-.31zM12 2a10 10 0 0 0-8.6 15.08L2 22l5.06-1.32A10 10 0 1 0 12 2z"/></svg>
            Chamar Jean no WhatsApp
          </a>
          <div className="jb-composer">
            <textarea 
              value={questionText}
              onChange={e => setQuestionText(e.target.value)}
              placeholder="Escreva sua mensagem…" 
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { 
                  e.preventDefault(); 
                  handleAskQuestion(); 
                }
              }}
            ></textarea>
            <button className="jb-send-btn" onClick={() => handleAskQuestion()} disabled={isSubmitting || !questionText.trim()}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </div>
          <div className="jb-composer-hint">Resposta em poucos minutos</div>
        </div>
      </div>
    </div>
  )
}
