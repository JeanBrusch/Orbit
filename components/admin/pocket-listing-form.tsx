"use client"

import React from "react"
import { useState, useCallback } from "react"
import { Loader2, Link2, ExternalLink, AlertCircle, Check, X, Globe } from "lucide-react"

interface LinkPreview {
  title: string | null
  description: string | null
  image: string | null
  sourceDomain: string
  sourceLink: string
}

interface PocketListingFormProps {
  onSuccess: () => void
  onCancel: () => void
  onPropertyCreated?: () => void
}

export function PocketListingForm({ onSuccess, onCancel, onPropertyCreated }: PocketListingFormProps) {
  const [url, setUrl] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<LinkPreview | null>(null)

  const isValidUrl = useCallback((value: string): boolean => {
    try {
      new URL(value)
      return true
    } catch {
      return false
    }
  }, [])

  const handleUrlChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setUrl(value)
    setError(null)
    setPreview(null)
  }, [])

  const fetchPreview = useCallback(async () => {
    if (!url.trim()) {
      setError("Cole um link para continuar")
      return
    }
    
    if (!isValidUrl(url)) {
      setError("URL inválida. Verifique o link e tente novamente.")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/link-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })

      if (!response.ok) {
        throw new Error('Failed to fetch preview')
      }

      const data = await response.json()
      setPreview(data)
    } catch (err) {
      setError("Não foi possível carregar o preview. Tente novamente.")
    } finally {
      setIsLoading(false)
    }
  }, [url, isValidUrl])

  const handleConfirm = useCallback(async () => {
    if (!preview) return

    setIsConfirming(true)
    setError(null)

    try {
      const response = await fetch('/api/property', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: preview.title,
          coverImage: preview.image,
          sourceLink: preview.sourceLink,
          sourceDomain: preview.sourceDomain,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create property')
      }
      
      onSuccess()
      
      if (onPropertyCreated) {
        setTimeout(() => {
          onPropertyCreated()
        }, 100)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar imóvel")
    } finally {
      setIsConfirming(false)
    }
  }, [preview, onSuccess, onPropertyCreated])

  const handleClearPreview = useCallback(() => {
    setPreview(null)
    setUrl("")
  }, [])

  if (preview) {
    return (
      <div className="space-y-4 animate-text-fade-in">
        <div className="overflow-hidden rounded-xl border border-[var(--orbit-glass-border)] bg-[var(--orbit-glass)]">
          {preview.image ? (
            <div className="relative h-32 w-full bg-[var(--orbit-bg)]">
              <img 
                src={preview.image} 
                alt={preview.title || 'Preview'} 
                className="h-full w-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
              />
            </div>
          ) : (
            <div className="flex h-24 w-full items-center justify-center bg-[var(--orbit-bg)]">
              <Globe className="h-8 w-8 text-[var(--orbit-text-muted)]/30" />
            </div>
          )}
          
          <div className="p-4 space-y-2">
            <h3 className="font-medium text-[var(--orbit-text)] line-clamp-2">
              {preview.title || 'Título não disponível'}
            </h3>
            
            <div className="flex items-center gap-2 text-xs text-[var(--orbit-text-muted)]">
              <Globe className="h-3 w-3" />
              <span>{preview.sourceDomain}</span>
            </div>

            {preview.description && (
              <p className="text-xs text-[var(--orbit-text-muted)] line-clamp-2">
                {preview.description}
              </p>
            )}

            <a 
              href={preview.sourceLink} 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-[var(--orbit-glow)] hover:underline"
            >
              Ver anúncio original
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-xs text-rose-400">
            <AlertCircle className="h-3.5 w-3.5" />
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleClearPreview}
            disabled={isConfirming}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--orbit-glass-border)] bg-transparent py-3 text-sm font-medium text-[var(--orbit-text)] transition-all hover:bg-[var(--orbit-glass)] active:scale-[0.98] disabled:opacity-50"
          >
            <X className="h-4 w-4" />
            Outro link
          </button>
          
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isConfirming}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--orbit-glow)] py-3 text-sm font-medium text-[var(--orbit-bg)] transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
          >
            {isConfirming ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                Confirmar
              </>
            )}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="property-url" className="flex items-center gap-2 text-xs font-medium text-[var(--orbit-text-muted)]">
          <Link2 className="h-3.5 w-3.5" />
          Link do imóvel
        </label>
        <div className="relative">
          <input
            id="property-url"
            type="url"
            value={url}
            onChange={handleUrlChange}
            placeholder="Cole o link do imóvel aqui"
            className="w-full rounded-xl border border-[var(--orbit-glass-border)] bg-[var(--orbit-glass)] px-4 py-3 pr-10 text-sm text-[var(--orbit-text)] placeholder:text-[var(--orbit-text-muted)]/50 outline-none transition-all focus:border-[var(--orbit-glow)]/50 focus:ring-2 focus:ring-[var(--orbit-glow)]/20"
            autoFocus
            autoComplete="off"
            disabled={isLoading}
          />
          {url && isValidUrl(url) && !isLoading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <ExternalLink className="h-4 w-4 text-[var(--orbit-glow)]" />
            </div>
          )}
          {isLoading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Loader2 className="h-4 w-4 animate-spin text-[var(--orbit-glow)]" />
            </div>
          )}
        </div>
        {error && (
          <div className="flex items-center gap-2 text-xs text-rose-400">
            <AlertCircle className="h-3.5 w-3.5" />
            {error}
          </div>
        )}
      </div>

      {url && isValidUrl(url) && (
        <div className="flex items-center gap-2 rounded-lg border border-[var(--orbit-glass-border)] bg-[var(--orbit-glass)]/50 px-3 py-2 animate-text-fade-in">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--orbit-glow)]/10">
            <Link2 className="h-3.5 w-3.5 text-[var(--orbit-glow)]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-[var(--orbit-text)] truncate">{new URL(url).hostname}</p>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={fetchPreview}
        disabled={!url.trim() || isLoading}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--orbit-glow)] py-3 text-sm font-medium text-[var(--orbit-bg)] transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando preview...
          </>
        ) : (
          <>
            <Link2 className="h-4 w-4" />
            Buscar preview
          </>
        )}
      </button>

      <p className="text-center text-[10px] text-[var(--orbit-text-muted)]/60">
        Suporta links de portais imobiliários e sites de construtoras
      </p>
    </div>
  )
}
