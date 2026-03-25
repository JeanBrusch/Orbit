"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { 
  Bot, 
  Database, 
  Cpu, 
  Zap, 
  ArrowDownRight,
  MessageSquare,
  ArrowRight
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
    <div className="relative p-8 bg-[#05060A] min-h-[500px] overflow-hidden rounded-3xl border border-white/5">
      {/* Background Grid/Effect */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-500/5 via-transparent to-transparent opacity-50" />
      <div className="absolute inset-0 overflow-hidden opacity-20">
        <div className="absolute top-0 left-0 w-full h-full bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px]" />
      </div>

      <div className="relative z-10 flex items-center gap-4 mb-12">
        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
        <h3 className="text-sm font-semibold text-white/80 uppercase tracking-[0.2em]">Fluxo Técnico Real</h3>
        <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
      </div>

      <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-12 gap-y-24 items-start mx-auto max-w-6xl">
        {sortedEvents.map((event, idx) => {
          const Icon = STEP_ICONS[event.step || 'processing'] || Cpu;
          const colorClass = STEP_COLORS[event.step || 'processing'] || 'from-white/10 to-white/5 text-white/40 border-white/10';
          
          const isAI = event.has_ai;
          const isDB = event.saved_data;

          return (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: idx * 0.1, duration: 0.5, ease: "circOut" }}
              className="relative flex flex-col items-center"
            >
              {/* Node Connector Path (Desktop) */}
              {idx > 0 && (
                <div className="absolute -left-12 top-10 w-12 h-px bg-gradient-to-r from-blue-500/20 to-blue-500/60 hidden lg:block">
                  <motion.div 
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    className="w-full h-full origin-left bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                    transition={{ delay: idx * 0.1, duration: 0.8 }}
                  />
                  <div className="absolute -right-1 -top-[3px] w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                </div>
              )}

              {/* Node Card */}
              <div className="group relative">
                {/* Glow Effect */}
                <div className={`absolute inset-0 rounded-3xl blur-xl opacity-0 group-hover:opacity-40 transition-opacity bg-gradient-to-br ${colorClass}`} />
                
                <div className={`
                  relative w-20 h-20 rounded-3xl flex items-center justify-center border
                  bg-gradient-to-br ${colorClass}
                  backdrop-blur-xl shadow-2xl transition-all duration-500
                  group-hover:scale-110 group-hover:-translate-y-2 group-hover:border-white/40
                `}>
                  <Icon className="w-9 h-9 transition-transform duration-500 group-hover:rotate-12" />
                  
                  {/* Indicators */}
                  <div className="absolute -top-2 -right-2 flex flex-col gap-1">
                    {isAI && (
                      <motion.div 
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center shadow-lg border border-white/20"
                      >
                        <Bot className="w-3 h-3 text-white" />
                      </motion.div>
                    )}
                    {isDB && (
                      <motion.div 
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-6 h-6 rounded-full bg-emerald-600 flex items-center justify-center shadow-lg border border-white/20"
                      >
                        <Database className="w-3 h-3 text-white" />
                      </motion.div>
                    )}
                  </div>

                  {/* Flow Number */}
                  <div className="absolute -bottom-2 -right-2 w-5 h-5 rounded-md bg-white/10 backdrop-blur-md flex items-center justify-center text-[10px] font-bold text-white/60 border border-white/10">
                    {idx + 1}
                  </div>
                </div>

                {/* Vertical Loop Indicator (if applicable) */}
                {idx % 4 === 3 && idx < sortedEvents.length - 1 && (
                  <div className="absolute left-1/2 -bottom-24 w-px h-24 border-l border-dashed border-blue-500/30 hidden lg:block">
                     <ArrowDownRight className="absolute -bottom-2 -left-2 w-4 h-4 text-blue-500/40" />
                  </div>
                )}
              </div>

              {/* Node Info */}
              <div className="mt-8 text-center space-y-1">
                <div className="text-[10px] uppercase tracking-[0.2em] font-black text-white/30 group-hover:text-blue-400 transition-colors">
                  {event.step || 'STEP'}
                </div>
                <div className="text-[14px] text-white/90 font-semibold tracking-tight">
                  {(event.action || 'Processing').replace(/_/g, ' ')}
                </div>
                <div className="flex items-center justify-center gap-2 mt-2">
                   <div className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[9px] text-white/50 font-mono">
                     {event.module === 'vistanet_ingest' ? 'INGEST' : event.module.toUpperCase()}
                   </div>
                   {event.cost_usd && (
                     <div className="text-[9px] font-bold text-emerald-400">
                       $ {event.cost_usd.toFixed(4)}
                     </div>
                   )}
                </div>
              </div>

              {/* Detail Tooltip */}
              <div className="absolute top-0 opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none z-50 translate-y-4 group-hover:-translate-y-24 w-56">
                <div className="bg-[#0A0D14]/95 border border-white/10 p-4 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-xl">
                   <div className="flex justify-between items-start mb-2">
                     <span className="text-[10px] text-white/40 font-bold uppercase tracking-widest">{event.module}</span>
                     <span className="text-[9px] font-mono text-white/20">{new Date(event.timestamp).toLocaleTimeString()}</span>
                   </div>
                   <p className="text-xs text-white/70 leading-relaxed italic">
                     Technical execution of {event.action} via {event.module} services.
                   </p>
                   {event.metadata_json?.model && (
                     <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
                        <span className="text-[9px] text-white/30 uppercase">Model</span>
                        <span className="text-[10px] text-blue-400 font-mono">{event.metadata_json.model}</span>
                     </div>
                   )}
                </div>
              </div>
            </motion.div>
          );
        })}

        {sortedEvents.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-24 bg-white/[0.02] rounded-3xl border border-dashed border-white/5">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-6">
              <Zap className="w-8 h-8 text-white/10" />
            </div>
            <h3 className="text-white/60 font-medium">Nenhum evento detectado</h3>
            <p className="text-white/20 text-sm mt-1">O rastro de processamento aparecerá assim que houver atividade.</p>
          </div>
        )}
      </div>
    </div>
  );
}
