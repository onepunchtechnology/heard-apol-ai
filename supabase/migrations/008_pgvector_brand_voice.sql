-- Enable pgvector
create extension if not exists vector;

-- Stores pre-computed embeddings for brand voice replies used in semantic RAG retrieval.
-- Separate from brand_voice_config arrays to allow efficient cosine similarity search.
create table brand_voice_embeddings (
  id          uuid        primary key default gen_random_uuid(),
  store_id    uuid        not null references stores(id) on delete cascade,
  reply_text  text        not null,
  embedding   vector(768),
  source      text        not null check (source in ('learned', 'sample')),
  created_at  timestamptz not null default now(),

  unique (store_id, reply_text)
);

-- HNSW index: builds incrementally without minimum row count, handles inserts well
create index on brand_voice_embeddings
  using hnsw (embedding vector_cosine_ops);

alter table brand_voice_embeddings enable row level security;

create policy "Users access own brand voice embeddings" on brand_voice_embeddings
  for all using (
    store_id in (select id from stores where user_id = auth.uid())
  );

-- Similarity search over a single source tier (learned or sample).
-- Called twice by the orchestrator: learned first, then sample to fill remaining slots.
create or replace function match_brand_voice_replies(
  p_store_id        uuid,
  p_query_embedding vector(768),
  p_source          text,
  p_limit           int default 3
)
returns table (reply_text text, similarity float)
language sql stable
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
