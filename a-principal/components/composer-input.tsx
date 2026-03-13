"use client"

import { useState } from "react"
import { Send, Sparkles } from "lucide-react"

export function ComposerInput() {
  const [input, setInput] = useState("")
  const [isFocused, setIsFocused] = useState(false)

  const suggestions = ["Leads quentes", "Quem respondeu hoje?", "Próximos follow-ups"]

  return (
    <div className="absolute bottom-8 left-1/2 z-30 w-full max-w-xl -translate-x-1/2 px-6">
      <div
        className={`mb-2 flex justify-center gap-2 transition-all duration-300 ${
          isFocused ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"
        }`}
      >
        {suggestions.map((suggestion, i) => (
          <button
            key={i}
            onClick={() => setInput(suggestion)}
            className="rounded-full border border-[var(--orbit-glass-border)] bg-[var(--orbit-glass)] px-3 py-1 text-[10px] text-[var(--orbit-text-muted)] backdrop-blur-xl transition-all duration-200 hover:border-[var(--orbit-glow)]/50 hover:text-[var(--orbit-text)]"
          >
            {suggestion}
          </button>
        ))}
      </div>

      <div
        className={`rounded-2xl border bg-[var(--orbit-glass)] p-1 backdrop-blur-xl shadow-[var(--orbit-shadow)] transition-all duration-300 ${
          isFocused
            ? "border-[var(--orbit-glow)]/50 shadow-[0_0_30px_rgba(46,197,255,0.15)] scale-[1.02]"
            : "border-[var(--orbit-glass-border)]"
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 items-center justify-center transition-all duration-300 ${isFocused ? "scale-110" : ""}`}
          >
            <Sparkles
              className={`h-4 w-4 text-[#2EC5FF] transition-all duration-300 ${
                isFocused ? "drop-shadow-[0_0_12px_rgba(46,197,255,0.8)]" : "opacity-70 animate-sparkle-pulse"
              }`}
            />
          </div>

          {/* Input */}
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="O que você quer provocar agora?"
            className="flex-1 bg-transparent text-sm font-light text-[var(--orbit-text)] placeholder:text-[var(--orbit-text-muted)] focus:outline-none"
          />

          {/* Send button */}
          <button
            className={`flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-[240ms] ${
              input
                ? "bg-[#2EC5FF] text-white shadow-[0_0_16px_rgba(46,197,255,0.4)]"
                : "text-[var(--orbit-text-muted)]"
            }`}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
