"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Calendar, 
  MapPin, 
  TrendingDown, 
  TrendingUp, 
  FileText, 
  CheckCircle2, 
  Clock, 
  Plus, 
  Trash2,
  Users,
  DollarSign
} from "lucide-react"
import { getSupabase } from "@/lib/supabase"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

interface HistoryEvent {
  id: string
  event_type: 'valuation' | 'visit' | 'proposal' | 'interaction' | 'creation'
  event_date: string
  description: string
  old_value?: number
  new_value?: number
  lead_id?: string
  metadata?: any
  leads?: { name: string }
}

interface PropertyTimelineProps {
  propertyId: string
}

export default function PropertyTimeline({ propertyId }: PropertyTimelineProps) {
  const [events, setEvents] = useState<HistoryEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  
  // Form states
  const [eventType, setEventType] = useState<HistoryEvent['event_type']>('visit')
  const [description, setDescription] = useState("")
  const [newValue, setNewValue] = useState("")
  const [eventDate, setEventDate] = useState(new Date().toISOString().split('T')[0])

  const supabase = getSupabase()

  useEffect(() => {
    fetchEvents()
  }, [propertyId])

  const fetchEvents = async () => {
    setLoading(true)
    try {
      const { data, error } = await (supabase
        .from('property_history') as any)
        .select('*, leads(name)')
        .eq('property_id', propertyId)
        .order('event_date', { ascending: false })

      if (data) setEvents(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleAddEvent = async () => {
    try {
      const payload: any = {
        property_id: propertyId,
        event_type: eventType,
        description: description,
        event_date: new Date(eventDate).toISOString()
      }

      if (eventType === 'valuation' && newValue) {
        payload.new_value = parseFloat(newValue)
      }

      const { error } = await (supabase.from('property_history') as any).insert(payload)
      if (error) throw error

      setShowAddForm(false)
      setDescription("")
      setNewValue("")
      fetchEvents()
    } catch (err) {
      alert("Erro ao adicionar evento")
    }
  }

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'visit': return <Calendar className="w-4 h-4 text-emerald-400" />
      case 'proposal': return <DollarSign className="w-4 h-4 text-amber-400" />
      case 'valuation': return <TrendingDown className="w-4 h-4 text-blue-400" />
      case 'creation': return <Plus className="w-4 h-4 text-zinc-400" />
      default: return <Clock className="w-4 h-4 text-zinc-400" />
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-5 flex items-center justify-between border-b border-white/5 bg-white/2">
        <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Linha do Tempo</h4>
        <button 
          onClick={() => setShowAddForm(!showAddForm)}
          className="p-1.5 rounded-full bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500 hover:text-white transition-all"
        >
          <Plus size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-5">
        <AnimatePresence>
          {showAddForm && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mb-6 overflow-hidden"
            >
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <select 
                    value={eventType}
                    onChange={(e) => setEventType(e.target.value as any)}
                    className="bg-black/40 border border-white/10 rounded-lg p-2 text-xs text-white"
                  >
                    <option value="visit">Visita</option>
                    <option value="proposal">Proposta</option>
                    <option value="valuation">Alteração de Preço</option>
                    <option value="interaction">Interação</option>
                  </select>
                  <input 
                    type="date" 
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="bg-black/40 border border-white/10 rounded-lg p-2 text-xs text-white"
                  />
                </div>
                
                <textarea 
                  placeholder="Descrição do evento..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-xs text-white h-20 resize-none"
                />

                {eventType === 'valuation' && (
                  <input 
                    type="number" 
                    placeholder="Novo Valor (R$)"
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-xs text-white"
                  />
                )}

                <div className="flex justify-end gap-2">
                  <button onClick={() => setShowAddForm(false)} className="px-3 py-1.5 text-xs text-zinc-500 hover:text-white">Cancelar</button>
                  <button 
                    onClick={handleAddEvent}
                    className="px-4 py-1.5 bg-indigo-500 text-white rounded-lg text-xs font-bold"
                  >
                    Registrar
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {loading ? (
          <div className="flex justify-center p-10">
            <Clock className="w-5 h-5 text-zinc-700 animate-spin" />
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-20 px-10">
            <Clock className="w-10 h-10 text-zinc-800 mx-auto mb-4 opacity-20" />
            <p className="text-xs text-zinc-600">Nenhum evento registrado ainda.</p>
          </div>
        ) : (
          <div className="relative space-y-8">
            {/* Vertical Line */}
            <div className="absolute left-[17px] top-2 bottom-2 w-[1px] bg-white/5" />
            
            {events.map((event, i) => (
              <motion.div 
                key={event.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="relative pl-10 group"
              >
                {/* Dot */}
                <div className="absolute left-[8px] top-1.5 w-[19px] h-[19px] rounded-full bg-[#0a0a0c] border border-white/10 flex items-center justify-center z-10 transition-colors group-hover:border-indigo-500/50">
                  <div className="w-1.5 h-1.5 rounded-full bg-zinc-600 group-hover:bg-indigo-400" />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase">
                        {format(new Date(event.event_date), "dd MMM yyyy", { locale: ptBR })}
                      </span>
                      <div className="p-1 rounded bg-white/5">
                        {getEventIcon(event.event_type)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-3 rounded-xl bg-white/2 border border-white/5 group-hover:border-white/10 transition-all">
                    <p className="text-[13px] text-zinc-200 leading-relaxed">{event.description}</p>
                    
                    {event.new_value && (
                      <div className="mt-2 text-xs font-bold text-indigo-400">
                        Novo Valor: R$ {event.new_value.toLocaleString('pt-BR')}
                      </div>
                    )}
                    
                    {event.leads?.name && (
                      <div className="mt-2 flex items-center gap-1.5">
                        <Users size={10} className="text-zinc-500" />
                        <span className="text-[10px] text-zinc-400">{event.leads.name}</span>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
