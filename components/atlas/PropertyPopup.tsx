"use client"

import { motion, AnimatePresence } from "framer-motion"
import { Building2, Ruler, BedDouble, Bath, ChevronRight, ExternalLink, AlertTriangle } from "lucide-react"
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

        {/* Match Cognitive Feed */}
        {property.matchScore !== undefined && (property.matchReasons?.length || property.matchWarnings?.length) ? (
          <div className="pt-4 border-t" style={{ borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}>
             {(property.matchReasons && property.matchReasons.length > 0) && (
                <div className="mb-3">
                   <h4 className={`text-[9px] uppercase tracking-widest font-mono opacity-50 mb-2 ${isDark ? 'text-white' : 'text-black'}`}>Pontos de Ressonância</h4>
                   <div className="flex flex-wrap gap-1.5">
                     {property.matchReasons.map((reason: string, i: number) => (
                       <span key={i} className={`px-2 py-1 rounded-[6px] text-[9px] font-bold uppercase tracking-wider ${isDark ? 'bg-[#C9A84C]/10 text-[#C9A84C]' : 'bg-[#C9A84C]/10 text-[#C9A84C]'}`}>{reason}</span>
                     ))}
                   </div>
                </div>
             )}
             {(property.matchWarnings && property.matchWarnings.length > 0) && (
                <div>
                   <h4 className={`text-[9px] uppercase tracking-widest font-mono opacity-50 mb-2 ${isDark ? 'text-orange-400' : 'text-orange-500'}`}>Desvios / Bloqueios</h4>
                   <div className="space-y-1.5">
                     {property.matchWarnings.map((warning: string, i: number) => (
                       <div key={i} className="flex items-start gap-1.5">
                         <AlertTriangle size={12} className="text-orange-500 shrink-0 mt-0.5" />
                         <span className={`text-[10px] ${isDark ? 'text-orange-200/70' : 'text-slate-600'}`}>{warning}</span>
                       </div>
                     ))}
                   </div>
                </div>
             )}
          </div>
        ) : null}

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

// ── PropertyPopupCompact ──────────────────────────────────────────────────────
// Variante para hover no mapa. Mesma identidade visual do PropertyPopup
// (incluindo carousel), porém com proporções reduzidas e sem CTA.
// O clique no marker abre o PropertyPopup completo.
// ─────────────────────────────────────────────────────────────────────────────

interface PropertyPopupCompactProps {
  property: MapProperty
  isDark: boolean
}

export const PropertyPopupCompact = ({ property, isDark }: PropertyPopupCompactProps) => {
  const formatValue = (val: number | null) => {
    if (!val) return "Sob Consulta"
    return `R$ ${val.toLocaleString('pt-BR')}`
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.96 }}
      transition={{ duration: 0.18, ease: [0.19, 1, 0.22, 1] }}
      className={`w-64 rounded-3xl overflow-hidden shadow-[0_30px_60px_rgba(0,0,0,0.55)] backdrop-blur-3xl border ${
        isDark ? 'bg-[#0A0A0F]/92 border-white/10' : 'bg-white/92 border-slate-200'
      }`}
    >
      {/* Photo Surface — compact height */}
      <div className="relative h-32 w-full bg-zinc-900 overflow-hidden">
        <PropertyCarousel photos={property.photos || []} isDark={isDark} height="h-32" />

        {/* Match Scoring */}
        {(property.matchScore ?? 0) >= 50 && (
          <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-1 px-2 py-1 rounded-full bg-black/50 backdrop-blur-xl border border-white/10 shadow-lg">
            <div className="w-1 h-1 rounded-full bg-[#C9A84C] animate-pulse" />
            <span className="text-[8px] font-mono font-bold text-white uppercase tracking-widest">
              {property.matchScore}% Res.
            </span>
          </div>
        )}

        {/* Interaction Badge */}
        {property.interactionType && (
          <div className={`absolute ${(property.matchScore ?? 0) >= 50 ? 'top-10' : 'top-2.5'} left-2.5 z-20 flex items-center gap-1 px-2 py-1 rounded-full backdrop-blur-xl border shadow-lg ${
            property.interactionType === 'sent'
              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
              : property.interactionType === 'portal'
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                : 'bg-blue-500/20 border-blue-500/40 text-blue-400'
          }`}>
            <div className={`w-1 h-1 rounded-full ${
              property.interactionType === 'sent' ? 'bg-emerald-400'
                : property.interactionType === 'portal' ? 'bg-amber-400'
                : 'bg-blue-400'
            }`} />
            <span className="text-[7.5px] font-bold uppercase tracking-wider">
              {property.interactionType === 'sent' ? 'Proposto'
                : property.interactionType === 'portal' ? 'Portal'
                : 'Acervo'}
            </span>
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />

        {property.internalCode && (
          <div className="absolute top-2.5 right-2.5 z-20 px-1.5 py-0.5 rounded bg-black/40 backdrop-blur-md border border-white/10 text-[7px] font-mono text-white/70 tracking-tighter uppercase">
            {property.internalCode}
          </div>
        )}
      </div>

      {/* Identity Surface — compact */}
      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="space-y-0.5">
          <h3 className={`text-sm font-bold leading-tight line-clamp-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {property.name}
          </h3>
          <p className={`text-[10px] uppercase tracking-[0.1em] font-medium opacity-55 ${isDark ? 'text-white' : 'text-slate-500'}`}>
            {property.locationText || property.neighborhood || "Endereço indisponível"}
          </p>
        </div>

        {/* Price */}
        <div className="border-b pb-3" style={{ borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}>
          <span className="text-[8px] uppercase tracking-widest font-mono opacity-50 block mb-0.5" style={{ color: isDark ? 'white' : 'black' }}>
            Investment Value
          </span>
          <span className="text-lg font-bold tracking-tight" style={{ color: GOLD }}>
            {formatValue(property.value)}
          </span>
        </div>

        {/* Attributes grid */}
        <div className="grid grid-cols-3 gap-1.5">
          <div className={`p-2 rounded-xl flex flex-col items-center justify-center gap-0.5 border ${isDark ? 'bg-white/3 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
            <Ruler className="w-2.5 h-2.5 opacity-40" />
            <span className={`text-[10px] font-mono font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {Math.round(property.area_privativa || 0)}m²
            </span>
            <span className="text-[6px] uppercase tracking-tighter opacity-40">Privat</span>
          </div>
          <div className={`p-2 rounded-xl flex flex-col items-center justify-center gap-0.5 border ${isDark ? 'bg-white/3 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
            <BedDouble className="w-2.5 h-2.5 opacity-40" />
            <span className={`text-[10px] font-mono font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {property.bedrooms || "–"}
            </span>
            <span className="text-[6px] uppercase tracking-tighter opacity-40">Dorms</span>
          </div>
          <div className={`p-2 rounded-xl flex flex-col items-center justify-center gap-0.5 border ${isDark ? 'bg-white/3 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
            <Bath className="w-2.5 h-2.5 opacity-40" />
            <span className={`text-[10px] font-mono font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {property.suites || "–"}
            </span>
            <span className="text-[6px] uppercase tracking-tighter opacity-40">Suites</span>
          </div>
        </div>

        {/* Match Cognitive Feed (Compact) */}
        {property.matchScore !== undefined && (property.matchReasons?.length || property.matchWarnings?.length) ? (
          <div className="pt-3 border-t space-y-2" style={{ borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}>
             {(property.matchReasons && property.matchReasons.length > 0) && (
                <div className="flex flex-wrap gap-1">
                  {property.matchReasons.slice(0, 2).map((reason: string, i: number) => (
                    <span key={i} className={`px-1.5 py-0.5 rounded-[4px] text-[8px] font-bold uppercase tracking-wider ${isDark ? 'bg-[#C9A84C]/10 text-[#C9A84C]' : 'bg-[#C9A84C]/10 text-[#C9A84C]'}`}>{reason}</span>
                  ))}
                  {property.matchReasons.length > 2 && <span className={`text-[8px] font-bold ${isDark ? 'text-[#C9A84C]/50' : 'text-[#C9A84C]/50'}`}>+{property.matchReasons.length - 2}</span>}
                </div>
             )}
             {(property.matchWarnings && property.matchWarnings.length > 0) && (
                <div className="flex flex-col gap-1">
                  {property.matchWarnings.slice(0, 1).map((warning: string, i: number) => (
                    <div key={i} className="flex items-center gap-1">
                      <AlertTriangle size={10} className="text-orange-500 shrink-0" />
                      <span className={`text-[9px] truncate ${isDark ? 'text-orange-200/70' : 'text-slate-600'}`}>{warning}</span>
                    </div>
                  ))}
                  {property.matchWarnings.length > 1 && <span className={`text-[8px] font-bold ${isDark ? 'text-orange-400/50' : 'text-orange-500/50'}`}>+{property.matchWarnings.length - 1} alertas</span>}
                </div>
             )}
          </div>
        ) : null}

        {/* Hint */}
        <p className={`text-center text-[7px] uppercase tracking-[0.18em] font-mono opacity-25 ${isDark ? 'text-white' : 'text-slate-500'}`}>
          clique para abrir
        </p>
      </div>
    </motion.div>
  )
}
