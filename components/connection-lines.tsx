"use client"

import type { CoreState } from "@/app/page"

interface ConnectionLinesProps {
  highlightedLeads: string[]
  coreState: CoreState
  /** Pixel offsets from centre (0,0) for each lead */
  leadPositions?: Map<string, { x: number; y: number }>
}

export function ConnectionLines({ highlightedLeads, coreState, leadPositions }: ConnectionLinesProps) {
  const isResponding = coreState === "responding"
  const hasHighlights = highlightedLeads.length > 0

  if (!leadPositions || leadPositions.size === 0) return null

  // Centre of the SVG canvas (since the SVG covers the full viewport)
  const cx = "50%"
  const cy = "50%"

  const entries = Array.from(leadPositions.entries())

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-[5]"
      width="100%"
      height="100%"
      style={{ overflow: "visible" }}
    >
      <defs>
        <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(var(--orbit-glow-rgb), 0.05)" />
          <stop offset="50%" stopColor="rgba(var(--orbit-glow-rgb), 0.35)" />
          <stop offset="100%" stopColor="rgba(var(--orbit-glow-rgb), 0.05)" />
        </linearGradient>
        <linearGradient id="lineGradientHighlight" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(var(--orbit-glow-rgb), 0.3)" />
          <stop offset="50%" stopColor="rgba(var(--orbit-glow-rgb), 1)" />
          <stop offset="100%" stopColor="rgba(var(--orbit-glow-rgb), 0.3)" />
        </linearGradient>
        <filter id="lineGlow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="lineGlowSubtle" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {entries.map(([id, pos], index) => {
        const isHighlighted = highlightedLeads.includes(id)
        const staggerDelay = isHighlighted ? highlightedLeads.indexOf(id) * 0.15 : 0

        // Convert px offset from centre to SVG coordinates
        const x2 = `calc(50% + ${pos.x}px)`
        const y2 = `calc(50% + ${pos.y}px)`

        return (
          <line
            key={id}
            x1={cx}
            y1={cy}
            x2={x2}
            y2={y2}
            stroke={
              isHighlighted && isResponding
                ? "url(#lineGradientHighlight)"
                : "url(#lineGradient)"
            }
            strokeWidth={isHighlighted && isResponding ? "1.5" : "0.5"}
            className={`transition-all duration-500 ${
              isResponding && hasHighlights
                ? isHighlighted
                  ? "opacity-100"
                  : "opacity-10"
                : "opacity-40"
            }`}
            style={{
              animationDelay: isHighlighted ? `${staggerDelay}s` : `${index * 0.4}s`,
              filter: isHighlighted && isResponding ? "url(#lineGlow)" : "url(#lineGlowSubtle)",
            }}
          />
        )
      })}
    </svg>
  )
}
