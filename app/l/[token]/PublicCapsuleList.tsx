'use client'

import { useState, useMemo } from 'react'
import { Home, MapPin, ExternalLink, Filter } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface PublicPropertyCard {
  id: string
  title: string
  externalUrl: string | null
  coverImageUrl: string | null
  location: string | null
  price: number | null
  sentAt: string | null
  neighborhood: string | null
}

function formatPrice(value: number | null): string {
  if (!value) return ''
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value)
}

function PropertyCard({ item }: { item: PublicPropertyCard }) {
  return (
    <motion.a
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      href={item.externalUrl || '#'}
      target="_blank"
      rel="noopener noreferrer"
      className="block bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden hover:bg-white/10 transition-all active:scale-[0.98]"
    >
      {item.coverImageUrl ? (
        <div className="relative h-56 bg-neutral-900">
          <img
            src={item.coverImageUrl}
            alt={item.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
          <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
          
          {item.neighborhood && (
            <div className="absolute bottom-4 left-4">
               <span className="px-2.5 py-1 rounded-lg bg-white/10 backdrop-blur-md border border-white/20 text-xs font-medium text-white shadow-lg">
                {item.neighborhood}
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="h-48 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center">
          <Home className="w-12 h-12 text-white/30" />
        </div>
      )}
      
      <div className="p-5 space-y-3">
        <h3 className="font-semibold text-white text-xl leading-tight">
          {item.title}
        </h3>
        
        {item.location && (
          <div className="flex items-center gap-1.5 text-white/60 text-sm">
            <MapPin className="w-4 h-4 flex-shrink-0 text-indigo-400" />
            <span className="truncate">{item.location}</span>
          </div>
        )}
        
        <div className="flex items-center justify-between pt-2">
          {item.price ? (
            <div className="text-white font-bold text-lg">
              {formatPrice(item.price)}
            </div>
          ) : <div />}
          
          <div className="flex items-center gap-1 text-indigo-400 text-sm font-semibold bg-indigo-500/10 px-3 py-1.5 rounded-full border border-indigo-500/20">
            <span>Explorar</span>
            <ExternalLink className="w-4 h-4" />
          </div>
        </div>
      </div>
    </motion.a>
  )
}

export function PublicCapsuleList({ items }: { items: PublicPropertyCard[] }) {
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<string | null>(null)

  const neighborhoods = useMemo(() => {
    const set = new Set(items.map(item => item.neighborhood).filter(Boolean))
    return Array.from(set).sort() as string[]
  }, [items])

  const filteredItems = useMemo(() => {
    if (!selectedNeighborhood) return items
    return items.filter(item => item.neighborhood === selectedNeighborhood)
  }, [items, selectedNeighborhood])

  const showFilter = neighborhoods.length > 1

  return (
    <div className="space-y-6">
      {showFilter && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="pb-2 overflow-x-auto no-scrollbar"
        >
          <div className="flex gap-2 min-w-max p-1">
            <button
              onClick={() => setSelectedNeighborhood(null)}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-350 border shadow-sm ${
                selectedNeighborhood === null
                  ? 'bg-white text-black border-white shadow-white/10'
                  : 'bg-white/5 text-white/60 border-white/5 hover:bg-white/10 hover:border-white/10 active:scale-95'
              }`}
            >
              Todos
            </button>
            {neighborhoods.map((n) => (
              <button
                key={n}
                onClick={() => setSelectedNeighborhood(n)}
                className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-350 border shadow-sm ${
                  selectedNeighborhood === n
                    ? 'bg-indigo-500 text-white border-indigo-500 shadow-indigo-500/20'
                    : 'bg-white/5 text-white/60 border-white/5 hover:bg-white/10 hover:border-white/10 active:scale-95'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </motion.div>
      )}

      <div className="text-white/40 text-xs flex items-center justify-center gap-2 mb-2">
        <Filter className="w-3 h-3" />
        <span>Mostrando {filteredItems.length} de {items.length} {items.length === 1 ? 'imóvel' : 'imóveis'}</span>
      </div>

      <motion.div 
        layout
        className="space-y-4"
      >
        <AnimatePresence mode="popLayout">
          {filteredItems.map((item) => (
            <PropertyCard key={item.id} item={item} />
          ))}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
