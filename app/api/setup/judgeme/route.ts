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
    `https://judge.me/api/v1/reviews?api_token=${judgeme_api_token}&shop_domain=${store.shopify_domain}&per_page=1`,
  )
  if (!verifyRes.ok) {
    return NextResponse.json({ error: 'Invalid Judge.me API token' }, { status: 422 })
  }

  await admin.from('stores').update({
    judgeme_api_token,
    ...(judgeme_webhook_secret ? { judgeme_webhook_secret } : {}),
  }).eq('id', store.id)

  // Import existing replied reviews for brand voice grounding — failure never blocks wizard
  let imported_replies: string[] = []
  let review_count = 0
  let reply_count = 0
  try {
    const importRes = await fetch(
      `https://judge.me/api/v1/reviews?api_token=${judgeme_api_token}&shop_domain=${store.shopify_domain}&per_page=100`,
    )
    if (importRes.ok) {
      const importData = await importRes.json() as { reviews?: Record<string, unknown>[]; total?: number }
      const reviews = importData.reviews ?? []
      review_count = importData.total ?? reviews.length
      for (const review of reviews) {
        const replyText = extractReplyText(review)
        if (replyText) {
          imported_replies.push(replyText)
          reply_count++
        }
      }
      // Cap at 20 replies — enough for brand voice grounding, avoid bloating sample_replies
      imported_replies = imported_replies.slice(0, 20)
    }
  } catch {
    // Import failure is non-fatal — return empty arrays below
  }

  return NextResponse.json({ ok: true, imported_replies, review_count, reply_count })
}
