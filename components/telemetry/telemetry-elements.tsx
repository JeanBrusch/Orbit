import { useMemo } from "react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell
} from "recharts";
import { Card } from "@/components/ui/card";

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

interface MetricCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  chip?: string;
  color?: string;
}

export function MetricCard({ label, value, subtext, chip, color }: MetricCardProps) {
  return (
    <Card className="relative overflow-hidden border-[var(--orbit-border)] bg-[var(--orbit-glass)] p-4 backdrop-blur-md transition-all hover:border-[var(--orbit-border-hover)]">
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[var(--orbit-glow-dim)] to-transparent" />
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-[9px] font-medium uppercase tracking-widest text-[#94a3b8]">
          {label}
        </span>
        {chip && (
          <span className={`rounded-full px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider ${color}`}>
            {chip}
          </span>
        )}
      </div>
      <div className="text-2xl font-bold tracking-tight text-white" style={{ color: color }}>
        {value}
      </div>
      {subtext && <div className="mt-1 font-mono text-[10px] text-[#94a3b8]/40">{subtext}</div>}
    </Card>
  );
}

export function EffortChart({ data }: { data: number[] }) {
  const chartData = [
    { name: "< 3 dias", value: data[0], fill: ORBIT_COLORS.green },
    { name: "3-7 dias", value: data[1], fill: ORBIT_COLORS.glow },
    { name: "8-14 dias", value: data[2], fill: ORBIT_COLORS.acc },
    { name: "15-30 dias", value: data[3], fill: ORBIT_COLORS.red },
    { name: "> 30 dias", value: data[4], fill: "rgba(255, 122, 122, 0.4)" },
  ];

  return (
    <div className="h-[170px] w-full mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <XAxis 
            dataKey="name" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: ORBIT_COLORS.muted, fontSize: 10 }}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: ORBIT_COLORS.muted, fontSize: 10 }}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: "#0f172a", border: "1px solid rgba(46,197,255,0.2)", borderRadius: "8px" }}
            itemStyle={{ color: "#fff", fontSize: "12px" }}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={40} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CognitiveStateChart({ data }: { data: Record<string, number> }) {
  const chartData = Object.entries(data).map(([name, value]) => ({
    name,
    value,
    fill: ORBIT_COLORS[name as keyof typeof ORBIT_COLORS] || ORBIT_COLORS.muted,
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
               contentStyle={{ backgroundColor: "#0f172a", border: "1px solid rgba(46,197,255,0.2)", borderRadius: "8px" }}
               itemStyle={{ color: "#fff", fontSize: "12px" }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[11px] text-[#94a3b8]">
        {chartData.map((d, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-[2px]" style={{ backgroundColor: d.fill }} />
            <span>{d.name}</span>
            <span className="text-white">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
