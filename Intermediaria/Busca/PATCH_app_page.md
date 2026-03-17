## Patch: app/page.tsx

### Problema 1 — O Orbit View fecha automaticamente após 5 segundos

Localizar e REMOVER o `setTimeout` que retorna o estado para idle após busca:

```tsx
// REMOVER este bloco inteiro:
setTimeout(() => {
  setCoreState("idle");
  setCoreMessage("Campo Cognitivo Ativo");
}, 5000);
```

Substituir `handleQuerySubmit` por:

```tsx
const handleQuerySubmit = useCallback(
  async (query: string) => {
    setCoreState("processing");
    setCoreMessage("Analisando...");

    try {
      const resultsCount = await activateOrbitView(query);
      setCoreState("responding");

      if (resultsCount > 0) {
        setCoreMessage(
          `${resultsCount} lead${resultsCount > 1 ? "s" : ""} encontrado${resultsCount > 1 ? "s" : ""}`,
        );
      } else {
        setCoreMessage("Nenhum resultado");
      }

      // ← SEM setTimeout aqui. O modo fica ativo até o operador fechar.
      // O OrbitCore volta para idle visualmente mas o CopilotoPanel permanece.
      setTimeout(() => {
        setCoreState("idle");
        setCoreMessage("Campo Cognitivo Ativo");
      }, 2000); // apenas animação de resposta, não fecha o painel

    } catch (err) {
      console.error("Cognitive search error:", err);
      setCoreState("idle");
      setCoreMessage("Erro na busca cognitiva");
    }
  },
  [activateOrbitView],
);
```

---

### Problema 2 — handleCoreCancel não fecha o CopilotoPanel

Localizar:

```tsx
const handleCoreCancel = useCallback(() => {
  setCoreState("idle");
  setCoreMessage("Campo Cognitivo Ativo");
  setHighlightedLeads([]);
}, []);
```

Substituir por:

```tsx
const handleCoreCancel = useCallback(() => {
  setCoreState("idle");
  setCoreMessage("Campo Cognitivo Ativo");
  setHighlightedLeads([]);
  deactivateOrbitView(); // ← fecha o painel de resultados
}, [deactivateOrbitView]);
```

E garantir que `deactivateOrbitView` está desestruturado do context:

```tsx
const { ..., activateOrbitView, deactivateOrbitView } = useOrbitContext();
```

---

### Problema 3 — CopilotoPanel não está sendo renderizado no app/page.tsx

Adicionar import:

```tsx
import { CopilotoPanel } from "@/components/copiloto-panel";
```

Adicionar no JSX, antes do fechamento do `<div>` principal, após o TopBar:

```tsx
{/* ── Copiloto: resultados da busca cognitiva (persistente) ── */}
<CopilotoPanel />
```

Nota: O `CopilotoPanel` usa `position: fixed right-0`, então não precisa estar em nenhuma camada específica do z-index — ele se posiciona sozinho acima de tudo.
