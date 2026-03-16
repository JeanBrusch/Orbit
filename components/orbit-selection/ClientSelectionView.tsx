"use client"

import { useState, useMemo, useEffect } from "react"
import { motion } from "framer-motion"
import { 
  Star, Phone
} from "lucide-react"
import "../../styles/themes/orbit-selection.css"

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
  const theme = space.theme || "paper"
  const [selectedItem, setSelectedItem] = useState<SelectionItem | null>(null)

  const firstName = lead?.name?.split(" ")[0] || "Cliente"

  const formatPrice = (value: number | null) => {
    if (!value) return "Sob consulta"
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    }).format(value)
  }

  const handleWhatsApp = (item?: SelectionItem) => {
    const phone = "5551999999999" // TODO: Get from operator profile
    let text = `Olá! Estou vendo o seu espaço Orbit Selection.`
    if (item) {
      text += ` Gostaria de saber mais sobre o imóvel: ${item.title}`
      text += `\nLink: ${window.location.origin}/selection/${slug}?prop=${item.id}`
    }
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, "_blank")
  }

  return (
    <div className="orbit-selection-root" data-selection-theme={theme}>
      <div className="selection-container min-h-screen relative">
        
        {/* HEADER */}
        <header className="selection-header">
          <a href="#" className="flex items-center gap-2 group">
            <div className="w-[22px] h-[22px] border-2 border-[var(--gold)] rounded-full flex items-center justify-center">
              <div className="w-[6px] h-[6px] bg-[var(--gold)] rounded-full animate-pulse" />
            </div>
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--ink2)] font-light">Orbit</span>
          </a>

          <div className="flex items-center gap-3">
            <span className="text-[13px] text-[var(--ink2)] font-light hidden sm:block">{lead?.name}</span>
            <div className="w-8 h-8 rounded-full bg-[var(--gold-bg)] border-[1.5px] border-[var(--gold-bd)] flex items-center justify-center text-[var(--gold)] font-serif text-[14px]">
              {firstName[0]}
            </div>
            <a 
              href={`https://wa.me/5551999999999?text=Olá, Jean! Estou vendo o portal.`} 
              target="_blank"
              className="flex items-center gap-2 px-[14px] py-[6px] rounded-[8px] bg-[var(--match-bg)] border border-[rgba(90,122,74,0.18)] text-[var(--match)] text-xs font-medium hover:bg-[rgba(90,122,74,0.14)] transition-all ml-2"
            >
              <Phone size={14} className="fill-current" />
              Conversar
            </a>
          </div>
        </header>

        <main className="max-w-[1100px] mx-auto pt-[58px]">
          <div className="pb-20">
            {/* HERO */}
            <section className="px-[72px] pt-[72px] pb-[56px] fu fu1">
              <div className="flex items-center gap-[10px] mb-5">
                <div className="w-7 h-[1px] bg-[var(--ink4)]" />
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--ink4)]">orbit.house / {firstName.toLowerCase()} · espaço privado</span>
              </div>
              <h1 className="text-[clamp(52px,6vw,80px)] font-serif font-light leading-[1.04] tracking-[-0.02em] text-[var(--ink)] mb-4">
                Seu <br />
                <em className="italic text-[var(--gold)] font-normal">próximo imóvel</em> <br />
                <strong>está aqui.</strong>
              </h1>
              <p className="text-[16px] text-[var(--ink3)] font-light leading-[1.7] max-w-[460px]">
                Reuni casas que realmente fazem sentido para você — não um catálogo, uma curadoria feita com atenção.
              </p>
            </section>

            {/* INSIGHT BAR */}
            <section className="mx-[72px] mb-[56px] bg-[var(--cream)] border border-[var(--gold-bd)] rounded-[16px] p-[22px_28px] flex items-center gap-6 fu fu2">
              <div className="w-10 h-10 rounded-[10px] bg-[var(--gold-bg)] border border-[var(--gold-bd)] flex items-center justify-center text-lg shrink-0">
                ✦
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-[var(--ink)] mb-2">O que aprendi sobre o que você busca</p>
                <div className="flex flex-wrap gap-1.5">
                  {preferences?.preferred_property_type && <span className="px-3 py-0.5 rounded-full bg-[var(--gold-bg)] border border-[var(--gold-bd)] text-[var(--gold2)] text-xs font-medium">{preferences.preferred_property_type}</span>}
                  {preferences?.preferred_area && <span className="px-3 py-0.5 rounded-full bg-[var(--gold-bg)] border border-[var(--gold-bd)] text-[var(--gold2)] text-xs font-medium">{preferences.preferred_area}</span>}
                  {preferences?.preferred_features?.map((f: string) => (
                    <span key={f} className="px-3 py-0.5 rounded-full bg-[var(--gold-bg)] border border-[var(--gold-bd)] text-[var(--gold2)] text-xs font-medium">{f}</span>
                  ))}
                </div>
              </div>
            </section>

            {/* MAIN GRID */}
            <section className="px-[72px] pb-[72px]">
              <div className="flex items-baseline justify-between mb-8 pb-[18px] border-bottom border-[rgba(28,24,18,0.08)]">
                <h2 className="text-[30px] font-serif font-normal tracking-[-0.01em]">Casas que selecionei para você</h2>
                <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--ink4)]">curadas · não filtradas</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {items.map((item, idx) => (
                  <motion.div 
                    key={item.id}
                    className={`selection-card group fu fu${(idx % 4) + 1}`}
                    onClick={() => setSelectedItem(item)}
                  >
                    <div className="w-full overflow-hidden relative aspect-[4/3]">
                      {item.coverImage ? (
                        <img src={item.coverImage} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt={item.title} />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-[#e8ddd2] to-[#cfc3b0] flex items-center justify-center text-5xl">🏠</div>
                      )}
                      <div className="absolute top-3.5 left-3.5 px-2.5 py-1 rounded-full bg-white/90 backdrop-blur-md border border-[rgba(90,122,74,0.2)] flex items-center gap-1.5 font-mono text-[10px] font-medium text-[var(--match)]">
                        <div className="w-1 h-1 rounded-full bg-[var(--match)]" />
                        92% MATCH
                      </div>
                    </div>
                    
                    <div className="p-[20px_22px_22px]">
                      <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--gold)] mb-2 block">Curado para você</span>
                      <h3 className="text-[21px] font-serif font-normal leading-tight text-[var(--ink)] mb-2 group-hover:text-[var(--gold)] transition-colors">{item.title}</h3>
                      
                      <div className="flex flex-wrap gap-x-3 gap-y-1 mb-3 text-xs text-[var(--ink3)]">
                        <span className="border-r border-[var(--ink4)] pr-3 last:border-0">{item.location}</span>
                        <span className="border-r border-[var(--ink4)] pr-3 last:border-0">3 Suítes</span>
                        <span className="pr-3">420m²</span>
                      </div>

                      <div className="text-[24px] font-serif font-medium tracking-tight text-[var(--ink)] mb-4">
                        {formatPrice(item.price)}
                      </div>

                      {/* Insight / Note */}
                      {(item.note || item.recommendedReason) && (
                        <div className="mb-4 p-[12px_14px] bg-[rgba(255,248,235,0.8)] border border-[rgba(160,120,40,0.15)] border-l-[3px] border-l-[var(--gold2)] rounded-[0_8px_8px_0] text-[13px] text-[var(--ink2)] leading-[1.65] font-serif italic">
                          <strong className="block not-italic font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--gold)] mb-1.5 font-normal">Insight do Especialista</strong>
                          "{item.note || item.recommendedReason}"
                        </div>
                      )}

                      {/* Video */}
                      {item.videoUrl && (
                        <div className="mb-4 flex items-center gap-2 p-[9px_13px] bg-[rgba(28,24,18,0.04)] border border-[rgba(28,24,18,0.08)] rounded-lg hover:bg-[rgba(28,24,18,0.07)] transition-all cursor-pointer">
                          <div className="w-7 h-7 bg-[var(--ink)] rounded-full flex items-center justify-center shrink-0">
                            <div className="w-0 h-0 border-y-[5px] border-y-transparent border-l-[8px] border-l-white ml-0.5" />
                          </div>
                          <div className="text-left">
                            <p className="text-[13px] font-medium text-[var(--ink)]">Vídeo Exclusivo</p>
                            <span className="text-[11px] text-[var(--ink3)]">Assista o tour gravado</span>
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button className="flex-1 py-2.5 rounded-lg bg-[var(--ink)] text-[var(--paper)] text-xs font-medium hover:bg-[#2d2920] transition-all">Ver Detalhes</button>
                        <button className="px-3.5 py-2.5 rounded-lg border border-[rgba(28,24,18,0.12)] text-[var(--ink3)] hover:bg-[rgba(28,24,18,0.05)] transition-all"><Star size={18} /></button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </section>

            {/* COMPARISON PLACEHOLDER */}
            <section className="mx-[72px] mb-[72px] bg-white border border-[rgba(28,24,18,0.08)] rounded-[20px] overflow-hidden">
              <div className="p-[24px_28px] border-b border-[rgba(28,24,18,0.07)] flex items-baseline justify-between">
                <h3 className="text-[22px] font-serif font-normal text-[var(--ink)]">Destaques da Curadoria</h3>
                <span className="text-xs text-[var(--ink4)]">Comparativo técnico</span>
              </div>
              <div className="p-8 text-center text-[var(--ink4)] italic font-serif">
                Selecione um imóvel para ver o comparativo detalhado.
              </div>
            </section>
          </div>
        </main>

        <footer className="py-20 border-t border-[var(--selection-border)] opacity-30 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em]">Orbit house · Curadoria imobiliária privada</p>
        </footer>
      </div>
    </div>
  )
}
