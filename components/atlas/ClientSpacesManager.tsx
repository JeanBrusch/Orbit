"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Settings, MessageSquare, 
  Video, Check, Loader2, X,
  Copy, ExternalLink, Trash2, Building2, Pencil, ChevronLeft,
  TrendingUp, Eye, Heart, Calendar, Clock, MousePointer2, Sparkles,
  ChevronRight, Link2
} from "lucide-react"
import { getSupabase } from "@/lib/supabase"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"

// ── Theme tokens are handled via CSS variables

interface ClientSpace {
  id: string;
  lead_id: string;
  slug: string;
  theme: string;
  leads?: { name: string };
}

interface PropertyWithContext {
  property_id: string;
  interaction_type?: string;
  title: string;
  internal_name?: string;
  cover_image: string;
  value: number;
  location_text: string;
  context: {
    note: string;
    video_url: string;
  };
}

interface ClientSpacesManagerProps {
  leadId?: string;
  onClose?: () => void;
}

export default function ClientSpacesManager({ leadId, onClose }: ClientSpacesManagerProps) {
  const [space, setSpace] = useState<ClientSpace | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [slug, setSlug] = useState("")
  const [theme, setTheme] = useState("paper")

  const supabase = getSupabase()

  const [activeTab, setActiveTab] = useState<"metrics" | "slug" | "properties">("metrics")
  const [sentProperties, setSentProperties] = useState<PropertyWithContext[]>([])
  const [editingContext, setEditingContext] = useState<PropertyWithContext | null>(null)
  const [metrics, setMetrics] = useState<any>(null)
  const [loadingMetrics, setLoadingMetrics] = useState(false)

  const fetchSpace = async () => {
    if (!leadId) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('client_spaces')
        .select('*, leads(name)')
        .eq('lead_id', leadId)
        .maybeSingle()

      if (data) {
        setSpace(data as any)
        setSlug((data as any).slug)
        setTheme((data as any).theme || 'paper')
        fetchSentProperties((data as any).id)
        fetchMetrics()
      } else {
        const { data: lead } = await supabase.from('leads').select('name').eq('id', leadId).single()
        if (lead) {
          const defaultSlug = (lead as any).name.toLowerCase().replace(/\s+/g, '-')
          setSlug(defaultSlug)
        }
        // Even if no space exists, we can still show properties sent to this leadId
        fetchSentProperties("") 
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const fetchMetrics = async () => {
    if (!leadId) return
    setLoadingMetrics(true)
    try {
      const res = await fetch(`/api/selection-dashboard?leadId=${leadId}&t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json()
        setMetrics(data)
      }
    } catch (err) {
      console.error("[MANAGER] Metrics error:", err)
    } finally {
      setLoadingMetrics(false)
    }
  }

  const fetchSentProperties = async (spaceId: string) => {
    // 1. Fetch properties directly linked to lead_id OR linked via capsules
    // For maximum reliability, we fetch all active capsule_items for this lead
    const { data: capsuleItems, error: itemsError } = await supabase
      .from('property_interactions')
      .select('property_id, interaction_type, properties(title, internal_name, internal_code, cover_image, value, location_text)')
      .eq('lead_id', leadId as string)
      .in('interaction_type', ['sent', 'favorited'])

    if (itemsError) {
      console.error("[MANAGER] Error fetching items:", itemsError)
      return
    }

    // 2. Fetch contexts for this specific space
    const { data: contexts } = await (supabase
      .from('client_property_context') as any)
      .select('*')
      .eq('client_space_id', spaceId)

    const contextMap = new Map((contexts || []).map((c: any) => [c.property_id, c]))
    
    // 3. Merge and normalize
    const merged = (capsuleItems as any[])
      .filter(item => item.property_id) // Only show items that are actually properties
      .map(item => {
        // Supabase join properties(*) can return an object OR an array of one object
        const rawProps = item.properties
        const p = Array.isArray(rawProps) ? rawProps[0] : rawProps
        const props = p || {}
        
        return {
          ...props,
          property_id: item.property_id,
          interaction_type: item.interaction_type,
          title: props.title || props.internal_name || 'Imóvel sem título',
          context: contextMap.get(item.property_id) || { note: '', video_url: '' }
        };
      });

    setSentProperties(merged);
  }

  const handleRemoveProperty = async (propertyId: string) => {
    if (!confirm("Remover este imóvel da seleção do cliente?")) return
    
    try {
      const res = await fetch(`/api/property-interactions?leadId=${leadId}&propertyId=${propertyId}&t=${Date.now()}`, {
        method: 'DELETE'
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Falha na exclusão")
      }

      toast.success("Imóvel removido com sucesso")
      if (space) fetchSentProperties(space.id)
    } catch (err: any) {
      toast.error("Erro ao remover: " + err.message)
    }
  }

  const saveContext = async (propertyId: string, contextData: any) => {
    if (!space) return
    try {
      const res = await fetch(`/api/client-space/${space.id}/context`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          property_id: propertyId,
          note: contextData.note,
          video_url: contextData.video_url,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error("Erro ao salvar nota: " + (err.error || res.statusText))
        return
      }

      fetchSentProperties(space.id)
      setEditingContext(null)
      toast.success("Insight salvo com sucesso!")
    } catch (err: any) {
      toast.error("Erro ao salvar: " + err.message)
    }
  }


  useEffect(() => {
    fetchSpace()
  }, [leadId])

  const handleSave = async () => {
    if (!leadId || !slug) return
    setSaving(true)
    setError(null)
    try {
      if (space) {
        const { error } = await (supabase
          .from('client_spaces') as any)
          .update({ slug, theme, updated_at: new Date().toISOString() })
          .eq('id', space.id)
        if (error) throw error
      } else {
        const { data, error } = await (supabase
          .from('client_spaces') as any)
          .insert({ lead_id: leadId, slug, theme })
          .select()
          .single()
        if (error) throw error
        setSpace(data as any)
      }
      toast.success("Espaço do cliente salvo!")
    } catch (err: any) {
      setError(err.message || "Erro ao salvar espaço")
      toast.error(err.message || "Erro ao salvar espaço")
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div className="p-20 flex flex-col items-center justify-center gap-4 bg-[var(--orbit-bg)] min-h-full">
      <Loader2 className="animate-spin text-[var(--orbit-glow)] w-6 h-6" />
      <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--orbit-text-muted)]">Sincronizando portal...</p>
    </div>
  )

  const publicUrl = `${window.location.origin}/selection/${slug}`

  return (
    <div className="flex flex-col h-full bg-[var(--orbit-bg)] text-[var(--orbit-text)] overflow-hidden">
      {/* Premium Integrated Header */}
      <div className="px-6 py-6 md:px-8 md:py-8 border-b border-[var(--orbit-line)] bg-[var(--orbit-bg-secondary)]/40 backdrop-blur-2xl shrink-0 relative overflow-hidden">
        {/* Abstract Background Glow */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-[var(--orbit-glow)]/5 rounded-full blur-[100px] pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 relative z-10">
          <div className="flex items-start gap-6">
            <button 
              onClick={onClose}
              className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-2xl bg-[var(--orbit-glow)]/5 border border-[var(--orbit-glow)]/10 text-[var(--orbit-text-muted)] hover:text-[var(--orbit-glow)] hover:border-[var(--orbit-glow)]/30 transition-all group shrink-0"
              title="Voltar ao Atlas"
            >
              <ChevronLeft size={24} className="group-hover:-translate-x-0.5 transition-transform" />
            </button>
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <div className="px-2 py-0.5 rounded bg-[var(--orbit-glow)] text-[var(--orbit-bg)] text-[9px] font-bold uppercase tracking-[0.2em]">Hub</div>
                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--orbit-text-muted)] font-medium">/{space?.slug || 'configurando'}</span>
              </div>
              <h3 className="font-display font-bold text-4xl text-[var(--orbit-text)] tracking-tight">
                {space?.leads?.name || 'Gestão de Lead'}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="px-4 py-2 bg-[var(--orbit-bg)]/50 backdrop-blur-md rounded-2xl border border-[var(--orbit-line)] flex items-center gap-3 shadow-sm">
              <div className="relative">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <div className="absolute inset-0 w-2 h-2 rounded-full bg-emerald-500 animate-ping opacity-75" />
              </div>
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--orbit-text-muted)] font-bold">Portal Live</span>
            </div>
            {onClose && (
              <Button 
                variant="ghost"
                onClick={onClose} 
                className="h-12 px-6 rounded-2xl text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--orbit-text-muted)] hover:bg-[var(--orbit-line)]/50 hover:text-[var(--orbit-text)] border border-transparent hover:border-[var(--orbit-line)] transition-all"
              >
                Encerrar Gestão
              </Button>
            )}
          </div>
        </div>

        {/* Minimalist Navigation Tabs */}
        <div className="mt-10 flex gap-1 p-1 bg-[var(--orbit-bg)]/40 border border-[var(--orbit-line)] rounded-[1.25rem] w-fit">
          {[
            { id: 'metrics', label: 'Inteligência', icon: TrendingUp },
            { id: 'properties', label: 'Curadoria', icon: Building2 },
            { id: 'slug', label: 'Setup Portal', icon: ExternalLink }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-8 h-12 text-[10px] font-mono uppercase tracking-[0.2em] rounded-xl transition-all flex items-center gap-3 relative overlow-hidden ${
                activeTab === tab.id 
                  ? 'bg-[var(--orbit-glow)] text-[var(--orbit-bg)] font-bold shadow-lg' 
                  : 'text-[var(--orbit-text-muted)] hover:text-[var(--orbit-text)] hover:bg-[var(--orbit-line)]/50'
              }`}
            >
              <tab.icon size={14} strokeWidth={2.5} />
              <span className="hidden md:inline">{tab.label}</span>
              {tab.id === 'properties' && (
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${activeTab === tab.id ? 'bg-white/20' : 'bg-[var(--orbit-line)]/50'}`}>
                  {sentProperties.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6" style={{ scrollbarWidth: "thin", scrollbarColor: "var(--orbit-line) transparent" }}>
        <AnimatePresence mode="wait">
          {activeTab === 'metrics' ? (
            <motion.div 
              key="metrics"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-12 max-w-7xl mx-auto"
            >
              {loadingMetrics ? (
                <div className="flex flex-col items-center justify-center py-32 gap-6">
                  <div className="relative">
                    <Loader2 className="animate-spin text-[var(--orbit-glow)] w-10 h-10" />
                    <div className="absolute inset-0 blur-xl bg-[var(--orbit-glow)]/20 animate-pulse" />
                  </div>
                  <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-[var(--orbit-text-muted)]">Processando Inteligência de Engajamento...</p>
                </div>
            ) : metrics ? (
                <div className="space-y-16 pb-20">
                  {/* High Fidelity KPIs */}
                  <div className="relative">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      {[
                        { label: 'Tempo de Foco', val: metrics.tracking ? `${Math.floor((metrics.tracking.session_time || 0) / 60)} min` : '0 min', icon: Clock, color: 'text-[var(--orbit-glow)]', bg: 'bg-[var(--orbit-glow)]/5' },
                        { label: 'Score de Calor', val: `${metrics.intensity || 0}%`, icon: Sparkles, color: 'text-emerald-400', bg: 'bg-emerald-500/5' },
                        { label: 'Clicks Ativos', val: metrics.stats?.views || 0, icon: MousePointer2, color: 'text-purple-400', bg: 'bg-purple-500/5' },
                        { label: 'Interesse Real', val: metrics.stats?.likes || 0, icon: Heart, color: 'text-rose-400', bg: 'bg-rose-500/5' },
                      ].map((kpi, i) => (
                        <div key={i} className={`p-8 rounded-[2.5rem] border border-[var(--orbit-line)] ${kpi.bg} backdrop-blur-sm relative overflow-hidden group hover:scale-[1.02] transition-all duration-500`}>
                          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <kpi.icon size={48} />
                          </div>
                          <div className="space-y-4 relative z-10">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-xl ${kpi.bg} border border-[var(--orbit-line)] ${kpi.color}`}>
                                <kpi.icon size={16} />
                              </div>
                              <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--orbit-text-muted)] font-bold">{kpi.label}</span>
                            </div>
                            <div className="text-4xl font-display font-bold text-[var(--orbit-text)] tracking-tight">
                              {kpi.val}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Enhanced Detailed Stats */}
                  <div className="space-y-8">
                    <div className="flex items-center gap-4">
                      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[var(--orbit-line)] to-transparent" />
                      <h5 className="text-[11px] font-mono uppercase tracking-[0.4em] text-[var(--orbit-text-muted)] font-bold">Trace de Atividade</h5>
                      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[var(--orbit-line)] to-transparent" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                       {[
                        { label: 'Visitas Solicitadas', val: metrics.stats?.visits, icon: MessageSquare, color: 'text-emerald-400' },
                        { label: 'Imóveis Rejeitados', val: metrics.stats?.discards, icon: X, color: 'text-amber-400' },
                        { label: 'Visualizações Totais', val: metrics.stats?.views, icon: Eye, color: 'text-sky-400' },
                      ].map((item, i) => (
                        <div key={i} className="flex flex-col p-6 bg-[var(--orbit-bg-secondary)]/50 backdrop-blur-md border border-[var(--orbit-line)] rounded-3xl hover:bg-[var(--orbit-glow)]/5 transition-all group">
                          <div className="flex items-center justify-between mb-4">
                             <item.icon size={20} className={item.color} />
                             <span className="font-display font-bold text-3xl">{item.val || 0}</span>
                          </div>
                          <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--orbit-text-muted)]">{item.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Premium Interest Thermometer */}
                  <div className="space-y-10">
                    <div className="flex items-center justify-between">
                       <h5 className="text-[11px] font-mono uppercase tracking-[0.4em] text-[var(--orbit-text-muted)] font-bold">Resonância por Unidade</h5>
                       <div className="flex items-center gap-2 text-[10px] font-mono text-emerald-400 font-bold uppercase tracking-widest">
                         <Sparkles size={12} /> Live Tracking
                       </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {Array.isArray(sentProperties) && sentProperties.map((prop) => {
                        const interactions = Array.isArray(metrics.interactions) ? metrics.interactions : [];
                        const propInt = interactions.filter((i: any) => i.property_id === prop.property_id).length || 0;
                        const score = Math.min((propInt / 10) * 100, 100);
                        const isHot = score > 60;
                        return (
                          <div key={prop.property_id} className="group p-6 bg-[var(--orbit-bg-secondary)]/30 backdrop-blur-md rounded-[2.5rem] border border-[var(--orbit-line)] flex items-center gap-6 hover:border-[var(--orbit-glow)]/30 transition-all duration-500">
                             <div className="w-20 h-20 rounded-2xl overflow-hidden shrink-0 border border-[var(--orbit-line)] relative group-hover:scale-105 transition-transform duration-500">
                              {prop.cover_image && <img src={prop.cover_image} className="w-full h-full object-cover" alt="" />}
                              {isHot && (
                                <div className="absolute inset-0 bg-orange-500/20 mix-blend-overlay" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0 space-y-3">
                               <div className="flex justify-between items-start">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-display font-bold truncate text-[var(--orbit-text)] tracking-tight">{prop.title}</p>
                                    <p className="text-[10px] font-mono text-[var(--orbit-text-muted)] mt-0.5">{prop.location_text}</p>
                                  </div>
                                  <div className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${isHot ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20 animate-pulse' : 'bg-[var(--orbit-line)]/50 text-[var(--orbit-text-muted)]'}`}>
                                    {Math.round(score)}%
                                  </div>
                               </div>
                               <div className="space-y-1.5">
                                 <div className="h-2 bg-[var(--orbit-bg)] rounded-full overflow-hidden border border-[var(--orbit-line)] p-[1px]">
                                    <motion.div 
                                      initial={{ width: 0 }}
                                      animate={{ width: `${score}%` }}
                                      transition={{ duration: 1.5, ease: "easeOut" }}
                                      className={`h-full rounded-full bg-gradient-to-r ${score > 70 ? 'from-orange-500 to-rose-500 shadow-[0_0_10px_rgba(249,115,22,0.4)]' : 'from-[var(--orbit-glow)]/40 to-[var(--orbit-glow)] shadow-[0_0_10px_rgba(46,197,255,0.4)]'}`}
                                    />
                                 </div>
                                 <div className="flex justify-between text-[9px] font-mono uppercase tracking-widest text-[var(--orbit-text-muted)]/50">
                                   <span>Indiferente</span>
                                   <span>Alta Persistência</span>
                                 </div>
                               </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-32 px-6">
                  <Sparkles size={32} className="mx-auto mb-6 text-[var(--orbit-line)]/40" />
                  <p className="text-lg font-display font-bold text-[var(--orbit-text)]">Aguardando Engajamento</p>
                  <p className="text-sm text-[var(--orbit-text-muted)] mt-2 italic max-w-sm mx-auto">As métricas aparecerão aqui assim que o lead começar a navegar e interagir com o portal de seleção.</p>
                </div>
              )}
            </motion.div>
          ) : activeTab === 'slug' ? (
            <motion.div 
              key="slug"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-8 max-w-2xl"
            >
              <div className="p-8 bg-[var(--orbit-bg-secondary)]/50 border border-[var(--orbit-line)] rounded-3xl space-y-8">
                 <div className="space-y-4">
                  <label className="text-[10px] font-mono uppercase tracking-[0.3em] text-[var(--orbit-text-muted)] block">URL Personalizada de Acesso</label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-mono text-[var(--orbit-text-muted)]/50">/selection/</div>
                    <input 
                      type="text" 
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
                      className="w-full pl-28 pr-4 h-14 bg-[var(--orbit-bg)] border border-[var(--orbit-line)] rounded-2xl text-base text-[var(--orbit-text)] placeholder:text-[var(--orbit-text-muted)]/40 focus:border-[var(--orbit-glow)]/40 focus:outline-none transition-all shadow-inner"
                      placeholder="nome-do-cliente"
                    />
                  </div>
                  {space && (
                    <div className="flex items-center gap-3 pt-2">
                      <button 
                        onClick={() => { navigator.clipboard.writeText(publicUrl); toast.success("Link copiado!"); }} 
                        className="flex-1 h-12 bg-[var(--orbit-glow)]/5 border border-[var(--orbit-line)] rounded-xl text-[10px] font-mono uppercase tracking-widest text-[var(--orbit-text-muted)] hover:text-[var(--orbit-glow)] hover:border-[var(--orbit-glow)]/30 transition-all flex items-center justify-center gap-3"
                      >
                        <Copy size={14} /> Copiar Link
                      </button>
                      <a 
                        href={publicUrl} 
                        target="_blank" 
                        rel="noreferrer"
                        className="flex-1 h-12 bg-[var(--orbit-glow)]/5 border border-[var(--orbit-line)] rounded-xl text-[10px] font-mono uppercase tracking-widest text-[var(--orbit-text-muted)] hover:text-[var(--orbit-glow)] hover:border-[var(--orbit-glow)]/30 transition-all flex items-center justify-center gap-3"
                      >
                        <ExternalLink size={14} /> Abrir Portal
                      </a>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-mono uppercase tracking-[0.3em] text-[var(--orbit-text-muted)] block">Estética e Identidade Visual</label>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { id: 'paper', label: 'Paper Sepia', preview: '#f5f1eb' },
                      { id: 'light', label: 'Cloud White', preview: '#ffffff' }
                    ].map((item) => (
                      <button 
                        key={item.id}
                        onClick={() => setTheme(item.id)}
                        className={`p-4 rounded-3xl border-2 transition-all flex flex-col items-center gap-3 ${theme === item.id ? 'border-[var(--orbit-glow)] bg-[var(--orbit-glow)]/5' : 'border-[var(--orbit-line)] hover:border-[var(--orbit-glow)]/20 bg-[var(--orbit-bg)]/40'}`}
                      >
                        <div className="w-full h-16 rounded-2xl shadow-inner border border-black/5" style={{ backgroundColor: item.preview }} />
                        <span className={`text-[10px] font-mono uppercase tracking-widest ${theme === item.id ? 'text-[var(--orbit-glow)] font-bold' : 'text-[var(--orbit-text-muted)]'}`}>{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <button 
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full h-16 rounded-3xl bg-[var(--orbit-glow)] hover:brightness-110 text-[var(--orbit-bg)] text-xs font-bold uppercase tracking-[0.3em] shadow-[0_8px_25px_rgba(46,197,255,0.3)] transition-all flex items-center justify-center gap-4 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="animate-spin w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
                  Confirmar e Salvar Configurações
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="properties"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-10 pb-32"
            >
              <>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-2">
                  <div>
                    <h5 className="text-[12px] font-mono uppercase tracking-[0.4em] text-[var(--orbit-text-muted)] font-bold mb-1">Unidades Selecionadas</h5>
                    <p className="text-[10px] text-[var(--orbit-text-muted)]/60 font-mono tracking-widest">{sentProperties.length} imóveis ativos nesta curadoria</p>
                  </div>
                  <button className="h-10 px-6 bg-[var(--orbit-glow)]/5 border border-[var(--orbit-line)] rounded-xl text-[10px] font-bold text-[var(--orbit-glow)] hover:bg-[var(--orbit-glow)]/10 uppercase tracking-[0.2em] transition-all">
                    Expandir Seleção
                  </button>
                </div>
                
                {sentProperties.length === 0 ? (
                  <div className="text-center py-40 border-2 border-dashed border-[var(--orbit-line)] rounded-[3rem] bg-[var(--orbit-bg-secondary)]/30 backdrop-blur-sm">
                    <div className="w-20 h-20 bg-[var(--orbit-line)]/20 rounded-full flex items-center justify-center mx-auto mb-8 border border-[var(--orbit-line)]">
                      <Building2 className="h-8 w-8 text-[var(--orbit-text-muted)]/40" />
                    </div>
                    <p className="text-xl font-display font-bold text-[var(--orbit-text)] mb-2">Curadoria Vazia</p>
                    <p className="text-xs text-[var(--orbit-text-muted)] font-mono tracking-widest uppercase">Comece a adicionar imóveis do Atlas para o lead.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-7xl mx-auto">
                    {sentProperties.map((prop) => (
                      <div key={prop.property_id} className="group flex flex-col bg-[var(--orbit-bg-secondary)]/30 backdrop-blur-md rounded-[3rem] border border-[var(--orbit-line)] hover:border-[var(--orbit-glow)]/30 transition-all duration-700 shadow-sm hover:shadow-2xl hover:-translate-y-1 relative overflow-hidden">
                        {/* Gradient Refraction Effect */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--orbit-glow)]/5 rounded-full blur-[60px] pointer-events-none group-hover:bg-[var(--orbit-glow)]/10 transition-colors" />
                        
                        <div className="p-4 flex flex-col gap-6">
                          <div className="w-full aspect-[16/9] rounded-[2.5rem] overflow-hidden shrink-0 bg-[var(--orbit-bg)] border border-[var(--orbit-line)] relative group-hover:border-[var(--orbit-glow)]/20 transition-colors">
                            {prop.cover_image ? (
                              <img src={prop.cover_image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-[1.5s] ease-out" alt="" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[var(--orbit-text-muted)]/20"><Building2 size={48} /></div>
                            )}
                            
                            {/* Floating Overlay Controls */}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-500" />
                            <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-all duration-500 translate-y-2 group-hover:translate-y-0">
                               <button 
                                  onClick={() => setEditingContext(prop)}
                                  className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white/95 text-black hover:bg-[var(--orbit-glow)] hover:text-white transition-all shadow-2xl"
                                  title="Editar Insight"
                                >
                                  <Pencil size={18} />
                                </button>
                                <button 
                                  onClick={() => handleRemoveProperty(prop.property_id)}
                                  className="w-12 h-12 flex items-center justify-center rounded-2xl bg-rose-500 text-white hover:bg-rose-600 transition-all shadow-2xl"
                                  title="Remover da Seleção"
                                >
                                  <Trash2 size={18} />
                                </button>
                            </div>
                          </div>

                          <div className="px-4 pb-4 space-y-4">
                            <div className="flex justify-between items-start gap-4">
                              <div className="flex-1 min-w-0">
                                 <h4 className="text-2xl font-display font-bold text-[var(--orbit-text)] tracking-tight leading-tight group-hover:text-[var(--orbit-glow)] transition-colors">{prop.title}</h4>
                                 <p className="text-[11px] font-mono text-[var(--orbit-text-muted)] uppercase tracking-[0.2em] mt-1">{prop.location_text}</p>
                              </div>
                              <div className="text-right">
                                 <p className="text-2xl font-display font-bold text-[var(--orbit-text)] tracking-tight">
                                   {prop.value ? `R$ ${(prop.value / 1000).toLocaleString()}k` : 'Sob consulta'}
                                 </p>
                                   <div className={`flex items-center gap-1.5 justify-end mt-1`}>
                                     <div className={`w-1.5 h-1.5 rounded-full ${prop.interaction_type === 'sent' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]'}`} />
                                     <span className={`text-[9px] font-mono font-bold uppercase tracking-widest ${prop.interaction_type === 'sent' ? 'text-emerald-500' : 'text-blue-500'}`}>
                                       {prop.interaction_type === 'sent' ? 'PROPOSTO' : 'NO ACERVO'}
                                     </span>
                                   </div>
                              </div>
                            </div>

                            {/* Insight Display */}
                            {(prop.context.note || prop.context.video_url) ? (
                              <div className="p-6 rounded-[2rem] bg-[var(--orbit-bg)]/60 backdrop-blur-md border border-[var(--orbit-line)] relative overflow-hidden group-hover:border-[var(--orbit-glow)]/20 transition-all">
                                 <div className="absolute top-0 left-0 w-1.5 h-full bg-[var(--orbit-glow)]" />
                                 <div className="space-y-4">
                                   <div className="flex items-center gap-2">
                                     <MessageSquare size={12} className="text-[var(--orbit-glow)]" />
                                     <span className="text-[9px] font-mono uppercase tracking-[0.3em] font-bold text-[var(--orbit-text-muted)]">Insights do Orbit</span>
                                   </div>
                                   <p className="text-sm text-[var(--orbit-text)] font-sans italic leading-relaxed">"{prop.context.note || 'Imóvel selecionado criteriosamente para o perfil deste lead.'}"</p>
                                   {prop.context.video_url && (
                                     <div className="pt-2 flex items-center gap-2">
                                        <div className="px-3 py-1.5 rounded-xl bg-[var(--orbit-glow)]/10 text-[var(--orbit-glow)] text-[9px] font-mono font-bold flex items-center gap-2 ring-1 ring-[var(--orbit-glow)]/30 group-hover:bg-[var(--orbit-glow)] group-hover:text-white transition-all cursor-pointer">
                                           <Video size={10} strokeWidth={3} /> REPRODUZIR LOOM
                                        </div>
                                     </div>
                                   )}
                                 </div>
                              </div>
                            ) : (
                              <button 
                                onClick={() => setEditingContext(prop)}
                                className="w-full py-4 border border-dashed border-[var(--orbit-line)] rounded-[1.5rem] text-[10px] font-mono uppercase tracking-widest text-[var(--orbit-text-muted)] hover:border-[var(--orbit-glow)] hover:text-[var(--orbit-glow)] transition-all bg-[var(--orbit-bg)]/20"
                              >
                                + Adicionar Insight do Especialista
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Context Editor Modal */}
      <AnimatePresence>
        {editingContext && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="w-full max-w-lg bg-[var(--orbit-bg-secondary)] border border-[var(--orbit-line)] rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-10 shadow-3xl overflow-y-auto max-h-[90vh]"
            >
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 rounded-2xl bg-[var(--orbit-glow)]/10 border border-[var(--orbit-glow)]/20 flex items-center justify-center text-[var(--orbit-glow)]">
                  <MessageSquare size={20} />
                </div>
                <div>
                  <h4 className="text-xl font-display font-bold text-[var(--orbit-text)]">Insight do Especialista</h4>
                  <p className="text-[10px] font-mono text-[var(--orbit-glow)] uppercase tracking-[0.2em] mt-1">{editingContext?.title}</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-mono uppercase tracking-widest text-[var(--orbit-text-muted)] block mb-1">Nota do Especialista</label>
                  <textarea 
                    className="w-full h-40 bg-[var(--orbit-bg)] border border-[var(--orbit-line)] rounded-2xl p-5 text-sm text-[var(--orbit-text)] placeholder:text-[var(--orbit-text-muted)]/40 focus:border-[var(--orbit-glow)]/40 focus:outline-none font-sans resize-none transition-all shadow-inner"
                    placeholder="Ex: 'Escolhi este pela varanda voltada para o nascente...'"
                    defaultValue={editingContext.context.note}
                    id="ctx-note"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-mono uppercase tracking-widest text-[var(--orbit-text-muted)] block mb-1">URL do Vídeo (Loom/YouTube)</label>
                  <div className="relative">
                    <Video className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--orbit-glow)]/50" />
                    <input 
                      className="w-full h-14 pl-12 pr-4 bg-[var(--orbit-bg)] border border-[var(--orbit-line)] rounded-2xl text-sm text-[var(--orbit-text)] placeholder:text-[var(--orbit-text-muted)]/40 focus:border-[var(--orbit-glow)]/40 focus:outline-none transition-all shadow-inner"
                      placeholder="https://www.loom.com/share/..."
                      defaultValue={editingContext.context.video_url}
                      id="ctx-video"
                    />
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    onClick={() => setEditingContext(null)} 
                    className="flex-1 h-14 rounded-2xl border border-[var(--orbit-line)] text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--orbit-text-muted)] hover:bg-[var(--orbit-line)] hover:text-[var(--orbit-text)] transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={() => {
                      const note = (document.getElementById('ctx-note') as HTMLTextAreaElement).value
                      const video_url = (document.getElementById('ctx-video') as HTMLInputElement).value
                      if (editingContext) {
                        saveContext(editingContext.property_id, { note, video_url })
                      }
                    }}
                    className="flex-1 h-14 bg-[var(--orbit-glow)] text-[var(--orbit-bg)] text-[10px] font-bold uppercase tracking-[0.2em] rounded-2xl shadow-lg transition-all hover:brightness-110 active:scale-[0.98]"
                  >
                    Salvar Insight
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
