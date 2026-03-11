"use client";

import { useOrbitContext } from "./orbit-context";
import { useEffect, useState } from "react";
import { X, Zap, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface LeadInfo {
  id: string;
  name: string;
  phone: string;
  orbit_stage: string | null;
  last_interaction_at: string | null;
}

function formatSince(dateStr: string | null): string {
  if (!dateStr) return "nunca";
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "agora";
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function ScoreBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-px bg-[rgba(255,255,255,0.06)] relative">
        <div
          className="absolute left-0 top-0 h-px bg-[#2ec5ff] transition-all duration-700"
          style={{ width: `${pct}%`, opacity: 0.4 + value * 0.6 }}
        />
      </div>
      <span className="text-[10px] font-mono text-[#475569] w-6 text-right">
        {pct}
      </span>
    </div>
  );
}

function TrendIcon({ score }: { score: number }) {
  if (score >= 0.7) return <TrendingUp className="w-3 h-3 text-[#2ec5ff]" />;
  if (score <= 0.35) return <TrendingDown className="w-3 h-3 text-[#f87171]" />;
  return <Minus className="w-3 h-3 text-[#475569]" />;
}

export function CopilotoPanel() {
  const { orbitView, deactivateOrbitView } = useOrbitContext();
  const [leadInfos, setLeadInfos] = useState<Record<string, LeadInfo>>({});
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (orbitView.active) {
      setTimeout(() => setVisible(true), 50);
    } else {
      setVisible(false);
    }
  }, [orbitView.active]);

  // Busca nomes dos leads
  useEffect(() => {
    if (!orbitView.active || orbitView.leads.length === 0) return;

    const ids = orbitView.leads
      .map((l) => l.leadId)
      .filter((id) => !leadInfos[id]);
    if (ids.length === 0) return;

    fetch(`/api/lead/find?ids=${ids.join(",")}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.leads) {
          const map: Record<string, LeadInfo> = { ...leadInfos };
          data.leads.forEach((l: LeadInfo) => {
            map[l.id] = l;
          });
          setLeadInfos(map);
        }
      })
      .catch(() => {});
  }, [orbitView.leads, orbitView.active]);

  if (!orbitView.active) return null;

  const sorted = [...orbitView.leads].sort(
    (a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0),
  );

  return (
    <div
      className={`
        fixed right-0 top-0 h-full z-40
        flex flex-col
        transition-all duration-500 ease-out
        ${visible ? "translate-x-0 opacity-100" : "translate-x-8 opacity-0"}
      `}
      style={{ width: "280px" }}
    >
      {/* Borda esquerda luminosa */}
      <div className="absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-[rgba(46,197,255,0.2)] to-transparent" />

      {/* Fundo */}
      <div className="flex-1 flex flex-col bg-[rgba(5,5,12,0.95)] backdrop-blur-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[rgba(46,197,255,0.06)]">
          <div>
            <div className="flex items-center gap-2">
              <Zap className="w-3 h-3 text-[#2ec5ff]" />
              <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-[#2ec5ff]">
                Copiloto
              </span>
            </div>
            <div className="mt-1 text-[11px] text-[#334155] font-mono truncate max-w-[180px]">
              "{orbitView.query}"
            </div>
          </div>
          <button
            onClick={deactivateOrbitView}
            className="text-[#334155] hover:text-white transition-colors p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Contagem */}
        <div className="px-5 py-2 border-b border-[rgba(255,255,255,0.03)]">
          <span className="text-[9px] font-mono text-[#2a3a4a] uppercase tracking-wider">
            {sorted.length} lead{sorted.length !== 1 ? "s" : ""} · ordenado por
            aderência
          </span>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto">
          {sorted.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <span className="text-[11px] font-mono text-[#334155]">
                Nenhum resultado
              </span>
            </div>
          ) : (
            sorted.map((result, i) => {
              const info = leadInfos[result.leadId];
              const isTop = i === 0;
              return (
                <div
                  key={result.leadId}
                  className={`
                    px-5 py-4 border-b border-[rgba(255,255,255,0.03)]
                    transition-colors cursor-pointer
                    hover:bg-[rgba(46,197,255,0.03)]
                    ${isTop ? "bg-[rgba(46,197,255,0.02)]" : ""}
                  `}
                >
                  {/* Rank + Nome */}
                  <div className="flex items-start gap-3 mb-2">
                    <span
                      className={`text-[10px] font-mono mt-0.5 w-4 flex-shrink-0 ${isTop ? "text-[#2ec5ff]" : "text-[#2a3a4a]"}`}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[12px] font-sans text-[#94a3b8] truncate">
                          {info?.name || result.leadId.slice(0, 8) + "…"}
                        </span>
                        <TrendIcon score={result.relevanceScore || 0} />
                      </div>
                      {info?.last_interaction_at && (
                        <span className="text-[9px] font-mono text-[#2a3a4a]">
                          {formatSince(info.last_interaction_at)} atrás
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Score bar */}
                  <div className="pl-7">
                    <ScoreBar value={result.relevanceScore || 0} />
                  </div>

                  {/* Snippet & Reason */}
                  {result.snippet && (
                    <div className="pl-7 mt-2 space-y-1">
                      {result.matchReason && (
                        <div className="inline-flex items-center rounded-sm bg-[rgba(46,197,255,0.1)] px-1.5 py-0.5 text-[8px] font-mono text-[#2ec5ff] uppercase tracking-wider">
                          {result.matchReason}
                        </div>
                      )}
                      <p className="text-[10px] text-[#334155] leading-relaxed line-clamp-2 font-sans">
                        {result.snippet}
                      </p>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[rgba(255,255,255,0.03)]">
          <div className="flex items-center gap-1.5">
            <div className="w-1 h-1 rounded-full bg-[#2ec5ff] animate-pulse" />
            <span className="text-[9px] font-mono text-[#2a3a4a] uppercase tracking-wider">
              motor cognitivo · ia
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
