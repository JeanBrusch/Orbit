"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import { motion } from "framer-motion"
import { Star, Phone, X, MapPin, Maximize2, Share2, Sparkles, Heart, XCircle, Calendar, Send, CheckCircle2, MessageSquare, ExternalLink } from "lucide-react"
import { getSupabase } from "@/lib/supabase"
import { toast } from "sonner"
import { AnimatePresence } from "framer-motion"
import "../../styles/themes/orbit-selection.css"
import { VideoEmbed } from "./VideoEmbed"

interface SelectionItem {
  id: string;
  capsuleItemId: string;
  title: string;
  price: number | null;
  location: string | null;
  coverImage: string | null;
  url: string | null;
  lat: number | null;
  lng: number | null;
  note?: string;
  videoUrl?: string;
  audioUrl?: string;
  highlightLevel?: number;
  recommendedReason?: string;
}

interface ClientSelectionViewProps {
  data: {
    space: any;
    lead: any;
    preferences: any;
    items: SelectionItem[];
    initialInteractions?: Record<string, string[]>;
  };
  slug: string;
}

export default function ClientSelectionView({ data, slug }: ClientSelectionViewProps) {
  const { space, lead, preferences, items, initialInteractions } = data
  const theme = space.theme || "paper"
  const [selectedItem, setSelectedItem] = useState<SelectionItem | null>(null)
  const [interactions, setInteractions] = useState<Record<string, string[]>>(initialInteractions || {})
  const [questionText, setQuestionText] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState<Record<string, boolean>>({})

  // ── Session tracking ─────────────────────────────────────────────────────────
  const sessionStartRef = useRef<number>(Date.now())

  const sendSessionEnd = (durationSeconds: number) => {
    if (!lead?.id || !items[0]?.id) return
    const payload = JSON.stringify({
      leadId: lead.id,
      propertyId: items[0].id,
      interaction_type: 'session_end',
      source: 'client_portal',
      metadata: { duration_seconds: durationSeconds },
    })
    // Usa sendBeacon para garantir envio mesmo ao fechar a aba
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' })
      navigator.sendBeacon('/api/property-interactions', blob)
    } else {
      // Fallback: fetch com keepalive
      fetch('/api/property-interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch(() => {})
    }
  }

  useEffect(() => {
    if (!lead?.id || !items[0]?.id) return

    sessionStartRef.current = Date.now()

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        const durationSeconds = Math.round((Date.now() - sessionStartRef.current) / 1000)
        if (durationSeconds >= 2) {
          sendSessionEnd(durationSeconds)
          console.log(`[SessionTracker] Duração: ${durationSeconds}s (visibilitychange)`)
        }
      }
    }

    const handleBeforeUnload = () => {
      const durationSeconds = Math.round((Date.now() - sessionStartRef.current) / 1000)
      if (durationSeconds >= 2) {
        sendSessionEnd(durationSeconds)
        console.log(`[SessionTracker] Duração: ${durationSeconds}s (beforeunload)`)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead?.id])

  const firstName = lead?.name?.split(" ")[0] || "Cliente"

  const formatPrice = (value: number | null) => {
    if (!value) return "Sob consulta"
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    }).format(value)
  }

  const handleWhatsApp = (item?: SelectionItem) => {
    const phone = space?.operator_phone || process.env.NEXT_PUBLIC_CONSULTANT_PHONE || "555182237325"
    let text = `Olá! Estou vendo o seu espaço Orbit Selection.`
    if (item) {
      text += ` Gostaria de saber mais sobre o imóvel: ${item.title}`
      text += `\nLink: ${window.location.origin}/selection/${slug}?prop=${item.id}`
    }
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, "_blank")
  }

  const handleInteraction = async (itemId: string, capsuleItemId: string, state: string) => {
    if (!lead?.id) { toast.error("Erro: sessão sem identificador de lead"); return; }
    
    const currentStates = interactions[itemId] || []
    const isAdding = !currentStates.includes(state)
    
    try {
      setInteractions(prev => {
        const entry = prev[itemId] || []
        const next = isAdding 
          ? [...entry, state]
          : entry.filter(s => s !== state)
        return { ...prev, [itemId]: next }
      })

      const response = await fetch('/api/property-interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: lead.id,
          propertyId: itemId,
          interaction_type: state,
          source: 'client_portal'
        })
      })

      if (!response.ok) throw new Error("Falha ao registrar")
      
      if (isAdding) {
        toast.success(state === 'favorited' ? "Imóvel curtido!" : state === 'visited' ? "Visita solicitada!" : "Interação registrada")
      }
    } catch (err: any) {
      setInteractions(prev => ({
        ...prev,
        [itemId]: currentStates
      }))
      toast.error("Erro ao registrar interação")
      console.error(err)
    }
  }

  const trackView = async (itemId: string) => {
    if (!lead?.id) return
    try {
      await fetch('/api/property-interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: lead.id,
          propertyId: itemId,
          interaction_type: 'viewed',
          source: 'client_portal'
        })
      })
    } catch(err) {
      console.error("Failed to track view:", err)
    }
  }

  const trackExternalLink = async (itemId: string) => {
    if (!lead?.id) return
    console.log(`[ClickTracker] Acessar Página Original clicado — propertyId: ${itemId}`)
    try {
      await fetch('/api/property-interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: lead.id,
          propertyId: itemId,
          interaction_type: 'visited_site',
          source: 'client_portal'
        })
      })
    } catch(err) {
      console.error("Failed to track external link:", err)
    }
  }

  useEffect(() => {
    // Log portal access when component mounts
    if (!lead?.id || !items[0]?.id) return
    const logPortalAccess = async () => {
      try {
        await fetch('/api/property-interactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            leadId: lead.id,
            propertyId: items[0].id,
            interaction_type: 'portal_opened',
            source: 'client_portal'
          })
        })
      } catch (err) {
        console.error("Failed to log portal access:", err)
      }
    }
    logPortalAccess()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead?.id])

  const handleAskQuestion = async (item: SelectionItem) => {
    const text = questionText[item.id]?.trim()
    if (!text) return

    setIsSubmitting(prev => ({ ...prev, [item.id]: true }))

    try {
      const response = await fetch('/api/property-interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: lead?.id,
          propertyId: item.id,
          interaction_type: 'property_question',
          source: 'client_portal',
          propertyTitle: item.title,
          propertyCover: item.coverImage,
          text: text
        })
      })

      if (!response.ok) throw new Error("Falha ao enviar pergunta")
      
      toast.success("Pergunta enviada ao consultor!")
      setQuestionText(prev => ({ ...prev, [item.id]: "" }))
    } catch (err: any) {
      toast.error("Erro ao enviar pergunta")
      console.error(err)
    } finally {
      setIsSubmitting(prev => ({ ...prev, [item.id]: false }))
    }
  }

  // ── O restante do JSX permanece IDÊNTICO ao original ─────────────────────────
  // (Cole aqui o return completo do seu ClientSelectionView original)
  // As únicas mudanças são:
  // 1. import useRef adicionado no topo
  // 2. sessionStartRef e useEffect de session tracking adicionados acima
  // 3. log de console no trackExternalLink
  // 4. O return JSX não muda — mantenha o seu original intacto

  return (
    <div className="orbit-selection-root" data-selection-theme={theme}>
      {/* JSX original do seu ClientSelectionView aqui — sem alterações */}
      {/* Este arquivo documenta apenas as mudanças de lógica acima do return */}
    </div>
  )
}
