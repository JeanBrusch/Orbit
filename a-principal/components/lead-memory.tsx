"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import {
  StickyNote,
  Phone,
  PhoneOff,
  MessageCircle,
  MessageCircleReply,
  CalendarClock,
  X,
  Check,
  Clock,
  Ban,
} from "lucide-react"
import { useOrbitContext, type ContactOutcome, type ContactLogEntry } from "./orbit-context"

interface LeadMemoryProps {
  leadId: string
}

// Contact outcome configuration - calls, whatsapp, and no response
const contactOutcomeConfig: Record<
  ContactOutcome,
  { label: string; shortLabel: string; icon: typeof Phone; color: string; bg: string }
> = {
  call_answered: {
    label: "Atendeu",
    shortLabel: "Atendeu",
    icon: Phone,
    color: "text-emerald-400",
    bg: "bg-emerald-500/20",
  },
  call_missed: {
    label: "Nao atendeu",
    shortLabel: "Nao atendeu",
    icon: PhoneOff,
    color: "text-zinc-400",
    bg: "bg-zinc-500/20",
  },
  whatsapp_viewed: {
    label: "Visualizou",
    shortLabel: "Visualizou",
    icon: MessageCircle,
    color: "text-sky-400",
    bg: "bg-sky-500/20",
  },
  whatsapp_replied: {
    label: "Respondeu",
    shortLabel: "Respondeu",
    icon: MessageCircleReply,
    color: "text-emerald-400",
    bg: "bg-emerald-500/20",
  },
  no_response: {
    label: "Sem resposta",
    shortLabel: "Sem resp.",
    icon: Ban,
    color: "text-amber-400",
    bg: "bg-amber-500/20",
  },
}

function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return "agora"
  if (minutes < 60) return `ha ${minutes}min`
  if (hours < 24) return `ha ${hours}h`
  if (days === 1) return "ontem"
  return `ha ${days}d`
}

function formatFutureDate(date: Date): string {
  const now = new Date()
  const target = new Date(date)
  const diff = target.getTime() - now.getTime()
  const days = Math.floor(diff / 86400000)

  if (days < 0) return "vencido"
  if (days === 0) return "hoje"
  if (days === 1) return "amanha"
  return target.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
}

