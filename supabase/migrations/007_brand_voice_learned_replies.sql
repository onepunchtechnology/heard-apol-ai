alter table brand_voice_config
  add column if not exists learned_replies text[] not null default '{}';
