"use client"

import { useState, useEffect } from "react"
import { Building2, Heart, Eye, MapPin, Clock, AlertCircle } from "lucide-react"

// Client-visible property state (excludes "discarded" which is internal)
type ClientPropertyState = "sent" | "favorited" | "visited"

interface ClientProperty {
  id: string
  name: string
  address: string
  type: "apartment" | "house" | "penthouse" | "commercial"
  price: string
  area: string
  bedrooms?: number
  state: ClientPropertyState
  sentAt: Date
}

interface CapsuleData {
  agentName: string
  agentCompany: string
  clientName: string
  properties: ClientProperty[]
  isValid: boolean
  isArchived: boolean // When cycle is ended, capsule becomes read-only
  cycleName?: string
}

// Validate magic link token (in production, this would be server-side)
function validateMagicLinkToken(token: string): CapsuleData | null {
  // Token must be at least 24 hex characters (secure token)
  if (!token || token.length < 24 || !/^[a-f0-9]+$/i.test(token)) {
    return null
  }
  
  // In production, this would fetch from the database using the token
  // For now, return sample data for valid-looking tokens
  // Tokens ending with 'a' are archived (for demo purposes)
  const isArchived = token.endsWith("a")

  return {
    agentName: "Carolina",
    agentCompany: "Lux Imóveis",
    clientName: "Marina",
    isValid: true,
    isArchived,
    cycleName: "jan 2026",
    properties: [
      {
        id: "p1",
        name: "Laguna Premium",
        address: "Av. Beira Mar, 1200 - Ponta Negra",
        type: "penthouse" as const,
        price: "R$ 2.450.000",
        area: "248m²",
        bedrooms: 4,
        state: "favorited" as ClientPropertyState,
        sentAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      },
      {
        id: "p2",
        name: "Marina Bay Residence",
        address: "Rua das Palmeiras, 450 - Petrópolis",
        type: "apartment" as const,
        price: "R$ 890.000",
        area: "120m²",
        bedrooms: 3,
        state: "visited" as ClientPropertyState,
        sentAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      },
      {
        id: "p3",
        name: "Solar do Atlântico",
        address: "Av. Eng. Roberto Freire, 2100",
        type: "apartment" as const,
        price: "R$ 650.000",
        area: "85m²",
        bedrooms: 2,
        state: "sent" as ClientPropertyState,
        sentAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
      },
      {
        id: "p5",
        name: "Villa Serena",
        address: "Condomínio Bosque das Árvores",
        type: "house" as const,
        price: "R$ 1.850.000",
        area: "320m²",
        bedrooms: 5,
        state: "sent" as ClientPropertyState,
        sentAt: new Date(),
      },
    ],
  }
}

function formatRelativeDate(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 1) return "agora"
  if (diffMins < 60) return `há ${diffMins}min`
  if (diffHours < 24) return `há ${diffHours}h`
  if (diffDays === 1) return "ontem"
  if (diffDays < 7) return `há ${diffDays} dias`
  return date.toLocaleDateString("pt-BR", { day: "numeric", month: "short" })
}

function getPropertyTypeLabel(type: ClientProperty["type"]): string {
  const labels = {
    apartment: "Apartamento",
    house: "Casa",
    penthouse: "Cobertura",
    commercial: "Comercial",
  }
  return labels[type]
}

