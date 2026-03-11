"use client";

import { useEffect, useRef, useState } from "react";

const SIZE = 160;
const STROKE = 2.5;
const RADIUS = (SIZE - STROKE * 2) / 2;
const CENTER = SIZE / 2;
const START_ANGLE = 155;
const END_ANGLE = 385;
const SWEEP = END_ANGLE - START_ANGLE;

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? 0 : 1;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

function getArcColor(value: number): string {
  if (value >= 80) return "oklch(0.92 0.08 195)"; // near-white cyan
  if (value >= 60) return "oklch(0.78 0.15 195)"; // bright cyan
  if (value >= 40) return "oklch(0.65 0.18 210)"; // blue-cyan
  return "oklch(0.55 0.12 230)"; // deeper blue
}

function getGlowIntensity(value: number): string {
  const base = Math.round(value * 0.3);
  return `0 0 ${base}px rgba(var(--orbit-glow-rgb), ${(value / 100) * 0.6})`;
}

export function CognitiveArc({ value, stageLabel }: { value: number; stageLabel: string }) {
  const [animatedValue, setAnimatedValue] = useState(0);
  const [pulse, setPulse] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Smooth count-up
    const step = value / 40;
    let current = 0;
    const timer = setInterval(() => {
      current = Math.min(current + step, value);
      setAnimatedValue(Math.round(current));
      if (current >= value) clearInterval(timer);
    }, 30);
    return () => clearInterval(timer);
  }, [value]);

  useEffect(() => {
    // Breathing pulse every 3s
    intervalRef.current = setInterval(() => {
      setPulse(true);
      setTimeout(() => setPulse(false), 600);
    }, 3000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const trackPath = describeArc(CENTER, CENTER, RADIUS, START_ANGLE, END_ANGLE);
  // Trail path: faded, from 0 to current fill
  const trailFillAngle = START_ANGLE + (SWEEP * Math.max(0, animatedValue - 18)) / 100;
  const trailPath = animatedValue > 18 ? describeArc(CENTER, CENTER, RADIUS, START_ANGLE, trailFillAngle) : "";
  const fillAngle = START_ANGLE + (SWEEP * animatedValue) / 100;
  const fillPath = describeArc(CENTER, CENTER, RADIUS, START_ANGLE, fillAngle);
  const indicatorPos = polarToCartesian(CENTER, CENTER, RADIUS, fillAngle);
  const arcColor = getArcColor(animatedValue);
  const glowShadow = getGlowIntensity(animatedValue);

  return (
    <div
      className={`relative flex flex-col items-center justify-center transition-transform duration-500 ${pulse ? "scale-[1.025]" : "scale-100"}`}
      style={{ filter: `drop-shadow(${glowShadow})` }}
    >
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="overflow-visible z-10">
        <defs>
          <filter id="arc-glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {/* Background track */}
        <path d={trackPath} fill="none" stroke="oklch(0.18 0.005 250)" strokeWidth={STROKE} strokeLinecap="round" />

        {/* Residual trail (slightly thinner, very faint) */}
        {trailPath && (
          <path d={trailPath} fill="none" stroke={arcColor} strokeWidth={STROKE - 1} strokeLinecap="round" opacity={0.25} />
        )}

        {/* Active fill */}
        <path
          d={fillPath}
          fill="none"
          stroke={arcColor}
          strokeWidth={STROKE}
          strokeLinecap="round"
          filter="url(#arc-glow)"
          style={{ transition: "d 0.8s ease-out" }}
        />

        {/* Live dot at tip */}
        <circle cx={indicatorPos.x} cy={indicatorPos.y} r={4} fill={arcColor} opacity={0.9}>
          <animate attributeName="r" values="3;5;3" dur="2.5s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.9;0.4;0.9" dur="2.5s" repeatCount="indefinite" />
        </circle>
      </svg>

      {/* Center label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pt-4">
        <span className="text-3xl font-sans font-light tracking-tighter text-white/90 drop-shadow-md tabular-nums">
          {animatedValue}<span className="text-xs text-white/30 ml-0.5">%</span>
        </span>
        <span className="mt-0.5 text-[8px] font-mono uppercase tracking-[0.22em]" style={{ color: arcColor }}>
          Engajamento
        </span>
      </div>
    </div>
  );
}
