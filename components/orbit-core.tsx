"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { X, TrendingUp, ArrowLeft, Brain } from "lucide-react"
import type { CoreState } from "@/app/page"
import { useOrbitContext } from "./orbit-context"

interface OrbitCoreProps {
  state: CoreState
  message: string
  activeCount: number
  onActivate: () => void
  onQuerySubmit: (query: string) => void
  onCancel: () => void
}

export function OrbitCore({ state, message, activeCount, onActivate, onQuerySubmit, onCancel }: OrbitCoreProps) {
  const [inputValue, setInputValue] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  
  const { orbitView, activateOrbitView, deactivateOrbitView } = useOrbitContext()

  useEffect(() => {
    if (state === "listening" && inputRef.current) {
      inputRef.current.focus()
    }
  }, [state])

  useEffect(() => {
    if (state === "idle") {
      setInputValue("")
    }
  }, [state])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (inputValue.trim()) {
      setIsSearching(true)
      await activateOrbitView(inputValue.trim())
      setIsSearching(false)
      setInputValue("")
      onCancel()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onCancel()
    }
  }

  const getOuterRingClass = () => {
    if (state === "listening" || state === "processing") {
      return "animate-ring-fast"
    }
    return "animate-orbit-rotate"
  }

  const getInnerRingClass = () => {
    if (state === "listening" || state === "processing") {
      return "animate-ring-fast-reverse"
    }
    return "animate-orbit-rotate-reverse"
  }

  const getCoreClasses = () => {
    const base =
      "relative flex h-[180px] w-[180px] cursor-pointer items-center justify-center rounded-full bg-[var(--orbit-glass)] backdrop-blur-xl border border-[var(--orbit-glass-border)] transition-all duration-300"

    if (state === "listening") {
      return `${base} animate-core-listening`
    }
    if (state === "processing" || state === "responding") {
      return `${base} scale-105`
    }
    return `${base} animate-orbit-breathe animate-orbit-pulse hover:scale-[1.02]`
  }

  return (
    <div
      className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2"
      role="button"
      tabIndex={0}
      aria-label="Centro de comando ORBIT, clique para interagir"
      title="Clique para consultar leads"
      onClick={state === "idle" ? onActivate : undefined}
      onKeyDown={(e) => {
        if (e.key === "Enter" && state === "idle") {
          onActivate()
        }
        handleKeyDown(e)
      }}
    >
      {/* Outermost ring — matches orbit ring 4 (r=480 → ⌀960) */}
      <div
        className={`absolute left-1/2 top-1/2 h-[960px] w-[960px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[var(--orbit-line)] ${
          state === "listening" || state === "processing" ? "opacity-50" : "opacity-25"
        } ${getOuterRingClass()}`}
        style={{ transformOrigin: "center center" }}
      />

      {/* Third ring — matches orbit ring 3 (r=360 → ⌀720) */}
      <div
        className={`absolute left-1/2 top-1/2 h-[720px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[var(--orbit-line)] ${
          state === "listening" || state === "processing" ? "opacity-60" : "opacity-30"
        } ${getInnerRingClass()}`}
        style={{ transformOrigin: "center center" }}
      >
        <div className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-[var(--orbit-glow)]" />
        <div className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-[var(--orbit-accent)]" />
      </div>

      {/* Second ring — matches orbit ring 2 (r=240 → ⌀480) */}
      <div
        className={`absolute left-1/2 top-1/2 h-[480px] w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--orbit-glow)]/20 ${getOuterRingClass()}`}
        style={{ transformOrigin: "center center" }}
      >
        <div className="absolute -left-1 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-[var(--orbit-glow)]" />
        <div className="absolute -right-1 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-[var(--orbit-glow)]" />
      </div>

      {/* Inner ring — matches orbit ring 1 (r=130 → ⌀260) */}
      <div
        className={`absolute left-1/2 top-1/2 h-[260px] w-[260px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[var(--orbit-glow)]/40 ${getInnerRingClass()}`}
        style={{ transformOrigin: "center center" }}
      />

      {/* Processing ripple rings */}
      {state === "processing" && (
        <>
          <div className="absolute left-1/2 top-1/2 h-[180px] w-[180px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--orbit-glow)] animate-processing-ripple" />
          <div
            className="absolute left-1/2 top-1/2 h-[180px] w-[180px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--orbit-glow)] animate-processing-ripple"
            style={{ animationDelay: "0.5s" }}
          />
          <div
            className="absolute left-1/2 top-1/2 h-[180px] w-[180px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--orbit-glow)] animate-processing-ripple"
            style={{ animationDelay: "1s" }}
          />
        </>
      )}

      {/* Central core */}
      <div className={getCoreClasses()}>
        {/* Inner glow */}
        <div
          className={`absolute inset-2 rounded-full bg-gradient-to-br from-[var(--orbit-glow)]/10 to-transparent transition-opacity duration-300 ${
            state === "listening" || state === "processing" ? "opacity-100 from-[var(--orbit-glow)]/20" : ""
          }`}
        />

        {/* Core content */}
        <div className="relative z-10 text-center w-full px-4">
          {/* Listening state - show input */}
          {state === "listening" && (
            <form onSubmit={handleSubmit} className="animate-text-fade-in">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Busque por nome, contexto ou perfil..."
                className="w-full bg-transparent text-center text-[11px] font-light text-[var(--orbit-text)] placeholder:text-[var(--orbit-text-muted)] focus:outline-none"
                aria-label="Busque por nome, contexto ou perfil de lead..."
              />
              <div className="mt-2 text-[9px] text-[var(--orbit-text-muted)]">
                Enter para buscar · Esc para cancelar
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onCancel()
                }}
                className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--orbit-glass)] border border-[var(--orbit-glass-border)] text-[var(--orbit-text-muted)] hover:text-[var(--orbit-text)] transition-colors"
                aria-label="Cancelar"
              >
                <X className="h-3 w-3" />
              </button>
            </form>
          )}

          {/* ORBIT VIEW active state - work mode by intention */}
          {state !== "listening" && orbitView.active && (
            <div className="animate-text-fade-in">
              <div className="text-sm font-light tracking-[0.3em] text-[var(--orbit-glow)]">ORBIT</div>
              <div className="mt-1 text-[10px] font-light tracking-wider text-violet-400">
                Modo de Trabalho Ativo
              </div>
              <div className="mt-1.5 flex items-center justify-center gap-1.5">
                <Brain className="h-3.5 w-3.5 text-violet-400" />
                <span className="text-xs font-medium text-[var(--orbit-text)] capitalize">
                  {orbitView.query}
                </span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  deactivateOrbitView()
                }}
                className="mt-2 flex items-center justify-center gap-1 text-[9px] text-[var(--orbit-text-muted)] hover:text-[var(--orbit-text)] transition-colors mx-auto"
              >
                <ArrowLeft className="h-3 w-3" />
                Sair do modo
              </button>
            </div>
          )}

          {/* Other states - show message */}
          {state !== "listening" && !orbitView.active && (
            <div className={state === "responding" || state === "processing" ? "animate-text-fade-in" : ""}>
              <div className="text-sm font-light tracking-[0.3em] text-[var(--orbit-glow)]">ORBIT</div>
              <div className="mt-1 text-[10px] font-light tracking-wider text-[var(--orbit-text-muted)]">{message}</div>
              {state === "idle" && (
                <div className="mt-2 flex items-center justify-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5 text-[var(--orbit-glow)] animate-activity-pulse" />
                  <span className="text-sm font-medium text-[var(--orbit-glow)] opacity-90 dark:drop-shadow-[0_0_10px_rgba(46,197,255,0.5)]">
                    {activeCount} ativos
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Pulse ring */}
        <div
          className={`absolute inset-0 rounded-full border border-[var(--orbit-glow)]/50 ${
            state === "idle" ? "animate-semantic-pulse" : "opacity-0"
          }`}
        />
      </div>
    </div>
  )
}
