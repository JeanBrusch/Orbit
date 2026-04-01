# PLANO: Reengajamento Profundo (Doutor Orbit) - Versão Governança

## 🎯 Objetivo
Transformar o Analisador de Silêncio em uma ferramenta de diagnóstico clínico, protegida por uma camada de **Governança de Dados** que evita análises superficiais em leads sem contexto (leads "vazios").

---

## 🛠️ Fase 1: Inteligência & Governança (Backend)

### 1.1. O "Gatekeeper" (Pré-análise Matemática)
Antes de qualquer chamada de IA, o sistema executará uma análise de densidade de sinal:
- **Sinal de Texto**: Mínimo de 2 mensagens do Lead (total > 50 chars).
- **Sinal de Interesse**: Mínimo de 1 clique em imóvel (`property_interactions`).
- **Sinal Cognitivo**: Mínimo de 1 memória com confiança > 0.7.
- **Resultado**: Se a pontuação (densidade) for baixa, o lead é marcado como "Sinal Insuficiente" no dashboard e a IA **não é invocada** (Economia de Tokens & Governança).

### 1.2. Fluxo em Camadas (Tiered Analysis)
- **Camada 1 (GPT-4o-mini)**: Validação de Qualidade. A IA mini verifica se os dados disponíveis permitem uma análise profunda. Ela detecta o `target_tone` e resume os pontos-chave.
- **Camada 2 (GPT-4o)**: Diagnóstico Clínico. Apenas se a Camada 1 confirmar que há "carne no osso", o modelo superior entra para identificar o **Conflito Central** e o **Plano de Intervenção**.

### 1.3. Geração de Mensagem Irrebatível (Mirroring)
- Aplicar espelhamento de tom baseado na Camada 1.
- Criar o **Utility Hook**: Baseado nos cliques reais capturados no Gatekeeper.

---

## 🎨 Fase 2: Interface de Diagnóstico (Frontend)

### 2.1. Visualização de Governança
- Mostrar no dashboard por que um lead não foi analisado automaticamente (ex: "Contexto Insuficiente").
- Indicar qual modelo foi usado no diagnóstico (Mini vs 4o).

### 2.2. Dossiê Clínico Atualizado
- Mostrar "Dissonância Cognitiva" identificada e o "Probability of Reconnection" (%).

---

## ✅ Fase 3: Validação & Segurança
- Reativar os endpoints com o Gatekeeper ativo.
- Criar log de governança para auditar leads ignorados pela pré-análise.
- Validar se o espelhamento de tom não soa artificial (Over-mirroring).

---

## 📅 Cronograma Atualizado
1.  [ ] Implementar Helper de Densidade de Dados (Gatekeeper)
2.  [ ] Atualizar Endpoints para Tiered Analysis (Mini -> 4o)
3.  [ ] Integrar `property_interactions` no Prompt
4.  [ ] Atualizar UI com status de Governança
5.  [ ] Testes Finais e Documentação
