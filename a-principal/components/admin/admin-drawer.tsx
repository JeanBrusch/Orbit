"use client"

import React from "react"

import { useState, useCallback, useEffect } from "react"
import { X, UserPlus, Building2, ChevronRight, Loader2 } from "lucide-react"
import { QuickLeadForm } from "./quick-lead-form"
import { PocketListingForm } from "./pocket-listing-form"

type AdminView = "menu" | "lead" | "property"

interface AdminDrawerProps {
  isOpen: boolean
  onClose: () => void
}

export function AdminDrawer({ isOpen, onClose }: AdminDrawerProps) {
  const [view, setView] = useState<AdminView>("menu")
  const [isExiting, setIsExiting] = useState(false)

  // Reset view when drawer closes
  useEffect(() => {
    if (!isOpen) {
      setView("menu")
      setIsExiting(false)
    }
  }, [isOpen])

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        if (view !== "menu") {
          setView("menu")
        } else {
          handleClose()
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, view])

  const handleClose = useCallback(() => {
    setIsExiting(true)
    setTimeout(() => {
      onClose()
      setIsExiting(false)
    }, 200)
  }, [onClose])

  const handleSuccess = useCallback(() => {
    // Brief delay to show success state, then close
    setTimeout(() => {
      handleClose()
    }, 800)
  }, [handleClose])

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[80] bg-black/40 backdrop-blur-[2px] transition-opacity duration-200 ${
          isExiting ? "opacity-0" : "opacity-100"
        }`}
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-[90] max-h-[85vh] overflow-hidden rounded-t-2xl bg-[var(--orbit-bg)] border-t border-x border-[var(--orbit-glass-border)] shadow-[0_-12px_40px_rgba(0,0,0,0.3)] transition-transform duration-300 ease-out ${
          isExiting ? "translate-y-full" : "translate-y-0"
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-drawer-title"
      >
        {/* Handle bar */}
        <div className="flex justify-center py-3">
          <div className="h-1 w-10 rounded-full bg-[var(--orbit-text-muted)]/30" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--orbit-glass-border)] px-4 pb-3">
          <div className="flex items-center gap-3">
            {view !== "menu" && (
              <button
                onClick={() => setView("menu")}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--orbit-text-muted)] transition-colors hover:bg-[var(--orbit-glow)]/10 hover:text-[var(--orbit-text)]"
                aria-label="Voltar"
              >
                <ChevronRight className="h-5 w-5 rotate-180" />
              </button>
            )}
            <h2 id="admin-drawer-title" className="text-sm font-medium text-[var(--orbit-text)]">
              {view === "menu" && "Backstage"}
              {view === "lead" && "Novo Lead"}
              {view === "property" && "Pocket Listing"}
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--orbit-text-muted)] transition-colors hover:bg-[var(--orbit-glow)]/10 hover:text-[var(--orbit-text)]"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-4" style={{ maxHeight: "calc(85vh - 80px)" }}>
          {view === "menu" && (
            <div className="grid gap-3">
              <AdminMenuItem
                icon={<UserPlus className="h-5 w-5" />}
                title="Criar Lead"
                description="Adiciona um lead rapidamente ao Orbit"
                onClick={() => setView("lead")}
              />
              <AdminMenuItem
                icon={<Building2 className="h-5 w-5" />}
                title="Pocket Listing"
                description="Colar link de imóvel para o Atlas"
                onClick={() => setView("property")}
              />
            </div>
          )}

          {view === "lead" && (
            <QuickLeadForm onSuccess={handleSuccess} onCancel={() => setView("menu")} />
          )}

          {view === "property" && (
            <PocketListingForm onSuccess={handleSuccess} onCancel={() => setView("menu")} />
          )}
        </div>
      </div>
    </>
  )
}

interface AdminMenuItemProps {
  icon: React.ReactNode
  title: string
  description: string
  onClick: () => void
}

function AdminMenuItem({ icon, title, description, onClick }: AdminMenuItemProps) {
  return (
    <button
      onClick={onClick}
      className="group flex w-full items-center gap-4 rounded-xl border border-[var(--orbit-glass-border)] bg-[var(--orbit-glass)] p-4 text-left transition-all duration-240 hover:border-[var(--orbit-glow)]/40 hover:bg-[var(--orbit-glow)]/5"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--orbit-glow)]/10 text-[var(--orbit-glow)] transition-colors group-hover:bg-[var(--orbit-glow)]/20">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-medium text-[var(--orbit-text)]">{title}</h3>
        <p className="text-xs text-[var(--orbit-text-muted)] truncate">{description}</p>
      </div>
      <ChevronRight className="h-5 w-5 text-[var(--orbit-text-muted)] transition-transform group-hover:translate-x-1" />
    </button>
  )
}
