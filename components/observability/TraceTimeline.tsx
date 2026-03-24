"use client";

import React from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Bot, 
  Database, 
  MessageSquare, 
  Zap, 
  ArrowRight,
  Clock,
  History,
  ShieldCheck,
  Filter
} from 'lucide-react';

interface Event {
  id: string;
  timestamp: string;
  step: string | null;
  action: string | null;
  module: string;
  has_ai?: boolean | null;
  saved_data?: boolean | null;
  cost_usd?: number | null;
  duration_ms?: number | null;
  metadata_json?: any;
}

export default function TraceTimeline({ events }: { events: Event[] }) {
  const [filter, setFilter] = React.useState<'all' | 'ai' | 'gov' | 'system'>('all');

  const filteredEvents = events.filter(ev => {
    if (filter === 'all') return true;
    if (filter === 'ai') return ev.has_ai;
    if (filter === 'gov') return ev.action === 'analysis_skipped';
    if (filter === 'system') return !ev.has_ai && ev.action !== 'analysis_skipped';
    return true;
  });

  const sortedEvents = [...filteredEvents].sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-white/40" />
          <h3 className="text-xs font-medium text-white/40 uppercase tracking-widest">Timeline de Eventos</h3>
        </div>
        
        <div className="flex items-center gap-2 bg-white/5 p-1 rounded-lg border border-white/10">
          <Filter className="w-3 h-3 text-white/30 ml-1" />
          {(['all', 'ai', 'gov', 'system'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2 py-1 rounded text-[9px] font-bold uppercase transition-all ${
                filter === f ? 'bg-white/10 text-white' : 'text-white/30 hover:text-white/60'
              }`}
            >
              {f === 'all' ? 'Tudo' : f === 'ai' ? 'IA' : f === 'gov' ? 'Gov' : 'Sist'}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {sortedEvents.map((event, idx) => (
          <div key={event.id} className="relative pl-6 border-l border-white/5 pb-4 group">
            {/* Timeline Dot */}
            <div className={`absolute -left-[5px] top-1 w-2 h-2 rounded-full border border-black transition-colors ${
              event.has_ai ? 'bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]' : 
              event.action === 'analysis_skipped' ? 'bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.5)]' :
              event.saved_data ? 'bg-green-500' : 'bg-white/20'
            }`} />

            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 transition-all group-hover:bg-white/[0.04] group-hover:border-white/10 group-hover:translate-x-1">
              <div className="flex items-start justify-between mb-2">
                <div className="flex flex-col">
                  <h4 className="text-sm font-bold text-slate-100">{event.action?.replace(/_/g, ' ') || 'Sem ação'}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 tracking-wider border border-slate-700">
                      {event.step || 'Sistema'}
                    </span>
                    <span className="text-[10px] text-white/30 uppercase tracking-tighter font-bold">
                      {event.module}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <div className="flex items-center gap-1.5 text-[10px] text-white/40">
                    <Clock className="w-3 h-3" />
                    {format(new Date(event.timestamp), "HH:mm:ss 'em' dd/MM", { locale: ptBR })}
                  </div>
                  {event.duration_ms && (
                    <span className="text-[9px] text-white/20">{event.duration_ms}ms</span>
                  )}
                </div>
              </div>

              {/* Tags & Badges */}
              <div className="flex flex-wrap gap-2 mb-3">
                {event.has_ai && (
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-[9px] text-purple-400 font-bold uppercase">
                    <Bot className="w-2.5 h-2.5" /> IA Ativa
                  </div>
                )}
                {event.saved_data && (
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20 text-[9px] text-green-400 font-bold uppercase">
                    <Database className="w-2.5 h-2.5" /> Banco Atualizado
                  </div>
                )}
                {event.action === 'analysis_skipped' && (
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-[9px] text-blue-400 font-bold uppercase">
                    <ShieldCheck className="w-2.5 h-2.5" /> IA Pulada (Governança)
                  </div>
                )}
                {event.cost_usd && event.cost_usd > 0 && (
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[9px] text-amber-400 font-bold uppercase">
                    $ {event.cost_usd.toFixed(4)}
                  </div>
                )}
              </div>

              {/* Metadata Preview */}
              {event.metadata_json && Object.keys(event.metadata_json).length > 0 && (
                <div className="mt-2 text-[10px] font-mono text-white/40 bg-black/40 p-2 rounded-lg border border-white/5 overflow-hidden">
                  <pre className="whitespace-pre-wrap break-all">
                    {JSON.stringify(event.metadata_json, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        ))}

        {sortedEvents.length === 0 && (
          <div className="text-center py-12 text-white/20 text-xs italic">
            Nenhum evento registrado.
          </div>
        )}
      </div>
    </div>
  );
}
