"use client"

import React, { useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import * as Slider from '@radix-ui/react-slider'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, DollarSign, BedDouble, MapPin, X } from 'lucide-react'

interface AdvancedFiltersProps {
  minPrice: number | null
  maxPrice: number | null
  bedrooms: number | null
  neighborhoods: string[]
  onChange: (filters: {
    minPrice: number | null
    maxPrice: number | null
    bedrooms: number | null
    neighborhoods: string[]
  }) => void
}

const AVAILABLE_NEIGHBORHOODS = [
  "Centro", 
  "Moinhos de Vento", 
  "Bela Vista", 
  "Rio Branco", 
  "Petrópolis", 
  "Mont'Serrat",
  "Auxiliadora",
  "Bom Fim",
  "Menino Deus",
  "Três Figueiras"
]

export function AdvancedFilters({
  minPrice,
  maxPrice,
  bedrooms,
  neighborhoods,
  onChange
}: AdvancedFiltersProps) {
  
  // Local states for sliders so they don't lag while dragging
  const [localMaxPrice, setLocalMaxPrice] = useState<number>(maxPrice || 5000000)

  const handlePriceCommit = (value: number[]) => {
    // value[0] is the max price
    onChange({
      minPrice,
      maxPrice: value[0] >= 10000000 ? null : value[0], // If rightmost, consider no limit
      bedrooms,
      neighborhoods
    })
  }

  const formatPrice = (value: number) => {
    if (value >= 10000000) return "Sem limite"
    if (value >= 1000000) return `Até R$ ${(value / 1000000).toFixed(1)}M`
    return `Até R$ ${(value / 1000).toFixed(0)}k`
  }

  const getPriceLabel = () => {
    if (maxPrice === null) return "Qualquer Valor"
    return formatPrice(maxPrice)
  }

  const getBedroomsLabel = () => {
    if (bedrooms === null) return "Quartos"
    return `${bedrooms}+ Dorms`
  }

  const toggleNeighborhood = (n: string) => {
    const updated = neighborhoods.includes(n)
      ? neighborhoods.filter(x => x !== n)
      : [...neighborhoods, n]
    
    onChange({ minPrice, maxPrice, bedrooms, neighborhoods: updated })
  }

  const clearAll = () => {
    onChange({ minPrice: null, maxPrice: null, bedrooms: null, neighborhoods: [] })
  }

  const hasActiveFilters = maxPrice !== null || minPrice !== null || bedrooms !== null || neighborhoods.length > 0

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar -mb-2">
      
      {/* PRICE PILL */}
      <Popover.Root>
        <Popover.Trigger asChild>
          <button className={`
            flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium font-sans border transition-all
            ${maxPrice !== null 
              ? 'bg-[#2ec5ff]/10 border-[#2ec5ff]/30 text-[#e6eef6] shadow-[0_0_10px_rgba(46,197,255,0.1)]' 
              : 'bg-[#0b1220]/80 border-white/5 text-[#94a3b8] hover:bg-white/5 hover:text-[#e6eef6]'}
          `}>
            <DollarSign size={14} className={maxPrice !== null ? "text-[#2ec5ff]" : "text-[#94a3b8]"} />
            {getPriceLabel()}
            <ChevronDown size={12} className="opacity-50 ml-0.5" />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content 
            align="start" 
            sideOffset={8}
            className="z-[100] outline-none"
          >
            <motion.div 
              initial={{ opacity: 0, y: -5, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="w-64 p-4 rounded-2xl bg-[#0b1220]/95 backdrop-blur-xl border border-white/10 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-4">
                <span className="text-xs font-mono uppercase tracking-widest text-[#94a3b8]">Faixa de Valor</span>
                <span className="text-sm font-sans font-medium text-[#e6eef6]">{formatPrice(localMaxPrice)}</span>
              </div>
              
              <Slider.Root 
                className="relative flex items-center select-none touch-none w-full h-5"
                value={[localMaxPrice]}
                max={10000000}
                step={250000}
                onValueChange={(val) => setLocalMaxPrice(val[0])}
                onValueCommit={handlePriceCommit}
              >
                <Slider.Track className="bg-white/10 relative grow rounded-full h-1.5">
                  <Slider.Range className="absolute bg-[#2ec5ff] rounded-full h-full" />
                </Slider.Track>
                <Slider.Thumb 
                  className="block w-4 h-4 bg-white shadow-[0_0_10px_rgba(46,197,255,0.5)] rounded-full hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#2ec5ff]/50 transition-colors cursor-grab active:cursor-grabbing" 
                />
              </Slider.Root>
              
              <div className="flex justify-between mt-2 text-[10px] font-mono text-[#94a3b8]/50">
                <span>R$ 0</span>
                <span>Ilimitado</span>
              </div>
            </motion.div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      {/* BEDROOMS PILL */}
      <Popover.Root>
        <Popover.Trigger asChild>
          <button className={`
            flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium font-sans border transition-all
            ${bedrooms !== null 
              ? 'bg-[#2ec5ff]/10 border-[#2ec5ff]/30 text-[#e6eef6] shadow-[0_0_10px_rgba(46,197,255,0.1)]' 
              : 'bg-[#0b1220]/80 border-white/5 text-[#94a3b8] hover:bg-white/5 hover:text-[#e6eef6]'}
          `}>
            <BedDouble size={14} className={bedrooms !== null ? "text-[#2ec5ff]" : "text-[#94a3b8]"} />
            {getBedroomsLabel()}
            <ChevronDown size={12} className="opacity-50 ml-0.5" />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content 
            align="start" 
            sideOffset={8}
            className="z-[100] outline-none"
          >
            <motion.div 
              initial={{ opacity: 0, y: -5, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="p-2 rounded-2xl bg-[#0b1220]/95 backdrop-blur-xl border border-white/10 shadow-2xl flex gap-1"
            >
              {[1, 2, 3, 4].map(num => (
                <button
                  key={num}
                  onClick={() => onChange({ minPrice, maxPrice, neighborhoods, bedrooms: bedrooms === num ? null : num })}
                  className={`
                    w-10 h-10 flex items-center justify-center rounded-xl font-sans text-sm font-medium transition-all
                    ${bedrooms === num || (bedrooms !== null && num >= bedrooms && bedrooms === 4) 
                      ? 'bg-[#2ec5ff] text-[#05060a]' 
                      : 'bg-transparent text-[#94a3b8] hover:bg-white/5 hover:text-[#e6eef6]'}
                  `}
                >
                  {num}{num === 4 ? '+' : ''}
                </button>
              ))}
            </motion.div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      {/* NEIGHBORHOODS PILL */}
      <Popover.Root>
        <Popover.Trigger asChild>
          <button className={`
            flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium font-sans border transition-all
            ${neighborhoods.length > 0
              ? 'bg-[#2ec5ff]/10 border-[#2ec5ff]/30 text-[#e6eef6] shadow-[0_0_10px_rgba(46,197,255,0.1)]' 
              : 'bg-[#0b1220]/80 border-white/5 text-[#94a3b8] hover:bg-white/5 hover:text-[#e6eef6]'}
          `}>
            <MapPin size={14} className={neighborhoods.length > 0 ? "text-[#2ec5ff]" : "text-[#94a3b8]"} />
            {neighborhoods.length === 0 ? "Bairros" : `${neighborhoods.length} Bairro${neighborhoods.length > 1 ? 's' : ''}`}
            <ChevronDown size={12} className="opacity-50 ml-0.5" />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content 
            align="start" 
            sideOffset={8}
            className="z-[100] outline-none"
          >
            <motion.div 
              initial={{ opacity: 0, y: -5, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="w-64 p-2 rounded-2xl bg-[#0b1220]/95 backdrop-blur-xl border border-white/10 shadow-2xl"
            >
              <div className="max-h-60 overflow-y-auto custom-scrollbar pr-1 grid grid-cols-1 gap-1">
                {AVAILABLE_NEIGHBORHOODS.map(n => (
                  <button
                    key={n}
                    onClick={() => toggleNeighborhood(n)}
                    className="flex justify-between items-center px-3 py-2 rounded-xl hover:bg-white/5 transition-colors text-left group"
                  >
                    <span className={`text-sm font-sans ${neighborhoods.includes(n) ? 'text-[#2ec5ff] font-medium' : 'text-[#94a3b8] group-hover:text-[#e6eef6]'}`}>
                      {n}
                    </span>
                    {neighborhoods.includes(n) && (
                      <div className="w-4 h-4 rounded-full bg-[#2ec5ff]/20 flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#2ec5ff]" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      {/* CLEAR FILTERS */}
      <AnimatePresence>
        {hasActiveFilters && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, width: 0 }}
            animate={{ opacity: 1, scale: 1, width: 'auto' }}
            exit={{ opacity: 0, scale: 0.8, width: 0 }}
            onClick={clearAll}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-colors ml-1 shrink-0"
            title="Limpar filtros"
          >
            <X size={14} />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}
