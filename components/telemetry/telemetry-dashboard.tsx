"use client";

import { useTelemetryData } from "@/hooks/use-telemetry-data";
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
  const { data, loading } = useTelemetryData();
  const { selectedLeadId, isLeadPanelOpen, openLeadPanel, closeLeadPanel } = useOrbitContext();

  if (loading || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#05060a]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-[#2ec5ff]" />
          <div className="font-mono text-[10px] uppercase tracking-widest text-[#94a3b8]">
            Sincronizando Campo Cognitivo...
          </div>
        </div>
      </div>
    );
  }

  // Prep processed data for sidebar and table (Real data mapping)
  // Mapping OrbitLead from useSupabaseLeads to the component's expected format
  const tableLeads = (data as any).rawLeads?.slice(0, 15).map((l: any) => ({
    id: l.id,
    name: l.name,
    origin: l.origin,
    state: l.orbitVisualState || "latent",
    interest: l.interestScore || 0,
    risk: l.riskScore || 0,
    daysInactive: l.daysSinceInteraction || 0,
  })) || [];

  const attentionLeads = (data as any).rawLeads?.filter((l: any) => l.riskScore > 60 || l.daysSinceInteraction > 10).slice(0, 5).map((l: any) => ({
    id: l.id,
    name: l.name,
    initials: l.name?.split(' ').map((n:any)=>n[0]).join('').slice(0,2) || "L",
    status: l.daysSinceInteraction > 10 ? `${l.daysSinceInteraction}d sem resposta` : "Alto risco detectado",
  })) || [];

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-[#05060a] text-[#e6eef6]">
      <ParticleBackground />

      <div className="relative z-10 mx-auto max-w-[1400px] px-6 py-20 lg:px-8">
        {/* Header */}
        <header className="mb-10 flex flex-col justify-between gap-6 border-b border-white/5 pb-8 sm:flex-row sm:items-end">
          <div>
            <div className="mb-2 flex items-center gap-2 font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-[#2ec5ff]/70">
              <Cpu className="h-3 w-3" />
              Operador · Cognitive Performance Terminal
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-white">Telemetria do Operador</h1>
            <p className="mt-2 text-sm text-[#94a3b8]">
              Você está trabalhando bem? Nos horários certos? Seu esforço gera retorno?
            </p>
          </div>
          
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-3">
                <div className="flex flex-col items-center gap-1">
                   <div className="text-[10px] font-mono text-[#94a3b8] uppercase">Interesse</div>
                   <div className="text-xl font-bold text-[#2ec5ff]">{Math.round(data.avgInterest)}%</div>
                </div>
                <div className="flex flex-col items-center gap-1">
                   <div className="text-[10px] font-mono text-[#94a3b8] uppercase">Momentum</div>
                   <div className="text-xl font-bold text-[#ffc87a]">{Math.round(data.avgMomentum)}%</div>
                </div>
             </div>
             <div className="h-10 w-[1px] bg-white/10" />
             <div className="flex gap-1 rounded-lg bg-white/5 p-1">
                {['7d', '30d', '90d'].map(p => (
                   <button key={p} className={`rounded-md px-3 py-1 font-mono text-[10px] uppercase transition-all ${p === '30d' ? 'bg-[#2ec5ff]/10 text-[#2ec5ff] border border-[#2ec5ff]/20' : 'text-[#94a3b8] hover:text-white'}`}>
                      {p}
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
              <div className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 px-6 py-4 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#2ec5ff]/10 text-[#2ec5ff]">
                     <Zap className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-widest text-[#94a3b8]">WhatsApp</div>
                    <div className="text-2xl font-bold text-white">{data.interactionBreakdown.whatsapp}</div>
                  </div>
                </div>
                <div className="text-[10px] font-mono text-[#2ec5ff]/50">Mensagens</div>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 px-6 py-4 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                     <Mic className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-widest text-[#94a3b8]">Ligações</div>
                    <div className="text-2xl font-bold text-white">{data.interactionBreakdown.calls}</div>
                  </div>
                </div>
                <div className="text-[10px] font-mono text-emerald-500/50">Esforço</div>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 px-6 py-4 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#d4af35]/10 text-[#d4af35]">
                     <Star className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-widest text-[#94a3b8]">Anotações</div>
                    <div className="text-2xl font-bold text-white">{data.interactionBreakdown.notes}</div>
                  </div>
                </div>
                <div className="text-[10px] font-mono text-[#d4af35]/50">Inteligência</div>
              </div>
            </div>

            {/* Middle Section: Charts */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <Card className="border-[var(--orbit-border)] bg-[var(--orbit-glass)] p-6 backdrop-blur-md">
                <div className="mb-1 font-mono text-[9px] font-semibold uppercase tracking-widest text-[#2ec5ff]/70">Esforço vs Reatividade</div>
                <div className="mb-4 text-xs text-[#94a3b8]">dias sem interação por lead · distribuição do campo</div>
                <EffortChart data={data.diasBuckets} />
              </Card>

              <Card className="border-[var(--orbit-border)] bg-[var(--orbit-glass)] p-6 backdrop-blur-md">
                <div className="mb-1 font-mono text-[9px] font-semibold uppercase tracking-widest text-[#2ec5ff]/70">Estados Cognitivos</div>
                <div className="mb-4 text-xs text-[#94a3b8]">distribuição via lead_cognitive_state</div>
                <CognitiveStateChart data={data.stateCounts} />
              </Card>
            </div>

            {/* Advance Analytics Section */}
            <section className="space-y-6">
               <div className="flex items-center gap-2 font-mono text-[9px] font-semibold uppercase tracking-widest text-[#a78bfa]/70">
                 <Activity className="h-2.5 w-2.5" />
                 Inteligência Avançada & Padrões
               </div>
               
               <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                  <Card className="border-[var(--orbit-border)] bg-[var(--orbit-glass)] p-6 backdrop-blur-md">
                    <div className="mb-1 font-mono text-[9px] font-semibold uppercase tracking-widest text-[#2ec5ff]/70">Curva de Persistência</div>
                    <div className="mb-4 text-xs text-[#94a3b8]">probabilidade de conversão vs nº de contatos</div>
                    <PersistenceCurve />
                  </Card>

                  <Card className="border-[var(--orbit-border)] bg-[var(--orbit-glass)] p-6 backdrop-blur-md">
                    <div className="mb-1 font-mono text-[9px] font-semibold uppercase tracking-widest text-[#2ec5ff]/70">Matriz de Qualidade</div>
                    <div className="mb-4 text-xs text-[#94a3b8]">sentimento vs clareza (AI analysis)</div>
                    <QualityMatrix />
                  </Card>

                  <Card className="border-[var(--orbit-border)] bg-[var(--orbit-glass)] p-6 backdrop-blur-md">
                    <div className="mb-1 font-mono text-[9px] font-semibold uppercase tracking-widest text-[#2ec5ff]/70">Heatmap de Inatividade</div>
                    <div className="mb-4 text-xs text-[#94a3b8]">distribuição de silêncio por período e dia</div>
                    <InactivityHeatmap />
                  </Card>
               </div>
            </section>

            {/* Cognitive Table Section */}
            <section>
               <div className="mb-4 flex items-center gap-2 font-mono text-[9px] font-semibold uppercase tracking-widest text-[#2ec5ff]/70">
                 <Activity className="h-2.5 w-2.5" />
                 Campo Cognitivo Completo
               </div>
               <CognitiveTable leads={tableLeads} onLeadClick={openLeadPanel} />
            </section>

            {/* Bottom Section: Latency & Insights */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
               <Card className="border-[var(--orbit-border)] bg-[var(--orbit-glass)] p-6 backdrop-blur-md">
                  <div className="mb-1 font-mono text-[9px] font-semibold uppercase tracking-widest text-[#2ec5ff]/70">Latência de Reação</div>
                  <div className="mb-6 text-xs text-[#94a3b8]">tempo entre resposta do lead e sua próxima ação</div>
                  <div className="flex items-end gap-3 mb-6">
                     <span className="text-4xl font-bold text-white">{Math.round(data.latencyData.avgMinutes)}</span>
                     <span className="mb-1 text-sm text-[#94a3b8]">min m3dia</span>
                  </div>
                  <div className="space-y-3">
                     {[
                        { label: '< 15min', val: data.latencyData.under15, color: '#4ade80' },
                        { label: '15-60min', val: data.latencyData.under60, color: '#ffc87a' },
                        { label: '> 1h', val: data.latencyData.over60, color: '#ff7a7a' }
                     ].map(l => (
                        <div key={l.label} className="flex items-center gap-4">
                           <span className="w-16 font-mono text-[10px] text-[#94a3b8]">{l.label}</span>
                           <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/5">
                              <div className="h-full transition-all duration-1000" style={{ width: `${l.val}%`, backgroundColor: l.color }} />
                           </div>
                           <span className="w-10 text-right font-mono text-[10px]" style={{ color: l.color }}>{Math.round(l.val)}%</span>
                        </div>
                     ))}
                  </div>
               </Card>

               <div className="space-y-4">
                  <div className="rounded-xl border border-[#2ec5ff]/20 bg-[#2ec5ff]/5 p-6 backdrop-blur-sm">
                     <div className="mb-2 flex items-center justify-between">
                        <TrendingUp className="h-4 w-4 text-[#2ec5ff]" />
                        <span className="font-mono text-[9px] uppercase text-[#2ec5ff]/60">Insight Cognitivo</span>
                     </div>
                     <div className="text-xl font-bold text-white">Janela Ideal: 18h–20h</div>
                     <p className="mt-2 text-xs leading-relaxed text-[#94a3b8]">
                        Pico de responsividade detectado. Leads respondem 2× mais neste período. Concentrar ações aqui pode dobrar sua taxa.
                     </p>
                  </div>
                  <div className="rounded-xl border border-[#a78bfa]/20 bg-[#a78bfa]/5 p-6 backdrop-blur-sm">
                     <div className="mb-2 flex items-center justify-between">
                        <TrendingUp className="h-4 w-4 text-[#a78bfa]" />
                        <span className="font-mono text-[9px] uppercase text-[#a78bfa]/60">Insight de Momentum</span>
                     </div>
                     <div className="text-xl font-bold text-white">{data.decidingLeads} Leads em Deciding</div>
                     <p className="mt-2 text-xs leading-relaxed text-[#94a3b8]">
                        Janela de conversão crítica detectada. Momentum elevado sugere fechamento nos próximos 3-5 dias.
                     </p>
                  </div>
               </div>
            </div>
          </main>

          {/* Sidebar */}
          <TelemetrySidebar 
            data={{ 
              attentionLeads, 
              followupLeads: [], 
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
