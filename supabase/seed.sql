-- Heard demo seed data — Hackathon judge account
-- Store: fictional anime figure shop (brand voice showcase)
-- User: google-hackathon-demo-9c25d0@apol.ai (UUID: dff66364-e9f1-49cb-980c-f78b6cccb91a)
-- NO live credentials — platform_access_token and all API tokens are intentionally null
--
-- Run AFTER supabase db push (schema must exist first)
-- Usage: supabase db query --linked --file supabase/seed.sql

-- ============================================================
-- Demo store
-- ============================================================
insert into stores (
  id, user_id,
  store_domain, shopify_domain, store_name, platform,
  platform_access_token,
  judgeme_api_token, judgeme_webhook_secret,
  google_connection_mode, google_location_name,
  created_at
) values (
  'aaaaaaaa-0001-0000-0000-000000000000',
  'dff66364-e9f1-49cb-980c-f78b6cccb91a',
  'demo.heard.apol.ai',
  null,                    -- no real Shopify store; order context fetch is skipped
  'Heard Demo Store',
  'shopify',
  null,                    -- no live credentials — agent cannot post to any real platform
  null,
  null,
  'manual_paste',
  null,
  now()
) on conflict (id) do nothing;

-- ============================================================
-- Brand voice
-- ============================================================
insert into brand_voice_config (id, store_id, sample_replies, rules, tone_description, tone_positive, tone_negative, updated_at) values (
  'bbbbbbbb-0001-0000-0000-000000000000',
  'aaaaaaaa-0001-0000-0000-000000000000',
  array[
    'Thank you so much for your kind words! It means the world to us that you''re loving your new piece. We put so much love into every order and it''s incredibly rewarding to hear it landed perfectly. We hope to see you again soon! 🌸',
    'Hi there — we''re so sorry to hear your order didn''t arrive as expected. This isn''t the experience we want for any of our customers. Please reach out to us directly at support@heardstore.demo and we''ll make it right as quickly as possible.'
  ],
  array[
    'Never promise refunds or replacements publicly',
    'Keep replies under 150 words',
    'Use first-person plural (we/our) not I/my',
    'Acknowledge the specific product if mentioned',
    'Match the energy of the review — don''t be overly cheerful for complaints'
  ],
  'Warm, playful, and passionate about anime culture. We''re fans ourselves — we speak to customers as fellow collectors, not as a faceless store. Occasional light Japanese words (arigatou, kawaii) are welcome but don''t overdo it.',
  'enthusiastic',
  'empathetic',
  now()
) on conflict (id) do nothing;

-- ============================================================
-- Reviews — mixed statuses for demo
-- ============================================================

-- 1. Escalated: angry complaint about damaged figure
insert into reviews (id, store_id, external_id, source, reviewer_name, rating, title, body, product_title, status, received_at) values (
  'cccccccc-0001-0000-0000-000000000000',
  'aaaaaaaa-0001-0000-0000-000000000000',
  'jm-ext-001', 'judgeme', 'Tyler B.', 1,
  'Arrived broken',
  'Paid $89 for this figure and it arrived with a snapped base and paint chipping off the face. The packaging was barely bubble-wrapped. This is completely unacceptable. I want a refund immediately.',
  'Rem Re:Zero 1/7 Scale Figure',
  'needs_review', now() - interval '2 hours'
) on conflict (id) do nothing;

insert into review_actions (review_id, risk_score, sentiment_label, agent_reasoning, draft_reply, confidence, risk_flags, agent_trace) values (
  'cccccccc-0001-0000-0000-000000000000',
  8, 'negative',
  'High-value ($89) item arrived damaged. Customer explicitly demands a refund. Risk 8: explicit refund demand + product defect claim. Guardrail would flag any refund promise. Escalating to human review.',
  'Hi Tyler — we are so sorry to hear your Rem figure arrived damaged. This is absolutely not the standard we hold ourselves to, and we want to make this right. Please email us at support@heardstore.demo with a photo and your order number and we will take care of you right away.',
  72,
  array['refund_offer'],
  '{"steps":[{"step":"claim","status":"complete"},{"step":"classify","status":"complete","result":{"risk_score":8,"sentiment_label":"negative","needs_order_context":true}},{"step":"brand_voice_rag","status":"complete","method":"pgvector","matched_count":2,"real_reply_count":0,"ai_sample_count":2,"similarity_scores":[0.88,0.71],"snippets":["Thank you so much for your kind words! It means the world","Hi there — we''re so sorry to hear your order didn''t arri"]},{"step":"fetch_order_context","status":"complete","found":true},{"step":"draft","status":"complete","confidence":72},{"step":"guardrails","status":"warning","passed":false,"fired_flags":["refund_offer"]},{"step":"post","status":"skipped"}]}'::jsonb
) on conflict (review_id) do nothing;

