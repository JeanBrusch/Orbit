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
   const [localMinPrice, setLocalMinPrice] = useState<number>(minPrice || 0)
  const [localMaxPrice, setLocalMaxPrice] = useState<number>(maxPrice || 5000000)
  const [showMobileMenu, setShowMobileMenu] = useState(false)

  const handlePriceRangeCommit = (values: number[]) => {
    onChange({
      minPrice: values[0] <= 0 ? null : values[0],
      maxPrice: values[1] >= 10000000 ? null : values[1],
      bedrooms,
      neighborhoods
    })
  }

  const formatPrice = (value: number) => {
    if (value >= 10000000) return "Sem limite"
    if (value >= 1000000) return `R$ ${(value / 1000000).toFixed(1)}M`
    return `R$ ${(value / 1000).toFixed(0)}k`
  }

  const getPriceLabel = () => {
    if (minPrice === null && maxPrice === null) return "Valor"
    if (minPrice === null) return `Até ${formatPrice(maxPrice!)}`
    if (maxPrice === null) return `A partir ${formatPrice(minPrice!)}`
    return `${(minPrice / 1000000).toFixed(1)}M - ${(maxPrice / 1000000).toFixed(1)}M`
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
            flex items-center justify-center gap-2 px-8 h-[48px] rounded-2xl text-[12px] font-bold font-mono uppercase tracking-[0.2em] border transition-all active:scale-95
            ${hasActiveFilters 
              ? 'bg-[#d4af35] border-[#d4af35] text-black shadow-[0_10px_25px_rgba(212,175,53,0.4)]' 
              : 'bg-black/90 border-[#d4af35]/30 text-[#d4af35] hover:bg-[#d4af35]/10'}
          `}>
            {hasActiveFilters ? 'Filtros Ativos' : 'Refinar Busca'}
            <ChevronDown size={12} className={hasActiveFilters ? "text-black/40" : "text-[#d4af35]/60"} />
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
              className="p-5 rounded-3xl bg-[#0a0907] border-2 border-[#d4af35]/20 shadow-[0_40px_80px_rgba(0,0,0,0.9)] space-y-8"
            >
              <div>
                <div className="flex justify-between items-center mb-6">
                  <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#d4af35] font-bold">Faixa de Investimento</span>
                  <div className="text-right">
                    <p className="text-[13px] font-bold text-white uppercase">{formatPrice(localMinPrice)} - {formatPrice(localMaxPrice)}</p>
                  </div>
                </div>
                <Slider.Root 
                  className="relative flex items-center select-none touch-none w-full h-8"
                  value={[localMinPrice, localMaxPrice]}
                  min={0}
                  max={10000000}
                  step={250000}
                  minStepsBetweenThumbs={1}
                  onValueChange={(val) => {
                    setLocalMinPrice(val[0])
                    setLocalMaxPrice(val[1])
                  }}
                  onValueCommit={handlePriceRangeCommit}
                >
                  <Slider.Track className="bg-white/10 relative grow rounded-full h-1.5">
                    <Slider.Range className="absolute bg-[#d4af35] rounded-full h-full" />
                  </Slider.Track>
                  <Slider.Thumb className="block w-6 h-6 bg-white border-2 border-[#d4af35] shadow-[0_0_15px_rgba(212,175,53,0.5)] rounded-full focus:outline-none" />
                  <Slider.Thumb className="block w-6 h-6 bg-white border-2 border-[#d4af35] shadow-[0_0_15px_rgba(212,175,53,0.5)] rounded-full focus:outline-none" />
                </Slider.Root>
                <div className="flex justify-between mt-2 text-[9px] font-mono text-white/20 uppercase tracking-tighter">
                  <span>R$ 0</span>
                  <span>Sem Limite</span>
                </div>
              </div>

              <div>
                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#d4af35] block mb-4 font-bold">Dormitórios</span>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 3, 4].map(num => (
                    <button
                      key={num}
                      onClick={() => onChange({ minPrice, maxPrice, neighborhoods, bedrooms: bedrooms === num ? null : num })}
                      className={`
                        h-12 flex items-center justify-center rounded-xl font-mono text-xs font-bold transition-all border
                        ${bedrooms === num || (bedrooms !== null && num >= bedrooms && bedrooms === 4) 
                          ? 'bg-[#d4af35] border-[#d4af35] text-black shadow-[0_4px_10px_rgba(212,175,53,0.2)]' 
                          : 'bg-white/5 border-white/10 text-white/60 hover:text-white'}
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
                  className="w-full py-4 rounded-xl bg-red-500/10 text-red-400 text-[10px] font-bold uppercase tracking-[0.2em] border border-red-500/30 hover:bg-red-500/20 transition-all"
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
    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
      {/* PRICE PILL */}
      <Popover.Root>
        <Popover.Trigger asChild>
          <button className={`
            flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold font-mono uppercase tracking-wider border transition-all
            ${(minPrice !== null || maxPrice !== null)
              ? 'bg-[#d4af35] border-[#d4af35] text-black shadow-lg scale-105 z-10' 
              : 'bg-black/60 border-white/10 text-white/60 hover:text-white hover:border-white/30'}
          `}>
            {getPriceLabel()}
            <ChevronDown size={10} className="opacity-40" />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content align="start" sideOffset={8} className="z-[150] outline-none">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-64 p-5 rounded-2xl bg-[#0a0907] border border-[#d4af35]/30 shadow-2xl">
              <div className="flex justify-between items-center mb-5">
                <span className="text-[9px] font-mono text-[#d4af35] uppercase font-bold tracking-widest">Faixa de Valor</span>
              </div>
              <div className="mb-2 text-center">
                <span className="text-[11px] font-bold text-white uppercase">{formatPrice(localMinPrice)} - {formatPrice(localMaxPrice)}</span>
              </div>
              <Slider.Root 
                className="relative flex items-center w-full h-6"
                value={[localMinPrice, localMaxPrice]} min={0} max={10000000} step={250000}
                onValueChange={(val) => {
                  setLocalMinPrice(val[0])
                  setLocalMaxPrice(val[1])
                }} 
                onValueCommit={handlePriceRangeCommit}
              >
                <Slider.Track className="bg-white/10 relative grow rounded-full h-1">
                  <Slider.Range className="absolute bg-[#d4af35] rounded-full h-full" />
                </Slider.Track>
                <Slider.Thumb className="block w-4 h-4 bg-white border border-[#d4af35] rounded-full focus:outline-none cursor-pointer" />
                <Slider.Thumb className="block w-4 h-4 bg-white border border-[#d4af35] rounded-full focus:outline-none cursor-pointer" />
              </Slider.Root>
            </motion.div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      {/* BEDROOMS PILL */}
      <Popover.Root>
        <Popover.Trigger asChild>
          <button className={`
            flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold font-mono uppercase tracking-wider border transition-all
            ${bedrooms !== null 
              ? 'bg-[#d4af35] border-[#d4af35] text-black shadow-lg scale-105 z-10' 
              : 'bg-black/60 border-white/10 text-white/60 hover:text-white hover:border-white/30'}
          `}>
            {getBedroomsLabel()}
            <ChevronDown size={10} className="opacity-40" />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content align="start" sideOffset={8} className="z-[150] outline-none">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="p-2 rounded-2xl bg-[#0a0907] border border-[#d4af35]/30 shadow-2xl flex gap-1.5">
              {[1, 2, 3, 4].map(num => (
                <button
                  key={num}
                  onClick={() => onChange({ minPrice, maxPrice, neighborhoods, bedrooms: bedrooms === num ? null : num })}
                  className={`w-10 h-10 flex items-center justify-center rounded-xl font-mono text-xs font-bold transition-all ${
                    bedrooms === num || (bedrooms !== null && num >= bedrooms && bedrooms === 4) 
                      ? 'bg-[#d4af35] text-black' 
                      : 'bg-white/5 text-white/40 hover:text-white hover:bg-white/10'
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
            flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold font-mono uppercase tracking-wider border transition-all
            ${neighborhoods.length > 0
              ? 'bg-[#d4af35] border-[#d4af35] text-black shadow-lg scale-105 z-10' 
              : 'bg-black/60 border-white/10 text-white/60 hover:text-white hover:border-white/30'}
          `}>
            Bairros
            <ChevronDown size={10} className="opacity-40" />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content align="start" sideOffset={8} className="z-[150] outline-none">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-64 p-2 rounded-2xl bg-[#0a0907] border border-[#d4af35]/30 shadow-2xl">
              <div className="max-h-64 overflow-y-auto no-scrollbar grid grid-cols-1 gap-1">
                {AVAILABLE_NEIGHBORHOODS.map(n => (
                  <button
                    key={n}
                    onClick={() => toggleNeighborhood(n)}
                    className="flex justify-between items-center px-4 py-3 rounded-xl hover:bg-white/5 transition-colors text-left"
                  >
                    <span className={`text-xs font-sans ${neighborhoods.includes(n) ? 'text-[#d4af35] font-bold' : 'text-white/50'}`}>
                      {n}
                    </span>
                    {neighborhoods.includes(n) && <div className="w-2 h-2 rounded-full bg-[#d4af35] shadow-[0_0_8px_rgba(212,175,53,0.5)]" />}
                  </button>
                ))}
              </div>
            </motion.div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      {/* CLEAR */}
      {hasActiveFilters && (
        <button onClick={clearAll} className="w-8 h-8 rounded-full bg-red-500/20 text-red-500 border border-red-500/30 hover:bg-red-500/30 flex items-center justify-center transition-all shadow-lg active:scale-95">
          <X size={12} />
        </button>
      )}
    </div>
  )
}
