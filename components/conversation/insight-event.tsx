"use client";

import { BrainCircuit } from "lucide-react";

interface InsightEventProps {
  content: string;
  timestamp: string;
}

export function InsightEvent({ content, timestamp }: InsightEventProps) {
  return (
    <div className="flex w-full justify-center my-6">
      <div className="relative group max-w-[85%]">
        <div className="absolute -inset-1 bg-gradient-to-r from-[var(--orbit-glow)]/0 via-[var(--orbit-glow)]/20 to-[var(--orbit-glow)]/0 blur-md rounded-xl opacity-50 group-hover:opacity-100 transition-opacity" />
        <div className="relative flex items-start gap-4 px-5 py-4 rounded-xl bg-[oklch(0.12_0.01_250)]/90 backdrop-blur-lg border border-[var(--orbit-glow)]/20">
          
          <div className="mt-0.5 w-6 h-6 rounded-full bg-[var(--orbit-glow)]/10 flex items-center justify-center shrink-0 border border-[var(--orbit-glow)]/30 shadow-[0_0_10px_rgba(var(--orbit-glow-rgb),0.2)]">
            <BrainCircuit className="w-3.5 h-3.5 text-[var(--orbit-glow)]" />
          </div>
          
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--orbit-glow)] font-bold">
                Motor Cognitivo
              </span>
              <span className="w-1 h-1 rounded-full bg-[var(--orbit-glow)] animate-pulse" />
              <span className="text-[9px] font-mono text-[#64748b]/50 flex-1 text-right">
                {timestamp}
              </span>
            </div>
            <p className="text-xs font-mono leading-relaxed text-[#94a3b8] mt-1">
              &quot;{content}&quot;
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
