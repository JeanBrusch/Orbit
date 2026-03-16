"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Users, Link2, Settings, MessageSquare, 
  Video, Star, Check, Loader2, AlertCircle,
  Copy, ExternalLink, Trash2, Building2, ArrowRight
} from "lucide-react"
import { getSupabase } from "@/lib/supabase"

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
        setTheme((data as any).theme)
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
      .select('property_id, properties(title, cover_image, value, location_text)')
      .eq('lead_id', leadId)
      .neq('state', 'discarded')

    if (!capsuleItems) return

    const { data: contexts } = await (supabase
      .from('client_property_context') as any)
      .select('*')
      .eq('client_space_id', spaceId)

    const contextMap = new Map((contexts || []).map(c => [c.property_id, c]))

    const merged = (capsuleItems as any[]).map(item => ({
      ...item.properties,
      property_id: item.property_id,
      context: contextMap.get(item.property_id) || { note: '', video_url: '' }
    }))

    setSentProperties(merged)
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

    if (!error) {
      fetchSentProperties(space.id)
      setEditingContext(null)
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
        const { error } = await supabase
          .from('client_spaces')
          .update({ slug, theme, updated_at: new Date().toISOString() } as any)
          .eq('id', space.id)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('client_spaces')
          .insert({ lead_id: leadId, slug, theme } as any)
          .select()
          .single()
        if (error) throw error
        setSpace(data as any)
      }
      alert("Espaço do cliente salvo com sucesso!")
    } catch (err: any) {
      setError(err.message || "Erro ao salvar espaço")
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-indigo-400" /></div>

  const publicUrl = `${window.location.origin}/selection/${slug}`

  return (
    <div className="flex flex-col h-full bg-[#0a0a0c]">
      <div className="p-6 border-b border-white/5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-white flex items-center gap-2">
            <Users className="text-indigo-400 w-5 h-5" /> 
            Orbit Selection
          </h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white"><Trash2 size={18} /></button>
        </div>

        <div className="flex p-1 bg-white/5 rounded-lg border border-white/5">
          <button 
            onClick={() => setActiveTab('slug')}
            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${activeTab === 'slug' ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            Link & Slug
          </button>
          <button 
            onClick={() => setActiveTab('properties')}
            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${activeTab === 'properties' ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            Imóveis ({sentProperties.length})
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <AnimatePresence mode="wait">
          {activeTab === 'slug' ? (
            <motion.div 
              key="slug"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-6"
            >
              <div>
                <label className="text-xs text-zinc-400 block mb-2 uppercase tracking-wider">Slug da URL</label>
                <div className="flex gap-2">
                  <div className="flex-1 flex items-center bg-black/40 border border-white/10 rounded-lg overflow-hidden px-3 py-2">
                    <span className="text-zinc-500 text-xs text-nowrap">/selection/</span>
                    <input 
                      type="text" 
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
                      className="bg-transparent border-none focus:ring-0 text-white text-sm flex-1 ml-1"
                      placeholder="nome-do-cliente"
                    />
                  </div>
                </div>
                {space && (
                  <div className="flex items-center justify-between mt-2">
                    <a href={publicUrl} target="_blank" className="text-[10px] text-indigo-400 flex items-center gap-1 hover:underline">
                      Abrir portal <ExternalLink size={10} />
                    </a>
                    <button onClick={() => navigator.clipboard.writeText(publicUrl)} className="text-[10px] text-zinc-500 hover:text-zinc-300 flex items-center gap-1">
                      Copiar Link <Copy size={10} />
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs text-zinc-400 block mb-2 uppercase tracking-wider">Estética do Portal</label>
                <div className="grid grid-cols-2 gap-3">
                  {['paper', 'light'].map((t) => (
                    <button 
                      key={t}
                      onClick={() => setTheme(t)}
                      className={`p-3 rounded-xl border transition-all flex flex-col items-center gap-2 ${theme === t ? 'border-indigo-400/50 bg-indigo-400/10' : 'border-white/5 bg-white/5 opacity-50'}`}
                    >
                      <div className={`w-full h-8 rounded-md border border-black/5 ${t === 'paper' ? 'bg-[#f5f1eb]' : 'bg-white'}`} />
                      <span className="text-xs font-medium capitalize">{t} mode</span>
                    </button>
                  ))}
                </div>
              </div>

              <button 
                onClick={handleSave}
                disabled={saving}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-all shadow-lg flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="animate-spin w-4 h-4" /> : <Check className="w-4 h-4" />}
                Salvar Espaço
              </button>
            </motion.div>
          ) : (
            <motion.div 
              key="properties"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="space-y-4"
            >
              {sentProperties.map((prop) => (
                <div key={prop.property_id} className="p-3 bg-white/5 rounded-xl border border-white/5 space-y-3">
                  <div className="flex gap-3">
                    <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-zinc-800">
                      {prop.cover_image && <img src={prop.cover_image} className="w-full h-full object-cover" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-white truncate">{prop.title || 'Sem título'}</h4>
                      <p className="text-[10px] text-zinc-500">{prop.location_text}</p>
                    </div>
                    <button 
                      onClick={() => setEditingContext(prop)}
                      className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400"
                    >
                      <Settings size={14} />
                    </button>
                  </div>
                  {(prop.context.note || prop.context.video_url) && (
                    <div className="p-2.5 rounded-lg bg-indigo-500/5 border border-indigo-500/10 text-[10px] text-zinc-300 italic">
                      {prop.context.note && <p>"{prop.context.note}"</p>}
                      {prop.context.video_url && <p className="text-indigo-400 mt-1 flex items-center gap-1"><Video size={10} /> Vídeo vinculado</p>}
                    </div>
                  )}
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* MODAL PARA EDITAR NOTA/CONTEXTO */}
      <AnimatePresence>
        {editingContext && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-sm bg-[#121214] border border-white/10 rounded-2xl p-6 shadow-2xl"
            >
              <h4 className="text-white font-medium mb-4 flex items-center gap-2">
                <MessageSquare className="text-indigo-400 w-4 h-4" /> 
                Nota para o Cliente
              </h4>
              <div className="space-y-4">
                <textarea 
                  className="w-full h-24 bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-white focus:border-indigo-500/50 focus:ring-0 outline-none"
                  placeholder="Escreva algo pessoal para este cliente sobre este imóvel..."
                  defaultValue={editingContext.context.note}
                  id="ctx-note"
                />
                <input 
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-white focus:border-indigo-500/50 focus:ring-0 outline-none"
                  placeholder="Link do Vídeo (YouTube/Vimeo)"
                  defaultValue={editingContext.context.video_url}
                  id="ctx-video"
                />
                <div className="flex gap-2 pt-2">
                  <button onClick={() => setEditingContext(null)} className="flex-1 py-2.5 rounded-xl bg-white/5 text-zinc-400 text-xs">Cancelar</button>
                  <button 
                    onClick={() => {
                      const note = (document.getElementById('ctx-note') as HTMLTextAreaElement).value
                      const video_url = (document.getElementById('ctx-video') as HTMLInputElement).value
                      saveContext(editingContext.property_id, { note, video_url })
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-medium"
                  >
                    Salvar Nota
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
