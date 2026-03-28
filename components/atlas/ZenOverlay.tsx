"use client"

import { useEffect, useRef } from "react"
import { parseKmlToMapboxCoords } from "@/lib/kmlToMapbox"

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
    imageUrl: "/overlays/zen.png",
    kmlUrl: "/overlays/zen.kml",
  },
  {
    sourceId: "overlay-amare",
    layerId: "overlay-amare-layer",
    imageUrl: "/overlays/amare.png",
    kmlUrl: "/overlays/amare.kml",
  },
  {
    sourceId: "overlay-sunset",
    layerId: "overlay-sunset-layer",
    imageUrl: "/overlays/sunset.png",
    kmlUrl: "/overlays/sunset.kml",
  },
]

interface ZenOverlayProps {
  mapRef: React.RefObject<any>
}

export function ZenOverlay({ mapRef }: ZenOverlayProps) {
  const loadedRef = useRef(false)

  useEffect(() => {
    if (!mapRef.current) return
    const map = mapRef.current.getMap?.()
    if (!map) return

    const addOverlay = async (cfg: OverlayConfig) => {
      // Se já existe, não faz nada — styledata pode disparar várias vezes
      if (map.getSource(cfg.sourceId)) return

      try {
        const kmlText = await fetch(cfg.kmlUrl).then(r => r.text())
        const coordinates = parseKmlToMapboxCoords(kmlText)

        // Checa de novo após o await (pode ter sido adicionado enquanto aguardava)
        if (map.getSource(cfg.sourceId)) return

        map.addSource(cfg.sourceId, {
          type: 'image',
          url: cfg.imageUrl,
          coordinates,
        })

        map.addLayer({
          id: cfg.layerId,
          type: 'raster',
          source: cfg.sourceId,
          paint: {
            'raster-opacity': 0.85,
            'raster-fade-duration': 500,
          },
        })
      } catch (err) {
        console.error(`[Overlay] Falha ao carregar ${cfg.kmlUrl}:`, err)
      }
    }

    const addAll = () => {
      if (!map.isStyleLoaded()) return
      OVERLAYS.forEach(addOverlay)
    }

    if (map.isStyleLoaded()) {
      addAll()
    } else {
      map.once("load", addAll)
    }

    map.on("styledata", addAll)

    return () => {
      map.off("styledata", addAll)
    }
  }, [mapRef])

  return null
}