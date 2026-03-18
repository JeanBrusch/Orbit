import { useMemo } from "react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell
} from "recharts";
import { Card } from "@/components/ui/card";
import { useTheme } from "next-themes";

// Orbit constants from globals.css or previous knowledge
const ORBIT_COLORS = {
  glow: "#2ec5ff",
  acc: "#ffc87a",
  green: "#4ade80",
  red: "#ff7a7a",
  violet: "#a78bfa",
  muted: "#94a3b8",
  glass: "rgba(15, 23, 42, 0.65)",
  border: "rgba(46, 197, 255, 0.2)",
};

const LIGHT_COLORS = {
  glow: "var(--orbit-glow)",
  acc: "#d97706", // amber-600
  green: "#059669", // emerald-600
  red: "#dc2626", // red-600
  violet: "#7c3aed", // violet-600
  muted: "var(--orbit-text-muted)",
};

interface MetricCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  chip?: string;
  color?: string;
}

export function MetricCard({ label, value, subtext, chip, color }: MetricCardProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <Card className={`relative overflow-hidden border p-4 backdrop-blur-md transition-all ${isDark ? 'border-[var(--orbit-border)] bg-[var(--orbit-glass)] hover:border-[var(--orbit-border-hover)]' : 'border-[var(--orbit-line)] bg-white shadow-sm hover:shadow-md'}`}>
      <div className={`absolute top-0 left-0 right-0 h-[1px] ${isDark ? 'bg-gradient-to-r from-transparent via-[var(--orbit-glow-dim)] to-transparent' : 'bg-gradient-to-r from-transparent via-[var(--orbit-glow)]/20 to-transparent'}`} />
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-[9px] font-medium uppercase tracking-widest text-[var(--orbit-text-muted)]">
          {label}
        </span>
        {chip && (
          <span className={`rounded-full px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider ${
            isDark ? color : 'text-slate-600 border border-slate-200 bg-slate-50'
          }`}>
            {chip}
          </span>
        )}
      </div>
      <div className={`text-2xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-[var(--orbit-text)]'}`} style={{ color: isDark ? color : undefined }}>
        {value}
      </div>
      {subtext && <div className="mt-1 font-mono text-[10px] text-[var(--orbit-text-muted)]/40">{subtext}</div>}
    </Card>
  );
}

export function EffortChart({ data }: { data: number[] }) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const colors = isDark ? ORBIT_COLORS : LIGHT_COLORS;

  const chartData = [
    { name: "< 3 dias", value: data[0], fill: colors.green },
    { name: "3-7 dias", value: data[1], fill: colors.glow },
    { name: "8-14 dias", value: data[2], fill: colors.acc },
    { name: "15-30 dias", value: data[3], fill: colors.red },
    { name: "> 30 dias", value: data[4], fill: isDark ? "rgba(255, 122, 122, 0.4)" : "rgba(220, 38, 38, 0.2)" },
  ];

  return (
    <div className="h-[170px] w-full mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <XAxis 
            dataKey="name" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: colors.muted, fontSize: 10 }}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: colors.muted, fontSize: 10 }}
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
          <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={40} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CognitiveStateChart({ data }: { data: Record<string, number> }) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const colors = isDark ? ORBIT_COLORS : LIGHT_COLORS;

  const chartData = Object.entries(data).map(([name, value]) => ({
    name,
    value,
    fill: (colors as any)[name] || colors.muted,
  }));

  return (
    <div className="flex items-center gap-4">
      <div className="h-[130px] w-[130px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              innerRadius={40}
              outerRadius={60}
              paddingAngle={2}
              dataKey="value"
              stroke="none"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip 
               contentStyle={{ 
                 backgroundColor: isDark ? "#0f172a" : "#fff", 
                 border: `1px solid ${isDark ? "rgba(46,197,255,0.2)" : "var(--orbit-line)"}`, 
                 borderRadius: "8px",
                 boxShadow: isDark ? "none" : "0 4px 12px rgba(0,0,0,0.1)"
               }}
               itemStyle={{ color: isDark ? "#fff" : "var(--orbit-text)", fontSize: "12px" }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className={`grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[11px] ${isDark ? 'text-[#94a3b8]' : 'text-[var(--orbit-text-muted)]'}`}>
        {chartData.map((d, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-[2px]" style={{ backgroundColor: d.fill }} />
            <span>{d.name}</span>
            <span className={isDark ? 'text-white' : 'text-[var(--orbit-text)] font-bold'}>{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
