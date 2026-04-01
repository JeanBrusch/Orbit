"use client"

import { useState, useEffect, useRef, useMemo, memo, useCallback, forwardRef, useImperativeHandle } from "react"
import Map, { Marker, Popup, NavigationControl } from "react-map-gl/mapbox"
import 'mapbox-gl/dist/mapbox-gl.css'
import type { ViewState } from "react-map-gl/mapbox"
import { motion } from "framer-motion"
import { Globe, Map as MapIcon, Ruler } from "lucide-react"
import { ZenOverlay } from "./ZenOverlay"
import { PropertyCarousel } from "./PropertyCarousel"
import { PropertyPopup } from "./PropertyPopup"
import { useTheme } from "next-themes"
import type { MapMode } from "@/components/atlas/AtlasTopBar"
import { usePropertyDecay } from "@/hooks/use-property-decay"

export interface MapProperty {
  id: string
  name: string
  lat: number | null
  lng: number | null
  value: number | null
  locationText?: string | null
  neighborhood?: string | null
  coverImage?: string | null
  photos?: string[]
  url?: string | null
  features?: string[]
  payment_conditions?: Record<string, any>
  area_privativa?: number
  area_total?: number
  bedrooms?: number
  suites?: string | number
  parking_spots?: string | number
  internalCode?: string | null
  // Match fields (injected externally)
  matchScore?: number // 0–100
  lastInteractionAt?: string | null // ISO date
  status?: "available" | "reserved" | "sold"
  interactionType?: 'sent' | 'favorited' | 'portal'
}

