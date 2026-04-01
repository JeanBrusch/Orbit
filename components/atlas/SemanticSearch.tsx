"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Search, Users, Building2, Command, X, Sparkles, ArrowRight, CornerDownLeft } from "lucide-react"

interface SemanticSearchProps {
  isOpen: boolean
  onClose: () => void
  isDark: boolean
  leads: any[]
  properties: any[]
  onSelectLead: (id: string) => void
  onSelectProperty: (property: any) => void
}

export const SemanticSearch = ({ isOpen, onClose, isDark, leads, properties, onSelectLead, onSelectProperty }: SemanticSearchProps) => {
  const [query, setQuery] = useState("")
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const filteredLeads = leads?.filter(l => 
    l.name?.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 3) || []

  const filteredProperties = properties?.filter(p => {
    const q = query.toLowerCase()
    if (!q) return true
    
    let matchesCriteria = false
    let hasExplicitFilter = false

    // 1. Check for bedrooms (e.g. "3 dormitorios", "2 quartos")
    const bedMatch = q.match(/(\d+)\s*(dormitorios|dormitórios|quartos|quarto)/)
    if (bedMatch) {
      hasExplicitFilter = true
      const minBeds = parseInt(bedMatch[1])
      if ((p.bedrooms || 0) >= minBeds) matchesCriteria = true
      else return false // If specifically asked for N beds and doesn't have it, filter out
    }

    // 2. Check for price (e.g. "ate 900 mil", "menos de 1 milhao")
    const priceMatch = q.match(/(ate|até|menos|abaixo|maximo|máximo)\s*(de|que)?\s*(\d+)\s*(mil|milhao|milhão)?/)
    if (priceMatch) {
      hasExplicitFilter = true
      let limit = parseInt(priceMatch[3])
      if (priceMatch[4]?.includes('milhao') || priceMatch[4]?.includes('milhão')) limit *= 1000000
      else if (priceMatch[4] === 'mil') limit *= 1000
      
      if ((p.value || 0) <= limit) matchesCriteria = true
      else return false // If specifically asked for price limit and exceeds it, filter out
    }

    // 3. Standard string matching (name, code, neighborhood)
    const stringMatch = (
      p.title?.toLowerCase().includes(q) || 
      p.internal_code?.toLowerCase().includes(q) ||
      p.neighborhood?.toLowerCase().includes(q) ||
      p.internal_name?.toLowerCase().includes(q)
    )

    if (stringMatch) return true
    if (hasExplicitFilter && matchesCriteria) return true
    
    return false
  }).slice(0, 5) || []

  const results = [
    ...filteredLeads.map(l => ({ type: 'lead', data: l })),
    ...filteredProperties.map(p => ({ type: 'property', data: p }))
  ]

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    } else {
      setQuery("")
      setSelectedIndex(0)
    }
  }, [isOpen])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      setSelectedIndex(prev => Math.min(prev + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      setSelectedIndex(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter') {
      const selected = results[selectedIndex]
      if (selected) {
        if (selected.type === 'lead') onSelectLead(selected.data.id)
        else onSelectProperty(selected.data)
        onClose()
      }
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh]">
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
          />

          {/* Search Box */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            className={`relative w-full max-w-2xl mx-4 rounded-3xl shadow-2xl border overflow-hidden ${
              isDark ? 'bg-[#12121A] border-white/10' : 'bg-white border-slate-200'
            }`}
            onKeyDown={handleKeyDown}
          >
            {/* Input Surface */}
            <div className={`p-6 flex items-center gap-4 border-b ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
              <Search className={`w-5 h-5 ${isDark ? 'text-white/40' : 'text-slate-400'}`} />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setSelectedIndex(0)
                }}
                placeholder="Busque por lead, bairro, código ou 'apartamento 3 quartos'..."
                className={`flex-1 bg-transparent border-none outline-none text-lg ${isDark ? 'text-white placeholder:text-white/20' : 'text-slate-900 placeholder:text-slate-400'}`}
              />
              <div className="flex items-center gap-1">
                <kbd className={`px-2 py-1 rounded bg-black/20 text-[10px] font-mono opacity-40 ${isDark ? 'text-white' : 'text-slate-500'}`}>ESC</kbd>
              </div>
            </div>

            {/* Results Surface */}
            <div className="max-h-[60vh] overflow-y-auto p-2 custom-scrollbar">
              {results.length > 0 ? (
                <div className="py-2">
                  {results.map((res, i) => {
                    const isSelected = i === selectedIndex
                    return (
                      <div
                        key={`${res.type}-${res.data.id}`}
                        onMouseEnter={() => setSelectedIndex(i)}
                        onClick={() => {
                          if (res.type === 'lead') onSelectLead(res.data.id)
                          else onSelectProperty(res.data)
                          onClose()
                        }}
                        className={`group px-4 py-3 rounded-2xl flex items-center justify-between cursor-pointer transition-all ${
                          isSelected 
                            ? isDark ? 'bg-white/5' : 'bg-slate-100'
                            : 'hover:bg-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                           <div className={`p-2 rounded-xl border transition-colors ${
                             isSelected ? 'border-[#C9A84C]/40 text-[#C9A84C]' : isDark ? 'border-white/5 text-white/30' : 'border-slate-100 text-slate-400'
                           }`}>
                             {res.type === 'lead' ? <Users size={18} /> : <Building2 size={18} />}
                           </div>
                           <div>
                              <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{res.data.name || res.data.title}</p>
                              <p className={`text-[10px] uppercase tracking-widest opacity-40 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                {res.type === 'lead' ? 'Lead Profile' : `${res.data.neighborhood || 'Imóvel'} • ${res.data.internal_code || 'Sem Cód'}`}
                              </p>
                           </div>
                        </div>
                        
                        {isSelected && (
                          <div className="flex items-center gap-2 text-[#C9A84C]">
                             <span className="text-[10px] font-bold uppercase tracking-tighter">Enter</span>
                             <CornerDownLeft size={14} />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="py-12 flex flex-col items-center justify-center opacity-20">
                   <Sparkles size={48} className="mb-4" />
                   <p className="text-sm font-medium">Use a inteligência para navegar</p>
                </div>
              )}
            </div>

            {/* Hint Footer */}
            <div className={`p-4 border-t flex items-center justify-between ${isDark ? 'border-white/5 bg-white/2' : 'border-slate-100 bg-slate-50'}`}>
               <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2 opacity-40">
                     <Command size={12} />
                     <span className="text-[10px] uppercase font-bold tracking-widest">Navegar</span>
                  </div>
                  <div className="flex items-center gap-2 opacity-40">
                     <ArrowRight size={12} />
                     <span className="text-[10px] uppercase font-bold tracking-widest">Abrir</span>
                  </div>
               </div>
               <span className="text-[10px] uppercase font-mono opacity-20">Atlas Cognitive v4.1</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
