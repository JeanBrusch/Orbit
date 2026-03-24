"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { 
  ArrowRight, 
  Bot, 
  Database, 
  MessageSquare, 
  Cpu, 
  Zap, 
  ArrowDownRight,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';

interface Event {
  id: string;
  timestamp: string;
  step: string | null;
  action: string | null;
  module: string;
  origin?: string | null;
  destination?: string | null;
  has_ai?: boolean | null;
  saved_data?: boolean | null;
  cost_usd?: number | null;
  metadata_json?: any;
}

const STEP_ICONS: Record<string, any> = {
  inbound: MessageSquare,
  processing: Cpu,
  decision: Bot,
  cognition: Zap,
  persistence: Database,
  response: ArrowRight
};

const STEP_COLORS: Record<string, string> = {
  inbound: 'from-blue-500/20 to-blue-400/20 text-blue-400 border-blue-500/30',
  processing: 'from-amber-500/20 to-amber-400/20 text-amber-400 border-amber-500/30',
  decision: 'from-purple-500/20 to-purple-400/20 text-purple-400 border-purple-500/30',
  cognition: 'from-cyan-500/20 to-cyan-400/20 text-cyan-400 border-cyan-500/30',
  persistence: 'from-green-500/20 to-green-400/20 text-green-400 border-green-500/30',
  response: 'from-indigo-500/20 to-indigo-400/20 text-indigo-400 border-indigo-500/30'
};

export default function FlowGraph({ events }: { events: Event[] }) {
  // Ordenar cronologicamente
  const sortedEvents = [...events].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  return (
    <div className="flex flex-col gap-8 p-6 overflow-x-auto min-h-[400px]">
      <div className="flex items-center gap-4 mb-4">
        <h3 className="text-sm font-medium text-white/60 uppercase tracking-widest">Fluxo Técnico Real</h3>
        <div className="h-px flex-1 bg-white/5" />
      </div>

      <div className="relative flex items-center gap-12 pb-12">
        {sortedEvents.map((event, idx) => {
          const Icon = STEP_ICONS[event.step || 'processing'] || Cpu;
          const colorClass = STEP_COLORS[event.step || 'processing'] || 'from-white/10 to-white/5 text-white/40 border-white/10';

          return (
            <React.Fragment key={event.id}>
              {/* Event Node */}
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className={`relative flex flex-col items-center group cursor-pointer`}
              >
                {/* Node Shape */}
                <div className={`
                  w-16 h-16 rounded-2xl flex items-center justify-center border
                  bg-gradient-to-br ${colorClass}
                  backdrop-blur-xl shadow-2xl transition-all duration-300
                  group-hover:scale-110 group-hover:border-white/40
                `}>
                  <Icon className="w-8 h-8" />
                  
                  {/* Indicators */}
                  <div className="absolute -top-1 -right-1 flex gap-1">
                    {event.has_ai && (
                      <div className="w-4 h-4 rounded-full bg-purple-500 flex items-center justify-center shadow-lg border border-white/20">
                        <Bot className="w-2 h-2 text-white" />
                      </div>
                    )}
                    {event.saved_data && (
                      <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center shadow-lg border border-white/20">
                        <Database className="w-2 h-2 text-white" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Node Label */}
                <div className="absolute -bottom-10 whitespace-nowrap text-center">
                  <div className="text-[10px] uppercase tracking-tighter text-white/40 font-bold mb-1">
                    {event.step || ''}
                  </div>
                  <div className="text-xs text-white/80 font-medium">
                    {(event.action || '').replace(/_/g, ' ')}
                  </div>
                </div>

                {/* Metadata Hover (Simplified) */}
                <div className="absolute -top-24 opacity-0 group-hover:opacity-100 transition-opacity bg-black/90 border border-white/10 p-3 rounded-lg z-50 pointer-events-none w-48 shadow-2xl backdrop-blur-md">
                   <div className="text-[10px] text-white/50 mb-1">{event.module}</div>
                   <div className="text-[9px] text-white/30 truncate mb-1">ID: {event.id}</div>
                   {event.cost_usd && event.cost_usd > 0 && (
                     <div className="text-[10px] text-amber-400 font-bold">$ {event.cost_usd.toFixed(5)}</div>
                   )}
                </div>
              </motion.div>

              {/* Connector */}
              {idx < sortedEvents.length - 1 && (
                <motion.div 
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 48 }}
                  transition={{ delay: idx * 0.1 + 0.05 }}
                  className="h-px bg-gradient-to-r from-white/20 to-white/5 relative"
                >
                  <ArrowRight className="absolute -right-2 -top-2 w-4 h-4 text-white/20" />
                </motion.div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {sortedEvents.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 border border-dashed border-white/5 rounded-3xl bg-white/[0.01]">
          <AlertCircle className="w-8 h-8 text-white/20 mb-3" />
          <div className="text-sm text-white/40">Nenhum rastro encontrado para este lead</div>
        </div>
      )}
    </div>
  );
}
