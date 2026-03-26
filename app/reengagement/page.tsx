"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Upload, Users, Send, Check, Loader2, 
  Trash2, ExternalLink, ChevronLeft, 
  Building2, Phone, User, Sparkles, MessageSquare
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { normalizePhone } from "@/lib/phone-utils"
import { generateWhatsAppLink } from "@/lib/cold-lead-logic"
import { TopBar } from "@/components/top-bar"
import { useAuth } from "@/hooks/use-auth"
import { useTheme } from "next-themes"
import { OrbitProvider } from "@/components/orbit-context"
import { Suspense } from "react"

function ReengagementPageContent() {
  const { resolvedTheme, setTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const { logout } = useAuth()
  
  const [leads, setLeads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [generatingMessage, setGeneratingMessage] = useState<string | null>(null)

  useEffect(() => {
    fetchColdLeads()
  }, [])

  async function fetchColdLeads() {
    setLoading(true)
    const { data, error } = await (supabase as any)
      .from('cold_leads')
      .select('*, properties(title, neighborhood)')
      .order('created_at', { ascending: false })
    
    if (error) {
      toast.error("Erro ao buscar leads frios")
    } else {
      setLeads(data || [])
    }
    setLoading(false)
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    const reader = new FileReader()
    reader.onload = async (event) => {
      const text = event.target?.result as string
      const rows = text.split('\n').filter(row => row.trim() !== '')
      
      // Assume CSV format: name, phone, property_id
      const newLeads = []
      for (let i = 1; i < rows.length; i++) {
        const [name, phone, propertyId] = rows[i].split(',').map(s => s.trim())
        if (name && phone && propertyId) {
          newLeads.push({
            name,
            phone,
            accessed_property_id: propertyId,
            status: 'pending'
          })
        }
      }

      if (newLeads.length > 0) {
        const { error } = await (supabase as any).from('cold_leads').insert(newLeads)
        if (error) {
          toast.error("Erro ao salvar leads do CSV")
        } else {
          toast.success(`${newLeads.length} leads importados!`)
          fetchColdLeads()
        }
      } else {
        toast.error("Nenhum lead válido encontrado no CSV")
      }
      setUploading(false)
    }
    reader.readAsText(file)
  }

  const [currentIndex, setCurrentIndex] = useState(0)
  const [sessionLeads, setSessionLeads] = useState<any[]>([])

  // Load a session of 5 pending leads
  useEffect(() => {
    if (leads.length > 0 && sessionLeads.length === 0) {
      const pending = leads.filter(l => l.status === 'pending').slice(0, 5)
      setSessionLeads(pending)
    }
  }, [leads, sessionLeads.length])

  const nextLead = () => {
    if (currentIndex < sessionLeads.length - 1) {
      setCurrentIndex(prev => prev + 1)
    } else {
      toast.success("Fila leve concluída!")
      setSessionLeads([]) // Reset session to allow loading more
      setCurrentIndex(0)
    }
  }

  const handleGenerateAndOpen = async (lead: any) => {
    if (!lead) return

    if (lead.generated_message) {
      const link = generateWhatsAppLink(lead.phone, lead.name, lead.generated_message)
      window.open(link, '_blank')
      
      if (lead.status !== 'contacted') {
        await (supabase as any).from('cold_leads').update({ 
          status: 'contacted', 
          last_contact_at: new Date().toISOString() 
        }).eq('id', lead.id)
        fetchColdLeads()
      }
      nextLead()
      return
    }

    setGeneratingMessage(lead.id)
    try {
      const res = await fetch('/api/reengagement/generate-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadName: lead.name,
          propertyTitle: lead.properties?.title || null,
          propertyNeighborhood: lead.properties?.neighborhood || null
        })
      })
      const data = await res.json()
      
      if (data.message) {
        const link = generateWhatsAppLink(lead.phone, lead.name, data.message)
        window.open(link, '_blank')
        
        await (supabase as any).from('cold_leads').update({ 
          status: 'contacted', 
          generated_message: data.message,
          last_contact_at: new Date().toISOString() 
        }).eq('id', lead.id)
        
        fetchColdLeads()
        nextLead()
      }
    } catch (err) {
      toast.error("Erro ao gerar mensagem")
    } finally {
      setGeneratingMessage(null)
    }
  }

  const deleteLead = async (id: string) => {
    const { error } = await (supabase as any).from('cold_leads').delete().eq('id', id)
    if (error) {
      toast.error("Erro ao deletar lead")
    } else {
      setSessionLeads(prev => prev.filter(l => l.id !== id))
      fetchColdLeads()
    }
  }

  const grainStyle = {
    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)' opacity='.025'/%3E%3C/svg%3E")`,
    opacity: 0.4,
    pointerEvents: "none" as const,
  }

  const currentLead = sessionLeads[currentIndex]

  return (
    <div className="min-h-screen bg-[var(--orbit-bg)] text-[var(--orbit-text)] relative overflow-hidden font-sans flex flex-col h-screen">
      <div className="fixed inset-0 z-50 pointer-events-none" style={grainStyle} />
      
      <TopBar 
        totalLeads={leads.length} 
        isDark={isDark} 
        onThemeToggle={() => setTheme(isDark ? 'light' : 'dark')} 
        onLogout={logout} 
      />

      <div className="flex-1 flex flex-col mt-16 overflow-hidden px-6 pb-6 max-w-2xl mx-auto w-full">
        <header className="h-20 flex items-center justify-between shrink-0 mb-8">
          <div className="flex items-center gap-4">
            <button onClick={() => window.history.back()} className="p-2 rounded-xl hover:bg-[var(--orbit-glow)]/5 text-[var(--orbit-text-muted)] transition-all">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-xl font-display font-bold tracking-tight">Fila Leve Diária</h1>
              <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--orbit-text-muted)] font-mono">Meta: 5 contatos sem pressão</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--orbit-glow)]/10 text-[var(--orbit-glow)] text-[10px] font-bold font-mono">
            {currentIndex + 1} / {sessionLeads.length || 5}
          </div>
        </header>

        <main className="flex-1 flex flex-col">
          {loading && sessionLeads.length === 0 ? (
             <div className="flex-1 flex flex-col items-center justify-center gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-[var(--orbit-glow)]" />
                <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--orbit-text-muted)]">Organizando Fila...</span>
             </div>
          ) : sessionLeads.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-[var(--orbit-line)] rounded-[40px] opacity-60 p-12 text-center">
               <div className="w-16 h-16 bg-[var(--orbit-glow)]/5 rounded-full flex items-center justify-center mb-6">
                 <Check className="h-8 w-8 text-[var(--orbit-glow)]" />
               </div>
               <h3 className="text-lg font-bold mb-2">Tudo limpo por aqui!</h3>
               <p className="text-sm text-[var(--orbit-text-muted)] mb-8 max-w-xs">Você não tem leads pendentes na fila de hoje.</p>
               <label className="cursor-pointer">
                  <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} disabled={uploading} />
                  <Button variant="outline" className="gap-2 rounded-2xl">
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    Importar Nova Lista
                  </Button>
               </label>
            </div>
          ) : (
            <div className="flex-1 flex flex-col">
              <AnimatePresence mode="wait">
                <motion.div 
                  key={currentLead?.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="flex-1 flex flex-col"
                >
                  <div className="p-10 bg-[var(--orbit-bg-secondary)] border border-[var(--orbit-line)] rounded-[40px] shadow-[var(--orbit-shadow)] flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start mb-10">
                        <div className="flex gap-4">
                          <div className="w-14 h-14 rounded-3xl bg-[var(--orbit-glow)]/10 flex items-center justify-center text-[var(--orbit-glow)]">
                            <User className="h-7 w-7" />
                          </div>
                          <div>
                            <h3 className="text-2xl font-display font-bold">{currentLead.name}</h3>
                            <p className="text-sm text-[var(--orbit-text-muted)] flex items-center gap-2 mt-1">
                              <Phone className="h-3.5 w-3.5" />
                              {currentLead.phone}
                            </p>
                          </div>
                        </div>
                        <button 
                          onClick={() => deleteLead(currentLead.id)}
                          className="p-3 rounded-2xl text-[var(--orbit-text-muted)] hover:text-rose-500 transition-colors"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>

                      <div className="grid gap-4 mb-10">
                        <div className="p-6 bg-[var(--orbit-bg)] border border-[var(--orbit-line)] rounded-[32px]">
                          <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--orbit-text-muted)] block mb-3 font-mono">Contexto de Interesse</span>
                          <div className="flex items-center gap-3">
                            <Building2 className="h-5 w-5 text-[var(--orbit-glow)]" />
                            <span className="text-base font-medium">
                              {currentLead.properties?.title || "Lead sem histórico específico (Abordagem Neutra)"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <Button 
                        size="lg"
                        className="w-full rounded-[28px] h-20 bg-[var(--orbit-glow)] hover:bg-[var(--orbit-glow)]/90 text-white text-lg font-bold shadow-xl shadow-[var(--orbit-glow)]/20 gap-3 group"
                        onClick={() => handleGenerateAndOpen(currentLead)}
                        disabled={generatingMessage === currentLead.id}
                      >
                        {generatingMessage === currentLead.id ? (
                          <Loader2 className="h-6 w-6 animate-spin" />
                        ) : (
                          <Send className="h-6 w-6 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                        )}
                        Enviar e Próximo
                      </Button>
                      
                      <Button 
                        variant="ghost" 
                        className="w-full h-12 rounded-2xl text-[var(--orbit-text-muted)] hover:text-[var(--orbit-text)]"
                        onClick={nextLead}
                      >
                        Pular este agora
                      </Button>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>

              <div className="mt-8 flex justify-center gap-1">
                {sessionLeads.map((_, i) => (
                  <div 
                    key={i} 
                    className={`h-1.5 rounded-full transition-all duration-500 ${
                      i === currentIndex ? 'w-8 bg-[var(--orbit-glow)]' : i < currentIndex ? 'w-4 bg-[var(--orbit-glow)]/30' : 'w-2 bg-[var(--orbit-line)]'
                    }`} 
                  />
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default function ReengagementPage() {
  return (
    <OrbitProvider>
      <Suspense fallback={
        <div className="min-h-screen bg-[#05060a] flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#2ec5ff]" />
        </div>
      }>
        <ReengagementPageContent />
      </Suspense>
    </OrbitProvider>
  )
}
