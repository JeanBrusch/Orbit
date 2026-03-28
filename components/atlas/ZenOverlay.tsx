"use client"

import { useEffect, useState } from "react"
import { Source, Layer } from "react-map-gl/mapbox"
import { parseKmlToMapboxCoords, MapboxCoordinates } from "@/lib/kmlToMapbox"

interface OverlayConfig {
  sourceId: string
  layerId: string
  imageUrl: string
  kmlUrl: string
}

const OVERLAYS: OverlayConfig[] = [
  {
    sourceId: "overlay-zen",
    layerId: "overlay-zen-layer",
    imageUrl: "/overlays/zen.jpg",
    kmlUrl: "/overlays/zen.kml",
  },
  {
    sourceId: "overlay-amare",
    layerId: "overlay-amare-layer",
    imageUrl: "/overlays/amare.jpg",
    kmlUrl: "/overlays/amare.kml",
  },
]

// Cache de coordenadas fora do componente para persistir entre trocas de estilo
const coordsCache: Record<string, MapboxCoordinates> = {}

export function ZenOverlay({ mapRef }: { mapRef: React.RefObject<any> }) {
  const [overlaysData, setOverlaysData] = useState<Record<string, MapboxCoordinates>>({})

  useEffect(() => {
    const loadAllKmls = async () => {
      const results: Record<string, MapboxCoordinates> = {}
      
      for (const cfg of OVERLAYS) {
        try {
          if (coordsCache[cfg.kmlUrl]) {
            results[cfg.sourceId] = coordsCache[cfg.kmlUrl]
            continue
          }

          const res = await fetch(cfg.kmlUrl)
          if (!res.ok) throw new Error(`Status ${res.status}`)
          const kmlText = await res.text()
          const coordinates = parseKmlToMapboxCoords(kmlText)
          
          coordsCache[cfg.kmlUrl] = coordinates
          results[cfg.sourceId] = coordinates
          console.log(`[ZenOverlay] KML carregado e cacheados: ${cfg.sourceId}`)
        } catch (err) {
          console.error(`[ZenOverlay] Erro ao carregar ${cfg.kmlUrl}:`, err)
        }
      }
      
      setOverlaysData(results)
    }

    loadAllKmls()
  }, [])

  return (
    <>
      {OVERLAYS.map((cfg) => {
        const coords = overlaysData[cfg.sourceId]
        if (!coords) return null

        return (
          <Source
            key={cfg.sourceId}
            id={cfg.sourceId}
            type="image"
            url={cfg.imageUrl}
            coordinates={coords}
          >
            <Layer
              id={cfg.layerId}
              type="raster"
              paint={{
                'raster-opacity': 0.85,
                'raster-fade-duration': 500,
              }}
            />
          </Source>
        )
      })}
    </>
  )
}