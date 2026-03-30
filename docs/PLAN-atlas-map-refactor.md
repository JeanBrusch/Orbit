# PLAN: Refatoração Atlas — Tela Principal Imersiva

> **Slug:** `atlas-map-refactor`  
> **Data:** 2026-03-30  
> **Agentes:** `frontend-specialist` + `app-builder`  
> **Status:** AGUARDANDO APROVAÇÃO

---

## Sumário Executivo

Transformar o Atlas de um **gerenciador SaaS com grid de cards + sidebar** em uma **superfície operacional map-first** que funcione como tela principal do sistema de imóveis. O mapa é a base permanente, tudo flutua sobre ele.

---

## Diagnóstico: Estado Atual vs Visão do Prompt

### ❌ O que viola o prompt hoje

| Problema | Arquivo | Violação |
|----------|---------|----------|
| Grid de cards como estrutura principal | `app/atlas/page.tsx` L934 | "Reject card grids as primary structure" |
| Sidebar fixa de 320px (carrinho) | `app/atlas/page.tsx` L977 | "No sidebars" |
| Tabs de navegação (Curadoria/Selections) | `app/atlas/page.tsx` L798-813 | "No page navigation" |
| Mapa é modal secundário (`MapModal`) | `app/atlas/page.tsx` L1319 | "Map always full-screen, never blocked" |
| Layout parece SaaS dashboard | Estrutura geral | "Reject any UI that looks like a dashboard" |
| Não há dimensão de tempo nos markers | `MapAtlas.tsx` markers | "No time → static system" |
| Markers simples (ponto único) | `MapAtlas.tsx` L72-121 | "Two-layer marker: inner core + outer field" |
| Lead não influencia o mapa | Sem implementação | "Lead as Field — gravitational model" |
| Busca semântica abre resultados em lista | Inline input | "Search is reinterpretation layer, no results panel" |
| Drawer direito não existe como cognitive panel | Sidebar é carrinho | "Right Drawer = decision engine, 340px" |
| Sem modos de mapa (Inventory/Intent/Hybrid) | Sem implementação | "MAP MODES: never merge signals" |
| Mobile não prioriza iPhone 14 Pro | Layout responsivo genérico | "Primary target: iPhone 14 Pro" |

### ✅ O que já está alinhado

| Feature | Status |
|---------|--------|
| Mapbox integrado com dark/light/satellite | ✅ Funcional |
| Heatmap de interesse por bairro | ✅ Implementado em `atlas-map.tsx` |
| Busca semântica via API (`/api/atlas/search`) | ✅ Backend pronto |
| Match Engine (property → lead) | ✅ API funcional |
| Curadoria + envio para lead | ✅ Fluxo completo |
| Ingestão de imóveis (URL/Voice) | ✅ Pipeline completo |
| NeighborhoodInsightPanel | ✅ Bom componente |
| ZenOverlay no mapa | ✅ Overlay customizado |
| FlyTo em seleção | ✅ Implementado |

---

## Arquitetura Proposta

### Camadas Visuais (z-index hierarchy)

```
z[0]   MapAtlas — fullscreen, sempre interativo
z[5]   Grain texture overlay (cosmético)
z[10]  Markers (com decay + match field)
z[20]  Floating Top Bar (lead selector + search + modes)
z[25]  Property Popup (inline no mapa)
z[30]  Right Cognitive Drawer (340px, slide)
z[35]  Curation Tray (bottom, compacto)
z[40]  Semantic Search Overlay (command bar ⌘K)
z[50]  Modals (EditProperty, VoiceIngestion, etc)
```

### Layout Final

```
┌─────────────────────────────────────────────────────┐
│  [← ] ATLAS │ Lead ▼ │ ⌘K Search... │ INV/INT/HYB │ ☀ │
├─────────────────────────────────────────────────────┤
│                                                     │
│              M A P A   F U L L S C R E E N         │
│                                                     │
│    ●──ring──●                          ┌───────────┤
│         ● ●                            │ COGNITIVE │
│      ●            ●                    │  DRAWER   │
│   ●     ●            ●                │  340px    │
│         ●       ●                      │           │
│                                        │ Identity  │
│                                        │ Momentum  │
│                                        │ Indicators│
│                                        │ Prefs     │
│                                        │ Curation  │
│                                        └───────────┤
│  ┌ Curation Tray: 3 items ─────────────────────────┤
└─────────────────────────────────────────────────────┘
```

