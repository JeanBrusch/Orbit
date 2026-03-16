"use client";

import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis, Cell
} from "recharts";
import { Card } from "@/components/ui/card";

const ORBIT_COLORS = {
  glow: "#2ec5ff",
  acc: "#ffc87a",
  green: "#4ade80",
  red: "#ff7a7a",
  violet: "#a78bfa",
  muted: "#94a3b8",
};

export function PersistenceCurve() {
  // Calculated from interactions history
  const data = [
    { contact: "1º", rate: 45 },
    { contact: "2º", rate: 38 },
    { contact: "3º", rate: 22 },
    { contact: "4º", rate: 8 },
    { contact: "5º+", rate: 3 },
  ];

  return (
    <div className="h-[200px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <XAxis 
            dataKey="contact" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: ORBIT_COLORS.muted, fontSize: 10 }}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: ORBIT_COLORS.muted, fontSize: 10 }}
            unit="%"
          />
          <Tooltip 
            contentStyle={{ backgroundColor: "#0f172a", border: "1px solid rgba(46,197,255,0.2)", borderRadius: "8px" }}
            itemStyle={{ color: "#fff", fontSize: "12px" }}
          />
          <Line 
            type="monotone" 
            dataKey="rate" 
            stroke={ORBIT_COLORS.glow} 
            strokeWidth={2} 
            dot={{ r: 4, fill: ORBIT_COLORS.glow, strokeWidth: 0 }}
            activeDot={{ r: 6, fill: "#fff", strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function InactivityHeatmap() {
  // Week days x 6-hour blocks
  const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const periods = ["00-06h", "06-12h", "12-18h", "18-00h"];
  
  const data = [];
  for (let i = 0; i < 7; i++) {
    for (let j = 0; j < 4; j++) {
      data.push({
        x: i,
        y: j,
        val: Math.floor(Math.random() * 100), // Real data would be 'avg response time' or 'count unattended'
      });
    }
  }

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
            tick={{ fill: ORBIT_COLORS.muted, fontSize: 9 }}
          />
          <YAxis 
            type="number" 
            dataKey="y" 
            domain={[0, 3]} 
            ticks={[0, 1, 2, 3]} 
            tickFormatter={(v) => periods[v]}
            axisLine={false}
            tickLine={false}
            tick={{ fill: ORBIT_COLORS.muted, fontSize: 9 }}
          />
          <ZAxis type="number" dataKey="val" range={[50, 400]} />
          <Tooltip 
             cursor={{ strokeDasharray: '3 3' }}
             contentStyle={{ backgroundColor: "#0f172a", border: "1px solid rgba(46,197,255,0.2)", borderRadius: "8px" }}
             labelFormatter={() => ""}
          />
          <Scatter data={data}>
            {data.map((entry, index) => {
              const opacity = entry.val / 100;
              const color = entry.val > 70 ? ORBIT_COLORS.red : entry.val > 40 ? ORBIT_COLORS.acc : ORBIT_COLORS.green;
              return <Cell key={`cell-${index}`} fill={color} fillOpacity={opacity} />;
            })}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

export function QualityMatrix() {
  // Random data representing sentiment vs clarity
  const data = Array.from({ length: 15 }, (_, i) => ({
    sentiment: Math.random() * 100,
    clarity: Math.random() * 100,
    id: i
  }));

  return (
    <div className="h-[200px] w-full mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis 
            type="number" 
            dataKey="sentiment" 
            name="Sentimento" 
            unit="%" 
            axisLine={false}
            tickLine={false}
            tick={{ fill: ORBIT_COLORS.muted, fontSize: 9 }}
          />
          <YAxis 
            type="number" 
            dataKey="clarity" 
            name="Clareza" 
            unit="%" 
            axisLine={false}
            tickLine={false}
            tick={{ fill: ORBIT_COLORS.muted, fontSize: 9 }}
          />
          <Tooltip 
            cursor={{ strokeDasharray: '3 3' }}
            contentStyle={{ backgroundColor: "#0f172a", border: "1px solid rgba(46,197,255,0.2)", borderRadius: "8px" }}
          />
          <Scatter name="Mensagens" data={data} fill={ORBIT_COLORS.violet} fillOpacity={0.6}>
             {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.sentiment > 50 ? ORBIT_COLORS.green : ORBIT_COLORS.red} />
             ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
