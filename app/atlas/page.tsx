"use client"

import { useState, useMemo, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { useSupabaseProperties, useSupabaseLeads } from "@/hooks/use-supabase-data"
import { useAuth } from "@/hooks/use-auth"
import { useTheme } from "next-themes"
import ClientSpacesManager from "@/components/atlas/ClientSpacesManager"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Search, Filter, Plus, Map as MapIcon, 
  LayoutGrid, List, Sparkles, Share2, 
  MoreHorizontal, ChevronRight, Building2,
  Mic, Loader2, Users, ShoppingCart, Send,
  X, Check, ExternalLink, Link2, Compass, Settings, Trash2, Pencil, ChevronLeft, Eye, Heart, Calendar
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getSupabase } from "@/lib/supabase"
import { toast } from "sonner"
import dynamic from "next/dynamic"

import { TopBar } from "@/components/top-bar"
import { useRouter } from "next/navigation"
import { OrbitProvider } from "@/components/orbit-context"
import MapModal from "@/components/atlas/MapModal"
import VoiceIngestion from "@/components/atlas/VoiceIngestion"
import { AdvancedFilters } from "@/components/atlas/AdvancedFilters"

const EditPropertyModal = dynamic(() => import("@/components/atlas/EditPropertyModal"), { ssr: false })

// ── Aesthetics & Tokens ──────────────────────────────────────────────────────
const theme = {
  bg: "var(--orbit-bg)",
  bgSecondary: "var(--orbit-bg-secondary)",
  border: "var(--orbit-line)",
  glass: "var(--orbit-glass)",
  ink: "var(--orbit-text)",
  inkMuted: "var(--orbit-text-muted)",
  accent: "var(--orbit-glow)",
  accentBg: "var(--orbit-glow-light)",
}

// ── Components ───────────────────────────────────────────────────────────────

