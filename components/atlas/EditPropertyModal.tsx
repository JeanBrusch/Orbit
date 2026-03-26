"use client"

import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import { motion, AnimatePresence } from "framer-motion"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { X, Loader2, MapPin, Trash2, AlertTriangle } from "lucide-react"
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
    if (property) {
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
        ui_type: property.ui_type || "",
        topics: (property.topics || []).join(", "),
        condo_name: property.condo_name || "",
        description: property.description || "",
        vista_code: property.vista_code || "",
        internal_code: property.internal_code || "",
        internal_notes: property.internal_notes || "",
      })
      if (property.lat && property.lng) {
        setMarker({ lat: property.lat, lng: property.lng })
      } else {
        setMarker(null)
      }
      setConfirmDelete(false)
    }
  }, [property, isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const updatedData = { ...property, ...formData, lat: marker?.lat || null, lng: marker?.lng || null }
      
      if (marker && (marker.lat !== property.lat || marker.lng !== property.lng)) {
        try {
          await fetch(`/api/properties/${property.id}/location`, {
             method: 'PATCH',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ lat: marker.lat, lng: marker.lng })
          })
        } catch (locationErr) {
          console.error("Failed to update location via PATCH", locationErr)
        }
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
      setConfirmDelete(false)
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
      setConfirmSold(false)
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
      toast.success("Imagem enviada com sucesso")
    } catch (err) {
      console.error(err)
      toast.error("Erro ao enviar imagem")
    } finally {
      setUploadingImage(false)
    }
  }

  if (!isOpen || !property) return null

  const inputClass = `w-full h-11 border rounded-xl px-4 text-sm transition-all focus:outline-none ${
    isDark 
      ? "bg-[var(--orbit-bg)] border-[var(--orbit-line)] text-[var(--orbit-text)] placeholder:text-[var(--orbit-text-muted)] focus:border-[var(--orbit-glow)]/50" 
      : "bg-white border-gray-200 text-slate-900 placeholder:text-slate-400 focus:border-[var(--orbit-glow)] focus:ring-1 focus:ring-[var(--orbit-glow)]/30"
  }`
  const labelClass = `text-[9px] font-mono uppercase tracking-[0.2em] block mb-1.5 ${
    isDark ? "text-[var(--orbit-text-muted)]" : "text-slate-500 font-bold"
  }`

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className={`border rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh] ${
            isDark 
              ? "bg-[var(--orbit-bg-secondary)] border-[var(--orbit-line)] text-white" 
              : "bg-white border-gray-200 text-slate-900"
          }`}
        >
          {/* Header Area */}
          <div className={`p-6 border-b flex items-center justify-between ${
            isDark ? "bg-black/20 border-[var(--orbit-line)]" : "bg-gray-50 border-gray-200"
          }`}>
            <div className="flex items-center gap-6">
              <div className="hidden md:block w-20 h-20 rounded-xl overflow-hidden border border-[var(--orbit-line)]">
                <img src={formData.cover_image} alt="" className="w-full h-full object-cover" />
              </div>
              <div>
                <h3 className={`font-sans font-bold text-2xl ${isDark ? 'text-[var(--orbit-text)]' : 'text-[var(--orbit-text)]'}`}>{formData.title || "Sem Título"}</h3>
                <div className="flex items-center gap-3 mt-1.5">
                  <span className="text-xl font-mono text-[var(--orbit-glow)] font-bold">R$ {formData.value ? Number(formData.value).toLocaleString('pt-BR') : "---"}</span>
                  <div className="px-2 py-0.5 rounded-full bg-[var(--orbit-glow)]/10 border border-[var(--orbit-glow)]/20 text-[var(--orbit-glow)] text-[10px] font-mono uppercase font-bold tracking-tighter">
                    {formData.ui_type || "Ativo"}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex gap-2">
              <div className={`flex p-1 rounded-xl border mr-4 ${
                isDark ? "bg-black/40 border-[var(--orbit-line)]" : "bg-gray-100 border-gray-200"
              }`}>
                {(['details', 'media', 'location'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-2 rounded-lg text-[10px] font-mono uppercase tracking-widest transition-all ${
                      activeTab === tab 
                        ? 'bg-[var(--orbit-glow)] text-black font-bold shadow-lg' 
                        : isDark 
                          ? 'text-[var(--orbit-text-muted)] hover:text-[var(--orbit-text)] hover:bg-white/5'
                          : 'text-slate-500 hover:text-slate-900 hover:bg-black/5'
                    }`}
                  >
                    {tab === 'details' ? '📋 Detalhes' : tab === 'media' ? '🖼️ Galeria' : '📍 Localização'}
                  </button>
                ))}
              </div>
              <button 
                type="button"
                onClick={onClose} 
                className={`p-2.5 rounded-xl transition-colors border border-transparent ${
                  isDark 
                    ? "hover:bg-white/5 text-[var(--orbit-text-muted)] hover:text-[var(--orbit-text)] hover:border-[var(--orbit-line)]" 
                    : "hover:bg-gray-200 text-slate-500 hover:text-slate-900 hover:border-gray-300"
                }`}
              >
                 <X size={20} />
              </button>
            </div>
          </div>

          <div className="flex flex-1 overflow-hidden min-h-[600px]">
            {/* Main Content Area */}
            <div 
              className="flex-1 overflow-y-auto p-8 custom-scrollbar"
              style={{ 
                scrollbarWidth: "thin", 
                scrollbarColor: isDark ? "rgba(46,197,255,0.15) transparent" : "var(--orbit-line) transparent" 
              }}
            >
              {activeTab === 'details' && (
                <form id="edit-form" onSubmit={handleSubmit} className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Left Column: Basic Info */}
                    <div className="space-y-5">
                      <h4 className={`text-[10px] font-mono uppercase tracking-[0.3em] text-[var(--orbit-glow)] opacity-60 border-b pb-2 ${isDark ? "border-[var(--orbit-line)]" : "border-gray-200"}`}>Informações Básicas</h4>
                      
                      <div>
                        <label className={labelClass}>Título do Imóvel</label>
                        <input value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className={inputClass} placeholder="Ex: Casa duplex de alto padrão" />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className={labelClass}>Cód. Interno (Visível)</label>
                          <input value={formData.internal_code} onChange={e => setFormData({...formData, internal_code: e.target.value})} className={inputClass} placeholder="ORB-0000" />
                        </div>
                        <div>
                          <label className={labelClass}>Cód. VistaNet</label>
                          <input value={formData.vista_code || ""} readOnly className={`${inputClass} opacity-50 cursor-not-allowed ${!isDark && "bg-gray-100"}`} placeholder="N/A" title="Código original da importação" />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className={labelClass}>Valor de Venda</label>
                          <input 
                            type="text" 
                            value={formData.value ? Number(formData.value).toLocaleString('pt-BR') : ""} 
                            onChange={e => {
                              const rawValue = e.target.value.replace(/\D/g, '');
                              setFormData({...formData, value: rawValue ? Number(rawValue) : ""});
                            }} 
                            className={inputClass} 
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Condomínio (Mensal)</label>
                          <input 
                            type="number" 
                            value={formData.condo_fee} 
                            onChange={e => setFormData({...formData, condo_fee: e.target.value})} 
                            className={inputClass} 
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className={labelClass}>Bairro</label>
                          <input value={formData.neighborhood} onChange={e => setFormData({...formData, neighborhood: e.target.value})} className={inputClass} />
                        </div>
                        <div>
                          <label className={labelClass}>Cidade</label>
                          <input value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} className={inputClass} />
                        </div>
                      </div>
                    </div>

                    {/* Right Column: Structure & Tags */}
                    <div className="space-y-5">
                      <h4 className={`text-[10px] font-mono uppercase tracking-[0.3em] text-[var(--orbit-glow)] opacity-60 border-b pb-2 ${isDark ? "border-[var(--orbit-line)]" : "border-gray-200"}`}>Atributos e Tags</h4>
                      
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <div>
                          <label className={labelClass}>Quartos</label>
                          <input type="number" value={formData.bedrooms} onChange={e => setFormData({...formData, bedrooms: e.target.value})} className={inputClass} />
                        </div>
                        <div>
                          <label className={labelClass}>Suítes</label>
                          <input type="number" value={formData.suites} onChange={e => setFormData({...formData, suites: e.target.value})} className={inputClass} />
                        </div>
                        <div>
                          <label className={labelClass}>Área (m²)</label>
                          <input type="number" value={formData.area_privativa} onChange={e => setFormData({...formData, area_privativa: e.target.value})} className={inputClass} />
                        </div>
                        <div>
                          <label className={labelClass}>Vagas</label>
                          <input type="number" value={formData.parking_spots} onChange={e => setFormData({...formData, parking_spots: e.target.value})} className={inputClass} />
                        </div>
                      </div>

                      <div>
                        <label className={labelClass}>Tópicos (Pills de Destaque)</label>
                        <div className={`flex flex-wrap gap-2 mb-2 min-h-8 p-3 rounded-xl border border-dashed ${isDark ? "border-[var(--orbit-line)]" : "border-gray-300 bg-gray-50"}`}>
                          {(formData.topics || "").split(',').filter(Boolean).map((t: string, i: number) => (
                            <span key={i} className="px-2.5 py-1 rounded-lg bg-[var(--orbit-glow)]/10 text-[var(--orbit-glow)] text-[10px] font-mono border border-[var(--orbit-glow)]/20">
                              {t.trim()}
                            </span>
                          ))}
                        </div>
                        <input value={formData.topics} onChange={e => setFormData({...formData, topics: e.target.value})} className={inputClass} placeholder="Separe itens por vírgula..." />
                      </div>

                      <div>
                        <label className={labelClass}>Destaques Complementares</label>
                        <input value={formData.features} onChange={e => setFormData({...formData, features: e.target.value})} className={inputClass} />
                      </div>
                    </div>
                  </div>

                  {/* Full Width Description Area */}
                  <div className="space-y-3 pt-4">
                    <h4 className={`text-[10px] font-mono uppercase tracking-[0.3em] text-[var(--orbit-glow)] opacity-60 border-b pb-2 ${isDark ? "border-[var(--orbit-line)]" : "border-gray-200"}`}>Descritivo Detalhado</h4>
                    <textarea 
                      value={formData.description} 
                      onChange={e => setFormData({...formData, description: e.target.value})} 
                      className={`${inputClass} !h-40 py-3 resize-none leading-relaxed transition-all focus:ring-1 focus:ring-[var(--orbit-glow)]/30`}
                      placeholder="Descreva o imóvel com detalhes para que os leads possam entender o valor real..."
                    />
                  </div>

                  {/* Internal Notes Area */}
                  <div className="space-y-3 pt-4">
                    <h4 className={`flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.3em] text-red-400 opacity-80 border-b pb-2 ${isDark ? "border-[var(--orbit-line)]" : "border-gray-200"}`}>
                      <AlertTriangle size={12} />
                      Notas Internas (Apenas Corretores)
                    </h4>
                    <textarea 
                      value={formData.internal_notes} 
                      onChange={e => setFormData({...formData, internal_notes: e.target.value})} 
                      className={`${inputClass} !h-32 py-3 resize-none leading-relaxed transition-all focus:ring-1 focus:ring-red-500/30 border-red-500/20`}
                      placeholder="Informações sigilosas, condições de pagamento, regras de parceria, etc..."
                    />
                  </div>

                  {/* Sold & Action Section */}
                  <div className={`flex flex-col md:flex-row gap-6 pt-6 border-t ${isDark ? "border-[var(--orbit-line)]" : "border-gray-200"}`}>
                    <div className="flex-1 space-y-4">
                      {onMarkAsSold && (
                        <div>
                          {!confirmSold ? (
                            <button
                              type="button"
                              onClick={() => setConfirmSold(true)}
                              className="w-full h-12 rounded-xl border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/5 hover:border-emerald-500/40 text-[10px] font-mono uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                            >
                              <span>✓</span> Marcar como Vendido
                            </button>
                          ) : (
                            <div className={`p-4 rounded-xl space-y-3 border ${
                              isDark ? "bg-emerald-500/5 border-emerald-500/20" : "bg-emerald-50 border-emerald-200"
                            }`}>
                              <p className="text-xs text-[var(--orbit-text-muted)]">O imóvel será <strong>inativado</strong> da lista principal.</p>
                              <div className="flex gap-2">
                                <button type="button" onClick={() => setConfirmSold(false)} className={`flex-1 h-9 rounded-lg border text-[10px] font-mono uppercase tracking-widest transition-all ${
                                  isDark ? "border-white/10 text-[#94a3b8] hover:bg-white/5" : "border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                                }`}>Cancelar</button>
                                <button type="button" onClick={handleMarkAsSold} disabled={markingSold} className="flex-1 h-9 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2">
                                  {markingSold ? <Loader2 size={13} className="animate-spin" /> : '✓ Confirmar Venda'}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-[2] flex gap-3">
                      {onDelete && (
                        <div className="relative">
                          {!confirmDelete ? (
                            <button type="button" onClick={() => setConfirmDelete(true)} className="h-12 px-4 rounded-xl border border-red-500/20 text-red-500 hover:bg-red-500/10 text-[10px] font-mono uppercase tracking-widest transition-all" title="Excluir Imóvel">
                               <Trash2 size={16} />
                            </button>
                          ) : (
                            <div className={`absolute bottom-full left-0 mb-2 p-3 backdrop-blur-md border rounded-xl min-w-[200px] z-50 ${
                              isDark ? "bg-red-500/10 border-red-500/30" : "bg-white border-red-200 shadow-xl"
                            }`}>
                               <p className="text-[10px] font-mono text-red-400 mb-2">Excluir este imóvel?</p>
                               <div className="flex gap-2">
                                  <button type="button" onClick={() => setConfirmDelete(false)} className="flex-1 py-1.5 rounded bg-white/5 hover:bg-white/10 text-[9px] uppercase font-mono text-white/70">Não</button>
                                  <button type="button" onClick={handleDelete} disabled={deleting} className="flex-1 py-1.5 rounded bg-red-500/20 hover:bg-red-500/40 text-[9px] uppercase font-mono text-red-400 font-bold flex justify-center items-center">{deleting ? <Loader2 size={12} className="animate-spin" /> : 'Sim, excluir'}</button>
                               </div>
                            </div>
                          )}
                        </div>
                      )}
                      
                      <button type="button" onClick={onClose} className={`flex-1 h-12 rounded-xl border text-[10px] font-mono uppercase tracking-widest transition-all ${
                        isDark 
                          ? "border-[var(--orbit-line)] text-[var(--orbit-text-muted)] hover:text-[var(--orbit-text)] hover:bg-white/5" 
                          : "border-gray-300 text-slate-500 hover:text-slate-900 hover:bg-gray-100"
                      }`}>
                        Cancelar
                      </button>
                      <button type="submit" disabled={saving} className="flex-[2] h-12 rounded-xl bg-[var(--orbit-glow)] hover:bg-[var(--orbit-glow)]/90 text-black font-bold uppercase tracking-widest text-[11px] shadow-[0_0_20px_rgba(var(--orbit-glow-rgb),0.3)] transition-all disabled:opacity-50 flex items-center justify-center">
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar Alterações'}
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {activeTab === 'media' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                      <label className={labelClass}>Imagem de Capa (Principal)</label>
                      <div className="relative group rounded-2xl overflow-hidden border border-[var(--orbit-line)] bg-black/40 h-64">
                         {formData.cover_image ? (
                           <img src={formData.cover_image} alt="" className="w-full h-full object-cover" />
                         ) : (
                           <div className="w-full h-full flex items-center justify-center text-[var(--orbit-text-muted)] opacity-50 font-mono text-[10px]">Sem imagem</div>
                         )}
                         <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-6 text-center">
                            <div>
                               <p className="text-[10px] font-mono text-white mb-4 uppercase tracking-widest">Alterar capa principal</p>
                               <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" id="cover-upload" />
                               <label htmlFor="cover-upload" className="cursor-pointer px-6 py-2 bg-[var(--orbit-glow)] rounded-lg text-black text-[10px] font-bold uppercase">Fazer Upload</label>
                            </div>
                         </div>
                      </div>
                      <input value={formData.cover_image} onChange={e => setFormData({...formData, cover_image: e.target.value})} className={`${inputClass} mt-4`} placeholder="Ou cole a URL direta aqui..." />
                    </div>

                    <div className="space-y-4">
                       <h4 className="text-[10px] font-mono uppercase tracking-[0.3em] text-[var(--orbit-glow)] opacity-60">Todas as Fotos ({property.photos?.length || 0})</h4>
                       <div className="grid grid-cols-3 gap-3">
                         {property.photos?.map((url: string, idx: number) => (
                           <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-[var(--orbit-line)] group cursor-pointer hover:border-[var(--orbit-glow)]/50 transition-all">
                              <img src={url} alt="" className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
                              <button 
                                type="button" 
                                onClick={() => setFormData({...formData, cover_image: url})}
                                className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity text-[8px] text-white font-mono uppercase font-bold"
                              >
                                Usar Capa
                              </button>
                           </div>
                         ))}
                         <label className="aspect-square rounded-xl border border-dashed border-[var(--orbit-line)] hover:border-[var(--orbit-glow)]/50 flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 transition-all text-[var(--orbit-text-muted)] gap-1">
                            <span className="text-xl">+</span>
                            <span className="text-[8px] font-mono uppercase">Add</span>
                         </label>
                       </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'location' && (
                <div className="h-full min-h-[500px] flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="p-4 bg-[var(--orbit-bg-secondary)] border border-[var(--orbit-line)] rounded-xl mb-4 flex items-center justify-between">
                     <div className="flex items-center gap-3">
                       <MapPin className="text-[var(--orbit-glow)]" size={18} />
                       <div>
                         <p className="text-[10px] font-mono uppercase font-bold tracking-widest text-[var(--orbit-text)]">Coordenadas de Precisão</p>
                         <p className="text-[10px] text-[var(--orbit-text-muted)]">O mapa define a localização exata nas buscas por geolocalização.</p>
                       </div>
                     </div>
                     {marker && (
                       <div className="px-3 py-1.5 rounded-lg bg-black/40 font-mono text-[10px] text-[var(--orbit-glow)] border border-[var(--orbit-glow)]/20">
                         {marker.lat.toFixed(6)}, {marker.lng.toFixed(6)}
                       </div>
                     )}
                  </div>
                  
                  <div className="flex-1 rounded-2xl overflow-hidden border border-[var(--orbit-line)] group relative">
                    <MapAtlas 
                      properties={[]}
                      isPlacing={true}
                      previewMarker={marker}
                      onMapClick={(lat, lng) => setMarker({ lat, lng })}
                      initialCenter={marker ? [marker.lng, marker.lat] : [-50.0333, -29.8000]}
                      initialZoom={marker ? 16 : 13}
                    />
                    <div className="absolute top-4 right-4 z-10 p-3 bg-black/60 backdrop-blur-md rounded-xl border border-white/10 text-[9px] font-mono text-white/70 max-w-[200px] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                      Clique em qualquer lugar no mapa para posicionar o marcador do imóvel.
                    </div>
                  </div>
                </div>
              )}
            </div>

             {/* Right Side Sidebar (Optional - for Match Insights later) */}
            <div className={`hidden lg:block w-72 border-l p-6 overflow-y-auto ${
              isDark ? "border-[var(--orbit-line)] bg-black/10" : "border-gray-200 bg-gray-50"
            } ${activeTab === 'details' ? '' : 'opacity-20 pointer-events-none'}`}>
               <h4 className={`text-[10px] font-mono uppercase tracking-[0.3em] mb-6 ${isDark ? "text-[var(--orbit-text-muted)]" : "text-slate-500 font-bold"}`}>Match Intelligence</h4>
               
               <div className="space-y-6">
                  <div className="p-4 rounded-xl bg-[var(--orbit-glow)]/5 border border-[var(--orbit-glow)]/10 space-y-3">
                    <p className="text-[10px] font-mono text-[var(--orbit-glow)] uppercase font-bold">Notas Internas</p>
                    <p className={`text-[11px] leading-relaxed ${isDark ? "text-[var(--orbit-text-muted)]" : "text-slate-500"}`}>
                      Use o campo de <strong>Notas Internas</strong> abaixo para registrar condições de pagamento, flexibilidade de prazo, permuta e qualquer detalhe estratégico. Essas informações são lidas pela IA automaticamente.
                    </p>
                  </div>

                  <div className="space-y-3">
                     <p className="text-[9px] font-mono text-[var(--orbit-text-muted)] uppercase">Chaves do Imóvel</p>
                     <div className={`flex items-center justify-between p-3 rounded-lg border ${isDark ? "bg-white/5 border-white/5" : "bg-white border-gray-200"}`}>
                        <span className="text-[10px] text-[var(--orbit-text-muted)]">Código Interno</span>
                        <span className="text-[10px] font-mono font-bold text-[var(--orbit-glow)]">{property.internal_code || '—'}</span>
                     </div>
                     <div className={`flex items-center justify-between p-3 rounded-lg border ${isDark ? "bg-white/5 border-white/5" : "bg-white border-gray-200"}`}>
                        <span className="text-[10px] text-[var(--orbit-text-muted)]">Cód. Vista</span>
                        <span className="text-[10px] font-mono text-[var(--orbit-text-muted)]">{property.vista_code || '—'}</span>
                     </div>
                  </div>
               </div>
            </div>
          </div>
        </motion.div>

      </div>
    </AnimatePresence>
  )
}
