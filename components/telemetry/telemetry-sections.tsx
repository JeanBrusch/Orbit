"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { MessageSquare, AlertCircle, Calendar, ArrowRight } from "lucide-react";

interface SidebarItemProps {
  id?: string;
  name: string;
  initials: string;
  subtext: string;
  type: "attention" | "followup" | "feed";
  color?: string;
  timestamp?: string;
  content?: string;
  onClick?: (id: string) => void;
}

function SidebarItem({ id, name, initials, subtext, type, color, timestamp, content, onClick }: SidebarItemProps) {
  const getInitialsBg = () => {
    if (type === "attention") return "bg-red-500/10 text-red-500";
    if (type === "followup") return "bg-[#ffc87a]/10 text-[#ffc87a]";
    return "bg-[#2ec5ff]/10 text-[#2ec5ff]";
  };

  return (
    <div 
      className="group mb-2 flex cursor-pointer items-center gap-3 rounded-lg border border-transparent p-2 transition-all hover:border-[var(--orbit-border-hover)] hover:bg-white/5"
      onClick={() => id && onClick?.(id)}
    >
      <div className={`flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-bold ${getInitialsBg()}`}>
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-white group-hover:text-[#2ec5ff] transition-colors line-clamp-1">{name}</div>
        <div className="text-[10px] text-[#94a3b8] line-clamp-1">{subtext}</div>
        {content && <div className="mt-1 text-[11px] italic text-[#94a3b8]/60 line-clamp-1">"{content}"</div>}
        {timestamp && <div className="mt-0.5 font-mono text-[9px] text-[#94a3b8]/30 uppercase">{timestamp}</div>}
      </div>
      {(type === "attention" || type === "followup") && (
        <div className={`h-1.5 w-1.5 rounded-full ${type === "attention" ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)] animate-pulse" : "bg-[#ffc87a] shadow-[0_0_8px_rgba(255,200,122,0.5)]"}`} />
      )}
    </div>
  );
}

export function TelemetrySidebar({ data, onLeadClick }: { data: any, onLeadClick?: (id: string) => void }) {
  return (
    <aside className="space-y-6">
      <section>
        <div className="mb-3 flex items-center gap-2 font-mono text-[9px] font-semibold uppercase tracking-widest text-[#2ec5ff]/70">
          <AlertCircle className="h-2.5 w-2.5" />
          Atenção Imediata
        </div>
        <div>
          {(!data?.attentionLeads || data.attentionLeads.length === 0) && (
             <div className="text-[11px] text-[#94a3b8]/40 font-mono italic">Nenhum alerta crítico...</div>
          )}
          {data?.attentionLeads?.map((l: any, i: number) => (
            <SidebarItem key={i} id={l.id} name={l.name} initials={l.initials} subtext={l.status} type="attention" onClick={onLeadClick} />
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center gap-2 font-mono text-[9px] font-semibold uppercase tracking-widest text-[#2ec5ff]/70">
          <Calendar className="h-2.5 w-2.5" />
          Follow-ups Ativos
        </div>
        <div>
          {data?.followupLeads?.map((l: any, i: number) => (
            <SidebarItem key={i} id={l.id} name={l.name} initials={l.initials} subtext={l.status} type="followup" onClick={onLeadClick} />
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center gap-2 font-mono text-[9px] font-semibold uppercase tracking-widest text-[#2ec5ff]/70">
          <MessageSquare className="h-2.5 w-2.5" />
          Feed de Eventos
        </div>
        <Card className="border-[var(--orbit-border)] bg-[var(--orbit-glass)] p-3 backdrop-blur-sm">
           {data?.recentMessages?.map((m: any, i: number) => (
             <SidebarItem 
               key={i} 
               id={m.lead_id}
               name={m.lead_name || "Lead"} 
               initials={m.lead_initials || "L"} 
               subtext="Mensagem recebida" 
               content={m.content}
               timestamp={m.timestamp}
               type="feed" 
               onClick={onLeadClick}
             />
           ))}
        </Card>
      </section>
    </aside>
  );
}

export function CognitiveTable({ leads, onLeadClick }: { leads: any[], onLeadClick?: (id: string) => void }) {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--orbit-border)] bg-[var(--orbit-glass)] backdrop-blur-md">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-white/5 font-mono text-[9px] uppercase tracking-wider text-[#94a3b8]">
            <th className="px-4 py-3 font-medium">Lead</th>
            <th className="px-4 py-3 font-medium">Estado</th>
            <th className="px-4 py-3 font-medium">Scores</th>
            <th className="px-4 py-3 font-medium">Inatividade</th>
            <th className="px-4 py-3 font-medium text-right">Análise</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {leads.map((lead, i) => (
            <tr 
              key={i} 
              className="group transition-colors hover:bg-white/[0.02] cursor-pointer"
              onClick={() => onLeadClick?.(lead.id)}
            >
              <td className="px-4 py-3">
                <div className="text-sm font-medium text-white group-hover:text-[#2ec5ff] transition-colors">{lead.name}</div>
                <div className="text-[10px] text-[#94a3b8]">{lead.origin || "Origem desconhecida"}</div>
              </td>
              <td className="px-4 py-3">
                <span className={`inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-tighter 
                  ${lead.state === 'deciding' ? 'bg-[#a78bfa]/10 text-[#a78bfa]' : 
                    lead.state === 'active' ? 'bg-[#4ade80]/10 text-[#4ade80]' : 
                    'bg-[#94a3b8]/10 text-[#94a3b8]'}`}>
                  {lead.state}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-[8px] uppercase tracking-widest text-[#94a3b8]/50">Interesse</span>
                    <div className="h-1 w-16 overflow-hidden rounded-full bg-white/5">
                      <div className="h-full bg-[#2ec5ff]" style={{ width: `${lead.interest}%` }} />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[8px] uppercase tracking-widest text-[#94a3b8]/50">Risco</span>
                    <div className="h-1 w-16 overflow-hidden rounded-full bg-white/5">
                      <div className="h-full bg-[#ff7a7a]" style={{ width: `${lead.risk}%` }} />
                    </div>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 font-mono text-xs">
                <span className={lead.daysInactive > 7 ? "text-red-400" : "text-emerald-400"}>
                  {lead.daysInactive}d
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                <button className="rounded p-1 text-[#2ec5ff]/40 hover:bg-[#2ec5ff]/10 hover:text-[#2ec5ff]">
                   <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
