"use client"

import { useState, useMemo, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { useSupabaseProperties, useSupabaseLeads } from "@/hooks/use-supabase-data"
import { useAuth } from "@/hooks/use-auth"
import ClientSpacesManager from "@/components/atlas/ClientSpacesManager"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Search, Filter, Plus, Map as MapIcon, 
  LayoutGrid, List, Sparkles, Share2, 
  MoreHorizontal, ChevronRight, Building2,
  Mic, Loader2, Users, ShoppingCart, Send,
  X, Check, ExternalLink, Link2, Compass, Settings
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getSupabase } from "@/lib/supabase"
import { toast } from "sonner"
import dynamic from "next/dynamic"

const VoiceIngestion = dynamic(() => import("@/components/atlas/VoiceIngestion"), { ssr: false })
const MapModal = dynamic(() => import("@/components/atlas/MapModal"), { ssr: false })

// ── Aesthetics & Tokens ──────────────────────────────────────────────────────
const paper = {
  bg: "#f5f1eb",
  bgSecondary: "#ede8df",
  border: "rgba(28, 24, 18, 0.08)",
  ink: "#1c1812",
  inkMuted: "#8a7f70",
  gold: "#a07828",
  goldBg: "rgba(160, 120, 40, 0.07)",
}

// ── Components ───────────────────────────────────────────────────────────────