-- 2. Escalated: suspicious review (possible fake/competitor)
insert into reviews (id, store_id, external_id, source, reviewer_name, rating, title, body, product_title, status, received_at) values (
  'cccccccc-0002-0000-0000-000000000000',
  'aaaaaaaa-0001-0000-0000-000000000000',
  'jm-ext-002', 'judgeme', 'user4821', 2,
  null,
  'ok i guess but i''ve seen better figures at other stores for way less. the quality is nothing special and i feel like i overpaid',
  'Naruto Sage Mode Statue',
  'needs_review', now() - interval '5 hours'
) on conflict (id) do nothing;

insert into review_actions (review_id, risk_score, sentiment_label, agent_reasoning, draft_reply, confidence, risk_flags, agent_trace) values (
  'cccccccc-0002-0000-0000-000000000000',
  5, 'negative',
  'Vague complaint with implicit competitor comparison ("other stores"). Risk 5: indirect negative comparison, no specific issue to address. Worth human review to craft a thoughtful non-defensive reply.',
  'Thank you for taking the time to leave a review. We''re sorry the piece didn''t fully meet your expectations — we''re always looking for ways to improve. If you''d like to share more specific feedback, please reach out to us directly.',
  65,
  array[]::text[],
  '{"steps":[{"step":"claim","status":"complete"},{"step":"classify","status":"complete","result":{"risk_score":5,"sentiment_label":"negative","needs_order_context":false}},{"step":"brand_voice_rag","status":"complete","method":"pgvector","matched_count":2,"real_reply_count":0,"ai_sample_count":2,"similarity_scores":[0.82,0.69],"snippets":["Thank you so much for your kind words! It means the world","Hi there — we''re so sorry to hear your order didn''t arri"]},{"step":"fetch_order_context","status":"skipped"},{"step":"draft","status":"complete","confidence":65},{"step":"guardrails","status":"complete","passed":true,"fired_flags":[]},{"step":"post","status":"skipped"}]}'::jsonb
) on conflict (review_id) do nothing;

-- 3. Auto-posted: happy 5-star
insert into reviews (id, store_id, external_id, source, reviewer_name, rating, title, body, product_title, status, received_at) values (
  'cccccccc-0003-0000-0000-000000000000',
  'aaaaaaaa-0001-0000-0000-000000000000',
  'jm-ext-003', 'judgeme', 'Mei C.', 5,
  'Absolutely love it!!',
  'This is my third order and every time the packaging is perfect and the figures arrive in pristine condition. The Miku figure looks even better in person than in the photos. Fast shipping too!',
  'Hatsune Miku 1/4 Scale Figure',
  'auto_posted', now() - interval '1 day'
) on conflict (id) do nothing;

