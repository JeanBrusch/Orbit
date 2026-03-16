"use client"

import { useState, useEffect, useCallback } from "react"
import { Settings2 } from "lucide-react"
import { AdminDrawer } from "./admin-drawer"
import { useOrbitContext } from "@/components/orbit-context"

export function AdminTrigger() {
  const { setIsAdminDrawerOpen, isAdminDrawerOpen: isOpen } = useOrbitContext()
  const [showHint, setShowHint] = useState(false)

  // Keyboard shortcut: Cmd/Ctrl + Shift + A
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "a") {
        e.preventDefault()
        setIsAdminDrawerOpen(true)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [setIsAdminDrawerOpen])

  const handleOpen = useCallback(() => {
    setIsAdminDrawerOpen(true)
    setShowHint(false)
  }, [setIsAdminDrawerOpen])

  const handleClose = useCallback(() => {
    setIsAdminDrawerOpen(false)
  }, [setIsAdminDrawerOpen])

  return (
    <>
      {/* Discreet trigger - bottom left corner */}
      <button
        onClick={handleOpen}
        onMouseEnter={() => setShowHint(true)}
        onMouseLeave={() => setShowHint(false)}
        className="fixed bottom-4 left-4 z-[110] flex h-8 w-8 items-center justify-center rounded-full bg-[var(--orbit-glass)] border border-[var(--orbit-glass-border)] text-[var(--orbit-text-muted)] opacity-30 transition-all duration-240 hover:opacity-100 hover:text-[var(--orbit-text)] hover:scale-110 hover:shadow-lg"
        aria-label="Abrir painel administrativo"
      >
        <Settings2 className="h-4 w-4" />
      </button>

      {/* Keyboard hint tooltip */}
      {showHint && (
        <div className="fixed bottom-14 left-4 z-[110] rounded-lg bg-[var(--orbit-glass)] border border-[var(--orbit-glass-border)] px-3 py-2 text-xs text-[var(--orbit-text-muted)] shadow-lg animate-text-fade-in">
          <span className="font-medium text-[var(--orbit-text)]">Admin</span>
          <span className="ml-2 rounded bg-[var(--orbit-glow)]/10 px-1.5 py-0.5 font-mono text-[10px]">
            Ctrl+Shift+A
          </span>
        </div>
      )}

      {/* Admin Drawer */}
      <AdminDrawer isOpen={isOpen} onClose={handleClose} />
    </>
  )
}
