create or replace function match_properties(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  exclude_ids uuid[]
)
returns table (
  id uuid,
  title text,
  value numeric,
  neighborhood text,
  city text,
  bedrooms int,
  suites int,
  area_privativa numeric,
  payment_conditions jsonb,
  features jsonb,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    p.id,
    p.title,
    p.value,
    p.neighborhood,
    p.city,
    p.bedrooms,
    p.suites,
    p.area_privativa,
    p.payment_conditions,
    p.features,
    1 - (p.property_embedding <=> query_embedding) as similarity
  from properties p
  where 1 - (p.property_embedding <=> query_embedding) > match_threshold
    and (cardinality(exclude_ids) = 0 or not p.id = any(exclude_ids))
  order by p.property_embedding <=> query_embedding
  limit match_count;
end;
$$;
