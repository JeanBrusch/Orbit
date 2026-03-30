"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Mic, Send, X, Loader2, Sparkles, Check, Database, Link as LinkIcon, Globe } from "lucide-react"
import { useTheme } from "next-themes"
import { toast } from "sonner"

interface PropertyIngestionProps {
  onDataExtracted: (data: any) => void
  onClose: () => void
}

export default function PropertyIngestion({ onDataExtracted, onClose }: PropertyIngestionProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  
  const [activeTab, setActiveTab] = useState<"url" | "voice">("url")
  const [url, setUrl] = useState("")
  const [voiceText, setVoiceText] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [step, setStep] = useState<"input" | "review">("input")
  const [extractedData, setExtractedData] = useState<any>(null)

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) return
    
    setIsProcessing(true)
    try {
      const isVistanet = url.includes('vistanet') || url.includes('v.imo.bi')
      const endpoint = isVistanet ? "/api/property/import-vistanet" : "/api/link-preview"
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      })
      
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Falha ao extrair dados')
      
      if (isVistanet) {
        setExtractedData(data.property)
      } else {
        setExtractedData({
          title: data.title,
          cover_image: data.image,
          value: data.price,
          source_link: url
        })
      }
      setStep("review")
    } catch (err: any) {
      toast.error("Erro na extração", { description: err.message })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleVoiceSubmit = async () => {
    if (!voiceText.trim()) return
    setIsProcessing(true)
    try {
      const response = await fetch('/api/atlas/ingest-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: voiceText })
      })
      const data = await response.json()
      if (!response.ok) throw new Error('Falha ao processar descrição')
      
      setExtractedData(data)
      setStep("review")
    } catch (err: any) {
      toast.error("Erro no processamento cognitivo", { description: err.message })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleConfirm = async () => {
    if (!extractedData) return
    setIsProcessing(true)
    try {
      // Normaliza snake_case → camelCase para a API /api/property
      const payload = {
        title: extractedData.title || null,
        coverImage: extractedData.cover_image || extractedData.coverImage || null,
        sourceLink: extractedData.source_link || extractedData.sourceLink || url || null,
        sourceDomain: extractedData.source_domain || extractedData.sourceDomain || null,
        value: extractedData.value ?? extractedData.price ?? null,
        neighborhood: extractedData.neighborhood || null,
        city: extractedData.city || null,
        area_privativa: extractedData.area_privativa || null,
        bedrooms: extractedData.bedrooms || null,
        suites: extractedData.suites || null,
        parking_spots: extractedData.parking_spots || null,
        features: extractedData.features || [],
        payment_conditions: extractedData.payment_conditions || null,
        condo_fee: extractedData.condo_fee || null,
        iptu: extractedData.iptu || null,
        internal_notes: extractedData.internal_notes || null,
      }

      const response = await fetch('/api/property', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Falha ao salvar imóvel')
      }
      
      toast.success("Imóvel cadastrado com sucesso!")
      onDataExtracted(extractedData)
    } catch (err: any) {
      toast.error("Erro ao salvar", { description: err.message })
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 20 }}
      className={`border rounded-3xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] w-full max-w-lg overflow-hidden flex flex-col ${
        isDark ? 'bg-[#0a0a0c] border-white/10' : 'bg-white border-slate-200'
      }`}
    >
      <div className={`p-5 border-b flex items-center justify-between ${isDark ? 'border-white/5 bg-white/2' : 'border-slate-100 bg-slate-50'}`}>
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-2xl ${isDark ? 'bg-[#d4af35]/10 text-[#d4af35]' : 'bg-blue-600/10 text-blue-600'}`}>
            <Sparkles size={20} />
          </div>
          <div>
            <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Cadastro Inteligente</h3>
            <p className={`text-[10px] uppercase tracking-widest font-bold ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>Atlas Engine v2</p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-zinc-500 transition-colors">
          <X size={20} />
        </button>
      </div>

      <div className="p-6">
        {step === "input" ? (
          <div className="space-y-6">
            <div className={`p-1 flex rounded-2xl ${isDark ? 'bg-black/40' : 'bg-slate-100'}`}>
              {[
                { id: "url", label: "Vistanet / Link", icon: Globe },
                { id: "voice", label: "Voz / Descrição", icon: Mic }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                    activeTab === tab.id 
                      ? isDark ? 'bg-white/10 text-white' : 'bg-white text-slate-900 shadow-sm'
                      : isDark ? 'text-zinc-500 hover:text-zinc-300' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <tab.icon size={14} />
                  {tab.label}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {activeTab === "url" ? (
                <motion.form 
                  key="url"
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
                  onSubmit={handleUrlSubmit} className="space-y-4"
                >
                  <p className="text-xs text-zinc-500 leading-relaxed">Cole o link completo da Vistanet ou de qualquer imobiliária para raspagem automática.</p>
                  <div className="relative">
                    <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                    <input 
                      type="url" required value={url} onChange={e => setUrl(e.target.value)}
                      placeholder="https://vistanet.com.br/imovel/123"
                      className={`w-full pl-12 pr-4 py-4 rounded-2xl border text-sm transition-all focus:outline-none focus:ring-4 ${
                        isDark 
                          ? 'bg-black/60 border-white/10 text-white focus:border-[#d4af35]/50 focus:ring-[#d4af35]/10' 
                          : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500/50 focus:ring-blue-500/10'
                      }`}
                    />
                  </div>
                  <button 
                    disabled={isProcessing || !url.trim()}
                    className="w-full py-4 rounded-2xl bg-[#d4af35] text-[#0a0907] font-bold text-sm hover:brightness-110 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <Database size={18} />}
                    Processar Ativo
                  </button>
                </motion.form>
              ) : (
                <motion.div 
                  key="voice"
                  initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
                  className="space-y-4"
                >
                  <p className="text-xs text-zinc-500 leading-relaxed">Descreva o imóvel naturalmente. Nossa IA extrairá os dados e o endereço automaticamente.</p>
                  <textarea 
                    value={voiceText} onChange={e => setVoiceText(e.target.value)}
                    placeholder="Ex: Apartamento no centro, 3 quartos, sacada, sol da manhã. Condomínio 500 reais. Valor 800 mil."
                    className={`w-full h-32 p-4 rounded-2xl border text-sm transition-all focus:outline-none focus:ring-4 resize-none ${
                        isDark 
                          ? 'bg-black/60 border-white/10 text-white focus:border-[#d4af35]/50 focus:ring-[#d4af35]/10' 
                          : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500/50 focus:ring-blue-500/10'
                      }`}
                  />
                  <button 
                    onClick={handleVoiceSubmit}
                    disabled={isProcessing || !voiceText.trim()}
                    className="w-full py-4 rounded-2xl bg-indigo-500 text-white font-bold text-sm hover:bg-indigo-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <Mic size={18} />}
                    Extração Cognitiva
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className={`p-4 rounded-3xl border ${isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'} flex gap-4`}>
              <div className="w-24 h-24 rounded-2xl bg-zinc-800 shrink-0 border border-white/10 overflow-hidden">
                 {extractedData?.cover_image ? (
                   <img src={extractedData.cover_image} className="w-full h-full object-cover" alt="" />
                 ) : (
                   <div className="w-full h-full flex items-center justify-center text-zinc-600"><Database size={24}/></div>
                 )}
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] uppercase font-bold text-[#d4af35]">Revisão de Cadastro</span>
                <h4 className="text-sm font-bold text-white truncate mb-1">{extractedData?.title || 'Título não definido'}</h4>
                <p className="text-base font-bold text-white">R$ {extractedData?.value?.toLocaleString('pt-BR') || '---'}</p>
                <div className="flex gap-3 mt-2">
                  <div className="text-[10px] text-zinc-500 font-bold uppercase">{extractedData?.area_privativa || 0}m²</div>
                  <div className="text-[10px] text-zinc-500 font-bold uppercase">{extractedData?.bedrooms || 0} Quartos</div>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => setStep("input")}
                className={`flex-1 py-4 rounded-2xl font-bold text-xs ${isDark ? 'bg-white/5 text-white' : 'bg-slate-100 text-slate-700'} hover:bg-white/10`}
              >
                Tentar Outro
              </button>
              <button 
                onClick={handleConfirm}
                disabled={isProcessing}
                className="flex-[2] py-4 rounded-2xl bg-[#d4af35] text-[#0a0907] font-bold text-sm shadow-lg shadow-[#d4af35]/20 flex items-center justify-center gap-2"
              >
                {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                Confirmar e Publicar
              </button>
            </div>
          </div>
        )}
      </div>

      <div className={`px-6 py-4 border-t flex items-center gap-2 ${isDark ? 'bg-white/2 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        <span className={`text-[9px] uppercase font-bold tracking-widest ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
          Direct access to global property network
        </span>
      </div>
    </motion.div>
  )
}
