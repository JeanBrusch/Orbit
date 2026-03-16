"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { X, TrendingUp } from "lucide-react"
import type { CoreState } from "@/app/page"

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
  const inputRef = useRef<HTMLInputElement>(null)

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (inputValue.trim()) {
      onQuerySubmit(inputValue.trim())
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
      className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
      role="presentation"
    >
      {/* Outermost ring */}
      <div
        className={`absolute left-1/2 top-1/2 h-[480px] w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[var(--orbit-line)] pointer-events-none ${
          state === "listening" || state === "processing" ? "opacity-70" : "opacity-40"
        } ${getOuterRingClass()}`}
        style={{ transformOrigin: "center center" }}
      />

      {/* Third ring */}
      <div
        className={`absolute left-1/2 top-1/2 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[var(--orbit-line)] pointer-events-none ${
          state === "listening" || state === "processing" ? "opacity-80" : "opacity-50"
        } ${getInnerRingClass()}`}
        style={{ transformOrigin: "center center" }}
      >
        <div className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-[var(--orbit-glow)]" />
        <div className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-[var(--orbit-accent)]" />
      </div>

      {/* Second ring */}
      <div
        className={`absolute left-1/2 top-1/2 h-[320px] w-[320px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--orbit-glow)]/30 pointer-events-none ${getOuterRingClass()}`}
        style={{ transformOrigin: "center center" }}
      >
        <div className="absolute -left-1 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-[var(--orbit-glow)]" />
        <div className="absolute -right-1 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-[var(--orbit-glow)]" />
      </div>

      {/* Inner ring */}
      <div
        className={`absolute left-1/2 top-1/2 h-[240px] w-[240px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[var(--orbit-glow)]/40 pointer-events-none ${getInnerRingClass()}`}
        style={{ transformOrigin: "center center" }}
      />

      {/* Processing ripple rings */}
      {state === "processing" && (
        <>
          <div className="absolute left-1/2 top-1/2 h-[180px] w-[180px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--orbit-glow)] animate-processing-ripple pointer-events-none" />
          <div
            className="absolute left-1/2 top-1/2 h-[180px] w-[180px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--orbit-glow)] animate-processing-ripple pointer-events-none"
            style={{ animationDelay: "0.5s" }}
          />
          <div
            className="absolute left-1/2 top-1/2 h-[180px] w-[180px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--orbit-glow)] animate-processing-ripple pointer-events-none"
            style={{ animationDelay: "1s" }}
          />
        </>
      )}

      {/* Central core */}
      <div 
        className={`${getCoreClasses()} pointer-events-auto`}
        onClick={state === "idle" ? onActivate : undefined}
        onKeyDown={(e) => {
          if (e.key === "Enter" && state === "idle") {
            onActivate()
          }
          handleKeyDown(e)
        }}
        tabIndex={0}
        role="button"
        aria-label="Centro de comando ORBIT, clique para interagir"
        title="Clique para consultar leads"
      >
        {/* Inner glow */}
        <div
          className={`absolute inset-2 rounded-full bg-gradient-to-br from-[var(--orbit-glow)]/10 to-transparent transition-opacity duration-300 pointer-events-none ${
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
                placeholder="O que você quer saber?"
                className="w-full bg-transparent text-center text-xs font-light text-[var(--orbit-text)] placeholder:text-[var(--orbit-text-muted)] focus:outline-none"
                aria-label="Digite sua pergunta sobre os leads"
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

          {/* Other states - show message */}
          {state !== "listening" && (
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
