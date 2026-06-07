-- Add per-sentiment tone columns to brand_voice_config
-- tone_positive: how Heard sounds when replying to positive/neutral reviews
-- tone_negative: how Heard sounds when replying to complaints and negative reviews
alter table brand_voice_config
  add column if not exists tone_positive text,
  add column if not exists tone_negative text;
