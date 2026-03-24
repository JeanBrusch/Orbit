"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { 
  Heart, 
  MessageCircle, 
  Send, 
  Bookmark, 
  ChevronLeft, 
  ChevronRight, 
  MapPin, 
  BadgeCheck,
  Maximize2,
  BedDouble,
  Bath,
  Car,
  Home
} from "lucide-react"

interface InstagramAdOfferProps {
  property: any
  onSendWhatsApp?: (text: string) => void
}

export default function InstagramAdOffer({ property, onSendWhatsApp }: InstagramAdOfferProps) {
  const [currentPhoto, setCurrentPhoto] = useState(0)
  const photos = property.photos || [property.cover_image]
  
  const formattedValue = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0
  }).format(property.value || 0)

  const nextPhoto = (e: React.MouseEvent) => {
    e.stopPropagation()
    setCurrentPhoto((prev) => (prev + 1) % photos.length)
  }

  const prevPhoto = (e: React.MouseEvent) => {
    e.stopPropagation()
    setCurrentPhoto((prev) => (prev - 1 + photos.length) % photos.length)
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden max-w-sm mx-auto select-none">
      {/* Header Estilo Instagram */}
      <div className="p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-yellow-400 to-fuchsia-600 p-[2px]">
            <div className="w-full h-full rounded-full bg-white p-[2px]">
              <div className="w-full h-full rounded-full bg-gray-100 overflow-hidden">
                <img src="/logo-orbit-mini.png" alt="Orbit" className="w-full h-full object-cover" onError={(e) => {
                  (e.target as any).src = "https://api.dicebear.com/7.x/initials/svg?seed=Orbit"
                }}/>
              </div>
            </div>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1">
              <span className="text-xs font-bold text-gray-900 leading-none">Orbit Atlas</span>
              <BadgeCheck size={14} className="text-blue-500" fill="currentColor" />
            </div>
            <span className="text-[10px] text-gray-500 leading-none">{property.neighborhood}, {property.city}</span>
          </div>
        </div>
        <button className="text-gray-400">
          <span className="text-lg leading-none">•••</span>
        </button>
      </div>

      {/* Carrossel de Mídia */}
      <div className="relative aspect-square bg-gray-50 group">
        <img 
          src={photos[currentPhoto]} 
          alt={property.title}
          className="w-full h-full object-cover transition-opacity duration-300"
        />
        
        {photos.length > 1 && (
          <>
            <button 
              onClick={prevPhoto}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-1 rounded-full bg-white/20 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ChevronLeft size={20} className="text-white" />
            </button>
            <button 
              onClick={nextPhoto}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full bg-white/20 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ChevronRight size={20} className="text-white" />
            </button>
            
            {/* Indicadores de Carrossel */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
              {photos.slice(0, 5).map((_: string, i: number) => (
                <div 
                  key={i}
                  className={`w-1.5 h-1.5 rounded-full transition-all ${
                    i === currentPhoto % 5 ? 'bg-white w-3' : 'bg-white/40'
                  }`}
                />
              ))}
            </div>
          </>
        )}

        <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-md px-2 py-1 rounded-md text-[10px] text-white font-bold tracking-tight">
          {formattedValue}
        </div>
      </div>

      {/* Barra de Ações */}
      <div className="p-3 flex items-center justify-between">
        <div className="flex items-center gap-4 text-gray-900">
          <Heart size={24} className="hover:text-red-500 transition-colors cursor-pointer" />
          <MessageCircle size={24} className="cursor-pointer" />
          <Send size={24} className="cursor-pointer" />
        </div>
        <Bookmark size={24} className="cursor-pointer" />
      </div>

      {/* Conteúdo / Caption */}
      <div className="px-3 pb-3 space-y-2">
        <div className="flex flex-wrap gap-3 py-2 border-y border-gray-50">
          <div className="flex items-center gap-1 text-gray-500">
            <Maximize2 size={14} />
            <span className="text-xs font-medium">{property.area_privativa}m²</span>
          </div>
          <div className="flex items-center gap-1 text-gray-500">
            <BedDouble size={14} />
            <span className="text-xs font-medium">{property.bedrooms} Quartos</span>
          </div>
          <div className="flex items-center gap-1 text-gray-500">
            <Bath size={14} />
            <span className="text-xs font-medium">{property.suites} Suítes</span>
          </div>
        </div>

        <div className="pt-1">
          <p className="text-sm leading-tight text-gray-800">
            <span className="font-bold mr-2 text-gray-900">orbit.atlas</span>
            {property.title} em {property.neighborhood}. O match perfeito para quem busca {property.topics?.[0]?.toLowerCase() || 'exclusividade'}.
          </p>
          
          <div className="mt-2 flex flex-wrap gap-1">
            {property.features?.slice(0, 3).map((feature: string, i: number) => (
              <span key={i} className="text-[10px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-medium italic">
                #{feature.replace(/\s+/g, '')}
              </span>
            ))}
          </div>
        </div>

        <button 
          onClick={() => onSendWhatsApp?.(`Olá! Vi o anúncio do imóvel em ${property.neighborhood} (${formattedValue}) e gostaria de saber mais.`)}
          className="w-full mt-4 bg-gray-900 text-white py-4 rounded-lg text-xs font-bold active:scale-95 transition-transform flex items-center justify-center gap-2"
        >
          <Send size={14} />
          Enviar Proposta Premium
        </button>
      </div>

      <div className="px-3 py-2 bg-gray-50/50">
        <span className="text-[10px] text-gray-400 font-medium">Orbit Intelligence • Xangri-lá Legacy</span>
      </div>
    </div>
  )
}
