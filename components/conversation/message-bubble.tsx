"use client";

import { Check, CheckCheck } from "lucide-react";

interface MessageBubbleProps {
  content: string;
  timestamp: string;
  direction: "inbound" | "outbound";
  status?: "sent" | "delivered" | "read";
}

export function MessageBubble({ content, timestamp, direction, status }: MessageBubbleProps) {
  const isLead = direction === "inbound";

  return (
    <div className={`flex w-full ${isLead ? "justify-start" : "justify-end"} mb-4`}>
      <div className={`flex flex-col gap-1 max-w-[75%] relative group`}>
        {/* Glow effect for outbound */}
        {!isLead && (
          <div className="absolute inset-0 bg-[var(--orbit-glow)]/10 blur-md rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
        )}
        
        <div 
          className={`relative px-5 py-3.5 rounded-2xl backdrop-blur-md border border-white/5 shadow-lg ${
            isLead 
              ? "bg-[oklch(0.2_0.01_250)]/60 rounded-tl-sm" 
              : "bg-[oklch(0.24_0.005_250)]/80 rounded-tr-sm border-r-[var(--orbit-glow)]/30"
          }`}
        >
          <p className="text-sm font-sans text-white/90 leading-relaxed whitespace-pre-wrap">
            {content}
          </p>
        </div>
        
        <div className={`flex items-center gap-1.5 px-1 mt-0.5 ${isLead ? "justify-start" : "justify-end"}`}>
          <span className="text-[10px] font-mono text-[#64748b]/60">
            {timestamp}
          </span>
          {!isLead && status && (
            <span className="flex items-center">
              {status === "sent" && <Check className="w-3 h-3 text-[#64748b]/50" />}
              {status === "delivered" && <CheckCheck className="w-3 h-3 text-[#64748b]/50" />}
              {status === "read" && <CheckCheck className="w-3 h-3 text-[var(--orbit-glow)]" />}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
