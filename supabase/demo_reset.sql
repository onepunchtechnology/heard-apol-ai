-- Demo reset script — OhayoPop
-- Restores reviews, review_actions, and agent_runs to the seeded state.
-- Safe to run repeatedly. Run before each judge demo session.
--
-- Usage:
--   supabase db execute --file supabase/demo_reset.sql
--   OR paste into Supabase SQL editor
--
-- Seed-protected store ID: aaaaaaaa-0001-0000-0000-000000000000
-- Seed-protected review IDs: cccccccc-0001 through cccccccc-0005
-- Seed-protected agent_run ID: dddddddd-0001-0000-0000-000000000000

begin;

-- ============================================================
-- 0. Restore brand voice tones for the demo store
-- ============================================================
update brand_voice_config
set tone_positive = 'enthusiastic', tone_negative = 'empathetic'
where store_id = 'aaaaaaaa-0001-0000-0000-000000000000';

-- ============================================================
-- 1. Remove any non-seed reviews for the demo store
--    (review_actions cascade-delete via FK)
-- ============================================================
delete from reviews
where store_id = 'aaaaaaaa-0001-0000-0000-000000000000'
  and id not in (
    'cccccccc-0001-0000-0000-000000000000',
    'cccccccc-0002-0000-0000-000000000000',
    'cccccccc-0003-0000-0000-000000000000',
    'cccccccc-0004-0000-0000-000000000000',
    'cccccccc-0005-0000-0000-000000000000'
  );

-- ============================================================
-- 2. Remove any non-seed agent_runs for the demo store
-- ============================================================
delete from agent_runs
where store_id = 'aaaaaaaa-0001-0000-0000-000000000000'
  and id != 'dddddddd-0001-0000-0000-000000000000';

-- ============================================================
-- 3. Reset seed reviews to original statuses
-- ============================================================
update reviews set status = 'needs_review', updated_at = now()
where id = 'cccccccc-0001-0000-0000-000000000000';

update reviews set status = 'needs_review', updated_at = now()
where id = 'cccccccc-0002-0000-0000-000000000000';

update reviews set status = 'auto_posted', updated_at = now()
where id = 'cccccccc-0003-0000-0000-000000000000';

update reviews set status = 'auto_posted', updated_at = now()
where id = 'cccccccc-0004-0000-0000-000000000000';

update reviews set status = 'pending', updated_at = now()
where id = 'cccccccc-0005-0000-0000-000000000000';

-- ============================================================
-- 4. Restore review_actions for seed reviews
--    (upsert so it works even if an action was deleted)
-- ============================================================

-- Review 1: broken figure escalation
insert into review_actions (
  review_id, risk_score, sentiment_label, agent_reasoning,
  draft_reply, final_reply, confidence, risk_flags, agent_trace,
  decision, auto_posted_at, reviewed_by, reviewed_at, created_at
) values (
  'cccccccc-0001-0000-0000-000000000000',
  8, 'negative',
  'High-value ($89) item arrived damaged. Customer explicitly demands a refund. Risk 8: explicit refund demand + product defect claim. Guardrail would flag any refund promise. Escalating to human review.',
  'Hi Tyler — we are so sorry to hear your Rem figure arrived damaged. This is absolutely not the standard we hold ourselves to, and we want to make this right. Please email us at support@heardstore.demo with a photo and your order number and we will take care of you right away.',
  null, 72,
  array['refund_offer_risk'],
  '{"steps":[{"step":"claim","status":"complete"},{"step":"classify","status":"complete","result":{"risk_score":8,"sentiment_label":"negative","needs_order_context":true}},{"step":"brand_voice_rag","status":"complete","matched_count":2,"snippets":["Thank you so much for your kind words! It means the world","Hi there — we''re so sorry to hear your order didn''t arri"]},{"step":"fetch_order_context","status":"complete","found":true},{"step":"draft","status":"complete","confidence":72},{"step":"guardrails","status":"warning","passed":false,"fired_flags":["refund_offer_risk"]},{"step":"post","status":"skipped"}]}'::jsonb,
  'escalate', null, null, null, now()
)
on conflict (review_id) do update set
  risk_score       = excluded.risk_score,
  sentiment_label  = excluded.sentiment_label,
  agent_reasoning  = excluded.agent_reasoning,
  draft_reply      = excluded.draft_reply,
  final_reply      = excluded.final_reply,
  confidence       = excluded.confidence,
  risk_flags       = excluded.risk_flags,
  agent_trace      = excluded.agent_trace,
  decision         = excluded.decision,
  auto_posted_at   = excluded.auto_posted_at,
  reviewed_by      = excluded.reviewed_by,
  reviewed_at      = excluded.reviewed_at;

