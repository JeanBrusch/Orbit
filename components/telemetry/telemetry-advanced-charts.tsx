"use client";

import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis, Cell
} from "recharts";
import { Card } from "@/components/ui/card";
import { useTheme } from "next-themes";

const ORBIT_COLORS = {
  glow: "#2ec5ff",
  acc: "#ffc87a",
  green: "#4ade80",
  red: "#ff7a7a",
  violet: "#a78bfa",
  muted: "#94a3b8",
};

const LIGHT_COLORS = {
  glow: "var(--orbit-glow)",
  acc: "#d97706",
  green: "#059669",
  red: "#dc2626",
  violet: "#7c3aed",
  muted: "var(--orbit-text-muted)",
};

export function PersistenceCurve({ data }: { data: Array<{ contact: string, rate: number }> }) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const colors = isDark ? ORBIT_COLORS : LIGHT_COLORS;

  return (
    <div className="h-[200px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <XAxis 
            dataKey="contact" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: colors.muted, fontSize: 10 }}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: colors.muted, fontSize: 10 }}
            unit="%"
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: isDark ? "#0f172a" : "#fff", 
              border: `1px solid ${isDark ? "rgba(46,197,255,0.2)" : "var(--orbit-line)"}`, 
              borderRadius: "8px",
              boxShadow: isDark ? "none" : "0 4px 12px rgba(0,0,0,0.1)"
            }}
            itemStyle={{ color: isDark ? "#fff" : "var(--orbit-text)", fontSize: "12px" }}
          />
          <Line 
            type="monotone" 
            dataKey="rate" 
            stroke={colors.glow} 
            strokeWidth={2} 
            dot={{ r: 4, fill: colors.glow, strokeWidth: 0 }}
            activeDot={{ r: 6, fill: isDark ? "#fff" : "var(--orbit-glow)", strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function InactivityHeatmap({ data }: { data: Array<{ x: number, y: number, val: number }> }) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const colors = isDark ? ORBIT_COLORS : LIGHT_COLORS;

  // Week days x 6-hour blocks
  const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const periods = ["00-06h", "06-12h", "12-18h", "18-00h"];

  return (
    <div className="h-[200px] w-full mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
          <XAxis 
            type="number" 
            dataKey="x" 
            domain={[0, 6]} 
            ticks={[0, 1, 2, 3, 4, 5, 6]} 
            tickFormatter={(v) => days[v]}
            axisLine={false}
            tickLine={false}
            tick={{ fill: colors.muted, fontSize: 9 }}
          />
          <YAxis 
            type="number" 
            dataKey="y" 
            domain={[0, 3]} 
            ticks={[0, 1, 2, 3]} 
            tickFormatter={(v) => periods[v]}
            axisLine={false}
            tickLine={false}
            tick={{ fill: colors.muted, fontSize: 9 }}
          />
          <ZAxis type="number" dataKey="val" range={[50, 400]} />
          <Tooltip 
             cursor={{ strokeDasharray: '3 3' }}
             contentStyle={{ 
               backgroundColor: isDark ? "#0f172a" : "#fff", 
               border: `1px solid ${isDark ? "rgba(46,197,255,0.2)" : "var(--orbit-line)"}`, 
               borderRadius: "8px",
               boxShadow: isDark ? "none" : "0 4px 12px rgba(0,0,0,0.1)"
             }}
             labelFormatter={() => ""}
          />
          <Scatter data={data}>
            {data.map((entry, index) => {
              const opacity = entry.val / 100;
              const color = entry.val > 70 ? colors.red : entry.val > 40 ? colors.acc : colors.green;
              return <Cell key={`cell-${index}`} fill={color} fillOpacity={opacity} />;
            })}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

export function QualityMatrix({ data }: { data: Array<{ sentiment: number, clarity: number, id: number }> }) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const colors = isDark ? ORBIT_COLORS : LIGHT_COLORS;

  return (
    <div className="h-[200px] w-full mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"} vertical={false} />
          <XAxis 
            type="number" 
            dataKey="sentiment" 
            name="Sentimento" 
            unit="%" 
            axisLine={false}
            tickLine={false}
            tick={{ fill: colors.muted, fontSize: 9 }}
          />
          <YAxis 
            type="number" 
            dataKey="clarity" 
            name="Clareza" 
            unit="%" 
            axisLine={false}
            tickLine={false}
            tick={{ fill: colors.muted, fontSize: 9 }}
          />
          <Tooltip 
            cursor={{ strokeDasharray: '3 3' }}
            contentStyle={{ 
              backgroundColor: isDark ? "#0f172a" : "#fff", 
              border: `1px solid ${isDark ? "rgba(46,197,255,0.2)" : "var(--orbit-line)"}`, 
              borderRadius: "8px",
              boxShadow: isDark ? "none" : "0 4px 12px rgba(0,0,0,0.1)"
            }}
          />
          <Scatter name="Mensagens" data={data} fill={colors.violet} fillOpacity={0.6}>
             {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.sentiment > 50 ? colors.green : colors.red} />
             ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
