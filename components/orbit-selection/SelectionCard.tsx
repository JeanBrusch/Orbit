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
      className={`relative w-full rounded-[32px] overflow-hidden bg-white border border-gray-100 shadow-xl shadow-gray-100 mb-6 transition-all ${isDisliked ? 'opacity-40 grayscale scale-95' : ''}`}
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
          <div className="w-full h-full bg-gray-50 flex items-center justify-center">🏢</div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30" />
        
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
          <div className="flex items-center gap-1.5 text-white/70 text-xs mb-2 font-bold uppercase tracking-widest">
            <MapPin className="w-3 h-3" />
            {item.location}
          </div>
          <h2 className="text-2xl font-black leading-tight mb-2 tracking-tighter">{item.title}</h2>
          <p className="text-white text-lg font-black">{formatPrice(item.price)}</p>
        </div>
      </div>

      {/* Quick Specs */}
      <div className="px-8 py-6 grid grid-cols-3 gap-4 border-b border-gray-50">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-gray-400">
            <BedDouble className="w-3.5 h-3.5" />
            <span className="text-[10px] uppercase tracking-wider font-bold">Quartos</span>
          </div>
          <span className="text-sm font-black text-gray-900">{item.bedrooms || 0}</span>
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-gray-400">
            <Bath className="w-3.5 h-3.5" />
            <span className="text-[10px] uppercase tracking-wider font-bold">Suítes</span>
          </div>
          <span className="text-sm font-black text-gray-900">{item.suites || 0}</span>
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-gray-400">
            <Square className="w-3.5 h-3.5" />
            <span className="text-[10px] uppercase tracking-wider font-bold">Área</span>
          </div>
          <span className="text-sm font-black text-gray-900">{item.areaPrivativa || '—'}m²</span>
        </div>
      </div>

      {/* Main Actions - Thumb Zone */}
      <div className="p-8 flex items-center gap-4">
        <button 
          onClick={() => onInteract('discarded')}
          className={`h-16 w-16 rounded-full flex items-center justify-center border transition-all active:scale-95 shadow-sm ${
            isDisliked ? 'bg-gray-100 border-gray-200 text-gray-900' : 'bg-white border-gray-100 text-gray-300'
          }`}
        >
          <X className="w-6 h-6" />
        </button>

        <button 
          onClick={onOpenChat}
          className="flex-1 h-16 rounded-[24px] bg-gray-900 flex items-center justify-center gap-3 text-white font-bold transition-all active:scale-[0.98] shadow-xl shadow-gray-200"
        >
          <MessageSquare className="w-5 h-5 fill-white" />
          Discutir
        </button>

        <button 
          onClick={() => onInteract('favorited')}
          className={`h-16 w-16 rounded-full flex items-center justify-center border transition-all active:scale-95 shadow-sm ${
            isLiked ? 'bg-rose-500 border-rose-500 text-white shadow-lg shadow-rose-500/20' : 'bg-white border-gray-100 text-gray-300'
          }`}
        >
          <Heart className={`w-6 h-6 ${isLiked ? 'fill-white' : ''}`} />
        </button>
      </div>
    </motion.div>
  );
}