function PropertyCard({ 
  property, 
  isSelected, 
  onToggleSelect 
}: { 
  property: any, 
  isSelected: boolean, 
  onToggleSelect: (p: any) => void 
}) {
  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`group relative bg-white border ${isSelected ? 'border-[#a07828] ring-1 ring-[#a07828]/20' : 'border-[rgba(28,24,18,0.07)]'} rounded-xl overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer`}
      onClick={() => onToggleSelect(property)}
    >
      <div className="aspect-[16/10] overflow-hidden bg-[#ede8df]">
        {property.cover_image ? (
          <img 
            src={property.cover_image} 
            alt={property.title} 
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[#8a7f70]">
            <Building2 className="h-8 w-8 opacity-20" />
          </div>
        )}
        
        <div className="absolute top-3 left-3 px-2 py-1 rounded-full bg-white/90 backdrop-blur-sm border border-black/5 text-[9px] font-mono uppercase tracking-wider text-[#a07828]">
          Curadoria Orbit
        </div>

        {isSelected && (
          <div className="absolute inset-0 bg-[#a07828]/10 flex items-center justify-center">
            <div className="bg-[#a07828] text-white p-2 rounded-full shadow-lg">
              <Check className="h-4 w-4" />
            </div>
          </div>
        )}
      </div>

      <div className="p-4">
        <div className="flex justify-between items-start mb-1">
          <h3 className="font-serif text-lg text-[#1c1812] leading-tight group-hover:text-[#a07828] transition-colors">
            {property.title || property.internal_name || "Sem título"}
          </h3>
          <span className="text-sm font-serif font-medium text-[#1c1812]">
            {property.value ? `R$ ${(property.value / 1000000).toFixed(1)}M` : "Sob consulta"}
          </span>
        </div>
        
        <p className="text-[11px] text-[#8a7f70] mb-2 flex items-center gap-1">
          <MapIcon className="h-3 w-3" />
          {property.location_text || "Localização não informada"}
        </p>

        {property.payment_conditions && (
          <div className="mb-3 px-2 py-1 bg-[#a07828]/5 border border-[#a07828]/10 rounded text-[9px] text-[#a07828] font-mono italic">
            {typeof property.payment_conditions === 'object' 
              ? (property.payment_conditions.custom || JSON.stringify(property.payment_conditions))
              : property.payment_conditions
            }
          </div>
        )}

        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-[rgba(28,24,18,0.05)]">
          <Button variant="ghost" size="sm" className="h-8 text-[10px] uppercase tracking-widest font-mono text-[#8a7f70] hover:text-[#1c1812]">
            Ver Detalhes
          </Button>
          <div className="ml-auto flex gap-1">
            <Button 
              size="icon" 
              variant="ghost" 
              className={`h-8 w-8 rounded-full border border-black/5 ${isSelected ? 'bg-[#a07828] text-white hover:bg-[#a07828]/90' : ''}`}
            >
              {isSelected ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

function AtlasManagerContent() {
  const { properties, loading: propsLoading, refetch } = useSupabaseProperties()
  const { leads, loading: leadsLoading } = useSupabaseLeads()
  const searchParams = useSearchParams()
  
  const [activeTab, setActiveTab] = useState<"curadoria" | "acervo" | "selections">("curadoria")
  const [search, setSearch] = useState("")
  const [naturalSearch, setNaturalSearch] = useState("")
  const [isSearchingNatural, setIsSearchingNatural] = useState(false)
  const [filteredIds, setFilteredIds] = useState<string[] | null>(null)
  const [leadSearch, setLeadSearch] = useState("")
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false)
  const [isMapModalOpen, setIsMapModalOpen] = useState(false)
  const [isIngestModalOpen, setIsIngestModalOpen] = useState(false)
  
  const [scrapedData, setScrapedData] = useState<any>({
    title: "", image: "", value: "", condo_name: "", payment: ""
  })
  const [ingestStatus, setIngestStatus] = useState<"idle" | "processing" | "complete" | "failed">("idle")

  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<Set<string>>(new Set())
  const [isSending, setIsSending] = useState(false)

  const { refetch: refetchProps } = useSupabaseProperties()

  // ── Search Params Logic ───────────────────────────────────────────────────
  useEffect(() => {
    const propId = searchParams.get('id')
    const lId = searchParams.get('leadId')
    const tab = searchParams.get('tab')

    if (propId) {
      setSearch(propId) // Simple way to filter for now, or we can use setFilteredIds
      setFilteredIds([propId])
      setActiveTab('curadoria')
    }
    if (lId) {
      setSelectedLeadId(lId)
      setLeadSearch("") // Clear search if lead is pre-selected
    }
    // Automatically open selections if tab is requested
    if (tab === 'selections') {
      setActiveTab('selections')
    }
    if (tab && (tab === 'curadoria' || tab === 'acervo' || tab === 'selections')) {
      setActiveTab(tab as any)
    }
  }, [searchParams])

  // ── Ingestion Logic ────────────────────────────────────────────────────────

  const handleConfirmIngest = async (e: React.FormEvent) => {
    e.preventDefault()
    setIngestStatus("processing")
    const supabase = getSupabase()
    
    try {
      const payload = { 
        title: scrapedData.title,
        cover_image: scrapedData.image || null,
        value: parseFloat(scrapedData.value) || null,
        neighborhood: scrapedData.neighborhood || null,
        city: scrapedData.city || null,
        area_privativa: scrapedData.area_privativa || null,
        bedrooms: scrapedData.bedrooms || null,
        suites: scrapedData.suites || null,
        parking_spots: scrapedData.parking_spots || null,
        condo_fee: scrapedData.condo_fee || null,
        iptu: scrapedData.iptu || null,
        features: scrapedData.features || [],
        payment_conditions: scrapedData.payment ? { custom: scrapedData.payment } : null
      }

      const { data, error } = await (supabase.from("properties") as any).insert([payload]).select().single()
      if (error) throw error
      
      setIngestStatus("complete")
      toast.success("Imóvel cadastrado com sucesso!")
      await refetch()
      setTimeout(() => {
        setIsIngestModalOpen(false)
        setIngestStatus("idle")
        setScrapedData({ title: "", image: "", value: "", condo_name: "", payment: "" })
      }, 1500)
    } catch(err: any) {
      setIngestStatus("failed")
      toast.error(`Erro ao salvar: ${err.message}`)
    }
  }

  // ── Grain Texture Overlay ──
  const grainStyle = {
    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)' opacity='.025'/%3E%3C/svg%3E")`,
    opacity: 0.4,
    pointerEvents: "none" as const,
  }

  const filteredProperties = useMemo(() => {
    let base = properties || []
    if (filteredIds) {
      base = base.filter(p => filteredIds.includes(p.id))
    }
    return base.filter(p => 
      p.title?.toLowerCase().includes(search.toLowerCase()) || 
      p.location_text?.toLowerCase().includes(search.toLowerCase()) ||
      p.internal_name?.toLowerCase().includes(search.toLowerCase())
    )
  }, [properties, search, filteredIds])

  const handleNaturalSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!naturalSearch.trim()) {
      setFilteredIds(null)
      return
    }

    setIsSearchingNatural(true)
    try {
      const response = await fetch('/api/atlas/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: naturalSearch })
      })
      const data = await response.json()
      if (data.matchingIds) {
        setFilteredIds(data.matchingIds)
        if (data.matchingIds.length === 0) {
          toast.info("Nenhum imóvel encontrado para esta busca.")
        } else {
          toast.success(`${data.matchingIds.length} imóveis encontrados!`)
        }
      }
    } catch (err) {
      toast.error("Erro na busca semântica")
    } finally {
      setIsSearchingNatural(false)
    }
  }

  const filteredLeads = useMemo(() => {
    return leads?.filter(l => 
      l.name.toLowerCase().includes(leadSearch.toLowerCase())
    ).slice(0, 5) || []
  }, [leads, leadSearch])

  const togglePropertySelection = (prop: any) => {
    const next = new Set(selectedPropertyIds)
    if (next.has(prop.id)) {
      next.delete(prop.id)
    } else {
      next.add(prop.id)
    }
    setSelectedPropertyIds(next)
  }

  const handleSendToLead = async () => {
    if (!selectedLeadId || selectedPropertyIds.size === 0) return
    setIsSending(true)
    const supabase = getSupabase()

    try {
      console.log("[ATLAS] Starting send process", { selectedLeadId, propCount: selectedPropertyIds.size })
      const propertyIds = Array.from(selectedPropertyIds)
      const lead = leads?.find(l => l.id === selectedLeadId)
      
      if (!lead) throw new Error("Lead não encontrado")
      if (!lead.phone && !lead.lid) {
        toast.error("Lead sem telefone ou identificador (LID) cadastrado!")
        setIsSending(false)
        return
      }

      // 1. Create or get Client Space (Selection Portal)
      // Check if lead already has a space
      const { data: existingSpace } = await supabase
        .from('client_spaces')
        .select('id, slug')
        .eq('lead_id', selectedLeadId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      let useSlug: string
      
      if (existingSpace) {
        console.log("[ATLAS] Reusing existing space:", (existingSpace as any).slug)
        useSlug = (existingSpace as any).slug
      } else {
        const slug = `${lead.name.toLowerCase().replace(/\s+/g, '-')}-${Math.random().toString(36).substring(7)}`
        console.log("[ATLAS] Creating new space with slug:", slug)
        
        const spacePayload: any = {
          lead_id: selectedLeadId,
          slug,
          theme: 'paper',
          theme_config: { mode: 'light', variant: 'paper' },
          title: `Seleção Orbit - ${lead.name}`
        }

        const { data: space, error: spaceError } = await (supabase
          .from('client_spaces') as any)
          .insert([spacePayload])
          .select()
          .single()

        if (spaceError) {
          console.error("[ATLAS] Space creation error:", spaceError)
          throw new Error(`Erro ao criar portal: ${spaceError.message}`)
        }
        useSlug = space.slug
      }

      // 2. Insert items into capsule_items
      const inserts = propertyIds.map(pid => ({
        lead_id: selectedLeadId,
        property_id: pid,
        state: 'sent',
      }))

      const { error: itemsError } = await (supabase
        .from('capsule_items') as any)
        .upsert(inserts, { onConflict: 'lead_id, property_id' })

      if (itemsError) {
        console.error("[ATLAS] Capsule items error:", itemsError)
        throw new Error(`Erro ao registrar imóveis: ${itemsError.message}`)
      }

      // 3. Trigger WhatsApp via API
      const portalUrl = `${window.location.origin}/selection/${useSlug}`
      const message = `Olá ${lead.name.split(' ')[0]}! Selecionei alguns imóveis que fazem sentido para seu perfil. Você pode conferir aqui no seu portal exclusivo: ${portalUrl}`

      // Prioritize LID for sending if available
      const sendTo = (lead.lid ? (lead.lid.includes('@lid') ? lead.lid : `${lead.lid}@lid`) : null) || lead.phone
      console.log("[ATLAS] Sending message to:", sendTo)

      const response = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: sendTo,
          message,
          leadId: selectedLeadId
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error("[ATLAS] WhatsApp API error:", errorData)
        throw new Error(errorData.error || "Falha ao disparar WhatsApp")
      }

      toast.success(`${propertyIds.length} imóveis enviados e portal gerado!`)
      setSelectedPropertyIds(new Set())
      setSelectedLeadId(null)
      setLeadSearch("")
    } catch (err: any) {
      console.error("[ATLAS] Fatal error in handleSendToLead:", err)
      toast.error(`Falha no processo: ${err.message}`)
    } finally {
      setIsSending(false)
    }
  }

  if (propsLoading || leadsLoading) {
    return (
      <div className="min-h-screen bg-[#f5f1eb] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-[#a07828]" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-[#8a7f70]">Carregando Acervo...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f5f1eb] text-[#1c1812] relative overflow-hidden font-sans selection:bg-[#a07828]/20 flex flex-col h-screen">
      {/* Grain */}
      <div className="fixed inset-0 z-50 pointer-events-none" style={grainStyle} />

      {/* Modern Unified Header */}
      <header className="h-20 border-b border-[rgba(28,24,18,0.05)] bg-[#f5f1eb]/80 backdrop-blur-md flex items-center px-10 gap-8 sticky top-0 z-30 shrink-0">
        <div className="flex items-center gap-3 pr-8 border-r border-[rgba(28,24,18,0.1)]">
          <div className="w-10 h-10 rounded-xl bg-[#1c1812] flex items-center justify-center text-[#f5f1eb] shadow-lg shadow-black/10">
            <Compass className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-serif text-xl tracking-tight">Atlas Manager</h1>
            <p className="font-mono text-[9px] uppercase tracking-widest text-[#a07828]">Intelligence Hub</p>
          </div>
        </div>

        <nav className="flex items-center gap-1 p-1 bg-[#ede8df] rounded-lg border border-[rgba(28,24,18,0.05)]">
          {[
            { id: 'curadoria', label: 'Curadoria', icon: Sparkles },
            { id: 'acervo', label: 'Acervo', icon: Building2 },
            { id: 'selections', label: 'Selections', icon: Sparkles },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-[11px] font-mono uppercase tracking-wider transition-all ${activeTab === tab.id ? 'bg-white text-[#1c1812] shadow-sm border border-[rgba(28,24,18,0.08)]' : 'text-[#8a7f70] hover:text-[#1c1812]'}`}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="flex-1 max-w-xl relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8a7f70] transition-colors group-focus-within:text-[#a07828]" />
          <form onSubmit={handleNaturalSearch}>
            <div className="relative">
              <Input 
                value={naturalSearch}
                onChange={(e) => {
                  setNaturalSearch(e.target.value)
                  if (!e.target.value) setFilteredIds(null)
                }}
                placeholder="Busca Natural: 'Apartamento 3 dorms no centro com piscina'..."
                className="w-full pl-12 h-11 bg-[#ede8df] border-none rounded-2xl text-sm placeholder:text-[#8a7f70]/60 focus:ring-2 focus:ring-[#a07828]/20 transition-all font-serif italic"
              />
              {isSearchingNatural && (
                <div className="absolute right-12 top-1/2 -translate-y-1/2">
                  <Loader2 className="h-4 w-4 animate-spin text-[#a07828]" />
                </div>
              )}
            </div>
          </form>
          {naturalSearch && (
            <button 
              onClick={() => setNaturalSearch("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-black/5 rounded-full"
            >
              <X className="h-3 w-3 text-[#8a7f70]" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-4 ml-auto">
          <Button 
            onClick={() => setIsVoiceModalOpen(true)}
            className="h-10 px-5 bg-[#a07828] hover:bg-[#8a651e] text-white rounded-xl flex items-center gap-2 shadow-lg shadow-[#a07828]/20 transition-all group"
          >
            <Mic className="h-4 w-4 group-hover:scale-110 transition-transform" />
            <span className="text-[10px] font-mono uppercase tracking-widest font-bold">Cadastro por Voz</span>
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Main Side View */}
        <main className="flex-1 overflow-y-auto p-10 custom-scrollbar bg-white/30">
          <AnimatePresence mode="wait">
            {activeTab === 'curadoria' && (
              <motion.div 
                key="curadoria"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="max-w-7xl mx-auto space-y-8"
              >
                <div className="flex items-center justify-between border-b border-[rgba(28,24,18,0.05)] pb-6">
                  <div>
                    <h2 className="font-serif text-3xl">Curadoria Inteligente</h2>
                    <p className="text-sm text-[#8a7f70] mt-1 font-serif italic">Ativos recomendados para leads estratégicos.</p>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#8a7f70]" />
                      <Input 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Filtrar por texto..."
                        className="pl-9 h-9 w-48 text-xs bg-white border border-[rgba(28,24,18,0.1)] rounded-lg shadow-sm"
                      />
                    </div>
                    <Button variant="outline" size="sm" className="h-9 px-4 gap-2 text-xs border-[rgba(28,24,18,0.1)] hover:bg-[#ede8df]">
                      <Filter className="h-3.5 w-3.5" />
                      Filtros
                    </Button>
                    <div className="w-px h-8 bg-[rgba(28,24,18,0.1)] mx-2" />
                    <Button 
                      onClick={() => setIsMapModalOpen(true)}
                      variant="outline" 
                      size="sm" 
                      className="h-9 px-4 gap-2 bg-white border border-[#a07828]/20 text-[10px] font-mono uppercase tracking-wider text-[#a07828] hover:bg-[#a07828]/5"
                    >
                      <MapIcon className="h-3.5 w-3.5" />
                      Mapa
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
                  {filteredProperties.map((prop) => (
                    <PropertyCard 
                      key={prop.id} 
                      property={prop} 
                      isSelected={selectedPropertyIds.has(prop.id)}
                      onToggleSelect={togglePropertySelection}
                    />
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === 'acervo' && (
              <motion.div 
                key="acervo"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="max-w-7xl mx-auto space-y-8"
              >
                 <div className="flex items-center justify-between border-b border-[rgba(28,24,18,0.05)] pb-6">
                  <div>
                    <h2 className="font-serif text-3xl">Acervo Completo</h2>
                    <p className="text-sm text-[#8a7f70] mt-1 font-serif italic">{properties.length} registros no sistema.</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {properties.map(prop => (
                    <div key={prop.id} className="p-3 bg-white rounded-xl border border-[rgba(28,24,18,0.05)] shadow-sm hover:shadow-md transition-shadow group">
                      <div className="aspect-square rounded-lg bg-[#f5f1eb] overflow-hidden mb-3 relative">
                        {prop.cover_image && <img src={prop.cover_image} className="w-full h-full object-cover" />}
                        <button 
                          onClick={() => togglePropertySelection(prop)}
                          className={`absolute bottom-2 right-2 p-1.5 rounded-lg border shadow-sm transition-all ${selectedPropertyIds.has(prop.id) ? 'bg-[#a07828] text-white border-[#a07828]' : 'bg-white/90 text-[#8a7f70] border-black/5 hover:bg-white'}`}
                        >
                          {selectedPropertyIds.has(prop.id) ? <Check size={14} /> : <Plus size={14} />}
                        </button>
                      </div>
                      <p className="font-serif text-sm truncate leading-tight">{prop.title || prop.internal_name}</p>
                      <p className="text-[10px] text-[#a07828] font-bold mt-1 uppercase tracking-tighter">
                        {prop.value ? `R$ ${(prop.value / 1000).toFixed(0)}k` : 'Sob consulta'}
                      </p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === 'selections' && (
              <motion.div 
                key="selections"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="max-w-2xl mx-auto h-full"
              >
                <SelectionsHistory />
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Orbit Selection Sidebar */}
        <aside className="w-80 bg-white border-l border-[rgba(28,24,18,0.08)] flex flex-col relative z-20 shadow-[-10px_0_40px_rgba(0,0,0,0.03)] selection:bg-[#a07828]/10 shrink-0">
          <div className="p-6 border-b border-[rgba(28,24,18,0.05)] bg-[#fdfaf5]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-[#a07828]/10 text-[#a07828]">
                  <ShoppingCart className="h-4 w-4" />
                </div>
                <h2 className="font-serif text-lg tracking-tight">Orbit Selection</h2>
              </div>
              {selectedPropertyIds.size > 0 && (
                <button 
                  onClick={() => setSelectedPropertyIds(new Set())}
                  className="text-[9px] font-mono uppercase tracking-widest text-red-400 hover:text-red-500"
                >
                  Limpar
                </button>
              )}
            </div>
            
            <div className="p-4 bg-white/50 rounded-xl border border-[#a07828]/10 shadow-[inner_0_2px_4px_rgba(0,0,0,0.02)]">
              <div className="flex justify-between items-baseline mb-1">
                <span className="font-mono text-[9px] uppercase tracking-wider text-[#8a7f70]">Carrinho Ativo</span>
                <span className="font-serif text-2xl text-[#a07828]">{selectedPropertyIds.size}</span>
              </div>
              <p className="text-[10px] text-[#8a7f70] font-serif italic">Imóveis prontos para curadoria</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
            {/* Target Lead Selection */}
            <div className="space-y-4">
              <label className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#8a7f70] flex items-center gap-2">
                <Users size={10} /> 1. Lead Destinatário
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#8a7f70]" />
                <Input 
                  value={leadSearch}
                  onChange={(e) => setLeadSearch(e.target.value)}
                  placeholder="Buscar lead para envio..."
                  className="pl-9 h-10 text-xs border-[rgba(28,24,18,0.1)] focus:border-[#a07828]/30 rounded-xl bg-[#fdfaf5]"
                />
              </div>

              <div className="space-y-1.5">
                {selectedLeadId && searchParams.get('leadId') === selectedLeadId ? (
                  // Locked version when coming from specific lead panel
                  <div className="w-full flex items-center gap-3 p-3 rounded-xl border border-[#a07828]/40 bg-[#a07828]/5 shadow-sm">
                    <div className="w-9 h-9 rounded-lg bg-[#ede8df] flex items-center justify-center border border-black/5 text-[11px] font-bold text-[#1c1812]">
                      {leads?.find(l => l.id === selectedLeadId)?.name[0] || 'L'}
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-[12px] font-semibold leading-none truncate text-[#1c1812]">
                        {leads?.find(l => l.id === selectedLeadId)?.name || 'Lead Selecionado'}
                      </p>
                      <p className="text-[9px] text-[#a07828] mt-1 uppercase font-mono tracking-widest font-bold">Lid Ativo</p>
                    </div>
                    <Check className="h-4 w-4 text-[#a07828]" />
                  </div>
                ) : (
                  // Search results version
                  filteredLeads.map(lead => (
                    <button
                      key={lead.id}
                      onClick={() => setSelectedLeadId(lead.id)}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-xl border transition-all ${selectedLeadId === lead.id ? 'bg-[#a07828]/5 border-[#a07828]/30 shadow-sm' : 'border-transparent hover:bg-[#ede8df]/30'}`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-[#ede8df] flex items-center justify-center border border-black/5 text-[10px] font-bold text-[#1c1812]">
                        {lead.name[0]}
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <p className="text-[11px] font-medium leading-none truncate">{lead.name}</p>
                        <p className="text-[9px] text-[#8a7f70] mt-1 uppercase font-mono tracking-tighter">{lead.orbitStage || 'Exploração'}</p>
                      </div>
                      {selectedLeadId === lead.id && <Check className="h-3 w-3 text-[#a07828]" />}
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Selection Preview */}
            {selectedPropertyIds.size > 0 && (
              <div className="space-y-4">
                <label className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#8a7f70]">
                  2. Itens da Curadoria
                </label>
                <div className="space-y-2">
                  {properties.filter(p => selectedPropertyIds.has(p.id)).map(p => (
                    <div key={p.id} className="flex items-center gap-3 p-2.5 bg-[#fdfaf5]/50 rounded-xl border border-[rgba(28,24,18,0.05)] hover:bg-[#fdfaf5] transition-colors group">
                      <div className="w-10 h-10 rounded-lg bg-[#ede8df] overflow-hidden shrink-0 border border-black/5">
                        {p.cover_image && <img src={p.cover_image} className="w-full h-full object-cover" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-medium truncate font-serif">{p.title || p.internal_name}</p>
                        <p className="text-[9px] text-[#a07828] font-bold mt-0.5">
                          {p.value ? `R$ ${(p.value / 1000000).toFixed(1)}M` : 'Sob consulta'}
                        </p>
                      </div>
                      <button 
                        onClick={() => togglePropertySelection(p)}
                        className="p-1.5 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Action Footer */}
          <div className="p-6 border-t border-[rgba(28,24,18,0.08)] bg-[#fdfaf5]">
            <Button
              disabled={!selectedLeadId || selectedPropertyIds.size === 0 || isSending}
              onClick={handleSendToLead}
              className="w-full bg-[#1c1812] hover:bg-black h-12 text-xs gap-3 rounded-xl shadow-xl shadow-black/10 transition-all font-mono uppercase tracking-widest font-bold"
            >
              {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {isSending ? 'Enviando...' : `Disparar para ${selectedLeadId ? (leads?.find(l => l.id === selectedLeadId)?.name.split(' ')[0] || 'Lead') : 'Lead'}`}
            </Button>
            <p className="text-[9px] text-[#8a7f70] text-center mt-3 font-mono leading-relaxed opacity-60">
              O link da curadoria será gerado e enviado via WhatsApp Lead Controller.
            </p>
          </div>
        </aside>
      </div>

      {/* Modals & Overlays */}
      <AnimatePresence>
        {isVoiceModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <VoiceIngestion 
              onClose={() => setIsVoiceModalOpen(false)}
              onDataExtracted={(data) => {
                setScrapedData({
                  title: data.title || "",
                  image: "",
                  value: data.value ? data.value.toString() : "",
                  neighborhood: data.neighborhood,
                  city: data.city,
                  area_privativa: data.area_privativa,
                  bedrooms: data.bedrooms,
                  suites: data.suites,
                  parking_spots: data.parking_spots,
                  condo_fee: data.condo_fee,
                  iptu: data.iptu,
                  features: data.features,
                  payment: data.payment || ""
                })
                setIsVoiceModalOpen(false)
                setIsIngestModalOpen(true)
              }}
            />
          </div>
        )}

        {isIngestModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white border border-[rgba(28,24,18,0.1)] rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-[rgba(28,24,18,0.05)] flex items-center justify-between bg-[#f5f1eb]">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-[#a07828]/10 text-[#a07828]">
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <h3 className="font-serif text-xl">Revisão de Cadastro</h3>
                    <p className="text-[10px] font-mono uppercase tracking-widest text-[#8a7f70]">IA Extraction Quality Control</p>
                  </div>
                </div>
                <button onClick={() => setIsIngestModalOpen(false)} className="p-2 hover:bg-black/5 rounded-full text-[#8a7f70]">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleConfirmIngest} className="p-8 overflow-y-auto space-y-6 custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2 space-y-2">
                    <label className="text-[10px] font-mono uppercase tracking-widest text-[#8a7f70]">Título do Patrimônio</label>
                    <Input 
                      value={scrapedData.title}
                      onChange={(e) => setScrapedData({...scrapedData, title: e.target.value})}
                      className="border-[rgba(28,24,18,0.1)] h-11 rounded-xl bg-[#fdfaf5]"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-mono uppercase tracking-widest text-[#8a7f70]">Valor (R$)</label>
                    <Input 
                      type="number"
                      value={scrapedData.value}
                      onChange={(e) => setScrapedData({...scrapedData, value: e.target.value})}
                      className="border-[rgba(28,24,18,0.1)] h-11 rounded-xl bg-[#fdfaf5]"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-mono uppercase tracking-widest text-[#8a7f70]">URL da Imagem</label>
                    <Input 
                      value={scrapedData.image}
                      onChange={(e) => setScrapedData({...scrapedData, image: e.target.value})}
                      placeholder="https://..."
                      className="border-[rgba(28,24,18,0.1)] h-11 rounded-xl bg-[#fdfaf5]"
                    />
                  </div>

                  <div className="md:col-span-2 space-y-2">
                    <label className="text-[10px] font-mono uppercase tracking-widest text-[#8a7f70]">Condições de Pagamento</label>
                    <Input 
                      value={scrapedData.payment}
                      onChange={(e) => setScrapedData({...scrapedData, payment: e.target.value})}
                      placeholder="Ex: Aceita permuta, 30% entrada..."
                      className="border-[rgba(28,24,18,0.1)] h-11 rounded-xl bg-[#fdfaf5]"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3 md:col-span-2">
                    <div className="p-3 bg-[#f5f1eb] rounded-xl border border-[rgba(28,24,18,0.05)] text-center">
                      <span className="text-[8px] font-mono uppercase text-[#8a7f70]">Dorms</span>
                      <p className="text-sm font-bold">{scrapedData.bedrooms || '-'}</p>
                    </div>
                    <div className="p-3 bg-[#f5f1eb] rounded-xl border border-[rgba(28,24,18,0.05)] text-center">
                      <span className="text-[8px] font-mono uppercase text-[#8a7f70]">Suítes</span>
                      <p className="text-sm font-bold">{scrapedData.suites || '-'}</p>
                    </div>
                    <div className="p-3 bg-[#f5f1eb] rounded-xl border border-[rgba(28,24,18,0.05)] text-center">
                      <span className="text-[8px] font-mono uppercase text-[#8a7f70]">Área</span>
                      <p className="text-sm font-bold">{scrapedData.area_privativa ? `${scrapedData.area_privativa}m²` : '-'}</p>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-[rgba(28,24,18,0.05)] flex gap-3">
                  <Button 
                    type="button" 
                    variant="ghost" 
                    onClick={() => setIsIngestModalOpen(false)}
                    className="flex-1 h-12 text-xs font-mono uppercase tracking-widest rounded-xl"
                  >
                    Cancelar
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={ingestStatus === "processing"}
                    className="flex-[2] h-12 bg-[#1c1812] hover:bg-black text-white gap-2 font-bold uppercase tracking-widest text-[10px] rounded-xl shadow-lg"
                  >
                    {ingestStatus === "processing" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    Validar e Inserir no Acervo
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <MapModal 
        isOpen={isMapModalOpen}
        onClose={() => setIsMapModalOpen(false)}
        selectedIds={selectedPropertyIds}
        onToggleSelect={togglePropertySelection}
      />

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(160, 120, 40, 0.1); border-radius: 99px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(160, 120, 40, 0.2); }
      `}</style>
    </div>
  )
}

function SelectionsHistory() {
  const [capsules, setCapsules] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [managingLeadId, setManagingLeadId] = useState<string | null>(null)
  const supabase = getSupabase()

  async function fetchCapsules() {
    setLoading(true)
    const { data, error } = await (supabase
      .from('client_spaces') as any)
      .select('*, leads(name), capsule_items:capsule_items(count)')
      .order('created_at', { ascending: false })
    
    if (data) setCapsules(data)
    setLoading(false)
  }

  useEffect(() => {
    fetchCapsules()
  }, [])

  const handleCopyLink = (slug: string) => {
    const url = `${window.location.origin}/selection/${slug}`
    navigator.clipboard.writeText(url)
    toast.success("Link copiado para o clipboard!")
  }

  if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-[#a07828]" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-[rgba(28,24,18,0.05)] pb-6">
        <div>
          <h2 className="font-serif text-3xl">Histórico de Selections</h2>
          <p className="text-sm text-[#8a7f70] mt-1 font-serif italic">Administre os portais curados enviados para seus leads.</p>
        </div>
        <Button variant="ghost" onClick={fetchCapsules} className="h-8 w-8 p-0">
          <Loader2 className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {capsules.length === 0 ? (
          <div className="text-center p-20 border-2 border-dashed border-[rgba(28,24,18,0.05)] rounded-2xl">
            <Link2 className="h-10 w-10 text-[#8a7f70]/20 mx-auto mb-4" />
            <p className="text-[#8a7f70] font-serif italic">Nenhuma seleção enviada ainda.</p>
          </div>
        ) : capsules.map(cap => (
          <div key={cap.id} className="p-6 bg-white rounded-2xl border border-[rgba(28,24,18,0.05)] shadow-sm flex items-center justify-between hover:border-[#a07828]/20 transition-all group">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-[#fdfaf5] border border-[#a07828]/10 flex items-center justify-center text-[#a07828]">
                <Users size={20} />
              </div>
              <div>
                <h4 className="font-serif text-lg leading-none">{cap.leads?.name || 'Lead s/ nome'}</h4>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-[9px] font-mono uppercase tracking-widest text-[#a07828] bg-[#a07828]/5 px-2 py-0.5 rounded">
                    {cap.capsule_items?.[0]?.count || 0} Imóveis
                  </span>
                  <span className="text-[10px] text-[#8a7f70] font-mono">
                    {new Date(cap.created_at).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button 
                onClick={() => handleCopyLink(cap.slug)}
                className="p-2.5 rounded-xl bg-[#f5f1eb] text-[#8a7f70] hover:text-[#a07828] transition-colors"
                title="Copiar Link"
              >
                <Link2 size={16} />
              </button>
              <a 
                href={`/selection/${cap.slug}`} 
                target="_blank"
                className="p-2.5 rounded-xl bg-[#f5f1eb] text-[#8a7f70] hover:text-[#1c1812] transition-colors"
                title="Visualizar Portal"
              >
                <ExternalLink size={16} />
              </a>
              <Button 
                variant="ghost" 
                onClick={() => setManagingLeadId(cap.lead_id)}
                className="text-[10px] font-mono uppercase tracking-widest gap-2 hover:bg-[#a07828]/5 text-[#a07828] h-10 px-4"
              >
                <Settings size={14} />
                Gerenciar
              </Button>
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {managingLeadId && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-xl h-[80vh] bg-white border border-[rgba(28,24,18,0.1)] rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            >
               <ClientSpacesManager 
                 leadId={managingLeadId} 
                 onClose={() => {
                   setManagingLeadId(null);
                   fetchCapsules();
                 }} 
               />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
export default function AtlasManager() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#f5f1eb] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#a07828]" />
      </div>
    }>
      <AtlasManagerContent />
    </Suspense>
  )
}
