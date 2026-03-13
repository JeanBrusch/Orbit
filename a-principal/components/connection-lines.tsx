"use client"

import type { CoreState } from "@/app/page"

interface ConnectionLinesProps {
  highlightedLeads: string[]
  coreState: CoreState
}

const leadPositions: Record<string, { x: string; y: string; hasRecentActivity?: boolean }> = {
  "1": { x: "20%", y: "18%", hasRecentActivity: true },
  "2": { x: "65%", y: "25%" },
  "3": { x: "15%", y: "60%", hasRecentActivity: true },
  "4": { x: "55%", y: "70%" },
  "5": { x: "8%", y: "40%", hasRecentActivity: true },
}

export function ConnectionLines({ highlightedLeads, coreState }: ConnectionLinesProps) {
  const isResponding = coreState === "responding"
  const hasHighlights = highlightedLeads.length > 0

  return (
    <svg className="pointer-events-none absolute inset-0 z-5" width="100%" height="100%">
      <defs>
        <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(var(--orbit-glow-rgb), 0.1)" />
          <stop offset="50%" stopColor="rgba(var(--orbit-glow-rgb), 0.5)" />
          <stop offset="100%" stopColor="rgba(var(--orbit-glow-rgb), 0.1)" />
        </linearGradient>
        <linearGradient id="lineGradientAmber" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(var(--orbit-accent-rgb), 0.1)" />
          <stop offset="50%" stopColor="rgba(var(--orbit-accent-rgb), 0.4)" />
          <stop offset="100%" stopColor="rgba(var(--orbit-accent-rgb), 0.1)" />
        </linearGradient>
        <linearGradient id="lineGradientHighlight" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(var(--orbit-glow-rgb), 0.3)" />
          <stop offset="50%" stopColor="rgba(var(--orbit-glow-rgb), 1)" />
          <stop offset="100%" stopColor="rgba(var(--orbit-glow-rgb), 0.3)" />
        </linearGradient>
        <filter id="lineGlow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="4" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="lineGlowSubtle" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="2" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Main connection lines from each lead to center */}
      {Object.entries(leadPositions).map(([id, pos], index) => {
        const isHighlighted = highlightedLeads.includes(id)
        const staggerDelay = isHighlighted ? highlightedLeads.indexOf(id) * 0.15 : 0

        return (
          <line
            key={id}
            x1={pos.x}
            y1={pos.y}
            x2="50%"
            y2="50%"
            stroke={
              isHighlighted && isResponding
                ? "url(#lineGradientHighlight)"
                : id === "3"
                  ? "url(#lineGradientAmber)"
                  : "url(#lineGradient)"
            }
            strokeWidth={isHighlighted && isResponding ? "2" : "0.5"}
            className={`transition-all duration-500 ${
              isResponding && hasHighlights
                ? isHighlighted
                  ? "animate-connection-draw"
                  : "opacity-30"
                : pos.hasRecentActivity
                  ? "animate-line-pulse-active"
                  : "animate-line-pulse"
            }`}
            style={{
              animationDelay: isHighlighted ? `${staggerDelay}s` : `${index * 0.5}s`,
              filter: isHighlighted && isResponding ? "url(#lineGlow)" : "url(#lineGlowSubtle)",
            }}
          />
        )
      })}

      {/* Secondary inter-lead connections */}
      <line
        x1="20%"
        y1="18%"
        x2="65%"
        y2="25%"
        stroke="url(#lineGradient)"
        strokeWidth="0.3"
        className={`transition-opacity duration-500 ${isResponding && hasHighlights ? "opacity-15" : "opacity-50"}`}
        style={{ filter: "url(#lineGlowSubtle)" }}
      />
      <line
        x1="15%"
        y1="60%"
        x2="8%"
        y2="40%"
        stroke="url(#lineGradientAmber)"
        strokeWidth="0.3"
        className={`transition-opacity duration-500 ${isResponding && hasHighlights ? "opacity-15" : "opacity-50"}`}
        style={{ filter: "url(#lineGlowSubtle)" }}
      />
    </svg>
  )
}
