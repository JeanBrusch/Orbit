export type LngLat = [number, number]

export type MapboxCoordinates = [
  LngLat, // top-left
  LngLat, // top-right
  LngLat, // bottom-right
  LngLat  // bottom-left
]

export interface ParsedGroundOverlay {
  name?: string
  href?: string
  north: number
  south: number
  east: number
  west: number
  rotation: number
  coordinates: MapboxCoordinates
}

const EARTH_RADIUS = 6378137

function getTagText(parent: ParentNode, tagName: string): string | null {
  const el = parent.getElementsByTagName(tagName)[0]
  return el?.textContent?.trim() ?? null
}

function getRequiredNumber(parent: ParentNode, tagName: string): number {
  const value = getTagText(parent, tagName)

  if (value == null) {
    throw new Error(`Tag <${tagName}> não encontrada no KML`)
  }

  const num = Number(value)
  if (Number.isNaN(num)) {
    throw new Error(`Valor inválido em <${tagName}>: ${value}`)
  }

  return num
}

function lonToMercatorX(lon: number): number {
  return EARTH_RADIUS * (lon * Math.PI) / 180
}

function latToMercatorY(lat: number): number {
  const clamped = Math.max(Math.min(lat, 89.999999), -89.999999)
  const rad = (clamped * Math.PI) / 180
  return EARTH_RADIUS * Math.log(Math.tan(Math.PI / 4 + rad / 2))
}

function mercatorXToLon(x: number): number {
  return (x / EARTH_RADIUS) * (180 / Math.PI)
}

function mercatorYToLat(y: number): number {
  return (Math.atan(Math.exp(y / EARTH_RADIUS)) * 360) / Math.PI - 90
}

function rotateXY(
  x: number,
  y: number,
  centerX: number,
  centerY: number,
  angleDeg: number
): [number, number] {
  const angle = (angleDeg * Math.PI) / 180
  const dx = x - centerX
  const dy = y - centerY

  const xr = centerX + dx * Math.cos(angle) - dy * Math.sin(angle)
  const yr = centerY + dx * Math.sin(angle) + dy * Math.cos(angle)

  return [xr, yr]
}

export function latLonBoxToMapboxCoords(params: {
  north: number
  south: number
  east: number
  west: number
  rotation?: number
}): MapboxCoordinates {
  const { north, south, east, west } = params
  const rotation = params.rotation ?? 0

  const left = lonToMercatorX(west)
  const right = lonToMercatorX(east)
  const top = latToMercatorY(north)
  const bottom = latToMercatorY(south)

  const centerX = (left + right) / 2
  const centerY = (top + bottom) / 2

  const topLeft = rotateXY(left, top, centerX, centerY, rotation)
  const topRight = rotateXY(right, top, centerX, centerY, rotation)
  const bottomRight = rotateXY(right, bottom, centerX, centerY, rotation)
  const bottomLeft = rotateXY(left, bottom, centerX, centerY, rotation)

  return [
    [mercatorXToLon(topLeft[0]), mercatorYToLat(topLeft[1])],
    [mercatorXToLon(topRight[0]), mercatorYToLat(topRight[1])],
    [mercatorXToLon(bottomRight[0]), mercatorYToLat(bottomRight[1])],
    [mercatorXToLon(bottomLeft[0]), mercatorYToLat(bottomLeft[1])],
  ]
}

export function parseGroundOverlayKml(kmlText: string): ParsedGroundOverlay {
  const parser = new DOMParser()
  const xml = parser.parseFromString(kmlText, "application/xml")

  const parserError = xml.getElementsByTagName("parsererror")[0]
  if (parserError) {
    throw new Error("XML/KML inválido")
  }

  const groundOverlay = xml.getElementsByTagName("GroundOverlay")[0]
  if (!groundOverlay) {
    throw new Error("GroundOverlay não encontrado no KML")
  }

  const latLonBox = groundOverlay.getElementsByTagName("LatLonBox")[0]
  if (!latLonBox) {
    throw new Error("LatLonBox não encontrado no GroundOverlay")
  }

  const north = getRequiredNumber(latLonBox, "north")
  const south = getRequiredNumber(latLonBox, "south")
  const east = getRequiredNumber(latLonBox, "east")
  const west = getRequiredNumber(latLonBox, "west")

  const rotationText = getTagText(latLonBox, "rotation")
  const rotation = rotationText != null ? Number(rotationText) : 0

  if (Number.isNaN(rotation)) {
    throw new Error(`Valor inválido em <rotation>: ${rotationText}`)
  }

  const name = getTagText(groundOverlay, "name") ?? undefined
  const href =
    groundOverlay
      .getElementsByTagName("Icon")[0]
      ?.getElementsByTagName("href")[0]
      ?.textContent
      ?.trim() ?? undefined

  const coordinates = latLonBoxToMapboxCoords({
    north,
    south,
    east,
    west,
    rotation,
  })

  return {
    name,
    href,
    north,
    south,
    east,
    west,
    rotation,
    coordinates,
  }
}

export function parseKmlToMapboxCoords(kmlText: string): MapboxCoordinates {
  return parseGroundOverlayKml(kmlText).coordinates
}
