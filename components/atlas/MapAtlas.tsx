"use client"

import { useState, useEffect, useRef, useMemo, memo, useCallback, forwardRef, useImperativeHandle } from "react"
import Map, { Marker, Popup, NavigationControl, Source, Layer } from "react-map-gl/mapbox"
import 'mapbox-gl/dist/mapbox-gl.css'
import type { ViewState } from "react-map-gl/mapbox"
import { motion, AnimatePresence } from "framer-motion"
import { Building2, Globe, Map as MapIcon } from "lucide-react"
import { HeatmapLayer } from "./HeatmapLayer"
import { ZenOverlay } from "./ZenOverlay"

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
  bedrooms?: number
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
  // Heatmap
  heatmapVisible?: boolean
  heatmapGeoJSON?: GeoJSON.FeatureCollection | null
  heatmapMetric?: string
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
const XANGRILA_CENTER = { longitude: -50.0333, latitude: -29.8000 }
const DEFAULT_ZOOM = 12

// Themes
const DARK_STYLE = "mapbox://styles/mapbox/dark-v11"
const LIGHT_STYLE = "mapbox://styles/mapbox/light-v11"
const SATELLITE_STYLE = "mapbox://styles/mapbox/satellite-streets-v12"

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
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  
  const markerColor = isDark ? '#d4af35' : 'var(--orbit-glow)'
  const markerPulseColor = isDark ? 'rgba(212, 175, 53, 0.5)' : 'rgba(var(--orbit-glow-rgb), 0.5)'

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
        <div className={`absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full animate-ping transition-opacity duration-1000 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} style={{ backgroundColor: markerPulseColor }}></div>
        <div 
          className={`absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border-2 transition-all duration-300 ${isSelected ? 'bg-white scale-125' : 'group-hover:bg-white group-hover:scale-110'}`}
          style={{ 
            backgroundColor: isSelected ? 'white' : markerColor,
            borderColor: isDark ? '#0a0907' : 'white',
            boxShadow: `0 0 8px ${markerPulseColor}`
          }}
        ></div>
      </div>
    </Marker>
  )
})
PropertyMarker.displayName = "PropertyMarker"

export const MapAtlas = forwardRef<any, MapAtlasProps>(function MapAtlasInner({
  properties,
  onPropertyClick,
  selectedPropertyId,
  className = "",
  initialCenter = [XANGRILA_CENTER.longitude, XANGRILA_CENTER.latitude],
  initialZoom = DEFAULT_ZOOM,
  previewMarker = null,
  isPlacing = false,
  onMapClick,
  heatmapVisible = false,
  heatmapGeoJSON = null,
  heatmapMetric = "all",
}, ref) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const mapRef = useRef<any>(null)
  const isInitialLoad = useRef(true)

  // Expor mapRef para uso externo (HeatmapLayer)
  useImperativeHandle(ref, () => ({
    getMapRef: () => mapRef,
  }))
  const [viewState, setViewState] = useState<ViewState>({
    longitude: initialCenter[0],
    latitude: initialCenter[1],
    zoom: initialZoom,
    padding: { top: 0, bottom: 0, left: 0, right: 0 },
    pitch: 45, // Angulação 3D inicial para ar mais moderno
    bearing: -17,
  })
 
  const [isSatellite, setIsSatellite] = useState(false)
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
      const style = isSatellite ? SATELLITE_STYLE : (isDark ? DARK_STYLE : LIGHT_STYLE)
      map.setStyle(style)
    }
  }, [isDark, isSatellite])

  // Auto-fit bounds (opcional: apenas no primeiro load)
  useEffect(() => {
    if (isInitialLoad.current && properties.length > 0 && mapRef.current) {
      // Evita fitBounds se já tiver selection ou se não quiser bagunçar a UX de entrada agressivamente
      isInitialLoad.current = false
    }
  }, [properties])

  if (!MAPBOX_TOKEN) {
    return (
      <div className={`flex items-center justify-center h-full w-full ${isDark ? 'bg-[#0a0a0a] text-zinc-400' : 'bg-[var(--orbit-bg)] text-[var(--orbit-text-muted)]'} ${className}`}>
        <div className={`text-center p-6 border rounded-xl backdrop-blur-xl ${isDark ? 'border-zinc-800 bg-black/40' : 'border-[var(--orbit-line)] bg-white/40'}`}>
          <p className="text-sm">Token do Mapbox não configurado</p>
          <p className="text-xs mt-2 font-mono opacity-50">NEXT_PUBLIC_MAPBOX_TOKEN</p>
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
    <div className={`relative h-full w-full overflow-hidden ${isDark ? 'bg-[#050505]' : 'bg-[var(--orbit-bg)]'} ${className}`}>
      <Map
        ref={mapRef}
        {...viewState}
        onMove={(evt: any) => setViewState(evt.viewState)}
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle={isSatellite ? SATELLITE_STYLE : (isDark ? DARK_STYLE : LIGHT_STYLE)}
        attributionControl={false}
        logoPosition="bottom-right"
        cursor={isPlacing ? "crosshair" : heatmapVisible ? "crosshair" : "grab"}
        onClick={(e) => {
          if (onMapClick) onMapClick(e.lngLat.lat, e.lngLat.lng)
        }}
      >
        <NavigationControl position="top-right" showCompass={true} />
 
         {/* Zen GroundOverlay (Empreendimento Zen) */}
         <ZenOverlay mapRef={mapRef} />

        {/* Heatmap Layer (headless, gerenciado via mapbox-gl nativo) */}
        <HeatmapLayer
          mapRef={mapRef}
          geojson={heatmapGeoJSON}
          visible={heatmapVisible}
          metric={heatmapMetric}
        />

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
              className={`w-44 rounded-xl backdrop-blur-xl border shadow-2xl pointer-events-none overflow-hidden flex flex-col ${
                isDark ? 'bg-[#0a0907]/95 border-[#d4af35]/30' : 'bg-white/95 border-[var(--orbit-line)]'
              }`}
            >
              {/* Cover Image Area */}
              <div className="h-20 w-full bg-zinc-800 bg-cover bg-center relative shrink-0" style={{ backgroundImage: hoveredProperty.coverImage ? `url(${hoveredProperty.coverImage})` : 'none' }}>
                {!hoveredProperty.coverImage && <div className={`absolute inset-0 flex items-center justify-center ${isDark ? 'text-[#d4af35]/20' : 'text-[var(--orbit-glow)]/20'}`}><Building2 className="w-5 h-5"/></div>}
                <div className={`absolute inset-0 bg-gradient-to-t via-transparent to-transparent ${isDark ? 'from-[#0a0907]' : 'from-white'}`} />
              </div>

              {/* Details */}
              <div className="p-2.5 flex flex-col gap-1.5 relative z-10 -mt-2">
                <p className={`text-[10px] font-bold line-clamp-2 leading-tight drop-shadow-md ${isDark ? 'text-white' : 'text-[var(--orbit-text)]'}`}>
                  {hoveredProperty.name || "Imóvel N/A"}
                </p>
                <div className="flex justify-between items-center">
                  <p className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-[#d4af35]' : 'text-[var(--orbit-glow)]'}`}>
                    {formatValue(hoveredProperty.value)}
                  </p>
                  <div className="flex items-center gap-2">
                    {hoveredProperty.bedrooms && (
                      <span className={`text-[9px] font-mono font-bold ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                        {hoveredProperty.bedrooms}Q
                      </span>
                    )}
                    {hoveredProperty.area_privativa && (
                      <span className={`text-[9px] font-mono font-bold ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                        {Math.round(hoveredProperty.area_privativa)}m²
                      </span>
                    )}
                  </div>
                </div>
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

      {/* Style Toggle Button */}
      <div className="absolute bottom-6 left-6 z-[110]">
        <button
          onClick={() => setIsSatellite(!isSatellite)}
          className={`group flex items-center gap-2 px-3 py-2 rounded-xl backdrop-blur-xl border transition-all shadow-2xl ${
            isSatellite 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-bold' 
              : isDark 
                ? 'bg-[#14120c]/80 border-[#d4af35]/20 text-[#d4af35]/60 hover:text-[#d4af35] font-bold' 
                : 'bg-white/80 border-[var(--orbit-line)] text-[var(--orbit-text-muted)] hover:text-[var(--orbit-text)] font-bold'
          }`}
        >
          {isSatellite ? (
            <>
              <MapIcon className="w-4 h-4 animate-in zoom-in duration-300" />
              <span className="text-[10px] uppercase tracking-widest">Mapa</span>
            </>
          ) : (
            <>
              <Globe className="w-4 h-4 group-hover:rotate-12 transition-transform" />
              <span className="text-[10px] uppercase tracking-widest">Satélite</span>
            </>
          )}
        </button>
      </div>

      {/* Global overrides para o react-map-gl popup container limpar fundos brancos nativos */}
      <style jsx global>{`
        .atlas-premium-popup .mapboxgl-popup-content {
          background: transparent !important;
          padding: 0 !important;
          box-shadow: none !important;
          border-radius: 1rem !important;
        }
        .atlas-premium-popup .mapboxgl-popup-tip {
          border-top-color: ${isDark ? '#0a0a0c' : 'white'} !important;
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
})

export default MapAtlas
