'use client'

import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Heart,
  Eye,
  MessageCircle,
  MapPin,
  ChevronRight,
  X,
  Bed,
  Bath,
  Ruler,
  Sparkles
} from 'lucide-react'
import { toast } from 'sonner'

interface PropertyPhoto {
  url: string
  alt?: string
}

interface Property {
  id: string
  title: string
  price: number
  bedrooms: number
  bathrooms: number
  area_privativa?: number
  area_total?: number
  location?: string
  note?: string
  videoUrl?: string
  url?: string
  coverImage: string
  photos?: PropertyPhoto[]
  recommendedReason?: string
  description?: string
  internalCode?: string
  _debugRow?: any
}

interface Lead {
  id: string
  firstName: string
}

interface ClientSelectionViewProps {
  data: {
    space?: string
    lead: Lead
    items: Property[]
    initialInteractions?: Record<string, any>
  }
  slug: string
}

interface Interaction {
  favorited?: Set<string>
  discarded?: Set<string>
  viewed?: Set<string>
  scrollDepth?: number
}

export default function ClientSelectionView({
  data,
  slug,
}: ClientSelectionViewProps) {
  const { lead, items, initialInteractions = {} } = data
  const [propertiesList, setPropertiesList] = useState<Property[]>(items)
  const [interactions, setInteractions] = useState<Interaction>({
    favorited: new Set(initialInteractions.favorited || []),
    discarded: new Set(initialInteractions.discarded || []),
    viewed: new Set(initialInteractions.viewed || []),
    scrollDepth: initialInteractions.scrollDepth || 0,
  })
  const [expandedItem, setExpandedItem] = useState<string | null>(null)
  const [currentImageIndex, setCurrentImageIndex] = useState<
    Record<string, number>
  >({})
  const mainRef = useRef<HTMLDivElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const scrollTrackerRef = useRef<{
    lastDepth: number
    trackingTimer: NodeJS.Timeout | null
  }>({
    lastDepth: 0,
    trackingTimer: null,
  })

  // Track portal opened on mount
  useEffect(() => {
    if (items.length > 0 && lead.id) {
      trackInteraction(items[0].id, 'portal_opened', {})
    }
  }, [])

  // Setup IntersectionObserver for viewed tracking
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.7) {
            const propertyId = (entry.target as HTMLElement).dataset.propertyId
            if (propertyId && !interactions.viewed?.has(propertyId)) {
              setInteractions((prev) => ({
                ...prev,
                viewed: new Set([...(prev.viewed || []), propertyId]),
              }))
              if (lead.id) {
                trackInteraction(propertyId, 'viewed', {})
              }
            }
          }
        })
      },
      { threshold: 0.7 }
    )

    return () => {
      observerRef.current?.disconnect()
    }
  }, [interactions.viewed, lead.id])

  // Track scroll depth
  useEffect(() => {
    const handleScroll = () => {
      if (!mainRef.current) return

      const scrollHeight =
        mainRef.current.scrollHeight - window.innerHeight
      const scrolled = mainRef.current.scrollTop
      const depth = Math.floor((scrolled / scrollHeight) * 100)

      // Track at 25% increments
      if (
        depth >= 25 &&
        depth - (scrollTrackerRef.current.lastDepth || 0) >= 25
      ) {
        scrollTrackerRef.current.lastDepth = depth
        if (lead.id) {
          trackInteraction('', 'scroll_depth', { depth })
        }
      }
    }

    const container = mainRef.current
    if (container) {
      container.addEventListener('scroll', handleScroll)
      return () => container.removeEventListener('scroll', handleScroll)
    }
  }, [lead.id])

  // Track session end on unmount
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (lead.id) {
        navigator.sendBeacon('/api/property-interactions', 
          JSON.stringify({
            leadId: lead.id,
            interaction_type: 'session_end',
            duration_seconds: Math.floor(Date.now() / 1000),
            source: 'client_portal'
          })
        )
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [lead.id])

  const trackInteraction = async (
    propertyId: string,
    type: string,
    metadata: Record<string, any>
  ) => {
    if (!lead.id) return

    try {
      await fetch('/api/property-interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: lead.id,
          propertyId,
          interaction_type: type,
          source: 'client_portal',
          metadata,
        }),
      })
    } catch (error) {
      console.error('Error tracking interaction:', error)
    }
  }

  const toggleFavorite = (propertyId: string) => {
    setInteractions((prev) => {
      const newFavorited = new Set(prev.favorited)
      if (newFavorited.has(propertyId)) {
        newFavorited.delete(propertyId)
      } else {
        newFavorited.add(propertyId)
      }
      return { ...prev, favorited: newFavorited }
    })
    if (lead.id) {
      trackInteraction(propertyId, 'favorited', {})
    }
  }

  const handleDeleteProperty = async (propertyId: string) => {
    if (!lead.id) return

    // Otimista: remove da lista local
    setPropertiesList(prev => prev.filter(p => p.id !== propertyId))
    toast.success('Imóvel removido da seleção')

    try {
      const res = await fetch(`/api/property-interactions?leadId=${lead.id}&propertyId=${propertyId}`, {
        method: 'DELETE'
      })
      if (!res.ok) throw new Error('Falha ao remover do servidor')
    } catch (error) {
      console.error('Error deleting property:', error)
      toast.error('Erro ao sincronizar remoção')
      // Reverter se falhar? Geralmente melhor apenas logar se a UI já atualizou
    }
  }

  const toggleDiscarded = (propertyId: string) => {
    // Mantemos o toggle para o estado esmaecido se desejado,
    // mas a ação principal agora será a deleção.
    setInteractions((prev) => {
      const newDiscarded = new Set(prev.discarded)
      if (newDiscarded.has(propertyId)) {
        newDiscarded.delete(propertyId)
      } else {
        newDiscarded.add(propertyId)
      }
      return { ...prev, discarded: newDiscarded }
    })
    if (lead.id) {
      trackInteraction(propertyId, 'discarded', {})
    }
  }


  const handleWhatsAppClick = (property: Property) => {
    const propertyUrl = `${window.location.origin}/selection/${slug}#${property.id}`
    const message = `Olá Jean! Estou no seu portal e tenho uma dúvida sobre este imóvel:\n\n*${property.title}*\n${formatPrice(property.price)}\n\nLink: ${propertyUrl}`
    const encodedMessage = encodeURIComponent(message)
    const whatsappUrl = `https://wa.me/5551982237325?text=${encodedMessage}`
    
    // Track interaction before redirecting
    if (lead.id) {
      trackInteraction(property.id, 'whatsapp_click', {
        device: /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop'
      })
    }

    window.open(whatsappUrl, '_blank')
  }

  const getPropertyImages = (property: Property): string[] => {
    if (property.photos && property.photos.length > 0) {
      return property.photos.map((p) => p.url)
    }
    return [property.coverImage]
  }

  const getInitialImageIndex = (propertyId: string): number => {
    return currentImageIndex[propertyId] || 0
  }

  const setInitialImageIndex = (
    propertyId: string,
    index: number,
    images: string[]
  ) => {
    const safeIndex = Math.max(0, Math.min(index, images.length - 1))
    setCurrentImageIndex((prev) => ({
      ...prev,
      [propertyId]: safeIndex,
    }))
  }

  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
    }).format(price)
  }

  return (
    <div className="h-screen flex flex-col bg-[#F9F7F4]">
      {/* Header Sticky */}
      <div className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100 h-12 px-4">
        <div className="flex items-center justify-between h-full">
          <div className="text-[13px] font-semibold tracking-wide text-[#1A1A1A]">
            Jean Brusch
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            <span className="text-sm text-gray-800 font-medium">
              {lead.firstName}
            </span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main
        ref={mainRef}
        className="flex-1 overflow-y-auto scroll-smooth"
        style={{ paddingBottom: '80px' }}
      >
        {/* Greeting Block */}
        <div className="px-6 py-10 text-center space-y-3">
          <div className="space-y-1">
            <h1 className="text-[32px] font-[family-name:var(--font-display)] text-[#1A1A1A] leading-tight">
              <span className="text-gray-400 font-light italic mr-2">Olá,</span>
              {lead.firstName}
            </h1>
            <div className="flex items-center justify-center gap-2 text-[#C9A84C]">
              <div className="h-[1px] w-6 bg-current opacity-30" />
              <Sparkles size={14} />
              <div className="h-[1px] w-6 bg-current opacity-30" />
            </div>
          </div>
          <p className="text-[15px] text-gray-500 max-w-[280px] mx-auto leading-relaxed font-light">
            Selecionei estes imóveis com base no seu perfil e objetivos.
          </p>
        </div>

        {/* Properties Feed */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 px-6 pb-20 max-w-7xl mx-auto">
          {propertiesList.map((item, index) => {
            const images = getPropertyImages(item)
            const currentIndex = getInitialImageIndex(item.id)
            const isFavorited = interactions.favorited?.has(item.id)
            const isDiscarded = interactions.discarded?.has(item.id)
            const isExpanded = expandedItem === item.id

            return (
              <motion.div
                key={item.id}
                data-property-id={item.id}
                initial={{ opacity: 0, y: 32 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.06 }}
                ref={(el) => {
                  if (el && observerRef.current) {
                    observerRef.current.observe(el)
                  }
                }}
                className={`bg-white rounded-[20px] overflow-hidden shadow-sm border border-gray-200 transition-opacity ${
                  isDiscarded ? 'opacity-50' : ''
                }`}
              >
                {/* Image Carousel */}
                <div className="relative bg-gray-200">
                  <motion.div
                    drag="x"
                    dragElastic={0.1}
                    dragConstraints={{ left: -(images.length - 1) * 100, right: 0 }}
                    onDragEnd={(event, info) => {
                      const newIndex = Math.round(
                        -(info.offset.x / (window.innerWidth * 0.9))
                      )
                      setInitialImageIndex(
                        item.id,
                        Math.max(0, Math.min(newIndex, images.length - 1)),
                        images
                      )
                    }}
                    animate={{ x: -currentIndex * 100 + '%' }}
                    transition={{ type: 'spring', stiffness: 400, damping: 40 }}
                    className="flex w-full cursor-grab active:cursor-grabbing"
                  >
                    {images.map((image, imgIndex) => (
                      <div key={imgIndex} className="w-full flex-shrink-0">
                        <img
                          src={image}
                          alt={`${item.title} - Foto ${imgIndex + 1}`}
                          className="w-full aspect-[4/5] object-cover"
                        />
                      </div>
                    ))}
                  </motion.div>

                  {/* Image Navigation */}
                  {images.length > 1 && (
                    <>
                      {/* Right Arrow */}
                      <button
                        onClick={() => {
                          const nextIndex = Math.min(
                            currentIndex + 1,
                            images.length - 1
                          )
                          setInitialImageIndex(item.id, nextIndex, images)
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/70 hover:bg-white transition-all"
                      >
                        <ChevronRight size={20} className="text-gray-800" />
                      </button>

                      {/* Dot Indicators */}
                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                        {images.map((_, dotIndex) => (
                          <button
                            key={dotIndex}
                            onClick={() =>
                              setInitialImageIndex(item.id, dotIndex, images)
                            }
                            className={`transition-all ${
                              dotIndex === currentIndex
                                ? 'w-2 h-2 bg-[#C9A84C]'
                                : 'w-1.5 h-1.5 bg-gray-300'
                            }`}
                          />
                        ))}
                      </div>
                    </>
                  )}

                  {isDiscarded && (
                    <div className="absolute top-3 right-3 bg-gray-700 text-white px-3 py-1 rounded-full text-xs font-semibold">
                      Removido
                    </div>
                  )}

                  {item.internalCode && (
                    <div className="absolute top-3 left-3 px-2 py-0.5 rounded-full bg-white/80 backdrop-blur-sm border border-black/5 text-[#C9A84C] text-[10px] font-mono font-bold tracking-widest uppercase shadow-sm z-10">
                      Ref: {item.internalCode}
                    </div>
                  )}
                </div>

                {/* Card Body */}
                <div className="p-6 space-y-5">
                  <div className="space-y-1.5">
                    {/* Title */}
                    <div className="flex flex-col gap-2">
                      <h3 className="text-[26px] font-[family-name:var(--font-display)] text-[#1A1A1A] leading-[1.1] tracking-tight">
                        {item.title}
                      </h3>
                    </div>

                    {/* Price */}
                    <div className="text-[17px] font-medium text-[#C9A84C] tracking-wide">
                      {formatPrice(item.price)}
                    </div>
                  </div>

                  {/* Stats Line */}
                  <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-400 border-y border-gray-50 py-3">
                    <div className="flex items-center gap-1.5">
                      <Bed size={14} className="text-gray-300" />
                      <span>{item.bedrooms} Dorm</span>
                    </div>
                    <div className="w-1 h-1 rounded-full bg-gray-200" />
                    <div className="flex items-center gap-1.5">
                      <Bath size={14} className="text-gray-300" />
                      <span>{item.bathrooms} Suítes</span>
                    </div>
                    <div className="w-1 h-1 rounded-full bg-gray-200" />
                    <div className="flex items-center gap-1.5">
                      <Ruler size={14} className="text-gray-300 shrink-0" />
                      <div className="flex items-center gap-1 min-w-0 flex-wrap">
                        {item.area_privativa ? <span className="truncate">{item.area_privativa} m² Priv.</span> : null}
                        {item.area_privativa && item.area_total ? <span className="text-gray-200">/</span> : null}
                        {item.area_total ? <span className="truncate">{item.area_total} m² Tot.</span> : null}
                        {!item.area_privativa && !item.area_total && <span>-- m²</span>}
                      </div>
                    </div>
                  </div>

                  {/* Curator Quote */}
                  {item.recommendedReason && (
                    <div className="relative pl-4 border-l-2 border-[#C9A84C]/30 py-1">
                      <p className="text-[14px] text-gray-600 leading-relaxed font-light italic">
                        "{item.recommendedReason}"
                      </p>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex items-center gap-4 pt-2">
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => toggleFavorite(item.id)}
                      className={`p-2.5 rounded-full transition-all ${
                        isFavorited
                          ? 'text-[#C9A84C]'
                          : 'text-gray-400 hover:text-gray-600'
                      }`}
                      aria-label="Favoritar"
                    >
                      <motion.div
                        animate={isFavorited ? { scale: [1, 1.35, 0.9, 1] } : {}}
                        transition={{ duration: 0.3 }}
                      >
                        <Heart
                          size={22}
                          fill={isFavorited ? 'currentColor' : 'none'}
                        />
                      </motion.div>
                    </motion.button>

                    <button
                      onClick={() => setExpandedItem(isExpanded ? null : item.id)}
                      className={`p-2.5 rounded-full transition-all ${
                        isExpanded
                          ? 'text-[#C9A84C]'
                          : 'text-gray-400 hover:text-gray-600'
                      }`}
                      aria-label="Ver detalhes"
                    >
                      <Eye size={22} />
                    </button>

                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleDeleteProperty(item.id)}
                      className="p-2.5 rounded-full transition-all text-gray-400 hover:text-red-500 hover:bg-red-50"
                      aria-label="Excluir"
                    >
                      <X size={22} />
                    </motion.button>
                  </div>

                  {/* Inline Detail Panel */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 32 }}
                        className="overflow-hidden border-t border-gray-200 pt-4 space-y-3"
                      >
                        {item.location && (
                          <div className="flex gap-2 text-[13px] text-gray-700">
                            <MapPin size={16} className="flex-shrink-0 text-gray-400" />
                            <span>{item.location}</span>
                          </div>
                        )}

                        {item.description && (
                          <div className="space-y-2">
                            <h4 className="text-[12px] font-bold uppercase tracking-wider text-gray-400">Sobre o Imóvel</h4>
                            <p className="text-[14px] text-gray-700 leading-relaxed font-light">
                              {item.description}
                            </p>
                          </div>
                        )}

                        {item.note && (
                          <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                            <p className="text-[13px] text-gray-600 leading-relaxed italic">
                              "{item.note}"
                            </p>
                          </div>
                        )}

                        {item.videoUrl && (
                          <div className="aspect-video rounded-lg overflow-hidden bg-gray-200">
                            <iframe
                              src={item.videoUrl}
                              className="w-full h-full"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                            ></iframe>
                          </div>
                        )}

                        <button
                          onClick={() => handleWhatsAppClick(item)}
                          className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#1A1A1A] text-white rounded-xl text-[14px] font-semibold active:scale-[0.98] transition-all shadow-lg shadow-black/5"
                        >
                          <MessageCircle size={18} />
                          Tirar dúvidas no WhatsApp
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )
          })}
        </div>
      </main>

      {/* WhatsApp Floating Action Button (Optional, but we already have it in the card) */}

    </div>
  )
}
