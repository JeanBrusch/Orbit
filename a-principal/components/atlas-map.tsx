"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { X, MapPin, Check, Building2, Link2, Loader2, AlertCircle, ExternalLink, Move, Undo2 } from "lucide-react"
import { type Property, type IngestionStatus, type LocationAccuracy, useOrbitContext } from "./orbit-context"

export type { Property }

// Sample properties for demonstration (already in Atlas)
const sampleProperties: Property[] = [
  {
    id: "p1",
    name: "Laguna Premium",
    address: "Av. Beira Mar, 1200 - Ponta Negra",
    type: "penthouse",
    price: "R$ 2.450.000",
    area: "248m²",
    bedrooms: 4,
    position: { x: 35, y: 28 },
    highlight: true,
    ingestionStatus: "ready",
  },
  {
    id: "p2",
    name: "Marina Bay Residence",
    address: "Rua das Palmeiras, 450 - Petrópolis",
    type: "apartment",
    price: "R$ 890.000",
    area: "120m²",
    bedrooms: 3,
    position: { x: 62, y: 45 },
    ingestionStatus: "ready",
  },
  {
    id: "p3",
    name: "Solar do Atlântico",
    address: "Av. Eng. Roberto Freire, 2100",
    type: "apartment",
    price: "R$ 650.000",
    area: "85m²",
    bedrooms: 2,
    position: { x: 48, y: 65 },
    ingestionStatus: "ready",
  },
  {
    id: "p4",
    name: "Edifício Dunas",
    address: "Rua João XXIII, 800 - Tirol",
    type: "apartment",
    price: "R$ 720.000",
    area: "95m²",
    bedrooms: 3,
    position: { x: 25, y: 55 },
    ingestionStatus: "ready",
  },
  {
    id: "p5",
    name: "Villa Serena",
    address: "Condomínio Bosque das Árvores",
    type: "house",
    price: "R$ 1.850.000",
    area: "320m²",
    bedrooms: 5,
    position: { x: 75, y: 30 },
    ingestionStatus: "ready",
  },
]

// Ingestion status badge component
function IngestionBadge({ status }: { status: IngestionStatus }) {
  const config = {
    ingesting: {
      bg: "bg-amber-500/20",
      text: "text-amber-400",
      border: "border-amber-500/30",
      label: "Importando...",
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
    },
    partial: {
      bg: "bg-blue-500/20",
      text: "text-blue-400",
      border: "border-blue-500/30",
      label: "Parcial",
      icon: <AlertCircle className="h-3 w-3" />,
    },
    ready: {
      bg: "bg-emerald-500/20",
      text: "text-emerald-400",
      border: "border-emerald-500/30",
      label: "Pronto",
      icon: <Check className="h-3 w-3" />,
    },
    failed: {
      bg: "bg-rose-500/20",
      text: "text-rose-400",
      border: "border-rose-500/30",
      label: "Falhou",
      icon: <AlertCircle className="h-3 w-3" />,
    },
  }

  const { bg, text, border, label, icon } = config[status]

  return (
    <span className={`flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] ${bg} ${text} ${border}`}>
      {icon}
      {label}
    </span>
  )
}

