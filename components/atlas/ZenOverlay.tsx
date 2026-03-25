"use client"

import { useEffect } from "react"

const SOURCE_ID = "zen-overlay-source"
const LAYER_ID = "zen-overlay-layer"

interface ZenOverlayProps {
  mapRef: React.RefObject<any>
}

export function ZenOverlay({ mapRef }: ZenOverlayProps) {
  useEffect(() => {
    if (!mapRef.current) return
    const map = mapRef.current.getMap?.()
    if (!map) return

    const addLayers = () => {
      // Se a fonte já existe, não faz nada (evita erro de duplicata)
      if (map.getSource(SOURCE_ID)) {
        return
      }

      map.addSource(SOURCE_ID, {
        type: 'image',
        url: '/overlays/zen-overlay.png',
        coordinates: [
          [-50.06820908969696, -29.82331016434248], // Top-Left (Rotated)
          [-50.05747950314367, -29.821166464595237], // Top-Right (Rotated)
          [-50.05606569895528, -29.826492409923294], // Bottom-Right (Rotated)
          [-50.06679528550857, -29.828636109670533]  // Bottom-Left (Rotated)
        ]
      })

      map.addLayer({
        id: LAYER_ID,
        type: 'raster',
        source: SOURCE_ID,
        paint: {
          'raster-opacity': 0.85,
          'raster-fade-duration': 500
        }
      })
    }

    // Tenta adicionar quando o estilo carregar
    if (map.isStyleLoaded()) {
      addLayers()
    } else {
      map.once("load", addLayers)
    }

    // Crucial: Reinjetar a camada sempre que o estilo mudar (ex: troca para Satélite)
    const onStyleData = () => {
      if (!map.getSource(SOURCE_ID)) {
        addLayers()
      }
    }
    map.on("styledata", onStyleData)

    return () => {
      map.off("styledata", onStyleData)
    }
  }, [mapRef])

  return null
}
