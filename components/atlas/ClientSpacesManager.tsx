"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Users, Link2, Settings, MessageSquare, 
  Video, Star, Check, Loader2, AlertCircle,
  Copy, ExternalLink, Trash2, Building2, Pencil 
} from "lucide-react"
import { getSupabase } from "@/lib/supabase"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"

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
    
    // In Orbit, properties in a selection are 'capsule_items'
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
      toast.success("Espaço do cliente salvo com sucesso!")
    } catch (err: any) {
      setError(err.message || "Erro ao salvar espaço")
      toast.error(err.message || "Erro ao salvar espaço")
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-20 flex flex-col items-center justify-center gap-4">
    <Loader2 className="animate-spin text-[#a07828]" />
    <p className="text-xs font-serif italic text-[#8a7f70]">Sincronizando portal...</p>
  </div>

  const publicUrl = `${window.location.origin}/selection/${slug}`

  return (
    <div className="flex flex-col h-full bg-[#fdfaf5]">
      {/* Header */}
      <div className="p-6 border-b border-[rgba(28,24,18,0.05)] bg-white/50">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#a07828]/10 flex items-center justify-center text-[#a07828]">
              <Settings size={20} />
            </div>
            <div>
              <h3 className="text-lg font-serif tracking-tight text-[#1c1812]">
                Gestão de Seleção
              </h3>
              <p className="text-[10px] font-mono uppercase tracking-widest text-[#a07828]">
                Lead: {space?.leads?.name || 'Carregando...'}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 rounded-xl text-[#8a7f70] hover:bg-black/5 transition-colors"
          >
            <Trash2 size={18} />
          </button>
        </div>

        <div className="flex p-1 bg-[#ede8df]/50 rounded-xl border border-[rgba(28,24,18,0.05)]">
          <button 
            onClick={() => setActiveTab('slug')}
            className={`flex-1 py-2 text-[10px] font-mono uppercase tracking-widest rounded-lg transition-all ${activeTab === 'slug' ? 'bg-white text-[#a07828] shadow-sm' : 'text-[#8a7f70] hover:text-[#1c1812]'}`}
          >
            Link & Estética
          </button>
          <button 
            onClick={() => setActiveTab('properties')}
            className={`flex-1 py-2 text-[10px] font-mono uppercase tracking-widest rounded-lg transition-all ${activeTab === 'properties' ? 'bg-white text-[#a07828] shadow-sm' : 'text-[#8a7f70] hover:text-[#1c1812]'}`}
          >
            Curadoria ({sentProperties.length})
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
        <AnimatePresence mode="wait">
          {activeTab === 'slug' ? (
            <motion.div 
              key="slug"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <div className="space-y-3">
                <label className="text-[9px] font-mono uppercase tracking-[0.2em] text-[#8a7f70] block">Slug Personalizado</label>
                <div className="relative group">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-[#8a7f70] opacity-50">/selection/</div>
                  <input 
                    type="text" 
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    className="w-full pl-20 pr-4 h-11 bg-white border border-[rgba(28,24,18,0.1)] rounded-xl text-xs focus:border-[#a07828]/40 focus:ring-0 outline-none transition-all"
                    placeholder="nome-do-cliente"
                  />
                </div>
                {space && (
                  <div className="flex items-center gap-3 pt-1">
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(publicUrl);
                        toast.success("Link copiado!");
                      }} 
                      className="flex-1 h-9 bg-[#f5f1eb] rounded-lg text-[9px] font-mono uppercase tracking-widest text-[#8a7f70] hover:text-[#a07828] transition-colors flex items-center justify-center gap-2"
                    >
                      <Copy size={12} /> Copiar Link
                    </button>
                    <a 
                      href={publicUrl} 
                      target="_blank" 
                      className="flex-1 h-9 bg-[#f5f1eb] rounded-lg text-[9px] font-mono uppercase tracking-widest text-[#8a7f70] hover:text-[#1c1812] transition-colors flex items-center justify-center gap-2"
                    >
                      <ExternalLink size={12} /> Abrir Portal
                    </a>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <label className="text-[9px] font-mono uppercase tracking-[0.2em] text-[#8a7f70] block">Variação do White-label</label>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { id: 'paper', label: 'Paper Sepia', bg: 'bg-[#f5f1eb]' },
                    { id: 'light', label: 'Cloud White', bg: 'bg-white' }
                  ].map((t) => (
                    <button 
                      key={t.id}
                      onClick={() => setTheme(t.id)}
                      className={`p-3 rounded-2xl border transition-all flex flex-col items-center gap-3 group ${theme === t.id ? 'border-[#a07828]/50 bg-[#a07828]/5' : 'border-[rgba(28,24,18,0.05)] bg-white hover:border-[#a07828]/20'}`}
                    >
                      <div className={`w-full h-12 rounded-xl border border-black/5 shadow-inner ${t.bg} group-hover:scale-[1.02] transition-transform`} />
                      <span className={`text-[10px] font-mono uppercase tracking-widest ${theme === t.id ? 'text-[#a07828]' : 'text-[#8a7f70]'}`}>{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <Button 
                onClick={handleSave}
                disabled={saving}
                className="w-full h-12 rounded-xl bg-[#1c1812] hover:bg-black text-white text-[10px] font-bold uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-3"
              >
                {saving ? <Loader2 className="animate-spin w-4 h-4" /> : <Check className="w-4 h-4" />}
                Sincronizar Estrutura
              </Button>
            </motion.div>
          ) : (
            <motion.div 
              key="properties"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {sentProperties.length === 0 ? (
                <div className="text-center p-12 border-2 border-dashed border-[rgba(28,24,18,0.05)] rounded-2xl">
                  <Building2 className="h-8 w-8 text-[#8a7f70]/20 mx-auto mb-3" />
                  <p className="text-[11px] text-[#8a7f70] font-serif italic">Nenhum imóvel vinculado a este portal.</p>
                </div>
              ) : sentProperties.map((prop) => (
                <div key={prop.property_id} className="p-4 bg-white rounded-2xl border border-[rgba(28,24,18,0.05)] hover:border-[#a07828]/20 transition-all shadow-sm">
                  <div className="flex gap-4">
                    <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-[#ede8df] border border-black/5">
                      {prop.cover_image ? (
                        <img src={prop.cover_image} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[#8a7f70]/30"><Building2 size={24} /></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-xs font-serif font-bold text-[#1c1812] truncate mt-0.5">{prop.title}</h4>
                        <button 
                          onClick={() => setEditingContext(prop)}
                          className={`p-1.5 rounded-lg transition-colors ${prop.context.note || prop.context.video_url ? 'bg-[#a07828]/10 text-[#a07828]' : 'text-[#8a7f70] hover:bg-black/5'}`}
                        >
                          <Pencil size={14} />
                        </button>
                        <button 
                          onClick={() => handleRemoveProperty(prop.property_id)}
                          className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <p className="text-[9px] font-mono text-[#a07828] uppercase tracking-tighter mt-1">
                        {prop.value ? `R$ ${(prop.value / 1000).toFixed(0)}k` : 'Sob consulta'} • {prop.location_text}
                      </p>
                    </div>
                  </div>
                  
                  {(prop.context.note || prop.context.video_url) && (
                    <div className="mt-3 p-3 rounded-xl bg-[#fdfaf5] border border-[#a07828]/10 text-[10px] text-[#8a7f70] font-serif italic relative">
                      <div className="absolute -top-2 left-4 px-1.5 bg-[#fdfaf5] text-[8px] font-mono uppercase tracking-widest text-[#a07828]/60">Insight</div>
                      {prop.context.note && <p>"{prop.context.note}"</p>}
                      {prop.context.video_url && (
                        <p className="text-[#a07828] mt-2 flex items-center gap-1.5 not-italic font-bold">
                          <Video size={10} /> VÍDEO CONTEXTUALIZADO
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
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-sm bg-white border border-[rgba(28,24,18,0.1)] rounded-3xl p-8 shadow-2xl"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-[#a07828]/10 flex items-center justify-center text-[#a07828]">
                  <MessageSquare size={18} />
                </div>
                <div>
                  <h4 className="text-[#1c1812] font-serif text-lg leading-tight">Insight Editorial</h4>
                  <p className="text-[10px] font-mono text-[#a07828] uppercase tracking-widest">Para: {editingContext.title}</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[9px] font-mono uppercase tracking-widest text-[#8a7f70]">Nota de Especialista</label>
                  <textarea 
                    className="w-full h-32 bg-[#fdfaf5] border border-[rgba(28,24,18,0.1)] rounded-2xl p-4 text-xs text-[#1c1812] focus:border-[#a07828]/40 focus:ring-0 outline-none font-serif italic transition-all"
                    placeholder="Ex: 'Escolhi este pela varanda voltada para o nascente...'"
                    defaultValue={editingContext.context.note}
                    id="ctx-note"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-[9px] font-mono uppercase tracking-widest text-[#8a7f70]">URL do Vídeo</label>
                  <div className="relative">
                    <Video className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#a07828]/50" />
                    <input 
                      className="w-full h-11 pl-10 pr-4 bg-[#fdfaf5] border border-[rgba(28,24,18,0.1)] rounded-xl text-xs text-[#1c1812] focus:border-[#a07828]/40 focus:ring-0 outline-none transition-all"
                      placeholder="YouTube, Vimeo ou Link Direto"
                      defaultValue={editingContext.context.video_url}
                      id="ctx-video"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button 
                    onClick={() => setEditingContext(null)} 
                    className="flex-1 h-11 rounded-xl text-[9px] font-mono uppercase tracking-widest text-[#8a7f70] hover:bg-black/5 transition-colors"
                  >
                    Descartar
                  </button>
                  <button 
                    onClick={() => {
                      const note = (document.getElementById('ctx-note') as HTMLTextAreaElement).value
                      const video_url = (document.getElementById('ctx-video') as HTMLInputElement).value
                      saveContext(editingContext.property_id, { note, video_url })
                    }}
                    className="flex-1 h-11 bg-[#a07828] text-white text-[9px] font-bold uppercase tracking-widest rounded-xl shadow-lg shadow-[#a07828]/20 transition-all hover:scale-[1.02]"
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
