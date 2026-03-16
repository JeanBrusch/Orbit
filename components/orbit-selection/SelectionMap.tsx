"use client"

import { useState, useRef, useEffect, memo } from "react"
import Map, { Marker, Popup } from "react-map-gl/mapbox"
import { Building2 } from "lucide-react"

interface SelectionMapProps {
  items: any[]
  theme: "paper" | "light" | "dark"
  className?: string
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
const XANGRILA_CENTER = { longitude: -50.0333, latitude: -29.8000 }

// Styled Mapbox variants
const DARK_STYLE = "mapbox://styles/mapbox/dark-v11"
const LIGHT_STYLE = "mapbox://styles/mapbox/light-v11"
const SEPIA_STYLE = "mapbox://styles/mapbox/outdoors-v12" // Closer to "paper" than dark

export default function SelectionMap({ items, theme, className }: SelectionMapProps) {
  const [viewState, setViewState] = useState({
    longitude: XANGRILA_CENTER.longitude,
    latitude: XANGRILA_CENTER.latitude,
    zoom: 12,
    pitch: 40,
    bearing: 0
  })

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

  const mapStyle = theme === "dark" ? DARK_STYLE : LIGHT_STYLE

  return (
    <div className={`w-full h-full ${className}`}>
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
            <div className="relative group cursor-pointer">
              <div className="absolute -translate-x-1/2 -bottom-2 px-3 py-1 bg-white shadow-xl border border-zinc-100 rounded-lg whitespace-nowrap text-[10px] font-bold text-zinc-800 transition-transform group-hover:scale-110">
                {item.title}
              </div>
              <div className="w-4 h-4 rounded-full bg-[var(--gold)] border-2 border-white shadow-md animate-pulse" />
            </div>
          </Marker>
        ))}
      </Map>

      {/* Map Styling Overlays to match the Paper theme if needed */}
      {theme === "paper" && (
        <div className="absolute inset-0 pointer-events-none bg-[var(--paper)] mix-blend-color opacity-30" />
      )}
    </div>
  )
}
