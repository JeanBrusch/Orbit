"use client"

import { motion, AnimatePresence } from "framer-motion"
import { Building2, Ruler, BedDouble, Bath, ChevronRight, ExternalLink } from "lucide-react"
import { PropertyCarousel } from "./PropertyCarousel"
import type { MapProperty } from "./MapAtlas"

interface PropertyPopupProps {
  property: MapProperty
  isDark: boolean
  onOpenDetails: () => void
  onClose?: () => void
}

const GOLD = "#C9A84C"

export const PropertyPopup = ({ property, isDark, onOpenDetails, onClose }: PropertyPopupProps) => {
  const formatValue = (val: number | null) => {
    if (!val) return "Sob Consulta"
    return `R$ ${val.toLocaleString('pt-BR')}`
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.95 }}
      className={`w-72 md:w-80 rounded-3xl overflow-hidden shadow-[0_40px_80px_rgba(0,0,0,0.6)] backdrop-blur-3xl border ${
        isDark ? 'bg-[#0A0A0F]/90 border-white/10' : 'bg-white/90 border-slate-200'
      }`}
    >
      {/* Photo Surface */}
      <div className="relative h-44 w-full bg-zinc-900 overflow-hidden">
        <PropertyCarousel photos={property.photos || []} isDark={isDark} height="h-44" />
        
        {/* Match Scoring (Intent Indicator) */}
        {property.matchScore !== undefined && property.matchScore >= 50 && (
          <div className="absolute top-4 left-4 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/50 backdrop-blur-xl border border-white/10 shadow-lg">
             <div className="w-1.5 h-1.5 rounded-full bg-[#C9A84C] animate-pulse" />
             <span className="text-[10px] font-mono font-bold text-white uppercase tracking-widest">{property.matchScore}% Resonance</span>
          </div>
        )}

        {/* Interaction Status Badge */}
        {property.interactionType && (
          <div className={`absolute ${property.matchScore ? 'top-14' : 'top-4'} left-4 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur-xl border shadow-lg ${
            property.interactionType === 'sent' 
              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' 
              : property.interactionType === 'portal'
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                : 'bg-blue-500/20 border-blue-500/40 text-blue-400'
          }`}>
             <div className={`w-1.5 h-1.5 rounded-full ${
               property.interactionType === 'sent' 
                 ? 'bg-emerald-400' 
                 : property.interactionType === 'portal'
                   ? 'bg-amber-400'
                   : 'bg-blue-400'
             }`} />
             <span className="text-[9px] font-bold uppercase tracking-wider">
               {property.interactionType === 'sent' ? 'Proposto (Selection)' : 
                property.interactionType === 'portal' ? 'Portal Selection' : 
                'No Acervo (Curtido)'}
             </span>
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
        
        {property.internalCode && (
          <div className="absolute top-4 right-4 z-20 px-2 py-1 rounded bg-black/40 backdrop-blur-md border border-white/10 text-[8px] font-mono text-white/70 tracking-tighter uppercase">
            {property.internalCode}
          </div>
        )}
      </div>

      {/* Identity Surface */}
      <div className="p-6 space-y-4">
        {/* Header Info */}
        <div className="space-y-1">
          <h3 className={`text-base font-bold leading-tight ${isDark ? 'text-white' : 'text-slate-900'} line-clamp-2`}>
            {property.name}
          </h3>
          <p className={`text-[11px] uppercase tracking-[0.1em] font-medium opacity-60 ${isDark ? 'text-white' : 'text-slate-500'}`}>
            {property.locationText || "Endereço indisponível"}
          </p>
        </div>

        {/* Pricing Segment */}
        <div className="flex items-baseline justify-between border-b pb-4" style={{ borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}>
           <div className="flex flex-col">
              <span className={`text-[9px] uppercase tracking-widest font-mono opacity-50 ${isDark ? 'text-white' : 'text-black'}`}>Investment Value</span>
              <span className="text-xl font-bold tracking-tight" style={{ color: GOLD }}>
                {formatValue(property.value)}
              </span>
           </div>
        </div>

        {/* Dynamic Attributes Grid */}
        <div className="grid grid-cols-3 gap-2">
           <div className={`p-2.5 rounded-2xl flex flex-col items-center justify-center gap-1 border ${isDark ? 'bg-white/3 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
              <Ruler className="w-3 h-3 opacity-40" />
              <span className={`text-[11px] font-mono font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{Math.round(property.area_privativa || 0)}m²</span>
              <span className="text-[7px] uppercase tracking-tighter opacity-40">Privat</span>
           </div>
           <div className={`p-2.5 rounded-2xl flex flex-col items-center justify-center gap-1 border ${isDark ? 'bg-white/3 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
              <BedDouble className="w-3 h-3 opacity-40" />
              <span className={`text-[11px] font-mono font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{property.bedrooms || "-"}</span>
              <span className="text-[7px] uppercase tracking-tighter opacity-40">Dorms</span>
           </div>
           <div className={`p-2.5 rounded-2xl flex flex-col items-center justify-center gap-1 border ${isDark ? 'bg-white/3 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
              <Bath className="w-3 h-3 opacity-40" />
              <span className={`text-[11px] font-mono font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{property.suites || "-"}</span>
              <span className="text-[7px] uppercase tracking-tighter opacity-40">Suites</span>
           </div>
        </div>

        {/* Intent Primary Action */}
        <button 
          onClick={(e) => { e.stopPropagation(); onOpenDetails(); }}
          className={`group/btn w-full h-12 rounded-2xl flex items-center justify-center gap-2 font-bold text-sm transition-all overflow-hidden relative shadow-lg hover:shadow-[0_10px_30px_rgba(201,168,76,0.2)]`}
          style={{ 
            backgroundColor: GOLD,
            color: '#0A0A0F'
           }}
        >
          <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-700" />
          <span>Ficha Operacional</span>
          <ExternalLink className="w-4 h-4 ml-1 opacity-60" />
        </button>
      </div>
    </motion.div>
  )
}
