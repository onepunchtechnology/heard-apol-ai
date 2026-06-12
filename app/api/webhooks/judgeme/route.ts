import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

type JudgeMeWebhookPayload = {
  review?: {
    id?: string | number
    reviewer?: {
      name?: string | null
      external_id?: string | number | null
    } | null
    rating?: number | null
    title?: string | null
    body?: string | null
    product?: {
      name?: string | null
      handle?: string | null
    } | null
    created_at?: string | null
  }
}

export async function POST(request: NextRequest) {
  // Judge.me does not sign webhooks — their API has no secret/HMAC mechanism.
  // Store lookup by shopify_domain is the authenticity check.
  const shopDomain = request.headers.get('x-judgeme-shop-domain')
  if (!shopDomain) {
    return NextResponse.json({ error: 'Missing shop domain' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data: storeData } = await supabase
    .from('stores')
    .select('id')
    .eq('shopify_domain', shopDomain)
    .maybeSingle()

  if (!storeData) {
    return NextResponse.json({ error: 'Store not found' }, { status: 404 })
  }

  const store = storeData as { id: string }

  let payload: JudgeMeWebhookPayload
  try {
    payload = await request.json() as JudgeMeWebhookPayload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const review = payload?.review
  if (!review) {
    return NextResponse.json({ error: 'Missing review payload' }, { status: 400 })
  }

  const { data: savedReview } = await supabase
    .from('reviews')
    .upsert(
      {
        store_id:       store.id,
        external_id:    String(review.id),
        source:         'judgeme',
        reviewer_name:  review.reviewer?.name ?? 'Anonymous',
        rating:         review.rating,
        title:          review.title ?? null,
        body:           review.body ?? '',
        product_title:  review.product?.name ?? null,
        product_handle: review.product?.handle ?? null,
        order_id:       review.reviewer?.external_id ?? null,
        status:         'pending',
        received_at:    review.created_at ?? new Date().toISOString(),
        raw_payload:    payload,
      },
      { onConflict: 'external_id,store_id', ignoreDuplicates: true },
    )
    .select('id')
    .maybeSingle()

  if (savedReview) {
    const savedReviewTyped = savedReview as { id: string }
    triggerAgent(savedReviewTyped.id, store.id).catch(console.error)
  }

  return NextResponse.json({ ok: true })
}

async function triggerAgent(reviewId: string, storeId: string) {
  if (!process.env.GCP_PROJECT_NUMBER) return

  const { triggerCloudRunJob } = await import('@/lib/agent-trigger')
  await triggerCloudRunJob({ mode: 'single', storeId, reviewId })
}
