"use client";

import { motion } from 'framer-motion';
import { Heart, X, MapPin, Maximize2, BedDouble, Bath, Square, PlayCircle, MessageSquare } from 'lucide-react';

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
  const isVisited = interactions.includes('visited');

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
      className={`relative w-full rounded-[32px] overflow-hidden bg-[#121212] border border-white/5 shadow-2xl mb-6 transition-all ${isDisliked ? 'opacity-40 grayscale scale-95' : ''}`}
    >
      {/* Visual Indicator of State */}
      {isLiked && (
        <div className="absolute top-6 left-6 z-20 bg-rose-500 text-white text-[10px] font-bold px-3 py-1 rounded-full flex items-center gap-1.5 shadow-lg">
          <Heart className="w-3 h-3 fill-white" />
          INTERESSE ALTO
        </div>
      )}

      {/* Media Section */}
      <div className="relative aspect-[4/5] overflow-hidden" onClick={onOpenDetails}>
        {item.coverImage ? (
          <img src={item.coverImage} alt={item.title} className="w-full h-full object-cover transition-transform duration-700 hover:scale-110" />
        ) : (
          <div className="w-full h-full bg-white/5 flex items-center justify-center">🏢</div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0c0c0c] via-transparent to-black/40" />
        
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

        {/* Info - Bottom of Media */}
        <div className="absolute bottom-8 left-8 right-8 text-white">
          <div className="flex items-center gap-1.5 text-white/60 text-xs mb-2 font-medium">
            <MapPin className="w-3 h-3" />
            {item.location}
          </div>
          <h2 className="text-2xl font-bold leading-tight mb-2">{item.title}</h2>
          <p className="text-[#d4af35] text-lg font-bold">{formatPrice(item.price)}</p>
        </div>
      </div>

      {/* Quick Specs */}
      <div className="px-8 py-6 grid grid-cols-3 gap-4 border-b border-white/5">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-white/40">
            <BedDouble className="w-3.5 h-3.5" />
            <span className="text-[10px] uppercase tracking-wider font-bold">Quartos</span>
          </div>
          <span className="text-sm font-medium text-white/80">{item.bedrooms || 0}</span>
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-white/40">
            <Bath className="w-3.5 h-3.5" />
            <span className="text-[10px] uppercase tracking-wider font-bold">Suítes</span>
          </div>
          <span className="text-sm font-medium text-white/80">{item.suites || 0}</span>
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-white/40">
            <Square className="w-3.5 h-3.5" />
            <span className="text-[10px] uppercase tracking-wider font-bold">Área</span>
          </div>
          <span className="text-sm font-medium text-white/80">{item.areaPrivativa || '—'}m²</span>
        </div>
      </div>

      {/* Main Actions - Thumb Zone */}
      <div className="p-8 flex items-center gap-4">
        <button 
          onClick={() => onInteract('discarded')}
          className={`h-16 w-16 rounded-full flex items-center justify-center border transition-all active:scale-95 ${
            isDisliked ? 'bg-white/10 border-white/20 text-white' : 'bg-white/5 border-white/10 text-white/40'
          }`}
        >
          <X className="w-6 h-6" />
        </button>

        <button 
          onClick={onOpenChat}
          className="flex-1 h-16 rounded-[24px] bg-white/5 border border-white/10 flex items-center justify-center gap-3 text-white/80 font-bold transition-all active:scale-[0.98]"
        >
          <MessageSquare className="w-5 h-5 text-[#d4af35]" />
          Discutir
        </button>

        <button 
          onClick={() => onInteract('favorited')}
          className={`h-16 w-16 rounded-full flex items-center justify-center border transition-all active:scale-95 ${
            isLiked ? 'bg-rose-500 border-rose-500 text-white shadow-lg shadow-rose-500/20' : 'bg-white/5 border-white/10 text-white/40'
          }`}
        >
          <Heart className={`w-6 h-6 ${isLiked ? 'fill-white' : ''}`} />
        </button>
      </div>
    </motion.div>
  );
}
