-- Demo reset script - Heard sandbox store
-- Restores the demo account to:
--   - 3 imported historical replies for RAG grounding
--   - 5 fresh pending reviews with no review_actions
--
-- Safe to run repeatedly. Run before each judge demo session.
-- After run, confirm with the below sql:
    -- select status, count(*)
    -- from reviews
    -- where store_id = 'aaaaaaaa-0001-0000-0000-000000000000'
    -- group by status
    -- order by status;
--
-- Usage:
--   supabase db execute --file supabase/demo_reset.sql
--   OR paste into Supabase SQL editor

begin;

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
  null,
  'Heard Demo Store',
  'shopify',
  null,
  null,
  null,
  'manual_paste',
  null,
  now()
) on conflict (id) do update set
  user_id = excluded.user_id,
  store_domain = excluded.store_domain,
  shopify_domain = excluded.shopify_domain,
  store_name = excluded.store_name,
  platform = excluded.platform,
  platform_access_token = excluded.platform_access_token,
  judgeme_api_token = excluded.judgeme_api_token,
  judgeme_webhook_secret = excluded.judgeme_webhook_secret,
  google_connection_mode = excluded.google_connection_mode,
  google_location_name = excluded.google_location_name;

insert into brand_voice_config (
  id, store_id, sample_replies, learned_replies, rules,
  tone_description, tone_positive, tone_negative, updated_at
) values (
  'bbbbbbbb-0001-0000-0000-000000000000',
  'aaaaaaaa-0001-0000-0000-000000000000',
  array[
    'Thank you so much for your kind words! It means the world to us that you are loving your new piece. We put so much love into every order and it is incredibly rewarding to hear it landed perfectly.',
    'Hi there - we are so sorry to hear your order did not arrive as expected. This is not the experience we want for any customer. Please reach out to us directly and we will help make it right.'
  ],
  array[]::text[],
  array[
    'Never promise refunds or replacements publicly',
    'Keep replies under 150 words',
    'Use first-person plural (we/our) not I/my',
    'Acknowledge the specific product if mentioned',
    'Match the energy of the review - do not be overly cheerful for complaints'
  ],
  'Warm, playful, and passionate about anime culture. We are fans ourselves - we speak to customers as fellow collectors, not as a faceless store.',
  'enthusiastic',
  'empathetic',
  now()
) on conflict (id) do update set
  sample_replies = excluded.sample_replies,
  learned_replies = excluded.learned_replies,
  rules = excluded.rules,
  tone_description = excluded.tone_description,
  tone_positive = excluded.tone_positive,
  tone_negative = excluded.tone_negative,
  updated_at = excluded.updated_at;

delete from reviews
where id in (
  'cccccccc-0001-0000-0000-000000000000',
  'cccccccc-0002-0000-0000-000000000000',
  'cccccccc-0003-0000-0000-000000000000',
  'cccccccc-0004-0000-0000-000000000000',
  'cccccccc-0005-0000-0000-000000000000',
  'cccccccc-0006-0000-0000-000000000000',
  'cccccccc-0007-0000-0000-000000000000',
  'cccccccc-0008-0000-0000-000000000000'
);

delete from brand_voice_embeddings
where store_id = 'aaaaaaaa-0001-0000-0000-000000000000';

delete from agent_runs
where store_id = 'aaaaaaaa-0001-0000-0000-000000000000'
  and id = 'dddddddd-0001-0000-0000-000000000000';

