'use client'

import Link from 'next/link'
import { useState, useRef, useEffect } from 'react'
import { MessageCircle, Pencil, Check, X } from 'lucide-react'

interface LeadIntelHeaderProps {
  name: string
  stage: string
  lastInteraction: string
  leadId: string
}

export function LeadIntelHeader({
  name: initialName,
  stage,
  lastInteraction,
  leadId,
}: LeadIntelHeaderProps) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(initialName)
  const [draft, setDraft] = useState(initialName)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const handleSave = async () => {
    if (!draft.trim() || draft === name) { setEditing(false); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/lead/${leadId}/update-name`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: draft.trim() }),
      })
      if (res.ok) setName(draft.trim())
    } catch {}
    setSaving(false)
    setEditing(false)
  }

  const handleCancel = () => {
    setDraft(name)
    setEditing(false)
  }

  return (
    <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
      <div>
        <div className="flex items-center gap-3">
          {editing ? (
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') handleCancel() }}
                className="text-lg font-semibold text-white bg-white/10 border border-white/20 rounded-lg px-2 py-0.5 outline-none focus:border-emerald-400 transition-colors"
                disabled={saving}
              />
              <button onClick={handleSave} disabled={saving} className="text-emerald-400 hover:text-emerald-300 transition-colors">
                <Check className="h-4 w-4" />
              </button>
              <button onClick={handleCancel} className="text-slate-400 hover:text-white transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <>
              <h1 className="text-lg font-semibold text-white">{name}</h1>
              <button
                onClick={() => { setDraft(name); setEditing(true) }}
                className="text-slate-600 hover:text-slate-300 transition-colors"
                title="Editar nome"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </>
          )}
          <span className="flex items-center gap-2 text-xs text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            {stage}
          </span>
        </div>
        <p className="text-xs text-white/50 mt-1">
          Última interação: {lastInteraction}
        </p>
      </div>

      <Link
        href={`/?openLead=${leadId}`}
        className="flex items-center gap-2 text-sm text-white/70 hover:text-white transition px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/20 hover:bg-white/5"
      >
        <MessageCircle className="h-4 w-4" />
        Voltar ao Chat
      </Link>
    </div>
  )
}

