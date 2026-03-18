"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Sparkles, Copy, Send, X, Loader2, Check, MessageSquare } from "lucide-react"
import { toast } from "sonner"
import { useTheme } from "next-themes"

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
      className={`border rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col ${
        isDark ? 'bg-[#0a0a0c] border-[#d4af35]/30' : 'bg-[var(--orbit-bg)] border-[var(--orbit-line)] shadow-[var(--orbit-shadow)]'
      }`}
    >
      <div className={`p-4 border-b flex items-center justify-between ${isDark ? 'border-[#d4af35]/10 bg-[#d4af35]/5' : 'border-[var(--orbit-line)] bg-[var(--orbit-bg-secondary)]'}`}>
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-lg ${isDark ? 'bg-[#d4af35]/20 text-[#d4af35]' : 'bg-[var(--orbit-glow)]/10 text-[var(--orbit-glow)]'}`}>
            <Sparkles size={18} />
          </div>
          <div>
            <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-[var(--orbit-text)]'}`}>Offer Engine</h3>
            <p className={`text-[10px] uppercase tracking-widest font-bold ${isDark ? 'text-[#d4af35]/60' : 'text-[var(--orbit-text-muted)]'}`}>Personalização Cognitiva</p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-zinc-500 transition-colors">
          <X size={18} />
        </button>
      </div>

      <div className="p-6">
        <div className={`flex items-center gap-4 mb-6 p-3 rounded-xl border ${isDark ? 'bg-white/2 border-white/5' : 'bg-[var(--orbit-bg-secondary)] border-[var(--orbit-line)]'}`}>
           <div className={`w-12 h-12 rounded-lg shrink-0 overflow-hidden border ${isDark ? 'bg-zinc-800 border-white/10' : 'bg-gray-100 border-[var(--orbit-line)]'}`}>
             {property.cover_image && <img src={property.cover_image} alt="" className="w-full h-full object-cover" />}
           </div>
           <div className="flex-1 min-w-0">
             <p className={`text-[10px] uppercase font-bold tracking-tighter ${isDark ? 'text-zinc-500' : 'text-[var(--orbit-text-muted)]'}`}>Propriedade x Lead</p>
             <p className={`text-xs font-bold truncate ${isDark ? 'text-white' : 'text-[var(--orbit-text)]'}`}>{property.title || property.internal_name} → {lead.name}</p>
           </div>
        </div>

        {isLoading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-4">
            <Loader2 className={`w-8 h-8 animate-spin ${isDark ? 'text-[#d4af35]' : 'text-[var(--orbit-glow)]'}`} />
            <p className={`text-xs font-medium animate-pulse ${isDark ? 'text-zinc-400' : 'text-[var(--orbit-text-muted)]'}`}>Cruzando dados e gerando hooks persuasivos...</p>
          </div>
        ) : (
          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
            {offers.map((offer, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                className={`group relative p-4 rounded-xl border transition-all ${
                  isDark 
                    ? 'bg-[#0a0a0c] border-white/10 hover:border-[#d4af35]/30' 
                    : 'bg-[var(--orbit-bg)] border-[var(--orbit-line)] hover:border-[var(--orbit-glow)]/30'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase ${
                    isDark ? 'bg-[#d4af35]/10 text-[#d4af35] border-[#d4af35]/20' : 'bg-[var(--orbit-glow)]/10 text-[var(--orbit-glow)] border-[var(--orbit-glow)]/20'
                  }`}>
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
                <p className={`text-sm leading-relaxed italic ${isDark ? 'text-zinc-300' : 'text-[var(--orbit-text)]'}`}>"{offer.text}"</p>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {!isLoading && (
        <div className={`px-6 py-4 border-t ${isDark ? 'bg-white/2 border-white/5' : 'bg-[var(--orbit-bg-secondary)] border-[var(--orbit-line)]'}`}>
           <button 
            onClick={onClose}
            className={`w-full py-2 rounded-lg text-xs font-bold transition-colors ${
              isDark ? 'bg-zinc-800 hover:bg-zinc-700 text-white' : 'bg-[var(--orbit-line)] hover:bg-[var(--orbit-bg-secondary)] text-[var(--orbit-text)]'
            }`}
           >
             Finalizar
           </button>
        </div>
      )}
    </motion.div>
  )
}
