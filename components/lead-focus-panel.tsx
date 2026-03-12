"use client";

import React from "react";
import Link from "next/link";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  X,
  Send,
  ImageIcon,
  Paperclip,
  MapPin,
  Clock,
  Check,
  CheckCheck,
  Building2,
  Heart,
  Eye,
  XCircle,
  ChevronDown,
  ChevronUp,
  Share2,
  Link2,
  CheckCircle2,
  MoreVertical,
  Trash2,
  Pencil,
  RefreshCw,
  Ban,
  Brain,
} from "lucide-react";


import type { Property } from "./atlas-map";
import { useOrbitContext } from "./orbit-context";
import { useLeadDetails, type PropertyInteractionRow } from "@/hooks/use-supabase-data";


// Helper to format value as abbreviated string (950k, 1.2M)
function formatValue(value: number | null): string {
  if (value === null || value === 0) return "";
  if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    return millions % 1 === 0 ? `${millions}M` : `${millions.toFixed(1)}M`;
  }
  if (value >= 1_000) {
    const thousands = value / 1_000;
    return thousands % 1 === 0 ? `${thousands}k` : `${thousands.toFixed(0)}k`;
  }
  return value.toString();
}
import { LeadMemory } from "./lead-memory";
import { getSupabase } from "@/lib/supabase";

export type LeadInternalState = "priority" | "focus" | "resolved" | "default";

export interface LeadFocusData {
  id: string;
  name: string;
  avatar: string;
  photoUrl: string | null;
  phone: string | null;
  lid: string | null;
  status: "online" | "typing" | "offline";
  statusLabel: string;
  lastSeen: string;
  internalState: LeadInternalState;
  interestScore?: number;
  momentumScore?: number;
  currentState?: string;
}

// Property state for the Capsule View
export type PropertyState = "sent" | "favorited" | "discarded" | "visited";

export interface SentProperty {
  id: string;
  property: Property;
  state: PropertyState;
  sentAt: Date;
  stateChangedAt?: Date;
}

interface Message {
  id: string;
  content: string;
  timestamp: string;
  type: "sent" | "received";
  status?: "sent" | "delivered" | "read";
  media?: {
    type: "image" | "file";
    name: string;
    url?: string;
  }[];
  linkedProperty?: Property; // Property linked to this message
}

// Helper to get initials from name
function getInitials(name: string | null): string {
  if (!name) return "??";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// Helper to map estado_atual to internal state
function mapEstadoToInternalState(estado: string | null): LeadInternalState {
  switch (estado?.toLowerCase()) {
    case "quente":
    case "hot":
    case "ativo":
      return "priority";
    case "morno":
    case "warm":
    case "aguardando":
      return "focus";
    case "frio":
    case "cold":
    case "concluido":
    case "fechado":
      return "resolved";
    default:
      return "default";
  }
}

// Helper to format relative time
function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return "nunca";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "agora";
  if (diffMins < 60) return `há ${diffMins}min`;
  if (diffHours < 24) return `há ${diffHours}h`;
  return `há ${diffDays}d`;
}

// Type for leads_center row from Supabase
interface LeadsCenterRow {
  lead_id: string | null;
  name: string | null;
  phone: string | null;
  lid: string | null;
  photo_url: string | null;
  origin: string | null;
  estado_atual: string | null;
  acao_sugerida: string | null;
  last_event_type: string | null;
  ultima_interacao_at: string | null;
  dias_sem_interacao: number | null;
  last_evaluated_at: string | null;
  created_at: string | null;
  interest_score?: number;
  momentum_score?: number;
  current_cognitive_state?: string;
}

export interface StreamEvent {
  id: string;
  type: "message" | "capsule_property" | "ai_insight" | "note" | "contact_log";
  timestamp: Date;
  data: any; // specific data based on type
}

interface LeadFocusPanelProps {
  leadId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onAtlasMapInvoke?: () => void;
  onCapsuleEmerge?: () => void;
  onFocusModeToggle?: () => void;
  onLeadRemoved?: () => void;
}

