# PLAN: Auditoria de Inteligência e Profundidade (Atlas)

Este plano visa responder à preocupação do usuário sobre a possível "genericidade" do sistema e a falta de profundidade/buscas reais.

## 🎯 Objetivos
1.  **Auditoria de Veracidade**: Confirmar se os "Insights Cognitivos" e "Buscas de Imóveis" são baseados em dados reais e processamento dinâmico.
2.  **Identificação de Falhas**: Localizar pontos onde o sistema pode estar falhando em realizar buscas (thresholds muito altos, termos de busca vazios, etc.).
3.  **Aprimoramento de Profundidade**: Refinar o motor cognitivo para que as sugestões sejam ainda mais específicas e menos "padrão".
4.  **Verificação de Conectividade**: Validar se o "Atlas Neural Network Linked" reflete o estado real da sincronização de dados.

---

## 🛠️ Fase 1: Auditoria Técnica (Explorer & Backend Specialist)
- [ ] **Mapeamento de Fluxo**: Traçar o caminho exato desde a entrada de uma mensagem até a geração do insight na tabela `ai_insights`.
- [ ] **Auditoria de Dados**: Executar scripts para verificar a qualidade das memórias e insights gerados para leads reais (ex: Mauricio).
- [ ] **Teste de Ressonância**: Validar a função `match_properties` (RPC) com diferentes embeddings para garantir que ela retorna imóveis pertinentes.
- [ ] **Análise de Threshold**: Verificar se o threshold de 0.5 no RAG é muito restritivo, causando a percepção de que "não realiza busca".

## 🏗️ Fase 2: Refinamento de Lógica (Backend Specialist)
- [ ] **Aprimoramento do Prompt**: Revisar o prompt do `orbit-core.ts` para exigir conexões explícitas entre memórias e sugestões.
- [ ] **Injeção de Contexto**: Garantir que as notas internas dos imóveis (que já estão no código) sejam usadas de forma mais agressiva na tomada de decisão.
- [ ] **Feedback Loop**: Implementar uma forma de validar se a "Próxima ação" sugerida foi realmente eficaz.

## 🧪 Fase 3: Validação e Testes (Test Engineer)
- [ ] **Simulação de Lead**: Criar um script que simule um lead com preferências específicas e valide se o insight gerado é único para ele.
- [ ] **Stress Test de Busca**: Testar a busca semântica com variações de linguagem (gírias, erros de digitação) para ver a resiliência.
- [ ] **Checklist de Qualidade**: Rodar `vulnerability_scanner` e `lint_runner`.

---

## 📅 Cronograma
1. **Dia 1**: Auditoria e diagnóstico (Scripts de extração de dados).
2. **Dia 2**: Ajustes no motor cognitivo e prompts.
3. **Dia 3**: Testes de validação e entrega do relatório final.

---

## 🎼 Orquestração de Agentes
- **Explorer Agent**: Mapeamento inicial (OK).
- **Backend Specialist**: Análise da lógica do Orbit Core e RPCs.
- **Test Engineer**: Criação de testes de "sanity check" para os insights.

---

**Você aprova este plano para prosseguirmos com a auditoria profunda? (Y/N)**
