"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Building2, ChevronLeft, ChevronRight } from "lucide-react"

interface PropertyCarouselProps {
  photos: string[]
  isDark: boolean
  height?: string
}

export const PropertyCarousel = ({ photos, isDark, height = "h-full" }: PropertyCarouselProps) => {
  const [index, setIndex] = useState(0)

  if (!photos || photos.length === 0) {
    return (
      <div className={`absolute inset-0 flex items-center justify-center ${isDark ? 'bg-zinc-900 text-[#d4af35]/20' : 'bg-slate-100 text-[var(--orbit-glow)]/20'} ${height}`}>
        <Building2 className="w-8 h-8"/>
      </div>
    )
  }

  const next = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIndex((prev) => (prev < photos.length - 1 ? prev + 1 : 0))
  }

  const prev = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIndex((prev) => (prev > 0 ? prev - 1 : photos.length - 1))
  }

  return (
    <div className={`relative w-full overflow-hidden group/carousel ${height}`}>
      <AnimatePresence initial={false} mode="wait">
        <motion.div
          key={index}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.2}
          onDragEnd={(_, info) => {
            if (info.offset.x < -50) next(new MouseEvent('click') as any)
            if (info.offset.x > 50) prev(new MouseEvent('click') as any)
          }}
          className="absolute inset-0 bg-cover bg-center cursor-grab active:cursor-grabbing"
          style={{ backgroundImage: `url(${photos[index]})` }}
        />
      </AnimatePresence>

      {/* Navigation Areas (for Desktop click) */}
      <div className="absolute inset-0 flex pointer-events-none">
        <div 
          className="flex-1 cursor-pointer pointer-events-auto" 
          onClick={prev}
        />
        <div 
          className="flex-1 cursor-pointer pointer-events-auto" 
          onClick={next}
        />
      </div>

      {/* Navigation Arrows (Visible on hover) */}
      <div className="absolute inset-0 flex items-center justify-between px-2 opacity-0 group-hover/carousel:opacity-100 transition-opacity pointer-events-none">
        <button 
          onClick={prev}
          className="p-1 rounded-full bg-black/40 text-white backdrop-blur-md pointer-events-auto hover:bg-black/60 transition-all"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button 
          onClick={next}
          className="p-1 rounded-full bg-black/40 text-white backdrop-blur-md pointer-events-auto hover:bg-black/60 transition-all"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Indicators */}
      <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5 z-20 pointer-events-none">
        {photos.slice(0, 8).map((_, i) => (
          <div 
            key={i} 
            className={`w-1.5 h-1.5 rounded-full transition-all ${
              i === (index % 8) 
                ? 'bg-white scale-125' 
                : 'bg-white/30'
            }`} 
          />
        ))}
      </div>
    </div>
  )
}
