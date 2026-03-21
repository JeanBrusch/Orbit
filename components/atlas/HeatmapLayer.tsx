"use client"

import { useEffect, useRef } from "react"

interface HeatmapLayerProps {
  mapRef: React.RefObject<any>
  geojson: GeoJSON.FeatureCollection | null
  visible: boolean
  metric: string
}

const SOURCE_ID = "orbit-heatmap-source"
const LAYER_ID = "orbit-heatmap-layer"
const POINTS_LAYER_ID = "orbit-heatmap-points"

export function HeatmapLayer({ mapRef, geojson, visible, metric }: HeatmapLayerProps) {
  const layerAddedRef = useRef(false)

  useEffect(() => {
    if (!mapRef.current) return
    const map = mapRef.current.getMap?.()
    if (!map) return

    const addLayers = () => {
      // Source já existe — só atualiza os dados
      if (map.getSource(SOURCE_ID)) {
        const source = map.getSource(SOURCE_ID)
        source.setData(geojson || { type: "FeatureCollection", features: [] })
        return
      }

      // Adicionar source pela primeira vez
      map.addSource(SOURCE_ID, {
        type: "geojson",
        data: geojson || { type: "FeatureCollection", features: [] },
      })

      // Camada Heatmap (intensidade por peso)
      map.addLayer({
        id: LAYER_ID,
        type: "heatmap",
        source: SOURCE_ID,
        maxzoom: 17,
        paint: {
          // Intensidade sobe com o zoom e com o peso do ponto
          "heatmap-weight": ["interpolate", ["linear"], ["get", "weight"], 0, 0, 1, 1],
          "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 8, 0.6, 15, 2],
          "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 8, 20, 12, 40, 15, 60],
          // Gradiente: azul frio → ciano → laranja → vermelho quente
          "heatmap-color": [
            "interpolate",
            ["linear"],
            ["heatmap-density"],
            0, "rgba(0,212,255,0)",
            0.2, "rgba(0,212,255,0.4)",
            0.4, "rgba(0,230,180,0.6)",
            0.6, "rgba(255,200,50,0.75)",
            0.8, "rgba(255,120,30,0.85)",
            1, "rgba(255,30,30,1)",
          ],
          "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 10, 0.9, 16, 0.5],
        },
      })

      // Camada de pontos (visível a partir de zoom 13)
      map.addLayer({
        id: POINTS_LAYER_ID,
        type: "circle",
        source: SOURCE_ID,
        minzoom: 13,
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["get", "weight"], 0, 4, 1, 10],
          "circle-color": [
            "interpolate",
            ["linear"],
            ["get", "weight"],
            0, "rgba(0,212,255,0.8)",
            0.5, "rgba(255,150,30,0.9)",
            1, "rgba(255,30,30,1)",
          ],
          "circle-opacity": 0.85,
          "circle-blur": 0.2,
          "circle-stroke-width": 1,
          "circle-stroke-color": "rgba(255,255,255,0.3)",
        },
      })

      layerAddedRef.current = true
    }

    // Se o mapa já carregou, adiciona imediatamente; senão aguarda o evento load
    if (map.isStyleLoaded()) {
      addLayers()
    } else {
      map.once("load", addLayers)
    }

    // Re-rodar quando o estilo muda (theme toggle)
    const onStyleData = () => {
      layerAddedRef.current = false
      setTimeout(addLayers, 100)
    }
    map.on("styledata", onStyleData)

    return () => {
      map.off("styledata", onStyleData)
    }
  }, [mapRef, geojson])

  // Controle de visibilidade
  useEffect(() => {
    if (!mapRef.current) return
    const map = mapRef.current.getMap?.()
    if (!map || !map.getLayer(LAYER_ID)) return

    const vis = visible ? "visible" : "none"
    map.setLayoutProperty(LAYER_ID, "visibility", vis)
    map.setLayoutProperty(POINTS_LAYER_ID, "visibility", vis)
  }, [mapRef, visible])

  return null // Camada gerenciada diretamente via mapbox-gl
}
