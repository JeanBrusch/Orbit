"use client"

import { useState, useCallback } from "react"
import { MessageCircle, Loader2, UserPlus, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { normalizePhone, formatDisplayPhone as formatPhoneDisplay } from "@/lib/zapi/phone-normalizer"

interface NewConversationFormProps {
  onSuccess: (leadId: string | null, phone: string) => void
  onCancel: () => void
}

export function NewConversationForm({ onSuccess, onCancel }: NewConversationFormProps) {
  const [phone, setPhone] = useState("")
  const [name, setName] = useState("")
  const [message, setMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [existingLead, setExistingLead] = useState<{ id: string; name: string } | null>(null)
  const [checkingLead, setCheckingLead] = useState(false)

  const checkExistingLead = useCallback(async (phoneValue: string) => {
    if (phoneValue.length < 10) {
      setExistingLead(null)
      return
    }

    setCheckingLead(true)
    try {
      const res = await fetch(`/api/lead/find?phone=${encodeURIComponent(phoneValue)}`)
      const data = await res.json()
      if (data.exists && data.lead) {
        setExistingLead({ id: data.lead.id, name: data.lead.name })
      } else {
        setExistingLead(null)
      }
    } catch {
      setExistingLead(null)
    } finally {
      setCheckingLead(false)
    }
  }, [])

  const handlePhoneChange = useCallback((value: string) => {
    const cleaned = value.replace(/\D/g, '')
    setPhone(cleaned)
    
    // Aceita DDD (2 digitos) + numero (8 ou 9 digitos) = 10 ou 11 digitos total
    if (cleaned.length >= 10 && cleaned.length <= 11) {
      checkExistingLead(cleaned)
    } else {
      setExistingLead(null)
    }
  }, [checkExistingLead])

  const isPhoneValid = phone.length >= 10 && phone.length <= 11

  const handleSend = useCallback(async () => {
    if (!isPhoneValid || !message.trim()) return

    setIsLoading(true)
    try {
      const normalized = normalizePhone(phone)
      let leadId = existingLead?.id || null
      
      // Se não existe lead, criar automaticamente
      if (!leadId) {
        const createRes = await fetch('/api/lead', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: normalized,
            name: name.trim() || formatPhoneDisplay(normalized),
          }),
        })
        
        if (createRes.ok) {
          const data = await createRes.json()
          leadId = data.id
        }
      }
      
      const whatsappRes = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: normalized,
          message: message.trim(),
          leadId,
        }),
      })

      if (whatsappRes.ok) {
        // Salvar a mensagem no histórico de interações
        if (leadId) {
          await fetch('/api/interaction', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              leadId,
              type: 'whatsapp',
              direction: 'outbound',
              content: message.trim(),
            }),
          })
        }
        onSuccess(leadId, normalized)
      } else {
        const error = await whatsappRes.json()
        console.error('Failed to send:', error)
      }
    } catch (err) {
      console.error('Error sending message:', err)
    } finally {
      setIsLoading(false)
    }
  }, [phone, name, message, existingLead, onSuccess])

  const isValid = isPhoneValid && message.trim().length > 0

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium text-[var(--orbit-text)]">
          Telefone
        </label>
        <div className="relative">
          <Input
            type="tel"
            placeholder="51999999999"
            value={phone}
            onChange={(e) => handlePhoneChange(e.target.value)}
            className="bg-[var(--orbit-glass)] border-[var(--orbit-glass-border)] text-[var(--orbit-text)] placeholder:text-[var(--orbit-text-muted)]"
          />
          {checkingLead && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Loader2 className="w-4 h-4 animate-spin text-[var(--orbit-text-muted)]" />
            </div>
          )}
        </div>
        {phone.length > 0 && phone.length < 10 && (
          <div className="text-xs text-[var(--orbit-text-muted)]">
            Digite DDD + numero (10 ou 11 digitos)
          </div>
        )}
        {phone.length > 11 && (
          <div className="text-xs text-red-400">
            Numero muito longo. Use apenas DDD + numero (ex: 51999887766)
          </div>
        )}
        {existingLead && (
          <div className="flex items-center gap-2 text-xs text-emerald-400">
            <Check className="w-3 h-3" />
            <span>Lead existente: {existingLead.name}</span>
          </div>
        )}
        {isPhoneValid && !existingLead && !checkingLead && (
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-amber-400">
              <UserPlus className="w-3 h-3" />
              <span>Novo contato - sera criado como lead ao enviar</span>
            </div>
            <div className="text-xs text-[var(--orbit-text-muted)]">
              Digite exatamente como esta no WhatsApp do contato (8 ou 9 digitos apos o DDD)
            </div>
          </div>
        )}
      </div>

      {/* Campo de nome - só aparece para novos contatos */}
      {isPhoneValid && !existingLead && !checkingLead && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-[var(--orbit-text)]">
            Nome <span className="text-[var(--orbit-text-muted)] font-normal">(opcional)</span>
          </label>
          <Input
            type="text"
            placeholder="Nome do lead"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-[var(--orbit-glass)] border-[var(--orbit-glass-border)] text-[var(--orbit-text)] placeholder:text-[var(--orbit-text-muted)]"
          />
        </div>
      )}

      <div className="space-y-2">
        <label className="text-sm font-medium text-[var(--orbit-text)]">
          Mensagem
        </label>
        <textarea
          placeholder="Digite sua mensagem..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          className="w-full rounded-lg bg-[var(--orbit-glass)] border border-[var(--orbit-glass-border)] text-[var(--orbit-text)] placeholder:text-[var(--orbit-text-muted)] p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--orbit-glow)]/50"
        />
      </div>

      <div className="flex gap-3 pt-2">
        <Button
          variant="outline"
          onClick={onCancel}
          className="flex-1 border-[var(--orbit-glass-border)]"
        >
          Cancelar
        </Button>
        <Button
          onClick={handleSend}
          disabled={!isValid || isLoading}
          className="flex-1 bg-[var(--orbit-glow)] text-[var(--orbit-bg)] hover:opacity-90"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <MessageCircle className="w-4 h-4 mr-2" />
          )}
          Enviar
        </Button>
      </div>
    </div>
  )
}
