"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Columns, MapPin, Activity, Zap } from "lucide-react";

export function BottomNav() {
  const pathname = usePathname();

  const navItems = [
    { name: "Pipeline", href: "/pipeline", icon: Columns },
    { name: "Atlas", href: "/atlas", icon: MapPin },
    { name: "Telemetria", href: "/telemetry", icon: Activity },
    { name: "Silêncio", href: "/silence", icon: Zap },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-[100] h-16 bg-[var(--orbit-bg)]/90 backdrop-blur-xl border-t border-[var(--orbit-line)] flex items-center justify-around px-2 pb-safe shadow-[0_-10px_30px_rgba(0,0,0,0.1)]">
      {navItems.map((item) => {
        const isActive = pathname?.startsWith(item.href);
        const Icon = item.icon;
        
        return (
          <Link
            key={item.name}
            href={item.href}
            className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-all relative ${
              isActive 
                ? "text-[var(--orbit-glow)]" 
                : "text-[var(--orbit-text-muted)] hover:text-[var(--orbit-text)]"
            }`}
          >
            {isActive && (
              <div className="absolute top-0 w-8 h-[2px] bg-[var(--orbit-glow)] rounded-b-full shadow-[0_0_10px_var(--orbit-glow)]" />
            )}
            <Icon className={`w-6 h-6 ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`} />
            <span className="text-[10px] uppercase font-bold tracking-wider">{item.name}</span>
          </Link>
        );
      })}
    </div>
  );
}