-- Review 2: suspicious competitor-comparison review
insert into review_actions (
  review_id, risk_score, sentiment_label, agent_reasoning,
  draft_reply, final_reply, confidence, risk_flags, agent_trace,
  decision, auto_posted_at, reviewed_by, reviewed_at, created_at
) values (
  'cccccccc-0002-0000-0000-000000000000',
  5, 'negative',
  'Vague complaint with implicit competitor comparison ("other stores"). Risk 5: indirect negative comparison, no specific issue to address. Worth human review to craft a thoughtful non-defensive reply.',
  'Thank you for taking the time to leave a review. We''re sorry the piece didn''t fully meet your expectations — we''re always looking for ways to improve. If you''d like to share more specific feedback, please reach out to us directly.',
  null, 65,
  array[]::text[],
  '{"steps":[{"step":"claim","status":"complete"},{"step":"classify","status":"complete","result":{"risk_score":5,"sentiment_label":"negative","needs_order_context":false}},{"step":"brand_voice_rag","status":"complete","matched_count":2,"snippets":["Thank you so much for your kind words! It means the world","Hi there — we''re so sorry to hear your order didn''t arri"]},{"step":"fetch_order_context","status":"skipped"},{"step":"draft","status":"complete","confidence":65},{"step":"guardrails","status":"complete","passed":true,"fired_flags":[]},{"step":"post","status":"skipped"}]}'::jsonb,
  'escalate', null, null, null, now()
)
on conflict (review_id) do update set
  risk_score       = excluded.risk_score,
  sentiment_label  = excluded.sentiment_label,
  agent_reasoning  = excluded.agent_reasoning,
  draft_reply      = excluded.draft_reply,
  final_reply      = excluded.final_reply,
  confidence       = excluded.confidence,
  risk_flags       = excluded.risk_flags,
  agent_trace      = excluded.agent_trace,
  decision         = excluded.decision,
  auto_posted_at   = excluded.auto_posted_at,
  reviewed_by      = excluded.reviewed_by,
  reviewed_at      = excluded.reviewed_at;

-- Review 3: happy 5-star (auto-posted)
insert into review_actions (
  review_id, risk_score, sentiment_label, agent_reasoning,
  draft_reply, final_reply, confidence, risk_flags, agent_trace,
  decision, auto_posted_at, reviewed_by, reviewed_at, created_at
) values (
  'cccccccc-0003-0000-0000-000000000000',
  1, 'positive',
  'Enthusiastic 5-star repeat customer. Zero risk. Perfect auto-post candidate.',
  'Arigatou, Mei! It makes us so happy to hear you''re loving the Miku figure — she really is stunning in person, isn''t she? Thank you for being such a wonderful part of the OhayoPop community. We can''t wait for you to see what''s coming next! 🌸',
  'Arigatou, Mei! It makes us so happy to hear you''re loving the Miku figure — she really is stunning in person, isn''t she? Thank you for being such a wonderful part of the OhayoPop community. We can''t wait for you to see what''s coming next! 🌸',
  95,
  array[]::text[],
  '{"steps":[{"step":"claim","status":"complete"},{"step":"classify","status":"complete","result":{"risk_score":1,"sentiment_label":"positive","needs_order_context":false}},{"step":"brand_voice_rag","status":"complete","matched_count":2,"snippets":["Thank you so much for your kind words! It means the world","Hi there — we''re so sorry to hear your order didn''t arri"]},{"step":"fetch_order_context","status":"skipped"},{"step":"draft","status":"complete","confidence":95},{"step":"guardrails","status":"complete","passed":true,"fired_flags":[]},{"step":"post","status":"complete","posted":true}]}'::jsonb,
  'auto_post', now() - interval '1 day', null, null, now()
)
on conflict (review_id) do update set
  risk_score       = excluded.risk_score,
  sentiment_label  = excluded.sentiment_label,
  agent_reasoning  = excluded.agent_reasoning,
  draft_reply      = excluded.draft_reply,
  final_reply      = excluded.final_reply,
  confidence       = excluded.confidence,
  risk_flags       = excluded.risk_flags,
  agent_trace      = excluded.agent_trace,
  decision         = excluded.decision,
  auto_posted_at   = excluded.auto_posted_at,
  reviewed_by      = excluded.reviewed_by,
  reviewed_at      = excluded.reviewed_at;

