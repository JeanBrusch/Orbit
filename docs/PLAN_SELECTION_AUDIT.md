# Auditoria de Rastreabilidade Operacional: Lead Portal & Selection Control

Este plano tem como objetivo garantir que toda a interatividade do cliente no **Portal do Lead** seja capturada, processada e refletida corretamente no terminal de **Controle de Selection** (Hub de Seleção) do gestor no Atlas, removendo mocks e garantindo integridade de dados reais.

## 📋 Objetivos
1.  **Rastrear Reações**: Garantir que favoritos, descartes e visualizações do lead sejam persistidos e exibidos para o gestor.
2.  **Consolidar Métricas**: Processar "Tempo de Foco", "Score de Calor" e "Interesse Real" via dados agregados do Supabase.
3.  **Auditar Fluxo de Curadoria**: Validar que os imóveis enviados e os insights do especialista cheguem ao portal sem perdas.

---

## 🛠️ Equipe de Agentes
-   **`@project-planner`**: Gestão do cronograma e auditoria de metas.
-   **`@backend-specialist`**: Refatoração das APIs `selection-dashboard` e `property-interactions`.
-   **`@frontend-specialist`**: Atualização do `ClientSpacesManager` e `ClientSelectionViewV2` para interatividade real.
-   **`@test-engineer`**: Script de verificação de fluxo ponta-a-ponta (E2E).

---

## 🚀 Fase 1: Inteligência e Dados (Backend)
-   **Tarefa 1.1**: Atualizar `app/api/selection-dashboard/route.ts` para calcular métricas de engajamento baseadas nas interações totais do lead.
-   **Tarefa 1.2**: Garantir persistência de metadados em `property_interactions` (scroll, cliques específicos).

## 🎨 Fase 2: Experiência e Interatividade (Frontend)
-   **Tarefa 2.1**: Em `ClientSpacesManager.tsx`, as métricas de "Inteligência" (aba 1) devem refletir os cálculos reais da API.
-   **Tarefa 2.2**: Validar que o `ClientSelectionViewV2.tsx` envia corretamente o payload de `session_end` ao fechar a aba.
-   **Tarefa 2.3**: Unificar a nomenclatura de interações (`liked` vs `favorited`, `disliked` vs `discarded`) entre banco e UI.

## ✅ Fase 3: Verificação Técnica
-   **Tarefa 3.1**: Auditoria de "Traceability": Se o lead clica, o gestor vê.
-   **Tarefa 3.2**: Teste de integridade de slugs de acesso.

---

**✅ Plano Criado: `/Users/jeanbrusch/Orbit Antigravity/docs/PLAN_SELECTION_AUDIT.md`**

**Você aprova este plano para começarmos a implementação? (Y/N)**
