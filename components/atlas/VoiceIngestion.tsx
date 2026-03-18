"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Mic, Send, X, Loader2, Sparkles, Check, Database } from "lucide-react"
import { useTheme } from "next-themes"

interface VoiceIngestionProps {
  onDataExtracted: (data: any) => void
  onClose: () => void
}

export default function VoiceIngestion({ onDataExtracted, onClose }: VoiceIngestionProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const [text, setText] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleProcess = async () => {
    if (!text.trim()) return
    
    setIsProcessing(true)
    setError(null)
    
    try {
      const response = await fetch('/api/atlas/ingest-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      })
      
      if (!response.ok) throw new Error('Falha ao processar descrição')
      
      const data = await response.json()
      onDataExtracted(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col ${
        isDark ? 'bg-[#0a0a0c] border-white/10' : 'bg-[var(--orbit-bg)] border-[var(--orbit-line)]'
      }`}
    >
      <div className={`p-4 border-b flex items-center justify-between ${isDark ? 'border-white/5 bg-white/2' : 'border-[var(--orbit-line)] bg-[var(--orbit-bg-secondary)]'}`}>
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-lg ${isDark ? 'bg-indigo-500/20 text-indigo-400' : 'bg-[var(--orbit-glow)]/10 text-[var(--orbit-glow)]'}`}>
            <Mic size={18} />
          </div>
          <div>
            <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-[var(--orbit-text)]'}`}>Cadastro Cognitivo</h3>
            <p className={`text-[10px] uppercase tracking-widest ${isDark ? 'text-zinc-500' : 'text-[var(--orbit-text-muted)]'}`}>Powered by OpenAI</p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-zinc-500 transition-colors">
          <X size={18} />
        </button>
      </div>

      <div className="p-6 space-y-4">
        <p className={`text-xs leading-relaxed ${isDark ? 'text-zinc-400' : 'text-[var(--orbit-text-muted)]'}`}>
          Dite ou descreva o imóvel naturalmente. A IA extrairá bairro, condomínio, valores e características automaticamente.
        </p>

        <div className="relative">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder='Ex: "Apartamento no centro, 3 quartos, sendo 2 suítes, 120 metros. Valor 800 mil. Tem piscina e sacada gourmet."'
            className={`w-full h-32 border rounded-xl p-4 text-sm transition-all resize-none focus:outline-none ${
              isDark 
                ? 'bg-black/40 border-white/10 text-white placeholder:text-zinc-700 focus:border-indigo-500/50' 
                : 'bg-[var(--orbit-bg)] border-[var(--orbit-line)] text-[var(--orbit-text)] placeholder:text-[var(--orbit-text-muted)] focus:border-[var(--orbit-glow)]/50'
            }`}
          />
          
          <div className="absolute bottom-3 right-3 flex items-center gap-2">
             {text && !isProcessing && (
               <button 
                onClick={() => setText("")}
                className="text-[10px] text-zinc-600 hover:text-zinc-400 font-medium uppercase tracking-tighter"
               >
                 Limpar
               </button>
             )}
          </div>
        </div>

        {error && (
          <p className="text-[10px] text-red-400 font-medium bg-red-400/10 p-2 rounded-lg border border-red-400/20">
            {error}
          </p>
        )}

        <button
          onClick={handleProcess}
          disabled={isProcessing || !text.trim()}
          className={`w-full h-12 rounded-xl flex items-center justify-center gap-2 font-bold text-sm transition-all ${
            isProcessing || !text.trim() 
              ? isDark ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : isDark ? 'bg-indigo-500 text-white hover:bg-indigo-600 shadow-lg shadow-indigo-500/20' : 'bg-[var(--orbit-glow)] text-white hover:brightness-110 shadow-[var(--orbit-shadow)]'
          }`}
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Processando...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>Extrair Dados Inteligentes</span>
            </>
          )}
        </button>
      </div>

      <div className={`px-6 py-4 border-t ${isDark ? 'bg-white/2 border-white/5' : 'bg-[var(--orbit-bg-secondary)] border-[var(--orbit-line)]'}`}>
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className={`text-[10px] uppercase font-medium tracking-widest leading-none ${isDark ? 'text-zinc-500' : 'text-[var(--orbit-text-muted)]'}`}>
            Ready for natural language ingestion
          </span>
        </div>
      </div>
    </motion.div>
  )
}
