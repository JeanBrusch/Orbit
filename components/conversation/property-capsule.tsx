"use client";

import { useState } from "react";
import { Building2, Bed, MapPin, ExternalLink, Star, Eye, XCircle, Heart } from "lucide-react";
import { CompatibilityRadar } from "@/components/cognitive/compatibility-radar";

export interface PropertyCapsuleData {
  id: string;
  name: string;
  address?: string;
  price?: number;
  bedrooms?: number;
  area?: number;
  coverImage?: string;
  state?: "sent" | "favorited" | "discarded" | "visited";
  matchScore?: number;
  sentAt: string;
}

function formatPrice(price?: number) {
  if (!price) return "";
  if (price >= 1_000_000) return `R$ ${(price / 1_000_000).toFixed(1)}M`;
  if (price >= 1_000) return `R$ ${Math.round(price / 1_000)}k`;
  return `R$ ${price}`;
}

const STATE_CONFIG = {
  sent: { icon: ExternalLink, label: "Enviado", color: "oklch(0.72 0.12 195)" },
  favorited: { icon: Heart, label: "Favorito", color: "oklch(0.72 0.12 350)" },
  discarded: { icon: XCircle, label: "Descartado", color: "oklch(0.55 0.1 25)" },
  visited: { icon: Eye, label: "Visitado", color: "oklch(0.72 0.1 155)" },
};

export function PropertyCapsuleItem({ property }: { property: PropertyCapsuleData }) {
  const [expanded, setExpanded] = useState(false);
  const [showRadar, setShowRadar] = useState(false);
  const stateConfig = property.state ? STATE_CONFIG[property.state] : STATE_CONFIG.sent;
  const StateIcon = stateConfig.icon;

  return (
    <div className="flex justify-end w-full mb-4">
      <div className="max-w-[85%] relative group">
        {/* Glow */}
        <div className="absolute -inset-1 bg-gradient-to-r from-[var(--orbit-glow)]/0 via-[var(--orbit-glow)]/10 to-[var(--orbit-glow)]/0 blur-lg opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl pointer-events-none" />

        <div
          onClick={() => setExpanded(!expanded)}
          className="relative cursor-pointer rounded-2xl overflow-hidden border border-white/10 bg-[oklch(0.16_0.01_250)]/90 backdrop-blur-md shadow-xl transition-all duration-300 hover:border-[var(--orbit-glow)]/40"
          style={{ minWidth: "280px" }}
        >
          {/* Image or icon */}
          <div className="relative h-32 bg-[oklch(0.12_0.01_250)] overflow-hidden">
            {property.coverImage ? (
              <img
                src={property.coverImage}
                alt={property.name}
                className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <Building2 className="w-10 h-10 text-white/20" />
              </div>
            )}
            {/* State Badge */}
            <div
              className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full backdrop-blur-sm text-[10px] font-mono"
              style={{
                background: `${stateConfig.color}20`,
                border: `1px solid ${stateConfig.color}40`,
                color: stateConfig.color,
              }}
            >
              <StateIcon className="w-2.5 h-2.5" />
              {stateConfig.label}
            </div>
            {property.matchScore !== undefined && (
              <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-[oklch(0.18_0.01_250)]/90 border border-white/10 text-[10px] font-mono text-white/70">
                <Star className="w-2.5 h-2.5 text-amber-400" />
                {property.matchScore}% match
              </div>
            )}
          </div>

          {/* Info */}
          <div className="p-3">
            <p className="text-sm font-medium text-white/90 truncate leading-tight">{property.name}</p>
            {property.address && (
              <div className="flex items-center gap-1 mt-1">
                <MapPin className="w-2.5 h-2.5 text-[#64748b]/60 shrink-0" />
                <p className="text-[11px] text-[#64748b]/70 truncate">{property.address}</p>
              </div>
            )}

            <div className="flex items-center justify-between mt-2.5">
              <div className="flex items-center gap-3">
                {property.price && (
                  <span className="text-sm font-mono font-semibold text-emerald-400">
                    {formatPrice(property.price)}
                  </span>
                )}
                {property.bedrooms && (
                  <span className="flex items-center gap-1 text-[11px] text-[#64748b]/70">
                    <Bed className="w-3 h-3" />
                    {property.bedrooms} qtos
                  </span>
                )}
              </div>
              <span className="text-[9px] font-mono text-[#64748b]/40">{property.sentAt}</span>
            </div>

            {/* Expanded Section */}
            {expanded && (
              <div className="mt-3 pt-3 border-t border-white/5 space-y-2">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowRadar(!showRadar); }}
                  className="w-full text-[11px] font-mono text-[var(--orbit-glow)]/80 hover:text-[var(--orbit-glow)] transition-colors text-center"
                >
                  {showRadar ? "Ocultar Radar" : "Ver Compatibilidade"}
                </button>
                {showRadar && (
                  <div className="group">
                    <CompatibilityRadar />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
