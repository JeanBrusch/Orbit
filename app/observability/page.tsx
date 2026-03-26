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
  ChevronRight,
  GitBranch,
  LayoutDashboard,
  Zap,
  History
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import FlowGraph from "@/components/observability/FlowGraph"
import TraceTimeline from "@/components/observability/TraceTimeline"

export default function ObservabilityDashboard() {
  const [activeTab, setActiveTab] = useState<'cost' | 'trace'>('cost')
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [period, setPeriod] = useState<string>("today")

  const dateRange = React.useMemo(() => {
    const end = new Date()
    const start = new Date()
    
    switch (period) {
      case '1h':
        start.setHours(start.getHours() - 1)
        break
      case 'today':
        start.setHours(0, 0, 0, 0)
        break
      case 'week':
        start.setDate(start.getDate() - 7)
        break
      case 'month':
        start.setMonth(start.getMonth() - 1)
        break
      default:
        start.setHours(0, 0, 0, 0)
    }
    return { start, end }
  }, [period])

  const { events, loading, stats, refetch } = useObservability(dateRange.start, dateRange.end)

  const [leadFilter, setLeadFilter] = useState("")
  const [moduleFilter, setModuleFilter] = useState("all")

  const filteredEvents = events.filter(ev => {
    const matchesLead = !leadFilter || ev.lead_id?.includes(leadFilter) || ev.leads?.name?.toLowerCase().includes(leadFilter.toLowerCase())
    const matchesModule = moduleFilter === "all" || ev.module === moduleFilter
    const matchesSelectedLead = !selectedLeadId || ev.lead_id === selectedLeadId
    return matchesLead && matchesModule && matchesSelectedLead
  })

  const traceEvents = selectedLeadId 
    ? events.filter(ev => ev.lead_id === selectedLeadId) 
    : []

  const modules = ["all", ...new Set(events.map(ev => ev.module))]
  const leadsWithEvents = Array.from(new Set(events.map(ev => ev.lead_id).filter(Boolean)))
    .map(id => ({
      id,
      name: events.find(ev => ev.lead_id === id)?.leads?.name || id?.slice(0, 8)
    }))

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 p-6 font-sans">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8 flex justify-between items-center">
        <div>
          <Link href="/" className="flex items-center text-slate-400 hover:text-white mb-2 text-sm transition-colors">
            <ArrowLeft className="w-4 h-4 mr-1" /> Voltar ao Dashboard
          </Link>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
            Observabilidade Orbit
          </h1>
          <p className="text-slate-500 text-sm mt-1">Raio-X de processamento, tokens e custos de IA em tempo real.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[140px] bg-slate-900 border-slate-800 text-xs">
              <div className="flex items-center gap-2 text-slate-300">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <SelectValue placeholder="Período" />
              </div>
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-800 text-white">
              <SelectItem value="1h">Última Hora</SelectItem>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="week">Última Semana</SelectItem>
              <SelectItem value="month">Último Mês</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
             <button 
               onClick={() => setActiveTab('cost')}
               className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'cost' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
             >
               <LayoutDashboard className="w-4 h-4" /> Custos
             </button>
             <button 
               onClick={() => setActiveTab('trace')}
               className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'trace' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
             >
               <GitBranch className="w-4 h-4" /> Fluxo & Trace
             </button>
          </div>

          <button 
            onClick={() => refetch()}
            disabled={loading}
            className="p-2 ml-2 rounded-full bg-slate-900 border border-slate-800 hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="max-max-w-7xl mx-auto space-y-6">
        {activeTab === 'cost' ? (
          <>
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
                subtitle="GPT-4o Mini, Embeddings"
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
                              onClick={() => {
                                if (ev.lead_id) {
                                  setSelectedLeadId(ev.lead_id);
                                  setActiveTab('trace');
                                }
                              }}
                              className="group border-slate-800 hover:bg-white/5 transition-colors cursor-pointer"
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
                  </div>
                </Card>
              </div>
            </div>
          </>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Lead Selector Sidebar */}
            <div className="lg:col-span-1 space-y-4">
              <Card className="bg-slate-900 border-slate-800">
                <CardHeader className="p-4">
                   <CardTitle className="text-sm font-medium flex items-center">
                     <History className="w-4 h-4 mr-2" /> Leads Ativos
                   </CardTitle>
                </CardHeader>
                <CardContent className="p-2 pt-0 max-h-[600px] overflow-y-auto">
                  <div className="space-y-1">
                    {leadsWithEvents.map(lead => (
                      <button
                        key={lead.id}
                        onClick={() => setSelectedLeadId(lead.id)}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                          selectedLeadId === lead.id 
                            ? 'bg-blue-500/10 border border-blue-500/20 text-blue-400' 
                            : 'hover:bg-white/5 border border-transparent text-slate-400'
                        }`}
                      >
                         <div className={`w-2 h-2 rounded-full ${selectedLeadId === lead.id ? 'bg-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.5)]' : 'bg-slate-800'}`} />
                         <span className="text-xs font-medium truncate">{lead.name}</span>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Trace View */}
            <div className="lg:col-span-3 space-y-6">
              {selectedLeadId ? (
                <>
                  {/* Flow Graph */}
                  <Card className="bg-slate-900 border-slate-800 overflow-hidden">
                    <FlowGraph events={traceEvents.filter(ev => ev.step)} />
                  </Card>

                  {/* Detailed Timeline */}
                  <Card className="bg-slate-900 border-slate-800 p-6">
                    <TraceTimeline events={traceEvents} />
                  </Card>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center p-24 border border-dashed border-white/5 rounded-3xl bg-white/[0.01]">
                   <GitBranch className="w-12 h-12 text-white/5 mb-4" />
                   <h3 className="text-lg font-medium text-white/40">Selecione um lead</h3>
                   <p className="text-sm text-white/20">Escolha um lead à esquerda para visualizar seu rastro de dados completo.</p>
                </div>
              )}
            </div>
          </div>
        )}
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
    case 'classification': return <Zap className="w-3.5 h-3.5 text-cyan-400" />
    default: return <Activity className="w-3.5 h-3.5 text-slate-400" />
  }
}

function getModuleColor(module: string) {
  switch (module) {
    case 'orbit_core': return 'bg-blue-500/10 text-blue-400'
    case 'classifier': return 'bg-purple-500/10 text-purple-400'
    case 'vistanet_ingest': return 'bg-emerald-500/10 text-emerald-400'
    case 'silence_analyzer': return 'bg-orange-500/10 text-orange-400'
    case 'reengagement': return 'bg-amber-500/10 text-amber-400'
    default: return 'bg-slate-500/10 text-slate-400'
  }
}
