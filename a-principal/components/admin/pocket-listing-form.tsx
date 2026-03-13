"use client"

import React from "react"
import { useState, useCallback } from "react"
import { Loader2, Link2, ExternalLink, AlertCircle } from "lucide-react"
import { useOrbitContext } from "@/components/orbit-context"

interface PocketListingFormProps {
  onSuccess: () => void
  onCancel: () => void
}

export function PocketListingForm({ onSuccess, onCancel }: PocketListingFormProps) {
  const [url, setUrl] = useState("")
  const [isIngesting, setIsIngesting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { ingestPropertyFromUrl } = useOrbitContext()

  // Validate URL format
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
  }, [])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      
      if (!url.trim()) {
        setError("Cole um link para continuar")
        return
      }
      
      if (!isValidUrl(url)) {
        setError("URL inválida. Verifique o link e tente novamente.")
        return
      }

      setIsIngesting(true)
      setError(null)

      try {
        // Start ingestion pipeline - this will:
        // 1. Create property immediately with "ingesting" status
        // 2. Open Atlas automatically
        // 3. Run extraction in background
        // 4. Update property when complete
        await ingestPropertyFromUrl(url)
        
        // Close the admin drawer - Atlas is now open with the property
        onSuccess()
      } catch (err) {
        // Even on error, property stub is created in Atlas
        // Just close the form
        onSuccess()
      } finally {
        setIsIngesting(false)
      }
    },
    [url, isValidUrl, ingestPropertyFromUrl, onSuccess]
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* URL input */}
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
            disabled={isIngesting}
          />
          {url && isValidUrl(url) && !isIngesting && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <ExternalLink className="h-4 w-4 text-[var(--orbit-glow)]" />
            </div>
          )}
          {isIngesting && (
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

      {/* Source type hint */}
      {url && isValidUrl(url) && (
        <div className="flex items-center gap-2 rounded-lg border border-[var(--orbit-glass-border)] bg-[var(--orbit-glass)]/50 px-3 py-2 animate-text-fade-in">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--orbit-glow)]/10">
            <Link2 className="h-3.5 w-3.5 text-[var(--orbit-glow)]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-[var(--orbit-text)] truncate">{new URL(url).hostname}</p>
            <p className="text-[10px] text-[var(--orbit-text-muted)]">
              O imóvel será importado automaticamente
            </p>
          </div>
        </div>
      )}

      {/* Submit button */}
      <button
        type="submit"
        disabled={!url.trim() || isIngesting}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--orbit-glow)] py-3 text-sm font-medium text-[var(--orbit-bg)] transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isIngesting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Importando para o Atlas...
          </>
        ) : (
          <>
            <Link2 className="h-4 w-4" />
            Importar imóvel
          </>
        )}
      </button>

      {/* Help text */}
      <p className="text-center text-[10px] text-[var(--orbit-text-muted)]/60">
        Suporta links de portais imobiliários, sites de construtoras e PDFs
      </p>
    </form>
  )
}
