"use client"

import { useState, useEffect, useRef, useMemo, memo, useCallback } from "react"
import Map, { Marker, Popup, NavigationControl } from "react-map-gl/mapbox"
import type { ViewState } from "react-map-gl/mapbox"
import { motion, AnimatePresence } from "framer-motion"
import { Building2, X } from "lucide-react"

import { useTheme } from "next-themes"

export interface MapProperty {
  id: string
  name: string
  lat: number | null
  lng: number | null
  value: number | null
  locationText?: string | null
  coverImage?: string | null
  url?: string | null
  features?: string[]
  payment_conditions?: Record<string, any>
  area_privativa?: number
}

interface MapAtlasProps {
  properties: MapProperty[]
  onPropertyClick?: (property: MapProperty) => void
  selectedPropertyId?: string | null
  className?: string
  initialCenter?: [number, number]
  initialZoom?: number
  previewMarker?: { lat: number; lng: number } | null
  isPlacing?: boolean
  onMapClick?: (lat: number, lng: number) => void
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
const XANGRILA_CENTER = { longitude: -50.0333, latitude: -29.8000 }
const DEFAULT_ZOOM = 12

// Themes
const DARK_STYLE = "mapbox://styles/mapbox/dark-v11"
const LIGHT_STYLE = "mapbox://styles/mapbox/light-v11"

function formatValue(value: number | null): string {
  if (value === null || value === 0) return ""
  if (value >= 1_000_000) {
    const millions = value / 1_000_000
    return millions % 1 === 0 ? `R$ ${millions}M` : `R$ ${millions.toFixed(1)}M`
  }
  if (value >= 1_000) {
    const thousands = value / 1_000
    return thousands % 1 === 0 ? `R$ ${thousands}k` : `R$ ${thousands.toFixed(0)}k`
  }
  return `R$ ${value}`
}

const PropertyMarker = memo(({ 
  prop, 
  isSelected, 
  isHovered, 
  onClick, 
  onMouseEnter, 
  onMouseLeave 
}: { 
  prop: MapProperty; 
  isSelected: boolean; 
  isHovered: boolean; 
  onClick: (prop: MapProperty) => void;
  onMouseEnter: (prop: MapProperty) => void;
  onMouseLeave: () => void;
}) => {
  return (
    <Marker 
      longitude={prop.lng!} 
      latitude={prop.lat!}
      anchor="center"
      style={{ zIndex: isSelected ? 50 : isHovered ? 40 : 10 }}
    >
      <div 
        className="group w-0 h-0 relative cursor-pointer"
        onClick={(e) => {
          e.stopPropagation()
          onClick(prop)
        }}
        onMouseEnter={() => onMouseEnter(prop)}
        onMouseLeave={() => onMouseLeave()}
      >
        <div className={`absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full animate-ping ${isSelected ? 'bg-[#d4af35]/50 opacity-100 duration-1000' : 'bg-[#d4af35]/30 opacity-0 group-hover:opacity-100'}`}></div>
        <div className={`absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border-2 border-[#0a0907] shadow-[0_0_8px_rgba(212,175,53,0.5)] transition-all duration-300 ${isSelected ? 'bg-white scale-125' : 'bg-[#d4af35] group-hover:bg-[#fcd34d] group-hover:scale-110'}`}></div>
      </div>
    </Marker>
  )
})
PropertyMarker.displayName = "PropertyMarker"

export function MapAtlas({
  properties,
  onPropertyClick,
  selectedPropertyId,
  className = "",
  initialCenter = [XANGRILA_CENTER.longitude, XANGRILA_CENTER.latitude],
  initialZoom = DEFAULT_ZOOM,
  previewMarker = null,
  isPlacing = false,
  onMapClick,
}: MapAtlasProps) {
  const { theme } = useTheme()
  const mapRef = useRef<any>(null)
  const isInitialLoad = useRef(true)
  const [viewState, setViewState] = useState<ViewState>({
    longitude: initialCenter[0],
    latitude: initialCenter[1],
    zoom: initialZoom,
    padding: { top: 0, bottom: 0, left: 0, right: 0 },
    pitch: 45, // Angulação 3D inicial para ar mais moderno
    bearing: -17,
  })

  const [hoveredProperty, setHoveredProperty] = useState<MapProperty | null>(null)
  const selectedProp = useMemo(() => properties.find(p => p.id === selectedPropertyId), [properties, selectedPropertyId])

  // FlyTo selecionado
  useEffect(() => {
    if (selectedProp && selectedProp.lat && selectedProp.lng && mapRef.current) {
      mapRef.current.flyTo({
        center: [selectedProp.lng, selectedProp.lat],
        zoom: 16,
        pitch: 60,
        duration: 2000,
        essential: true,
      })
    }
  }, [selectedProp])

  // Theme handler via setStyle (avoids remounting map and dropping layers)
  useEffect(() => {
    if (!mapRef.current) return
    const map = mapRef.current.getMap()
    if (map) {
      const style = theme === "dark" || theme === "system" ? DARK_STYLE : LIGHT_STYLE
      map.setStyle(style)
    }
  }, [theme])

  // Auto-fit bounds (opcional: apenas no primeiro load)
  useEffect(() => {
    if (isInitialLoad.current && properties.length > 0 && mapRef.current) {
      // Evita fitBounds se já tiver selection ou se não quiser bagunçar a UX de entrada agressivamente
      isInitialLoad.current = false
    }
  }, [properties])

  if (!MAPBOX_TOKEN) {
    return (
      <div className={`flex items-center justify-center bg-[#0a0a0a] text-zinc-400 ${className}`}>
        <div className="text-center p-6 border border-zinc-800 rounded-xl bg-black/40 backdrop-blur-xl">
          <p className="text-sm text-zinc-300">Token do Mapbox não configurado</p>
          <p className="text-xs mt-2 text-zinc-500 font-mono">NEXT_PUBLIC_MAPBOX_TOKEN</p>
        </div>
      </div>
    )
  }

  const validProps = properties.filter(p => p.lat !== null && p.lng !== null)

  const handleMarkerClick = useCallback((p: MapProperty) => {
    onPropertyClick?.(p)
  }, [onPropertyClick])

  const handleMarkerMouseEnter = useCallback((p: MapProperty) => {
    setHoveredProperty(p)
  }, [])

  const handleMarkerMouseLeave = useCallback(() => {
    setHoveredProperty(null)
  }, [])

  return (
    <div className={`relative bg-[#050505] h-full w-full overflow-hidden ${className}`}>
      <Map
        ref={mapRef}
        {...viewState}
        onMove={(evt: any) => setViewState(evt.viewState)}
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle={DARK_STYLE}
        attributionControl={false}
        logoPosition="bottom-right"
        cursor={isPlacing ? "crosshair" : "grab"} // Overrides mapbox native cursor
        onClick={(e) => {
          if (onMapClick) onMapClick(e.lngLat.lat, e.lngLat.lng)
        }}
      >
        <NavigationControl position="top-right" showCompass={true} />

        {/* Constelação de Imóveis (Markers) */}
        {validProps.map((prop) => (
          <PropertyMarker
            key={prop.id}
            prop={prop}
            isSelected={selectedPropertyId === prop.id}
            isHovered={hoveredProperty?.id === prop.id}
            onClick={handleMarkerClick}
            onMouseEnter={handleMarkerMouseEnter}
            onMouseLeave={handleMarkerMouseLeave}
          />
        ))}

        {/* Unified Hover Popup (Performance optimization: one component instead of N) */}
        {hoveredProperty && hoveredProperty.lat && hoveredProperty.lng && (
          <Popup
            longitude={hoveredProperty.lng}
            latitude={hoveredProperty.lat}
            closeButton={false}
            anchor="bottom"
            offset={20}
            className="atlas-premium-popup z-[60]"
          >
            <motion.div 
              initial={{ opacity: 0, y: 5, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="w-44 rounded-xl bg-[#0a0907]/95 backdrop-blur-xl border border-[#d4af35]/30 shadow-2xl pointer-events-none overflow-hidden flex flex-col"
            >
              {/* Cover Image Area */}
              <div className="h-20 w-full bg-zinc-800 bg-cover bg-center relative shrink-0" style={{ backgroundImage: hoveredProperty.coverImage ? `url(${hoveredProperty.coverImage})` : 'none' }}>
                {!hoveredProperty.coverImage && <div className="absolute inset-0 flex items-center justify-center text-[#d4af35]/20"><Building2 className="w-5 h-5"/></div>}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0a0907] via-transparent to-transparent" />
              </div>

              {/* Details */}
              <div className="p-2.5 flex flex-col gap-1.5 relative z-10 -mt-2">
                <p className="text-[10px] font-bold text-white line-clamp-2 leading-tight drop-shadow-md">
                  {hoveredProperty.name || "Imóvel N/A"}
                </p>
                <p className="text-[10px] font-bold text-[#d4af35] uppercase tracking-wider">
                  {formatValue(hoveredProperty.value)}
                </p>
              </div>
            </motion.div>
          </Popup>
        )}


        {/* Preview Marker para Ingestão (Drag n Drop) */}
        {previewMarker && (
          <Marker longitude={previewMarker.lng} latitude={previewMarker.lat} anchor="center">
            <div className="relative w-0 h-0 pointer-events-none">
              <div className="absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-fuchsia-500/30 animate-ping" />
              <div className="absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full border-2 border-white bg-gradient-to-tr from-fuchsia-600 to-indigo-600 shadow-[0_0_15px_rgba(217,70,239,0.5)] z-10" />
            </div>
          </Marker>
        )}

      </Map>

      {/* Global overrides para o react-map-gl popup container limpar fundos brancos nativos */}
      <style jsx global>{`
        .atlas-premium-popup .mapboxgl-popup-content {
          background: transparent !important;
          padding: 0 !important;
          box-shadow: none !important;
          border-radius: 1rem !important;
        }
        .atlas-premium-popup .mapboxgl-popup-tip {
          border-top-color: #0a0a0c !important;
          border-top-width: 8px !important;
        }
        .atlas-premium-popup .mapboxgl-popup-close-button {
          display: none !important;
        }
        /* Omitir logos nativos polutivos */
        .mapboxgl-ctrl-bottom-left, .mapboxgl-ctrl-bottom-right {
          mix-blend-mode: luminosity;
          opacity: 0.5;
        }
      `}</style>
    </div>
  )
}

export default MapAtlas
