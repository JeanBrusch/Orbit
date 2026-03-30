"use client"

import { useTheme } from "next-themes"
import { motion, AnimatePresence } from "framer-motion"
import { 
  ChevronLeft, Search, Map as MapIcon, 
  Layers, Filter, Users, LayoutGrid, Plus, Pencil
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useOrbitContext } from "@/components/orbit-context"

export type MapMode = "inventory" | "intent" | "hybrid"

interface AtlasTopBarProps {
  mapMode: MapMode
  onMapModeChange: (mode: MapMode) => void
  onOpenSearch: () => void
  onOpenSelections: () => void
  onOpenIngestion: () => void
}

export function AtlasTopBar({
  mapMode,
  onMapModeChange,
  onOpenSearch,
  onOpenSelections,
  onOpenIngestion
}: AtlasTopBarProps) {
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"
  const { selectedLeadId, leadStates } = useOrbitContext()
  
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const activeLead = selectedLeadId ? leadStates[selectedLeadId] : null

  return (
    <div className="fixed top-0 left-0 right-0 z-[20] pointer-events-none p-4 md:p-6 flex items-start justify-between">
      
      {/* LEFT: Identity / Back */}
      <div className="pointer-events-auto flex items-center gap-3">
        <button
          onClick={() => router.push("/")}
          className={`w-12 h-12 flex items-center justify-center rounded-2xl backdrop-blur-md transition-all ${
            isDark 
              ? "bg-[#12121A]/80 border border-white/5 text-white/70 hover:text-white hover:bg-white/10" 
              : "bg-white/80 border border-black/5 text-black/70 hover:text-black hover:bg-black/5"
          }`}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Lead Selector / Status */}
        <div className={`h-12 flex items-center gap-3 pl-3 pr-4 rounded-2xl backdrop-blur-md border ${
          isDark 
            ? "bg-[#12121A]/80 border-white/5" 
            : "bg-white/80 border-black/5"
        }`}>
          {activeLead ? (
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-[var(--orbit-glow)]/20 flex items-center justify-center text-[10px] font-bold text-[var(--orbit-glow)]">
                {activeLead.adminData?.avatar || "L"}
              </div>
              <span className={`text-sm font-medium ${isDark ? "text-white" : "text-black"}`}>
                {activeLead.adminData?.name || "Lead Ativo"}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Users className={`w-4 h-4 ${isDark ? "text-white/40" : "text-black/40"}`} />
              <span className={`text-sm font-medium ${isDark ? "text-white/40" : "text-black/40"}`}>
                Nenhum lead ativo
              </span>
            </div>
          )}
        </div>
      </div>

      {/* CENTER: Semantic Search — Responsive */}
      <div className="pointer-events-auto absolute left-1/2 top-4 md:top-6 -translate-x-1/2 z-[30]">
        <button
          onClick={onOpenSearch}
          className={`h-12 flex items-center justify-between rounded-2xl backdrop-blur-md border transition-all ${
            isDark 
              ? "bg-[#12121A]/80 border-white/5 text-white/40 hover:text-white/70 hover:bg-white/5 shadow-2xl" 
              : "bg-white/80 border-black/5 text-black/40 hover:text-black/70 hover:bg-black/5 shadow-lg"
          } ${/* Width logic: single icon on mob, wide on desktop */
             'w-12 md:w-80 px-0 md:px-4'
          }`}
        >
          <div className="flex items-center gap-2 w-full justify-center md:justify-start">
            <Search className="w-5 h-5 md:w-4 md:h-4 text-[#C9A84C]" />
            <span className="hidden md:inline text-sm">Reinterpretar mapa...</span>
          </div>
          <div className="hidden md:flex gap-1">
            <kbd className={`px-2 py-1 rounded-md text-[10px] font-mono ${isDark ? "bg-white/10" : "bg-black/5"}`}>⌘</kbd>
            <kbd className={`px-2 py-1 rounded-md text-[10px] font-mono ${isDark ? "bg-white/10" : "bg-black/5"}`}>K</kbd>
          </div>
        </button>
      </div>

      {/* RIGHT: Modes & Menu */}
      <div className="pointer-events-auto flex flex-col items-end gap-3">
        {/* Map Modes */}
        <div className={`p-1 flex rounded-2xl backdrop-blur-md border ${
          isDark ? "bg-[#12121A]/80 border-white/5" : "bg-white/80 border-black/5"
        }`}>
          {[
            { id: "inventory", icon: MapIcon, label: "Realidade" },
            { id: "hybrid", icon: Layers, label: "Híbrido" },
            { id: "intent", icon: Filter, label: "Intenção" }
          ].map((mode) => {
            const isActive = mapMode === mode.id
            return (
              <button
                key={mode.id}
                onClick={() => onMapModeChange(mode.id as MapMode)}
                className={`relative px-4 py-2 text-xs font-medium rounded-xl transition-all ${
                  isActive 
                    ? isDark ? "text-[var(--orbit-glow)]" : "text-blue-600"
                    : isDark ? "text-white/40 hover:text-white/70" : "text-black/40 hover:text-black/70"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="mode-pill"
                    className={`absolute inset-0 rounded-xl ${
                      isDark ? "bg-[var(--orbit-glow)]/10" : "bg-blue-600/10"
                    }`}
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5 px-1 md:px-0">
                  <mode.icon className="w-4 h-4 md:w-3.5 md:h-3.5" />
                  <span className="hidden md:inline">{mode.label}</span>
                </span>
              </button>
            )
          })}
        </div>

        {/* Expandable Menu */}
        <div className="relative">
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className={`w-12 h-12 flex items-center justify-center rounded-2xl backdrop-blur-md border transition-all ${
              isDark 
                ? "bg-[#12121A]/80 border-white/5 text-white/70 hover:text-white hover:bg-white/10" 
                : "bg-white/80 border-black/5 text-black/70 hover:text-black hover:bg-black/5"
            }`}
          >
            <LayoutGrid className="w-5 h-5" />
          </button>

          <AnimatePresence>
            {isMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className={`absolute right-0 top-14 w-48 p-2 rounded-2xl backdrop-blur-2xl border shadow-2xl ${
                  isDark ? "bg-[#12121A]/95 border-white/10" : "bg-white/95 border-black/10"
                }`}
              >
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => {
                      onOpenSelections()
                      setIsMenuOpen(false)
                    }}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                      isDark ? "text-white/70 hover:text-white hover:bg-white/5" : "text-black/70 hover:text-black hover:bg-black/5"
                    }`}
                  >
                    <Layers className="w-4 h-4" />
                    Curadoria
                  </button>
                  <button
                    onClick={() => {
                      onOpenIngestion()
                      setIsMenuOpen(false)
                    }}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                      isDark ? "text-white/70 hover:text-white hover:bg-white/5" : "text-black/70 hover:text-black hover:bg-black/5"
                    }`}
                  >
                    <Plus className="w-4 h-4" />
                    Ingestão Imóveis
                  </button>
                  <button
                    onClick={() => setIsMenuOpen(false)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                      isDark ? "text-white/70 hover:text-white hover:bg-white/5" : "text-black/70 hover:text-black hover:bg-black/5"
                    }`}
                  >
                    <Pencil className="w-4 h-4" />
                    Edição Rápida
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
