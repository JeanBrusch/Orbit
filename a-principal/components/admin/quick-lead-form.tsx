"use client"

import React from "react"

import { useState, useCallback } from "react"
import { Check, Loader2, User, Phone, FileText } from "lucide-react"
import { useOrbitContext } from "@/components/orbit-context"

interface QuickLeadFormProps {
  onSuccess: () => void
  onCancel: () => void
}

export function QuickLeadForm({ onSuccess, onCancel }: QuickLeadFormProps) {
  const [name, setName] = useState("")
  const [contact, setContact] = useState("")
  const [note, setNote] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  const { addLead } = useOrbitContext()

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!name.trim() || !contact.trim()) return

      setIsSubmitting(true)

      // Simulate brief processing
      await new Promise((resolve) => setTimeout(resolve, 400))

      // Create the lead
      addLead({
        name: name.trim(),
        contact: contact.trim(),
        note: note.trim() || undefined,
      })

      setIsSubmitting(false)
      setIsSuccess(true)
      onSuccess()
    },
    [name, contact, note, addLead, onSuccess]
  )

  const isValid = name.trim().length > 0 && contact.trim().length > 0

  if (isSuccess) {
    return (
      <div className="flex flex-col items-center justify-center py-8 animate-text-fade-in">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
          <Check className="h-6 w-6" />
        </div>
        <p className="mt-3 text-sm font-medium text-[var(--orbit-text)]">Lead adicionado ao Orbit</p>
        <p className="mt-1 text-xs text-[var(--orbit-text-muted)]">{name}</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Name field */}
      <div className="space-y-2">
        <label htmlFor="lead-name" className="flex items-center gap-2 text-xs font-medium text-[var(--orbit-text-muted)]">
          <User className="h-3.5 w-3.5" />
          Nome
        </label>
        <input
          id="lead-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: Marina Costa"
          className="w-full rounded-xl border border-[var(--orbit-glass-border)] bg-[var(--orbit-glass)] px-4 py-3 text-sm text-[var(--orbit-text)] placeholder:text-[var(--orbit-text-muted)]/50 outline-none transition-all focus:border-[var(--orbit-glow)]/50 focus:ring-2 focus:ring-[var(--orbit-glow)]/20"
          autoFocus
          autoComplete="off"
        />
      </div>

      {/* Contact field */}
      <div className="space-y-2">
        <label htmlFor="lead-contact" className="flex items-center gap-2 text-xs font-medium text-[var(--orbit-text-muted)]">
          <Phone className="h-3.5 w-3.5" />
          Contato
        </label>
        <input
          id="lead-contact"
          type="text"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="WhatsApp ou email"
          className="w-full rounded-xl border border-[var(--orbit-glass-border)] bg-[var(--orbit-glass)] px-4 py-3 text-sm text-[var(--orbit-text)] placeholder:text-[var(--orbit-text-muted)]/50 outline-none transition-all focus:border-[var(--orbit-glow)]/50 focus:ring-2 focus:ring-[var(--orbit-glow)]/20"
          autoComplete="off"
        />
      </div>

      {/* Note field (optional) */}
      <div className="space-y-2">
        <label htmlFor="lead-note" className="flex items-center gap-2 text-xs font-medium text-[var(--orbit-text-muted)]">
          <FileText className="h-3.5 w-3.5" />
          Nota
          <span className="text-[var(--orbit-text-muted)]/50">(opcional)</span>
        </label>
        <textarea
          id="lead-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Contexto rápido sobre o lead..."
          rows={2}
          className="w-full resize-none rounded-xl border border-[var(--orbit-glass-border)] bg-[var(--orbit-glass)] px-4 py-3 text-sm text-[var(--orbit-text)] placeholder:text-[var(--orbit-text-muted)]/50 outline-none transition-all focus:border-[var(--orbit-glow)]/50 focus:ring-2 focus:ring-[var(--orbit-glow)]/20"
        />
      </div>

      {/* Submit button */}
      <button
        type="submit"
        disabled={!isValid || isSubmitting}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--orbit-glow)] py-3 text-sm font-medium text-[var(--orbit-bg)] transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Adicionando...
          </>
        ) : (
          <>
            <Check className="h-4 w-4" />
            Adicionar ao Orbit
          </>
        )}
      </button>
    </form>
  )
}
