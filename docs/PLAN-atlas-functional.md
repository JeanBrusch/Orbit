# PLAN-atlas-functional.md

## 🎯 Objetivo
Transformar a interface visual do Atlas em uma ferramenta operacional funcional, onde as interações do usuário (seleção de leads, modos de mapa e botões de ação) gerem mudanças reais no estado do sistema e na base de dados.

---

## 🏗️ Arquitetura de Solução (Modelo Matchmaker)

### 1. Camada de Dados (Supabase)
- **Tabela `orbit_selections`**: Utilizada para o botão "Acervo" (curadoria). Deve salvar a relação `lead_id` + `property_id`.
- **Tabela `orbit_interactions`**: Utilizada para o botão "Propor". Deve registrar o envio de uma proposta.

### 2. Camada de UI (React/Next.js)
- **AtlasTopBar**: Responsável por gerenciar o `mapMode` e o `activeLead`.
- **MapAtlas**: Consumir o `mapMode` para filtrar a visibilidade dos marcadores e ajustar dinamicamente a escala/opacidade com base no `matchScore`.
- **CognitiveDrawer**: Acionar as funções de salvamento e abertura de ficha do lead.

---

## 🛠️ Detalhamento das Fases

### Fase 1: Filtros de Visualização (Map Modes)
- [ ] **MapAtlas**: Implementar lógica de filtragem real no `mappedProperties`.
    - No modo **"Intenção"**, ocultar imóveis com `matchScore < 40%`.
    - No modo **"Realidade"**, mostrar todos os imóveis como ícones uniformes (desativar match-glow).
- [ ] **AtlasTopBar**: Garantir que a troca de modo force a re-renderização suave dos marcadores.

### Fase 2: Ações do CognitiveDrawer (Intel Ops)
- [ ] **Botão "Acervo"**: 
    - Implementar chamada à API para salvar na tabela `orbit_selections`.
    - Adicionar feedback visual (toast) de sucesso.
- [ ] **Botão "Propor"**:
    - Gerar um link de proposta ou WhatsApp com texto pré-definido.
    - Registrar uma interação do tipo "sent" no histórico do lead.
- [ ] **Botão "Ver Ficha"**:
    - Conectar com `LeadCognitiveConsole` para abrir o perfil denso do lead.

### Fase 3: Inteligência de Contexto (Lead Dynamic)
- [ ] **Auto-Match**: Garantir que, ao selecionar um lead no TopBar, o `computeMatch` seja disparado para todos os imóveis visíveis no mapa.

---

## 👥 Atribuição de Agentes (Orchestration)

| Agente | Tarefa |
|--------|--------|
| `backend-specialist` | Criar/ajustar rotas de API para `orbit_selections` e registros de interação. |
| `frontend-specialist` | Implementar a lógica de filtragem no `MapAtlas` e handlers no `CognitiveDrawer`. |
| `database-architect` | Verificar integridade das tabelas de match e seleções no Supabase. |
| `test-engineer` | Validar fluxos de persistência de dados e responsividade do mapa. |

---

## ✅ Critérios de Aceite
1. O mapa reage à troca entre "Realidade" e "Intenção".
2. Clicar em "Acervo" persiste o imóvel no DB.
3. Clicar em "Ver Ficha" abre o console cognitivo sem erros.
4. O score de match é recalculado ao trocar o lead ativo.

---

## 🚀 Próximos Passos
1. Execute `@[/orchestrate]` para iniciar a implementação paralela.
