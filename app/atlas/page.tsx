"use client"

import { useState, useMemo, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { useSupabaseProperties, useSupabaseLeads, useLeadDetails } from "@/hooks/use-supabase-data"
import { useAuth } from "@/hooks/use-auth"
import { useTheme } from "next-themes"
// ClientSpacesManager imported dynamically below
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
import { AdvancedFilters } from "@/components/atlas/AdvancedFilters"

const EditPropertyModal = dynamic(() => import("@/components/atlas/EditPropertyModal"), { ssr: false })
const ClientSpacesManager = dynamic(() => import("@/components/atlas/ClientSpacesManager"), { ssr: false })
const MapModal = dynamic(() => import("@/components/atlas/MapModal"), { ssr: false })
const VoiceIngestion = dynamic(() => import("@/components/atlas/VoiceIngestion"), { ssr: false })

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

// ── Match Engine ─────────────────────────────────────────────────────────────

function computeMatch(property: any, lead: any) {
  if (!lead) return null;
  
  let score = 0;
  const reasons: string[] = [];
  const warnings: string[] = [];

  // 1. Orçamento (Peso 3)
  const propPrice = property.value || 0;
  const leadBudget = lead.budget || 0;
  if (leadBudget > 0) {
    if (propPrice <= leadBudget) {
      score += 3;
      reasons.push("Dentro do orçamento");
    } else if (propPrice <= leadBudget * 1.1) {
      score += 1;
      warnings.push("Levemente acima do budget");
    } else {
      warnings.push("Acima do orçamento");
    }
  }

  // 2. Dormitórios (Peso 2)
  const propBeds = property.bedrooms || 0;
  const leadBeds = lead.desired_bedrooms || lead.bedrooms || 0;
  if (leadBeds > 0) {
    if (propBeds >= leadBeds) {
      score += 2;
      reasons.push(`${propBeds} dormitórios`);
    } else {
      warnings.push("Menos dormitórios que o ideal");
    }
  }

  // 3. Características (Peso 2 por match)
  const propFeatures = property.features || [];
  const leadFeatures = lead.desired_features || [];
  if (leadFeatures.length > 0) {
    const matchedFeatures = propFeatures.filter((f: string) => 
      leadFeatures.some((lf: string) => f.toLowerCase().includes(lf.toLowerCase()))
    );
    if (matchedFeatures.length > 0) {
      score += matchedFeatures.length * 2;
      matchedFeatures.forEach((f: string) => reasons.push(f));
    }
  }

  // 4. Localização (Peso 2)
  const propNeighborhood = property.neighborhood?.toLowerCase() || "";
  const leadLocations = lead.preferred_locations || [];
  if (leadLocations.length > 0) {
    if (leadLocations.some((loc: string) => propNeighborhood.includes(loc.toLowerCase()))) {
      score += 2;
      reasons.push("Localização desejada");
    }
  }

  return {
    score: Math.min(score, 10), // Normalizar para 10
    reasons,
    warnings
  };
}

function getScoreColor(score: number) {
  if (score >= 8) return "bg-emerald-500";
  if (score >= 5) return "bg-amber-500";
  return "bg-rose-500";
}

// ── Components ───────────────────────────────────────────────────────────────

function PropertyCard({
  property,
  isSelected,
  selectedLead,
  onToggleSelect,
  onEdit
}: {
  property: any,
  isSelected: boolean,
  selectedLead?: any,
  onToggleSelect: (p: any) => void,
  onEdit?: (p: any) => void
}) {
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0)
  const match = useMemo(() => computeMatch(property, selectedLead), [property, selectedLead])

  const allPhotos = useMemo(() => {
    const photos = property.photos || []
    if (property.cover_image && !photos.includes(property.cover_image)) {
      return [property.cover_image, ...photos]
    }
    return photos.length > 0 ? photos : [property.cover_image].filter(Boolean)
  }, [property])

  const formatPrice = (val: number) => {
    if (!val) return "Sob consulta"
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0
    }).format(val)
  }

  const nextPhoto = (e: React.MouseEvent) => {
    e.stopPropagation()
    setCurrentPhotoIndex((prev) => (prev + 1) % allPhotos.length)
  }

  const prevPhoto = (e: React.MouseEvent) => {
    e.stopPropagation()
    setCurrentPhotoIndex((prev) => (prev - 1 + allPhotos.length) % allPhotos.length)
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`group relative bg-[var(--orbit-bg)] border ${isSelected ? 'border-[var(--orbit-glow)] ring-1 ring-[var(--orbit-glow)]/30 shadow-[var(--orbit-shadow)]' : 'border-[var(--orbit-line)]'} rounded-2xl overflow-hidden hover:shadow-[var(--orbit-shadow-hover)] hover:border-[var(--orbit-glow)]/40 transition-all duration-300 cursor-pointer`}
      onClick={() => onEdit && onEdit(property)}
    >
      {/* PHOTO CAROUSEL */}
      <div className="aspect-[4/5] overflow-hidden bg-[var(--orbit-bg-secondary)] relative group/carousel">
        <AnimatePresence mode="wait">
          <motion.img
            key={currentPhotoIndex}
            src={allPhotos[currentPhotoIndex] || "/placeholder-property.jpg"}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover opacity-95 group-hover:opacity-100"
          />
        </AnimatePresence>

        {/* NAVIGATION ARROWS */}
        {allPhotos.length > 1 && (
          <>
            <button 
              onClick={prevPhoto}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/20 backdrop-blur-md text-white opacity-0 group-hover/carousel:opacity-100 transition-opacity hover:bg-black/40"
            >
              <ChevronLeft size={16} />
            </button>
            <button 
              onClick={nextPhoto}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/20 backdrop-blur-md text-white opacity-0 group-hover/carousel:opacity-100 transition-opacity hover:bg-black/40"
            >
              <ChevronRight size={16} />
            </button>
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1">
              {allPhotos.slice(0, 5).map((imgUrl: string, i: number) => (
                <div 
                  key={i} 
                  className={`w-1 h-1 rounded-full transition-all ${i === currentPhotoIndex ? 'bg-white w-2' : 'bg-white/40'}`} 
                />
              ))}
            </div>
          </>
        )}

        {/* TOP BADGES */}
        <div className="absolute top-3 left-3 flex flex-col gap-2">
          <div className="px-2.5 py-1 rounded-lg bg-black/40 backdrop-blur-md border border-white/10 text-[9px] font-mono uppercase tracking-wider text-white shadow-sm">
            Curadoria Orbit
          </div>
          {match && match.score > 0 && (
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className={`px-2.5 py-1 rounded-lg ${getScoreColor(match.score)} text-white text-[10px] font-bold shadow-lg flex items-center gap-1.5`}
            >
              🔥 Match {match.score.toFixed(1)}
            </motion.div>
          )}
        </div>

        {isSelected && (
          <div className="absolute inset-0 bg-[var(--orbit-glow)]/10 flex items-center justify-center backdrop-blur-[1px]">
            <div className="bg-[var(--orbit-glow)] text-white p-2.5 rounded-full shadow-[var(--orbit-shadow)]">
              <Check className="h-4 w-4 stroke-[3px]" />
            </div>
          </div>
        )}
      </div>

      {/* CONTENT */}
      <div className="p-4">
        <div className="flex justify-between items-start mb-1">
          <h3 className="font-display text-[15px] font-semibold text-[var(--orbit-text)] leading-tight group-hover:text-[var(--orbit-glow)] transition-colors line-clamp-1 flex-1 pr-2">
            {property.title || property.internal_name || "Sem título"}
          </h3>
          <span className="text-[14px] font-semibold text-[var(--orbit-text)] whitespace-nowrap">
            {formatPrice(property.value)}
          </span>
        </div>

        <p className="text-[11px] text-[var(--orbit-text-muted)] mb-2 flex items-center gap-1.5 font-medium opacity-80">
          <MapIcon className="h-3 w-3 text-[var(--orbit-glow)]/70" />
          {property.neighborhood || property.location_text || "Localização não informada"}
        </p>

        {/* TECH SPECS: Minimalist Line */}
        <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-[var(--orbit-text-muted)] py-2 border-y border-[var(--orbit-line)]/50 mb-3">
          <span>{property.area_privativa || property.area_total || "--"} m²</span>
          <span className="w-1 h-1 rounded-full bg-[var(--orbit-line)]" />
          <span>{property.bedrooms || "0"} dorm</span>
          <span className="w-1 h-1 rounded-full bg-[var(--orbit-line)]" />
          <span>{property.suites || "0"} suítes</span>
        </div>

        {/* MATCH REASONS: Only if match exists and is relevant */}
        {match && match.score > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {match.reasons.slice(0, 2).map((reason: string, i: number) => (
              <span key={i} className="px-2 py-0.5 rounded-md bg-emerald-500/5 text-emerald-500 text-[9px] font-medium border border-emerald-500/10">
                {reason}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-0 text-[10px] uppercase tracking-[0.15em] font-bold text-[var(--orbit-text-muted)] hover:text-[var(--orbit-glow)] hover:bg-transparent transition-all"
            onClick={(e) => {
              e.stopPropagation()
              if (onEdit) onEdit(property)
            }}
          >
            Ver Detalhes
          </Button>
          
          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggleSelect(property)
            }}
            className={`p-1.5 rounded-full transition-all border ${isSelected ? 'bg-[var(--orbit-glow)] border-[var(--orbit-glow)] text-white shadow-sm' : 'bg-transparent border-[var(--orbit-line)] text-[var(--orbit-text-muted)] hover:border-[var(--orbit-glow)]'}`}
          >
            {isSelected ? <Check size={14} /> : <Plus size={14} />}
          </button>
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
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false)
  const [editingProperty, setEditingProperty] = useState<any>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [managingLeadId, setManagingLeadId] = useState<string | null>(null)

  const [minPrice, setMinPrice] = useState<number | null>(null)
  const [maxPrice, setMaxPrice] = useState<number | null>(null)
  const [bedrooms, setBedrooms] = useState<number | null>(null)
  const [neighborhoods, setNeighborhoods] = useState<string[]>([])

  const { refetch: refetchProps } = useSupabaseProperties()
  const { memories: leadMemories, cognitiveState: activeCog, loading: leadDetailsLoading } = useLeadDetails(selectedLeadId)

  const leadPreferences = useMemo(() => {
    if (!selectedLeadId || !leadMemories) return null;
    
    const prefs: any = {
      budget: 0,
      bedrooms: 0,
      desired_features: [],
      preferred_locations: []
    };

    leadMemories.forEach((m: any) => {
      const content = m.content.toLowerCase();
      if (m.type === 'budget' || m.type === 'budget_range') {
        const match = content.match(/(\d+[\d.]*)/g);
        if (match) prefs.budget = Math.max(prefs.budget, ...match.map((n: string) => parseFloat(n.replace(/\./g, ''))));
      }
      if (m.type === 'feature_preference') {
        prefs.desired_features.push(m.content);
      }
      if (m.type === 'location_preference' || m.type === 'location_focus') {
        prefs.preferred_locations.push(m.content);
      }
      if (content.includes('quarto') || content.includes('dorm')) {
        const match = content.match(/(\d+)/);
        if (match) prefs.bedrooms = Math.max(prefs.bedrooms, parseInt(match[1]));
      }
    });

    return prefs;
  }, [selectedLeadId, leadMemories]);

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
      // 🚀 Integração VistaNet - Bypass Rápido e Estruturado
      const isVistaNet = ingestUrl.includes('novovista') || ingestUrl.includes('v.imo.bi') || ingestUrl.includes('v2=')

      if (isVistaNet) {
        const res = await fetch("/api/property/import-vistanet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: ingestUrl }),
        })
        const data = await res.json()

        if (!res.ok) throw new Error(data.error || "Erro na importação nativa do VistaNet")

        toast.success(`Captura estruturada: ${data.title}`)
        setIngestStatus("complete")
        await refetch()

        setTimeout(() => {
          setIsIngestModalOpen(false)
          setIngestStatus("idle")
          setIngestUrl("")
        }, 1500)
        return
      }

      // 🤖 Fallback para AI Extractor (para VivaReal, Zap, etc)
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
        photos: data.photos || [],
        description: data.description || "",
        payment: "",
        source_link: data.sourceLink || ingestUrl,
        source_domain: data.sourceDomain || ""
      })
      setIngestStep("review")
      setIngestStatus("idle")
    } catch (err: any) {
      setIngestStatus("failed")
      toast.error(err.message || "Falha ao capturar dados do link")
      setTimeout(() => setIngestStatus("idle"), 2000)
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
        photos: scrapedData.photos || [],
        description: scrapedData.description || null,
        payment_conditions: scrapedData.payment ? { custom: scrapedData.payment } : null,
        internal_notes: scrapedData.payment || null,
        source_link: scrapedData.source_link,
        source_domain: scrapedData.source_domain,
        status: 'active'
      }

      const res = await fetch("/api/properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || `Erro na API (${res.status})`)
      }

      setIngestStatus("complete")
      toast.success("Imóvel cadastrado com sucesso!")
      await refetch()
      setTimeout(() => {
        setIsIngestModalOpen(false)
        setIngestStatus("idle")
        setIngestUrl("")
        setIngestStep("url")
        setScrapedData({ title: "", image: "", value: "", condo_name: "", payment: "", photos: [] })
      }, 1500)
    } catch (err: any) {
      setIngestStatus("failed")
      toast.error(`Erro ao salvar: ${err.message}`)
    }
  }

  const handleUpdateProperty = async (updatedData: any) => {
    setIsSavingEdit(true)

    try {
      const res = await fetch(`/api/properties/${updatedData.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: updatedData.title,
          value: parseFloat(updatedData.value) || null,
          location_text: updatedData.location_text,
          neighborhood: updatedData.neighborhood,
          city: updatedData.city,
          cover_image: updatedData.cover_image,
          lat: updatedData.lat,
          lng: updatedData.lng,
          bedrooms: parseInt(updatedData.bedrooms) || null,
          suites: parseInt(updatedData.suites) || null,
          area_privativa: parseFloat(updatedData.area_privativa) || null,
          area_total: parseFloat(updatedData.area_total) || null,
          ui_type: updatedData.ui_type || null,
          condo_name: updatedData.condo_name || null,
          internal_notes: updatedData.internal_notes || null,
          topics: typeof updatedData.topics === 'string'
            ? updatedData.topics.split(',').map((t: string) => t.trim()).filter(Boolean)
            : updatedData.topics,
          features: typeof updatedData.features === 'string'
            ? updatedData.features.split(',').map((f: string) => f.trim()).filter(Boolean)
            : updatedData.features,
          description: updatedData.description || null
        })
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || `Erro na API (${res.status})`)
      }

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

  const handleMarkAsSoldProperty = async (propertyId: string) => {
    try {
      const res = await fetch(`/api/properties/${propertyId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: 'sold' })
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || `Erro na API (${res.status})`)
      }

      toast.success("Imóvel marcado como Vendido!")
      await refetch()
      setIsEditModalOpen(false)
      setEditingProperty(null)
    } catch (err: any) {
      toast.error(`Erro ao atualizar status: ${err.message}`)
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

      // Removida velha restrição de (lead.phone || lead.lid) pois a API send-selection absorve essa validação ou disparo.

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

      toast.success(`${propertyIds.length} imóveis curados e portal gerado para o lead!`)
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
      <AnimatePresence mode="wait">
        {managingLeadId ? (
          <motion.div
            key="hub-overlay"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            className="fixed inset-0 z-[110] bg-[var(--orbit-bg)] flex flex-col h-screen w-screen overflow-hidden"
          >
            <ClientSpacesManager
              leadId={managingLeadId}
              onClose={() => setManagingLeadId(null)}
            />
          </motion.div>
        ) : (
          <div key="atlas-main" className="flex flex-col h-full overflow-hidden">
            <TopBar
              totalLeads={leads?.length || 0}
              isDark={isDark}
              onThemeToggle={() => setTheme(isDark ? "light" : "dark")}
              onLogout={logout}
            />

            <div className="flex-1 flex flex-col mt-14 md:mt-16 overflow-hidden">
              {/* Grain */}
              <div className="fixed inset-0 z-50 pointer-events-none" style={grainStyle} />

              <header className="h-14 border-b border-[var(--orbit-line)] bg-[var(--orbit-glass)]/90 backdrop-blur-xl flex items-center px-6 gap-4 sticky top-0 z-30 shrink-0">
          {/* Brand */}
          <div className="flex items-center gap-3 pr-4 border-r border-[var(--orbit-line)]">
            <button onClick={() => router.push("/")} className="p-1.5 rounded-lg hover:bg-[var(--orbit-glow)]/5 text-[var(--orbit-text-muted)] hover:text-[var(--orbit-text)] transition-colors" title="Voltar">
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
                className={`px-4 py-1.5 rounded-lg text-[11px] font-mono uppercase tracking-wider transition-all ${activeTab === tab.id
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
              VOZ
            </button>
          </div>
        </header>

        {/* Layout Wrapper: Main Content + Sidebar */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* Mobile Cart Trigger */}
          {!isMobileCartOpen && (
            <div className="md:hidden fixed bottom-20 right-4 z-40">
              <button onClick={() => setIsMobileCartOpen(true)} className="bg-[var(--orbit-glow)] text-[var(--orbit-bg)] px-4 py-3 rounded-full shadow-lg font-bold text-[11px] uppercase tracking-wider flex items-center gap-2 transition-transform active:scale-95 border border-[var(--orbit-glow)]/20">
                <ShoppingCart className="w-5 h-5" />
                {selectedPropertyIds.size > 0 ? `Seleção (${selectedPropertyIds.size})` : 'Curadoria'}
              </button>
            </div>
          )}
          {/* Main Side View */}
          <main className={`flex-1 overflow-y-auto p-4 md:p-10 custom-scrollbar relative z-10 pb-24 md:pb-10`}>
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
                        onChange={({ minPrice, maxPrice, bedrooms, neighborhoods }: any) => {
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
                        selectedLead={leadPreferences}
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
                  <SelectionsHistory 
                    managingLeadId={managingLeadId} 
                    setManagingLeadId={setManagingLeadId} 
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </main>

          {/* Orbit Selection Sidebar */}
          <>
            {/* Backdrop for mobile */}
              {isMobileCartOpen && (
                <div className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm" onClick={() => setIsMobileCartOpen(false)} />
              )}
              <aside className={`fixed inset-y-0 right-0 z-50 md:relative md:z-20 w-[85%] md:w-80 max-w-sm bg-[var(--orbit-bg-secondary)] border-l border-[var(--orbit-line)] flex-col shadow-[-10px_0_40px_rgba(0,0,0,0.05)] shrink-0 transition-transform duration-300 ${isMobileCartOpen ? 'translate-x-0 flex' : 'translate-x-full md:translate-x-0 hidden md:flex'}`}>
                <div className="p-6 border-b border-[var(--orbit-line)] bg-[var(--orbit-bg)]/60 relative">
                  <button onClick={() => setIsMobileCartOpen(false)} className="md:hidden absolute top-4 right-4 p-2 bg-[var(--orbit-bg-secondary)] rounded-full border border-[var(--orbit-line)] text-[var(--orbit-text-muted)] focus:outline-none">
                    <X className="w-4 h-4" />
                  </button>
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

                    <div className="space-y-1.5 min-h-[140px]">
                      {(() => {
                        const selectedLeadDetails = leads?.find(l => l.id === selectedLeadId)
                        let displayLeads = [...filteredLeads]
                        if (selectedLeadDetails && !displayLeads.find(l => l.id === selectedLeadId)) {
                          displayLeads.unshift(selectedLeadDetails)
                        }
                        if (selectedLeadId && !selectedLeadDetails && !leadsLoading) {
                          displayLeads.unshift({ id: selectedLeadId, name: 'Lead Selecionado...', orbitStage: '' } as any)
                        }

                        return (
                          <>
                            {displayLeads.map(lead => {
                              const isSelected = selectedLeadId === lead.id
                              return (
                                <motion.button
                                  layout
                                  key={lead.id}
                                  onClick={() => setSelectedLeadId(lead.id)}
                                  className={`w-full flex items-center gap-3 p-3 rounded-2xl border transition-all ${isSelected ? 'bg-[var(--orbit-glow)]/10 border-[var(--orbit-glow)]/30 shadow-[var(--orbit-shadow)]' : 'border-transparent hover:bg-[var(--orbit-glow)]/5 hover:border-[var(--orbit-line)]'}`}
                                >
                                  <div className={`w-10 h-10 rounded-xl ${isSelected ? 'bg-[var(--orbit-glow)] text-white' : 'bg-[var(--orbit-bg-secondary)] border border-[var(--orbit-line)] text-[var(--orbit-text)]'} flex items-center justify-center text-xs font-bold shadow-sm transition-colors`}>
                                    {lead.name ? lead.name[0] : 'L'}
                                  </div>
                                  <div className="flex-1 text-left min-w-0">
                                    <p className="text-[12px] font-bold leading-tight truncate text-[var(--orbit-text)]">{lead.name}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                      <p className={`text-[9px] uppercase font-mono tracking-wider ${isSelected ? 'text-[var(--orbit-glow)] font-bold' : 'text-[var(--orbit-text-muted)]'}`}>
                                        {isSelected ? 'Lid Ativo' : (lead.orbitStage || 'Exploração')}
                                      </p>
                                      {isSelected && activeCog && (
                                        <div className="flex gap-1 items-center">
                                          <div className="w-1 h-1 rounded-full bg-[var(--orbit-glow)] opacity-40 mx-1" />
                                          <Sparkles size={10} className="text-[var(--orbit-glow)]" />
                                          <span className="text-[9px] font-mono text-[var(--orbit-glow)] font-bold">{Math.round(activeCog.interest_score || 0)}%</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  {isSelected && (
                                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="bg-[var(--orbit-glow)] p-1 rounded-full shadow-lg border border-white/20">
                                      <Check className="h-3 w-3 text-white stroke-[3px]" />
                                    </motion.div>
                                  )}
                                </motion.button>
                              )
                            })}
                          </>
                        )
                      })()}
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
                <div className="p-6 border-t border-[var(--orbit-glow)]/20 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] bg-[var(--orbit-bg)] pointer-events-auto">
                  <button
                    disabled={!selectedLeadId || selectedPropertyIds.size === 0 || isSending}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleSendToLead();
                    }}
                    className="w-full flex items-center justify-center bg-[var(--orbit-glow)] hover:bg-[var(--orbit-glow)]/90 text-[var(--orbit-bg)] h-12 text-xs gap-3 rounded-xl shadow-[0_4px_15px_var(--orbit-glow)]/30 transition-all font-mono uppercase tracking-widest font-bold disabled:opacity-40 disabled:shadow-none cursor-pointer disabled:cursor-not-allowed"
                  >
                    {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {isSending ? 'Enviando...' : `Disparar Curadoria`}
                  </button>
                  <p className="text-[9px] text-[var(--orbit-text-muted)] text-center mt-3 font-mono leading-relaxed">
                    Link gerado via WhatsApp.
                  </p>
                </div>
              </aside>
            </>
          </div>
        </div>
      </div>
    )}
    </AnimatePresence>

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
                          onChange={(e) => setScrapedData({ ...scrapedData, title: e.target.value })}
                          className="border border-[rgba(46,197,255,0.15)] h-11 rounded-xl bg-[#05060a]/60 text-[#e6eef6] focus:border-[#2ec5ff]/40"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-mono uppercase tracking-widest text-[#94a3b8]">Valor (R$)</label>
                        <Input
                          type="number"
                          value={scrapedData.value}
                          onChange={(e) => setScrapedData({ ...scrapedData, value: e.target.value })}
                          className="border border-[rgba(46,197,255,0.15)] h-11 rounded-xl bg-[#05060a]/60 text-[#e6eef6] focus:border-[#2ec5ff]/40"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-mono uppercase tracking-widest text-[#94a3b8]">URL da Imagem</label>
                        <Input
                          value={scrapedData.image}
                          onChange={(e) => setScrapedData({ ...scrapedData, image: e.target.value })}
                          placeholder="https://..."
                          className="border border-[rgba(46,197,255,0.15)] h-11 rounded-xl bg-[#05060a]/60 text-[#e6eef6] placeholder:text-[#94a3b8]/40 focus:border-[#2ec5ff]/40"
                        />
                      </div>

                      <div className="md:col-span-2 space-y-2">
                        <label className="text-[10px] font-mono uppercase tracking-widest text-[#94a3b8]">Condições de Pagamento</label>
                        <Input
                          value={scrapedData.payment}
                          onChange={(e) => setScrapedData({ ...scrapedData, payment: e.target.value })}
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
                            onChange={(e) => setScrapedData({ ...scrapedData, bedrooms: e.target.value })}
                            className="h-9 bg-[#2ec5ff]/5 border border-[rgba(46,197,255,0.1)] text-center text-xs font-bold"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[8px] font-mono uppercase text-[#94a3b8]">Suítes</label>
                          <Input
                            type="number"
                            value={scrapedData.suites}
                            onChange={(e) => setScrapedData({ ...scrapedData, suites: e.target.value })}
                            className="h-9 bg-[#2ec5ff]/5 border border-[rgba(46,197,255,0.1)] text-center text-xs font-bold"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[8px] font-mono uppercase text-[#94a3b8]">Área (m²)</label>
                          <Input
                            type="number"
                            value={scrapedData.area_privativa}
                            onChange={(e) => setScrapedData({ ...scrapedData, area_privativa: e.target.value })}
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
        onMarkAsSold={handleMarkAsSoldProperty}
      />

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(46, 197, 255, 0.3); }
      `}</style>
    </div>
  )
}

function SelectionsHistory({ 
  managingLeadId, 
  setManagingLeadId 
}: { 
  managingLeadId: string | null, 
  setManagingLeadId: (id: string | null) => void 
}) {
  const [capsules, setCapsules] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  const supabase = getSupabase()

  async function fetchCapsules() {
    setLoading(true)
    // 1. Fetch space and lead data with items count
    const { data: capsulesData, error } = await (supabase
      .from('client_spaces') as any)
      .select('*, leads(name, property_interactions(id, interaction_type))') // Fetching ids to count manually since client-side count is tricky
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
      // Promise.all to fetch individually since API expects 1 leadId per call
      const responses = await Promise.all(
        leadIds.filter(Boolean).map((id: string) => fetch(`/api/property-interactions?leadId=${id}`).catch(() => null))
      )

      const interactionsData: any[] = []
      for (const res of responses) {
        if (res && res.ok) {
          const intData = await res.json()
          if (intData.interactions) interactionsData.push(...intData.interactions)
        }
      }

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

      setCapsules(capsulesData.map((c: any) => {
        // Manually filter only SENT items for count (matching curated portal)
        const activeItems = c.leads?.property_interactions?.filter((item: any) => item.interaction_type === 'sent') || [];

        return { 
          ...c, 
          stats: statsByLead[c.lead_id],
          itemsCount: activeItems.length
        }
      }))
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

  if (loading && capsules.length === 0) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-[#2ec5ff]" /></div>

  return (
    <div className="relative min-h-[50vh]">
      <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-[var(--orbit-glow)]/10 pb-8">
        <div>
          <h2 className="font-display font-bold text-4xl text-[var(--orbit-text)] tracking-tight">Intelligence Hub</h2>
          <p className="text-sm text-[var(--orbit-text-muted)] mt-2 font-sans max-w-md leading-relaxed">
            Monitore o comportamento dos seus leads em tempo real e identifique as melhores oportunidades de fechamento.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative group min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--orbit-text-muted)] group-focus-within:text-[var(--orbit-glow)] transition-colors" />
            <Input 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar lead..."
              className="pl-9 h-9 text-xs bg-[var(--orbit-bg-secondary)] border border-[var(--orbit-line)] rounded-xl focus:border-[var(--orbit-glow)]/40 text-[var(--orbit-text)]"
            />
          </div>

          <div className="flex items-center bg-[var(--orbit-bg-secondary)] border border-[var(--orbit-line)] rounded-xl p-1">
            <button 
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-[var(--orbit-glow)]/10 text-[var(--orbit-glow)]' : 'text-[var(--orbit-text-muted)] hover:text-[var(--orbit-text)]'}`}
              title="Visualização em Grade"
            >
              <LayoutGrid size={16} />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-[var(--orbit-glow)]/10 text-[var(--orbit-glow)]' : 'text-[var(--orbit-text-muted)] hover:text-[var(--orbit-text)]'}`}
              title="Visualização em Lista"
            >
              <List size={16} />
            </button>
          </div>

          <div className="px-4 py-2 bg-[var(--orbit-glow)]/5 rounded-full border border-[var(--orbit-glow)]/15 flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--orbit-glow)] animate-pulse" />
            <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--orbit-glow)] font-bold">
              {capsules.length} Portais Ativos
            </span>
          </div>
          <Button variant="ghost" onClick={fetchCapsules} className="h-10 w-10 p-0 text-[var(--orbit-text-muted)] hover:text-[var(--orbit-glow)] hover:bg-[var(--orbit-glow)]/5 rounded-full border border-[var(--orbit-line)]">
            <Loader2 className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

      </div>

      <div className={viewMode === 'grid' ? "grid grid-cols-1 lg:grid-cols-2 gap-6" : "flex flex-col gap-3"}>
        {capsules
          .filter(cap => !searchTerm || cap.leads?.name?.toLowerCase().includes(searchTerm.toLowerCase()))
          .length === 0 ? (

          <div className="col-span-full text-center py-32 border-2 border-dashed border-[var(--orbit-glow)]/5 rounded-3xl bg-[var(--orbit-bg-secondary)]/30 backdrop-blur-sm">
            <div className="w-16 h-16 bg-[var(--orbit-glow)]/10 rounded-2xl flex items-center justify-center mx-auto mb-6 text-[var(--orbit-glow)]/40">
              <Link2 size={32} />
            </div>
            <h3 className="text-[var(--orbit-text)] font-semibold text-lg">Nenhum portal encontrado</h3>
            <p className="text-[var(--orbit-text-muted)] text-sm mt-1">{searchTerm ? `Nenhum lead correspondente a "${searchTerm}"` : 'Crie sua primeira curadoria no painel ao lado.'}</p>
          </div>
        ) : capsules
            .filter(cap => !searchTerm || cap.leads?.name?.toLowerCase().includes(searchTerm.toLowerCase()))
            .map(cap => {
          const totalInteractions = (cap.stats?.views || 0) + (cap.stats?.likes || 0) * 2 + (cap.stats?.visits || 0) * 5;
          const heatLevel = totalInteractions > 20 ? 'high' : totalInteractions > 5 ? 'medium' : 'low';
          
          if (viewMode === 'list') {
            return (
              <motion.div 
                key={cap.id} 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="group relative"
              >
                <div className="p-4 bg-[var(--orbit-bg-secondary)]/50 backdrop-blur-md rounded-2xl border border-[var(--orbit-line)] hover:border-[var(--orbit-glow)]/30 transition-all flex items-center justify-between gap-6">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="relative shrink-0">
                      <div className="w-10 h-10 rounded-xl bg-[var(--orbit-bg)] border border-[var(--orbit-line)] flex items-center justify-center text-sm font-display font-bold text-[var(--orbit-text)]">
                        {cap.leads?.name ? cap.leads.name[0] : 'L'}
                      </div>
                      <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[var(--orbit-bg)] ${
                        heatLevel === 'high' ? 'bg-rose-500' : heatLevel === 'medium' ? 'bg-orange-500' : 'bg-[var(--orbit-glow)]'
                      }`} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-display font-bold text-sm text-[var(--orbit-text)] truncate group-hover:text-[var(--orbit-glow)] transition-colors">
                        {cap.leads?.name || 'Lead s/ nome'}
                      </h4>
                      <p className="text-[9px] font-mono text-[var(--orbit-text-muted)] uppercase tracking-wider">
                        #{cap.slug.slice(0, 4)} • {new Date(cap.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-8 shrink-0">
                    {[
                      { label: 'Views', value: cap.stats?.views || 0, icon: Eye, color: 'text-[var(--orbit-text-muted)]' },
                      { label: 'Likes', value: cap.stats?.likes || 0, icon: Heart, color: 'text-rose-500' },
                      { label: 'Visitas', value: cap.stats?.visits || 0, icon: Calendar, color: 'text-emerald-500' },
                      { label: 'Imóveis', value: cap.itemsCount || 0, icon: Building2, color: 'text-[var(--orbit-glow)]' },
                    ].map((stat, i) => (
                      <div key={i} className="flex flex-col items-center min-w-[40px]">
                        <span className="text-[9px] font-mono uppercase tracking-tighter text-[var(--orbit-text-muted)] mb-0.5">{stat.label}</span>
                        <div className="flex items-center gap-1.5">
                          <stat.icon size={10} className={stat.color} />
                          <span className="text-sm font-display font-bold text-[var(--orbit-text)]">{stat.value}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setManagingLeadId(cap.lead_id)}
                      className="h-9 px-4 bg-[var(--orbit-glow)]/10 hover:bg-[var(--orbit-glow)] text-[var(--orbit-glow)] hover:text-[var(--orbit-bg)] font-mono text-[9px] uppercase tracking-wider font-bold rounded-xl transition-all"
                    >
                      Control
                    </Button>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleCopyLink(cap.slug)}
                        className="w-9 h-9 flex items-center justify-center rounded-xl bg-[var(--orbit-bg)] border border-[var(--orbit-line)] text-[var(--orbit-text-muted)] hover:text-[var(--orbit-glow)] transition-all"
                      >
                        <Link2 size={14} />
                      </button>
                      <button
                        onClick={() => handleDeleteSpace(cap.id)}
                        className="w-9 h-9 flex items-center justify-center rounded-xl bg-rose-500/5 border border-rose-500/10 text-rose-500/40 hover:text-rose-500 transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )
          }

          return (

            <motion.div 
              key={cap.id} 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="group relative"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-[var(--orbit-glow)]/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-3xl -z-10" />
              
              <div className="p-6 bg-[var(--orbit-bg-secondary)]/50 backdrop-blur-md rounded-3xl border border-[var(--orbit-line)] hover:border-[var(--orbit-glow)]/30 transition-all shadow-sm hover:shadow-[0_20px_40px_rgba(0,0,0,0.1)] overflow-hidden">
                {/* Visual Heat Indicator Background */}
                <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl ${
                  heatLevel === 'high' ? 'from-rose-500/10' : heatLevel === 'medium' ? 'from-orange-500/10' : 'from-[var(--orbit-glow)]/10'
                } blur-3xl -z-10`} />

                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className="w-14 h-14 rounded-2xl bg-[var(--orbit-bg)] border border-[var(--orbit-line)] flex items-center justify-center text-xl font-display font-bold text-[var(--orbit-text)] shadow-inner">
                        {cap.leads?.name ? cap.leads.name[0] : 'L'}
                      </div>
                      <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-[var(--orbit-bg)] ${
                        heatLevel === 'high' ? 'bg-rose-500' : heatLevel === 'medium' ? 'bg-orange-500' : 'bg-[var(--orbit-glow)]'
                      }`} />
                    </div>
                    <div>
                      <h4 className="font-display font-bold text-lg text-[var(--orbit-text)] tracking-tight group-hover:text-[var(--orbit-glow)] transition-colors">
                        {cap.leads?.name || 'Lead s/ nome'}
                      </h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-mono text-[var(--orbit-text-muted)] uppercase tracking-wider">
                          Selection Unit #{cap.slug.slice(0, 4)}
                        </span>
                        <div className="w-1 h-1 rounded-full bg-[var(--orbit-line)]" />
                        <span className="text-[10px] text-[var(--orbit-text-muted)] font-sans">
                          {new Date(cap.created_at).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end">
                    <div className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded-full border uppercase tracking-widest ${
                      heatLevel === 'high' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' : 
                      heatLevel === 'medium' ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' : 
                      'bg-[var(--orbit-glow)]/10 text-[var(--orbit-glow)] border-[var(--orbit-glow)]/20'
                    }`}>
                      {heatLevel === 'high' ? 'Muito Quente' : heatLevel === 'medium' ? 'Interessado' : 'Frio / Início'}
                    </div>
                  </div>
                </div>

                {/* Local Metrics Grid */}
                <div className="grid grid-cols-4 gap-4 mb-8">
                  {[
                    { label: 'Views', value: cap.stats?.views || 0, icon: Eye, color: '[var(--orbit-text-muted)]' },
                    { label: 'Likes', value: cap.stats?.likes || 0, icon: Heart, color: 'rose-500' },
                    { label: 'Visitas', value: cap.stats?.visits || 0, icon: Calendar, color: 'emerald-500' },
                    { label: 'Imóveis', value: cap.itemsCount || 0, icon: Building2, color: '[var(--orbit-glow)]' },
                  ].map((stat, i) => (
                    <div key={i} className="p-3 bg-[var(--orbit-bg)]/40 rounded-2xl border border-[var(--orbit-line)] group-hover:border-[var(--orbit-glow)]/10 transition-colors">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <stat.icon size={11} className={`text-${stat.color}`} />
                        <span className="text-[9px] font-mono uppercase tracking-tight text-[var(--orbit-text-muted)]">{stat.label}</span>
                      </div>
                      <span className="text-lg font-display font-bold text-[var(--orbit-text)]">{stat.value}</span>
                    </div>
                  ))}
                </div>

                {/* Actions Center */}
                <div className="flex items-center gap-2 pt-6 border-t border-[var(--orbit-line)]">
                   <Button
                    variant="ghost"
                    onClick={() => setManagingLeadId(cap.lead_id)}
                    className="flex-1 h-12 bg-[var(--orbit-glow)] hover:bg-[var(--orbit-glow)]/90 text-[var(--orbit-bg)] gap-3 font-mono text-[10px] uppercase tracking-[0.2em] font-bold rounded-2xl shadow-[0_4px_15px_rgba(46,197,255,0.15)] group-hover:scale-[1.02] transition-all"
                  >
                    <Settings size={14} />
                    Orbit Control
                  </Button>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleCopyLink(cap.slug)}
                      className="w-12 h-12 flex items-center justify-center rounded-2xl bg-[var(--orbit-bg)] border border-[var(--orbit-line)] text-[var(--orbit-text-muted)] hover:text-[var(--orbit-glow)] hover:border-[var(--orbit-glow)]/40 transition-all hover:bg-[var(--orbit-glow)]/5"
                      title="Copiar Link"
                    >
                      <Link2 size={18} />
                    </button>
                    <button
                      onClick={() => handleDeleteSpace(cap.id)}
                      className="w-12 h-12 flex items-center justify-center rounded-2xl bg-rose-500/5 border border-rose-500/10 text-rose-500/40 hover:text-rose-500 hover:border-rose-500/30 transition-all hover:bg-rose-500/10"
                      title="Excluir Portal"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )
        })}
        </div>
      </div>
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
