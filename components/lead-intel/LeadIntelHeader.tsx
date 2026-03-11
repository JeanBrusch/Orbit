'use client'

import Link from 'next/link'
import { MessageCircle } from 'lucide-react'

interface LeadIntelHeaderProps {
  name: string
  stage: string
  lastInteraction: string
  leadId: string
}

export function LeadIntelHeader({
  name,
  stage,
  lastInteraction,
  leadId,
}: LeadIntelHeaderProps) {
  return (
    <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-white">{name}</h1>
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
