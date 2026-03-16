"use client"

import { useState, useMemo, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Home, MapPin, MessageSquare, Star, Sparkles, 
  Map as MapIcon, Grid, Zap, Play, Check, 
  ArrowRight, Phone, Send, Info, Moon, Sun, 
  FileText, ExternalLink
} from "lucide-react"
import dynamic from "next/dynamic"
import "../../styles/themes/orbit-selection.css"

const SelectionMap = dynamic(() => import("./SelectionMap"), { 
  ssr: false,
  loading: () => <div className="h-full w-full bg-zinc-100 animate-pulse flex items-center justify-center">Carregando Mapa...</div>
})

interface SelectionItem {
  id: string;
  capsuleItemId: string;
  title: string;
  price: number | null;
  location: string | null;
  coverImage: string | null;
  url: string | null;
  lat: number | null;
  lng: number | null;
  note?: string;
  videoUrl?: string;
  audioUrl?: string;
  highlightLevel?: number;
  recommendedReason?: string;
}

interface ClientSelectionViewProps {
  data: {
    space: any;
    lead: any;
    preferences: any;
    items: SelectionItem[];
  };
  slug: string;
}

export default function ClientSelectionView({ data, slug }: ClientSelectionViewProps) {
  const { space, lead, preferences, items } = data
  const [view, setView] = useState<"curadoria" | "mapa">("curadoria")
  const [theme, setTheme] = useState<"paper" | "light" | "dark">(space.theme || "paper")
  const [selectedItem, setSelectedItem] = useState<SelectionItem | null>(null)

  const firstName = lead?.name?.split(" ")[0] || "Cliente"

  const formatPrice = (value: number | null) => {
    if (!value) return ""
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    }).format(value)
  }

  const handleWhatsApp = (item?: SelectionItem) => {
    const phone = "5551999999999" // TODO: Get from settings or operator profile
    let text = `Olá! Estou vendo o espaço Orbit Selection da ${firstName}.`
    if (item) {
      text += ` Gostaria de saber mais sobre o imóvel: ${item.title}`
      text += `\nLink: ${window.location.origin}/selection/${slug}?prop=${item.id}`
    }
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, "_blank")
  }

  return (
    <div className="orbit-selection-root" data-selection-theme={theme}>
      <div className="selection-container min-h-screen">
        
        {/* HEADER */}
        <header className="selection-header">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-[var(--gold)] flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-[var(--gold)] animate-pulse" />
            </div>
            <span className="font-mono text-[10px] uppercase tracking-widest opacity-60">Orbit</span>
          </div>

          <div className="flex bg-[var(--gold-bg)] p-1 rounded-full border border-[var(--gold-bd)]">
            <button 
              onClick={() => setView("curadoria")}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${view === "curadoria" ? "bg-white text-[var(--selection-text)] shadow-sm" : "text-[var(--ink3)] hover:text-[var(--ink)]"}`}
            >
              Curadoria
            </button>
            <button 
              onClick={() => setView("mapa")}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${view === "mapa" ? "bg-white text-[var(--selection-text)] shadow-sm" : "text-[var(--ink3)] hover:text-[var(--ink)]"}`}
            >
              Ver no Mapa
            </button>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex gap-2">
              <button onClick={() => setTheme("paper")} className={`w-6 h-6 rounded-full border-2 border-white ${theme === 'paper' ? 'ring-2 ring-[var(--gold)]' : ''}`} style={{ backgroundColor: '#f5f1eb' }} />
              <button onClick={() => setTheme("light")} className={`w-6 h-6 rounded-full border-2 border-white ${theme === 'light' ? 'ring-2 ring-[var(--gold)]' : ''}`} style={{ backgroundColor: '#ffffff' }} />
              <button onClick={() => setTheme("dark")} className={`w-6 h-6 rounded-full border-2 border-white ${theme === 'dark' ? 'ring-2 ring-[var(--gold)]' : ''}`} style={{ backgroundColor: '#050505' }} />
            </div>
            <div className="hidden md:flex flex-col items-end">
              <span className="text-[11px] font-medium opacity-80">{lead?.name}</span>
              <span className="text-[9px] uppercase tracking-wider opacity-40">Perfil Privado</span>
            </div>
            <div className="w-9 h-9 rounded-full bg-[var(--gold-bg)] border border-[var(--gold-bd)] flex items-center justify-center text-[var(--gold)] font-medium text-sm">
              {firstName[0]}
            </div>
          </div>
        </header>

        <main className="pt-24 pb-20 px-6 md:px-20 max-w-7xl mx-auto">
          <AnimatePresence mode="wait">
            {view === "curadoria" ? (
              <motion.div 
                key="curadoria"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-12"
              >
                {/* HERO */}
                <section className="max-w-3xl">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-8 h-[1px] bg-[var(--ink4)]" />
                    <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--ink4)]">orbit.house / selection</span>
                  </div>
                  <h1 className="text-5xl md:text-7xl font-light leading-[1.1] text-[var(--selection-text)] selection-title-sepia">
                    Seu <span className="italic text-[var(--gold)]">próximo imóvel</span> <br />
                    <strong>está aqui.</strong>
                  </h1>
                  <p className="mt-6 text-lg text-[var(--ink3)] font-light leading-relaxed">
                    Reuni casas que realmente fazem sentido para você — não um catálogo, uma curadoria feita com atenção.
                  </p>
                </section>

                {/* INSIGHT BAR */}
                {preferences && (
                  <section className="bg-[var(--cream)] border border-[var(--gold-bd)] rounded-2xl p-6 md:p-8 flex items-center gap-6 shadow-sm">
                    <div className="w-12 h-12 rounded-xl bg-[var(--gold-bg)] border border-[var(--gold-bd)] flex items-center justify-center text-[var(--gold)] text-xl shrink-0">
                      <Sparkles />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-[13px] font-bold text-[var(--selection-text)] mb-3 flex items-center gap-2">
                        O que aprendi sobre o que você busca
                        <Zap className="w-3.5 h-3.5 text-[var(--gold2)]" />
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {preferences.preferred_property_type && <span className="px-3 py-1 rounded-full bg-[var(--gold-bg)] border border-[var(--gold-bd)] text-[var(--gold)] text-[11px] font-medium">{preferences.preferred_property_type}</span>}
                        {preferences.preferred_area && <span className="px-3 py-1 rounded-full bg-[var(--gold-bg)] border border-[var(--gold-bd)] text-[var(--gold)] text-[11px] font-medium">{preferences.preferred_area}</span>}
                        {preferences.preferred_features?.map((f: string) => (
                          <span key={f} className="px-3 py-1 rounded-full bg-[var(--gold-bg)] border border-[var(--gold-bd)] text-[var(--gold)] text-[11px] font-medium">{f}</span>
                        ))}
                      </div>
                    </div>
                  </section>
                )}

                {/* PROPERTY GRID */}
                <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {items.map((item, idx) => (
                    <motion.div 
                      key={item.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className="selection-card group"
                    >
                      <div className="aspect-[4/3] relative overflow-hidden bg-zinc-100">
                        {item.coverImage ? (
                          <img src={item.coverImage} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt={item.title} />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[var(--ink4)] opacity-20">
                            <Home size={64} />
                          </div>
                        )}
                        <div className="absolute top-4 left-4 px-3 py-1.5 rounded-full bg-white/90 backdrop-blur-md border border-[var(--selection-border)] flex items-center gap-2 text-[var(--match)] font-mono text-[10px] font-bold">
                          <div className="w-1.5 h-1.5 rounded-full bg-[var(--match)]" />
                          92% MATCH
                        </div>
                      </div>
                      
                      <div className="p-6">
                        <span className="font-mono text-[9px] uppercase tracking-widest text-[var(--gold)] mb-2 block">Curado para você</span>
                        <h3 className="text-xl font-medium mb-1 selection-title-sepia">{item.title}</h3>
                        <p className="text-xs text-[var(--ink3)] flex items-center gap-1 mb-4">
                          <MapPin size={12} /> {item.location}
                        </p>
                        <div className="text-2xl font-light mb-6 selection-title-sepia">{formatPrice(item.price)}</div>

                        {/* Personalized Context */}
                        <AnimatePresence>
                          {(item.note || item.recommendedReason) && (
                            <div className="mb-6 p-4 rounded-xl bg-[var(--gold-bg)] border-l-2 border-[var(--gold2)] italic text-sm text-[var(--ink2)] leading-relaxed relative">
                              <span className="block not-italic font-mono text-[9px] uppercase tracking-wider text-[var(--gold)] mb-2">Nota do Jean</span>
                              "{item.note || item.recommendedReason}"
                            </div>
                          )}
                        </AnimatePresence>

                        <div className="flex gap-2">
                          <button 
                            onClick={() => window.open(item.url || "#", "_blank")}
                            className="flex-1 px-4 py-2.5 rounded-lg bg-[var(--selection-text)] text-[var(--selection-bg)] text-xs font-medium hover:opacity-90 transition-all flex items-center justify-center gap-2"
                          >
                            Ver Detalhes <ExternalLink size={14} />
                          </button>
                          <button 
                            onClick={() => handleWhatsApp(item)}
                            className="w-11 h-11 rounded-lg border border-[var(--selection-border)] flex items-center justify-center text-[var(--ink3)] hover:text-[var(--gold)] hover:bg-[var(--gold-bg)] transition-all"
                          >
                            <MessageSquare size={18} />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </section>
              </motion.div>
            ) : (
              <motion.div 
                key="mapa"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-[70vh] rounded-3xl overflow-hidden border border-[var(--selection-border)] bg-zinc-200 relative"
              >
                <SelectionMap 
                  items={items} 
                  theme={theme} 
                  className="w-full h-full"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        <footer className="py-12 border-t border-[var(--selection-border)] opacity-30 text-center">
          <p className="text-[10px] uppercase tracking-widest">Orbit house · Curadoria imobiliária privada</p>
        </footer>
      </div>
    </div>
  )
}
