-- ORBIT SELECTION - FIX RLS & CONSTRAINTS
-- Execute este script no SQL Editor do Supabase (https://supabase.com/dashboard/project/pbgxtunmscjuhmxtqonr/sql/new)

-- 1. HABILITAR RLS
ALTER TABLE public.property_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_spaces ENABLE ROW LEVEL SECURITY;

-- 2. POLÍTICAS DE LEITURA PÚBLICA (Necessário para o link do cliente)
-- Interações
DROP POLICY IF EXISTS "Public can read property_interactions" ON public.property_interactions;
CREATE POLICY "Public can read property_interactions" ON public.property_interactions 
FOR SELECT USING (true);

-- Propriedades
DROP POLICY IF EXISTS "Public can read properties" ON public.properties;
CREATE POLICY "Public can read properties" ON public.properties 
FOR SELECT USING (true);

-- Espaços do Cliente
DROP POLICY IF EXISTS "Public can read client_spaces" ON public.client_spaces;
CREATE POLICY "Public can read client_spaces" ON public.client_spaces 
FOR SELECT USING (true);

-- 3. PERMISSÃO DE INSERÇÃO PARA TRACKING (Necessário para salvar cliques/likes/visitas)
DROP POLICY IF EXISTS "Public can insert interactions" ON public.property_interactions;
CREATE POLICY "Public can insert interactions" ON public.property_interactions 
FOR INSERT WITH CHECK (true);

-- 4. ATUALIZAR CONSTRAINT DE TIPOS DE INTERAÇÃO
-- Remove a antiga se existir
ALTER TABLE public.property_interactions DROP CONSTRAINT IF EXISTS property_interactions_interaction_type_check;

-- Adiciona a nova com todos os tipos usados no portal premium
ALTER TABLE public.property_interactions ADD CONSTRAINT property_interactions_interaction_type_check 
CHECK (interaction_type IN (
  'sent', 
  'viewed', 
  'favorited', 
  'discarded', 
  'visited', 
  'property_question', 
  'portal_opened', 
  'session_end', 
  'scroll_depth',
  'chat_opened',
  'video_viewed'
));

-- 5. POLÍTICA PARA SALVAR MENSAGENS NO CHAT (client_space_messages ou similar se existir)
-- Se estiver usando uma tabela de mensagens específica, certifique-se que ela também tem permissão de insert para 'public'.
