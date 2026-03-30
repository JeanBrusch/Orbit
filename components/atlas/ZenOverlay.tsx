"use client"

import { useEffect } from "react"
import type { MapRef } from "react-map-gl/mapbox"
import { parseGroundOverlayKml, MapboxCoordinates } from "@/lib/kmlToMapbox"

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

const coordsCache: Record<string, MapboxCoordinates> = {}

interface ZenOverlayProps {
  mapRef: React.RefObject<MapRef | null>
}

export function ZenOverlay({ mapRef }: ZenOverlayProps) {
  useEffect(() => {
    const map = mapRef.current?.getMap?.()
    if (!map) return

    let cancelled = false

    const ensureOverlay = async (cfg: OverlayConfig) => {
      try {
        let coordinates = coordsCache[cfg.kmlUrl]

        if (!coordinates) {
          const res = await fetch(cfg.kmlUrl)
          if (!res.ok) {
            throw new Error(`Erro ao buscar ${cfg.kmlUrl}: ${res.status}`)
          }

          const kmlText = await res.text()
          const parsed = parseGroundOverlayKml(kmlText)

          coordinates = parsed.coordinates
          coordsCache[cfg.kmlUrl] = coordinates

          console.log(`[Overlay] ${cfg.sourceId}`, {
            north: parsed.north,
            south: parsed.south,
            east: parsed.east,
            west: parsed.west,
            rotation: parsed.rotation,
            coordinates: parsed.coordinates,
          })
        }

        if (cancelled) return

        const existingLayer = map.getLayer(cfg.layerId)
        const existingSource = map.getSource(cfg.sourceId) as any

        if (existingSource && typeof existingSource.updateImage === "function") {
          existingSource.updateImage({
            url: cfg.imageUrl,
            coordinates,
          })

          if (!existingLayer) {
            map.addLayer({
              id: cfg.layerId,
              type: "raster",
              source: cfg.sourceId,
              paint: {
                "raster-opacity": 0.85,
                "raster-fade-duration": 500,
              },
            })
          }

          return
        }

        if (!existingSource) {
          map.addSource(cfg.sourceId, {
            type: "image",
            url: cfg.imageUrl,
            coordinates,
          })
        }

        if (!existingLayer) {
          map.addLayer({
            id: cfg.layerId,
            type: "raster",
            source: cfg.sourceId,
            paint: {
              "raster-opacity": 0.85,
              "raster-fade-duration": 500,
            },
          })
        }
      } catch (err) {
        console.error(`[ZenOverlay] Falha ao carregar ${cfg.kmlUrl}:`, err)
      }
    }

    const syncAll = () => {
      OVERLAYS.forEach((cfg) => {
        void ensureOverlay(cfg)
      })
    }

    if (map.isStyleLoaded()) {
      syncAll()
    } else {
      map.once("load", syncAll)
    }

    map.on("styledata", syncAll)

    return () => {
      cancelled = true
      map.off("styledata", syncAll)
    }
  }, [mapRef])

  return null
}
