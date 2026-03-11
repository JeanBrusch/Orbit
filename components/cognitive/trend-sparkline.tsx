"use client";

interface TrendEvent {
  label: string;
  icon: string;
  position: number; // 0 to 1 along the line
}

const EVENTS: TrendEvent[] = [
  { label: "imóvel enviado", icon: "🏠", position: 0.25 },
  { label: "resposta longa", icon: "💬", position: 0.55 },
  { label: "visita marcada", icon: "📍", position: 0.82 },
];

export function TrendSparkline() {
  const data = [35, 38, 34, 48, 52, 60, 58, 70, 68, 80, 85];
  const width = 160;
  const height = 48;
  const padding = 4;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const toX = (i: number) => padding + (i / (data.length - 1)) * (width - padding * 2);
  const toY = (v: number) => padding + (1 - (v - min) / range) * (height - padding * 2);

  const points = data.map((v, i) => `${toX(i)},${toY(v)}`).join(" ");

  // Area fill path
  const firstX = toX(0), lastX = toX(data.length - 1);
  const areaPath = `M${firstX},${height} L${data.map((v, i) => `${toX(i)},${toY(v)}`).join(" L")} L${lastX},${height} Z`;

  return (
    <div className="flex flex-col items-end gap-2 opacity-90 hover:opacity-100 transition-opacity">
      <div className="flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "oklch(0.75 0.15 80)" }} />
        <span className="text-[9px] font-mono uppercase tracking-[0.22em] text-[#64748b]/70">Tendência</span>
      </div>

      <div className="relative">
        <svg width={width} height={height} className="overflow-visible" style={{ filter: "drop-shadow(0 0 6px rgba(250,204,21,0.25))" }}>
          <defs>
            <linearGradient id="area-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="oklch(0.75 0.15 80)" stopOpacity="0.12" />
              <stop offset="100%" stopColor="oklch(0.75 0.15 80)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Area fill */}
          <path d={areaPath} fill="url(#area-grad)" />

          {/* Line */}
          <polyline
            points={points}
            fill="none"
            stroke="oklch(0.75 0.15 80)"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Event markers along the line */}
          {EVENTS.map((ev) => {
            const idx = Math.round(ev.position * (data.length - 1));
            const x = toX(idx);
            const y = toY(data[idx]);
            return (
              <g key={ev.label}>
                <circle cx={x} cy={y} r={3} fill="oklch(0.75 0.15 80)" opacity={0.9}>
                  <animate attributeName="r" values="2.5;4;2.5" dur="3s" repeatCount="indefinite" />
                </circle>
                {/* Vertical tick */}
                <line x1={x} y1={y + 3} x2={x} y2={height - 1} stroke="oklch(0.75 0.15 80)" strokeWidth={0.5} opacity={0.2} strokeDasharray="2,2" />
              </g>
            );
          })}

          {/* Latest value dot */}
          <circle cx={toX(data.length - 1)} cy={toY(data[data.length - 1])} r={3.5} fill="oklch(0.92 0.08 80)" opacity={0.95}>
            <animate attributeName="opacity" values="0.95;0.4;0.95" dur="2s" repeatCount="indefinite" />
          </circle>
        </svg>

        {/* Event labels (shown on hover via sibling CSS — simplified with absolute positioning) */}
        {EVENTS.map((ev) => {
          const idx = Math.round(ev.position * (data.length - 1));
          const xPct = (toX(idx) / width) * 100;
          return (
            <div
              key={ev.label}
              className="absolute bottom-full mb-1 text-[8px] font-mono text-[#64748b]/50 whitespace-nowrap pointer-events-none hidden group-hover:block"
              style={{ left: `${xPct}%`, transform: "translateX(-50%)" }}
            >
              {ev.icon}
            </div>
          );
        })}
      </div>

      {/* Legend row */}
      <div className="flex items-center gap-3">
        {EVENTS.map((ev) => (
          <span key={ev.label} className="flex items-center gap-1 text-[8px] font-mono text-[#64748b]/40">
            {ev.icon} <span className="hidden sm:inline">{ev.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
