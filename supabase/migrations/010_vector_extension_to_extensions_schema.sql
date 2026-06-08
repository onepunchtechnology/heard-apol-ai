-- Move pgvector from public to extensions schema.
-- Safe pre-launch: brand_voice_embeddings has no rows.
-- DROP CASCADE removes: brand_voice_embeddings table, HNSW index, match_brand_voice_replies function.

drop extension vector cascade;

-- CASCADE only drops the embedding column + dependent index/function; table itself survives.
drop table if exists brand_voice_embeddings;

create extension if not exists vector schema extensions;

-- Recreate table — vector(768) resolves from extensions via Supabase default search_path.
create table brand_voice_embeddings (
  id          uuid        primary key default gen_random_uuid(),
  store_id    uuid        not null references stores(id) on delete cascade,
  reply_text  text        not null,
  embedding   extensions.vector(768),
  source      text        not null check (source in ('learned', 'sample')),
  created_at  timestamptz not null default now(),

  unique (store_id, reply_text)
);

create index on brand_voice_embeddings
  using hnsw (embedding extensions.vector_cosine_ops);

alter table brand_voice_embeddings enable row level security;

create policy "Users access own brand voice embeddings" on brand_voice_embeddings
  for all using (
    store_id in (select id from stores where user_id = auth.uid())
  );

-- Recreate with explicit search_path so <=> and vector type resolve without schema qualification.
-- Agent calls this with service role; anon/authenticated access revoked.
create or replace function match_brand_voice_replies(
  p_store_id        uuid,
  p_query_embedding extensions.vector(768),
  p_source          text,
  p_limit           int default 3
)
returns table (reply_text text, similarity float)
language sql stable
set search_path = extensions, public
as $$
  select
    bve.reply_text,
    (1 - (bve.embedding <=> p_query_embedding))::float as similarity
  from brand_voice_embeddings bve
  where bve.store_id = p_store_id
    and bve.source = p_source
    and bve.embedding is not null
  order by bve.embedding <=> p_query_embedding
  limit p_limit;
$$;

revoke execute on function public.match_brand_voice_replies(uuid, extensions.vector, text, int) from anon, authenticated;