function PropertyCard({ 
  property, 
  isSelected, 
  onToggleSelect,
  onEdit
}: { 
  property: any, 
  isSelected: boolean, 
  onToggleSelect: (p: any) => void,
  onEdit?: (p: any) => void
}) {
  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`group relative bg-[var(--orbit-bg)] border ${isSelected ? 'border-[var(--orbit-glow)] ring-1 ring-[var(--orbit-glow)]/30 shadow-[var(--orbit-shadow)]' : 'border-[var(--orbit-line)]'} rounded-xl overflow-hidden hover:shadow-[var(--orbit-shadow-hover)] hover:border-[var(--orbit-glow)]/40 transition-all duration-300 cursor-pointer`}
      onClick={() => onEdit && onEdit(property)}
    >
      <div className="aspect-[16/10] overflow-hidden bg-[var(--orbit-bg-secondary)]">
        {property.cover_image ? (
          <img 
            src={property.cover_image} 
            alt={property.title} 
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 opacity-90 group-hover:opacity-100"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[var(--orbit-text-muted)]">
            <Building2 className="h-8 w-8 opacity-20" />
          </div>
        )}
        
        <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-[var(--orbit-bg)]/60 backdrop-blur-md border border-[var(--orbit-line)] text-[9px] font-mono uppercase tracking-wider text-[var(--orbit-glow)] shadow-sm">
          Curadoria Orbit
        </div>

        {isSelected && (
          <div className="absolute inset-0 bg-[var(--orbit-glow)]/10 flex items-center justify-center backdrop-blur-[1px]">
            <div className="bg-[var(--orbit-glow)] text-white p-2.5 rounded-full shadow-[var(--orbit-shadow)]">
              <Check className="h-4 w-4 stroke-[3px]" />
            </div>
          </div>
        )}
      </div>

      <div className="p-5">
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-display text-[17px] font-medium text-[var(--orbit-text)] leading-tight group-hover:text-[var(--orbit-glow)] transition-colors pr-2">
            {property.title || property.internal_name || "Sem título"}
          </h3>
          <span className="text-sm font-sans font-medium text-[var(--orbit-text)] whitespace-nowrap">
            {property.value ? `R$ ${(property.value / 1000000).toFixed(1)}M` : "Sob consulta"}
          </span>
        </div>
        
        <p className="text-[11px] text-[var(--orbit-text-muted)] mb-3 flex items-center gap-1.5 font-medium">
          <MapIcon className="h-3 w-3 text-[var(--orbit-glow)]/70" />
          {property.location_text || "Localização não informada"}
        </p>

        {property.payment_conditions && (
          <div className="mb-4 px-2.5 py-1.5 bg-[var(--orbit-glow)]/5 border border-[var(--orbit-glow)]/15 rounded-md text-[10px] text-[var(--orbit-glow)] font-sans font-medium">
            <span className="font-bold opacity-70 flex items-center gap-1 mb-0.5"><Eye size={10} /> USO INTERNO:</span>
            {typeof property.payment_conditions === 'object' 
              ? (property.payment_conditions.custom || JSON.stringify(property.payment_conditions))
              : property.payment_conditions
            }
          </div>
        )}

        <div className="flex items-center gap-2 pt-4 border-t border-[var(--orbit-line)]">
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 px-2 text-[10px] uppercase tracking-widest font-mono text-[var(--orbit-text-muted)] hover:text-[var(--orbit-text)] hover:bg-[var(--orbit-glow)]/5"
            onClick={(e) => {
              e.stopPropagation()
              if (onEdit) onEdit(property)
            }}
          >
            Ver Detalhes
          </Button>
          <div className="ml-auto flex gap-1.5">
            <Button 
              size="icon" 
              variant="ghost" 
              className={`h-8 w-8 rounded-full border ${isSelected ? 'border-[var(--orbit-glow)] bg-[var(--orbit-glow)] text-white hover:bg-[var(--orbit-glow)]/90 shadow-[var(--orbit-shadow)]' : 'border-[var(--orbit-line)] text-[var(--orbit-text-muted)] hover:border-[var(--orbit-glow)]/40 hover:text-[var(--orbit-glow)] hover:bg-[var(--orbit-glow)]/5'}`}
              onClick={(e) => {
                e.stopPropagation()
                onToggleSelect(property)
              }}
            >
              {isSelected ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            </Button>
            {onEdit && (
              <Button 
                size="icon" 
                variant="ghost" 
                className="h-8 w-8 rounded-full border border-[var(--orbit-line)] text-[var(--orbit-text-muted)] hover:border-[var(--orbit-glow)]/40 hover:text-[var(--orbit-glow)] hover:bg-[var(--orbit-glow)]/5"
                onClick={(e) => {
                  e.stopPropagation()
                  onEdit(property)
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

function AtlasManagerContent() {
  const { resolvedTheme, setTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const { logout } = useAuth()
  const router = useRouter()
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
  const [ingestUrl, setIngestUrl] = useState("")
  const [ingestStatus, setIngestStatus] = useState<"idle" | "processing" | "complete" | "failed">("idle")
  const [ingestStep, setIngestStep] = useState<"url" | "review">("url")
  
  const [scrapedData, setScrapedData] = useState<any>({
    title: "", image: "", value: "", condo_name: "", payment: "",
    source_link: "", source_domain: "", bedrooms: "", suites: "", area_privativa: ""
  })

  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<Set<string>>(new Set())
  const [isSending, setIsSending] = useState(false)
  const [editingProperty, setEditingProperty] = useState<any>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  const [minPrice, setMinPrice] = useState<number | null>(null)
  const [maxPrice, setMaxPrice] = useState<number | null>(null)
  const [bedrooms, setBedrooms] = useState<number | null>(null)
  const [neighborhoods, setNeighborhoods] = useState<string[]>([])

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

  const handleIngestSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ingestUrl) return
    setIngestStatus("processing")
    
    try {
      const previewRes = await fetch("/api/link-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: ingestUrl }),
      })
      const data = await previewRes.json()
      
      setScrapedData({
        title: data.title || "",
        image: data.image || "",
        value: data.value ? data.value.toString() : "",
        neighborhood: data.neighborhood || "",
        city: data.city || "",
        area_privativa: data.area_privativa || null,
        bedrooms: data.bedrooms || null,
        suites: data.suites || "",
        parking_spots: data.parking_spots || "",
        condo_fee: data.condo_fee || "",
        iptu: data.iptu || "",
        features: data.features || [],
        payment: "",
        source_link: data.sourceLink || ingestUrl,
        source_domain: data.sourceDomain || ""
      })
      setIngestStep("review")
      setIngestStatus("idle")
    } catch (err) {
      setIngestStatus("failed")
      toast.error("Falha ao capturar dados do link")
    }
  }

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
        area_privativa: parseFloat(scrapedData.area_privativa) || null,
        bedrooms: parseInt(scrapedData.bedrooms) || null,
        suites: parseInt(scrapedData.suites) || null,
        parking_spots: parseInt(scrapedData.parking_spots) || null,
        condo_fee: parseFloat(scrapedData.condo_fee) || null,
        iptu: parseFloat(scrapedData.iptu) || null,
        features: scrapedData.features || [],
        payment_conditions: scrapedData.payment ? { custom: scrapedData.payment } : null,
        source_link: scrapedData.source_link,
        source_domain: scrapedData.source_domain
      }

      const { data, error } = await (supabase.from("properties") as any).insert([payload]).select().single()
      if (error) throw error
      
      setIngestStatus("complete")
      toast.success("Imóvel cadastrado com sucesso!")
      await refetch()
      setTimeout(() => {
        setIsIngestModalOpen(false)
        setIngestStatus("idle")
        setIngestUrl("")
        setIngestStep("url")
        setScrapedData({ title: "", image: "", value: "", condo_name: "", payment: "" })
      }, 1500)
    } catch(err: any) {
      setIngestStatus("failed")
      toast.error(`Erro ao salvar: ${err.message}`)
    }
  }

  const handleUpdateProperty = async (updatedData: any) => {
    setIsSavingEdit(true)
    const supabase = getSupabase()

    try {
      const { error } = await (supabase.from("properties") as any)
        .update({
          title: updatedData.title,
          value: parseFloat(updatedData.value) || null,
          location_text: updatedData.location_text,
          neighborhood: updatedData.neighborhood,
          city: updatedData.city,
          cover_image: updatedData.cover_image,
          lat: updatedData.lat,
          lng: updatedData.lng
        })
        .eq("id", updatedData.id)

      if (error) throw error

      toast.success("Imóvel atualizado com sucesso!")
      await refetch()
      setIsEditModalOpen(false)
      setEditingProperty(null)
    } catch (err: any) {
      toast.error(`Erro ao atualizar: ${err.message}`)
    } finally {
      setIsSavingEdit(false)
    }
  }

  const handleDeleteProperty = async (propertyId: string) => {
    try {
      const res = await fetch(`/api/properties/${propertyId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Falha ao excluir')
      }
      toast.success("Imóvel excluído do banco de dados")
      await refetch()
      setIsEditModalOpen(false)
      setEditingProperty(null)
    } catch (err: any) {
      toast.error(`Erro ao excluir: ${err.message}`)
      throw err
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

    if (minPrice !== null) base = base.filter(p => (p.value || 0) >= minPrice)
    if (maxPrice !== null) base = base.filter(p => (p.value || 0) <= maxPrice)
    if (bedrooms !== null) {
      base = base.filter(p => {
        const beds = p.bedrooms || 0
        return bedrooms === 4 ? beds >= 4 : beds === bedrooms
      })
    }
    if (neighborhoods.length > 0) {
      base = base.filter(p => p.neighborhood && neighborhoods.includes(p.neighborhood))
    }

    return base.filter(p => 
      p.title?.toLowerCase().includes(search.toLowerCase()) || 
      p.location_text?.toLowerCase().includes(search.toLowerCase()) ||
      p.internal_name?.toLowerCase().includes(search.toLowerCase())
    )
  }, [properties, search, filteredIds, minPrice, maxPrice, bedrooms, neighborhoods])

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
        body: JSON.stringify({ 
          query: naturalSearch,
          minPrice,
          maxPrice,
          bedrooms,
          neighborhoods
        })
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

    try {
      const propertyIds = Array.from(selectedPropertyIds)
      const lead = leads?.find(l => l.id === selectedLeadId)

      if (!lead) throw new Error("Lead não encontrado na lista local")

      if (!lead.phone && !lead.lid) {
        toast.error("Lead sem telefone ou identificador (LID) cadastrado!")
        setIsSending(false)
        return
      }

      console.log("[ATLAS] Chamando API send-selection", { selectedLeadId, propertyIds })

      // ── 1. Criar/buscar portal + registrar imóveis via API segura (service role, sem RLS) ──
      const selectionRes = await fetch('/api/atlas/send-selection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: selectedLeadId, propertyIds })
      })

      const selectionData = await selectionRes.json()

      if (!selectionRes.ok) {
        throw new Error(selectionData.error || `Falha na API (${selectionRes.status})`)
      }

      const { slug: useSlug } = selectionData

      // ── 2. Disparar WhatsApp ──
      const portalUrl = `${window.location.origin}/selection/${useSlug}`
      const message = `Olá ${lead.name.split(' ')[0]}! Selecionei alguns imóveis que fazem sentido para seu perfil. Você pode conferir aqui no seu portal exclusivo: ${portalUrl}`
      const sendTo = (lead.lid ? (lead.lid.includes('@lid') ? lead.lid : `${lead.lid}@lid`) : null) || lead.phone

      console.log("[ATLAS] Disparando WhatsApp para:", sendTo)

      const waRes = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: sendTo, message, leadId: selectedLeadId })
      })

      if (!waRes.ok) {
        const waErr = await waRes.json().catch(() => ({}))
        throw new Error(waErr.error || "Falha ao disparar WhatsApp")
      }

      toast.success(`${propertyIds.length} imóveis enviados e portal gerado!`)
      setSelectedPropertyIds(new Set())
      setSelectedLeadId(null)
      setLeadSearch("")

    } catch (err: any) {
      console.error("[ATLAS] Erro em handleSendToLead:", err)
      toast.error(`Falha: ${err.message}`)
    } finally {
      setIsSending(false)
    }
  }


  if (propsLoading || leadsLoading) {
    return (
      <div className={`min-h-screen bg-[var(--orbit-bg)] flex items-center justify-center`}>
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--orbit-glow)]" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--orbit-text-muted)]">Carregando Manager...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--orbit-bg)] text-[var(--orbit-text)] relative overflow-hidden font-sans flex flex-col h-screen">
      <TopBar 
        totalLeads={leads?.length || 0}
        isDark={isDark}
        onThemeToggle={() => setTheme(isDark ? "light" : "dark")}
        onLogout={logout}
      />
      
      <div className="flex-1 flex flex-col mt-14 md:mt-16 overflow-hidden">
      {/* Decorative Glows */}
      {isDark && (
        <>
          <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[var(--orbit-glow)]/5 blur-[120px] rounded-full pointer-events-none" />
          <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-[var(--orbit-glow)]/5 blur-[120px] rounded-full pointer-events-none" />
        </>
      )}
      
      {/* Grain */}
      <div className="fixed inset-0 z-50 pointer-events-none" style={grainStyle} />

      {/* Minimalist Header — Orbit style */}
      <header className="h-14 border-b border-[var(--orbit-line)] bg-[var(--orbit-glass)]/90 backdrop-blur-xl flex items-center px-6 gap-4 sticky top-0 z-30 shrink-0">
        {/* Brand */}
        <div className="flex items-center gap-3 pr-4 border-r border-[var(--orbit-line)]">
          <button onClick={() => window.history.back()} className="p-1.5 rounded-lg hover:bg-[var(--orbit-glow)]/5 text-[var(--orbit-text-muted)] hover:text-[var(--orbit-text)] transition-colors" title="Voltar">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="w-6 h-6 rounded-lg bg-[var(--orbit-glow)]/10 border border-[var(--orbit-glow)]/20 flex items-center justify-center text-[var(--orbit-glow)]">
            <Compass className="h-3.5 w-3.5" />
          </div>
          <span className="font-display text-[11px] uppercase tracking-[0.18em] text-[var(--orbit-text)] font-bold">Atlas</span>
        </div>

        {/* Tabs */}
        <nav className="flex items-center gap-0.5">
          {[
            { id: 'curadoria', label: 'Curadoria' },
            { id: 'selections', label: 'Selections' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-1.5 rounded-lg text-[11px] font-mono uppercase tracking-wider transition-all ${
                activeTab === tab.id 
                  ? 'text-white bg-[var(--orbit-glow)] shadow-sm' 
                  : 'text-[var(--orbit-text-muted)] hover:text-[var(--orbit-text)] hover:bg-[var(--orbit-line)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Semantic search */}
        <div className="flex-1 max-w-sm relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--orbit-text-muted)] transition-colors group-focus-within:text-[var(--orbit-glow)]" />
          <form onSubmit={handleNaturalSearch}>
            <Input 
              value={naturalSearch}
              onChange={(e) => {
                setNaturalSearch(e.target.value)
                if (!e.target.value) setFilteredIds(null)
              }}
              placeholder="Busca semântica..."
              className="w-full pl-9 h-8 bg-[var(--orbit-bg-secondary)] border border-[var(--orbit-line)] rounded-lg text-xs text-[var(--orbit-text)] placeholder:text-[var(--orbit-text-muted)]/40 focus:border-[var(--orbit-glow)]/30 focus:ring-0 transition-all font-sans pr-8"
            />
          </form>
          {isSearchingNatural && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-[var(--orbit-glow)]" />
          )}
          {naturalSearch && !isSearchingNatural && (
            <button 
              onClick={() => { setNaturalSearch(""); setFilteredIds(null) }}
              className={`absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full transition-colors ${isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}
            >
              <X className="h-3 w-3 text-[var(--orbit-text-muted)]" />
            </button>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 ml-auto">
          <button 
            onClick={() => setIsMapModalOpen(true)}
            className="p-2 rounded-lg border border-[var(--orbit-line)] bg-[var(--orbit-glow)]/5 text-[var(--orbit-glow)] hover:bg-[var(--orbit-glow)]/10 transition-all"
            title="Visualizar no Mapa"
          >
            <MapIcon className="h-4 w-4" />
          </button>
          <button 
            onClick={() => { setIngestStep("url"); setIsIngestModalOpen(true) }}
            className="p-2 rounded-lg border border-[var(--orbit-line)] text-[var(--orbit-text-muted)] hover:text-[var(--orbit-glow)] hover:bg-[var(--orbit-glow)]/10 transition-all"
            title="Cadastrar via URL"
          >
            <Link2 className="h-4 w-4" />
          </button>
          <button 
            onClick={() => setIsVoiceModalOpen(true)}
            className="h-8 px-4 bg-[var(--orbit-glow)] hover:bg-[var(--orbit-glow)]/90 text-white rounded-lg flex items-center gap-2 shadow-[var(--orbit-shadow)] transition-all font-mono text-[10px] uppercase tracking-wider font-bold"
          >
            <Mic className="h-3.5 w-3.5" />
            Voz
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Main Side View */}
        <main className="flex-1 overflow-y-auto p-10 custom-scrollbar relative z-10">
          <AnimatePresence mode="wait">
            {activeTab === 'curadoria' && (
              <motion.div 
                key="curadoria"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="max-w-7xl mx-auto space-y-8"
              >
                <div className="flex items-center justify-between border-b border-[var(--orbit-line)] pb-6">
                  <div>
                    <h2 className="font-display font-medium text-3xl text-[var(--orbit-text)]">Curadoria Inteligente</h2>
                    <p className="text-xs text-[var(--orbit-text-muted)] mt-1 font-sans">Ativos recomendados para leads estratégicos da Orbit.</p>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--orbit-text-muted)]" />
                      <Input 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Filtrar base..."
                        className="pl-9 h-9 w-48 text-xs bg-[var(--orbit-bg-secondary)] border border-[var(--orbit-line)] rounded-lg text-[var(--orbit-text)] placeholder:text-[var(--orbit-text-muted)]/60 focus:border-[var(--orbit-glow)]/40 shadow-sm transition-all"
                      />
                    </div>
                    
                    <AdvancedFilters 
                      minPrice={minPrice} 
                      maxPrice={maxPrice} 
                      bedrooms={bedrooms} 
                      neighborhoods={neighborhoods} 
                      onChange={({ minPrice, maxPrice, bedrooms, neighborhoods }) => {
                        setMinPrice(minPrice)
                        setMaxPrice(maxPrice)
                        setBedrooms(bedrooms)
                        setNeighborhoods(neighborhoods)
                      }} 
                    />
                    
                    <div className="w-px h-8 bg-[var(--orbit-line)] mx-2" />
                    <Button 
                      onClick={() => setIsMapModalOpen(true)}
                      variant="outline" 
                      size="sm" 
                      className="h-9 px-4 gap-2 bg-[var(--orbit-glow)]/10 border border-[var(--orbit-glow)]/20 text-[10px] font-mono uppercase tracking-wider text-[var(--orbit-glow)] hover:bg-[var(--orbit-glow)]/20 hover:border-[var(--orbit-glow)]/40 shadow-[var(--orbit-shadow)] transition-all"
                    >
                      <MapIcon className="h-3.5 w-3.5" />
                      Visualizar no Mapa
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
                      onEdit={(p) => {
                        setEditingProperty({ ...p })
                        setIsEditModalOpen(true)
                      }}
                    />
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
        <aside className="w-80 bg-[var(--orbit-bg-secondary)] border-l border-[var(--orbit-line)] flex flex-col relative z-20 shadow-[-10px_0_40px_rgba(0,0,0,0.05)] shrink-0">
          <div className="p-6 border-b border-[var(--orbit-line)] bg-[var(--orbit-bg)]/60">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-[var(--orbit-glow)]/10 border border-[var(--orbit-glow)]/20 text-[var(--orbit-glow)]">
                  <ShoppingCart className="h-4 w-4" />
                </div>
                <h2 className="font-display font-semibold text-[var(--orbit-text)] text-lg tracking-tight">Orbit Selection</h2>
              </div>
              {selectedPropertyIds.size > 0 && (
                <button 
                  onClick={() => setSelectedPropertyIds(new Set())}
                  className="text-[9px] font-mono uppercase tracking-widest text-red-400/70 hover:text-red-400 transition-colors"
                >
                  Limpar
                </button>
              )}
            </div>
            
            <div className="p-4 bg-[var(--orbit-glow)]/5 rounded-xl border border-[var(--orbit-glow)]/15">
              <div className="flex justify-between items-baseline mb-1">
                <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--orbit-text-muted)]">Carrinho Ativo</span>
                <span className="font-display font-bold text-2xl text-[var(--orbit-glow)]">{selectedPropertyIds.size}</span>
              </div>
              <p className="text-[10px] text-[var(--orbit-text-muted)] font-sans">Imóveis prontos para curadoria</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
            {/* Target Lead Selection */}
            <div className="space-y-4">
              <label className="font-mono text-[9px] uppercase tracking-[0.2em] text-[var(--orbit-text-muted)] flex items-center gap-2">
                <Users size={10} /> 1. Lead Destinatário
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--orbit-text-muted)]" />
                <Input 
                  value={leadSearch}
                  onChange={(e) => setLeadSearch(e.target.value)}
                  placeholder="Buscar lead para envio..."
                  className="pl-9 h-10 text-xs border border-[var(--orbit-line)] focus:border-[var(--orbit-glow)]/40 rounded-xl bg-[var(--orbit-bg)]/50 text-[var(--orbit-text)] placeholder:text-[var(--orbit-text-muted)]/50"
                />
              </div>

              <div className="space-y-1.5">
                {selectedLeadId && searchParams.get('leadId') === selectedLeadId ? (
                  <div className="w-full flex items-center gap-3 p-3 rounded-xl border border-[var(--orbit-glow)]/30 bg-[var(--orbit-glow)]/5 shadow-sm">
                    <div className="w-9 h-9 rounded-lg bg-[var(--orbit-bg-secondary)] border border-[var(--orbit-glow)]/20 flex items-center justify-center text-[11px] font-bold text-[var(--orbit-glow)]">
                      {leads?.find(l => l.id === selectedLeadId)?.name[0] || 'L'}
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-[12px] font-semibold leading-none truncate text-[var(--orbit-text)]">
                        {leads?.find(l => l.id === selectedLeadId)?.name || 'Lead Selecionado'}
                      </p>
                      <p className="text-[9px] text-[var(--orbit-glow)] mt-1 uppercase font-mono tracking-widest font-bold">Lid Ativo</p>
                    </div>
                    <Check className="h-4 w-4 text-[var(--orbit-glow)]" />
                  </div>
                ) : (
                  filteredLeads.map(lead => (
                    <button
                      key={lead.id}
                      onClick={() => setSelectedLeadId(lead.id)}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-xl border transition-all ${selectedLeadId === lead.id ? 'bg-[var(--orbit-glow)]/5 border-[var(--orbit-glow)]/25 shadow-sm' : 'border-transparent hover:bg-[var(--orbit-glow)]/5'}`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-[var(--orbit-bg-secondary)] border border-[var(--orbit-line)] flex items-center justify-center text-[10px] font-bold text-[var(--orbit-text)]">
                        {lead.name[0]}
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <p className="text-[11px] font-medium leading-none truncate text-[var(--orbit-text)]">{lead.name}</p>
                        <p className="text-[9px] text-[var(--orbit-text-muted)] mt-1 uppercase font-mono tracking-tighter">{lead.orbitStage || 'Exploração'}</p>
                      </div>
                      {selectedLeadId === lead.id && <Check className="h-3 w-3 text-[var(--orbit-glow)]" />}
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Selection Preview */}
            {selectedPropertyIds.size > 0 && (
              <div className="space-y-4">
                <label className="font-mono text-[9px] uppercase tracking-[0.2em] text-[var(--orbit-text-muted)]">
                  2. Itens da Curadoria
                </label>
                <div className="space-y-2">
                  {properties.filter(p => selectedPropertyIds.has(p.id)).map(p => (
                    <div key={p.id} className="flex items-center gap-3 p-2.5 bg-[var(--orbit-bg)] rounded-xl border border-[var(--orbit-line)] hover:bg-[var(--orbit-bg-secondary)] hover:border-[var(--orbit-glow)]/15 transition-colors group">
                      <div className="w-10 h-10 rounded-lg bg-[var(--orbit-bg-secondary)] overflow-hidden shrink-0 border border-[var(--orbit-line)]">
                        {p.cover_image && <img src={p.cover_image} className="w-full h-full object-cover" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-medium truncate text-[var(--orbit-text)]">{p.title || p.internal_name}</p>
                        <p className="text-[9px] text-[var(--orbit-glow)] font-bold mt-0.5">
                          {p.value ? `R$ ${(p.value / 1000000).toFixed(1)}M` : 'Sob consulta'}
                        </p>
                      </div>
                      <button 
                        onClick={() => togglePropertySelection(p)}
                        className="p-1.5 opacity-0 group-hover:opacity-100 hover:text-rose-500 text-[var(--orbit-text-muted)] transition-all"
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
          <div className="p-6 border-t border-[rgba(46,197,255,0.12)] bg-[#05060a]/60">
            <Button
              disabled={!selectedLeadId || selectedPropertyIds.size === 0 || isSending}
              onClick={handleSendToLead}
              className="w-full bg-[#2ec5ff] hover:bg-[#2ec5ff]/90 text-[#05060a] h-12 text-xs gap-3 rounded-xl shadow-[0_0_20px_rgba(46,197,255,0.2)] transition-all font-mono uppercase tracking-widest font-bold disabled:opacity-40 disabled:shadow-none"
            >
              {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {isSending ? 'Enviando...' : `Disparar para ${selectedLeadId ? (leads?.find(l => l.id === selectedLeadId)?.name.split(' ')[0] || 'Lead') : 'Lead'}`}
            </Button>
            <p className="text-[9px] text-[#94a3b8]/60 text-center mt-3 font-mono leading-relaxed">
              O link da curadoria será gerado e enviado via WhatsApp.
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
                 setIngestStep("review")
                 setIsIngestModalOpen(true)
               }}
            />
          </div>
        )}

        {isIngestModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-[#0b1220] border border-[rgba(46,197,255,0.2)] rounded-2xl shadow-[0_0_60px_rgba(46,197,255,0.1)] w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-[rgba(46,197,255,0.12)] flex items-center justify-between bg-[#05060a]/60">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-[#2ec5ff]/10 border border-[#2ec5ff]/20 text-[#2ec5ff]">
                    <Sparkles size={18} />
                  </div>
                  <div>
                    <h3 className="font-sans font-semibold text-lg text-[#e6eef6]">Revisão de Cadastro</h3>
                    <p className="text-[10px] font-mono uppercase tracking-widest text-[#94a3b8]">IA Extraction Quality Control</p>
                  </div>
                </div>
                <button onClick={() => setIsIngestModalOpen(false)} className="p-2 hover:bg-white/5 rounded-full text-[#94a3b8] hover:text-[#e6eef6] transition-colors">
                  <X size={18} />
                </button>
              </div>

               {ingestStep === 'url' ? (
                <form onSubmit={handleIngestSubmit} className="p-8 space-y-6">
                  <div className="space-y-3">
                    <label className="text-[10px] font-mono uppercase tracking-widest text-[#94a3b8]">URL do Imóvel</label>
                    <p className="text-[11px] text-[#94a3b8] font-sans mb-4">Insira o link do portal imobiliário para captura automática.</p>
                    <div className="relative group">
                      <Link2 className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#2ec5ff]/40 group-focus-within:text-[#2ec5ff] transition-colors" />
                      <Input 
                        value={ingestUrl}
                        onChange={(e) => setIngestUrl(e.target.value)}
                        placeholder="https://www.zapimoveis.com.br/imovel/..."
                        className="w-full pl-12 h-14 bg-[#05060a]/60 border border-[rgba(46,197,255,0.15)] rounded-2xl text-xs text-[#e6eef6] placeholder:text-[#94a3b8]/50 focus:border-[#2ec5ff]/40"
                      />
                    </div>
                  </div>
                  
                  <Button 
                    type="submit" 
                    disabled={ingestStatus === "processing" || !ingestUrl}
                    className="w-full h-14 bg-[#2ec5ff] hover:bg-[#2ec5ff]/90 text-[#05060a] gap-3 font-bold uppercase tracking-widest text-[11px] rounded-2xl shadow-[0_0_20px_rgba(46,197,255,0.2)] transition-all hover:scale-[1.01] disabled:opacity-40 disabled:scale-100"
                  >
                    {ingestStatus === "processing" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
                    Capturar Dados com IA
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleConfirmIngest} className="p-8 overflow-y-auto space-y-6 custom-scrollbar">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2 space-y-2">
                      <label className="text-[10px] font-mono uppercase tracking-widest text-[#94a3b8]">Título do Patrimônio</label>
                      <Input 
                        value={scrapedData.title}
                        onChange={(e) => setScrapedData({...scrapedData, title: e.target.value})}
                        className="border border-[rgba(46,197,255,0.15)] h-11 rounded-xl bg-[#05060a]/60 text-[#e6eef6] focus:border-[#2ec5ff]/40"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-mono uppercase tracking-widest text-[#94a3b8]">Valor (R$)</label>
                      <Input 
                        type="number"
                        value={scrapedData.value}
                        onChange={(e) => setScrapedData({...scrapedData, value: e.target.value})}
                        className="border border-[rgba(46,197,255,0.15)] h-11 rounded-xl bg-[#05060a]/60 text-[#e6eef6] focus:border-[#2ec5ff]/40"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-mono uppercase tracking-widest text-[#94a3b8]">URL da Imagem</label>
                      <Input 
                        value={scrapedData.image}
                        onChange={(e) => setScrapedData({...scrapedData, image: e.target.value})}
                        placeholder="https://..."
                        className="border border-[rgba(46,197,255,0.15)] h-11 rounded-xl bg-[#05060a]/60 text-[#e6eef6] placeholder:text-[#94a3b8]/40 focus:border-[#2ec5ff]/40"
                      />
                    </div>

                    <div className="md:col-span-2 space-y-2">
                      <label className="text-[10px] font-mono uppercase tracking-widest text-[#94a3b8]">Condições de Pagamento</label>
                      <Input 
                        value={scrapedData.payment}
                        onChange={(e) => setScrapedData({...scrapedData, payment: e.target.value})}
                        placeholder="Ex: Aceita permuta, 30% entrada..."
                        className="border border-[rgba(46,197,255,0.15)] h-11 rounded-xl bg-[#05060a]/60 text-[#e6eef6] placeholder:text-[#94a3b8]/40 focus:border-[#2ec5ff]/40"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-3 md:col-span-2">
                      <div className="space-y-1">
                        <label className="text-[8px] font-mono uppercase text-[#94a3b8]">Dorms</label>
                        <Input 
                          type="number"
                          value={scrapedData.bedrooms}
                          onChange={(e) => setScrapedData({...scrapedData, bedrooms: e.target.value})}
                          className="h-9 bg-[#2ec5ff]/5 border border-[rgba(46,197,255,0.1)] text-center text-xs font-bold"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[8px] font-mono uppercase text-[#94a3b8]">Suítes</label>
                        <Input 
                          type="number"
                          value={scrapedData.suites}
                          onChange={(e) => setScrapedData({...scrapedData, suites: e.target.value})}
                          className="h-9 bg-[#2ec5ff]/5 border border-[rgba(46,197,255,0.1)] text-center text-xs font-bold"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[8px] font-mono uppercase text-[#94a3b8]">Área (m²)</label>
                        <Input 
                          type="number"
                          value={scrapedData.area_privativa}
                          onChange={(e) => setScrapedData({...scrapedData, area_privativa: e.target.value})}
                          className="h-9 bg-[#2ec5ff]/5 border border-[rgba(46,197,255,0.1)] text-center text-xs font-bold"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-[rgba(46,197,255,0.1)] flex gap-3">
                    <Button 
                      type="button" 
                      variant="ghost" 
                      onClick={() => setIngestStep("url")}
                      className="flex-1 h-12 text-xs font-mono uppercase tracking-widest rounded-xl text-[#94a3b8] hover:text-[#e6eef6] hover:bg-white/5"
                    >
                      Voltar
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={ingestStatus === "processing"}
                      className="flex-[2] h-12 bg-[#2ec5ff] hover:bg-[#2ec5ff]/90 text-[#05060a] gap-2 font-bold uppercase tracking-widest text-[10px] rounded-xl shadow-[0_0_15px_rgba(46,197,255,0.2)]"
                    >
                      {ingestStatus === "processing" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      Validar e Inserir na Curadoria
                    </Button>
                  </div>
                </form>
              )}
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

      <EditPropertyModal 
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false)
          setEditingProperty(null)
        }}
        property={editingProperty}
        onSave={handleUpdateProperty}
        onDelete={handleDeleteProperty}
      />

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(46, 197, 255, 0.3); }
      `}</style>
      </div>
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
    const { data: capsulesData, error } = await (supabase
      .from('client_spaces') as any)
      .select('*, leads(name, capsule_items(count))')
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error("[ATLAS] Selections history error:", error)
      toast.error("Erro ao carregar histórico: " + error.message)
      setLoading(false)
      return
    }
    
    if (capsulesData && capsulesData.length > 0) {
      const leadIds = capsulesData.map((c: any) => c.lead_id)
      
      // Use Server API to bypass RLS for metrics unification
      const intRes = await fetch(`/api/property-interactions?leadId=${leadIds.join(',')}`)
      const intData = await intRes.json()
      const interactionsData = intData.interactions || []

      const statsByLead = leadIds.reduce((acc: any, id: string) => {
        const leadInts = interactionsData.filter((i: any) => i.lead_id === id);
        acc[id] = {
          views: leadInts.filter((i: any) => i.interaction_type === 'viewed').length,
          likes: leadInts.filter((i: any) => i.interaction_type === 'favorited').length,
          discards: leadInts.filter((i: any) => i.interaction_type === 'discarded').length,
          visits: leadInts.filter((i: any) => i.interaction_type === 'visited').length,
        }
        return acc;
      }, {})

      setCapsules(capsulesData.map((c: any) => ({ ...c, stats: statsByLead[c.lead_id] })))
    } else {
      setCapsules([])
    }
    
    setLoading(false)
  }

  async function handleDeleteSpace(id: string) {
    if (!confirm("Tem certeza que deseja excluir este portal? Esta ação é irreversível.")) return
    
    const { error } = await supabase
      .from('client_spaces')
      .delete()
      .eq('id', id)

    if (error) {
      toast.error("Erro ao excluir: " + error.message)
    } else {
      toast.success("Portal excluído com sucesso!")
      fetchCapsules()
    }
  }

  useEffect(() => {
    fetchCapsules()
  }, [])

  const handleCopyLink = (slug: string) => {
    const url = `${window.location.origin}/selection/${slug}`
    navigator.clipboard.writeText(url)
    toast.success("Link copiado para o clipboard!")
  }

  if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-[#2ec5ff]" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-[rgba(46,197,255,0.15)] pb-6">
        <div>
          <h2 className="font-sans font-medium text-2xl text-[#e6eef6]">Histórico de Selections</h2>
          <p className="text-sm text-[#94a3b8] mt-1 font-sans">Administre os portais curados enviados para seus leads.</p>
        </div>
        <Button variant="ghost" onClick={fetchCapsules} className="h-8 w-8 p-0 text-[#94a3b8] hover:text-[#2ec5ff] hover:bg-white/5">
          <Loader2 className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {capsules.length === 0 ? (
          <div className="text-center p-20 border-2 border-dashed border-[rgba(46,197,255,0.08)] rounded-2xl">
            <Link2 className="h-10 w-10 text-[#94a3b8]/20 mx-auto mb-4" />
            <p className="text-[#94a3b8] font-sans">Nenhuma seleção enviada ainda.</p>
          </div>
        ) : capsules.map(cap => (
          <div key={cap.id} className="p-6 bg-[#0b1220] rounded-2xl border border-[rgba(46,197,255,0.1)] flex items-center justify-between hover:border-[#2ec5ff]/25 hover:shadow-[0_0_20px_rgba(46,197,255,0.05)] transition-all group">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-[#2ec5ff]/10 border border-[#2ec5ff]/20 flex items-center justify-center text-[#2ec5ff]">
                <Users size={18} />
              </div>
              <div>
                <h4 className="font-sans font-semibold text-[#e6eef6] leading-none">{cap.leads?.name || 'Lead s/ nome'}</h4>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-[9px] font-mono uppercase tracking-widest text-[#2ec5ff] bg-[#2ec5ff]/10 px-2 py-0.5 rounded border border-[#2ec5ff]/20">
                    {cap.leads?.capsule_items?.[0]?.count || 0} Imóveis
                  </span>
                  <span className="text-[10px] text-[#94a3b8] font-mono">
                    {new Date(cap.created_at).toLocaleDateString('pt-BR')}
                  </span>
                </div>
                {cap.stats && (
                  <div className="flex gap-3 mt-3 text-[10px] font-mono font-medium" title="Interações no Portal">
                    <span className="flex items-center gap-1.5 text-[#94a3b8]"><Eye size={12} /> {cap.stats.views} views</span>
                    <span className="flex items-center gap-1.5 text-rose-400"><Heart size={12} /> {cap.stats.likes}</span>
                    <span className="flex items-center gap-1.5 text-emerald-400"><Calendar size={12} /> {cap.stats.visits}</span>
                    {cap.stats.discards > 0 && <span className="flex items-center gap-1.5 text-[#94a3b8]/50"><X size={12} /> {cap.stats.discards}</span>}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button 
                onClick={() => handleCopyLink(cap.slug)}
                className="p-2.5 rounded-xl bg-white/5 border border-[rgba(46,197,255,0.1)] text-[#94a3b8] hover:text-[#2ec5ff] hover:border-[#2ec5ff]/25 transition-colors"
                title="Copiar Link"
              >
                <Link2 size={15} />
              </button>
              <a 
                href={`/selection/${cap.slug}`} 
                target="_blank"
                className="p-2.5 rounded-xl bg-white/5 border border-[rgba(46,197,255,0.1)] text-[#94a3b8] hover:text-[#2ec5ff] hover:border-[#2ec5ff]/25 transition-colors"
                title="Visualizar Portal"
              >
                <ExternalLink size={15} />
              </a>
              <Button 
                variant="ghost" 
                onClick={() => setManagingLeadId(cap.lead_id)}
                className="text-[10px] font-mono uppercase tracking-widest gap-2 hover:bg-[#2ec5ff]/5 hover:text-[#2ec5ff] text-[#94a3b8] h-10 px-4 border border-[rgba(46,197,255,0.1)] rounded-xl"
              >
                <Settings size={13} />
                Gerenciar
              </Button>
              <button 
                onClick={() => handleDeleteSpace(cap.id)}
                className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:text-red-300 hover:bg-red-500/15 transition-colors"
                title="Excluir Portal"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {managingLeadId && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-xl h-[80vh] bg-[#0b1220] border border-[rgba(46,197,255,0.2)] rounded-3xl shadow-[0_0_60px_rgba(46,197,255,0.1)] overflow-hidden flex flex-col"
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
    <OrbitProvider>
      <Suspense fallback={
        <div className="min-h-screen bg-[#05060a] flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#2ec5ff]" />
        </div>
      }>
        <AtlasManagerContent />
      </Suspense>
    </OrbitProvider>
  )
}
