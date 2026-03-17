"use client"

import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import { motion, AnimatePresence } from "framer-motion"
import { X, Loader2, MapPin, Trash2, AlertTriangle } from "lucide-react"
import { toast } from "sonner"

const MapAtlas = dynamic(
  () => import("@/components/atlas/MapAtlas").then((m) => m.MapAtlas),
  { ssr: false, loading: () => <div className="animate-pulse bg-black/10 w-full h-full rounded-xl"/> }
)

interface EditPropertyModalProps {
  isOpen: boolean
  onClose: () => void
  property: any
  onSave: (updated: any) => Promise<void>
  onDelete?: (id: string) => Promise<void>
}

export default function EditPropertyModal({ isOpen, onClose, property, onSave, onDelete }: EditPropertyModalProps) {
  const [formData, setFormData] = useState<any>({})
  const [marker, setMarker] = useState<{lat: number, lng: number} | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

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
        features: (property.features || []).join(", "),
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

  const inputClass = "w-full h-11 bg-[#05060a] border border-[rgba(46,197,255,0.15)] rounded-xl px-4 text-sm text-[#e6eef6] placeholder:text-[#94a3b8]/40 focus:border-[#2ec5ff]/50 focus:outline-none transition-all"
  const labelClass = "text-[9px] font-mono uppercase tracking-[0.2em] text-[#94a3b8] block mb-1.5"

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-[#0b1220] border border-[rgba(46,197,255,0.15)] rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]"
        >
          {/* Form Side */}
          <div className="w-full md:w-1/2 p-8 overflow-y-auto space-y-5" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(46,197,255,0.15) transparent" }}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-sans font-semibold text-xl text-[#e6eef6]">Editar Ativo</h3>
                <p className="text-[9px] font-mono uppercase tracking-widest text-[#2ec5ff]/70 mt-1">ID: {property.id?.split('-')[0]}</p>
              </div>
              <button 
                type="button"
                onClick={onClose} 
                className="p-2 hover:bg-white/5 rounded-full text-[#94a3b8] hover:text-[#e6eef6] transition-colors md:hidden"
              >
                 <X size={20} />
              </button>
            </div>

            <form id="edit-form" onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className={labelClass}>Título</label>
                <input value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Valor Nominal</label>
                <input type="number" value={formData.value} onChange={e => setFormData({...formData, value: e.target.value})} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Localidade Resumida</label>
                <input value={formData.location_text} onChange={e => setFormData({...formData, location_text: e.target.value})} className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Bairro</label>
                  <input value={formData.neighborhood} onChange={e => setFormData({...formData, neighborhood: e.target.value})} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Cidade</label>
                  <input value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} className={inputClass} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
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
              </div>
              <div>
                <label className={labelClass}>Destaques (separados por vírgula)</label>
                <input value={formData.features} onChange={e => setFormData({...formData, features: e.target.value})} className={inputClass} />
              </div>

              <div>
                <label className={labelClass}>Imagem de Capa</label>
                <div className="flex gap-2 items-center mb-2">
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleImageUpload} 
                    disabled={uploadingImage}
                    className="w-full h-11 bg-[#05060a] border border-[rgba(46,197,255,0.15)] rounded-xl px-4 text-xs text-[#94a3b8] file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#2ec5ff]/10 file:text-[#2ec5ff] hover:file:bg-[#2ec5ff]/20 transition-all"
                  />
                  {uploadingImage && <Loader2 className="h-5 w-5 animate-spin text-[#2ec5ff] shrink-0" />}
                </div>
                <input value={formData.cover_image} onChange={e => setFormData({...formData, cover_image: e.target.value})} className={inputClass} placeholder="Ou cole a URL direta..." />
                {formData.cover_image && (
                  <img src={formData.cover_image} alt="" className="mt-2 w-full h-24 object-cover rounded-xl border border-[rgba(46,197,255,0.1)] opacity-80" />
                )}
              </div>

              <div className="pt-2 flex gap-3">
                <button type="button" onClick={onClose} className="flex-1 h-11 rounded-xl border border-[rgba(46,197,255,0.15)] text-[#94a3b8] hover:text-[#e6eef6] hover:bg-white/5 text-[10px] font-mono uppercase tracking-widest transition-all">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="flex-[2] h-11 rounded-xl bg-[#2ec5ff] hover:bg-[#2ec5ff]/90 text-[#05060a] text-[10px] font-bold uppercase tracking-widest shadow-[0_0_20px_rgba(46,197,255,0.2)] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar Alterações'}
                </button>
              </div>
            </form>

            {/* Delete Section */}
            {onDelete && (
              <div className="pt-4 border-t border-[rgba(46,197,255,0.08)]">
                {!confirmDelete ? (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="w-full h-10 rounded-xl border border-red-500/20 text-red-400 hover:bg-red-500/5 hover:border-red-500/40 text-[10px] font-mono uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                  >
                    <Trash2 size={13} /> Excluir Ativo do Banco
                  </button>
                ) : (
                  <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-xl space-y-3">
                    <div className="flex items-center gap-2 text-red-400">
                      <AlertTriangle size={15} />
                      <span className="text-[11px] font-bold uppercase tracking-wider">Ação Irreversível</span>
                    </div>
                    <p className="text-xs text-[#94a3b8]">Isso remove o imóvel do banco, junto com todas as interações e dados vinculados.</p>
                    <div className="flex gap-2">
                      <button onClick={() => setConfirmDelete(false)} className="flex-1 h-9 rounded-lg border border-white/10 text-[#94a3b8] hover:bg-white/5 text-[10px] font-mono uppercase tracking-widest transition-all">
                        Cancelar
                      </button>
                      <button onClick={handleDelete} disabled={deleting} className="flex-1 h-9 rounded-lg bg-red-500 hover:bg-red-600 text-white text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                        {deleting ? <Loader2 size={13} className="animate-spin" /> : <><Trash2 size={13} /> Confirmar Exclusão</>}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Map Side */}
          <div className="w-full md:w-1/2 bg-[#05060a] relative min-h-[400px] md:min-h-0 border-l border-[rgba(46,197,255,0.1)]">
            <button 
              type="button"
              onClick={onClose} 
              className="absolute top-5 right-5 z-10 p-2 hover:bg-white/10 rounded-full text-[#94a3b8] hidden md:block backdrop-blur-md transition-colors"
            >
              <X size={18} />
            </button>
            <div className="absolute top-5 left-5 z-10 p-4 bg-[#0b1220]/80 backdrop-blur-md rounded-xl border border-[rgba(46,197,255,0.15)] max-w-[80%] pointer-events-none">
              <div className="flex items-center gap-2 mb-1">
                <MapPin className="h-3.5 w-3.5 text-[#2ec5ff]" />
                <span className="text-[10px] font-bold text-[#e6eef6] uppercase tracking-widest">Localização</span>
              </div>
              <p className="text-[10px] text-[#94a3b8]">Clique no mapa para registrar as coordenadas.</p>
              {marker && (
                <p className="text-[9px] text-[#2ec5ff] mt-1 font-mono">{marker.lat.toFixed(5)}, {marker.lng.toFixed(5)}</p>
              )}
            </div>
            
            <MapAtlas 
               properties={[]}
               isPlacing={true}
               previewMarker={marker}
               onMapClick={(lat, lng) => setMarker({ lat, lng })}
               initialCenter={marker ? [marker.lng, marker.lat] : [-50.0333, -29.8000]}
               initialZoom={marker ? 15 : 12}
            />
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