---

## Fases de Implementação

### FASE 1: Map-First Layout (Base)

> **Objetivo:** Eliminar grid/sidebar. Mapa fullscreen como base.

#### [REWRITE] `app/atlas/page.tsx`
- Remover grid de `PropertyCard`
- Remover sidebar de carrinho
- Remover tabs (Curadoria/Acervo/Selections)
- Mapa como `<MapAtlas>` fullscreen fixo (z-0)
- Floating Top Bar (z-20) com: back, logo, lead selector, ⌘K hint, mode toggle, theme toggle
- Manter modais existentes (EditProperty, VoiceIngestion, MapModal→remover, Ingest)

#### [MODIFY] `components/atlas/MapAtlas.tsx`
- Receber novo prop `mapMode: 'inventory' | 'intent' | 'hybrid'`
- Receber `activeLead` com preferências para influência gravitacional
- Implementar `onPropertyClick` → abre popup flutuante inline (não drawer)

**Estimativa:** ~800 linhas refatoradas

---

### FASE 2: Marker System 2.0 (Inner Core + Outer Field)

> **Objetivo:** Markers expressam realidade (status) + interpretação (match).

#### [REWRITE] `PropertyMarker` em `MapAtlas.tsx`

**Anatomia SVG 52×52px:**
- **Inner Core** (16px): cor fixa por status
  - Disponível: `#C9A84C` (Gold)
  - Reservado: `#E8A030` (Amber)
  - Vendido: `#52524F` (Zinc)
- **Outer Field** (ring variável): responde ao lead ativo
  - Score ≥ 80: raio 22px, opacity 0.9, stroke 1.5px Gold
  - Score 50–79: raio 18px, opacity 0.55, stroke 1px Gold/40
  - Score < 50: colapsado (raio 0)
  - Sem lead: raio 14px, opacity 0.25, stroke 0.5px Zinc
- Ring anima via `stroke-dasharray 0 → circunferência` (400ms) ao trocar lead

**Tamanho por match (lead ativo):**
- High: 52px · Mid: 42px · Low: 32px · transition 300ms

**Estimativa:** ~200 linhas novo componente

---

### FASE 3: Dimensão Temporal (Decay + Urgency)

> **Objetivo:** O tempo cria urgência visual sem texto.

#### [NEW] Hook `usePropertyDecay`
- Cada imóvel: `lastInteractionAt` timestamp
- `ageDays = (now - lastInteractionAt) / 86400000`
- CSS var `--decay: clamp(0, ageDays / 14, 1)`

**Efeitos visuais:**
- `opacity: 1.0 → 0.55`
- `scale: 1.0 → 0.82`
- `ring-opacity: 1.0 → 0.3`

**Urgency:**
- Condição: matchScore ≥ 75 AND ageDays ≥ 7
- `animation: urgency-pulse 1.8s ease-in-out infinite alternate`
- Ring: Gold → `#9A6B1A`

**Momentum Glow:**
- Lead visitou bairro nas últimas 48h
- `radial-gradient(Gold 0%, transparent 70%)`, opacity: 0.06

> ⚠️ SEM ícones de relógio. SEM badge "Urgente". SEM tooltip de data.

**Estimativa:** ~150 linhas

---

### FASE 4: Property Popup (Map-Inline)

> **Objetivo:** Popup responde a "vale enviar?" — não é detail page.

#### [NEW] `components/atlas/PropertyPopup.tsx`

**Conteúdo:**
- Carousel de imagens (compacto)
- Título + micro-localização
- Specs essenciais (área, dorms, suítes, valor)
- Match score ring (se lead ativo)
- **Ação primária:** "Adicionar à curadoria" (1 clique)
- **Ação secundária:** "Ver detalhes" → abre EditPropertyModal

**Comportamento:**
- Posicionado relativo ao marker no mapa
- AnimatePresence com slide + scale
- Fecha com Esc ou clique no mapa

