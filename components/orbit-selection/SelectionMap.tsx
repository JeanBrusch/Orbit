"use client"

import { useState, useRef, useEffect, memo } from "react"
import Map, { Marker, Popup } from "react-map-gl/mapbox"
import { Building2 } from "lucide-react"

interface SelectionMapProps {
  items: any[]
  theme: "paper" | "light" | "dark"
  className?: string
  onAction?: (item: any, type: "link" | "chat") => void
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
const XANGRILA_CENTER = { longitude: -50.0333, latitude: -29.8000 }

// Styled Mapbox variants
const DARK_STYLE = "mapbox://styles/mapbox/dark-v11"
const LIGHT_STYLE = "mapbox://styles/mapbox/light-v11"
const SEPIA_STYLE = "mapbox://styles/mapbox/outdoors-v12" // Closer to "paper" than dark

export default function SelectionMap({ items, theme, className, onAction }: SelectionMapProps) {
  const [viewState, setViewState] = useState({
    longitude: XANGRILA_CENTER.longitude,
    latitude: XANGRILA_CENTER.latitude,
    zoom: 12,
    pitch: 40,
    bearing: 0
  })
  const [selectedPopup, setSelectedPopup] = useState<any | null>(null)

  // Set initial bounds to fit all markers
  useEffect(() => {
    if (items.length > 0) {
      const validItems = items.filter(item => item.lat && item.lng)
      if (validItems.length > 0) {
        const lats = validItems.map(i => i.lat!)
        const lngs = validItems.map(i => i.lng!)
        setViewState(prev => ({
          ...prev,
          latitude: (Math.min(...lats) + Math.max(...lats)) / 2,
          longitude: (Math.min(...lngs) + Math.max(...lngs)) / 2,
          zoom: validItems.length === 1 ? 14 : 12
        }))
      }
    }
  }, [items])

  if (!MAPBOX_TOKEN) return <div className="p-4 bg-red-50 text-red-500">Mapbox Token Missing</div>

  const mapStyle = DARK_STYLE // Always dark for premium look with gold markers

  return (
    <div className={`w-full h-full ${className} relative`}>
      <Map
        {...viewState}
        onMove={evt => setViewState(evt.viewState)}
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle={mapStyle}
        attributionControl={false}
      >
        {items.filter(i => i.lat && i.lng).map(item => (
          <Marker 
            key={item.id} 
            longitude={item.lng!} 
            latitude={item.lat!}
            anchor="bottom"
          >
            <div 
              className="relative flex items-center justify-center cursor-pointer group"
              onClick={() => setSelectedPopup(item)}
            >
              <div className="absolute w-3.5 h-3.5 rounded-full bg-[#d4af37]/35 animate-[pulse-anim_2s_ease-out_infinite]" />
              <div className="w-3.5 h-3.5 rounded-full bg-[#d4af37] border-2 border-[#0d0c0a] shadow-[0_0_10px_rgba(212,175,54,0.6)] group-hover:scale-125 transition-transform" />
            </div>
          </Marker>
        ))}

        {selectedPopup && (
          <Popup
            longitude={selectedPopup.lng!}
            latitude={selectedPopup.lat!}
            anchor="bottom"
            onClose={() => setSelectedPopup(null)}
            closeButton={true}
            maxWidth="220px"
            className="premium-popup"
          >
            <div className="p-1">
              <span className="font-mono text-[9px] uppercase tracking-widest text-[#d4af37] mb-1.5 block">92% Match</span>
              <h4 className="text-[13px] font-medium text-[#f0ede4] leading-tight mb-1">{selectedPopup.title}</h4>
              <p className="font-mono text-[12px] text-[#f0ede4]/60 mb-2.5">
                {selectedPopup.price ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(selectedPopup.price) : "Sob consulta"}
              </p>
              <div className="flex gap-1.5">
                <button 
                  onClick={() => onAction?.(selectedPopup, "link")}
                  className="flex-1 py-1.5 rounded-md bg-[#d4af37]/18 border border-[#d4af37]/30 text-[#d4af37] text-[11px] font-medium hover:bg-[#d4af37]/28 transition-all"
                >
                  Ver Link
                </button>
                <button 
                  onClick={() => onAction?.(selectedPopup, "chat")}
                  className="flex-1 py-1.5 rounded-md bg-white/5 border border-white/10 text-white/50 text-[11px] font-medium hover:bg-white/10 hover:text-white/85 transition-all"
                >
                  Chat
                </button>
              </div>
            </div>
          </Popup>
        )}
      </Map>

      {/* Map Premium Overlay */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-[#0d0c0a]/35 via-transparent to-[#0d0c0a]/50 z-0" />
      
      <style jsx global>{`
        .premium-popup .mapboxgl-popup-content {
          background: rgba(13, 12, 10, 0.94) !important;
          border: 1px solid rgba(212, 175, 55, 0.3) !important;
          border-radius: 14px !important;
          padding: 14px 16px !important;
          box-shadow: 0 8px 32px rgba(0,0,0,0.5) !important;
          backdrop-filter: blur(16px) !important;
          color: #f0ede4 !important;
        }
        .premium-popup .mapboxgl-popup-tip {
          border-top-color: rgba(13, 12, 10, 0.94) !important;
        }
        .premium-popup .mapboxgl-popup-close-button {
          color: rgba(212, 175, 55, 0.5) !important;
          padding: 4px 8px !important;
          font-size: 16px !important;
        }
        @keyframes pulse-anim {
          0% { transform: scale(1); opacity: 0.8; }
          100% { transform: scale(3.5); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