export function LeadFocusPanel({
  leadId,
  isOpen,
  onClose,
  onLeadRemoved,
}: LeadFocusPanelProps) {
  const [lead, setLead] = useState<LeadFocusData | null>(null);
  const [stream, setStream] = useState<StreamEvent[]>([]);
  const [loadingLead, setLoadingLead] = useState(false);

  // Get lead details from Supabase (messages, property_interactions)
  const {
    messages,
    propertyInteractions,
    loading: loadingDetails,
    refetch: refetchDetails,
  } = useLeadDetails(leadId);
  const [inputValue, setInputValue] = useState("");
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [linkedProperty, setLinkedProperty] = useState<Property | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isAtlasOpen, setIsAtlasOpen] = useState(false); // Declare isAtlasOpen

  // Capsule View state - tracks all sent properties and their states
  const [sentProperties, setSentProperties] = useState<SentProperty[]>([]);
  const [isCapsuleExpanded, setIsCapsuleExpanded] = useState(true);

  // Magic Link state
  const [magicLinkUrl, setMagicLinkUrl] = useState<string | null>(null);
  const [isLinkCopied, setIsLinkCopied] = useState(false);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);



  // Block state
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);

  // Delete state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Name editing state
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);
  const [isRefreshingProfile, setIsRefreshingProfile] = useState(false);

  // Cognitive State helpers
  const {
    invokeAtlasMap,
  } = useOrbitContext();

  const hasCapsuleToShow = sentProperties.length > 0;
  const isViewingHistory = false; // logic simplified for now


  // Fetch lead data from Supabase when leadId changes
  useEffect(() => {
    if (!leadId) {
      setLead(null);
      return;
    }

    const fetchLead = async () => {
      setLoadingLead(true);
      try {
        const supabase = getSupabase();
        const { data, error } = await supabase
          .from("leads_center")
          .select("*")
          .eq("lead_id", leadId)
          .single();

        if (error) {
          console.error("Error fetching lead:", error);
          setLead(null);
          return;
        }

        if (data) {
          const row = data as LeadsCenterRow;

          // Fetch lid from leads table (may not be in view yet)
          let lid = row.lid;
          if (!lid && row.lead_id) {
            const { data: leadRow } = await supabase
              .from("leads")
              .select("lid")
              .eq("id", row.lead_id)
              .maybeSingle();
            lid = (leadRow as { lid: string | null } | null)?.lid || null;
          }

          const leadData: LeadFocusData = {
            id: row.lead_id || leadId,
            name: row.name || "Sem nome",
            avatar: getInitials(row.name),
            photoUrl: row.photo_url,
            phone: row.phone,
            lid: lid,
            status: "offline",
            statusLabel: formatRelativeTime(row.ultima_interacao_at),
            lastSeen: formatRelativeTime(row.ultima_interacao_at),
            internalState: mapEstadoToInternalState(row.estado_atual),
            interestScore: row.interest_score,
            momentumScore: row.momentum_score,
            currentState: row.current_cognitive_state,
          };
          setLead(leadData);
        }
      } catch (err) {
        console.error("Error fetching lead:", err);
        setLead(null);
      } finally {
        setLoadingLead(false);
      }
    };

    fetchLead();
  }, [leadId]);



  // Clear needs_attention when lead panel is opened (user acknowledged the message)
  useEffect(() => {
    if (leadId && isOpen) {
      fetch("/api/lead/clear-attention", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId }),
      }).catch((err) => console.error("Error clearing attention:", err));
    }
  }, [leadId, isOpen]);

  // Build the Unified Stream from messages and propertyInteractions
  const buildUnifiedStream = useCallback(() => {
    let newStream: StreamEvent[] = [];

    // 1. Add messages (WhatsApp messages)
    if (messages && messages.length > 0) {
      const messageEvents: StreamEvent[] = messages.map((msg) => ({
        id: `msg-${msg.id}`,
        type: "message",
        timestamp: new Date(msg.timestamp || ""),
        data: {
          content: msg.content || "",
          type: msg.source === "operator" ? "sent" : "received",
          status: msg.source === "operator" ? "sent" : undefined,
          ai_analysis: msg.ai_analysis,
        },

      }));
      newStream = [...newStream, ...messageEvents];
    }

    // 2. Add Properties sent (Property Interactions)
    if (propertyInteractions && propertyInteractions.length > 0) {
      const propertyEvents: StreamEvent[] = propertyInteractions.map((pi: PropertyInteractionRow) => ({
        id: `prop-${pi.id}`,
        type: "capsule_property",
        timestamp: new Date(pi.timestamp || ""),
        data: {
          id: pi.id,
          property: pi.property,
          state: pi.interaction_type as PropertyState,
          sentAt: new Date(pi.timestamp || ""),
        },
      }));
      newStream = [...newStream, ...propertyEvents];
    }

    
    // Sort chronologically (oldest to newest)
    newStream.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    setStream(newStream);
  }, [messages, propertyInteractions, lead]);

  useEffect(() => {
    buildUnifiedStream();
  }, [buildUnifiedStream]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [stream]);

  // Load property interactions when leadDetails change
  useEffect(() => {
    if (propertyInteractions) {
      const mapped = propertyInteractions.map((pi: PropertyInteractionRow) => {
        const propRow = pi.property as any;
        const property: Property = {
          id: propRow?.id || pi.property_id || "",
          name: propRow?.title || "Imóvel",
          locationText: propRow?.location_text || null,
          type: "apartment",
          value: propRow?.value || null,
          url: propRow?.source_link || null,
          domain: propRow?.source_domain || null,
          coverImage: propRow?.cover_image || null,
          position: { x: 0, y: 0 },
        };
        return {
          id: pi.id,
          property,
          state: pi.interaction_type as PropertyState,
          sentAt: new Date(pi.timestamp || ""),
        };
      });
      setSentProperties(mapped);
    }

    // Reset magic link when switching leads
    setMagicLinkUrl(null);
    setIsLinkCopied(false);
  }, [propertyInteractions]);



  // Keyboard handler for escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const [isSending, setIsSending] = useState(false);

  const handleBlock = useCallback(async () => {
    if (!leadId) return;

    setIsBlocking(true);
    try {
      const res = await fetch("/api/block", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId }),
      });

      if (res.ok) {
        setShowBlockConfirm(false);
        onLeadRemoved?.();
        onClose();
      }
    } catch (err) {
      console.error("Error blocking:", err);
    } finally {
      setIsBlocking(false);
    }
  }, [leadId, onClose, onLeadRemoved]);

  const handleSaveName = useCallback(async () => {
    if (!leadId || !editedName.trim()) return;

    setIsSavingName(true);
    try {
      const res = await fetch("/api/lead", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId,
          name: editedName.trim(),
        }),
      });

      if (res.ok) {
        setLead((prev) => (prev ? { ...prev, name: editedName.trim() } : null));
        setIsEditingName(false);
      }
    } catch (err) {
      console.error("Error saving name:", err);
    } finally {
      setIsSavingName(false);
    }
  }, [leadId, editedName]);

  const handleRefreshProfile = useCallback(async () => {
    if (!leadId) return;

    setIsRefreshingProfile(true);
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId,
          action: "refresh-profile",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.updated) {
          setLead((prev) =>
            prev
              ? {
                  ...prev,
                  name: data.updated.name || prev.name,
                  avatar: data.updated.name
                    ? data.updated.name
                        .split(" ")
                        .map((n: string) => n[0])
                        .join("")
                        .substring(0, 2)
                        .toUpperCase()
                    : prev.avatar,
                }
              : null,
          );
        }
      }
    } catch (err) {
      console.error("Error refreshing profile:", err);
    } finally {
      setIsRefreshingProfile(false);
    }
  }, [leadId]);

  const handleDelete = useCallback(async () => {
    if (!leadId) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/lead/${leadId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setShowDeleteConfirm(false);
        onLeadRemoved?.();
        onClose();
      }
    } catch (err) {
      console.error("Error deleting:", err);
    } finally {
      setIsDeleting(false);
    }
  }, [leadId, onClose, onLeadRemoved]);

  const [sendError, setSendError] = useState<string | null>(null);

  const handleSend = useCallback(async () => {
    console.log('[SEND] handleSend called', { hasInput: !!inputValue?.trim(), leadId, hasLead: !!lead })
    if (!inputValue.trim() || !leadId) return;
    if (isSending) return;

    setIsSending(true);
    setSendError(null);
    const messageContent = inputValue.trim();

    // Determine what identifier to use: LID (preferred) or phone
    const sendTo = (lead?.lid ? `${lead.lid}@lid` : null) || lead?.phone;
    console.log('[SEND] lead.lid:', lead?.lid)
    console.log('[SEND] lead.phone:', lead?.phone)
    console.log('[SEND] sendTo:', sendTo)

    if (!sendTo) {
      setSendError("Sem telefone ou LID para enviar");
      setIsSending(false);
      return;
    }

    try {
      const whatsappRes = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: sendTo,
          message: messageContent,
          leadId,
        }),
      });

      if (whatsappRes.ok) {
        const result = await whatsappRes.json();
        console.log("[SEND] Success:", result);
        setInputValue("");
        setSelectedImages([]);
        setSelectedFiles([]);
        refetchDetails();
      } else {
        const errorData = await whatsappRes.json().catch(() => ({}));
        console.error("[SEND] Failed:", errorData);
        setSendError(errorData.error || "Falha ao enviar mensagem");
      }
    } catch (err: any) {
      console.error("[SEND] Error:", err);
      setSendError(err.message || "Erro ao enviar");
    } finally {
      setIsSending(false);
    }
  }, [inputValue, leadId, lead?.phone, lead?.lid, isSending, refetchDetails]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedImages((prev) => [...prev, ...files]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedFiles((prev) => [...prev, ...files]);
  };

  const removeSelectedImage = (index: number) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const removeSelectedFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSelectPropertyOnMap = useCallback(() => {
    // Invoke the global Atlas Focus Surface with callback to receive the selected property
    invokeAtlasMap({
      leadId: leadId || undefined,
      leadName: lead?.name,
      onPropertySelected: (property: Property) => {
        setLinkedProperty(property);
      },
    });
  }, [invokeAtlasMap, leadId, lead?.name]);


  // Send property to lead - this triggers the Property Interaction evolution
  const handleSendProperty = useCallback(async () => {
    if (!linkedProperty || !lead || !leadId) return;

    try {
      // 1. Save property_interaction to Supabase (API triggers WhatsApp)
      const interactionResponse = await fetch("/api/property-interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: leadId,
          propertyId: linkedProperty.id,
          interaction_type: "sent",
          source: "lead_panel"
        }),
      });

      if (!interactionResponse.ok) {
        console.error("Failed to save property interaction");
        const errData = await interactionResponse.json().catch(() => ({}));
        setSendError(errData.error || "Erro ao enviar imóvel");
        return;
      }
      
      const interactionData = await interactionResponse.json();

      // 2. Add property to local state
      const newSentProperty: SentProperty = {
        id: interactionData.id,
        property: linkedProperty,
        state: "sent",
        sentAt: new Date(),
        stateChangedAt: new Date(),
      };

      setSentProperties((prev) => [...prev, newSentProperty]);
      setLinkedProperty(null);
      refetchDetails();
    } catch (error) {
      console.error("Error sending property:", error);
      setSendError("Erro na integração de envio");
    }
  }, [linkedProperty, lead, leadId, refetchDetails]);


  // Toggle property state in the Property Interactions
  const handleTogglePropertyState = useCallback(
    async (propertyId: string, newState: PropertyState) => {
      // Find the interaction ID for this property
      const interaction = sentProperties.find(sp => sp.property.id === propertyId);
      if (!interaction) return;

      try {
        const res = await fetch("/api/property-interactions", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: interaction.id,
            state: newState,
          }),
        });

        if (res.ok) {
          setSentProperties((prev) =>
            prev.map((sp) =>
              sp.property.id === propertyId
                ? { ...sp, state: newState, stateChangedAt: new Date() }
                : sp,
            ),
          );
        }
      } catch (err) {
        console.error("Error updating property state:", err);
      }
    },
    [sentProperties],
  );


  // Get the appropriate icon and color for property state
  const getPropertyStateConfig = (state: PropertyState) => {
    switch (state) {
      case "favorited":
        return {
          icon: Heart,
          color: "text-rose-400",
          bg: "bg-rose-500/20",
          label: "Favoritado",
        };
      case "discarded":
        return {
          icon: XCircle,
          color: "text-zinc-400",
          bg: "bg-zinc-500/20",
          label: "Descartado",
        };
      case "visited":
        return {
          icon: Eye,
          color: "text-emerald-400",
          bg: "bg-emerald-500/20",
          label: "Visitado",
        };
      default:
        return {
          icon: Send,
          color: "text-[var(--orbit-glow)]",
          bg: "bg-[var(--orbit-glow)]/20",
          label: "Enviado",
        };
    }
  };

  // Generate magic link for client access
  const handleGenerateMagicLink = useCallback(async () => {
    if (!leadId) return;

    setIsGeneratingLink(true);

    try {
      const response = await fetch(`/api/lead/${leadId}/capsule-link`);
      if (response.ok) {
        const data = await response.json();
        setMagicLinkUrl(data.url);
      }
    } catch (err) {
      console.error("Error generating capsule link:", err);
    } finally {
      setIsGeneratingLink(false);
    }
  }, [leadId]);

  // Copy magic link to clipboard
  const handleCopyMagicLink = useCallback(async () => {
    if (!magicLinkUrl) return;

    try {
      await navigator.clipboard.writeText(magicLinkUrl);
      setIsLinkCopied(true);
      setTimeout(() => setIsLinkCopied(false), 2000);
    } catch (err) {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = magicLinkUrl;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setIsLinkCopied(true);
      setTimeout(() => setIsLinkCopied(false), 2000);
    }
  }, [magicLinkUrl]);

  const handleCloseAtlas = useCallback(() => {
    setIsAtlasOpen(false);
  }, []);

  const handlePropertySelected = useCallback((property: Property) => {
    setLinkedProperty(property);
    setIsAtlasOpen(false);
  }, []);

  if (!isOpen || !lead) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[3px] animate-backdrop-fade"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col animate-panel-slide-in"
        style={{
          background: "#0a0a0f",
          borderLeft: "1px solid oklch(0.72 0.12 195 / 0.1)",
          boxShadow: "-8px 0 40px rgba(0,0,0,0.8)",
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="lead-focus-title"
      >
        {/* Cognitive Intelligence Header */}
        <div
          className="flex flex-col gap-3 px-4 py-4 flex-shrink-0"
          style={{
            borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
            background: "linear-gradient(180deg, rgba(16, 16, 24, 0.95) 0%, rgba(10, 10, 15, 0.95) 100%)",
            backdropFilter: "blur(20px)",
          }}
        >
          <div className="flex items-start justify-between">
            <div className="flex gap-3 items-center">
              {/* Sci-Fi Avatar Ring */}
              <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full">
                <div className="absolute inset-0 rounded-full border border-[var(--orbit-glow)]/30 animate-[spin_4s_linear_infinite]" />
                <div className="absolute inset-1 rounded-full border border-dashed border-[var(--orbit-glow)]/20 animate-[spin_3s_linear_infinite_reverse]" />
                <div
                  className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full overflow-hidden text-xs font-mono font-bold"
                  style={{
                    background: "rgba(20, 20, 30, 0.9)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    color: "var(--orbit-glow)",
                    boxShadow: "0 0 20px var(--orbit-glow-dim)",
                  }}
                >
                  {lead.photoUrl && lead.photoUrl !== "null" ? (
                    <img
                      src={lead.photoUrl}
                      alt={lead.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    lead.avatar
                  )}
                </div>
                {lead.status === "online" && (
                  <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] border border-[#0a0a0f]" />
                )}
              </div>

              {/* Cognitive Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h2
                    id="lead-focus-title"
                    className="truncate text-base font-semibold tracking-tight text-white/90"
                  >
                    {lead.name}
                  </h2>
                  <div className="px-1.5 py-0.5 rounded text-[8px] font-mono tracking-widest uppercase bg-[var(--orbit-glow)]/10 text-[var(--orbit-glow)] border border-[var(--orbit-glow)]/30">
                    ID: {lead.id.substring(0,6)}
                  </div>
                </div>
                
                <div className="flex items-center gap-2 mt-0.5 text-[10px] font-mono">
                  <span className={lead.status === "typing" ? "text-emerald-400 animate-pulse" : "text-white/40"}>
                    {lead.statusLabel}
                  </span>
                  <span className="text-white/20">•</span>
                  <span className="text-white/40 flex items-center gap-1">
                    <Clock className="h-2.5 w-2.5" />
                    {lead.lastSeen}
                  </span>
                </div>
              </div>
            </div>

            {/* Top Right Controls */}
            <div className="flex items-center gap-1.5 *:flex *:h-7 *:w-7 *:items-center *:justify-center *:rounded-full *:transition-all *:text-white/40 hover:*:text-white/80 hover:*:bg-white/5">
              {lead.phone && (
                <button onClick={handleRefreshProfile} disabled={isRefreshingProfile} className={isRefreshingProfile ? "animate-spin text-[var(--orbit-glow)]" : ""}>
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              )}
              <Link href={`/leads/${lead.id}/intelligence`}>
                <Brain className="h-3.5 w-3.5" />
              </Link>
              <button onClick={() => setShowBlockConfirm(true)}>
                <Ban className="h-3 w-3 hover:text-red-400" />
              </button>
              <button onClick={onClose} className="hover:bg-red-500/20 hover:text-red-400">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* AI Momentum Bar */}
          <div className="mt-1 bg-white/5 rounded-lg p-2.5 border border-white/5">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[9px] font-mono text-white/50 uppercase tracking-wider flex items-center gap-1">
                <Brain className="h-2.5 w-2.5 text-[var(--orbit-glow)]" />
                Engajamento Cognitivo
              </span>
              <span className="text-[10px] font-mono text-[var(--orbit-glow)]">Escorre %</span>
            </div>
            {/* Dynamic visual indicator based on state */}
            <div className="h-1 w-full bg-black/40 rounded-full overflow-hidden flex">
              <div 
                className="h-full rounded-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-[var(--orbit-glow)] to-transparent"
                style={{ 
                  width: lead.internalState === 'priority' ? '85%' : lead.internalState === 'focus' ? '45%' : '15%',
                  backgroundSize: '200% 100%',
                }}
              />
            </div>
          </div>
        </div>

        {/* Block Confirmation */}
        {showBlockConfirm && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div
              className="mx-4 w-full max-w-xs rounded-xl p-4 shadow-xl"
              style={{
                background: "oklch(0.19 0.005 250)",
                border: "1px solid oklch(0.72 0.12 195 / 0.1)",
              }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/20">
                  <Ban className="h-5 w-5 text-red-400" />
                </div>
                <div>
                  <h3
                    className="text-sm font-medium"
                    style={{ color: "oklch(0.88 0.01 250)" }}
                  >
                    Bloquear contato?
                  </h3>
                  <p
                    className="text-xs"
                    style={{ color: "oklch(0.55 0.01 250)" }}
                  >
                    {lead.name}
                  </p>
                </div>
              </div>
              <p
                className="text-xs mb-4"
                style={{ color: "oklch(0.55 0.01 250)" }}
              >
                Este numero sera bloqueado e nunca mais aparecera no Orbit.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowBlockConfirm(false)}
                  className="flex-1 rounded-lg py-2 text-sm transition-colors hover:bg-white/5"
                  style={{
                    border: "1px solid oklch(0.72 0.12 195 / 0.1)",
                    color: "oklch(0.88 0.01 250)",
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleBlock}
                  disabled={isBlocking}
                  className="flex-1 rounded-lg bg-red-500 py-2 text-sm text-white hover:bg-red-600 disabled:opacity-50"
                >
                  {isBlocking ? "Bloqueando..." : "Bloquear"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation */}
        {showDeleteConfirm && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div
              className="mx-4 w-full max-w-xs rounded-xl p-4 shadow-xl"
              style={{
                background: "oklch(0.19 0.005 250)",
                border: "1px solid oklch(0.72 0.12 195 / 0.1)",
              }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/20">
                  <Trash2 className="h-5 w-5 text-red-400" />
                </div>
                <div>
                  <h3
                    className="text-sm font-medium"
                    style={{ color: "oklch(0.88 0.01 250)" }}
                  >
                    Excluir lead?
                  </h3>
                  <p
                    className="text-xs"
                    style={{ color: "oklch(0.55 0.01 250)" }}
                  >
                    {lead.name}
                  </p>
                </div>
              </div>
              <p
                className="text-xs mb-4"
                style={{ color: "oklch(0.55 0.01 250)" }}
              >
                O lead sera removido permanentemente. Esta acao nao pode ser
                desfeita.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 rounded-lg py-2 text-sm transition-colors hover:bg-white/5"
                  style={{
                    border: "1px solid oklch(0.72 0.12 195 / 0.1)",
                    color: "oklch(0.88 0.01 250)",
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="flex-1 rounded-lg bg-red-500 py-2 text-sm text-white hover:bg-red-600 disabled:opacity-50"
                >
                  {isDeleting ? "Excluindo..." : "Excluir"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Cognitive State Bar */}
        <div
          className="flex items-center justify-between px-4 py-2.5 flex-shrink-0"
          style={{
            borderBottom: "1px solid oklch(0.72 0.12 195 / 0.1)",
            background: "rgba(10, 10, 15, 0.4)",
          }}
        >
          <div className="flex items-center gap-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] uppercase tracking-wider text-white/40 font-medium">Interest</span>
              <div className="flex items-center gap-2">
                <div className="h-1 w-20 bg-white/5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)] transition-all duration-1000" 
                    style={{ width: `${lead?.interestScore || 0}%` }}
                  />
                </div>
                <span className="text-[11px] font-mono text-emerald-400">{lead?.interestScore || 0}%</span>
              </div>
            </div>

            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] uppercase tracking-wider text-white/40 font-medium">Momentum</span>
              <div className="flex items-center gap-2">
                <div className="h-1 w-20 bg-white/5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.5)] transition-all duration-1000" 
                    style={{ width: `${lead?.momentumScore || 0}%` }}
                  />
                </div>
                <span className="text-[11px] font-mono text-blue-400">{lead?.momentumScore || 0}%</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
             <div className="flex flex-col items-end gap-0.5">
               <span className="text-[10px] uppercase tracking-wider text-white/40 font-medium">Cognitive State</span>
               <span className="text-[11px] font-medium text-[var(--orbit-glow)] px-2 py-0.5 rounded bg-[var(--orbit-glow)]/10 border border-[var(--orbit-glow)]/20 uppercase tracking-widest">
                 {lead?.currentState || "Latent"}
               </span>
             </div>
          </div>
        </div>


        {/* Memory */}
        {leadId && <LeadMemory leadId={leadId} />}

        {/* Capsule View */}
        {hasCapsuleToShow && (
          <div
            className={`animate-text-fade-in flex-shrink-0`}
            style={{
              borderBottom: "1px solid oklch(0.72 0.12 195 / 0.08)",
              background: isViewingHistory
                ? "oklch(1 0 0 / 0.02)"
                : "oklch(0.19 0.005 250 / 0.5)",
            }}
          >
            <button
              onClick={() => setIsCapsuleExpanded(!isCapsuleExpanded)}
              className="flex w-full items-center justify-between px-4 py-2.5 text-left transition-colors hover:bg-white/3"
            >
              <div className="flex items-center gap-2">
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full`}
                  style={{
                    background: isViewingHistory
                      ? "oklch(1 0 0 / 0.08)"
                      : "oklch(0.72 0.12 195 / 0.1)",
                  }}
                >
                  <Building2
                    className="h-3.5 w-3.5"
                    style={{
                      color: isViewingHistory
                        ? "oklch(0.55 0.01 250)"
                        : "oklch(0.72 0.12 195)",
                    }}
                  />
                </div>
                <span
                  className="text-xs font-medium"
                  style={{ color: "oklch(0.88 0.01 250)" }}
                >
                  {isViewingHistory
                    ? "Histórico de Imóveis"
                    : "Espaço de Decisão"}
                </span>
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                  style={
                    isViewingHistory
                      ? {
                          background: "oklch(1 0 0 / 0.08)",
                          color: "oklch(0.55 0.01 250)",
                        }
                      : {
                          background: "oklch(0.72 0.12 195 / 0.15)",
                          color: "oklch(0.72 0.12 195)",
                        }
                  }
                >
                  {sentProperties.length}{" "}
                  {sentProperties.length === 1 ? "imóvel" : "imóveis"}
                </span>
                {isViewingHistory && (
                  <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-medium text-amber-400">
                    Encerrado
                  </span>
                )}
              </div>
              {isCapsuleExpanded ? (
                <ChevronUp
                  className="h-4 w-4"
                  style={{ color: "oklch(0.55 0.01 250)" }}
                />
              ) : (
                <ChevronDown
                  className="h-4 w-4"
                  style={{ color: "oklch(0.55 0.01 250)" }}
                />
              )}
            </button>

            {isCapsuleExpanded && (
              <div className="px-4 pb-3 space-y-2">
                {sentProperties.map((sp) => {
                  const stateConfig = getPropertyStateConfig(sp.state);
                  const StateIcon = stateConfig.icon;
                  return (
                    <div
                      key={sp.property.id}
                      className={`rounded-xl border p-3 transition-all ${sp.state === "discarded" ? "opacity-60" : ""}`}
                      style={{
                        background: "oklch(1 0 0 / 0.04)",
                        border: "1px solid oklch(1 0 0 / 0.08)",
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl overflow-hidden"
                          style={{
                            background: "oklch(1 0 0 / 0.05)",
                            border: "1px solid oklch(1 0 0 / 0.1)",
                          }}
                        >
                          {sp.property.coverImage && sp.property.coverImage !== "null" ? (
                            <img
                              src={sp.property.coverImage}
                              alt={sp.property.name}
                              className="h-full w-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                                e.currentTarget.nextElementSibling?.classList.remove(
                                  "hidden",
                                );
                              }}
                            />
                          ) : null}
                          <Building2
                            className={`h-5 w-5 ${sp.property.coverImage ? "hidden" : ""}`}
                            style={{ color: "oklch(0.55 0.01 250)" }}
                          />
                          <span
                            className={`absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full ${stateConfig.bg}`}
                            style={{ border: "1px solid #0a0a0f" }}
                          >
                            <StateIcon
                              className={`h-2.5 w-2.5 ${stateConfig.color}`}
                            />
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p
                            className="truncate text-sm font-medium"
                            style={{ color: "oklch(0.88 0.01 250)" }}
                          >
                            {sp.property.name}
                          </p>
                          {sp.property.value && (
                            <span
                              className="text-[10px] font-medium"
                              style={{ color: "oklch(0.72 0.12 195)" }}
                            >
                              {formatValue(sp.property.value)}
                            </span>
                          )}
                        </div>
                        <span
                          className={`shrink-0 rounded-lg px-2 py-1 text-[10px] font-medium ${stateConfig.bg} ${stateConfig.color}`}
                        >
                          {stateConfig.label}
                        </span>
                      </div>
                      <div className="mt-3 flex gap-1.5">
                        {[
                          {
                            state: "sent" as const,
                            label: "Enviado",
                            icon: Send,
                            active: "oklch(0.72 0.12 195)",
                            activeBg: "oklch(0.72 0.12 195)",
                            activeText: "#0a0a0f",
                            inactiveBg: "oklch(0.72 0.12 195 / 0.1)",
                            inactiveText: "oklch(0.72 0.12 195)",
                          },
                          {
                            state: "visited" as const,
                            label: "Visitado",
                            icon: Eye,
                            active: "#10b981",
                            activeBg: "#10b981",
                            activeText: "white",
                            inactiveBg: "oklch(0.45 0.12 165 / 0.1)",
                            inactiveText: "#34d399",
                          },
                          {
                            state: "favorited" as const,
                            label: "Favorito",
                            icon: Heart,
                            active: "#f43f5e",
                            activeBg: "#f43f5e",
                            activeText: "white",
                            inactiveBg: "oklch(0.45 0.2 10 / 0.1)",
                            inactiveText: "#fb7185",
                          },
                          {
                            state: "discarded" as const,
                            label: "Descartado",
                            icon: XCircle,
                            active: "#71717a",
                            activeBg: "#71717a",
                            activeText: "white",
                            inactiveBg: "oklch(0.4 0.01 250 / 0.1)",
                            inactiveText: "#a1a1aa",
                          },
                        ].map(
                          ({
                            state,
                            label,
                            icon: Icon,
                            activeBg,
                            activeText,
                            inactiveBg,
                            inactiveText,
                          }) => (
                            <button
                              key={state}
                              onClick={() =>
                                handleTogglePropertyState(sp.property.id, state)
                              }
                              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-[10px] font-medium transition-all"
                              style={
                                sp.state === state
                                  ? { background: activeBg, color: activeText }
                                  : {
                                      background: inactiveBg,
                                      color: inactiveText,
                                    }
                              }
                            >
                              <Icon className="h-3 w-3" />
                              {label}
                            </button>
                          ),
                        )}
                      </div>
                      <div
                        className="mt-2 flex items-center gap-1.5 text-[10px]"
                        style={{ color: "oklch(0.55 0.01 250)" }}
                      >
                        <Clock className="h-3 w-3" />
                        <span>
                          Enviado{" "}
                          {sp.sentAt.toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>

                      </div>
                    </div>
                  );
                })}

                <div
                  className="mt-3 pt-3"
                  style={{ borderTop: "1px solid oklch(0.72 0.12 195 / 0.08)" }}
                >
                  {!magicLinkUrl ? (
                    <button
                      onClick={handleGenerateMagicLink}
                      disabled={isGeneratingLink}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed py-2.5 text-xs font-medium transition-all disabled:opacity-50"
                      style={{
                        borderColor: "oklch(0.72 0.12 195 / 0.2)",
                        color: "oklch(0.55 0.01 250)",
                      }}
                    >
                      {isGeneratingLink ? (
                        <>
                          <div className="h-3.5 w-3.5 animate-spin rounded-full border border-current border-t-transparent" />
                          Gerando link...
                        </>
                      ) : (
                        <>
                          <Share2 className="h-3.5 w-3.5" />
                          Compartilhar com cliente
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <div
                        className="flex items-center gap-2 rounded-xl px-3 py-2"
                        style={{ background: "oklch(0.15 0.005 250)" }}
                      >
                        <Link2
                          className="h-3.5 w-3.5 shrink-0"
                          style={{ color: "oklch(0.72 0.12 195)" }}
                        />
                        <span
                          className="flex-1 truncate text-xs"
                          style={{ color: "oklch(0.55 0.01 250)" }}
                        >
                          {magicLinkUrl}
                        </span>
                        <button
                          onClick={handleCopyMagicLink}
                          className="shrink-0 rounded-md px-2 py-1 text-[10px] font-medium transition-all"
                          style={
                            isLinkCopied
                              ? {
                                  background: "oklch(0.45 0.12 165 / 0.2)",
                                  color: "#34d399",
                                }
                              : {
                                  background: "oklch(0.72 0.12 195 / 0.1)",
                                  color: "oklch(0.72 0.12 195)",
                                }
                          }
                        >
                          {isLinkCopied ? (
                            <span className="flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Copiado
                            </span>
                          ) : (
                            "Copiar"
                          )}
                        </button>
                      </div>
                      <p
                        className="text-center text-[10px]"
                        style={{ color: "oklch(0.55 0.01 250)" }}
                      >
                        Link exclusivo para {lead.name.split(" ")[0]}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Unified Cognitive Stream */}
        <div
          className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-thin scroll-smooth"
          style={{ background: "linear-gradient(to bottom, #0d0d14, #070709)" }}
        >
          {stream.length === 0 && (
            <div className="flex h-full items-center justify-center text-center px-6">
              <div className="flex flex-col items-center gap-3 opacity-40">
                <Brain className="h-8 w-8 text-[var(--orbit-glow)]" />
                <p className="text-sm font-light text-white/60">
                  Fluxo cognitivo vazio. Inicie a interação ou aguarde insights da inteligência.
                </p>
              </div>
            </div>
          )}

          {stream.map((event, index) => {
            const isLast = index === stream.length - 1;
            
            // -----------------------------
            // MESSAGE EVENT
            // -----------------------------
            if (event.type === "message") {
              const message = event.data;
              return (
                <div
                  key={event.id}
                  className={`flex ${message.type === "sent" ? "justify-end" : "justify-start"} animate-in slide-in-from-bottom-2 fade-in duration-300`}
                >
                  <div
                    className={`relative max-w-[85%] px-3 py-2.5 ${message.type === "sent" ? "rounded-2xl rounded-br-sm" : "rounded-2xl rounded-bl-sm"}`}
                    style={
                      message.type === "sent"
                        ? {
                            background: "rgba(20, 20, 30, 0.6)",
                            borderRight: "2px solid var(--orbit-glow)",
                            border: "1px solid rgba(255, 255, 255, 0.05)",
                            color: "rgba(255, 255, 255, 0.9)",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.2)"
                          }
                        : {
                            background: "rgba(30, 30, 45, 0.4)",
                            borderLeft: "2px solid rgba(255, 255, 255, 0.2)",
                            border: "1px solid rgba(255, 255, 255, 0.03)",
                            color: "rgba(255, 255, 255, 0.9)",
                          }
                    }
                  >
                    {/* Media Attachments */}
                    {message.media && message.media.length > 0 && (
                      <div className="mb-2 space-y-1">
                        {message.media.map((m: any, i: number) => (
                          <div
                            key={i}
                            className="flex items-center gap-2 rounded bg-black/40 px-2 py-1.5 text-xs text-white/80"
                          >
                            {m.type === "image" ? (
                              <ImageIcon className="h-3.5 w-3.5 text-[var(--orbit-glow)]" />
                            ) : (
                              <Paperclip className="h-3.5 w-3.5 text-white/50" />
                            )}
                            <span className="truncate">{m.name}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Rich Content Parsing */}
                    {(() => {
                      try {
                        const parsed = JSON.parse(message.content);
                        if (parsed.type && parsed.url) {
                          if (parsed.type === "image")
                            return (
                              <div className="space-y-1">
                                <img
                                  src={parsed.url}
                                  alt={parsed.caption || "Imagem"}
                                  className="max-w-[200px] rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                  onClick={() => window.open(parsed.url, "_blank")}
                                />
                                {parsed.caption && <p className="text-xs text-white/70 mt-1">{parsed.caption}</p>}
                              </div>
                            );
                          if (parsed.type === "video")
                            return (
                              <div className="space-y-1">
                                <video src={parsed.url} controls className="max-w-[200px] rounded-lg" />
                                {parsed.caption && <p className="text-xs text-white/70 mt-1">{parsed.caption}</p>}
                              </div>
                            );
                          if (parsed.type === "audio")
                            return <audio src={parsed.url} controls className="max-w-[200px] h-8" />;
                          if (parsed.type === "document")
                            return (
                              <a
                                href={parsed.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 text-sm text-[var(--orbit-glow)] hover:underline"
                              >
                                <Paperclip className="h-4 w-4" />
                                {parsed.caption || "Documento"}
                              </a>
                            );
                        }
                      } catch {}
                      // Fallback text
                      return <p className="text-[13px] leading-relaxed whitespace-pre-wrap font-light">{message.content}</p>;
                    })()}

                    {/* Meta Footer */}
                    <div className={`mt-1.5 flex items-center gap-1.5 ${message.type === "sent" ? "justify-end" : ""}`}>
                      <span className="text-[9px] font-mono text-white/30">
                        {event.timestamp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      {message.type === "sent" && message.status && (
                        <span className={message.status === "read" ? "text-emerald-400" : "text-white/30"}>
                          {message.status === "read" ? <CheckCheck className="h-3 w-3" /> : <Check className="h-3 w-3" />}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            }

            // -----------------------------
            // ATLAS PROPERTY EVENT
            // -----------------------------
            if (event.type === "capsule_property") {
              const sp = event.data;
              return (
                <div key={event.id} className="flex justify-center my-6 relative animate-in zoom-in-95 duration-500">
                  <div className="absolute left-1/2 -ml-[1px] top-0 bottom-0 w-[2px] bg-gradient-to-b from-transparent via-[var(--orbit-glow)]/20 to-transparent -z-10" />
                  
                  <div className="w-[85%] rounded-xl overflow-hidden shadow-2xl transition-all hover:scale-[1.02]" style={{
                    background: "rgba(15, 15, 20, 0.8)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    backdropFilter: "blur(12px)"
                  }}>
                    {/* Header bar */}
                    <div className="px-3 py-1.5 bg-white/5 border-b border-white/5 flex justify-between items-center">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="h-3 w-3 text-[var(--orbit-glow)]" />
                        <span className="text-[10px] font-mono font-medium tracking-widest uppercase text-white/60">Imóvel Enviado</span>
                      </div>
                      <span className="text-[9px] font-mono text-white/30">
                        {event.timestamp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    
                    {/* Property Content */}
                    <div className="p-3 flex gap-3 group">
                      <div className="h-16 w-20 rounded-lg overflow-hidden shrink-0 relative">
                        {sp.property.coverImage && sp.property.coverImage !== "null" ? (
                          <img src={sp.property.coverImage} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt={sp.property.name} />
                        ) : (
                          <div className="w-full h-full bg-white/5 flex items-center justify-center"><Building2 className="h-6 w-6 text-white/20" /></div>
                        )}
                        <div className="absolute inset-0 ring-1 ring-inset ring-black/40 rounded-lg" />
                      </div>
                      
                      <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <h4 className="text-sm font-medium text-white/90 truncate group-hover:text-[var(--orbit-glow)] transition-colors">{sp.property.name}</h4>
                        {sp.property.value && <p className="text-xs font-mono text-emerald-400 mt-0.5">{formatValue(sp.property.value)}</p>}
                        <div className="flex items-center gap-2 mt-2">
                          <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-mono tracking-wider ${
                            sp.state === 'sent' ? 'bg-[var(--orbit-glow)]/10 text-[var(--orbit-glow)]' :
                            sp.state === 'visited' ? 'bg-emerald-500/10 text-emerald-400' :
                            sp.state === 'favorited' ? 'bg-rose-500/10 text-rose-400' :
                            'bg-white/5 text-white/40'
                          }`}>
                            Estado: {sp.state}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            // -----------------------------
            // AI INSIGHT EVENT
            // -----------------------------
            if (event.type === "ai_insight") {
              const insight = event.data;
              return (
                <div key={event.id} className="flex justify-center my-4 animate-in fade-in duration-700">
                  <div className="max-w-[90%] rounded-lg px-4 py-3 flex gap-3 shadow-[0_0_30px_rgba(var(--orbit-glow-rgb),0.1)] relative overflow-hidden" style={{
                    background: "linear-gradient(90deg, rgba(20,20,30,0.9), rgba(15,15,25,0.8))",
                    border: "1px solid rgba(255,255,255,0.05)",
                    borderLeft: "2px solid var(--orbit-glow)"
                  }}>
                    <div className="absolute inset-0 bg-gradient-to-r from-[var(--orbit-glow)]/10 to-transparent opacity-50 pointer-events-none" />
                    
                    <div className="flex bg-[var(--orbit-glow)]/20 h-8 w-8 rounded-lg shrink-0 items-center justify-center ring-1 ring-[var(--orbit-glow)]/30">
                      <Brain className="h-4 w-4 text-[var(--orbit-glow)] animate-pulse" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-0.5">
                        <span className="text-[9px] font-mono tracking-widest text-[var(--orbit-glow)] uppercase font-semibold">Insight do Motor</span>
                        <span className="text-[9px] font-mono text-white/30">{event.timestamp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                      <p className="text-xs leading-relaxed text-white/80 font-light">
                        {insight.message}
                      </p>
                      {insight.action && (
                        <button className="mt-2 text-[10px] font-mono text-[var(--orbit-glow)] hover:text-white bg-[var(--orbit-glow)]/10 px-2 py-1 rounded transition-colors border border-[var(--orbit-glow)]/20 hover:bg-[var(--orbit-glow)]/30">
                          {insight.action.label}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            }

            return null; // Fallback for unknown events
          })}
          
          <div ref={messagesEndRef} className="h-4" />
        </div>

        {/* Media Preview */}
        {(selectedImages.length > 0 || selectedFiles.length > 0) && (
          <div
            className="px-4 py-2 flex-shrink-0"
            style={{
              borderTop: "1px solid oklch(0.72 0.12 195 / 0.08)",
              background: "oklch(0.16 0.005 250 / 0.8)",
            }}
          >
            <div className="flex flex-wrap gap-2">
              {selectedImages.map((img, i) => (
                <div
                  key={`img-${i}`}
                  className="flex items-center gap-2 rounded-lg px-2 py-1 text-xs"
                  style={{
                    background: "oklch(0.72 0.12 195 / 0.1)",
                    color: "oklch(0.88 0.01 250)",
                  }}
                >
                  <ImageIcon
                    className="h-3 w-3"
                    style={{ color: "oklch(0.72 0.12 195)" }}
                  />
                  <span className="max-w-[100px] truncate">{img.name}</span>
                  <button
                    onClick={() => removeSelectedImage(i)}
                    className="hover:text-red-400"
                    style={{ color: "oklch(0.55 0.01 250)" }}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {selectedFiles.map((file, i) => (
                <div
                  key={`file-${i}`}
                  className="flex items-center gap-2 rounded-lg px-2 py-1 text-xs"
                  style={{
                    background: "oklch(0.72 0.1 85 / 0.1)",
                    color: "oklch(0.88 0.01 250)",
                  }}
                >
                  <Paperclip
                    className="h-3 w-3"
                    style={{ color: "oklch(0.72 0.1 85)" }}
                  />
                  <span className="max-w-[100px] truncate">{file.name}</span>
                  <button
                    onClick={() => removeSelectedFile(i)}
                    className="hover:text-red-400"
                    style={{ color: "oklch(0.55 0.01 250)" }}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

         {/* Futurist Input Bar */}
        <div
          className="p-3 flex-shrink-0 relative z-20"
          style={{
            borderTop: "1px solid rgba(255,255,255,0.05)",
            background: "rgba(10, 10, 15, 0.95)",
            backdropFilter: "blur(20px)"
          }}
        >
          {/* Selected Property Context Glow */}
          {linkedProperty ? (
            <div
              className="mb-3 rounded-xl p-3 relative overflow-hidden"
              style={{
                border: "1px solid var(--orbit-glow)",
                background: "rgba(20, 20, 30, 0.8)",
                boxShadow: "0 0 20px rgba(var(--orbit-glow-rgb), 0.15)"
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-[var(--orbit-glow)]/10 to-transparent pointer-events-none" />
              <div className="flex items-center gap-3 relative">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg overflow-hidden"
                  style={{
                    border: "1px solid var(--orbit-glow)",
                    background: "rgba(var(--orbit-glow-rgb), 0.1)",
                    color: "var(--orbit-glow)",
                  }}
                >
                  {linkedProperty.coverImage ? (
                    <img
                      src={linkedProperty.coverImage}
                      alt={linkedProperty.name}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                        e.currentTarget.nextElementSibling?.classList.remove("hidden");
                      }}
                    />
                  ) : null}
                  <Building2 className={`h-5 w-5 ${linkedProperty.coverImage ? "hidden" : ""}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-mono tracking-widest uppercase text-[var(--orbit-glow)]">
                    Em Foco
                  </p>
                  <p className="truncate text-sm font-medium text-white/90">
                    {linkedProperty.name}
                  </p>
                  {linkedProperty.value && (
                    <p className="text-xs font-mono text-emerald-400">
                      {formatValue(linkedProperty.value)}
                    </p>
                  )}
                </div>
                <button
                  onClick={handleSelectPropertyOnMap}
                  className="shrink-0 rounded-lg px-2.5 py-1.5 text-[10px] font-mono tracking-wider transition-all hover:bg-white/10 text-white/50 border border-white/10"
                >
                  ALTERAR
                </button>
              </div>
              <button
                onClick={handleSendProperty}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-all hover:opacity-90 active:scale-[0.98] shadow-[0_0_15px_rgba(var(--orbit-glow-rgb),0.3)]"
                style={{ background: "var(--orbit-glow)", color: "#000" }}
              >
                <Send className="h-4 w-4" />
                Disparar para {lead.name.split(" ")[0]}
              </button>
            </div>
          ) : (
            <button
              onClick={handleSelectPropertyOnMap}
              className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-mono tracking-widest uppercase transition-all hover:bg-[var(--orbit-glow)]/20 active:scale-[0.98] border border-[var(--orbit-glow)]/30 text-[var(--orbit-glow)]"
            >
              <MapPin className="h-3.5 w-3.5" />
              Anexar do Atlas
            </button>
          )}


          <div className="flex items-end gap-2">
            <div className="flex gap-1">
              <input ref={imageInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageSelect} />
              <button onClick={() => imageInputRef.current?.click()} className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-white/10 text-white/40 hover:text-white">
                <ImageIcon className="h-4 w-4" />
              </button>
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} />
              <button onClick={() => fileInputRef.current?.click()} className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-white/10 text-white/40 hover:text-white">
                <Paperclip className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 relative">
              {sendError && (
                <div className="absolute -top-6 left-0 text-[10px] font-mono text-rose-400 flex items-center gap-1 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                  {sendError}
                </div>
              )}
              <div className="rounded-2xl px-4 py-2.5 transition-colors border focus-within:border-[var(--orbit-glow)] focus-within:shadow-[0_0_10px_rgba(var(--orbit-glow-rgb),0.1)]" style={{
                background: "rgba(20,20,30,0.6)",
                borderColor: sendError ? "rgba(244,63,94,0.3)" : "rgba(255,255,255,0.05)"
              }}>
                <textarea
                  value={inputValue}
                  onChange={(e) => {
                    setInputValue(e.target.value);
                    if (sendError) setSendError(null);
                    e.target.style.height = "auto";
                    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
                  }}
                  onKeyDown={handleKeyPress}
                  placeholder="Transmitir mensagem..."
                  rows={1}
                  className="w-full resize-none overflow-y-auto bg-transparent text-sm outline-none placeholder:text-white/20 text-white/90"
                  style={{ minHeight: "24px", maxHeight: "120px" }}
                />
              </div>
            </div>

            <button
              onClick={handleSend}
              disabled={!inputValue.trim() && selectedImages.length === 0 && selectedFiles.length === 0}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all duration-300 disabled:opacity-40 disabled:bg-white/5 disabled:text-white/20 hover:scale-105 active:scale-95 shadow-[0_0_15px_rgba(var(--orbit-glow-rgb),0.2)]"
              style={
                (inputValue.trim() || selectedImages.length > 0 || selectedFiles.length > 0)
                  ? { background: "var(--orbit-glow)", color: "#000" }
                  : {}
              }
            >
              <Send className="h-4 w-4 ml-0.5" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