interface MapAtlasProps {
  properties: MapProperty[]
  onPropertyClick?: (property: MapProperty) => void
  onPropertyDeselect?: () => void
  selectedPropertyId?: string | null
  className?: string
  initialCenter?: [number, number]
  initialZoom?: number
  previewMarker?: { lat: number; lng: number } | null
  isPlacing?: boolean
  onMapClick?: (lat: number, lng: number) => void
  // New Phase 1 props
  mapMode?: MapMode
  activeLeadId?: string | null
  leadInteractions?: Record<string, 'sent' | 'favorited' | 'portal'>
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
const XANGRILA_CENTER = { longitude: -50.0333, latitude: -29.8000 }
const DEFAULT_ZOOM = 12

const DARK_STYLE = "mapbox://styles/mapbox/dark-v11"
const LIGHT_STYLE = "mapbox://styles/mapbox/light-v11"
const SATELLITE_STYLE = "mapbox://styles/mapbox/satellite-streets-v12"

// Atlas design tokens
const TOKEN = {
  primary: "#3B82F6",    // Blue-500 — visibility on satellite
  primaryBright: "#60A5FA", // Blue-400 — hover/glow
  zinc: "#52524F",
  amber: "#F59E0B",       // Reserved status
  coral: "#EF4444",       // Sold status
}

function formatValue(value: number | null): string {
  if (value === null || value === 0) return ""
  if (value >= 1_000_000) {
    const m = value / 1_000_000
    return m % 1 === 0 ? `R$ ${m}M` : `R$ ${m.toFixed(1)}M`
  }
  if (value >= 1_000) {
    const k = value / 1_000
    return k % 1 === 0 ? `R$ ${k}k` : `R$ ${k.toFixed(0)}k`
  }
  return `R$ ${value}`
}

// Core color by status
function getCoreColor(status?: string): string {
  switch (status) {
    case "reserved": return TOKEN.amber
    case "sold": return TOKEN.zinc
    default: return TOKEN.primary
  }
}

// ── Marker System 2.0 ─────────────────────────────────────────────────────────
// Two-layer anatomy:
//   Inner Core: 14px — status color (fixed, reality layer)
//   Outer Field: variable ring — match score (intent layer)
// ─────────────────────────────────────────────────────────────────────────────

const PropertyMarker = memo(({ 
  prop, 
  isSelected, 
  isHovered, 
  onClick, 
  onMouseEnter, 
  onMouseLeave,
  mapMode,
  hasActiveLead,
  interactionType,
}: { 
  prop: MapProperty
  isSelected: boolean
  isHovered: boolean
  onClick: (prop: MapProperty) => void
  onMouseEnter: (prop: MapProperty) => void
  onMouseLeave: () => void
  mapMode: MapMode
  hasActiveLead: boolean
  interactionType?: 'sent' | 'favorited' | 'portal'
}) => {
  const { decay, isUrgent } = usePropertyDecay(prop.lastInteractionAt, prop.matchScore)
  const score = prop.matchScore ?? 0 // 0–100
  const coreColor = getCoreColor(prop.status)
  
  // Momentum Glow: Extra glow for premium matches (score > 85)
  const isPremium = score >= 85 && hasActiveLead

  // In "inventory" mode: no lead influence, uniform rings
  // In "intent" mode: full gravitational influence
  // In "hybrid" (default): core is status, ring is match
  const showRing = mapMode !== "inventory" && hasActiveLead
  const ringRadius = showRing
    ? score >= 80 ? 22 : score >= 50 ? 18 : 0
    : 14
  const ringOpacity = showRing
    ? score >= 80 ? 0.9 : score >= 50 ? 0.55 : 0
    : 0.25

  // Marker scale by match (intent/hybrid) or uniform (inventory)
  const markerScale = mapMode === "inventory" || !hasActiveLead
    ? (interactionType ? 1.05 : 1)
    : score >= 80 ? 1.3 : score >= 50 ? 1.1 : 0.85
    
  // Interaction colors
  const interactionColor = interactionType === 'sent' 
    ? '#10B981' // Emerald (Sent)
    : interactionType === 'portal' 
      ? '#FBBF24' // Amber (Portal Selection) 
      : '#3B82F6' // Blue (Favorited/Acervo)

  // Opacity modulation
  // intent mode: hide noise (low matches)
  const baseOpacity = 1.0 - (decay * 0.45)
  let intentOpacity = baseOpacity
  
  if (mapMode === "intent" && hasActiveLead) {
    if (score < 40) intentOpacity = 0.05 // Almost hidden
    else if (score < 60) intentOpacity = 0.4
    else intentOpacity = 1
  } else if (mapMode === "inventory") {
    intentOpacity = 1 // Reality is clear
  }

  const size = isSelected ? 52 : isHovered ? 46 : 36

  return (
    <Marker 
      longitude={prop.lng!} 
      latitude={prop.lat!}
      anchor="center"
      style={{ zIndex: isSelected ? 50 : isHovered ? 40 : 10 }}
    >
      <div 
        className="group relative cursor-pointer"
        style={{
          width: size,
          height: size,
          opacity: intentOpacity,
          transform: `scale(${markerScale})`,
          transition: "opacity 400ms ease, transform 300ms ease",
        }}
        onClick={(e) => { e.stopPropagation(); onClick(prop) }}
        onMouseEnter={() => onMouseEnter(prop)}
        onMouseLeave={() => onMouseLeave()}
      >
        <svg
          viewBox="0 0 52 52"
          width={size}
          height={size}
          style={{ overflow: "visible" }}
        >
          {/* Momentum Glow — high intense glow for premium high matches */}
          {isPremium && (
            <>
              <defs>
                <radialGradient id={`premiumGlow-${prop.id}`} cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor={TOKEN.primaryBright} stopOpacity="0.4" />
                  <stop offset="100%" stopColor={TOKEN.primaryBright} stopOpacity="0" />
                </radialGradient>
              </defs>
              <circle
                cx="26" cy="26" r="26"
                fill={`url(#premiumGlow-${prop.id})`}
                style={{
                  animation: "momentum-glow 3s ease-in-out infinite",
                }}
              />
            </>
          )}

          {/* Urgency pulse ring */}
          {isUrgent && (
            <circle
              cx="26" cy="26" r="24"
              fill="none"
              stroke={TOKEN.primaryBright}
              strokeWidth="2"
              opacity={0.6}
              style={{
                animation: "urgency-pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite",
              }}
            />
          )}

          {/* Outer Field — match ring (intent layer) */}
          {ringRadius > 0 && (
            <circle
              cx="26" cy="26"
              r={ringRadius}
              fill="none"
              stroke={coreColor}
              strokeWidth={score >= 80 ? 1.5 : 1}
              opacity={ringOpacity}
              style={{
                transition: "r 400ms cubic-bezier(0.19,1,0.22,1), opacity 400ms ease",
              }}
            />
          )}

          {/* Inner Core — status dot */}
          <circle
            cx="26" cy="26" r="7"
            fill={isSelected ? "white" : (interactionType ? interactionColor : coreColor)}
            stroke={isSelected ? (interactionType ? interactionColor : coreColor) : "#0A0A0F"}
            strokeWidth={interactionType ? "3" : "2"}
            style={{
              transition: "r 300ms ease, fill 300ms ease",
            }}
          />
          
          {/* Interaction Halo — specific indicator for Acervo/Proposto */}
          {interactionType && (
            <circle 
              cx="26" cy="26" r="11"
              fill="none"
              stroke={interactionColor}
              strokeWidth="2"
              strokeDasharray="4 2"
              opacity={0.8}
            />
          )}

          {/* Selected state: expanded core */}
          {isSelected && (
            <circle
              cx="26" cy="26" r="10"
              fill="none"
              stroke="white"
              strokeWidth="1"
              opacity={0.4}
            />
          )}
        </svg>
      </div>

      {/* Animation keyframes */}
      <style>{`
        @keyframes urgency-pulse {
          0% { transform: scale(0.8); opacity: 0.1; stroke-width: 3; }
          70% { transform: scale(1.1); opacity: 0.5; stroke-width: 1.5; }
          100% { transform: scale(1.2); opacity: 0; stroke-width: 0.5; }
        }
        @keyframes momentum-glow {
          0%, 100% { opacity: 0.2; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.2); }
        }
      `}</style>
    </Marker>
  )
})
PropertyMarker.displayName = "PropertyMarker"

// ── MapAtlas Component ────────────────────────────────────────────────────────

export const MapAtlas = forwardRef<any, MapAtlasProps>(function MapAtlasInner({
  properties,
  onPropertyClick,
  onPropertyDeselect,
  selectedPropertyId,
  className = "",
  initialCenter = [XANGRILA_CENTER.longitude, XANGRILA_CENTER.latitude],
  initialZoom = DEFAULT_ZOOM,
  previewMarker = null,
  isPlacing = false,
  onMapClick,
  mapMode = "hybrid" as MapMode,
  activeLeadId,
  leadInteractions = {} as Record<string, 'sent' | 'favorited' | 'portal'>,
}, ref) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"
  const mapRef = useRef<any>(null)
  const isInitialLoad = useRef(true)

  const [viewState, setViewState] = useState<ViewState>({
    longitude: initialCenter[0],
    latitude: initialCenter[1],
    zoom: initialZoom,
    padding: { top: 0, bottom: 0, left: 0, right: 0 },
    pitch: 45,
    bearing: -17,
  })

  const [isSatellite, setIsSatellite] = useState(false)
  const [hoveredProperty, setHoveredProperty] = useState<MapProperty | null>(null)
  const [clickedProperty, setClickedProperty] = useState<MapProperty | null>(null)

  useImperativeHandle(ref, () => ({
    getMapRef: () => mapRef,
  }))

  const selectedProp = useMemo(
    () => properties.find(p => p.id === selectedPropertyId),
    [properties, selectedPropertyId]
  )

  // FlyTo selected
  useEffect(() => {
    if (selectedProp?.lat && selectedProp?.lng && mapRef.current) {
       setClickedProperty(selectedProp)
       mapRef.current.flyTo({
        center: [selectedProp.lng, selectedProp.lat],
        zoom: 16,
        pitch: 60,
        duration: 2000,
        essential: true,
      })
    }
  }, [selectedProp])

  // Theme (uses setStyle to avoid remounting map)
  useEffect(() => {
    if (!mapRef.current) return
    const map = mapRef.current.getMap()
    if (map) {
      const style = isSatellite ? SATELLITE_STYLE : (isDark ? DARK_STYLE : LIGHT_STYLE)
      map.setStyle(style)
    }
  }, [isDark, isSatellite])

  useEffect(() => {
    if (isInitialLoad.current && properties.length > 0 && mapRef.current) {
      isInitialLoad.current = false
    }
  }, [properties])

  if (!MAPBOX_TOKEN) {
    return (
      <div className={`flex items-center justify-center h-full w-full ${className}`}>
        <div className="text-center p-6 border rounded-xl">
          <p className="text-sm">Token do Mapbox não configurado</p>
          <p className="text-xs mt-2 font-mono opacity-50">NEXT_PUBLIC_MAPBOX_TOKEN</p>
        </div>
      </div>
    )
  }

  const validProps = properties.filter(p => p.lat !== null && p.lng !== null)
  const hasActiveLead = Boolean(activeLeadId)

  // Click handler
  const handleMapClick = (e: any) => {
    if (onMapClick && isPlacing) {
        onMapClick(e.lngLat.lat, e.lngLat.lng)
    } else {
        setClickedProperty(null)
        onPropertyDeselect?.()
    }
  }

  const handleMarkerClick = useCallback((p: MapProperty) => {
    setClickedProperty(p)
    onPropertyClick?.(p)
    
    // Zoom in on click
    if (mapRef.current && p.lat && p.lng) {
        mapRef.current.flyTo({
            center: [p.lng, p.lat],
            zoom: 17,
            pitch: 55,
            duration: 1500,
            essential: true
        })
    }
  }, [onPropertyClick])

  const handleMouseEnter = useCallback((p: MapProperty) => {
    setHoveredProperty(p)
  }, [])

  const handleMouseLeave = useCallback(() => {
    setHoveredProperty(null)
  }, [])

  return (
    <div className={`relative h-full w-full overflow-hidden ${isDark ? "bg-[#050505]" : "bg-[#F7F7F9]"} ${className}`}>
      <Map
        ref={mapRef}
        {...viewState}
        onMove={(evt: any) => setViewState(evt.viewState)}
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle={isSatellite ? SATELLITE_STYLE : (isDark ? DARK_STYLE : LIGHT_STYLE)}
        attributionControl={false}
        logoPosition="bottom-right"
        cursor={isPlacing ? "crosshair" : "grab"}
        onClick={handleMapClick}
      >
        <NavigationControl position="top-right" showCompass={true} />

        {/* Zen GroundOverlay */}
        <ZenOverlay mapRef={mapRef} />

        {/* Marker constellation */}
        {validProps.map((prop) => (
          <PropertyMarker
            key={prop.id}
            prop={prop}
            isSelected={clickedProperty?.id === prop.id}
            isHovered={hoveredProperty?.id === prop.id}
            onClick={handleMarkerClick}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            mapMode={(mapMode as any)}
            hasActiveLead={hasActiveLead}
            interactionType={leadInteractions[prop.id]}
          />
        ))}

        {/* Rich Hover Popup (Reality Layer) */}
        {hoveredProperty?.lat && hoveredProperty?.lng && hoveredProperty.id !== clickedProperty?.id && (
          <Popup
            longitude={hoveredProperty.lng}
            latitude={hoveredProperty.lat}
            closeButton={false}
            anchor="bottom"
            offset={15}
            className="atlas-rich-hover-popup z-[60]"
          >
            <motion.div 
               initial={{ opacity: 0, y: 10, scale: 0.95 }}
               animate={{ opacity: 1, y: 0, scale: 1 }}
               className={`w-64 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-3xl border ${
                 isDark ? 'bg-[#0a0a0f]/95 border-white/10' : 'bg-white/95 border-slate-200'
               }`}
            >
               <div className="relative h-32 w-full overflow-hidden">
                 {(hoveredProperty.photos && hoveredProperty.photos.length > 0) ? (
                   <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${hoveredProperty.photos[0]})` }} />
                 ) : hoveredProperty.coverImage ? (
                   <img src={hoveredProperty.coverImage} alt="" className="h-full w-full object-cover" />
                 ) : (
                   <div className={`h-full w-full ${isDark ? 'bg-zinc-800' : 'bg-slate-200'}`} />
                 )}
                 <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                 {hoveredProperty.photos && hoveredProperty.photos.length > 1 && (
                   <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/50 backdrop-blur-md text-[8px] font-mono text-white/80">
                     {hoveredProperty.photos.length}f
                   </div>
                 )}
               </div>
               
               <div className="p-3 space-y-2">
                 <div className="space-y-0.5">
                   <div className={`text-[11px] font-bold leading-tight line-clamp-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                     {hoveredProperty.name}
                   </div>
                   <div className={`text-[9px] uppercase tracking-wider opacity-50 ${isDark ? 'text-white/60' : 'text-slate-500'}`}>
                     {hoveredProperty.neighborhood || hoveredProperty.locationText || "Localização"}
                   </div>
                 </div>
                 
                 <div className="flex items-center justify-between">
                   <span className="text-[13px] font-mono font-bold" style={{ color: TOKEN.primary }}>
                     {formatValue(hoveredProperty.value)}
                   </span>
                 </div>

                 <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/5">
                    <div className="flex items-center gap-1">
                      <Ruler className="w-3 h-3 text-zinc-500" />
                      <span className="text-[10px] font-medium text-zinc-400">{hoveredProperty.area_privativa || 0}m²</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {Number(hoveredProperty.bedrooms ?? 0) > 0 && (
                        <span className="text-[9px] font-bold text-zinc-500">{hoveredProperty.bedrooms}Q</span>
                      )}
                      {Number(hoveredProperty.suites ?? 0) > 0 && (
                        <span className="text-[9px] font-bold text-zinc-500">{hoveredProperty.suites}Suite</span>
                      )}
                      {Number(hoveredProperty.parking_spots ?? 0) > 0 && (
                        <span className="text-[9px] font-bold text-zinc-500">{hoveredProperty.parking_spots}V</span>
                      )}
                    </div>
                 </div>
               </div>
            </motion.div>
          </Popup>
        )}

        {/* Detailed Click Popup (Intent/Action Layer) */}
        {clickedProperty?.lat && clickedProperty?.lng && (
            <Popup
                longitude={clickedProperty.lng}
                latitude={clickedProperty.lat}
                closeButton={false}
                closeOnClick={false}
                onClose={() => setClickedProperty(null)}
                anchor="bottom"
                offset={25}
                className="atlas-premium-popup z-[70]"
            >
                <PropertyPopup 
                    property={clickedProperty} 
                    isDark={isDark} 
                    onOpenDetails={() => {
                        // This can trigger the sidebar in the parent
                        onPropertyClick?.(clickedProperty)
                    }}
                    onClose={() => setClickedProperty(null)}
                />
            </Popup>
        )}

        {/* Preview Marker (property placement during ingestion) */}
        {previewMarker && (
          <Marker longitude={previewMarker.lng} latitude={previewMarker.lat} anchor="center">
            <div className="relative w-0 h-0 pointer-events-none">
              <div className="absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-fuchsia-500/30 animate-ping" />
              <div className="absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full border-2 border-white bg-gradient-to-tr from-fuchsia-600 to-indigo-600 shadow-[0_0_15px_rgba(217,70,239,0.5)] z-10" />
            </div>
          </Marker>
        )}

      </Map>

      {/* Satellite toggle */}
      <div className="absolute bottom-6 left-6 z-[110]">
        <button
          onClick={() => setIsSatellite(!isSatellite)}
          className={`group flex items-center gap-2 px-3 py-2 rounded-xl backdrop-blur-xl border transition-all shadow-2xl ${
            isSatellite 
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-bold" 
              : isDark 
                ? "bg-[#14120c]/80 border-[#C9A84C]/20 text-[#C9A84C]/60 hover:text-[#C9A84C] font-bold" 
                : "bg-white/80 border-[var(--orbit-line)] text-[var(--orbit-text-muted)] hover:text-[var(--orbit-text)] font-bold"
          }`}
        >
          {isSatellite ? (
            <>
              <MapIcon className="w-4 h-4" />
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

      {/* Global popup overrides */}
      <style>{`
        .atlas-rich-hover-popup .mapboxgl-popup-content {
          background: transparent !important;
          padding: 0 !important;
          box-shadow: none !important;
          border-radius: 1rem !important;
        }
        .atlas-rich-hover-popup .mapboxgl-popup-tip {
             display: none !important;
        }
        .atlas-premium-popup .mapboxgl-popup-content {
          background: transparent !important;
          padding: 0 !important;
          box-shadow: none !important;
          border-radius: 2rem !important;
        }
        .atlas-premium-popup .mapboxgl-popup-tip {
          border-top-color: ${isDark ? "#0A0A0F" : "white"} !important;
          border-top-width: 8px !important;
          opacity: 0.9;
        }
        .atlas-premium-popup .mapboxgl-popup-close-button {
          display: none !important;
        }
        .mapboxgl-ctrl-bottom-left, .mapboxgl-ctrl-bottom-right {
          mix-blend-mode: luminosity;
          opacity: 0.5;
        }
      `}</style>
    </div>
  )
})

export default MapAtlas
