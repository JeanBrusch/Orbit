"use client"

import { useState, useRef, useEffect } from "react"
import Map, { Marker, Popup, NavigationControl } from "react-map-gl/mapbox"
import 'mapbox-gl/dist/mapbox-gl.css'
import type { ViewState } from "react-map-gl/mapbox"
import { Globe, Map as MapIcon } from "lucide-react"

interface SelectionMapItem {
  id: string
  title: string
  price: number | null
  location: string | null
  coverImage: string | null
  lat: number | null
  lng: number | null
}

interface SelectionMapProps {
  items: SelectionMapItem[]
  onItemClick: (id: string) => void
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
const MAP_STYLE_LIGHT = "mapbox://styles/mapbox/light-v11"
const MAP_STYLE_SATELLITE = "mapbox://styles/mapbox/satellite-streets-v12"
const XANGRILA_CENTER = { longitude: -50.0333, latitude: -29.8000 }

function formatPrice(value: number | null): string {
  if (!value) return "Sob consulta"
  if (value >= 1_000_000) {
    const m = value / 1_000_000
    return `R$ ${m % 1 === 0 ? m : m.toFixed(1)}M`
  }
  return `R$ ${Math.round(value / 1_000)}k`
}

export default function SelectionMap({ items, onItemClick }: SelectionMapProps) {
  const mapRef = useRef<any>(null)
  const [isSatellite, setIsSatellite] = useState(false)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const validItems = items.filter(i => i.lat && i.lng)

  const initialCenter = validItems.length > 0 ? {
    longitude: validItems.reduce((s, i) => s + i.lng!, 0) / validItems.length,
    latitude: validItems.reduce((s, i) => s + i.lat!, 0) / validItems.length,
  } : XANGRILA_CENTER

  const [viewState, setViewState] = useState<ViewState>({
    longitude: initialCenter.longitude,
    latitude: initialCenter.latitude,
    zoom: 13,
    padding: { top: 0, bottom: 0, left: 0, right: 0 },
    pitch: 40,
    bearing: -10,
  })

  // Fit bounds no primeiro load
  useEffect(() => {
    if (!mapRef.current || validItems.length < 2) return
    const timer = setTimeout(() => {
      if (!mapRef.current) return
      const lats = validItems.map(i => i.lat!)
      const lngs = validItems.map(i => i.lng!)
      mapRef.current.fitBounds(
        [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
        { padding: 90, maxZoom: 16, duration: 1200 }
      )
    }, 300)
    return () => clearTimeout(timer)
  }, [])

  const hoveredItem = validItems.find(i => i.id === hoveredId)

  if (!MAPBOX_TOKEN) {
    return (
      <div className="jb-map-empty">
        <p>Token do mapa não configurado</p>
      </div>
    )
  }

  if (validItems.length === 0) {
    return (
      <div className="jb-map-empty">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
        <p>Nenhum imóvel com localização disponível</p>
      </div>
    )
  }

  return (
    <div className="jb-map-wrapper">
      <Map
        ref={mapRef}
        {...viewState}
        onMove={(evt: any) => setViewState(evt.viewState)}
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle={isSatellite ? MAP_STYLE_SATELLITE : MAP_STYLE_LIGHT}
        attributionControl={false}
        cursor="grab"
      >
        <NavigationControl position="top-right" showCompass={false} />

        {validItems.map((item) => (
          <Marker
            key={item.id}
            longitude={item.lng!}
            latitude={item.lat!}
            anchor="center"
            style={{ zIndex: hoveredId === item.id ? 50 : 10 }}
          >
            <div
              className="jb-map-marker"
              onClick={() => onItemClick(item.id)}
              onMouseEnter={() => setHoveredId(item.id)}
              onMouseLeave={() => setHoveredId(null)}
              data-hovered={hoveredId === item.id ? "true" : undefined}
            >
              <div className="jb-map-pulse" />
              <div className="jb-map-dot" />
            </div>
          </Marker>
        ))}

        {hoveredItem && hoveredItem.lat && hoveredItem.lng && (
          <Popup
            longitude={hoveredItem.lng}
            latitude={hoveredItem.lat}
            closeButton={false}
            anchor="bottom"
            offset={22}
            className="jb-sel-popup"
          >
            <div className="jb-map-card" onClick={() => onItemClick(hoveredItem.id)}>
              {hoveredItem.coverImage && (
                <div className="jb-map-card-img">
                  <img src={hoveredItem.coverImage} alt={hoveredItem.title} />
                </div>
              )}
              <div className="jb-map-card-body">
                <div className="jb-map-card-title">{hoveredItem.title}</div>
                {hoveredItem.location && (
                  <div className="jb-map-card-loc">
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
                      <circle cx="12" cy="10" r="3"/>
                    </svg>
                    {hoveredItem.location}
                  </div>
                )}
                <div className="jb-map-card-price">{formatPrice(hoveredItem.price)}</div>
              </div>
            </div>
          </Popup>
        )}
      </Map>

      {/* Legenda lateral de imóveis */}
      <div className="jb-map-legend">
        <div className="jb-map-legend-label">Imóveis no mapa</div>
        {validItems.map((item) => (
          <button
            key={item.id}
            className="jb-map-legend-item"
            onMouseEnter={() => setHoveredId(item.id)}
            onMouseLeave={() => setHoveredId(null)}
            onClick={() => {
              mapRef.current?.flyTo({
                center: [item.lng!, item.lat!],
                zoom: 16,
                duration: 1200,
                pitch: 55,
              })
              onItemClick(item.id)
            }}
          >
            <div className="jb-map-legend-dot" />
            <span>{item.title}</span>
          </button>
        ))}
      </div>

      <div className="absolute bottom-6 left-6 z-[110]">
        <button
          onClick={() => setIsSatellite(!isSatellite)}
          className={`jb-map-style-toggle ${isSatellite ? 'is-satellite' : ''}`}
        >
          {isSatellite ? (
            <>
              <MapIcon size={14} />
              <span>Mapa</span>
            </>
          ) : (
            <>
              <Globe size={14} />
              <span>Satélite</span>
            </>
          )}
        </button>
      </div>

      <style>{`
        .jb-map-style-toggle {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 14px;
          border-radius: 99px;
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(0,0,0,0.06);
          box-shadow: 0 8px 32px rgba(0,0,0,0.08);
          color: #666;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          transition: all 0.3s cubic-bezier(0.19, 1, 0.22, 1);
        }
        .jb-map-style-toggle:hover {
          color: #000;
          background: #fff;
          transform: translateY(-1px);
          box-shadow: 0 12px 40px rgba(0,0,0,0.12);
        }
        .jb-map-style-toggle.is-satellite {
          background: rgba(16, 185, 129, 0.1);
          border-color: rgba(16, 185, 129, 0.3);
          color: #059669;
        }
        .jb-sel-popup .mapboxgl-popup-content {
          background: transparent !important;
          padding: 0 !important;
          box-shadow: none !important;
          border-radius: 6px !important;
        }
        .jb-sel-popup .mapboxgl-popup-tip {
          border-top-color: #f6f4f0 !important;
          border-top-width: 7px !important;
        }
        .jb-sel-popup .mapboxgl-popup-close-button {
          display: none !important;
        }
        .mapboxgl-ctrl-bottom-left, .mapboxgl-ctrl-bottom-right {
          opacity: 0.35 !important;
          mix-blend-mode: multiply;
        }
      `}</style>
    </div>
  )
}
