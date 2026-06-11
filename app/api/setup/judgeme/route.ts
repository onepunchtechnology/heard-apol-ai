import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

function extractReplyText(review: Record<string, unknown>): string | null {
  // Try multiple possible field shapes defensively — Judge.me API shape not fully verified
  const reply = review.curated_reply ?? review.reply ?? review.store_reply
  if (!reply) return null
  if (typeof reply === 'string' && reply.trim()) return reply.trim()
  if (typeof reply === 'object' && reply !== null) {
    const r = reply as Record<string, unknown>
    const body = r.body ?? r.text ?? r.content
    if (typeof body === 'string' && body.trim()) return body.trim()
  }
  return null
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { judgeme_api_token, judgeme_webhook_secret } = await request.json()
  if (!judgeme_api_token) {
    return NextResponse.json({ error: 'judgeme_api_token required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: store } = await admin.from('stores').select('id, shopify_domain').eq('user_id', user.id).maybeSingle()
  if (!store) return NextResponse.json({ error: 'Complete store setup first' }, { status: 422 })
  if (!store.shopify_domain) return NextResponse.json({ error: 'Complete Shopify setup first' }, { status: 422 })

  const verifyRes = await fetch(
    `https://api.judge.me/api/v1/reviews?shop_domain=${store.shopify_domain}&per_page=1`,
    { headers: { 'X-Api-Token': judgeme_api_token } },
  )
  if (!verifyRes.ok) {
    return NextResponse.json({ error: 'Invalid Judge.me API token' }, { status: 422 })
  }

  await admin.from('stores').update({
    judgeme_api_token,
    ...(judgeme_webhook_secret ? { judgeme_webhook_secret } : {}),
  }).eq('id', store.id)

  // Register webhook so Judge.me pushes new reviews to Heard — failure never blocks wizard
  let webhook_registered = false
  try {
    const webhookRes = await fetch(
      `https://api.judge.me/api/v1/webhooks?shop_domain=${store.shopify_domain}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Api-Token': judgeme_api_token },
        body: JSON.stringify({ webhook: { key: 'review/created', url: 'https://heard.apol.ai/api/webhooks/judgeme' } }),
      },
    )
    webhook_registered = webhookRes.ok
  } catch {
    // Non-fatal — merchant can still use manual sweep; webhook can be registered later
  }

  // Import existing reviews: extract replied ones for brand voice grounding, backfill unreplied
  // ones into reviews table so the agent can draft replies for them — failure never blocks wizard
  let imported_replies: string[] = []
  let review_count = 0
  let reply_count = 0
  let backfilled_count = 0
  try {
    const importRes = await fetch(
      `https://api.judge.me/api/v1/reviews?shop_domain=${store.shopify_domain}&per_page=100`,
      { headers: { 'X-Api-Token': judgeme_api_token } },
    )
    if (importRes.ok) {
      const importData = await importRes.json() as { reviews?: Record<string, unknown>[]; total?: number }
      const reviews = importData.reviews ?? []
      review_count = importData.total ?? reviews.length
      const pendingRows: Record<string, unknown>[] = []
      for (const review of reviews) {
        const replyText = extractReplyText(review)
        if (replyText) {
          imported_replies.push(replyText)
          reply_count++
        } else if (review.id) {
          // List API returns product_title / product_handle at top level (not nested under product)
          const reviewer = review.reviewer as Record<string, unknown> | undefined
          pendingRows.push({
            store_id:       store.id,
            external_id:    String(review.id),
            source:         'judgeme',
            reviewer_name:  (reviewer?.name as string | undefined) ?? 'Anonymous',
            rating:         (review.rating as number | undefined) ?? 3,
            title:          (review.title as string | null | undefined) ?? null,
            body:           (review.body as string | undefined) ?? '',
            product_title:  (review.product_title as string | null | undefined) ?? null,
            product_handle: (review.product_handle as string | null | undefined) ?? null,
            order_id:       reviewer?.external_id != null ? String(reviewer.external_id) : null,
            status:         'pending',
            received_at:    (review.created_at as string | undefined) ?? new Date().toISOString(),
            raw_payload:    review,
          })
        }
      }
      // Cap at 20 replies — enough for brand voice grounding, avoid bloating sample_replies
      imported_replies = imported_replies.slice(0, 20)
      if (pendingRows.length > 0) {
        const { error: backfillErr } = await admin
          .from('reviews')
          .upsert(pendingRows, { onConflict: 'external_id,store_id', ignoreDuplicates: true })
        if (!backfillErr) backfilled_count = pendingRows.length
      }
    }
  } catch {
    // Import failure is non-fatal — return empty arrays below
  }

  return NextResponse.json({ ok: true, imported_replies, review_count, reply_count, webhook_registered, backfilled_count })
}
