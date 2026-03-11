"use client";

export function CompatibilityRadar() {
  const SIZE = 200;
  const CENTER = SIZE / 2;
  const RADIUS = 80;

  // Hexagon background
  const hexPoints = Array.from({ length: 6 }).map((_, i) => {
    const angle = (i * 60 - 30) * (Math.PI / 180);
    return `${CENTER + RADIUS * Math.cos(angle)},${CENTER + RADIUS * Math.sin(angle)}`;
  }).join(" ");

  // Data shape (Visitas, Cliques, Buscas, Retenção, Favoritos, Região)
  const dataPoints = [0.8, 0.6, 0.9, 0.4, 0.7, 0.85];
  const dataPoly = dataPoints.map((val, i) => {
    const angle = (i * 60 - 30) * (Math.PI / 180);
    const r = RADIUS * val;
    return `${CENTER + r * Math.cos(angle)},${CENTER + r * Math.sin(angle)}`;
  }).join(" ");

  const labels = ["Visitas", "Cliques", "Buscas", "Retenção", "Favoritos", "Perfil"];

  return (
    <div className="relative flex flex-col items-center p-4 bg-[oklch(0.1_0.01_250)]/90 backdrop-blur-md rounded-2xl border border-[oklch(0.4_0.08_195)]/30 scale-0 group-hover:scale-100 transition-transform origin-bottom duration-300 pointer-events-none">
      <span className="text-[10px] font-mono text-[var(--orbit-glow)] uppercase tracking-widest mb-2 z-10">
        Compatibilidade
      </span>
      
      <div className="relative">
        <svg width={SIZE} height={SIZE} className="overflow-visible">
          {/* Radar Grid */}
          {[0.25, 0.5, 0.75, 1].map((scale, idx) => (
            <polygon
              key={idx}
              points={Array.from({ length: 6 }).map((_, i) => {
                const angle = (i * 60 - 30) * (Math.PI / 180);
                const r = RADIUS * scale;
                return `${CENTER + r * Math.cos(angle)},${CENTER + r * Math.sin(angle)}`;
              }).join(" ")}
              fill="none"
              stroke="rgba(255,255,255,0.05)"
              strokeWidth="1"
            />
          ))}
          
          {/* Spokes */}
          {Array.from({ length: 6 }).map((_, i) => {
            const angle = (i * 60 - 30) * (Math.PI / 180);
            return (
              <line
                key={`spoke-${i}`}
                x1={CENTER}
                y1={CENTER}
                x2={CENTER + RADIUS * Math.cos(angle)}
                y2={CENTER + RADIUS * Math.sin(angle)}
                stroke="rgba(255,255,255,0.05)"
                strokeWidth="1"
              />
            );
          })}

          {/* Data Shape */}
          <polygon
            points={dataPoly}
            fill="rgba(var(--orbit-glow-rgb), 0.2)"
            stroke="var(--orbit-glow)"
            strokeWidth="1.5"
            className="drop-shadow-[0_0_8px_rgba(var(--orbit-glow-rgb),0.5)]"
          />
          
          {/* Data Points Glow */}
          {dataPoints.map((val, i) => {
             const angle = (i * 60 - 30) * (Math.PI / 180);
             const r = RADIUS * val;
             return (
               <circle
                 key={`pt-${i}`}
                 cx={CENTER + r * Math.cos(angle)}
                 cy={CENTER + r * Math.sin(angle)}
                 r={3}
                 fill="var(--orbit-glow)"
                 className="animate-pulse"
               />
             )
          })}
        </svg>

        {/* Labels Overlay */}
        {labels.map((label, i) => {
          const angle = (i * 60 - 30) * (Math.PI / 180);
          const r = RADIUS + 15;
          const x = CENTER + r * Math.cos(angle);
          const y = CENTER + r * Math.sin(angle);
          return (
            <span 
              key={label}
              className="absolute text-[8px] font-mono uppercase tracking-widest text-[#64748b]/60 whitespace-nowrap"
              style={{
                left: `${x}px`,
                top: `${y}px`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              {label}
            </span>
          )
        })}
      </div>
    </div>
  );
}
