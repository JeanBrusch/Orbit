"use client"

import { useEffect } from "react"

const SOURCE_ID = "zen-overlay-source-v3"
const LAYER_ID = "zen-overlay-layer-v3"

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
          [-50.07120908969696, -29.82131016434248], // Top-Left (Manual Offset)
          [-50.06047950314367, -29.819166464595237], // Top-Right (Manual Offset)
          [-50.05906569895528, -29.824492409923294], // Bottom-Right (Manual Offset)
          [-50.06979528550857, -29.826636109670533]  // Bottom-Left (Manual Offset)
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
