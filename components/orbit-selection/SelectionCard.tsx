"use client";

import { motion } from 'framer-motion';
import { Heart, X, MapPin, Maximize2, BedDouble, Bath, Square, PlayCircle, MessageSquare, Ruler } from 'lucide-react';
import { PropertyCarousel } from './PropertyCarousel';

interface PropertyCardProps {
  item: any;
  interactions: string[];
  onInteract: (state: string) => void;
  onOpenDetails: () => void;
  onOpenChat: () => void;
}

export function SelectionCard({ item, interactions, onInteract, onOpenDetails, onOpenChat }: PropertyCardProps) {
  const isLiked = interactions.includes('favorited');
  const isDisliked = interactions.includes('discarded');

  const formatPrice = (value: number | null) => {
    if (!value) return "Sob consulta";
    return new Intl.NumberFormat("pt-BR", { 
      style: "currency", 
      currency: "BRL", 
      maximumFractionDigits: 0 
    }).format(value);
  };

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative w-full rounded-[32px] overflow-hidden bg-white border border-gray-100 shadow-xl shadow-gray-100 mb-8 transition-all ${isDisliked ? 'opacity-40 grayscale scale-95' : ''}`}
    >
      {/* Visual Indicator of State */}
      {isLiked && (
        <div className="absolute top-6 left-6 z-20 bg-[#C9A84C] text-white text-[10px] font-bold px-3 py-1 rounded-full flex items-center gap-1.5 shadow-lg">
          <Heart className="w-3 h-3 fill-white" />
          CURADO PARA VOCÊ
        </div>
      )}

      {/* Media Section */}
      <div className="relative">
        <PropertyCarousel 
          photos={item.photos || []} 
          coverImage={item.coverImage} 
          title={item.title} 
          onOpenDetails={onOpenDetails} 
        />
        
        {/* Quick Tags */}
        <div className="absolute top-6 right-6 flex flex-col gap-2 z-20">
          {item.videoUrl && (
            <div className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-white">
              <PlayCircle className="w-5 h-5" />
            </div>
          )}
          <button 
            onClick={(e) => { e.stopPropagation(); onOpenDetails(); }}
            className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-white"
          >
            <Maximize2 className="w-5 h-5" />
          </button>
        </div>

        {/* Info - Bottom of Media Overlay */}
        <div className="absolute bottom-8 left-8 right-8 text-white pointer-events-none">
          <div className="flex items-center gap-1.5 text-white/80 text-[10px] mb-2 font-bold uppercase tracking-[0.15em]">
            <MapPin className="w-3 h-3" />
            {item.location}
          </div>
          <h2 className="text-2xl font-bold leading-tight mb-2 tracking-tight font-serif">{item.title}</h2>
          <p className="text-[#F6F4F0] text-xl font-bold">{formatPrice(item.price)}</p>
        </div>
      </div>

      {/* Quick Specs */}
      <div className="px-8 py-6 flex items-center justify-between border-b border-gray-50 bg-[#FBFBF9]/50">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-gray-400">
            <BedDouble className="w-3.5 h-3.5" />
            <span className="text-[10px] uppercase tracking-wider font-bold">Dormitórios</span>
          </div>
          <span className="text-sm font-bold text-gray-900">{item.bedrooms || 0}</span>
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-gray-400">
            <Bath className="w-3.5 h-3.5" />
            <span className="text-[10px] uppercase tracking-wider font-bold">Banheiros</span>
          </div>
          <span className="text-sm font-bold text-gray-900">{item.bathrooms || item.suites || 0}</span>
        </div>
        <div className="flex flex-col gap-1 text-right">
          <div className="flex items-center justify-end gap-1.5 text-gray-400">
            <Ruler className="w-3.5 h-3.5" />
            <span className="text-[10px] uppercase tracking-wider font-bold">Área</span>
          </div>
          <div className="flex items-center justify-end gap-1.5">
            <span className="text-sm font-bold text-gray-900">{item.areaPrivativa || '—'}m²</span>
            {item.areaTotal && (
              <span className="text-[10px] text-gray-400 border-l border-gray-200 pl-1.5">Lote: {item.areaTotal}m²</span>
            )}
          </div>
        </div>
      </div>

      {/* Main Actions - Thumb Zone */}
      <div className="p-8 flex items-center gap-4">
        <button 
          onClick={() => onInteract('discarded')}
          className={`h-14 w-14 rounded-full flex items-center justify-center border transition-all active:scale-95 shadow-sm ${
            isDisliked ? 'bg-gray-100 border-gray-200 text-gray-900' : 'bg-white border-gray-100 text-gray-300 hover:text-gray-500'
          }`}
          aria-label="Descartar"
        >
          <X className="w-5 h-5" />
        </button>

        <button 
          onClick={onOpenChat}
          className="flex-1 h-14 rounded-[18px] bg-[#1A1A1A] flex items-center justify-center gap-3 text-white text-sm font-bold transition-all active:scale-[0.98] shadow-lg shadow-gray-200"
        >
          <MessageSquare className="w-4 h-4" />
          Consultar Agente
        </button>

        <button 
          onClick={() => onInteract('favorited')}
          className={`h-14 w-14 rounded-full flex items-center justify-center border transition-all active:scale-95 shadow-sm ${
            isLiked ? 'bg-[#C9A84C] border-[#C9A84C] text-white shadow-lg shadow-[#C9A84C]/20' : 'bg-white border-gray-100 text-gray-300 hover:text-[#C9A84C]'
          }`}
          aria-label="Favoritar"
        >
          <Heart className={`w-5 h-5 ${isLiked ? 'fill-white' : ''}`} />
        </button>
      </div>
    </motion.div>
  );
}
