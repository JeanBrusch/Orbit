"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Sparkles, Copy, Send, X, Loader2, Check, MessageSquare } from "lucide-react"
import { toast } from "sonner"

interface Offer {
  type: string
  text: string
}

interface OfferGeneratorProps {
  property: any
  lead: any
  onClose: () => void
}

export default function OfferGenerator({ property, lead, onClose }: OfferGeneratorProps) {
  const [offers, setOffers] = useState<Offer[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

  // Generate offers on mount or when property/lead change
  useEffect(() => {
    const generate = async () => {
      setIsLoading(true)
      try {
        const response = await fetch('/api/atlas/generate-offer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ propertyId: property.id, leadId: lead.id })
        })
        const data = await response.json()
        setOffers(data.offers || [])
      } catch (err) {
        toast.error("Erro ao gerar ofertas")
      } finally {
        setIsLoading(false)
      }
    }
    generate()
  }, [property.id, lead.id])

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text)
    setCopiedIndex(index)
    toast.success("Copiado!")
    setTimeout(() => setCopiedIndex(null), 2000)
  }

  const sendToWhatsApp = (text: string) => {
    const phone = lead.phone?.replace(/\D/g, '') || ""
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
    window.open(url, '_blank')
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="bg-[#0a0a0c] border border-[#d4af35]/30 rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col"
    >
      <div className="p-4 border-b border-[#d4af35]/10 flex items-center justify-between bg-[#d4af35]/5">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-[#d4af35]/20 text-[#d4af35]">
            <Sparkles size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Offer Engine</h3>
            <p className="text-[10px] text-[#d4af35]/60 uppercase tracking-widest font-bold">Personalização Cognitiva</p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-zinc-500 transition-colors">
          <X size={18} />
        </button>
      </div>

      <div className="p-6">
        <div className="flex items-center gap-4 mb-6 p-3 rounded-xl bg-white/2 border border-white/5">
           <div className="w-12 h-12 rounded-lg bg-zinc-800 shrink-0 overflow-hidden border border-white/10">
             {property.cover_image && <img src={property.cover_image} alt="" className="w-full h-full object-cover" />}
           </div>
           <div className="flex-1 min-w-0">
             <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-tighter">Propriedade x Lead</p>
             <p className="text-xs font-bold text-white truncate">{property.title || property.internal_name} → {lead.name}</p>
           </div>
        </div>

        {isLoading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-8 h-8 text-[#d4af35] animate-spin" />
            <p className="text-xs text-zinc-400 font-medium animate-pulse">Cruzando dados e gerando hooks persuasivos...</p>
          </div>
        ) : (
          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
            {offers.map((offer, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="group relative p-4 rounded-xl bg-[#0a0a0c] border border-white/10 hover:border-[#d4af35]/30 transition-all"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#d4af35]/10 text-[#d4af35] border border-[#d4af35]/20 uppercase">
                    Hook {offer.type}
                  </span>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => copyToClipboard(offer.text, idx)}
                      className="p-1.5 hover:bg-white/5 rounded text-zinc-400 hover:text-[#d4af35] transition-colors"
                      title="Copiar"
                    >
                      {copiedIndex === idx ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                    <button 
                      onClick={() => sendToWhatsApp(offer.text)}
                      className="p-1.5 hover:bg-[#25D366]/20 rounded text-[#25D366] transition-colors"
                      title="Enviar WhatsApp"
                    >
                      <MessageSquare size={14} />
                    </button>
                  </div>
                </div>
                <p className="text-sm text-zinc-300 leading-relaxed italic">"{offer.text}"</p>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {!isLoading && (
        <div className="px-6 py-4 bg-white/2 border-t border-white/5">
           <button 
            onClick={onClose}
            className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-xs font-bold transition-colors"
           >
             Finalizar
           </button>
        </div>
      )}
    </motion.div>
  )
}
