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
          [-50.06764261422266, -29.82216860959286], // Top-Left (West, North)
          [-50.05663217442957, -29.82216860959286], // Top-Right (East, North)
          [-50.05663217442957, -29.82763396467291], // Bottom-Right (East, South)
          [-50.06764261422266, -29.82763396467291]  // Bottom-Left (West, South)
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