// Atlas Focus Surface - a global overlay that occupies the main working area
// Properties only exist if materialized here via Pocket Listing ingestion
export function AtlasFocusSurface() {
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null)
  const [hoveredProperty, setHoveredProperty] = useState<string | null>(null)
  const [draggingPropertyId, setDraggingPropertyId] = useState<string | null>(null)
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null)
  const mapRef = useRef<HTMLDivElement>(null)
  
  // Get state from global context
  const { 
    isAtlasMapActive, 
    closeAtlasMap, 
    atlasInvokeContext,
    atlasProperties,
    updatePropertyLocation,
    locationUndoState,
    undoLocationChange,
  } = useOrbitContext()
  
  // Combine sample and ingested properties
  const allProperties = [...sampleProperties, ...atlasProperties]

  // Reset state when focus surface closes
  useEffect(() => {
    if (!isAtlasMapActive) {
      setSelectedProperty(null)
      setHoveredProperty(null)
    }
  }, [isAtlasMapActive])

  // Keyboard handler for escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isAtlasMapActive) {
        if (selectedProperty) {
          setSelectedProperty(null)
        } else {
          closeAtlasMap()
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isAtlasMapActive, closeAtlasMap, selectedProperty])

  const handleMarkerClick = useCallback((property: Property) => {
    setSelectedProperty(property)
  }, [])

  const handleConfirmSelection = useCallback(() => {
    if (selectedProperty && atlasInvokeContext?.onPropertySelected) {
      atlasInvokeContext.onPropertySelected(selectedProperty)
      closeAtlasMap()
    }
  }, [selectedProperty, atlasInvokeContext, closeAtlasMap])

  // Convert pixel position to lat/lng (simplified linear mapping for Natal region)
  const pixelToLatLng = useCallback((x: number, y: number, mapRect: DOMRect) => {
    const xPercent = (x / mapRect.width) * 100
    const yPercent = (y / mapRect.height) * 100
    
    // Reverse the position-to-coordinate mapping
    // position.x = ((lng + 35.2) / 0.3) * 80 + 10
    // position.y = ((-lat - 5.8) / 0.2) * 70 + 15
    const lng = ((xPercent - 10) / 80) * 0.3 - 35.2
    const lat = -(((yPercent - 15) / 70) * 0.2 + 5.8)
    
    return { lat, lng }
  }, [])

  // Handle drag start
  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent, propertyId: string) => {
    // Only allow dragging for non-sample, non-ingesting properties
    const property = allProperties.find(p => p.id === propertyId)
    if (!property || property.ingestionStatus === "ingesting" || property.id.startsWith("p")) return
    
    e.preventDefault()
    e.stopPropagation()
    
    setDraggingPropertyId(propertyId)
    setSelectedProperty(property)
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    
    if (mapRef.current) {
      const rect = mapRef.current.getBoundingClientRect()
      setDragPosition({
        x: clientX - rect.left,
        y: clientY - rect.top,
      })
    }
  }, [allProperties])

  // Handle drag move
  const handleDragMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!draggingPropertyId || !mapRef.current) return
    
    e.preventDefault()
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    
    const rect = mapRef.current.getBoundingClientRect()
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width))
    const y = Math.max(0, Math.min(clientY - rect.top, rect.height))
    
    setDragPosition({ x, y })
  }, [draggingPropertyId])

  // Handle drag end
  const handleDragEnd = useCallback(() => {
    if (!draggingPropertyId || !dragPosition || !mapRef.current) {
      setDraggingPropertyId(null)
      setDragPosition(null)
      return
    }
    
    const rect = mapRef.current.getBoundingClientRect()
    const { lat, lng } = pixelToLatLng(dragPosition.x, dragPosition.y, rect)
    
    // Update the property location
    updatePropertyLocation(draggingPropertyId, lat, lng, "precise")
    
    setDraggingPropertyId(null)
    setDragPosition(null)
  }, [draggingPropertyId, dragPosition, pixelToLatLng, updatePropertyLocation])

  // Add event listeners for drag
  useEffect(() => {
    if (!draggingPropertyId) return
    
    const handleMove = (e: MouseEvent | TouchEvent) => handleDragMove(e)
    const handleEnd = () => handleDragEnd()
    
    window.addEventListener("mousemove", handleMove)
    window.addEventListener("mouseup", handleEnd)
    window.addEventListener("touchmove", handleMove, { passive: false })
    window.addEventListener("touchend", handleEnd)
    
    return () => {
      window.removeEventListener("mousemove", handleMove)
      window.removeEventListener("mouseup", handleEnd)
      window.removeEventListener("touchmove", handleMove)
      window.removeEventListener("touchend", handleEnd)
    }
  }, [draggingPropertyId, handleDragMove, handleDragEnd])

  const getPropertyTypeIcon = (type: Property["type"]) => {
    switch (type) {
      case "penthouse":
        return "bg-[var(--orbit-accent)]/20 text-[var(--orbit-accent)] border-[var(--orbit-accent)]/30"
      case "house":
        return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
      case "commercial":
        return "bg-purple-500/20 text-purple-400 border-purple-500/30"
      default:
        return "bg-[var(--orbit-glow)]/20 text-[var(--orbit-glow)] border-[var(--orbit-glow)]/30"
    }
  }

  // Get marker style based on ingestion status
  const getMarkerStyle = (property: Property) => {
    const status = property.ingestionStatus || "ready"
    
    if (selectedProperty?.id === property.id) {
      return "border-[var(--orbit-glow)] bg-[var(--orbit-glow)] text-[var(--orbit-bg)]"
    }
    
    switch (status) {
      case "ingesting":
        return "border-amber-500/60 bg-amber-500/20 text-amber-400 animate-pulse"
      case "partial":
        return "border-blue-500/60 bg-blue-500/20 text-blue-400"
      case "failed":
        return "border-rose-500/60 bg-rose-500/20 text-rose-400"
      case "ready":
      default:
        return property.highlight
          ? "border-[var(--orbit-accent)]/60 bg-[var(--orbit-accent)]/20 text-[var(--orbit-accent)]"
          : "border-[var(--orbit-glow)]/40 bg-[var(--orbit-glass)] text-[var(--orbit-glow)]"
    }
  }

  if (!isAtlasMapActive) return null

  const leadName = atlasInvokeContext?.leadName

  return (
    <>
      {/* Semi-transparent backdrop - keeps Orbit View visible */}
      <div
        className="fixed inset-0 z-40 bg-[var(--orbit-bg)]/80 backdrop-blur-sm transition-opacity duration-300 animate-backdrop-fade"
        onClick={closeAtlasMap}
        aria-hidden="true"
      />

      {/* Atlas Focus Surface - centered overlay that occupies the main working area */}
      <div
        className="fixed inset-4 md:inset-8 lg:inset-12 z-50 flex flex-col rounded-2xl border border-[var(--orbit-glass-border)] bg-[var(--orbit-bg)] shadow-2xl shadow-black/40 transition-all duration-300 animate-panel-slide-in overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="atlas-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--orbit-glass-border)] bg-[var(--orbit-glass)] px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--orbit-glow)]/20 text-[var(--orbit-glow)]">
              <MapPin className="h-5 w-5" />
            </div>
            <div>
              <h2 id="atlas-title" className="text-base font-semibold text-[var(--orbit-text)]">
                Atlas
              </h2>
              {leadName ? (
                <p className="text-xs text-[var(--orbit-text-muted)]">
                  Selecionando imóvel para <span className="text-[var(--orbit-glow)]">{leadName}</span>
                </p>
              ) : (
                <p className="text-xs text-[var(--orbit-text-muted)]">
                  {allProperties.length} imóveis no mapa
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* No manual creation buttons - Pocket Listing is the only source */}
            <button
              onClick={closeAtlasMap}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--orbit-text-muted)] transition-colors hover:bg-[var(--orbit-glow)]/10 hover:text-[var(--orbit-text)]"
              aria-label="Fechar Atlas"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Main Content - Map only (no creation panels) */}
        <div className="flex flex-1 overflow-hidden">
          {/* Map Container */}
          <div ref={mapRef} className="relative flex-1 overflow-hidden bg-[var(--orbit-bg-secondary)]">
            {/* Stylized Map Background */}
            <div className="absolute inset-0">
              {/* Grid overlay for map effect */}
              <div
                className="absolute inset-0 opacity-20"
                style={{
                  backgroundImage: `
                    linear-gradient(rgba(var(--orbit-glow-rgb), 0.1) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(var(--orbit-glow-rgb), 0.1) 1px, transparent 1px)
                  `,
                  backgroundSize: "40px 40px",
                }}
              />
              
              {/* Subtle topographic lines */}
              <svg className="absolute inset-0 w-full h-full opacity-10" preserveAspectRatio="none">
                <defs>
                  <pattern id="topo-pattern" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
                    <path
                      d="M0 50 Q 25 30 50 50 T 100 50"
                      fill="none"
                      stroke="rgba(var(--orbit-glow-rgb), 0.5)"
                      strokeWidth="0.5"
                    />
                    <path
                      d="M0 70 Q 35 50 70 70 T 100 70"
                      fill="none"
                      stroke="rgba(var(--orbit-glow-rgb), 0.3)"
                      strokeWidth="0.5"
                    />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#topo-pattern)" />
              </svg>

              {/* Coastal line indicator */}
              <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
                <path
                  d="M0 20 Q 30 15 60 25 T 100 18"
                  fill="none"
                  stroke="rgba(var(--orbit-glow-rgb), 0.3)"
                  strokeWidth="2"
                  strokeDasharray="8 4"
                  className="animate-line-pulse"
                  vectorEffect="non-scaling-stroke"
                  style={{ transform: "scale(1)", transformOrigin: "0 0" }}
                />
              </svg>

              {/* Area labels */}
              <div className="absolute top-[12%] left-[20%] text-[10px] text-[var(--orbit-text-muted)] font-medium tracking-wider">
                PONTA NEGRA
              </div>
              <div className="absolute top-[40%] left-[55%] text-[10px] text-[var(--orbit-text-muted)] font-medium tracking-wider">
                PETRÓPOLIS
              </div>
              <div className="absolute top-[60%] left-[18%] text-[10px] text-[var(--orbit-text-muted)] font-medium tracking-wider">
                TIROL
              </div>
            </div>

            {/* Property Markers */}
            {allProperties.map((property) => {
              // Check if this property is being dragged
              const isDragging = draggingPropertyId === property.id
              // Check if this is a draggable property (not sample, not ingesting)
              const isDraggable = !property.id.startsWith("p") && property.ingestionStatus !== "ingesting"
              
              // Use drag position if dragging, otherwise use property position
              const displayPosition = isDragging && dragPosition && mapRef.current
                ? {
                    x: (dragPosition.x / mapRef.current.getBoundingClientRect().width) * 100,
                    y: (dragPosition.y / mapRef.current.getBoundingClientRect().height) * 100,
                  }
                : property.position
              
              return (
              <button
                key={property.id}
                onClick={() => !isDragging && handleMarkerClick(property)}
                onMouseDown={(e) => isDraggable && handleDragStart(e, property.id)}
                onTouchStart={(e) => isDraggable && handleDragStart(e, property.id)}
                onMouseEnter={() => !isDragging && setHoveredProperty(property.id)}
                onMouseLeave={() => setHoveredProperty(null)}
                className={`absolute z-10 flex items-center justify-center transition-all ${
                  isDragging
                    ? "scale-150 cursor-grabbing z-30 duration-0"
                    : selectedProperty?.id === property.id
                      ? "scale-125 duration-200"
                      : hoveredProperty === property.id
                        ? "scale-110 duration-200"
                        : "scale-100 duration-200"
                } ${isDraggable ? "cursor-grab" : ""}`}
                style={{
                  left: `${displayPosition.x}%`,
                  top: `${displayPosition.y}%`,
                  transform: "translate(-50%, -50%)",
                }}
                aria-label={`${property.name} - ${property.price}`}
              >
                {/* Marker ping effect for highlighted/ingesting properties */}
                {(property.highlight || property.ingestionStatus === "ingesting") && (
                  <span className={`absolute h-8 w-8 rounded-full ${
                    property.ingestionStatus === "ingesting" 
                      ? "animate-ping bg-amber-500/30"
                      : "animate-semantic-pulse bg-[var(--orbit-accent)]/30"
                  }`} />
                )}
                
                {/* Marker */}
                <span className={`relative flex h-8 w-8 items-center justify-center rounded-full border-2 shadow-lg transition-all ${getMarkerStyle(property)}`}>
                  {property.ingestionStatus === "ingesting" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : property.ingestionStatus === "failed" ? (
                    <AlertCircle className="h-4 w-4" />
                  ) : (
                    <MapPin className="h-4 w-4" />
                  )}
                </span>

                {/* Hover tooltip */}
                {(hoveredProperty === property.id || selectedProperty?.id === property.id) && !isDragging && (
                  <div
                    className="absolute bottom-full mb-2 whitespace-nowrap rounded-lg border border-[var(--orbit-glass-border)] bg-[var(--orbit-glass)] px-3 py-2 text-left shadow-xl animate-text-fade-in"
                    style={{ minWidth: "160px" }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-[var(--orbit-text)]">{property.name}</p>
                      {property.ingestionStatus && property.ingestionStatus !== "ready" && (
                        <IngestionBadge status={property.ingestionStatus} />
                      )}
                    </div>
                    <p className="text-[10px] text-[var(--orbit-text-muted)]">
                      {property.type === "penthouse" ? "Cobertura" : property.type === "house" ? "Casa" : "Apartamento"}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-[var(--orbit-glow)]">{property.price}</p>
                    {property.locationAccuracy && property.locationAccuracy !== "unknown" && (
                      <p className={`mt-1 text-[9px] ${
                        property.locationAccuracy === "precise" 
                          ? "text-emerald-400" 
                          : "text-amber-400"
                      }`}>
                        {property.locationAccuracy === "precise" ? "Localização precisa" : "Localização aproximada"}
                      </p>
                    )}
                    {isDraggable && (
                      <p className="mt-1 flex items-center gap-1 text-[9px] text-[var(--orbit-text-muted)]">
                        <Move className="h-2.5 w-2.5" />
                        Arraste para reposicionar
                      </p>
                    )}
                    {property.url && (
                      <p className="mt-1 text-[9px] text-[var(--orbit-text-muted)] truncate max-w-[200px]">
                        <ExternalLink className="inline h-2.5 w-2.5 mr-1" />
                        {new URL(property.url).hostname}
                      </p>
                    )}
                  </div>
                )}
              </button>
              )
            })}

            {/* Drag mode indicator */}
            {draggingPropertyId && (
              <div className="absolute top-4 left-1/2 z-30 -translate-x-1/2 animate-text-fade-in">
                <div className="flex items-center gap-2 rounded-full border border-[var(--orbit-glow)]/30 bg-[var(--orbit-glow)]/10 px-4 py-2 text-sm text-[var(--orbit-glow)] shadow-lg backdrop-blur-xl">
                  <Move className="h-4 w-4" />
                  Solte para definir a localização
                </div>
              </div>
            )}

            {/* Undo button - shows when there's a recent location change */}
            {locationUndoState && !draggingPropertyId && (
              <div className="absolute bottom-16 left-1/2 z-30 -translate-x-1/2 animate-text-fade-in">
                <button
                  onClick={undoLocationChange}
                  className="flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-400 shadow-lg backdrop-blur-xl transition-all hover:bg-amber-500/20"
                >
                  <Undo2 className="h-4 w-4" />
                  Desfazer posicionamento
                </button>
              </div>
            )}

            {/* Add via Pocket Listing hint - the only allowed shortcut */}
            <div className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2">
              <div className="flex items-center gap-2 rounded-full border border-[var(--orbit-glass-border)] bg-[var(--orbit-glass)] px-4 py-2 shadow-lg backdrop-blur-xl">
                <Link2 className="h-4 w-4 text-[var(--orbit-text-muted)]" />
                <span className="text-xs text-[var(--orbit-text-muted)]">
                  Use Pocket Listing para adicionar imóveis
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Property Preview Card */}
        {selectedProperty && (
          <div className="border-t border-[var(--orbit-glass-border)] bg-[var(--orbit-glass)] p-4 animate-text-fade-in">
            <div className="flex gap-4">
              {/* Property thumbnail placeholder */}
              <div className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border ${getPropertyTypeIcon(selectedProperty.type)}`}>
                {selectedProperty.ingestionStatus === "ingesting" ? (
                  <Loader2 className="h-8 w-8 animate-spin" />
                ) : selectedProperty.ingestionStatus === "failed" ? (
                  <AlertCircle className="h-8 w-8" />
                ) : (
                  <Building2 className="h-8 w-8" />
                )}
              </div>

              {/* Property details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-[var(--orbit-text)]">{selectedProperty.name}</h3>
                      {selectedProperty.ingestionStatus && (
                        <IngestionBadge status={selectedProperty.ingestionStatus} />
                      )}
                    </div>
                    <p className="text-xs text-[var(--orbit-text-muted)] line-clamp-1">{selectedProperty.address}</p>
                    {selectedProperty.url && (
                      <a 
                        href={selectedProperty.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="mt-1 flex items-center gap-1 text-[10px] text-[var(--orbit-glow)] hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Ver fonte original
                      </a>
                    )}
                  </div>
                  <span className="shrink-0 text-sm font-bold text-[var(--orbit-glow)]">{selectedProperty.price}</span>
                </div>

                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedProperty.area && selectedProperty.area !== "—" && (
                    <span className="rounded-md bg-[var(--orbit-glow)]/10 px-2 py-0.5 text-[10px] text-[var(--orbit-text-muted)]">
                      {selectedProperty.area}
                    </span>
                  )}
                  {selectedProperty.bedrooms && (
                    <span className="rounded-md bg-[var(--orbit-glow)]/10 px-2 py-0.5 text-[10px] text-[var(--orbit-text-muted)]">
                      {selectedProperty.bedrooms} quartos
                    </span>
                  )}
                  <span className={`rounded-md px-2 py-0.5 text-[10px] capitalize ${getPropertyTypeIcon(selectedProperty.type)}`}>
                    {selectedProperty.type === "penthouse" ? "Cobertura" : selectedProperty.type === "house" ? "Casa" : "Apartamento"}
                  </span>
                  {selectedProperty.locationAccuracy && (
                    <span className={`rounded-md px-2 py-0.5 text-[10px] ${
                      selectedProperty.locationAccuracy === "precise"
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        : selectedProperty.locationAccuracy === "approximate"
                          ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                          : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                    }`}>
                      {selectedProperty.locationAccuracy === "precise" 
                        ? "Loc. precisa" 
                        : selectedProperty.locationAccuracy === "approximate"
                          ? "Loc. aproximada"
                          : "Loc. pendente"}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Confirm button - only show when there's a selection callback and property is ready */}
            {atlasInvokeContext?.onPropertySelected && selectedProperty.ingestionStatus !== "ingesting" && (
              <button
                onClick={handleConfirmSelection}
                disabled={selectedProperty.ingestionStatus === "failed"}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--orbit-glow)] py-3 text-sm font-medium text-[var(--orbit-bg)] transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Check className="h-4 w-4" />
                Vincular imóvel ao lead
              </button>
            )}
          </div>
        )}

        {/* Empty state hint */}
        {!selectedProperty && (
          <div className="border-t border-[var(--orbit-glass-border)] bg-[var(--orbit-glass)] px-4 py-3">
            <p className="text-center text-xs text-[var(--orbit-text-muted)]">
              {atlasInvokeContext?.onPropertySelected 
                ? "Toque em um marcador para selecionar o imóvel"
                : "Toque em um marcador para visualizar o imóvel"}
            </p>
          </div>
        )}
      </div>
    </>
  )
}
