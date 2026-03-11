"use client"

import { useOrbitContext } from "./orbit-context"

type RitmoSistema = "Estável" | "Acumulando" | "Pausado"
type EstadoCognitivo = "Leve" | "Foco" | "Pesado"

interface StatusBarData {
  ritmo: RitmoSistema
  pendencias: { count: number; label: string }
  novoSinal: boolean
  estadoCognitivo: EstadoCognitivo
}

// Derive status from context state
function useStatusData(): StatusBarData {
  const { leadStates, newLeads } = useOrbitContext()
  
  const adminLeadCount = Object.values(leadStates).filter((s) => s.adminData).length

  // Derive ritmo based on activity
  let ritmo: RitmoSistema = "Estável"
  if (adminLeadCount === 0 && 0 === 0) ritmo = "Pausado"

  // Derive pendencias label
  let pendenciasLabel = "Nenhuma pendência"

  // Novo sinal - check for provisional leads or very recent leads
  const hasNovoSinal = newLeads.length > 0 || Object.values(leadStates).some((s) => s.isProvisional)

  // Estado cognitivo based on load
  let estadoCognitivo: EstadoCognitivo = "Leve"
  const totalActive = adminLeadCount + 5 // 5 static leads
  if (totalActive > 8 || 0 > 2) estadoCognitivo = "Foco"
  if (totalActive > 12 || 0 > 5) estadoCognitivo = "Pesado"

  return {
    ritmo,
    pendencias: { count: 0, label: pendenciasLabel },
    novoSinal: hasNovoSinal,
    estadoCognitivo,
  }
}

export function OrbitStatusBar() {
  const status = useStatusData()

  return (
    <div className="pointer-events-none absolute left-0 right-0 top-0 z-10 flex items-center justify-center px-6 py-3">
      <div className="flex items-center gap-6 text-[11px] font-light tracking-wide text-[var(--orbit-text-muted)]">
        {/* Ritmo do Sistema */}
        <div className="flex items-center gap-1.5">
          <span className="opacity-60">Ritmo</span>
          <span className="text-[var(--orbit-text-muted)]">{status.ritmo}</span>
        </div>

        <span className="opacity-30">·</span>

        {/* Pendências Ativas */}
        <div className="flex items-center gap-1.5">
          <span
            className={
              status.pendencias.count > 0
                ? "text-[var(--orbit-text)]"
                : "text-[var(--orbit-text-muted)]"
            }
          >
            {status.pendencias.label}
          </span>
        </div>

        {/* Novo Sinal - only show if present */}
        {status.novoSinal && (
          <>
            <span className="opacity-30">·</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[var(--orbit-text)]">Novo sinal</span>
            </div>
          </>
        )}

        <span className="opacity-30">·</span>

        {/* Estado Cognitivo */}
        <div className="flex items-center gap-1.5">
          <span className="opacity-60">Carga</span>
          <span className="text-[var(--orbit-text-muted)]">{status.estadoCognitivo}</span>
        </div>
      </div>
    </div>
  )
}
