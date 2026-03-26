# PLAN: Reengajamento de Leads Frios

Este plano detalha a criação de uma funcionalidade para reativar leads que nunca interagiram, utilizando cálculos matemáticos determinísticos (sem IA) para score e similaridade, com integração à base Atlas.

## User Review Required

> [!IMPORTANT]
> **Isolamento Orbit:** Precisamos confirmar se o "não se contaminar" envolve apenas a camada de dados ou se o sistema de envio de mensagens deve usar uma API de WhatsApp/Email distinta da principal.
> **Cálculo de Score:** O score será baseado em regras fixas (Recência x Atributos). Favor validar os pesos iniciais sugeridos na Fase 1.

## Proposed Changes

### 1. Camada de Dados Isolada (Supabase)
- **Nova Tabela `cold_leads`:** Criar uma tabela separada para evitar que os disparos automáticos e as funções de análise (Orbit Core) sejam ativados, economizando custos de IA.
    - Campos: `id`, `name`, `phone`, `accessed_property_id`, `score`, `status`.
- **Sem Triggers:** Esta tabela não terá triggers de análise automática.

### 2. Motor de Similaridade (Non-AI)
- **Utilitário `lib/cold-lead-logic.ts`:**
    - Função que busca o imóvel de referência na tabela `properties`.
    - Filtro determinístico: Bairro igual (+50 pts) + Mesma faixa de preço +/- 15% (+30 pts) + Mesmo nº de quartos (+20 pts).
    - Retorna o TOP 3 de imóveis similares "frios" para compor a mensagem.

### 3. Interface de Operação (Frontend)
#### [NEW] `app/reengagement/page.tsx`
- **Upload:** Área para subir CSV (Nome, Telefone, ID Imóvel).
- **Lista de Atendimento:** Exibição dos leads com o score calculado e os imóveis sugeridos.
- **Botão WhatsApp:** Gera um link `wa.me` com a mensagem pré-formatada. 
    - O GPT será chamado *apenas* no momento do clique (ou carga da lista) para dar o "tom" natural à mensagem, sem análise profunda de contexto.

### 4. Fluxo de Envio Manual
- O operador verá uma lista de ~10 leads por turno.
- Ao clicar, o sistema gera a mensagem via API dedicada (custo mínimo) e abre o WhatsApp Desktop/Web.

## Verification Plan

### Automated Tests
- Testar o cálculo de similaridade com mocks de imóveis (Garantir que bairro > preço na pontuação).
- Validar se o link de WhatsApp está sendo gerado com o DDI (+55) correto.

### Manual Verification
1. Subir CSV com 10 leads.
2. Confirmar que os leads NÃO aparecem no LeadController principal do Orbit.
3. Validar se os imóveis sugeridos são de fato similares aos acessados originalmente.
