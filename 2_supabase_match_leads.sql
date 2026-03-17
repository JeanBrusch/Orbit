drop function if exists match_leads(vector, double precision, integer);

create or replace function match_leads(
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  name text,
  photo_url text,
  orbit_stage text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    l.id,
    l.name,
    l.photo_url,
    l.orbit_stage,
    1 - (l.semantic_vector <=> query_embedding) as similarity
  from leads l
  where l.semantic_vector is not null
    and 1 - (l.semantic_vector <=> query_embedding) > match_threshold
  order by l.semantic_vector <=> query_embedding
  limit match_count;
end;
$$;
