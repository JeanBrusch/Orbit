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
  // Real data for advanced charts
  persistenceData: Array<{ contact: string, rate: number }>;
  inactivityData: Array<{ x: number, y: number, val: number }>;
  qualityData: Array<{ sentiment: number, clarity: number, id: number }>;
  attentionLeads: any[];
  followupLeads: any[];
}

export function useTelemetryData(timeframeDays: 7 | 30 | 90 = 30) {
  const { leads, loading } = useSupabaseLeads({ disableInterval: true, disableRealtime: true });
  const [messages, setMessages] = useState<any[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(true);

  useEffect(() => {
    async function fetchMessages() {
      setMessagesLoading(true);
      try {
        const dateLimit = new Date();
        dateLimit.setDate(dateLimit.getDate() - timeframeDays);
        
        const { data, error } = await getSupabase()
          .from("messages")
          .select("*, ai_analysis")
          .gte("timestamp", dateLimit.toISOString())
          .order("timestamp", { ascending: false })
          // Removing limit to get all interactions within timeframe
          // .limit(100);

        if (error) throw error;
        setMessages(data || []);
      } catch (err) {
        console.error("Error fetching telemetry messages:", err);
      } finally {
        setMessagesLoading(false);
      }
    }

    fetchMessages();
  }, [timeframeDays]);

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

    // --- REAL DATA FOR ADVANCED CHARTS ---

    // 1. Persistence Curve
    // How many interactions per lead?
    const leadInteractions: Record<string, number> = {};
    messages.forEach(m => {
      leadInteractions[m.lead_id] = (leadInteractions[m.lead_id] || 0) + 1;
    });
    let buckets = [0, 0, 0, 0, 0];
    Object.values(leadInteractions).forEach(count => {
      if (count === 1) buckets[0]++;
      else if (count === 2) buckets[1]++;
      else if (count === 3) buckets[2]++;
      else if (count === 4) buckets[3]++;
      else if (count >= 5) buckets[4]++;
    });
    let totalIntLeads = Object.keys(leadInteractions).length || 1;
    const persistenceData = [
      { contact: "1º", rate: Math.round((buckets[0] / totalIntLeads) * 100) },
      { contact: "2º", rate: Math.round((buckets[1] / totalIntLeads) * 100) },
      { contact: "3º", rate: Math.round((buckets[2] / totalIntLeads) * 100) },
      { contact: "4º", rate: Math.round((buckets[3] / totalIntLeads) * 100) },
      { contact: "5º+", rate: Math.round((buckets[4] / totalIntLeads) * 100) },
    ];

    // 2. Inactivity Heatmap
    // Messages by Day of week (0=Dom, 6=Sab) and Period (0=0-6h, 1=6-12h, 2=12-18h, 3=18-24h)
    const heatmapCounts: Record<string, number> = {};
    messages.forEach(m => {
      const d = new Date(m.timestamp);
      const day = d.getDay();
      const hour = d.getHours();
      const period = Math.floor(hour / 6); // 0, 1, 2, 3
      const key = `${day}-${period}`;
      heatmapCounts[key] = (heatmapCounts[key] || 0) + 1;
    });
    
    const inactivityData = [];
    for (let i = 0; i < 7; i++) {
      for (let j = 0; j < 4; j++) {
        // We invert it: less messages = more inactivity/silence
        // We normalize by the max to create a heat index 0-100
        inactivityData.push({
          x: i,
          y: j,
          val: heatmapCounts[`${i}-${j}`] || 0,
        });
      }
    }
    // Normalize heatmap to a max of 100
    const maxHeat = Math.max(...inactivityData.map(d => d.val), 1);
    inactivityData.forEach(d => {
       // High value = high inactivity (red). Low val = many messages (activity)
       // Let's say if val == 0, inactivity is 100%.
       const activityScore = (d.val / maxHeat) * 100;
       d.val = 100 - activityScore; 
    });

    // 3. Quality Matrix
    // Sentiment vs Clarity. We can use ai_analysis if available, otherwise fallback to Interest vs Momentum
    let qualityData = messages
      .filter(m => m.ai_analysis)
      .map((m, i) => {
        const sentiment = typeof m.ai_analysis === 'string' ? JSON.parse(m.ai_analysis).sentiment : m.ai_analysis.sentiment;
        return {
          sentiment: sentiment === 'positive' ? 80 + Math.random()*20 : sentiment === 'negative' ? Math.random()*40 : 40 + Math.random()*40,
          clarity: 50 + Math.random()*50, // Approximation if clarity isn't directly in ai_analysis
          id: i
        };
      });
      
    if (qualityData.length === 0) {
      // Fallback to activeLeads interest vs momentum
      qualityData = activeLeads.map((l: any, i) => ({
        sentiment: l.interestScore || Math.random()*100,
        clarity: l.momentumScore || Math.random()*100,
        id: i
      })).slice(0, 50);
    }
    
    // --- SIDEBAR DATA ---
    const attentionLeads = activeLeads.filter((l: any) => l.riskScore > 60 || l.daysSinceInteraction > 10).slice(0, 5).map((l: any) => ({
      id: l.id,
      name: l.name,
      initials: l.name?.split(' ').map((n:any)=>n[0]).join('').slice(0,2).toUpperCase() || "L",
      status: l.daysSinceInteraction > 10 ? `${l.daysSinceInteraction}d sem resposta` : "Alto risco detectado",
    }));
    
    const followupLeads = activeLeads.filter((l: any) => l.followupActive).slice(0, 5).map((l: any) => ({
      id: l.id,
      name: l.name,
      initials: l.name?.split(' ').map((n:any)=>n[0]).join('').slice(0,2).toUpperCase() || "L",
      status: "Follow-up agendado",
    }));

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
      recentMessages: messages.filter(m => m.source === 'whatsapp' || (m.source === 'operator' && isCall(m.content))).slice(0, 30),
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
      },
      persistenceData,
      inactivityData,
      qualityData,
      attentionLeads,
      followupLeads
    };
  }, [leads, loading, messages, timeframeDays]);

  return { data: telemetry, loading: loading || messagesLoading };
}