insert into review_actions (review_id, risk_score, sentiment_label, agent_reasoning, draft_reply, final_reply, confidence, risk_flags, agent_trace) values (
  'cccccccc-0003-0000-0000-000000000000',
  1, 'positive',
  'Enthusiastic 5-star repeat customer. Zero risk. Perfect auto-post candidate.',
  'Arigatou, Mei! It makes us so happy to hear you''re loving the Miku figure — she really is stunning in person, isn''t she? Thank you for being such a wonderful part of our community. We can''t wait for you to see what''s coming next! 🌸',
  'Arigatou, Mei! It makes us so happy to hear you''re loving the Miku figure — she really is stunning in person, isn''t she? Thank you for being such a wonderful part of our community. We can''t wait for you to see what''s coming next! 🌸',
  95,
  array[]::text[],
  '{"steps":[{"step":"claim","status":"complete"},{"step":"classify","status":"complete","result":{"risk_score":1,"sentiment_label":"positive","needs_order_context":false}},{"step":"brand_voice_rag","status":"complete","method":"pgvector","matched_count":2,"real_reply_count":0,"ai_sample_count":2,"similarity_scores":[0.91,0.65],"snippets":["Thank you so much for your kind words! It means the world","Hi there — we''re so sorry to hear your order didn''t arri"]},{"step":"fetch_order_context","status":"skipped"},{"step":"draft","status":"complete","confidence":95},{"step":"guardrails","status":"complete","passed":true,"fired_flags":[]},{"step":"post","status":"complete","posted":true}]}'::jsonb
) on conflict (review_id) do nothing;

-- 4. Auto-posted: 4-star
insert into reviews (id, store_id, external_id, source, reviewer_name, rating, title, body, product_title, status, received_at) values (
  'cccccccc-0004-0000-0000-000000000000',
  'aaaaaaaa-0001-0000-0000-000000000000',
  'jm-ext-004', 'judgeme', 'Jordan K.', 4,
  'Great quality, minor packaging issue',
  'The figure itself is gorgeous — the detail on the wings is incredible. Only knocked off a star because one of the accessories was loose in the box (not broken, just rattling). Still very happy with the purchase overall.',
  'Asuka Evangelion Wings Figure',
  'auto_posted', now() - interval '2 days'
) on conflict (id) do nothing;

insert into review_actions (review_id, risk_score, sentiment_label, agent_reasoning, draft_reply, final_reply, confidence, risk_flags, agent_trace) values (
  'cccccccc-0004-0000-0000-000000000000',
  2, 'positive',
  'Mostly positive review with minor packaging note. No action required, no refund language. Safe to auto-reply with acknowledgment of the feedback.',
  'Thank you for the thoughtful review, Jordan! We''re so glad the Asuka figure impressed — those wing details are definitely one of our favorites. We''re sorry to hear about the loose accessory; we''re passing this along to our packing team. We hope she looks incredible on display! 🙌',
  'Thank you for the thoughtful review, Jordan! We''re so glad the Asuka figure impressed — those wing details are definitely one of our favorites. We''re sorry to hear about the loose accessory; we''re passing this along to our packing team. We hope she looks incredible on display! 🙌',
  88,
  array[]::text[],
  '{"steps":[{"step":"claim","status":"complete"},{"step":"classify","status":"complete","result":{"risk_score":2,"sentiment_label":"positive","needs_order_context":false}},{"step":"brand_voice_rag","status":"complete","method":"pgvector","matched_count":2,"real_reply_count":0,"ai_sample_count":2,"similarity_scores":[0.86,0.73],"snippets":["Thank you so much for your kind words! It means the world","Hi there — we''re so sorry to hear your order didn''t arri"]},{"step":"fetch_order_context","status":"skipped"},{"step":"draft","status":"complete","confidence":88},{"step":"guardrails","status":"complete","passed":true,"fired_flags":[]},{"step":"post","status":"complete","posted":true}]}'::jsonb
) on conflict (review_id) do nothing;

-- 5. Pending (unprocessed)
insert into reviews (id, store_id, external_id, source, reviewer_name, rating, title, body, product_title, status, received_at) values (
  'cccccccc-0005-0000-0000-000000000000',
  'aaaaaaaa-0001-0000-0000-000000000000',
  'jm-ext-005', 'judgeme', 'Sam T.', 5,
  null,
  'Best anime figure store I''ve found online. Will be ordering again for sure.',
  'One Piece Luffy Gear 5 Figure',
  'pending', now() - interval '10 minutes'
) on conflict (id) do nothing;

-- ============================================================
-- Agent run record
-- ============================================================
insert into agent_runs (id, store_id, trigger_type, review_ids, started_at, completed_at, reviews_processed, auto_posted, escalated, failed) values (
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
) on conflict (id) do nothing;
