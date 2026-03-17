## Alterações a aplicar em `components/lead-cognitive-console.tsx`

### 1. Adicionar import no topo do arquivo (junto aos outros imports)

Logo abaixo da linha que importa `useOrbitContext`, adicionar:

```tsx
import { OrbitSelectionPanel } from "@/components/orbit-selection-panel";
```

---

### 2. Adicionar o bloco no RIGHT PANEL, após o bloco "Histórico de Imóveis"

Localizar este trecho (fim do bloco Histórico de Imóveis dentro do RIGHT PANEL):

```tsx
                {/* Histórico de Imóveis */}
                <div className={`${glass} rounded-xl p-5 flex-1`}>
                  <div className="flex items-center gap-2 mb-4">
                    <Building2 className="w-4 h-4 text-[#d4af35]" />
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-300">Imóveis Interagidos</h3>
                  </div>

                  {interactions.length === 0 ? (
                    <p className="text-xs text-slate-600 italic">Nenhum imóvel enviado ou interagido.</p>
                  ) : (
                    <div className="space-y-2">
                      {interactions.map(i => <PropertyCard key={i.id} interaction={i} />)}
                    </div>
                  )}
                </div>
              </aside>
```

Substituir por:

```tsx
                {/* Histórico de Imóveis */}
                <div className={`${glass} rounded-xl p-5 flex-1`}>
                  <div className="flex items-center gap-2 mb-4">
                    <Building2 className="w-4 h-4 text-[#d4af35]" />
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-300">Imóveis Interagidos</h3>
                  </div>

                  {interactions.length === 0 ? (
                    <p className="text-xs text-slate-600 italic">Nenhum imóvel enviado ou interagido.</p>
                  ) : (
                    <div className="space-y-2">
                      {interactions.map(i => <PropertyCard key={i.id} interaction={i} />)}
                    </div>
                  )}
                </div>

                {/* Orbit Selection — portal do cliente */}
                {leadId && <OrbitSelectionPanel leadId={leadId} />}

              </aside>
```
