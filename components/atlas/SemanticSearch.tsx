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
  onResultsFound?: (propertyIds: string[]) => void
}

export const SemanticSearch = ({ isOpen, onClose, isDark, leads, properties, onSelectLead, onSelectProperty, onResultsFound }: SemanticSearchProps) => {
  const [query, setQuery] = useState("")
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isSearching, setIsSearching] = useState(false)
  const [semanticResults, setSemanticResults] = useState<any[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Enhanced local filtering for instant feedback
  const filteredLeads = leads?.filter(l => 
    l.name?.toLowerCase().includes(query.toLowerCase()) ||
    l.neighborhood?.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 3) || []

  const filteredProperties = properties?.filter(p => {
    const q = query.toLowerCase()
    if (!q) return true
    
    // Quick match for local UI
    return (
      p.title?.toLowerCase().includes(q) || 
      p.internal_code?.toLowerCase().includes(q) ||
      p.neighborhood?.toLowerCase().includes(q)
    )
  }).slice(0, 5) || []

  // Combine results: Instant local + Semantic (if available)
  const results = semanticResults.length > 0 
    ? semanticResults
    : [
        ...filteredLeads.map(l => ({ type: 'lead', data: l })),
        ...filteredProperties.map(p => ({ type: 'property', data: p }))
      ]

  // Actual Semantic Search Trigger (Debounced)
  useEffect(() => {
    if (query.length < 3) {
      setSemanticResults([])
      return
    }

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true)
      try {
        const response = await fetch('/api/atlas/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query })
        })
        const data = await response.json()
        
        if (data.matchingIds || data.matchingLeadIds) {
          const matchedProps = properties.filter(p => data.matchingIds?.includes(p.id))
          const matchedLeads = leads.filter(l => data.matchingLeadIds?.includes(l.id))
          
          const combined = [
            ...matchedLeads.map(l => ({ type: 'lead', data: l })),
            ...matchedProps.map(p => ({ type: 'property', data: p }))
          ]

          setSemanticResults(combined)
          
          if (onResultsFound) {
            onResultsFound(data.matchingIds || [])
          }
        }
      } catch (error) {
        console.error("Semantic search failed:", error)
      } finally {
        setIsSearching(false)
      }
    }, 600)

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    }
  }, [query])

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
                {isSearching ? (
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="p-1"
                  >
                    <Sparkles size={16} className="text-[#C9A84C]" />
                  </motion.div>
                ) : (
                  <kbd className={`px-2 py-1 rounded bg-black/20 text-[10px] font-mono opacity-40 ${isDark ? 'text-white' : 'text-slate-500'}`}>ESC</kbd>
                )}
              </div>
            </div>

            {/* Results Surface */}
            <div className="max-h-[60vh] overflow-y-auto p-2 custom-scrollbar">
              {isSearching && results.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center">
                   <div className="relative mb-6">
                      <motion.div 
                        animate={{ rotate: 360, scale: [1, 1.1, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="absolute -inset-4 bg-[#C9A84C]/10 blur-xl rounded-full"
                      />
                      <Sparkles size={40} className="text-[#C9A84C] relative z-10" />
                   </div>
                   <p className={`text-sm font-medium ${isDark ? 'text-white/60' : 'text-slate-500'} animate-pulse`}>
                      Atlas Cognitive está analisando sua consulta...
                   </p>
                </div>
              ) : results.length > 0 ? (
                <div className="py-2">
                  {results.slice(0, 10).map((res, i) => {
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
                            ? isDark ? 'bg-white/5 border border-white/5 shadow-inner' : 'bg-slate-100 border border-slate-200'
                            : 'border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                           <div className={`p-2.5 rounded-xl border transition-all duration-300 ${
                             isSelected ? 'border-[#C9A84C]/40 bg-[#C9A84C]/10 text-[#C9A84C] scale-110 shadow-lg' : isDark ? 'border-white/5 bg-white/2 text-white/30' : 'border-slate-100 bg-slate-50 text-slate-400'
                           }`}>
                             {res.type === 'lead' ? <Users size={18} /> : <Building2 size={18} />}
                           </div>
                           <div className="flex flex-col">
                              <p className={`text-sm font-bold transition-colors ${isSelected ? (isDark ? 'text-white' : 'text-slate-900') : (isDark ? 'text-white/60' : 'text-slate-600')}`}>
                                {res.type === 'lead' ? res.data.name : (res.data.title || res.data.internal_name || "Imóvel sem título")}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className={`text-[10px] uppercase font-mono tracking-wider opacity-40 ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                                  {res.type === 'lead' ? 'Lead Profile' : (res.data.neighborhood || "Bairro não informado")}
                                </span>
                                {res.type === 'property' && res.data.value && (
                                  <>
                                    <span className="w-1 h-1 rounded-full bg-[#C9A84C]/40" />
                                    <span className="text-[10px] font-bold text-[#C9A84C]">
                                      R$ {res.data.value.toLocaleString('pt-BR')}
                                    </span>
                                  </>
                                )}
                              </div>
                           </div>
                        </div>
                        
                        {isSelected && (
                          <div className="flex items-center gap-3">
                             <div className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest ${isDark ? 'bg-white/5 text-white/40' : 'bg-slate-200 text-slate-500'}`}>
                               Abrir no Atlas
                             </div>
                             <CornerDownLeft size={14} className="text-[#C9A84C]" />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="py-16 flex flex-col items-center justify-center opacity-20">
                   <div className="w-12 h-12 rounded-full border-2 border-dashed border-current mb-4 flex items-center justify-center">
                     <Search size={20} />
                   </div>
                   <p className="text-xs font-mono uppercase tracking-[0.2em]">Cognitive Insight Required</p>
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
