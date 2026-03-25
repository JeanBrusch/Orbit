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
        // Coordenadas derivadas do KML (LatLonBox + rotation: -12.97°)
        // north: -29.82216860959286 | south: -29.82763396467291
        // east:  -50.05663217442957 | west:  -50.06764261422266
        // O Mapbox não aceita rotação direta — os 4 cantos já são passados rotacionados
        coordinates: [
          [-50.06688891512792, -29.82100282298439],  // Top-Left
          [-50.05615932857463, -29.823473805953324], // Top-Right
          [-50.05738587352431, -29.82879975128138],  // Bottom-Right
          [-50.0681154600776, -29.826328768312447], // Bottom-Left
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