export function LeadMemory({ leadId }: LeadMemoryProps) {
  const {
    leadStates,
    updateLeadNotes,
    logContactOutcome,
    setFollowUpReminder,
    clearFollowUpReminder,
  } = useOrbitContext()

  const leadState = leadStates[leadId]
  const memory = leadState?.memory

  // Notes state with debounced auto-save
  const [notesValue, setNotesValue] = useState(memory?.notes || "")
  const [isNotesFocused, setIsNotesFocused] = useState(false)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Follow-up state
  const [showFollowUpPicker, setShowFollowUpPicker] = useState(false)
  const [followUpDate, setFollowUpDate] = useState("")

  // Last logged outcome (for visual feedback)
  const [lastLoggedOutcome, setLastLoggedOutcome] = useState<ContactOutcome | null>(null)

  // Sync notes value when lead changes
  useEffect(() => {
    setNotesValue(memory?.notes || "")
  }, [leadId, memory?.notes])

  // Auto-save notes with debounce
  const handleNotesChange = useCallback(
    (value: string) => {
      setNotesValue(value)

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }

      saveTimeoutRef.current = setTimeout(() => {
        updateLeadNotes(leadId, value)
      }, 500)
    },
    [leadId, updateLeadNotes]
  )

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  // Handle contact outcome logging
  const handleLogContact = useCallback(
    (outcome: ContactOutcome) => {
      logContactOutcome(leadId, outcome)
      setLastLoggedOutcome(outcome)
      // Clear visual feedback after 2 seconds
      setTimeout(() => setLastLoggedOutcome(null), 2000)
    },
    [leadId, logContactOutcome]
  )

  // Handle quick follow-up (Today / Tomorrow)
  const handleQuickFollowUp = useCallback(
    (daysFromNow: number) => {
      const date = new Date()
      date.setDate(date.getDate() + daysFromNow)
      date.setHours(9, 0, 0, 0) // Default to 9 AM
      setFollowUpReminder(leadId, date)
      setShowFollowUpPicker(false)
    },
    [leadId, setFollowUpReminder]
  )

  // Handle custom follow-up date
  const handleSetFollowUp = useCallback(() => {
    if (!followUpDate) return
    const date = new Date(followUpDate)
    date.setHours(9, 0, 0, 0) // Default to 9 AM
    setFollowUpReminder(leadId, date)
    setShowFollowUpPicker(false)
    setFollowUpDate("")
  }, [leadId, followUpDate, setFollowUpReminder])

  const handleClearFollowUp = useCallback(() => {
    clearFollowUpReminder(leadId)
  }, [leadId, clearFollowUpReminder])

  if (!memory) return null

  const hasFollowUp = memory.followUp?.isActive
  const followUpIsDue = hasFollowUp && new Date(memory.followUp!.date) <= new Date()
  
  // Get the most recent contact log entry
  const mostRecentContact = memory.contactLog?.[0]
  const isRecentlyLogged = mostRecentContact && 
    Date.now() - new Date(mostRecentContact.timestamp).getTime() < 60000

  return (
    <div className="border-b border-[var(--orbit-glass-border)]/50 bg-[var(--orbit-bg)]/30">
      {/* Quick Notes - Contextual, minimal */}
      <div className="px-4 py-3">
        <div
          className={`relative rounded-xl border transition-all ${
            isNotesFocused
              ? "border-[var(--orbit-glow)]/40 bg-[var(--orbit-bg-secondary)]"
              : notesValue
                ? "border-[var(--orbit-glass-border)] bg-[var(--orbit-glass)]/50"
                : "border-dashed border-[var(--orbit-glass-border)]/50 bg-transparent"
          }`}
        >
          <div className="flex items-start gap-2 px-3 py-2">
            <StickyNote
              className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                isNotesFocused || notesValue
                  ? "text-[var(--orbit-glow)]"
                  : "text-[var(--orbit-text-muted)]"
              }`}
            />
            <textarea
              value={notesValue}
              onChange={(e) => handleNotesChange(e.target.value)}
              onFocus={() => setIsNotesFocused(true)}
              onBlur={() => setIsNotesFocused(false)}
              placeholder="Anotacoes sobre o lead..."
              rows={1}
              className="flex-1 resize-none bg-transparent text-xs leading-relaxed text-[var(--orbit-text)] placeholder-[var(--orbit-text-muted)]/50 outline-none"
              style={{ minHeight: "20px", maxHeight: "80px" }}
            />
          </div>
        </div>
      </div>

      {/* Contact Outcomes - single-click micro-actions */}
      <div className="px-4 pb-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Call outcomes */}
          <div className="flex items-center gap-1">
            {(["call_answered", "call_missed"] as ContactOutcome[]).map((outcome) => {
              const config = contactOutcomeConfig[outcome]
              const Icon = config.icon
              const isActive = lastLoggedOutcome === outcome || 
                (isRecentlyLogged && mostRecentContact?.outcome === outcome)
              return (
                <button
                  type="button"
                  key={outcome}
                  onClick={() => handleLogContact(outcome)}
                  className={`flex h-6 items-center gap-1 rounded-md px-1.5 text-[10px] transition-all ${
                    isActive
                      ? `${config.bg} ${config.color}`
                      : "text-[var(--orbit-text-muted)] hover:bg-[var(--orbit-glass)] hover:text-[var(--orbit-text)]"
                  }`}
                >
                  <Icon className="h-3 w-3" />
                  <span className="hidden sm:inline">{config.shortLabel}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Follow-up Reminder */}
      <div className="flex items-center gap-2 px-4 pb-3">
        {hasFollowUp ? (
          <div
            className={`flex items-center gap-1.5 rounded-lg px-2 py-1 ${
              followUpIsDue
                ? "bg-amber-500/20 text-amber-400"
                : "bg-[var(--orbit-glow)]/10 text-[var(--orbit-glow)]"
            }`}
          >
            <CalendarClock className="h-3 w-3" />
            <span className="text-[10px] font-medium">
              {formatFutureDate(new Date(memory.followUp!.date))}
            </span>
            <button
              type="button"
              onClick={handleClearFollowUp}
              className="ml-0.5 rounded-full p-0.5 transition-colors hover:bg-black/20"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </div>
        ) : showFollowUpPicker ? (
          <div className="flex items-center gap-1.5">
            {/* Quick options */}
            <button
              type="button"
              onClick={() => handleQuickFollowUp(0)}
              className="flex h-6 items-center rounded-md bg-[var(--orbit-glow)]/10 px-2 text-[10px] text-[var(--orbit-glow)] transition-colors hover:bg-[var(--orbit-glow)]/20"
            >
              Hoje
            </button>
            <button
              type="button"
              onClick={() => handleQuickFollowUp(1)}
              className="flex h-6 items-center rounded-md bg-[var(--orbit-glow)]/10 px-2 text-[10px] text-[var(--orbit-glow)] transition-colors hover:bg-[var(--orbit-glow)]/20"
            >
              Amanha
            </button>
            {/* Custom date */}
            <input
              type="date"
              value={followUpDate}
              onChange={(e) => setFollowUpDate(e.target.value)}
              min={new Date().toISOString().split("T")[0]}
              className="h-6 rounded-md border border-[var(--orbit-glass-border)] bg-[var(--orbit-bg-secondary)] px-2 text-[10px] text-[var(--orbit-text)] outline-none focus:border-[var(--orbit-glow)]/40"
            />
            {followUpDate && (
              <button
                type="button"
                onClick={handleSetFollowUp}
                className="flex h-5 w-5 items-center justify-center rounded-md bg-[var(--orbit-glow)]/20 text-[var(--orbit-glow)] transition-colors hover:bg-[var(--orbit-glow)]/30"
              >
                <Check className="h-3 w-3" />
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setShowFollowUpPicker(false)
                setFollowUpDate("")
              }}
              className="flex h-5 w-5 items-center justify-center rounded-md text-[var(--orbit-text-muted)] transition-colors hover:bg-[var(--orbit-glass)] hover:text-[var(--orbit-text)]"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowFollowUpPicker(true)}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[var(--orbit-text-muted)] transition-colors hover:bg-[var(--orbit-glass)] hover:text-[var(--orbit-text)]"
          >
            <CalendarClock className="h-3 w-3" />
            <span className="text-[10px]">Lembrete</span>
          </button>
        )}

        {/* Recent contact indicator */}
        {memory.contactLog && memory.contactLog.length > 0 && (
          <div className="ml-auto flex items-center gap-1 text-[10px] text-[var(--orbit-text-muted)]">
            <Clock className="h-3 w-3" />
            <span>
              {contactOutcomeConfig[memory.contactLog[0].outcome]?.shortLabel}{" "}
              {formatRelativeTime(new Date(memory.contactLog[0].timestamp))}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
