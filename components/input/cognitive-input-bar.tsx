"use client";

import { useState, useRef, useEffect } from "react";
import { Send, MapPin, BrainCircuit, Zap, ChevronRight } from "lucide-react";

const COMMANDS = [
  { cmd: "/send-property", icon: MapPin, label: "Disparar imóvel do Atlas" },
  { cmd: "/ai-summary",    icon: BrainCircuit, label: "Resumo cognitivo" },
  { cmd: "/next-best-action", icon: Zap, label: "Próxima ação sugerida" },
];

interface CognitiveInputBarProps {
  onSend: (value: string) => void;
  onCommand?: (cmd: string) => void;
  disabled?: boolean;
}

export function CognitiveInputBar({ onSend, onCommand, disabled = false }: CognitiveInputBarProps) {
  const [value, setValue] = useState("");
  const [showCommands, setShowCommands] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredCommands = value.startsWith("/")
    ? COMMANDS.filter((c) => c.cmd.startsWith(value.toLowerCase()))
    : [];

  useEffect(() => {
    setShowCommands(filteredCommands.length > 0);
  }, [value, filteredCommands.length]);

  function handleSend() {
    const t = value.trim();
    if (!t || disabled) return;
    onSend(t);
    setValue("");
  }

  function handleCommand(cmd: string) {
    setValue("");
    setShowCommands(false);
    onCommand?.(cmd);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") { e.preventDefault(); handleSend(); }
    if (e.key === "Escape") setShowCommands(false);
  }

  return (
    <div
      className="relative flex-shrink-0"
      style={{
        background: "rgba(5, 5, 10, 0.96)",
        borderTop: "1px solid rgba(255,255,255,0.04)",
      }}
    >
      {/* Command picker */}
      {showCommands && (
        <div className="absolute bottom-full left-0 right-0 border-t border-[var(--orbit-glow)]/15 bg-[oklch(0.1_0.01_250)]/98 backdrop-blur-lg overflow-hidden z-50">
          {filteredCommands.map((c) => {
            const Icon = c.icon;
            return (
              <button
                key={c.cmd}
                onClick={() => handleCommand(c.cmd)}
                className="flex w-full items-center gap-3 px-5 py-2.5 text-left hover:bg-[var(--orbit-glow)]/8 transition-colors border-b border-white/[0.03] last:border-b-0"
              >
                <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--orbit-glow)" }} />
                <span className="text-[11px] font-mono text-white/50">{c.cmd}</span>
                <span className="text-[10px] text-[#64748b]/40 ml-auto">{c.label}</span>
                <ChevronRight className="w-3 h-3 text-[#64748b]/20 shrink-0" />
              </button>
            );
          })}
        </div>
      )}

      {/* Input row */}
      <div className="flex items-center gap-2 px-4 py-2.5">
        {/* Prompt indicator */}
        <span
          className="text-sm font-mono shrink-0 transition-opacity"
          style={{ color: isFocused ? "var(--orbit-glow)" : "rgba(255,255,255,0.15)" }}
        >
          &gt;
        </span>

        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          disabled={disabled}
          placeholder="escrever mensagem ··· (/ para comandos)"
          className="flex-1 bg-transparent text-sm outline-none text-white/85 placeholder:text-white/18 font-mono tracking-wide"
          style={{ caretColor: "var(--orbit-glow)" }}
        />

        {/* Short-cuts hint */}
        {!value && (
          <div className="hidden lg:flex items-center gap-2 shrink-0">
            {COMMANDS.map((c) => {
              const Icon = c.icon;
              return (
                <button
                  key={c.cmd}
                  onClick={() => { setValue(c.cmd); inputRef.current?.focus(); }}
                  className="flex items-center gap-1 px-2 py-1 rounded text-[9px] font-mono text-[#64748b]/40 hover:text-[var(--orbit-glow)] hover:bg-[var(--orbit-glow)]/5 transition-colors"
                >
                  <Icon className="w-2.5 h-2.5" />
                  {c.cmd}
                </button>
              );
            })}
          </div>
        )}

        <button
          onClick={handleSend}
          disabled={!value.trim() || disabled}
          className="ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all duration-200 disabled:opacity-20 hover:scale-105 active:scale-95"
          style={
            value.trim()
              ? { background: "var(--orbit-glow)", boxShadow: "0 0 12px rgba(var(--orbit-glow-rgb),0.35)" }
              : { background: "rgba(255,255,255,0.04)" }
          }
        >
          <Send className="h-3.5 w-3.5" style={{ color: value.trim() ? "#000" : "rgba(255,255,255,0.25)" }} />
        </button>
      </div>
    </div>
  );
}
