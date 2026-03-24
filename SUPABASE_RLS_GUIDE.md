# Resolvendo Problemas de RLS (Supabase) – Orbit Selection

Este guia documenta como diagnosticar e corrigir problemas de imóveis que não aparecem no portal público (Selection), mesmo quando o banco de dados contém os dados.

## 1. Sintomas Comuns
- O **Hub Interno** mostra os imóveis (pois usa permissões de Admin/Service Role).
- O **Link do Cliente** mostra "0 Imóveis Disponíveis" ou uma lista vazia.
- No console do navegador (se o Supabase estiver sendo usado no client-side), não há erros, apenas um array vazio `[]`.

## 2. Diagnóstico RLS (Row Level Security)

Se os dados existem no banco mas não aparecem para o cliente anônimo (anon), o problema é quase sempre o **RLS**.

### Verificar se o RLS está ativo:
Execute no SQL Editor do Supabase:
```sql
SELECT relname, relrowsecurity 
FROM pg_class 
WHERE relname IN ('property_interactions', 'properties', 'client_spaces');
```
*Se `relrowsecurity` for `true`, o RLS está ativo e bloqueando acessos sem política explícita.*

### Verificar Políticas Atuais:
```sql
SELECT tablename, policyname, roles, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public';
```

## 3. Solução: Aplicar Políticas de Leitura Pública

Para que o portal de seleção funcione para clientes que não fizeram login, as tabelas abaixo **devem** ter uma política de `SELECT` para a role `public` (ou `anon`).

### Comando de Correção Rápida:
```sql
-- 1. Habilitar RLS (caso esteja desativado ou inconsistente)
ALTER TABLE public.property_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_spaces ENABLE ROW LEVEL SECURITY;

-- 2. Criar Política de Leitura Pública (Exemplo para Interações)
DROP POLICY IF EXISTS "Public can read sent property_interactions" ON public.property_interactions;
CREATE POLICY "Public can read sent property_interactions" ON public.property_interactions 
FOR SELECT USING (true); -- Permitir leitura de todas as linhas (filtragem feita no código via lead_id)

-- 3. Fazer o mesmo para Propriedades e Espaços
CREATE POLICY "Public can read properties" ON public.properties FOR SELECT USING (true);
CREATE POLICY "Public can read client_spaces" ON public.client_spaces FOR SELECT USING (true);
```

## 4. Pitfall Extra: Nomes de Coluna Diferentes

Um erro comum que faz o Supabase retornar `null` (e o código mostrar lista vazia) é tentar ordenar por uma coluna que não existe na tabela específica.

- **Erro Comum**: `.order('created_at')`
- **Fato**: Na tabela `property_interactions`, a coluna de data se chama **`timestamp`**.
- **Correção**: Sempre use `.order('timestamp', { ascending: false })` para esta tabela.

---
*Gerado pelo Antigravity em Março de 2026.*
