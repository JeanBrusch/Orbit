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
  area: number
  location?: string
  note?: string
  videoUrl?: string
  url?: string
  coverImage: string
  photos?: PropertyPhoto[]
  recommendedReason?: string
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
  const [interactions, setInteractions] = useState<Interaction>({
    favorited: new Set(initialInteractions.favorited || []),
    discarded: new Set(initialInteractions.discarded || []),
    viewed: new Set(initialInteractions.viewed || []),
    scrollDepth: initialInteractions.scrollDepth || 0,
  })
  const [expandedItem, setExpandedItem] = useState<string | null>(null)
  const [chatProperty, setChatProperty] = useState<Property | null>(null)
  const [currentImageIndex, setCurrentImageIndex] = useState<
    Record<string, number>
  >({})
  const [chatMessage, setChatMessage] = useState('')
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

  const toggleDiscarded = (propertyId: string) => {
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

  const handleChatSubmit = async (propertyId: string) => {
    if (!chatMessage.trim()) return

    if (lead.id) {
      trackInteraction(propertyId, 'property_question', {
        message: chatMessage,
      })
    }

    setChatMessage('')
    setChatProperty(null)
    toast.success('Mensagem enviada com sucesso!')
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
        <div className="px-4 py-6">
          <div className="space-y-1">
            <div className="text-base">
              <span className="text-gray-500">Olá, </span>
              <span className="text-[#C9A84C] font-bold">{lead.firstName}</span>
              <span className="text-[#C9A84C] ml-1">♦</span>
            </div>
            <p className="text-[14px] text-gray-600">
              Selecionamos estes imóveis especialmente para você.
            </p>
          </div>
        </div>

        {/* Properties Feed */}
        <div className="space-y-4 px-4 pb-4">
          {items.map((item, index) => {
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
                          className="w-full h-[56vw] max-h-[340px] object-cover"
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
                </div>

                {/* Card Body */}
                <div className="p-5 space-y-4">
                  {/* Title */}
                  <h3 className="text-[22px] font-bold text-[#1A1A1A] leading-tight line-clamp-2 font-serif">
                    {item.title}
                  </h3>

                  {/* Price */}
                  <div className="text-[20px] font-bold text-[#C9A84C]">
                    {formatPrice(item.price)}
                  </div>

                  {/* Stats */}
                  <div className="flex gap-4 text-[13px] text-gray-500">
                    <div className="flex items-center gap-2">
                      <Bed size={16} />
                      <span>{item.bedrooms} quartos</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Bath size={16} />
                      <span>{item.bathrooms} suítes</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Ruler size={16} />
                      <span>{item.area} m²</span>
                    </div>
                  </div>

                  {/* Curator Quote */}
                  {item.recommendedReason && (
                    <div className="bg-[#FFFBF0] border border-[#F0E6CC] rounded-[12px] p-3.5 space-y-1">
                      <div className="text-[#C9A84C] text-xs">✦</div>
                      <p className="text-[13px] text-gray-600 italic">
                        {item.recommendedReason}
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
                      onClick={() => toggleDiscarded(item.id)}
                      className={`p-2.5 rounded-full transition-all ${
                        isDiscarded
                          ? 'text-red-400'
                          : 'text-gray-400 hover:text-gray-600'
                      }`}
                      aria-label="Descartar"
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

                        {item.note && (
                          <p className="text-[13px] text-gray-600 leading-relaxed">
                            {item.note}
                          </p>
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
                          onClick={() => setChatProperty(item)}
                          className="inline-flex items-center gap-2 text-[13px] font-medium text-[#C9A84C] hover:underline"
                        >
                          <MessageCircle size={14} />
                          Alguma dúvida sobre este imóvel?
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

      {/* Bottom Sheet Chat */}
      <AnimatePresence>
        {chatProperty && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setChatProperty(null)}
              className="fixed inset-0 bg-black/30 z-40"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 32 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-[24px] max-w-md mx-auto"
              style={{ height: '60vh' }}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <img
                    src={chatProperty.coverImage}
                    alt={chatProperty.title}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 truncate">
                      {chatProperty.title}
                    </h4>
                  </div>
                </div>
                <button
                  onClick={() => setChatProperty(null)}
                  className="p-1.5 hover:bg-gray-100 rounded-full transition-all"
                >
                  <X size={20} className="text-gray-500" />
                </button>
              </div>

              {/* Chat Content */}
              <div className="flex-1 overflow-y-auto p-4">
                <p className="text-sm text-gray-500">
                  Envie sua dúvida sobre este imóvel para o agente.
                </p>
              </div>

              {/* Input */}
              <div className="border-t border-gray-200 p-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Sua dúvida sobre este imóvel..."
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleChatSubmit(chatProperty.id)
                      }
                    }}
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C9A84C]"
                  />
                  <button
                    onClick={() => handleChatSubmit(chatProperty.id)}
                    className="px-4 py-2 bg-[#C9A84C] text-white text-sm font-medium rounded-lg hover:bg-[#B89438] transition-all"
                  >
                    Enviar
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  )
}
