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
  History
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
  const sortedEvents = [...events].sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 mb-2">
        <History className="w-4 h-4 text-white/40" />
        <h3 className="text-xs font-medium text-white/40 uppercase tracking-widest">Timeline de Eventos</h3>
      </div>

      <div className="space-y-3">
        {sortedEvents.map((event, idx) => (
          <div key={event.id} className="relative pl-6 border-l border-white/5 pb-4 group">
            {/* Timeline Dot */}
            <div className={`absolute -left-[5px] top-1 w-2 h-2 rounded-full border border-black transition-colors ${
              event.has_ai ? 'bg-purple-500' : event.saved_data ? 'bg-green-500' : 'bg-white/20'
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
