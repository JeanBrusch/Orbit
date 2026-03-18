-- Execute este script no SQL Editor do Supabase para corrigir o erro de trackeamento

ALTER TABLE property_interactions DROP CONSTRAINT IF EXISTS property_interactions_interaction_type_check;

ALTER TABLE property_interactions ADD CONSTRAINT property_interactions_interaction_type_check 
CHECK (interaction_type IN (
  'sent', 
  'viewed', 
  'favorited', 
  'discarded', 
  'visited', 
  'property_question', 
  'portal_opened', 
  'session_end', 
  'visited_site'
));