insert into reviews (id, store_id, external_id, source, reviewer_name, rating, title, body, product_title, status, received_at) values
('cccccccc-0001-0000-0000-000000000000', 'aaaaaaaa-0001-0000-0000-000000000000', 'imported-001', 'judgeme', 'Mina R.', 5, 'Perfect packaging', 'The Sakura Miku figure arrived in perfect condition and the little thank-you note made my day.', 'Sakura Miku Nendoroid', 'imported', now() - interval '24 days'),
('cccccccc-0002-0000-0000-000000000000', 'aaaaaaaa-0001-0000-0000-000000000000', 'imported-002', 'judgeme', 'Drew L.', 4, 'Great figure, slow shipping', 'The Gojo figure is beautiful. Shipping took a bit longer than expected, but it was packed safely.', 'Gojo Satoru Figure', 'imported', now() - interval '18 days'),
('cccccccc-0003-0000-0000-000000000000', 'aaaaaaaa-0001-0000-0000-000000000000', 'imported-003', 'judgeme', 'Alex P.', 2, 'Box was crushed', 'The figure is okay but the collector box arrived crushed on one corner.', 'Tanjiro Deluxe Figure', 'imported', now() - interval '11 days'),
('cccccccc-0004-0000-0000-000000000000', 'aaaaaaaa-0001-0000-0000-000000000000', 'jm-ext-004', 'judgeme', 'Mei C.', 5, 'Absolutely love it', 'This is my third order and every time the packaging is perfect and the figures arrive in pristine condition. The Miku figure looks even better in person than in the photos. Fast shipping too!', 'Hatsune Miku 1/4 Scale Figure', 'pending', now() - interval '50 minutes'),
('cccccccc-0005-0000-0000-000000000000', 'aaaaaaaa-0001-0000-0000-000000000000', 'jm-ext-005', 'judgeme', 'Noah S.', 3, 'Sizing question', 'The hoodie is softer than expected, but the sizing runs small. Do you usually recommend sizing up for this brand?', 'Anya Forger Embroidered Hoodie', 'pending', now() - interval '40 minutes'),
('cccccccc-0006-0000-0000-000000000000', 'aaaaaaaa-0001-0000-0000-000000000000', 'jm-ext-006', 'judgeme', 'Priya K.', 2, 'Wrong item sent', 'I ordered the Levi figure but received an Eren figure instead. The invoice has my correct item, so something went wrong in packing.', 'Levi Ackerman Figure', 'pending', now() - interval '30 minutes'),
('cccccccc-0007-0000-0000-000000000000', 'aaaaaaaa-0001-0000-0000-000000000000', 'jm-ext-007', 'judgeme', 'Tyler B.', 1, 'Arrived broken', 'Paid $89 for this figure and it arrived with a snapped base and paint chipping off the face. This is unacceptable. I want a refund immediately or I am filing a chargeback and BBB complaint.', 'Rem Re:Zero 1/7 Scale Figure', 'pending', now() - interval '20 minutes'),
('cccccccc-0008-0000-0000-000000000000', 'aaaaaaaa-0001-0000-0000-000000000000', 'jm-ext-008', 'judgeme', 'Sam T.', 5, null, 'Best anime figure store I have found online. Will be ordering again for sure.', 'One Piece Luffy Gear 5 Figure', 'pending', now() - interval '10 minutes');

insert into review_actions (review_id, sentiment_label, agent_reasoning, final_reply, risk_flags, created_at) values
('cccccccc-0001-0000-0000-000000000000', 'positive', 'Imported historical merchant reply for brand voice grounding.', 'Arigatou, Mina! We are so happy Sakura Miku made it to you safely. We pack every order with collector shelves in mind, so hearing the little note made your day means a lot to us.', array[]::text[], now()),
('cccccccc-0002-0000-0000-000000000000', 'positive', 'Imported historical merchant reply for brand voice grounding.', 'Thank you for the thoughtful review, Drew. We are thrilled Gojo arrived safely and looked beautiful in person. We are sorry shipping took longer than expected, and we appreciate your patience while your order made its way to you.', array[]::text[], now()),
('cccccccc-0003-0000-0000-000000000000', 'negative', 'Imported historical merchant reply for brand voice grounding.', 'Hi Alex - we are sorry the collector box arrived crushed. That is frustrating, especially for display pieces. Please message us privately with your order number and photos so our team can look into what happened.', array[]::text[], now());

commit;
