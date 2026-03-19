"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Settings, MessageSquare, 
  Video, Check, Loader2, X,
  Copy, ExternalLink, Trash2, Building2, Pencil, ChevronLeft
} from "lucide-react"
import { getSupabase } from "@/lib/supabase"
import { toast } from "sonner"

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

  const [activeTab, setActiveTab] = useState<"slug" | "properties">("slug")
  const [sentProperties, setSentProperties] = useState<PropertyWithContext[]>([])
  const [editingContext, setEditingContext] = useState<PropertyWithContext | null>(null)

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
      } else {
        const { data: lead } = await supabase.from('leads').select('name').eq('id', leadId).single()
        if (lead) {
          const defaultSlug = (lead as any).name.toLowerCase().replace(/\s+/g, '-')
          setSlug(defaultSlug)
        }
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const fetchSentProperties = async (spaceId: string) => {
    const { data: capsuleItems } = await (supabase
      .from('capsule_items') as any)
      .select('property_id, properties(title, internal_name, cover_image, value, location_text)')
      .eq('lead_id', leadId)
      .neq('state', 'discarded')

    if (!capsuleItems) return

    const { data: contexts } = await (supabase
      .from('client_property_context') as any)
      .select('*')
      .eq('client_space_id', spaceId)

    const contextMap = new Map((contexts || []).map((c: any) => [c.property_id, c]))

    const merged = (capsuleItems as any[]).map(item => ({
      ...item.properties,
      title: item.properties?.title || item.properties?.internal_name || 'Sem título',
      property_id: item.property_id,
      context: contextMap.get(item.property_id) || { note: '', video_url: '' }
    }))

    setSentProperties(merged)
  }

  const handleRemoveProperty = async (propertyId: string) => {
    if (!confirm("Remover este imóvel da seleção do cliente?")) return
    
    const { error } = await (supabase
      .from('capsule_items') as any)
      .delete()
      .eq('lead_id', leadId)
      .eq('property_id', propertyId)

    if (error) {
      toast.error("Erro ao remover: " + error.message)
    } else {
      toast.success("Imóvel removido com sucesso")
      if (space) fetchSentProperties(space.id)
    }
  }

  const saveContext = async (propertyId: string, contextData: any) => {
    if (!space) return
    const { error } = await (supabase
      .from('client_property_context') as any)
      .upsert({
        client_space_id: space.id,
        property_id: propertyId,
        note: contextData.note,
        video_url: contextData.video_url
      }, { onConflict: 'client_space_id,property_id' })

    if (error) {
      toast.error("Erro ao salvar nota: " + error.message)
    } else {
      fetchSentProperties(space.id)
      setEditingContext(null)
      toast.success("Nota salva com sucesso!")
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
  const inputCls = "w-full h-10 bg-[var(--orbit-bg)] border border-[var(--orbit-line)] rounded-xl px-4 text-sm text-[var(--orbit-text)] placeholder:text-[var(--orbit-text-muted)]/40 focus:border-[var(--orbit-glow)]/40 focus:outline-none transition-all"

  return (
    <div className="flex flex-col h-full bg-[var(--orbit-bg)] text-[var(--orbit-text)]">
      {/* Header */}
      <div className="px-4 pt-4 md:px-6 md:pt-5 pb-0 border-b border-[var(--orbit-line)] shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[var(--orbit-glow)]/10 border border-[var(--orbit-glow)]/15 flex items-center justify-center text-[var(--orbit-glow)]">
              <Settings size={15} />
            </div>
            <div>
              <h3 className="font-sans font-semibold text-sm text-[var(--orbit-text)] leading-none">Gestão de Seleção</h3>
              <p className="text-[9px] font-mono uppercase tracking-widest text-[var(--orbit-glow)]/70 mt-0.5">
                {space?.leads?.name || 'Lead'}
              </p>
            </div>
          </div>
          {onClose && (
            <button 
              onClick={onClose} 
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-mono uppercase tracking-widest text-[var(--orbit-text-muted)] hover:bg-[var(--orbit-line)] hover:text-[var(--orbit-text)] transition-colors"
            >
              <ChevronLeft size={13} /> Atlas
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-[var(--orbit-line)]/40 rounded-lg mb-0">
          {[
            { id: 'slug', label: 'Link & Estética' },
            { id: 'properties', label: `Curadoria (${sentProperties.length})` }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 min-h-[40px] py-2 text-[10px] font-mono uppercase tracking-wider rounded-md transition-all ${
                activeTab === tab.id 
                  ? 'bg-[var(--orbit-glow)] text-white shadow-sm border border-[var(--orbit-glow)]/20' 
                  : 'text-[var(--orbit-text-muted)] hover:text-[var(--orbit-text)] hover:bg-[var(--orbit-bg)]/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 md:p-5 space-y-4 md:space-y-5" style={{ scrollbarWidth: "thin", scrollbarColor: "var(--orbit-line) transparent" }}>
        <AnimatePresence mode="wait">
          {activeTab === 'slug' ? (
            <motion.div 
              key="slug"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="space-y-6"
            >
              <div className="space-y-2">
                <label className="text-[9px] font-mono uppercase tracking-[0.2em] text-[var(--orbit-text-muted)] block">Slug Personalizado</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-[var(--orbit-text-muted)]/50">/selection/</div>
                  <input 
                    type="text" 
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    className="w-full pl-24 pr-4 h-10 bg-[var(--orbit-bg)] border border-[var(--orbit-line)] rounded-xl text-sm text-[var(--orbit-text)] placeholder:text-[var(--orbit-text-muted)]/40 focus:border-[var(--orbit-glow)]/40 focus:outline-none transition-all"
                    placeholder="nome-do-cliente"
                  />
                </div>
                {space && (
                  <div className="flex items-center gap-2 pt-1">
                    <button 
                      onClick={() => { navigator.clipboard.writeText(publicUrl); toast.success("Link copiado!"); }} 
                      className="flex-1 h-9 bg-[var(--orbit-glow)]/5 border border-[var(--orbit-line)] rounded-lg text-[9px] font-mono uppercase tracking-widest text-[var(--orbit-text-muted)] hover:text-[var(--orbit-glow)] hover:border-[var(--orbit-glow)]/30 transition-colors flex items-center justify-center gap-2"
                    >
                      <Copy size={11} /> Copiar Link
                    </button>
                    <a 
                      href={publicUrl} 
                      target="_blank" 
                      className="flex-1 h-9 bg-[var(--orbit-glow)]/5 border border-[var(--orbit-line)] rounded-lg text-[9px] font-mono uppercase tracking-widest text-[var(--orbit-text-muted)] hover:text-[var(--orbit-glow)] hover:border-[var(--orbit-glow)]/30 transition-colors flex items-center justify-center gap-2"
                    >
                      <ExternalLink size={11} /> Abrir Portal
                    </a>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <label className="text-[9px] font-mono uppercase tracking-[0.2em] text-[var(--orbit-text-muted)] block">White-label Visual</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: 'paper', label: 'Paper Sepia', preview: '#f5f1eb' },
                    { id: 'light', label: 'Cloud White', preview: '#ffffff' }
                  ].map((item) => (
                    <button 
                      key={item.id}
                      onClick={() => setTheme(item.id)}
                      className={`p-3 rounded-xl border transition-all flex flex-col items-center gap-2 ${theme === item.id ? 'border-[var(--orbit-glow)]/40 bg-[var(--orbit-glow)]/5' : 'border-[var(--orbit-line)] hover:border-[var(--orbit-glow)]/20'}`}
                    >
                      <div className="w-full h-10 rounded-lg shadow-inner border border-black/10" style={{ backgroundColor: item.preview }} />
                      <span className={`text-[9px] font-mono uppercase tracking-widest ${theme === item.id ? 'text-[var(--orbit-glow)]' : 'text-[var(--orbit-text-muted)]'}`}>{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <button 
                onClick={handleSave}
                disabled={saving}
                className="w-full h-11 rounded-xl bg-[var(--orbit-glow)] hover:brightness-110 text-white text-[10px] font-bold uppercase tracking-widest shadow-[var(--orbit-shadow)] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {saving ? <Loader2 className="animate-spin w-4 h-4" /> : <Check className="w-4 h-4" />}
                Sincronizar Estrutura
              </button>
            </motion.div>
          ) : (
            <motion.div 
              key="properties"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="space-y-3"
            >
              {sentProperties.length === 0 ? (
                <div className="text-center p-12 border-2 border-dashed border-[var(--orbit-line)]/40 rounded-2xl">
                  <Building2 className="h-7 w-7 text-[var(--orbit-text-muted)]/20 mx-auto mb-3" />
                  <p className="text-[11px] text-[var(--orbit-text-muted)]/60 font-sans">Nenhum imóvel vinculado a este portal.</p>
                </div>
              ) : sentProperties.map((prop) => (
                <div key={prop.property_id} className="p-4 bg-[var(--orbit-bg)] rounded-xl border border-[var(--orbit-line)] hover:border-[var(--orbit-glow)]/20 transition-all shadow-sm">
                  <div className="flex gap-3">
                    <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 bg-[var(--orbit-bg-secondary)] border border-[var(--orbit-line)]">
                      {prop.cover_image ? (
                        <img src={prop.cover_image} className="w-full h-full object-cover" alt="" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[var(--orbit-text-muted)]/20"><Building2 size={20} /></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-xs font-medium text-[var(--orbit-text)] truncate mt-0.5">{prop.title}</h4>
                        <div className="flex items-center gap-1 shrink-0">
                          <button 
                            onClick={() => setEditingContext(prop)}
                            className={`p-2 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg transition-colors ${prop.context.note || prop.context.video_url ? 'bg-[var(--orbit-glow)]/10 text-[var(--orbit-glow)]' : 'text-[var(--orbit-text-muted)] hover:bg-[var(--orbit-line)]'}`}
                          >
                            <Pencil size={14} />
                          </button>
                          <button 
                            onClick={() => handleRemoveProperty(prop.property_id)}
                            className="p-2 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-rose-500/60 hover:bg-rose-500/10 hover:text-rose-500 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      <p className="text-[9px] font-mono text-[var(--orbit-glow)] uppercase tracking-tighter mt-1">
                        {prop.value ? `R$ ${(prop.value / 1000).toFixed(0)}k` : 'Sob consulta'} · {prop.location_text}
                      </p>
                    </div>
                  </div>
                  
                  {(prop.context.note || prop.context.video_url) && (
                    <div className="mt-3 p-3 rounded-lg bg-[var(--orbit-glow)]/5 border border-[var(--orbit-line)] text-[10px] text-[var(--orbit-text-muted)] italic">
                      {prop.context.note && <p>"{prop.context.note}"</p>}
                      {prop.context.video_url && (
                        <p className="text-[var(--orbit-glow)] mt-1.5 flex items-center gap-1.5 not-italic font-bold text-[9px]">
                          <Video size={9} /> VÍDEO CONTEXTUALIZADO
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
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
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="w-full max-w-sm bg-[var(--orbit-bg-secondary)] border border-[var(--orbit-line)] rounded-2xl p-7 shadow-2xl"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-9 h-9 rounded-lg bg-[var(--orbit-glow)]/10 border border-[var(--orbit-glow)]/15 flex items-center justify-center text-[var(--orbit-glow)]">
                  <MessageSquare size={16} />
                </div>
                <div>
                  <p className="text-[9px] font-mono text-[var(--orbit-glow)]/70 uppercase tracking-widest mt-0.5">{editingContext.title}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[9px] font-mono uppercase tracking-widest text-[var(--orbit-text-muted)] block mb-1.5">Nota do Especialista</label>
                  <textarea 
                    className="w-full h-28 bg-[var(--orbit-bg)] border border-[var(--orbit-line)] rounded-xl p-3 text-sm text-[var(--orbit-text)] placeholder:text-[var(--orbit-text-muted)]/40 focus:border-[var(--orbit-glow)]/30 focus:outline-none font-sans resize-none transition-all"
                    placeholder="Ex: 'Escolhi este pela varanda voltada para o nascente...'"
                    defaultValue={editingContext.context.note}
                    id="ctx-note"
                  />
                </div>
                
                <div>
                  <label className="text-[9px] font-mono uppercase tracking-widest text-[var(--orbit-text-muted)] block mb-1.5">URL do Vídeo</label>
                  <div className="relative">
                    <Video className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--orbit-glow)]/50" />
                    <input 
                      className="w-full h-10 pl-9 pr-4 bg-[var(--orbit-bg)] border border-[var(--orbit-line)] rounded-xl text-sm text-[var(--orbit-text)] placeholder:text-[var(--orbit-text-muted)]/40 focus:border-[var(--orbit-glow)]/30 focus:outline-none transition-all"
                      placeholder="YouTube, Vimeo ou Link Direto"
                      defaultValue={editingContext.context.video_url}
                      id="ctx-video"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <button 
                    onClick={() => setEditingContext(null)} 
                    className="flex-1 min-h-[44px] rounded-xl border border-[var(--orbit-line)] text-[var(--orbit-text-muted)] hover:bg-[var(--orbit-line)] hover:text-[var(--orbit-text)] text-[10px] font-mono uppercase tracking-widest transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={() => {
                      const note = (document.getElementById('ctx-note') as HTMLTextAreaElement).value
                      const video_url = (document.getElementById('ctx-video') as HTMLInputElement).value
                      saveContext(editingContext.property_id, { note, video_url })
                    }}
                    className="flex-1 min-h-[44px] bg-[var(--orbit-glow)] text-white text-[10px] font-bold uppercase tracking-widest rounded-xl shadow-[var(--orbit-shadow)] transition-all hover:brightness-110"
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
