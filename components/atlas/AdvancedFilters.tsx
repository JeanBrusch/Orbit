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
  isMobileCompact?: boolean
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
  isMobileCompact = false,
  onChange
}: AdvancedFiltersProps) {
  
  const [localMaxPrice, setLocalMaxPrice] = useState<number>(maxPrice || 5000000)
  const [showMobileMenu, setShowMobileMenu] = useState(false)

  const handlePriceCommit = (value: number[]) => {
    onChange({
      minPrice,
      maxPrice: value[0] >= 10000000 ? null : value[0],
      bedrooms,
      neighborhoods
    })
  }

  const formatPrice = (value: number) => {
    if (value >= 10000000) return "Sem limite"
    if (value >= 1000000) return `Até ${(value / 1000000).toFixed(1)}M`
    return `Até ${(value / 1000).toFixed(0)}k`
  }

  const getPriceLabel = () => {
    if (maxPrice === null) return "Valor"
    return formatPrice(maxPrice)
  }

  const getBedroomsLabel = () => {
    if (bedrooms === null) return "Dorms"
    return `${bedrooms}+`
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

  if (isMobileCompact) {
    return (
      <Popover.Root open={showMobileMenu} onOpenChange={setShowMobileMenu}>
        <Popover.Trigger asChild>
          <button className={`
            flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[11px] font-bold font-mono uppercase tracking-widest border transition-all
            ${hasActiveFilters 
              ? 'bg-orange-500/10 border-orange-500/40 text-orange-400' 
              : 'bg-black/20 border-white/10 text-white/40 hover:text-white/70'}
          `}>
            {hasActiveFilters ? 'Filtros Ativos' : 'Refinar Busca'}
            <ChevronDown size={10} className="opacity-50" />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content 
            align="center" 
            sideOffset={12}
            className="z-[150] outline-none px-4 w-screen max-w-xs"
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-5 rounded-3xl bg-[#0a0907]/95 backdrop-blur-2xl border border-white/10 shadow-[0_40px_80px_rgba(0,0,0,0.8)] space-y-6"
            >
              <div>
                <div className="flex justify-between items-center mb-4">
                  <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#d4af35]">Investimento</span>
                  <span className="text-sm font-sans font-bold text-white">{formatPrice(localMaxPrice)}</span>
                </div>
                <Slider.Root 
                  className="relative flex items-center select-none touch-none w-full h-8"
                  value={[localMaxPrice]}
                  max={10000000}
                  step={250000}
                  onValueChange={(val) => setLocalMaxPrice(val[0])}
                  onValueCommit={handlePriceCommit}
                >
                  <Slider.Track className="bg-white/10 relative grow rounded-full h-1">
                    <Slider.Range className="absolute bg-[#d4af35] rounded-full h-full" />
                  </Slider.Track>
                  <Slider.Thumb 
                    className="block w-5 h-5 bg-white shadow-[0_0_15px_rgba(212,175,53,0.5)] rounded-full focus:outline-none" 
                  />
                </Slider.Root>
              </div>

              <div>
                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#d4af35] block mb-3">Dormitórios</span>
                <div className="flex gap-2">
                  {[1, 2, 3, 4].map(num => (
                    <button
                      key={num}
                      onClick={() => onChange({ minPrice, maxPrice, neighborhoods, bedrooms: bedrooms === num ? null : num })}
                      className={`
                        flex-1 h-10 flex items-center justify-center rounded-xl font-mono text-xs font-bold transition-all
                        ${bedrooms === num || (bedrooms !== null && num >= bedrooms && bedrooms === 4) 
                          ? 'bg-[#d4af35] text-black shadow-[0_0_15px_rgba(212,175,53,0.3)]' 
                          : 'bg-white/5 text-white/40 hover:text-white'}
                      `}
                    >
                      {num}{num === 4 ? '+' : ''}
                    </button>
                  ))}
                </div>
              </div>

              {hasActiveFilters && (
                <button 
                  onClick={clearAll}
                  className="w-full py-3 rounded-xl bg-red-500/10 text-red-400 text-[10px] font-bold uppercase tracking-widest border border-red-500/20"
                >
                  Limpar Todos os Filtros
                </button>
              )}
            </motion.div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    )
  }

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar shrink-0">
      {/* PRICE PILL */}
      <Popover.Root>
        <Popover.Trigger asChild>
          <button className={`
            flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold font-mono uppercase tracking-wider border transition-all
            ${maxPrice !== null 
              ? 'bg-[#d4af35]/10 border-[#d4af35]/40 text-[#d4af35]' 
              : 'bg-black/20 border-white/5 text-white/30 hover:text-white/60'}
          `}>
            {getPriceLabel()}
            <ChevronDown size={10} className="opacity-30" />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content align="start" sideOffset={6} className="z-[150] outline-none">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-56 p-4 rounded-xl bg-[#0a0907]/95 backdrop-blur-xl border border-white/10 shadow-2xl">
              <div className="flex justify-between items-center mb-3">
                <span className="text-[9px] font-mono text-white/40 uppercase">Até</span>
                <span className="text-xs font-bold text-white">{formatPrice(localMaxPrice)}</span>
              </div>
              <Slider.Root 
                className="relative flex items-center w-full h-4"
                value={[localMaxPrice]} max={10000000} step={250000}
                onValueChange={(val) => setLocalMaxPrice(val[0])} onValueCommit={handlePriceCommit}
              >
                <Slider.Track className="bg-white/10 relative grow rounded-full h-1">
                  <Slider.Range className="absolute bg-[#d4af35] rounded-full h-full" />
                </Slider.Track>
                <Slider.Thumb className="block w-3 h-3 bg-white rounded-full focus:outline-none" />
              </Slider.Root>
            </motion.div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      {/* BEDROOMS PILL */}
      <Popover.Root>
        <Popover.Trigger asChild>
          <button className={`
            flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold font-mono uppercase tracking-wider border transition-all
            ${bedrooms !== null 
              ? 'bg-[#d4af35]/10 border-[#d4af35]/40 text-[#d4af35]' 
              : 'bg-black/20 border-white/5 text-white/30 hover:text-white/60'}
          `}>
            {getBedroomsLabel()}
            <ChevronDown size={10} className="opacity-30" />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content align="start" sideOffset={6} className="z-[150] outline-none">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="p-1.5 rounded-xl bg-[#0a0907]/95 backdrop-blur-xl border border-white/10 shadow-2xl flex gap-1">
              {[1, 2, 3, 4].map(num => (
                <button
                  key={num}
                  onClick={() => onChange({ minPrice, maxPrice, neighborhoods, bedrooms: bedrooms === num ? null : num })}
                  className={`w-9 h-9 flex items-center justify-center rounded-lg font-mono text-xs font-bold transition-all ${
                    bedrooms === num || (bedrooms !== null && num >= bedrooms && bedrooms === 4) 
                      ? 'bg-[#d4af35] text-black' 
                      : 'bg-transparent text-white/40 hover:bg-white/5'
                  }`}
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
            flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold font-mono uppercase tracking-wider border transition-all
            ${neighborhoods.length > 0
              ? 'bg-[#d4af35]/10 border-[#d4af35]/40 text-[#d4af35]' 
              : 'bg-black/20 border-white/5 text-white/30 hover:text-white/60'}
          `}>
            Bairros
            <ChevronDown size={10} className="opacity-30" />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content align="start" sideOffset={6} className="z-[150] outline-none">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-56 p-1.5 rounded-xl bg-[#0a0907]/95 backdrop-blur-xl border border-white/10 shadow-2xl">
              <div className="max-h-60 overflow-y-auto no-scrollbar grid grid-cols-1 gap-0.5">
                {AVAILABLE_NEIGHBORHOODS.map(n => (
                  <button
                    key={n}
                    onClick={() => toggleNeighborhood(n)}
                    className="flex justify-between items-center px-3 py-2 rounded-lg hover:bg-white/5 transition-colors text-left"
                  >
                    <span className={`text-xs font-sans ${neighborhoods.includes(n) ? 'text-[#d4af35] font-bold' : 'text-white/40'}`}>
                      {n}
                    </span>
                    {neighborhoods.includes(n) && <div className="w-1.5 h-1.5 rounded-full bg-[#d4af35]" />}
                  </button>
                ))}
              </div>
            </motion.div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      {/* CLEAR */}
      {hasActiveFilters && (
        <button onClick={clearAll} className="w-6 h-6 rounded-full bg-red-500/10 text-red-400 hover:bg-red-500/20 flex items-center justify-center transition-colors">
          <X size={10} />
        </button>
      )}
    </div>
  )
}
