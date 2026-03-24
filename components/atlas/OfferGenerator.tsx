"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Sparkles, Copy, Send, X, Loader2, Check, MessageSquare, Layout, Image as ImageIcon } from "lucide-react"
import { toast } from "sonner"
import { useTheme } from "next-themes"
import InstagramAdOffer from "./InstagramAdOffer"

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
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const [offers, setOffers] = useState<Offer[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const [view, setView] = useState<'hooks' | 'ad'>('ad') // Default to the new visual ad

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
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-white border border-gray-100 rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col"
    >
      <div className="p-4 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
            <Sparkles size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900">Atlas Ad Studio</h3>
            <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400">Paleta Light Premium</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100 p-1 rounded-lg mr-4">
            <button 
              onClick={() => setView('ad')}
              className={`px-4 py-2.5 rounded-md text-[10px] font-bold transition-all flex items-center gap-1.5 ${
                view === 'ad' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <ImageIcon size={12} />
              Anúncio
            </button>
            <button 
              onClick={() => setView('hooks')}
              className={`px-4 py-2.5 rounded-md text-[10px] font-bold transition-all flex items-center gap-1.5 ${
                view === 'hooks' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Layout size={12} />
              Ganchos
            </button>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 transition-colors">
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="p-6 bg-white flex-1 overflow-y-auto min-h-[500px]">
        {isLoading ? (
          <div className="absolute inset-0 z-10 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <p className="text-xs font-semibold text-gray-500 animate-pulse text-center px-12">
              Transformando {property.title} em um anúncio de impacto...
            </p>
          </div>
        ) : null}

        {view === 'ad' ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <InstagramAdOffer 
              property={property} 
              onSendWhatsApp={sendToWhatsApp}
            />
          </motion.div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-4 mb-6 p-4 rounded-xl border border-gray-100 bg-gray-50/50">
               <div className="w-12 h-12 rounded-lg shrink-0 overflow-hidden border border-gray-100 bg-white">
                 {property.cover_image && <img src={property.cover_image} alt="" className="w-full h-full object-cover" />}
               </div>
               <div className="flex-1 min-w-0">
                 <p className="text-[10px] uppercase font-bold tracking-tighter text-gray-400">Contexto Criativo</p>
                 <p className="text-xs font-bold truncate text-gray-800">{property.title} → {lead.name}</p>
               </div>
            </div>

            <div className="space-y-3">
              {offers.map((offer, idx) => (
                <motion.div 
                  key={idx}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="group relative p-4 rounded-xl border border-gray-100 bg-white hover:border-blue-100 hover:shadow-md transition-all"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border border-blue-100 bg-blue-50 text-blue-600 uppercase">
                      Hook {offer.type}
                    </span>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => copyToClipboard(offer.text, idx)}
                        className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-blue-600 transition-colors"
                      >
                        {copiedIndex === idx ? <Check size={14} /> : <Copy size={14} />}
                      </button>
                      <button 
                        onClick={() => sendToWhatsApp(offer.text)}
                        className="p-1.5 hover:bg-green-50 rounded text-green-600 transition-colors"
                      >
                        <MessageSquare size={14} />
                      </button>
                    </div>
                  </div>
                  <p className="text-sm leading-relaxed text-gray-700 italic">"{offer.text}"</p>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="px-6 py-4 border-t border-gray-50 bg-gray-50/30">
         <button 
          onClick={onClose}
          className="w-full py-4 rounded-xl text-xs font-bold bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
         >
           Fechar Estúdio
         </button>
      </div>
    </motion.div>
  )
}