export default function ClientCapsulePage({ params }: { params: Promise<{ id: string }> }) {
  const [capsuleData, setCapsuleData] = useState<CapsuleData | null>(null)
  const [properties, setProperties] = useState<ClientProperty[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isInvalidLink, setIsInvalidLink] = useState(false)

  useEffect(() => {
    // Resolve params and validate magic link token
    params.then((resolvedParams) => {
      const token = resolvedParams.id
      
      // Simulate server validation delay
      setTimeout(() => {
        const data = validateMagicLinkToken(token)
        
        if (data) {
          setCapsuleData(data)
          setProperties(data.properties)
        } else {
          setIsInvalidLink(true)
        }
        setIsLoading(false)
      }, 600)
    })
  }, [params])

// Check if capsule is archived (read-only)
  const isArchived = capsuleData?.isArchived ?? false

  // Toggle favorite state (disabled when archived)
  const handleToggleFavorite = (propertyId: string) => {
    if (isArchived) return
    setProperties((prev) =>
      prev.map((p) =>
        p.id === propertyId
          ? { ...p, state: p.state === "favorited" ? "sent" : "favorited" }
          : p
      )
    )
  }

  // Mark as visited
// Mark as visited (disabled when archived)
  const handleMarkVisited = (propertyId: string) => {
    if (isArchived) return
    setProperties((prev) =>
      prev.map((p) =>
        p.id === propertyId
          ? { ...p, state: p.state === "visited" ? "sent" : "visited" }
          : p
      )
    )
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--orbit-bg)]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--orbit-glow)] border-t-transparent" />
          <p className="text-sm text-[var(--orbit-text-muted)]">Carregando seus imóveis...</p>
        </div>
      </div>
    )
  }

  // Invalid or expired magic link
  if (isInvalidLink || !capsuleData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--orbit-bg)] px-4">
        <div className="flex max-w-sm flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--orbit-glass)] text-[var(--orbit-text-muted)]">
            <AlertCircle className="h-8 w-8" />
          </div>
          <h1 className="mt-6 text-lg font-medium text-[var(--orbit-text)]">
            Link indisponível
          </h1>
          <p className="mt-2 text-sm text-[var(--orbit-text-muted)]">
            Este link pode ter expirado ou não é mais válido. Entre em contato com seu corretor para receber um novo link.
          </p>
        </div>
      </div>
    )
  }

  // Sort by sentAt descending (newest first)
  const sortedProperties = [...properties].sort(
    (a, b) => b.sentAt.getTime() - a.sentAt.getTime()
  )

  const favoritedCount = properties.filter((p) => p.state === "favorited").length
  const visitedCount = properties.filter((p) => p.state === "visited").length

  return (
    <div className="min-h-screen bg-[var(--orbit-bg)]">
      {/* Header - Minimal, calm */}
<header className="sticky top-0 z-10 border-b border-[var(--orbit-glass-border)] bg-[var(--orbit-bg)]/80 backdrop-blur-xl">
        <div className="mx-auto max-w-2xl px-4 py-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-medium text-[var(--orbit-text)]">
                  Seus Imóveis
                </h1>
                {isArchived && (
                  <span className="rounded-md bg-zinc-500/20 px-2 py-0.5 text-[10px] font-medium text-zinc-400">
                    Arquivado
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-sm text-[var(--orbit-text-muted)]">
                Selecionados por {capsuleData.agentName}
                {capsuleData.cycleName && (
                  <span className="text-[var(--orbit-text-muted)]/50"> · {capsuleData.cycleName}</span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs text-[var(--orbit-text-muted)]">
              {favoritedCount > 0 && (
                <span className="flex items-center gap-1">
                  <Heart className="h-3.5 w-3.5 text-rose-400" />
                  {favoritedCount}
                </span>
              )}
              {visitedCount > 0 && (
                <span className="flex items-center gap-1">
                  <Eye className="h-3.5 w-3.5 text-emerald-400" />
                  {visitedCount}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Property List - Simple chronological order */}
      <main className="mx-auto max-w-2xl px-4 py-6">
        <div className="space-y-4">
          {sortedProperties.map((property) => (
            <PropertyCard
              key={property.id}
              property={property}
              onToggleFavorite={handleToggleFavorite}
              onMarkVisited={handleMarkVisited}
            />
          ))}
        </div>

        {/* Footer note */}
        <div className="mt-8 text-center">
          <p className="text-xs text-[var(--orbit-text-muted)]">
            {properties.length} {properties.length === 1 ? "imóvel selecionado" : "imóveis selecionados"} para você
          </p>
        </div>
      </main>
    </div>
  )
}

// Property Card Component - Calm, decision-oriented
function PropertyCard({
  property,
  onToggleFavorite,
  onMarkVisited,
}: {
  property: ClientProperty
  onToggleFavorite: (id: string) => void
  onMarkVisited: (id: string) => void
}) {
  const isFavorited = property.state === "favorited"
  const isVisited = property.state === "visited"

  return (
    <article className="overflow-hidden rounded-2xl border border-[var(--orbit-glass-border)] bg-[var(--orbit-glass)] transition-all hover:border-[var(--orbit-glow)]/30">
      {/* Property Content */}
      <div className="p-5">
        {/* Header with type and time */}
        <div className="mb-3 flex items-center justify-between">
          <span className="rounded-md bg-[var(--orbit-glow)]/10 px-2 py-1 text-[10px] font-medium text-[var(--orbit-glow)]">
            {getPropertyTypeLabel(property.type)}
          </span>
          <span className="flex items-center gap-1 text-[10px] text-[var(--orbit-text-muted)]">
            <Clock className="h-3 w-3" />
            {formatRelativeDate(property.sentAt)}
          </span>
        </div>

        {/* Property Info */}
        <div className="flex gap-4">
          {/* Icon */}
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[var(--orbit-bg-secondary)] text-[var(--orbit-glow)]">
            <Building2 className="h-7 w-7" />
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-medium text-[var(--orbit-text)]">
              {property.name}
            </h2>
            <p className="mt-0.5 flex items-center gap-1 text-sm text-[var(--orbit-text-muted)]">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{property.address}</span>
            </p>
            <div className="mt-2 flex items-center gap-3">
              <span className="text-base font-semibold text-[var(--orbit-glow)]">
                {property.price}
              </span>
              <span className="text-sm text-[var(--orbit-text-muted)]">
                {property.area}
              </span>
              {property.bedrooms && (
                <span className="text-sm text-[var(--orbit-text-muted)]">
                  {property.bedrooms} quartos
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons - Simple toggles */}
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => onToggleFavorite(property.id)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-all ${
              isFavorited
                ? "bg-rose-500/20 text-rose-400"
                : "bg-[var(--orbit-bg-secondary)] text-[var(--orbit-text-muted)] hover:bg-rose-500/10 hover:text-rose-400"
            }`}
          >
            <Heart className={`h-4 w-4 ${isFavorited ? "fill-current" : ""}`} />
            {isFavorited ? "Favoritado" : "Favoritar"}
          </button>
          <button
            onClick={() => onMarkVisited(property.id)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-all ${
              isVisited
                ? "bg-emerald-500/20 text-emerald-400"
                : "bg-[var(--orbit-bg-secondary)] text-[var(--orbit-text-muted)] hover:bg-emerald-500/10 hover:text-emerald-400"
            }`}
          >
            <Eye className={`h-4 w-4 ${isVisited ? "fill-current" : ""}`} />
            {isVisited ? "Visitado" : "Marcar visita"}
          </button>
        </div>
      </div>
    </article>
  )
}