**Estimativa:** ~250 linhas

---

### FASE 5: Cognitive Drawer (Right Panel)

> **Objetivo:** Contexto do lead ativo, não detalhes de imóvel.

#### [NEW] `components/atlas/CognitiveDrawer.tsx` (340px, direita)

**Seções:**
1. **Identidade:** Nome, foto, stage
2. **Momentum Quote:** Última frase em itálico, serif, label "Última captura"
3. **Indicadores Cognitivos** (bloco compacto, máx 80px):
   - INTEREST → linha 2px Gold, largura = valor%
   - MOMENTUM → 3 dots ● ● ○ preenchidos em terços
   - CLARITY → 4 squares preenchidos proporcionalmente
   - RISK → cor variável: Zinc → Âmbar → Coral (#D85A30)
4. **Preferências:** Budget, localização, features
5. **Curation Tray:** Imóveis selecionados para envio

**Comportamento:**
- Slide-in da direita
- Abre quando lead é selecionado no Top Bar
- Fecha com Esc ou click no X

**Estimativa:** ~350 linhas

---

### FASE 6: Busca Semântica (Reinterpretação Espacial)

> **Objetivo:** Busca reinterpreta o mapa, não lista resultados.

#### [NEW] `components/atlas/SemanticSearch.tsx`

**Estados:**
1. **IDLE:** hint ⌘K no top bar
2. **INPUT:** command bar glassmorphism 560px, overlay `rgba(0,0,0,0.32)` sobre mapa
3. **BUSCANDO:** `.atlas-searching`: todos markers opacity 0.25 + mapa brightness(0.7)
4. **RESULTADO:** 
   - Matches: opacity 1.0 + ring pulsa 1x
   - Non-matches: opacity 0.15, scale 0.75
   - Máx 3 snippets inline: thumbnail 40px + título + razão semântica (1 linha)
   - Clique → flyTo no marker
5. **FECHAR (Esc):** markers voltam com transition-delay escalonado (30ms por marker) — "o mapa respirando de volta"

**Estimativa:** ~300 linhas

---

### FASE 7: Map Modes (Inventory / Intent / Hybrid)

> **Objetivo:** Três leituras independentes que nunca se fundem.

#### Implementação no `MapAtlas`

| Modo | Comportamento |
|------|--------------|
| **INVENTORY** | Pura oferta. Sem influência de lead. Markers uniformes. |
| **INTENT** | Reordenado por match. Irrelevante fade. Lead como campo gravitacional. |
| **HYBRID** (default) | Base = inventory. Camada externa = match ring. Dois sinais coexistem sem fundir. |

**Lead as Field (modo Intent):**
- High match → puxado visualmente para frente (scale up, opacity up)
- Low match → empurrado para trás (scale down, opacity down)
- Inspirado em modelo gravitacional

**Estimativa:** ~200 linhas

---

### FASE 8: Mobile (iPhone 14 Pro Priority)

> **Objetivo:** Sentir nativo, não desktop comprimido.

#### Adaptações:
- Drawer → **bottom sheet** (snap points: 30% / 60% / 90%)
- Top bar → compacto, icon-first
- Gestos do mapa SEMPRE preservados (pinch, pan, rotate)
- Safe areas (Dynamic Island, gesture bar)
- Thumb reach optimization (ações primárias nas zonas inferiores)
- Lazy load imagens e popups
- 60fps garantido

**Estimativa:** ~400 linhas de ajuste

---

## Componentes que SOBREVIVEM (sem alteração significativa)

| Componente | Razão |
|-----------|-------|
| `AdvancedFilters.tsx` | Reutilizar dentro do Top Bar como popover |
| `EditPropertyModal.tsx` | Continua como modal de detalhe/edição |
| `VoiceIngestion.tsx` | Continua como modal de ingestion |
| `NeighborhoodInsightPanel.tsx` | Continua como panel lateral (heatmap) |
| `PropertyCarousel.tsx` | Reutilizar no popup inline |
| `PropertyTimeline.tsx` | Reutilizar dentro do Cognitive Drawer |
| `ZenOverlay.tsx` | Ground overlay no mapa |
| `ClientSpacesManager.tsx` | Pode ser acessado via modal |

## Componentes que MORREM

| Componente | Razão |
|-----------|-------|
| `PropertyCard` (inline) | Grid de cards eliminado |
| `MapModal` | Mapa JÁ É fullscreen |
| `SelectionsHistory` (inline) | Movido para rota separada ou modal |
| Sidebar de carrinho | Substituída por Curation Tray + Cognitive Drawer |
| Tabs de navegação | Eliminadas — tudo é mapa |

---

## Componentes NOVOS

| Componente | Responsabilidade |
|-----------|-----------------|
| `PropertyPopup.tsx` | Popup inline no mapa |
| `CognitiveDrawer.tsx` | Painel cognitivo do lead (340px direita) |
| `SemanticSearch.tsx` | Command bar ⌘K + reinterpretação espacial |
| `CurationTray.tsx` | Barra inferior com imóveis selecionados |
| `AtlasTopBar.tsx` | Top bar flutuante (lead, search, modes) |
| `usePropertyDecay.ts` | Hook para decaimento temporal |
| `MarkerSystem.tsx` | Sistema de markers SVG com inner core + outer field |

---

## Design Tokens Alinhados ao Prompt

```css
/* DARK (default — operational mode) */
--atlas-bg: #0A0A0F;
--atlas-surface: #12121A;
--atlas-accent: #C9A84C;
--atlas-accent-dim: #9A6B1A;

/* LIGHT (analysis mode) */
--atlas-bg-light: #F7F7F9;
--atlas-surface-light: #FFFFFF;
--atlas-border-light: rgba(0,0,0,0.08);
/* Same gold accent */

/* Cognitive Indicators */
--risk-low: var(--zinc-500);
--risk-mid: #E8A030;
--risk-high: #D85A30;
```

---

## Verificação (Pós-implementação)

### Checklist Funcional
- [ ] Mapa fullscreen como base — sem layout shift
- [ ] Markers com 2 camadas (inner core + outer field)
- [ ] Decay visual sem texto
- [ ] Troca de lead anima rings dos markers
- [ ] ⌘K abre busca, mapa reage visualmente
- [ ] Popup inline responde "vale enviar?"
- [ ] Cognitive Drawer mostra contexto do lead
- [ ] 3 modos de mapa funcionais
- [ ] Mobile fluido no iPhone 14 Pro
- [ ] Todo texto user-facing em pt-BR
- [ ] Performance: 60fps em scroll e pan do mapa

### Rejection Checklist (do prompt)
- [ ] NÃO parece dashboard
- [ ] NÃO tem sidebars fixas
- [ ] NÃO usa card grids como estrutura principal
- [ ] NÃO tem navegação por páginas
- [ ] NÃO quebra dominância do mapa
- [ ] NÃO usa styling default de componentes

---

## Questões para o Usuário

> [!IMPORTANT]
> **1. SelectionsHistory (Intelligence Hub):** Esse conteúdo deve virar uma rota separada (`/atlas/selections`) ou um modal acessível pelo Top Bar?

> [!IMPORTANT]  
> **2. Ingestão via URL:** Manter o modal atual ou migrar para um floating panel mais integrado ao mapa?

> [!IMPORTANT]
> **3. Heatmap:** O toggle de heatmap deve ficar no Top Bar ou no canto inferior do mapa como hoje?

> [!IMPORTANT]
> **4. Ordem de prioridade:** Quer que eu implemente por fase (1→8) ou priorize alguma fase específica?

---

## Estimativa Total

| Fase | Linhas Estimadas | Complexidade |
|------|-----------------|-------------|
| 1. Map-First Layout | ~800 | 🔴 Alta |
| 2. Marker System 2.0 | ~200 | 🟡 Média |
| 3. Dimensão Temporal | ~150 | 🟢 Baixa |
| 4. Property Popup | ~250 | 🟡 Média |
| 5. Cognitive Drawer | ~350 | 🟡 Média |
| 6. Busca Semântica | ~300 | 🟡 Média |
| 7. Map Modes | ~200 | 🟡 Média |
| 8. Mobile | ~400 | 🔴 Alta |
| **TOTAL** | **~2650** | |
