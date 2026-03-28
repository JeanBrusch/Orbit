/**
 * kmlToMapbox.ts
 * 
 * Converte um LatLonBox de KML (com rotação) para os 4 cantos
 * que o Mapbox espera em `source: 'image'`.
 * 
 * Uso:
 *   const coords = kmlToMapboxCoords({ north, south, east, west, rotation })
 *   // → [[lng, lat], [lng, lat], [lng, lat], [lng, lat]]
 *   //     Top-Left   Top-Right  Bottom-Right Bottom-Left
 */

export interface KmlLatLonBox {
  north: number
  south: number
  east: number
  west: number
  rotation: number // graus, mesmo valor do KML
}

export type MapboxCoordinates = [
  [number, number], // Top-Left
  [number, number], // Top-Right
  [number, number], // Bottom-Right
  [number, number], // Bottom-Left
]

export function kmlToMapboxCoords(box: KmlLatLonBox): MapboxCoordinates {
  const cx = (box.east + box.west) / 2
  const cy = (box.north + box.south) / 2
  const dx = (box.east - box.west) / 2
  const dy = (box.north - box.south) / 2

  const rad = box.rotation * (Math.PI / 180)
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)

  const rotate = (x: number, y: number): [number, number] => [
    cx + x * cos + y * sin,
    cy - x * sin + y * cos,
  ]

  return [
    rotate(-dx, dy),  // Top-Left
    rotate(dx, dy),  // Top-Right
    rotate(dx, -dy),  // Bottom-Right
    rotate(-dx, -dy),  // Bottom-Left
  ]
}


/**
 * Parse direto de uma string KML.
 * Útil se quiser carregar o .kml via fetch em runtime.
 * 
 * Uso:
 *   const text = await fetch('/overlays/zen.kml').then(r => r.text())
 *   const coords = parseKmlToMapboxCoords(text)
 */
export function parseKmlToMapboxCoords(kmlText: string): MapboxCoordinates {
  const getTagValue = (tag: string): string | null => {
    const match = kmlText.match(new RegExp(`<${tag}>([^<]+)</${tag}>`))
    return match ? match[1] : null
  }

  const getRequired = (tag: string): number => {
    const val = getTagValue(tag)
    if (val === null) {
      throw new Error(`Tag <${tag}> não encontrada no KML. Início do texto: "${kmlText.substring(0, 100)}..."`)
    }
    return parseFloat(val)
  }

  return kmlToMapboxCoords({
    north: getRequired('north'),
    south: getRequired('south'),
    east: getRequired('east'),
    west: getRequired('west'),
    rotation: getRequired('rotation'),
  })
}
