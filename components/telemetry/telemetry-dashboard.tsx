"use client";

import { useState } from "react";
import { useTelemetryData } from "@/hooks/use-telemetry-data";
import { useTheme } from "next-themes";
import { useAuth } from "@/hooks/use-auth";
import { TopBar } from "@/components/top-bar";
import { MetricCard, EffortChart, CognitiveStateChart } from "./telemetry-elements";
import { PersistenceCurve, InactivityHeatmap, QualityMatrix } from "./telemetry-advanced-charts";
import { TelemetrySidebar, CognitiveTable } from "./telemetry-sections";
import { ParticleBackground } from "@/components/particle-background";
import { Loader2, TrendingUp, Cpu, Activity, ArrowLeft, Zap, Mic, Star } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useOrbitContext } from "@/components/orbit-context";
import { LeadCognitiveConsole } from "@/components/lead-cognitive-console";
import Link from "next/link";

// Helper for initials since it wasn't exported from lib/utils
function initials(name: string) {
  return name?.split(' ').map((n:any)=>n[0]).join('').slice(0,2).toUpperCase() || "L";
}

export function TelemetryDashboard() {
  const [timeframe, setTimeframe] = useState<7 | 30 | 90>(30);
  const { data, loading } = useTelemetryData(timeframe);
  const { selectedLeadId, isLeadPanelOpen, openLeadPanel, closeLeadPanel } = useOrbitContext();
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const { logout } = useAuth();

  if (loading || !data) {
    return (
      <div className={`flex min-h-screen items-center justify-center ${isDark ? 'bg-[#05060a]' : 'bg-[var(--orbit-bg)]'}`}>
        <div className="flex flex-col items-center gap-4">
          <Loader2 className={`h-8 w-8 animate-spin ${isDark ? 'text-[var(--orbit-glow)]' : 'text-[var(--orbit-glow)]'}`} />
          <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--orbit-text-muted)]">
            Sincronizando Campo Cognitivo...
          </div>
        </div>
      </div>
    );
  }

  // Prep processed data for sidebar and table (Real data mapping)
  // Mapping OrbitLead from useSupabaseLeads to the component's expected format
  const tableLeads = (data as any)?.rawLeads?.slice(0, 15).map((l: any) => ({
    id: l.id,
    name: l.name,
    origin: l.origin,
    state: l.orbitVisualState || "latent",
    interest: l.interestScore || 0,
    risk: l.riskScore || 0,
    daysInactive: l.daysSinceInteraction || 0,
  })) || [];

  return (
    <div className={`relative min-h-screen w-full overflow-x-hidden bg-[var(--orbit-bg)] text-[var(--orbit-text)]`}>
      <TopBar 
        totalLeads={data.rawLeads?.length || 0}
        isDark={isDark}
        onThemeToggle={() => setTheme(isDark ? "light" : "dark")}
        onLogout={logout}
      />
      <ParticleBackground />

      <div className="relative z-10 mx-auto max-w-[1400px] px-6 py-20 lg:px-8">
        {/* Header */}
        <header className={`mb-10 flex flex-col justify-between gap-6 border-b pb-8 sm:flex-row sm:items-end ${isDark ? 'border-white/5' : 'border-[var(--orbit-line)]'}`}>
          <div>
            <div className={`mb-2 flex items-center gap-2 font-mono text-[9px] font-semibold uppercase tracking-[0.2em] ${isDark ? 'text-[var(--orbit-glow)]/70' : 'text-[var(--orbit-glow)]'}`}>
              <Cpu className="h-3 w-3" />
              Operador · Cognitive Performance Terminal
            </div>
            <h1 className={`text-4xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-[var(--orbit-text)]'}`}>Telemetria do Operador</h1>
            <p className="mt-2 text-sm text-[var(--orbit-text-muted)]">
              Você está trabalhando bem? Nos horários certos? Seu esforço gera retorno?
            </p>
          </div>
          
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-3">
                <div className="flex flex-col items-center gap-1">
                   <div className="text-[10px] font-mono text-[#94a3b8] uppercase">Interesse</div>
                   <div className={`text-xl font-bold ${isDark ? 'text-[#2ec5ff]' : 'text-[var(--orbit-glow)]'}`}>{Math.round(data.avgInterest)}%</div>
                </div>
                <div className="flex flex-col items-center gap-1">
                   <div className="text-[10px] font-mono text-[#94a3b8] uppercase">Momentum</div>
                   <div className={`text-xl font-bold ${isDark ? 'text-[#ffc87a]' : 'text-amber-600'}`}>{Math.round(data.avgMomentum)}%</div>
                </div>
             </div>
             <div className={`h-10 w-[1px] ${isDark ? 'bg-white/10' : 'bg-[var(--orbit-line)]'}`} />
             <div className={`flex gap-1 rounded-lg p-1 ${isDark ? 'bg-white/5' : 'bg-[var(--orbit-bg-secondary)] border border-[var(--orbit-line)]'}`}>
                {[7, 30, 90].map(p => (
                   <button 
                     key={p} 
                     onClick={() => setTimeframe(p as 7 | 30 | 90)}
                     className={`rounded-md px-3 py-1 font-mono text-[10px] uppercase transition-all ${
                     p === timeframe 
                       ? isDark ? 'bg-[#2ec5ff]/10 text-[#2ec5ff] border border-[#2ec5ff]/20' : 'bg-[var(--orbit-glow)] text-white shadow-sm'
                       : 'text-[#94a3b8] hover:text-white dark:hover:text-white'
                   }`}>
                      {p}d
                   </button>
                ))}
             </div>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_300px]">
          {/* Main Content */}
          <main className="space-y-8">
            {/* Top Metrics Row */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
              <MetricCard label="Leads Ativos" value={data.totalLeads} subtext="Campo Atual" chip="Total" color="text-[#4ade80]" />
              <MetricCard label="Deciding" value={data.decidingLeads} subtext="Cognitivo" chip={data.decidingLeads.toString()} color="text-[#a78bfa]" />
              <MetricCard label="Dormant" value={data.dormantLeads} subtext="Inativos" chip={data.dormantLeads.toString()} color="text-[#ff7a7a]" />
              <MetricCard label="Follow-ups" value={data.followupCount} subtext="Ativos" chip="Hoje" color="text-[#ffc87a]" />
              <MetricCard label="Cápsula Ativa" value={data.capsuleCount} subtext="Leads" chip="Live" color="text-[#2ec5ff]" />
            </div>

            {/* Interaction Breakdown Row */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className={`flex items-center justify-between rounded-xl border px-6 py-4 backdrop-blur-sm ${isDark ? 'border-white/5 bg-white/5' : 'border-[var(--orbit-line)] bg-white shadow-sm'}`}>
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${isDark ? 'bg-[#2ec5ff]/10 text-[#2ec5ff]' : 'bg-[var(--orbit-glow)]/10 text-[var(--orbit-glow)]'}`}>
                     <Zap className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--orbit-text-muted)]">WhatsApp</div>
                    <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-[var(--orbit-text)]'}`}>{data.interactionBreakdown.whatsapp}</div>
                  </div>
                </div>
                <div className={`text-[10px] font-mono ${isDark ? 'text-[var(--orbit-glow)]/50' : 'text-[var(--orbit-glow)]/50'}`}>Mensagens</div>
              </div>

              <div className={`flex items-center justify-between rounded-xl border px-6 py-4 backdrop-blur-sm ${isDark ? 'border-white/5 bg-white/5' : 'border-[var(--orbit-line)] bg-white shadow-sm'}`}>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                     <Mic className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--orbit-text-muted)]">Ligações</div>
                    <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-[var(--orbit-text)]'}`}>{data.interactionBreakdown.calls}</div>
                  </div>
                </div>
                <div className="text-[10px] font-mono text-emerald-500/50">Esforço</div>
              </div>

              <div className={`flex items-center justify-between rounded-xl border px-6 py-4 backdrop-blur-sm ${isDark ? 'border-white/5 bg-white/5' : 'border-[var(--orbit-line)] bg-white shadow-sm'}`}>
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${isDark ? 'bg-[#d4af35]/10 text-[#d4af35]' : 'bg-amber-500/10 text-amber-600'}`}>
                     <Star className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--orbit-text-muted)]">Anotações</div>
                    <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-[var(--orbit-text)]'}`}>{data.interactionBreakdown.notes}</div>
                  </div>
                </div>
                <div className={`text-[10px] font-mono ${isDark ? 'text-[#d4af35]/50' : 'text-amber-600/50'}`}>Inteligência</div>
              </div>
            </div>

            {/* Middle Section: Charts */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <Card className={`border p-6 backdrop-blur-md ${isDark ? 'border-[var(--orbit-border)] bg-[var(--orbit-glass)]' : 'border-[var(--orbit-line)] bg-white shadow-sm'}`}>
                <div className={`mb-1 font-mono text-[9px] font-semibold uppercase tracking-widest ${isDark ? 'text-[var(--orbit-glow)]/70' : 'text-[var(--orbit-glow)]'}`}>Esforço vs Reatividade</div>
                <div className="mb-4 text-xs text-[var(--orbit-text-muted)]">dias sem interação por lead · distribuição do campo</div>
                <EffortChart data={data.diasBuckets} />
              </Card>

              <Card className={`border p-6 backdrop-blur-md ${isDark ? 'border-[var(--orbit-border)] bg-[var(--orbit-glass)]' : 'border-[var(--orbit-line)] bg-white shadow-sm'}`}>
                <div className={`mb-1 font-mono text-[9px] font-semibold uppercase tracking-widest ${isDark ? 'text-[var(--orbit-glow)]/70' : 'text-[var(--orbit-glow)]'}`}>Estados Cognitivos</div>
                <div className="mb-4 text-xs text-[var(--orbit-text-muted)]">distribuição via lead_cognitive_state</div>
                <CognitiveStateChart data={data.stateCounts} />
              </Card>
            </div>

            {/* Advance Analytics Section */}
            <section className="space-y-6">
               <div className={`flex items-center gap-2 font-mono text-[9px] font-semibold uppercase tracking-widest ${isDark ? 'text-[#a78bfa]/70' : 'text-violet-600'}`}>
                 <Activity className="h-2.5 w-2.5" />
                 Inteligência Avançada & Padrões
               </div>
               
               <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                  <Card className={`border p-6 backdrop-blur-md ${isDark ? 'border-[var(--orbit-border)] bg-[var(--orbit-glass)]' : 'border-[var(--orbit-line)] bg-white shadow-sm'}`}>
                    <div className={`mb-1 font-mono text-[9px] font-semibold uppercase tracking-widest ${isDark ? 'text-[#2ec5ff]/70' : 'text-[var(--orbit-glow)]'}`}>Curva de Persistência</div>
                    <div className="mb-4 text-xs text-[#94a3b8]">probabilidade de conversão vs nº de contatos</div>
                    <PersistenceCurve data={data.persistenceData} />
                  </Card>

                  <Card className={`border p-6 backdrop-blur-md ${isDark ? 'border-[var(--orbit-border)] bg-[var(--orbit-glass)]' : 'border-[var(--orbit-line)] bg-white shadow-sm'}`}>
                    <div className={`mb-1 font-mono text-[9px] font-semibold uppercase tracking-widest ${isDark ? 'text-[#2ec5ff]/70' : 'text-[var(--orbit-glow)]'}`}>Matriz de Qualidade</div>
                    <div className="mb-4 text-xs text-[#94a3b8]">sentimento vs clareza (AI analysis)</div>
                    <QualityMatrix data={data.qualityData} />
                  </Card>

                  <Card className={`border p-6 backdrop-blur-md ${isDark ? 'border-[var(--orbit-border)] bg-[var(--orbit-glass)]' : 'border-[var(--orbit-line)] bg-white shadow-sm'}`}>
                    <div className={`mb-1 font-mono text-[9px] font-semibold uppercase tracking-widest ${isDark ? 'text-[var(--orbit-glow)]/70' : 'text-[var(--orbit-glow)]'}`}>Heatmap de Inatividade</div>
                    <div className="mb-4 text-xs text-[var(--orbit-text-muted)]">distribuição de silêncio por período e dia</div>
                    <InactivityHeatmap data={data.inactivityData} />
                  </Card>
               </div>
            </section>

            {/* Cognitive Table Section */}
            <section>
               <div className={`mb-4 flex items-center gap-2 font-mono text-[9px] font-semibold uppercase tracking-widest ${isDark ? 'text-[var(--orbit-glow)]/70' : 'text-[var(--orbit-glow)]'}`}>
                 <Activity className="h-2.5 w-2.5" />
                 Campo Cognitivo Completo
               </div>
               <CognitiveTable leads={tableLeads} onLeadClick={openLeadPanel} />
            </section>

            {/* Bottom Section: Latency & Insights */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
               <Card className={`border p-6 backdrop-blur-md ${isDark ? 'border-[var(--orbit-border)] bg-[var(--orbit-glass)]' : 'border-[var(--orbit-line)] bg-white shadow-sm'}`}>
                  <div className={`mb-1 font-mono text-[9px] font-semibold uppercase tracking-widest ${isDark ? 'text-[var(--orbit-glow)]/70' : 'text-[var(--orbit-glow)]'}`}>Latência de Reação</div>
                  <div className="mb-6 text-xs text-[var(--orbit-text-muted)]">tempo entre resposta do lead e sua próxima ação</div>
                  <div className="flex items-end gap-3 mb-6">
                     <span className={`text-4xl font-bold ${isDark ? 'text-white' : 'text-[var(--orbit-text)]'}`}>{Math.round(data.latencyData.avgMinutes)}</span>
                     <span className="mb-1 text-sm text-[var(--orbit-text-muted)]">min m3dia</span>
                  </div>
                  <div className="space-y-3">
                     {[
                        { label: '< 15min', val: data.latencyData.under15, color: '#4ade80' },
                        { label: '15-60min', val: data.latencyData.under60, color: '#ffc87a' },
                        { label: '> 1h', val: data.latencyData.over60, color: '#ff7a7a' }
                     ].map(l => (
                        <div key={l.label} className="flex items-center gap-4">
                           <span className="w-16 font-mono text-[10px] text-[var(--orbit-text-muted)]">{l.label}</span>
                           <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/5">
                              <div className="h-full transition-all duration-1000" style={{ width: `${l.val}%`, backgroundColor: l.color }} />
                           </div>
                           <span className="w-10 text-right font-mono text-[10px]" style={{ color: l.color }}>{Math.round(l.val)}%</span>
                        </div>
                     ))}
                  </div>
               </Card>

               <div className="space-y-4">
                  <div className={`rounded-xl border p-6 backdrop-blur-sm ${isDark ? 'border-[var(--orbit-glow)]/20 bg-[var(--orbit-glow)]/5' : 'border-[var(--orbit-glow)]/20 bg-[var(--orbit-glow)]/5 brightness-110'}`}>
                     <div className="mb-2 flex items-center justify-between">
                        <TrendingUp className={`h-4 w-4 ${isDark ? 'text-[var(--orbit-glow)]' : 'text-[var(--orbit-glow)]'}`} />
                        <span className={`font-mono text-[9px] uppercase ${isDark ? 'text-[var(--orbit-glow)]/60' : 'text-[var(--orbit-glow)]/60'}`}>Insight Cognitivo</span>
                     </div>
                     <div className={`text-xl font-bold ${isDark ? 'text-white' : 'text-[var(--orbit-glow)]'}`}>Janela Ideal: 18h–20h</div>
                     <p className={`mt-2 text-xs leading-relaxed ${isDark ? 'text-[var(--orbit-text-muted)]' : 'text-[var(--orbit-text-muted)]'}`}>
                        Pico de responsividade detectado. Leads respondem 2× mais neste período. Concentrar ações aqui pode dobrar sua taxa.
                     </p>
                  </div>
                  <div className={`rounded-xl border p-6 backdrop-blur-sm ${isDark ? 'border-[#a78bfa]/20 bg-[#a78bfa]/5' : 'border-violet-300/30 bg-violet-50'}`}>
                     <div className="mb-2 flex items-center justify-between">
                        <TrendingUp className={`h-4 w-4 ${isDark ? 'text-[#a78bfa]' : 'text-violet-600'}`} />
                        <span className={`font-mono text-[9px] uppercase ${isDark ? 'text-[#a78bfa]/60' : 'text-violet-600/60'}`}>Insight de Momentum</span>
                     </div>
                     <div className={`text-xl font-bold ${isDark ? 'text-white' : 'text-violet-700'}`}>{data.decidingLeads} Leads em Deciding</div>
                     <p className={`mt-2 text-xs leading-relaxed ${isDark ? 'text-[var(--orbit-text-muted)]' : 'text-violet-600/80'}`}>
                        Janela de conversão crítica detectada. Momentum elevado sugere fechamento nos próximos 3-5 dias.
                     </p>
                  </div>
               </div>
            </div>
          </main>

          {/* Sidebar */}
          <TelemetrySidebar 
            data={{ 
              attentionLeads: data.attentionLeads, 
              followupLeads: data.followupLeads, 
              recentMessages: data.recentMessages.map(m => ({
                lead_id: m.lead_id,
                lead_name: m.lead_id, // TBD: Join with names
                content: m.content,
                timestamp: new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                lead_initials: "L"
              }))
            }} 
            onLeadClick={openLeadPanel}
          />
        </div>
      </div>

      {selectedLeadId && (
        <LeadCognitiveConsole
          leadId={selectedLeadId}
          isOpen={isLeadPanelOpen}
          onClose={closeLeadPanel}
        />
      )}
    </div>
  );
}
