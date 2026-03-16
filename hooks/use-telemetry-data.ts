"use client";

import { useMemo, useEffect, useState } from "react";
import { useSupabaseLeads } from "./use-supabase-data";
import { getSupabase } from "@/lib/supabase";

export interface TelemetryData {
  totalLeads: number;
  decidingLeads: number;
  dormantLeads: number;
  followupCount: number;
  capsuleCount: number;
  avgInterest: number;
  avgMomentum: number;
  avgRisk: number;
  avgClarity: number;
  diasBuckets: number[];
  stateCounts: Record<string, number>;
  recentMessages: any[];
  latencyData: {
    under15: number;
    under60: number;
    over60: number;
    avgMinutes: number;
  };
  interactionBreakdown: {
    whatsapp: number;
    calls: number;
    notes: number;
  };
}

export function useTelemetryData() {
  const { leads, loading } = useSupabaseLeads({ disableInterval: true, disableRealtime: true });
  const [messages, setMessages] = useState<any[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(true);

  useEffect(() => {
    async function fetchMessages() {
      try {
        const { data, error } = await getSupabase()
          .from("messages")
          .select("*, ai_analysis")
          .order("timestamp", { ascending: false })
          .limit(100);

        if (error) throw error;
        setMessages(data || []);
      } catch (err) {
        console.error("Error fetching telemetry messages:", err);
      } finally {
        setMessagesLoading(false);
      }
    }

    fetchMessages();
  }, []);

  const telemetry = useMemo(() => {
    if (loading) return null;

    const EXCLUDED = ["pending", "blocked", "ignored", "blocked_permanent", "spam"];
    const activeLeads = leads.filter(
      (l) => l.state && !EXCLUDED.includes(l.state)
    );

    const stateCounts: Record<string, number> = {};
    let sumInterest = 0;
    let sumMomentum = 0;
    let sumRisk = 0;
    let sumClarity = 0;
    let cogCount = 0;

    const diasBuckets = [0, 0, 0, 0, 0]; // <3, 3-7, 8-14, 15-30, >30

    activeLeads.forEach((l) => {
      const state = l.orbitVisualState || "latent";
      stateCounts[state] = (stateCounts[state] || 0) + 1;

      sumInterest += (l as any).interestScore || 0;
      sumMomentum += (l as any).momentumScore || 0;
      sumRisk += (l as any).riskScore || 0;
      sumClarity += (l as any).clarityLevel || 0;
      cogCount++;

      const d = (l as any).daysSinceInteraction || 0;
      if (d < 3) diasBuckets[0]++;
      else if (d <= 7) diasBuckets[1]++;
      else if (d <= 14) diasBuckets[2]++;
      else if (d <= 30) diasBuckets[3]++;
      else diasBuckets[4]++;
    });

    const followupCount = activeLeads.filter((l) => (l as any).followupActive).length;
    const capsuleCount = activeLeads.filter((l) => (l as any).hasActiveCycle).length;

    const isCall = (content: string) => {
      if (!content) return false;
      try {
        const parsed = JSON.parse(content);
        return parsed.type === 'call';
      } catch { return false; }
    };

    // Latency calculation
    let under15 = 0, under60 = 0, over60 = 0, totalMinutes = 0, pairs = 0;
    const chronMsgs = [...messages].reverse();
    for (let i = 0; i < chronMsgs.length - 1; i++) {
        const m1 = chronMsgs[i];
        const m2 = chronMsgs[i+1];
        
        const m2IsCall = isCall(m2.content || "");
        const isOperatorTouch = m2.source === 'operator' || (m2.source === 'operator' && m2IsCall);
        
        if (m1.lead_id === m2.lead_id && m1.source === 'whatsapp' && isOperatorTouch) {
            const diff = (new Date(m2.timestamp).getTime() - new Date(m1.timestamp).getTime()) / 60000;
            if (diff > 0) {
                totalMinutes += diff;
                pairs++;
                if (diff <= 15) under15++;
                else if (diff <= 60) under60++;
                else over60++;
            }
        }
    }

    // Interaction Breakdown
    let whatsappCount = 0, callCount = 0, noteCount = 0;
    messages.forEach(m => {
      if (m.source === 'whatsapp') whatsappCount++;
      else if (m.source === 'internal') noteCount++;
      else if (m.source === 'operator' && isCall(m.content)) callCount++;
    });

    return {
      totalLeads: activeLeads.length,
      decidingLeads: stateCounts["deciding"] || 0,
      dormantLeads: stateCounts["dormant"] || 0,
      followupCount,
      capsuleCount,
      avgInterest: cogCount ? sumInterest / cogCount : 0,
      avgMomentum: cogCount ? sumMomentum / cogCount : 0,
      avgRisk: cogCount ? sumRisk / cogCount : 0,
      avgClarity: cogCount ? sumClarity / cogCount : 0,
      diasBuckets,
      stateCounts,
      recentMessages: messages.filter(m => m.source === 'whatsapp' || (m.source === 'operator' && isCall(m.content))).slice(0, 10),
      rawLeads: activeLeads,
      latencyData: {
        under15: pairs ? (under15 / pairs) * 100 : 0,
        under60: pairs ? (under60 / pairs) * 100 : 0,
        over60: pairs ? (over60 / pairs) * 100 : 0,
        avgMinutes: pairs ? totalMinutes / pairs : 0,
      },
      interactionBreakdown: {
        whatsapp: whatsappCount,
        calls: callCount,
        notes: noteCount
      }
    };
  }, [leads, loading, messages]);

  return { data: telemetry, loading: loading || messagesLoading };
}
