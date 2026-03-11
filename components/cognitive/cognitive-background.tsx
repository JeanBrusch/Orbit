"use client";

export function CognitiveBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      {/* Base dark */}
      <div className="absolute inset-0 bg-[#050508]" />

      {/* Grid */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)
          `,
          backgroundSize: "44px 44px",
        }}
      />

      {/* Deep radial center glow — creates depth */}
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(ellipse 70% 60% at 50% 50%, rgba(var(--orbit-glow-rgb), 0.04) 0%, transparent 70%)",
        }}
      />

      {/* Orbital ring 1 */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[var(--orbit-glow)]/[0.04]"
        style={{ width: "55vw", height: "55vw" }}
      />
      {/* Orbital ring 2 */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[var(--orbit-glow)]/[0.025]"
        style={{ width: "80vw", height: "80vw" }}
      />
      {/* Orbital ring 3 (faintest) */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.015]"
        style={{ width: "105vw", height: "105vw" }}
      />

      {/* Soft particle-like diffuse dots */}
      {[
        { top: "18%", left: "22%", size: 2 },
        { top: "33%", left: "72%", size: 1.5 },
        { top: "55%", left: "15%", size: 1.5 },
        { top: "68%", left: "80%", size: 2 },
        { top: "42%", left: "88%", size: 1 },
        { top: "25%", left: "55%", size: 1 },
        { top: "78%", left: "38%", size: 1.5 },
        { top: "12%", left: "42%", size: 1 },
      ].map((p, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-[var(--orbit-glow)] opacity-10 animate-pulse"
          style={{
            top: p.top,
            left: p.left,
            width: p.size,
            height: p.size,
            animationDelay: `${i * 0.7}s`,
            animationDuration: `${3 + (i % 3)}s`,
          }}
        />
      ))}

      {/* Vignette to contain edges */}
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(ellipse 100% 100% at 50% 50%, transparent 50%, rgba(0,0,0,0.6) 100%)",
        }}
      />
    </div>
  );
}
