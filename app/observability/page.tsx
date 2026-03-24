"use client"

import React, { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useObservability } from "@/hooks/use-observability"
import { 
  Activity, 
  Cpu, 
  DollarSign, 
  Clock, 
  Search, 
  ArrowLeft, 
  Bot, 
  MessageSquare, 
  Hash,
  Filter,
  RefreshCw,
  ChevronRight
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"

export default function ObservabilityDashboard() {
  const { events, loading, stats, refetch } = useObservability()
  const [leadFilter, setLeadFilter] = useState("")
  const [moduleFilter, setModuleFilter] = useState("all")

  const filteredEvents = events.filter(ev => {
    const matchesLead = !leadFilter || ev.lead_id?.includes(leadFilter) || ev.leads?.name?.toLowerCase().includes(leadFilter.toLowerCase())
    const matchesModule = moduleFilter === "all" || ev.module === moduleFilter
    return matchesLead && matchesModule
  })

  const modules = ["all", ...new Set(events.map(ev => ev.module))]

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 p-6 font-sans">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8 flex justify-between items-center">
        <div>
          <Link href="/atlas" className="flex items-center text-slate-400 hover:text-white mb-2 text-sm transition-colors">
            <ArrowLeft className="w-4 h-4 mr-1" /> Voltar ao Atlas
          </Link>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
            Observabilidade Orbit
          </h1>
          <p className="text-slate-500 text-sm mt-1">Raio-X de processamento, tokens e custos de IA em tempo real.</p>
        </div>
        
        <button 
          onClick={() => refetch()}
          disabled={loading}
          className="p-2 rounded-full bg-slate-900 border border-slate-800 hover:bg-slate-800 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="max-w-7xl mx-auto space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard 
            title="Custo Total (Últimos 200)" 
            value={`$${stats.totalCost.toFixed(4)}`} 
            icon={<DollarSign className="w-5 h-5 text-emerald-400" />}
            subtitle="Baseado em tokens reais"
          />
          <StatCard 
            title="Chamadas de IA" 
            value={stats.totalCalls.toString()} 
            icon={<Bot className="w-5 h-5 text-blue-400" />}
            subtitle="GPT-4o, mini, embeddings"
          />
          <StatCard 
            title="Módulos Ativos" 
            value={Object.keys(stats.costByModule).length.toString()} 
            icon={<Cpu className="w-5 h-5 text-purple-400" />}
            subtitle="Serviços processando dados"
          />
          <StatCard 
            title="Latência Média" 
            value={`${(events.reduce((acc, ev) => acc + (ev.duration_ms || 0), 0) / (events.length || 1)).toFixed(0)}ms`} 
            icon={<Clock className="w-5 h-5 text-orange-400" />}
            subtitle="Tempo de resposta da IA"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Filters and Summaries */}
          <div className="lg:col-span-1 space-y-4">
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader className="p-4">
                <CardTitle className="text-sm font-medium flex items-center">
                  <Filter className="w-4 h-4 mr-2" /> Filtros
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase text-slate-500 font-bold">Busca Lead</label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
                    <Input 
                      placeholder="Nome ou ID..." 
                      className="pl-8 bg-slate-950 border-slate-800 h-9 text-xs"
                      value={leadFilter}
                      onChange={(e) => setLeadFilter(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase text-slate-500 font-bold">Módulo</label>
                  <div className="flex flex-wrap gap-1.5">
                    {modules.map(mod => (
                      <button
                        key={mod}
                        onClick={() => setModuleFilter(mod)}
                        className={`px-2 py-1 rounded text-[10px] font-medium transition-all ${
                          moduleFilter === mod 
                            ? 'bg-[var(--orbit-accent)] text-white shadow-[0_0_10px_rgba(var(--orbit-accent-rgb),0.5)]' 
                            : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                        }`}
                      >
                        {mod.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-900 border-slate-800">
              <CardHeader className="p-4">
                <CardTitle className="text-sm font-medium">Custo por Módulo</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="space-y-3">
                  {Object.entries(stats.costByModule)
                    .sort(([, a], [, b]) => b - a)
                    .map(([mod, cost]) => (
                    <div key={mod} className="flex justify-between items-center group">
                      <span className="text-xs text-slate-400 group-hover:text-white transition-colors capitalize">{mod.replace('_', ' ')}</span>
                      <div className="flex items-center">
                        <span className="text-xs font-mono font-bold">${cost.toFixed(4)}</span>
                        <div className="w-16 h-1 ml-2 bg-slate-950 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-blue-500 bg-opacity-50" 
                            style={{ width: `${(cost / (stats.totalCost || 1)) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Event Timeline */}
          <div className="lg:col-span-3">
            <Card className="bg-slate-900 border-slate-800 overflow-hidden">
              <CardHeader className="p-4 border-b border-slate-800 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold">Fluxo de Eventos</CardTitle>
                  <p className="text-[10px] text-slate-500 mt-1">Tempo real · Mostrando últimos {filteredEvents.length} eventos</p>
                </div>
                <div className="flex gap-2 text-[10px] text-slate-500 font-mono">
                  <span className="flex items-center"><div className="w-2 h-2 rounded-full bg-emerald-500 mr-1" /> Inbound</span>
                  <span className="flex items-center"><div className="w-2 h-2 rounded-full bg-blue-500 mr-1" /> AI Call</span>
                  <span className="flex items-center"><div className="w-2 h-2 rounded-full bg-orange-500 mr-1" /> System</span>
                </div>
              </CardHeader>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-950/50">
                    <TableRow className="hover:bg-transparent border-slate-800">
                      <TableHead className="w-32 text-[10px] uppercase font-bold text-slate-500">Horário</TableHead>
                      <TableHead className="text-[10px] uppercase font-bold text-slate-500">Evento / Módulo</TableHead>
                      <TableHead className="text-[10px] uppercase font-bold text-slate-500">Lead</TableHead>
                      <TableHead className="text-[10px] uppercase font-bold text-slate-500 text-right">Tokens (I/O)</TableHead>
                      <TableHead className="text-[10px] uppercase font-bold text-slate-500 text-right">Custo</TableHead>
                      <TableHead className="text-[10px] uppercase font-bold text-slate-500 text-right">Tempo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <AnimatePresence mode="popLayout">
                      {filteredEvents.map((ev, i) => (
                        <motion.tr 
                          key={ev.id}
                          layout
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.02 }}
                          className="group border-slate-800 hover:bg-white/5 transition-colors cursor-default"
                        >
                          <TableCell className="py-3 text-[10px] text-slate-500 font-mono">
                            {new Date(ev.timestamp).toLocaleTimeString('pt-BR')}
                          </TableCell>
                          <TableCell className="py-3">
                            <div className="flex items-center gap-2">
                              {getEventIcon(ev.event_type)}
                              <span className="text-xs font-bold text-slate-300 capitalize">{ev.event_type.replace('_', ' ')}</span>
                              <Badge className={`text-[9px] h-4 px-1 p-0 font-normal border-none ${getModuleColor(ev.module)}`}>
                                {ev.module}
                              </Badge>
                            </div>
                            {ev.metadata_json?.model && (
                              <div className="text-[9px] text-slate-500 mt-0.5 ml-6 font-mono italic">
                                {ev.metadata_json.model}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="py-3">
                            <div className="text-xs text-slate-300 font-medium truncate max-w-[120px]">
                              {ev.leads?.name || ev.lead_id?.slice(0, 8) || "System"}
                            </div>
                          </TableCell>
                          <TableCell className="py-3 text-right">
                            {ev.tokens_input ? (
                              <div className="text-xs font-mono space-x-1">
                                <span className="text-slate-400">{ev.tokens_input}</span>
                                <span className="text-slate-600">/</span>
                                <span className="text-blue-400">{ev.tokens_output || 0}</span>
                              </div>
                            ) : '-'}
                          </TableCell>
                          <TableCell className="py-3 text-right font-mono font-bold text-xs">
                             {ev.cost_usd ? (
                               <span className={ev.cost_usd > 0.01 ? 'text-rose-400' : 'text-emerald-400'}>
                                 ${ev.cost_usd.toFixed(4)}
                               </span>
                             ) : '-'}
                          </TableCell>
                          <TableCell className="py-3 text-right text-[10px] text-slate-500 font-mono">
                            {ev.duration_ms ? `${ev.duration_ms}ms` : '-'}
                          </TableCell>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </TableBody>
                </Table>
                
                {filteredEvents.length === 0 && !loading && (
                  <div className="p-12 text-center text-slate-600">
                    <Activity className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p>Nenhum evento encontrado para os filtros selecionados.</p>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>

      <style jsx global>{`
        :root {
          --orbit-accent: #3b82f6;
          --orbit-accent-rgb: 59, 130, 246;
        }
      `}</style>
    </div>
  )
}

function StatCard({ title, value, icon, subtitle }: { title: string, value: string, icon: React.ReactNode, subtitle: string }) {
  return (
    <Card className="bg-slate-900 border-slate-800 hover:border-slate-700 transition-all group">
      <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
          {title}
        </CardTitle>
        <div className="p-1.5 rounded-lg bg-slate-950 group-hover:scale-110 transition-transform">
          {icon}
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="text-2xl font-bold tracking-tight">{value}</div>
        <p className="text-[10px] text-slate-500 mt-1 flex items-center">
          <ChevronRight className="w-2.5 h-2.5 mr-0.5" /> {subtitle}
        </p>
      </CardContent>
    </Card>
  )
}

function getEventIcon(type: string) {
  switch (type) {
    case 'ai_call': return <Bot className="w-3.5 h-3.5 text-blue-400" />
    case 'message_received': return <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
    case 'property_import': return <Hash className="w-3.5 h-3.5 text-purple-400" />
    default: return <Activity className="w-3.5 h-3.5 text-slate-400" />
  }
}

function getModuleColor(module: string) {
  switch (module) {
    case 'orbit_core': return 'bg-blue-500/10 text-blue-400'
    case 'classifier': return 'bg-purple-500/10 text-purple-400'
    case 'vistanet_ingest': return 'bg-emerald-500/10 text-emerald-400'
    case 'silence_analyzer': return 'bg-orange-500/10 text-orange-400'
    default: return 'bg-slate-500/10 text-slate-400'
  }
}
