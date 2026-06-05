-- Enable UUID extension
create extension if not exists "pgcrypto";

-- ============================================================
-- stores
-- ============================================================
create table stores (
  id                          uuid primary key default gen_random_uuid(),
  user_id                     uuid not null references auth.users on delete cascade,
  shop_domain                 text not null,
  shopify_access_token        text,
  judgeme_api_token           text,
  judgeme_oauth_client_id     text,
  judgeme_oauth_client_secret text,
  judgeme_webhook_secret      text,
  google_oauth_tokens         jsonb,
  google_location_name        text,
  google_connection_mode      text check (google_connection_mode in ('api', 'manual_paste')),
  created_at                  timestamptz not null default now()
);

alter table stores enable row level security;
create policy "Users own their stores" on stores
  for all using (auth.uid() = user_id);

-- ============================================================
-- brand_voice_config
-- ============================================================
create table brand_voice_config (
  id               uuid primary key default gen_random_uuid(),
  store_id         uuid not null references stores on delete cascade,
  sample_replies   text[] not null default '{}',
  rules            text[] not null default '{}',
  tone_description text,
  updated_at       timestamptz not null default now()
);

alter table brand_voice_config enable row level security;
create policy "Users access own brand voice" on brand_voice_config
  for all using (
    store_id in (select id from stores where user_id = auth.uid())
  );

-- ============================================================
-- reviews
-- ============================================================
create table reviews (
  id             uuid primary key default gen_random_uuid(),
  store_id       uuid not null references stores on delete cascade,
  external_id    text not null,
  source         text not null check (source in ('judgeme', 'google_business')),
  reviewer_name  text not null,
  rating         int not null check (rating between 1 and 5),
  title          text,
  body           text not null,
  product_title  text,
  product_handle text,
  order_id       text,
  status         text not null default 'pending' check (
                   status in (
                     'pending', 'processing', 'auto_posted', 'needs_review',
                     'reply_pending_manual', 'failed', 'approved', 'rejected'
                   )
                 ),
  received_at    timestamptz not null default now(),
  raw_payload    jsonb,
  created_at     timestamptz not null default now(),

  unique (external_id, store_id)
);

create index reviews_store_status_idx on reviews (store_id, status);
create index reviews_store_received_idx on reviews (store_id, received_at desc);

alter table reviews enable row level security;
create policy "Users access own reviews" on reviews
  for all using (
    store_id in (select id from stores where user_id = auth.uid())
  );

-- ============================================================
-- review_actions
-- ============================================================
create table review_actions (
  id               uuid primary key default gen_random_uuid(),
  review_id        uuid not null references reviews on delete cascade unique,
  sentiment_score  float,
  sentiment_label  text check (sentiment_label in ('positive', 'neutral', 'negative')),
  category         text check (category in ('praise', 'question', 'complaint', 'urgent')),
  risk_score       int check (risk_score between 0 and 10),
  risk_flags       text[] not null default '{}',
  key_themes       text[] not null default '{}',
  agent_reasoning  text,
  agent_trace      jsonb,
  draft_reply      text,
  final_reply      text,
  order_context    jsonb,
  confidence       int check (confidence between 0 and 100),
  decision         text check (decision in ('auto_post', 'escalate')),
  auto_posted_at   timestamptz,
  reviewed_by      uuid references auth.users,
  reviewed_at      timestamptz,
  created_at       timestamptz not null default now()
);

alter table review_actions enable row level security;
create policy "Users access own review actions" on review_actions
  for all using (
    review_id in (
      select id from reviews
      where store_id in (select id from stores where user_id = auth.uid())
    )
  );

-- ============================================================
-- agent_runs
-- ============================================================
create table agent_runs (
  id                 uuid primary key default gen_random_uuid(),
  store_id           uuid not null references stores on delete cascade,
  trigger_type       text not null check (trigger_type in ('webhook', 'manual', 'scheduled')),
  review_ids         uuid[] not null default '{}',
  started_at         timestamptz not null default now(),
  completed_at       timestamptz,
  reviews_processed  int not null default 0,
  auto_posted        int not null default 0,
  escalated          int not null default 0,
  failed             int not null default 0,
  error_details      jsonb
);

create index agent_runs_store_started_idx on agent_runs (store_id, started_at desc);

alter table agent_runs enable row level security;
create policy "Users access own agent runs" on agent_runs
  for all using (
    store_id in (select id from stores where user_id = auth.uid())
  );

-- ============================================================
-- Service-role bypass policies (for Cloud Run Job)
-- Agent reads/writes via service role key — bypasses RLS
-- ============================================================
-- No additional grants needed: service role bypasses RLS by default in Supabase
