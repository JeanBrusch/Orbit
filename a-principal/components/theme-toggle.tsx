"use client"

import { Sun, Moon } from "lucide-react"

interface ThemeToggleProps {
  isDark: boolean
  onToggle: () => void
}

export function ThemeToggle({ isDark, onToggle }: ThemeToggleProps) {
  return (
    <button
      onClick={onToggle}
      className="absolute right-6 top-6 z-40 flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--orbit-glass-border)] bg-[var(--orbit-glass)] backdrop-blur-xl shadow-[var(--orbit-shadow)] transition-all duration-300 hover:border-[var(--orbit-glow)]/50 hover:shadow-[var(--orbit-shadow-hover)]"
      aria-label={isDark ? "Mudar para modo claro" : "Mudar para modo escuro"}
    >
      {isDark ? (
        <Sun className="h-4 w-4 text-[var(--orbit-accent)]" />
      ) : (
        <Moon className="h-4 w-4 text-[var(--orbit-glow)]" />
      )}
    </button>
  )
}
