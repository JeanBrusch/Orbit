"use client"

import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import { motion, AnimatePresence } from "framer-motion"
import { X, Loader2, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
}

export default function EditPropertyModal({ isOpen, onClose, property, onSave }: EditPropertyModalProps) {
  const [formData, setFormData] = useState<any>({})
  const [marker, setMarker] = useState<{lat: number, lng: number} | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)

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
    }
  }, [property, isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const updatedData = { ...property, ...formData, lat: marker?.lat || null, lng: marker?.lng || null }
      
      // Save location if marker changed
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
      setFormData(prev => ({ ...prev, cover_image: data.url }))
      toast.success("Imagem enviada com sucesso")
    } catch (err) {
      console.error(err)
      toast.error("Erro ao enviar imagem")
    } finally {
      setUploadingImage(false)
    }
  }

  if (!isOpen || !property) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white border border-[rgba(28,24,18,0.1)] rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]"
        >
          {/* Form Side */}
          <div className="w-full md:w-1/2 p-8 overflow-y-auto space-y-6 custom-scrollbar">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-serif text-2xl">Editar Ativo</h3>
                <p className="text-[10px] font-mono uppercase tracking-widest text-[#a07828] mt-1">ID: {property.id.split('-')[0]}</p>
              </div>
              <button 
                type="button"
                onClick={onClose} 
                className="p-2 hover:bg-black/5 rounded-full text-[#8a7f70] md:hidden"
              >
                 <X size={20} />
              </button>
            </div>

            <form id="edit-form" onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono uppercase tracking-widest text-[#8a7f70]">Título</label>
                <Input value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="h-11 rounded-xl bg-[#fdfaf5]" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono uppercase tracking-widest text-[#8a7f70]">Valor Nominal</label>
                <Input type="number" value={formData.value} onChange={e => setFormData({...formData, value: e.target.value})} className="h-11 rounded-xl bg-[#fdfaf5]" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono uppercase tracking-widest text-[#8a7f70]">Localidade Resumida</label>
                <Input value={formData.location_text} onChange={e => setFormData({...formData, location_text: e.target.value})} className="h-11 rounded-xl bg-[#fdfaf5]" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono uppercase tracking-widest text-[#8a7f70]">Bairro</label>
                  <Input value={formData.neighborhood} onChange={e => setFormData({...formData, neighborhood: e.target.value})} className="h-11 rounded-xl bg-[#fdfaf5]" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono uppercase tracking-widest text-[#8a7f70]">Cidade</label>
                  <Input value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} className="h-11 rounded-xl bg-[#fdfaf5]" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5Context">
                  <label className="text-[10px] font-mono uppercase tracking-widest text-[#8a7f70]">Quartos</label>
                  <Input type="number" value={formData.bedrooms} onChange={e => setFormData({...formData, bedrooms: e.target.value})} className="h-11 rounded-xl bg-[#fdfaf5]" />
                </div>
                <div className="space-y-1.5Context">
                  <label className="text-[10px] font-mono uppercase tracking-widest text-[#8a7f70]">Suítes</label>
                  <Input type="number" value={formData.suites} onChange={e => setFormData({...formData, suites: e.target.value})} className="h-11 rounded-xl bg-[#fdfaf5]" />
                </div>
                <div className="space-y-1.5Context">
                  <label className="text-[10px] font-mono uppercase tracking-widest text-[#8a7f70]">Área (m²)</label>
                  <Input type="number" value={formData.area_privativa} onChange={e => setFormData({...formData, area_privativa: e.target.value})} className="h-11 rounded-xl bg-[#fdfaf5]" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono uppercase tracking-widest text-[#8a7f70]">Destaques (Separados por vírgula)</label>
                <Input value={formData.features} onChange={e => setFormData({...formData, features: e.target.value})} className="h-11 rounded-xl bg-[#fdfaf5]" />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-mono uppercase tracking-widest text-[#8a7f70]">Imagem de Capa</label>
                <div className="flex gap-2 items-center">
                  <Input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleImageUpload} 
                    disabled={uploadingImage}
                    className="h-11 rounded-xl bg-[#fdfaf5] text-xs file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#a07828]/10 file:text-[#a07828] hover:file:bg-[#a07828]/20" 
                  />
                  {uploadingImage && <Loader2 className="h-5 w-5 animate-spin text-[#a07828]" />}
                </div>
                <Input value={formData.cover_image} onChange={e => setFormData({...formData, cover_image: e.target.value})} className="h-11 rounded-xl bg-[#fdfaf5] text-xs mt-2" placeholder="Ou cole a URL direta..." />
              </div>

              <div className="pt-4 flex gap-3">
                <Button type="button" variant="ghost" onClick={onClose} className="flex-1 h-12 rounded-xl text-xs font-mono uppercase tracking-widest border border-black/10 hover:bg-[#a07828]/5">Cancelar</Button>
                <Button type="submit" disabled={saving} className="flex-[2] h-12 rounded-xl bg-[#1c1812] hover:bg-black text-white text-[10px] font-bold uppercase tracking-widest shadow-lg">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar Alterações'}
                </Button>
              </div>
            </form>
          </div>
          
          {/* Map Side */}
          <div className="w-full md:w-1/2 bg-[#0a0907] relative min-h-[400px] md:min-h-0 border-l border-[#a07828]/20">
            <button 
              type="button"
              onClick={onClose} 
              className="absolute top-6 right-6 z-10 p-2 hover:bg-white/10 rounded-full text-white hidden md:block backdrop-blur-md"
            >
                 <X size={20} />
            </button>
            <div className="absolute top-6 left-6 z-10 p-4 bg-black/60 backdrop-blur-md rounded-2xl border border-white/10 max-w-[80%] pointer-events-none">
              <div className="flex items-center gap-2 mb-1">
                <MapPin className="h-4 w-4 text-[#a07828]" />
                <span className="text-xs font-bold text-white uppercase tracking-widest">Pin Location</span>
              </div>
              <p className="text-[10px] text-white/60">Clique no mapa para registrar a localização geocodificada do ativo.</p>
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
