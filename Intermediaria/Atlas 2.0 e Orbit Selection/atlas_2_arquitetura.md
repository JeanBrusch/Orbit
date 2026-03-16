# Atlas 2.0 — Arquitetura

## 1. Camadas do Sistema

O Atlas 2.0 deve funcionar como o motor imobiliário do ecossistema Orbit. Para isso, a arquitetura precisa ser dividida em três camadas principais:

1. Camada Operacional
2. Camada Cognitiva
3. Camada de Experiência do Cliente

---

## 2. Camada Operacional (Atlas Interno)

É a área usada pelo operador/corretor.

Responsabilidades:

- cadastro de imóveis
- gestão de imagens e mídia
- filtros e busca
- visualização no mapa
- conexão com leads

Componentes:

### Cadastro Inteligente

O operador pode cadastrar imóveis de três formas:

1. manual
2. importação de link
3. ditado por voz no local do imóvel

Fluxo por voz:

O corretor descreve:

"Casa no condomínio Atlântico, lote 14, quadra C. Três dormitórios, duas suítes, 220 metros de área construída. Valor um milhão e duzentos."

A IA interpreta e preenche:

- condomínio
- quadra
- lote
- dormitórios
- suítes
- área
- valor

O operador apenas confirma e adiciona imagens.

---

### Visualização de Mercado

Mapa Mapbox permanece como visualização principal.

Camadas de visualização:

- pins de imóveis
- clusters por região
- heatmap de oportunidades
- imóveis com maior interesse

Filtros principais:

- bairro
- condomínio
- faixa de preço
- dormitórios
- área
- status

---

### Linha do Tempo do Imóvel

Cada imóvel possui histórico:

- data de cadastro
- alterações de valor
- visitas
- propostas
- interações com clientes

---

## 3. Camada Cognitiva (Integração com Orbit)

O Atlas não deve ser apenas um banco de imóveis.

Ele deve se conectar ao estado mental dos leads.

Funções:

- sugerir imóveis compatíveis com leads
- detectar imóveis com maior probabilidade de fechamento
- priorizar oportunidades

Exemplo:

Ao abrir um imóvel:

Sistema mostra:

Leads compatíveis

Ana Ribeiro — compatibilidade 0.87
Carlos Mendes — compatibilidade 0.81
Mariana Duarte — compatibilidade 0.74

---

## 4. Camada de Experiência do Cliente (Portal)

Cada cliente possui um espaço privado.

Nome sugerido:

Orbit Selection

Função:

Apresentar imóveis de forma curada.

Não é um portal público.

É uma coleção personalizada.

---

### Estrutura do Espaço do Cliente

Cada cliente possui:

- perfil
- preferências
- imóveis enviados
- favoritos
- histórico de interações

---

### Conteúdo Personalizado por Imóvel

Para cada imóvel enviado ao cliente é possível adicionar:

- nota privada
- vídeo personalizado
- áudio explicativo
- observações estratégicas

Esse conteúdo é visível apenas para aquele cliente.

---

### Integração com WhatsApp

Cada imóvel possui ação direta:

"Conversar sobre este imóvel"

Isso abre o WhatsApp com mensagem automática.

A interação retorna ao Orbit e atualiza o estado cognitivo do lead.

---

## 5. Estrutura Técnica

Frontend:

- Next.js

Mapa:

- Mapbox GL

Banco de dados:

- Supabase

Storage de mídia:

- Supabase Storage ou Cloudflare R2

---

## 6. Estrutura de Banco

Tabelas principais:

properties
property_images
property_history

client_spaces
client_property_links
client_notes
client_media

property_lead_matches

---

## 7. Fluxo de Envio de Imóvel ao Cliente

No Atlas:

Selecionar imóvel

→ Enviar para cliente

Selecionar cliente

Adicionar:

- nota
- vídeo
- destaque

Publicar no portal.

O cliente recebe link privado.

---

## 8. Resultado Final

Atlas passa a ser:

- gestão de imóveis
- radar de oportunidades
- motor de recomendação
- alimentador de portais privados de clientes

Isso transforma o Orbit em um sistema operacional imobiliário.