-- Review 4: 4-star minor packaging issue (auto-posted)
insert into review_actions (
  review_id, risk_score, sentiment_label, agent_reasoning,
  draft_reply, final_reply, confidence, risk_flags, agent_trace,
  decision, auto_posted_at, reviewed_by, reviewed_at, created_at
) values (
  'cccccccc-0004-0000-0000-000000000000',
  2, 'positive',
  'Mostly positive review with minor packaging note. No action required, no refund language. Safe to auto-reply with acknowledgment of the feedback.',
  'Thank you for the thoughtful review, Jordan! We''re so glad the Asuka figure impressed — those wing details are definitely one of our favorites. We''re sorry to hear about the loose accessory; we''re passing this along to our packing team. We hope she looks incredible on display! 🙌',
  'Thank you for the thoughtful review, Jordan! We''re so glad the Asuka figure impressed — those wing details are definitely one of our favorites. We''re sorry to hear about the loose accessory; we''re passing this along to our packing team. We hope she looks incredible on display! 🙌',
  88,
  array[]::text[],
  '{"steps":[{"step":"claim","status":"complete"},{"step":"classify","status":"complete","result":{"risk_score":2,"sentiment_label":"positive","needs_order_context":false}},{"step":"brand_voice_rag","status":"complete","matched_count":2,"snippets":["Thank you so much for your kind words! It means the world","Hi there — we''re so sorry to hear your order didn''t arri"]},{"step":"fetch_order_context","status":"skipped"},{"step":"draft","status":"complete","confidence":88},{"step":"guardrails","status":"complete","passed":true,"fired_flags":[]},{"step":"post","status":"complete","posted":true}]}'::jsonb,
  'auto_post', now() - interval '2 days', null, null, now()
)
on conflict (review_id) do update set
  risk_score       = excluded.risk_score,
  sentiment_label  = excluded.sentiment_label,
  agent_reasoning  = excluded.agent_reasoning,
  draft_reply      = excluded.draft_reply,
  final_reply      = excluded.final_reply,
  confidence       = excluded.confidence,
  risk_flags       = excluded.risk_flags,
  agent_trace      = excluded.agent_trace,
  decision         = excluded.decision,
  auto_posted_at   = excluded.auto_posted_at,
  reviewed_by      = excluded.reviewed_by,
  reviewed_at      = excluded.reviewed_at;

-- Review 5 (pending) has no review_action — nothing to restore.

-- ============================================================
-- 5. Restore the seed agent_run
-- ============================================================
insert into agent_runs (
  id, store_id, trigger_type, review_ids,
  started_at, completed_at,
  reviews_processed, auto_posted, escalated, failed
) values (
  'dddddddd-0001-0000-0000-000000000000',
  'aaaaaaaa-0001-0000-0000-000000000000',
  'scheduled',
  array[
    'cccccccc-0001-0000-0000-000000000000',
    'cccccccc-0002-0000-0000-000000000000',
    'cccccccc-0003-0000-0000-000000000000',
    'cccccccc-0004-0000-0000-000000000000'
  ]::uuid[],
  now() - interval '3 hours',
  now() - interval '3 hours' + interval '47 seconds',
  4, 2, 2, 0
)
on conflict (id) do update set
  trigger_type       = excluded.trigger_type,
  review_ids         = excluded.review_ids,
  started_at         = excluded.started_at,
  completed_at       = excluded.completed_at,
  reviews_processed  = excluded.reviews_processed,
  auto_posted        = excluded.auto_posted,
  escalated          = excluded.escalated,
  failed             = excluded.failed,
  error_details      = null;

commit;
