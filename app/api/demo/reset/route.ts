import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const DEMO_EMAIL = 'google-hackathon-demo-9c25d0@apol.ai'
const DEMO_STORE_ID = 'aaaaaaaa-0001-0000-0000-000000000000'
const DEMO_USER_ID = 'dff66364-e9f1-49cb-980c-f78b6cccb91a'
const DEMO_BVC_ID = 'bbbbbbbb-0001-0000-0000-000000000000'
const DEMO_AGENT_RUN_ID = 'dddddddd-0001-0000-0000-000000000000'

const REVIEW_IDS = [
  'cccccccc-0001-0000-0000-000000000000',
  'cccccccc-0002-0000-0000-000000000000',
  'cccccccc-0003-0000-0000-000000000000',
  'cccccccc-0004-0000-0000-000000000000',
  'cccccccc-0005-0000-0000-000000000000',
  'cccccccc-0006-0000-0000-000000000000',
  'cccccccc-0007-0000-0000-000000000000',
  'cccccccc-0008-0000-0000-000000000000',
]

export async function POST(_request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.email !== DEMO_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const db = await createServiceClient()
  const ts = new Date().toISOString()

  const ago = (days: number, minutes = 0) =>
    new Date(Date.now() - days * 86400_000 - minutes * 60_000).toISOString()

  const { error: storeErr } = await db.from('stores').upsert({
    id: DEMO_STORE_ID,
    user_id: DEMO_USER_ID,
    store_domain: 'demo.heard.apol.ai',
    shopify_domain: null,
    store_name: 'Heard Demo Store',
    platform: 'shopify',
    platform_access_token: null,
    judgeme_api_token: null,
    judgeme_webhook_secret: null,
    google_connection_mode: 'manual_paste',
    google_location_name: null,
  }, { onConflict: 'id' })
  if (storeErr) return NextResponse.json({ error: storeErr.message }, { status: 500 })

  const { error: bvcErr } = await db.from('brand_voice_config').upsert({
    id: DEMO_BVC_ID,
    store_id: DEMO_STORE_ID,
    sample_replies: [
      'Thank you so much for your kind words! It means the world to us that you are loving your new piece. We put so much love into every order and it is incredibly rewarding to hear it landed perfectly.',
      'Hi there - we are so sorry to hear your order did not arrive as expected. This is not the experience we want for any customer. Please reach out to us directly and we will help make it right.',
    ],
    learned_replies: [],
    rules: [
      'Never promise refunds or replacements publicly',
      'Keep replies under 150 words',
      'Use first-person plural (we/our) not I/my',
      'Acknowledge the specific product if mentioned',
      'Match the energy of the review - do not be overly cheerful for complaints',
    ],
    tone_description: 'Warm, playful, and passionate about anime culture. We are fans ourselves - we speak to customers as fellow collectors, not as a faceless store.',
    tone_positive: 'enthusiastic',
    tone_negative: 'empathetic',
    updated_at: ts,
  }, { onConflict: 'id' })
  if (bvcErr) return NextResponse.json({ error: bvcErr.message }, { status: 500 })

  await db.from('reviews').delete().in('id', REVIEW_IDS)
  await db.from('brand_voice_embeddings').delete().eq('store_id', DEMO_STORE_ID)
  await db.from('agent_runs').delete().eq('id', DEMO_AGENT_RUN_ID)

  const { error: reviewsErr } = await db.from('reviews').insert([
    { id: 'cccccccc-0001-0000-0000-000000000000', store_id: DEMO_STORE_ID, external_id: 'imported-001', source: 'judgeme', reviewer_name: 'Mina R.', rating: 5, title: 'Perfect packaging', body: 'The Sakura Miku figure arrived in perfect condition and the little thank-you note made my day.', product_title: 'Sakura Miku Nendoroid', status: 'imported', received_at: ago(24) },
    { id: 'cccccccc-0002-0000-0000-000000000000', store_id: DEMO_STORE_ID, external_id: 'imported-002', source: 'judgeme', reviewer_name: 'Drew L.', rating: 4, title: 'Great figure, slow shipping', body: 'The Gojo figure is beautiful. Shipping took a bit longer than expected, but it was packed safely.', product_title: 'Gojo Satoru Figure', status: 'imported', received_at: ago(18) },
    { id: 'cccccccc-0003-0000-0000-000000000000', store_id: DEMO_STORE_ID, external_id: 'imported-003', source: 'judgeme', reviewer_name: 'Alex P.', rating: 2, title: 'Box was crushed', body: 'The figure is okay but the collector box arrived crushed on one corner.', product_title: 'Tanjiro Deluxe Figure', status: 'imported', received_at: ago(11) },
    { id: 'cccccccc-0004-0000-0000-000000000000', store_id: DEMO_STORE_ID, external_id: 'jm-ext-004', source: 'judgeme', reviewer_name: 'Mei C.', rating: 5, title: 'Absolutely love it', body: 'This is my third order and every time the packaging is perfect and the figures arrive in pristine condition. The Miku figure looks even better in person than in the photos. Fast shipping too!', product_title: 'Hatsune Miku 1/4 Scale Figure', status: 'pending', received_at: ago(0, 50) },
    { id: 'cccccccc-0005-0000-0000-000000000000', store_id: DEMO_STORE_ID, external_id: 'jm-ext-005', source: 'judgeme', reviewer_name: 'Noah S.', rating: 3, title: 'Sizing question', body: 'The hoodie is softer than expected, but the sizing runs small. Do you usually recommend sizing up for this brand?', product_title: 'Anya Forger Embroidered Hoodie', status: 'pending', received_at: ago(0, 40) },
    { id: 'cccccccc-0006-0000-0000-000000000000', store_id: DEMO_STORE_ID, external_id: 'jm-ext-006', source: 'judgeme', reviewer_name: 'Priya K.', rating: 2, title: 'Wrong item sent', body: 'I ordered the Levi figure but received an Eren figure instead. The invoice has my correct item, so something went wrong in packing.', product_title: 'Levi Ackerman Figure', status: 'pending', received_at: ago(0, 30) },
    { id: 'cccccccc-0007-0000-0000-000000000000', store_id: DEMO_STORE_ID, external_id: 'jm-ext-007', source: 'judgeme', reviewer_name: 'Tyler B.', rating: 1, title: 'Arrived broken', body: 'Paid $89 for this figure and it arrived with a snapped base and paint chipping off the face. This is unacceptable. I want a refund immediately or I am filing a chargeback and BBB complaint.', product_title: 'Rem Re:Zero 1/7 Scale Figure', status: 'pending', received_at: ago(0, 20) },
    { id: 'cccccccc-0008-0000-0000-000000000000', store_id: DEMO_STORE_ID, external_id: 'jm-ext-008', source: 'judgeme', reviewer_name: 'Sam T.', rating: 5, title: null, body: 'Best anime figure store I have found online. Will be ordering again for sure.', product_title: 'One Piece Luffy Gear 5 Figure', status: 'pending', received_at: ago(0, 10) },
  ])
  if (reviewsErr) return NextResponse.json({ error: reviewsErr.message }, { status: 500 })

  const { error: actionsErr } = await db.from('review_actions').insert([
    { review_id: 'cccccccc-0001-0000-0000-000000000000', sentiment_label: 'positive', agent_reasoning: 'Imported historical merchant reply for brand voice grounding.', final_reply: 'Arigatou, Mina! We are so happy Sakura Miku made it to you safely. We pack every order with collector shelves in mind, so hearing the little note made your day means a lot to us.', risk_flags: [], created_at: ts },
    { review_id: 'cccccccc-0002-0000-0000-000000000000', sentiment_label: 'positive', agent_reasoning: 'Imported historical merchant reply for brand voice grounding.', final_reply: 'Thank you for the thoughtful review, Drew. We are thrilled Gojo arrived safely and looked beautiful in person. We are sorry shipping took longer than expected, and we appreciate your patience while your order made its way to you.', risk_flags: [], created_at: ts },
    { review_id: 'cccccccc-0003-0000-0000-000000000000', sentiment_label: 'negative', agent_reasoning: 'Imported historical merchant reply for brand voice grounding.', final_reply: 'Hi Alex - we are sorry the collector box arrived crushed. That is frustrating, especially for display pieces. Please message us privately with your order number and photos so our team can look into what happened.', risk_flags: [], created_at: ts },
  ])
  if (actionsErr) return NextResponse.json({ error: actionsErr.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
