"use client"

import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import { motion, AnimatePresence } from "framer-motion"
import { 
  X, 
  MapPin, 
  Trash2, 
  Loader2, 
  Sparkles, 
  History as HistoryIcon,
  AlertTriangle,
  Check
} from "lucide-react"
import { toast } from "sonner"
import { useTheme } from "next-themes"

const MapAtlas = dynamic(
  () => import("@/components/atlas/MapAtlas").then((m) => m.MapAtlas),
  { ssr: false, loading: () => <div className="animate-pulse bg-[var(--orbit-line)] w-full h-full rounded-xl"/> }
)

interface EditPropertyModalProps {
  isOpen: boolean
  onClose: () => void
  property: any
  onSave: (updated: any) => Promise<void>
  onDelete?: (id: string) => Promise<void>
  onMarkAsSold?: (id: string) => Promise<void>
}

export default function EditPropertyModal({ isOpen, onClose, property, onSave, onDelete, onMarkAsSold }: EditPropertyModalProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const [formData, setFormData] = useState<any>({})
  const [marker, setMarker] = useState<{lat: number, lng: number} | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [markingSold, setMarkingSold] = useState(false)
  const [confirmSold, setConfirmSold] = useState(false)
  const [activeTab, setActiveTab] = useState<'details' | 'media' | 'location'>('details')

  useEffect(() => {
    if (property && isOpen) {
      setFormData({
        title: property.title || property.internal_name || "",
        value: property.value || "",
        location_text: property.location_text || "",
        neighborhood: property.neighborhood || "",
        city: property.city || "",
        cover_image: property.cover_image || "",
        bedrooms: property.bedrooms || "",
        suites: property.suites || "",
        area_privativa: property.area_privativa || "",
        area_total: property.area_total || "",
        features: (property.features || []).join(", "),
        ui_type: property.ui_type || "Ativo",
        topics: (property.topics || []).join(", "),
        condo_name: property.condo_name || "",
        description: property.description || "",
        vista_code: property.vista_code || "",
        internal_code: property.internal_code || "",
        internal_notes: property.internal_notes || "",
      })
      if (property.lat && property.lng) {
        setMarker({ lat: property.lat, lng: property.lng })
        setActiveTab('details')
      } else {
        setMarker(null)
        setActiveTab('location')
      }
      setConfirmDelete(false)
      setConfirmSold(false)
    }
  }, [property, isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const updatedData = { 
        ...property, 
        ...formData, 
        lat: marker?.lat || null, 
        lng: marker?.lng || null,
        // Convert comma-separated strings back to arrays
        features: formData.features ? formData.features.split(',').map((s: string) => s.trim()).filter(Boolean) : [],
        topics: formData.topics ? formData.topics.split(',').map((s: string) => s.trim()).filter(Boolean) : [],
      }
      
      await onSave(updatedData)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!onDelete || !property?.id) return
    setDeleting(true)
    try {
      await onDelete(property.id)
      onClose()
    } catch (err) {
      console.error(err)
    } finally {
      setDeleting(false)
    }
  }

  const handleMarkAsSold = async () => {
    if (!onMarkAsSold || !property?.id) return
    setMarkingSold(true)
    try {
      await onMarkAsSold(property.id)
      onClose()
    } catch (err) {
      console.error(err)
    } finally {
      setMarkingSold(false)
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingImage(true)
    try {
      const form = new FormData()
      form.append('file', file)

      const res = await fetch('/api/objects/atlas/upload', {
        method: 'POST',
        body: form
      })

      if (!res.ok) throw new Error('Falha no upload')
      
      const data = await res.json()
      setFormData((prev: any) => ({ ...prev, cover_image: data.url }))
      toast.success("Imagem enviada!")
    } catch (err) {
      toast.error("Erro no upload")
    } finally {
      setUploadingImage(false)
    }
  }

  if (!isOpen || !property) return null

  const inputClass = `w-full h-11 border rounded-xl px-4 text-sm transition-all focus:outline-none ${
    isDark 
      ? "bg-[#0A0A0B] border-white/10 text-white placeholder:text-white/20 focus:border-[var(--orbit-glow)]/40" 
      : "bg-white border-gray-200 text-slate-900 placeholder:text-slate-400 focus:border-[var(--orbit-glow)]"
  }`
  const labelClass = `text-[9px] font-mono uppercase tracking-[0.2em] block mb-1.5 ${
    isDark ? "text-white/40" : "text-slate-500 font-bold"
  }`

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-0 md:p-4 bg-black/80 backdrop-blur-md">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className={`relative w-full max-w-5xl h-full md:h-[90vh] md:rounded-[32px] overflow-hidden flex flex-col border border-white/10 shadow-[0_0_100px_rgba(0,0,0,0.5)] ${
          isDark ? "bg-[#050608]" : "bg-white"
        }`}
      >
        <form onSubmit={handleSubmit} className="flex flex-col h-full overflow-hidden">
          {/* Header */}
          <div className="p-6 border-b border-white/5 flex items-center justify-between shrink-0 bg-white/2">
            <div className="flex items-center gap-6">
              <div className="hidden sm:block w-16 h-16 rounded-2xl overflow-hidden border border-white/10 bg-black/20">
                <img src={formData.cover_image || "/placeholder.png"} className="w-full h-full object-cover" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">{formData.title || "Sem Título"}</h3>
                <div className="flex items-center gap-3 mt-1 text-[var(--orbit-glow)] font-mono font-bold">
                  <span>R$ {formData.value ? Number(formData.value).toLocaleString('pt-BR') : "---"}</span>
                  <span className="text-white/20 px-1 italic text-[10px]">•</span>
                  <span className="text-[10px] uppercase opacity-60 tracking-wider font-sans">{formData.neighborhood || "Localização não definida"}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex p-1 rounded-xl bg-black/20 border border-white/5">
                {(['details', 'media', 'location'] as const).map(tab => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-2 rounded-lg text-[10px] font-mono uppercase tracking-widest transition-all ${
                      activeTab === tab 
                        ? "bg-[var(--orbit-glow)] text-black font-bold" 
                        : "text-white/40 hover:text-white"
                    }`}
                  >
                    {tab === 'details' ? 'Infos' : tab === 'media' ? 'Galeria' : 'Mapa'}
                  </button>
                ))}
              </div>
              <button 
                type="button" 
                onClick={onClose}
                className="p-3 rounded-full hover:bg-white/5 text-white/40 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 flex overflow-hidden">
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
              {activeTab === 'details' && (
                <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-6">
                      <h4 className="text-[10px] font-mono uppercase tracking-[0.3em] text-[var(--orbit-glow)] opacity-40">Dados Primários</h4>
                      <div>
                        <label className={labelClass}>Título do Imóvel</label>
                        <input value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className={inputClass} />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className={labelClass}>Bairro</label>
                          <input value={formData.neighborhood} onChange={e => setFormData({...formData, neighborhood: e.target.value})} className={inputClass} placeholder="ex: Batel" />
                        </div>
                        <div>
                          <label className={labelClass}>Cidade</label>
                          <input value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} className={inputClass} placeholder="ex: Curitiba" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className={labelClass}>Cód. Interno</label>
                          <input value={formData.internal_code} onChange={e => setFormData({...formData, internal_code: e.target.value})} className={inputClass} />
                        </div>
                        <div>
                          <label className={labelClass}>Cód. Vista</label>
                          <input value={formData.vista_code} readOnly className={`${inputClass} opacity-40`} />
                        </div>
                      </div>
                      <div>
                        <label className={labelClass}>Preço (R$)</label>
                        <input type="text" value={formData.value} onChange={e => setFormData({...formData, value: e.target.value.replace(/\D/g, '')})} className={inputClass} />
                      </div>
                    </div>

                    <div className="space-y-6">
                      <h4 className="text-[10px] font-mono uppercase tracking-[0.3em] text-[var(--orbit-glow)] opacity-40">Estrutura & Metragem</h4>
                      <div className="grid grid-cols-3 gap-3">
                        <div><label className={labelClass}>Dorms</label><input type="number" value={formData.bedrooms} onChange={e => setFormData({...formData, bedrooms: e.target.value})} className={inputClass} /></div>
                        <div><label className={labelClass}>Suítes</label><input type="number" value={formData.suites} onChange={e => setFormData({...formData, suites: e.target.value})} className={inputClass} /></div>
                        <div><label className={labelClass}>Vagas</label><input type="number" value={formData.parking_spots} onChange={e => setFormData({...formData, parking_spots: e.target.value})} className={inputClass} /></div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div><label className={labelClass}>Privativa (m²)</label><input type="number" value={formData.area_privativa} onChange={e => setFormData({...formData, area_privativa: e.target.value})} className={inputClass} /></div>
                        <div><label className={labelClass}>Total (m²)</label><input type="number" value={formData.area_total} onChange={e => setFormData({...formData, area_total: e.target.value})} className={inputClass} /></div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className={labelClass}>Descritivo Premium</label>
                    <textarea 
                      value={formData.description} 
                      onChange={e => setFormData({...formData, description: e.target.value})} 
                      className={`${inputClass} h-40 py-4 resize-none`}
                    />
                  </div>

                   <div className="p-6 rounded-[24px] bg-red-500/5 border border-red-500/10 space-y-4">
                    <label className={`${labelClass} text-red-400 opacity-100 flex items-center gap-2`}>
                      <AlertTriangle size={12} /> Notas Internas Strategis
                    </label>
                    <textarea 
                      value={formData.internal_notes} 
                      onChange={e => setFormData({...formData, internal_notes: e.target.value})} 
                      className={`${inputClass} border-red-500/20 bg-transparent h-24 py-3`}
                    />
                  </div>
                </div>
              )}

              {activeTab === 'media' && (
                <div className="space-y-8 h-full animate-in fade-in duration-300">
                   <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                     {property.photos?.map((url: string, i: number) => (
                       <div key={i} className="group relative aspect-square rounded-2xl overflow-hidden border border-white/5">
                          <img src={url} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                          <button 
                            type="button"
                            onClick={() => setFormData({...formData, cover_image: url})}
                            className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[8px] font-mono font-bold uppercase text-[var(--orbit-glow)]"
                          >
                            Set Highlight
                          </button>
                       </div>
                     ))}
                   </div>
                </div>
              )}

              {activeTab === 'location' && (
                <div className="h-full min-h-[400px] rounded-[32px] overflow-hidden border border-white/10 relative">
                  <MapAtlas 
                    properties={[]}
                    isPlacing={true}
                    previewMarker={marker}
                    onMapClick={(lat, lng) => setMarker({ lat, lng })}
                    initialCenter={marker ? [marker.lng, marker.lat] : [-50.040, -29.800]}
                    initialZoom={15}
                  />
                  <div className="absolute top-6 left-6 p-4 bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl text-[10px] font-mono text-white/60">
                    Ajuste a localização exata do imóvel no mapa.
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar Logic View */}
            <div className="hidden lg:flex w-80 border-l border-white/5 p-8 flex-col gap-10 bg-white/1">
               <div className="space-y-4">
                  <h4 className="text-[10px] font-mono uppercase tracking-[0.4em] text-white/30">Intelligence Data</h4>
                  <div className="p-5 rounded-3xl bg-[var(--orbit-glow)]/5 border border-[var(--orbit-glow)]/10 space-y-2">
                     <p className="text-[10px] font-mono font-bold text-[var(--orbit-glow)]">IA Resonance Analysis</p>
                     <p className="text-[10px] text-white/50 leading-relaxed">
                        Sistema pronto para análise de matching gravitacional baseado nos metadados acima.
                     </p>
                  </div>
               </div>

               <div className="space-y-4">
                  <h4 className="text-[10px] font-mono uppercase tracking-[0.4em] text-white/30">Admin Control</h4>
                  {onMarkAsSold && (
                    <div className="space-y-3">
                       {!confirmSold ? (
                         <button type="button" onClick={() => setConfirmSold(true)} className="w-full h-11 rounded-xl border border-emerald-500/20 text-emerald-500/70 text-[10px] font-mono uppercase hover:bg-emerald-500/5 transition-all">Mark as Sold</button>
                       ) : (
                         <div className="flex gap-2">
                           <button type="button" onClick={() => setConfirmSold(false)} className="flex-1 py-2 bg-white/5 rounded-lg text-[9px] uppercase font-mono">No</button>
                           <button type="button" onClick={handleMarkAsSold} disabled={markingSold} className="flex-1 py-2 bg-emerald-600 rounded-lg text-[9px] font-bold uppercase font-mono">Confirm</button>
                         </div>
                       )}
                    </div>
                  )}

                  {onDelete && (
                    <div className="space-y-3">
                       {!confirmDelete ? (
                         <button type="button" onClick={() => setConfirmDelete(true)} className="w-full h-11 rounded-xl border border-red-500/20 text-red-500/70 text-[10px] font-mono uppercase hover:bg-red-500/5 transition-all">Delete Asset</button>
                       ) : (
                         <div className="flex gap-2">
                           <button type="button" onClick={() => setConfirmDelete(false)} className="flex-1 py-2 bg-white/5 rounded-lg text-[9px] uppercase font-mono">No</button>
                           <button type="button" onClick={handleDelete} disabled={deleting} className="flex-1 py-2 bg-red-600 rounded-lg text-[9px] font-bold uppercase font-mono text-white">Execute</button>
                         </div>
                       )}
                    </div>
                  )}
               </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-8 border-t border-white/5 bg-[#050608] flex items-center justify-between shrink-0">
             <div className="flex items-center gap-3 text-[10px] font-mono text-white/20 uppercase tracking-widest">
                <HistoryIcon size={12} />
                <span>Last Sync: Realtime</span>
             </div>
             
             <div className="flex items-center gap-4">
                <button 
                  type="button" 
                  onClick={onClose}
                  className="px-8 h-12 rounded-2xl border border-white/10 text-[10px] font-mono uppercase text-white/60 hover:bg-white/5 transition-all"
                >
                  Descartar
                </button>
                <button 
                  type="submit"
                  disabled={saving}
                  className="px-10 h-12 rounded-2xl bg-[var(--orbit-glow)] text-black font-bold text-[11px] uppercase tracking-widest shadow-[0_0_40px_rgba(46,197,255,0.2)] hover:shadow-[0_0_60px_rgba(46,197,255,0.3)] transition-all flex items-center justify-center min-w-[200px]"
                >
                  {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <div className="flex items-center gap-2"><Check size={16} /> Salvar Alterações</div>}
                </button>
             </div>
          </div>
        </form>
      </motion.div>
    </div>
  )
}
