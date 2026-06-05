import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Database } from '@/lib/types/database'

type StoreRow = Database['public']['Tables']['stores']['Row']

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const signature = request.headers.get('JUDGEME-HMAC-SHA256')

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 401 })
  }

  const supabase = createAdminClient()

  const shopDomain = request.headers.get('x-judgeme-shop-domain')
  if (!shopDomain) {
    return NextResponse.json({ error: 'Missing shop domain' }, { status: 400 })
  }

  const { data: storeData } = await supabase
    .from('stores')
    .select('id, judgeme_webhook_secret')
    .eq('shopify_domain', shopDomain)
    .maybeSingle()

  if (!storeData) {
    return NextResponse.json({ error: 'Store not found' }, { status: 404 })
  }

  const store = storeData as Pick<StoreRow, 'id' | 'judgeme_webhook_secret'>

  if (!store.judgeme_webhook_secret) {
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 404 })
  }

  const expectedSig = crypto
    .createHmac('sha256', store.judgeme_webhook_secret)
    .update(rawBody)
    .digest('base64')

  if (
    !crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSig),
    )
  ) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const payload = JSON.parse(rawBody)
  const review = payload.review

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
  const jobName = process.env.CLOUD_RUN_JOB_NAME
  const project = process.env.GOOGLE_CLOUD_PROJECT
  const region = process.env.CLOUD_RUN_JOB_REGION ?? 'us-central1'

  if (!jobName || !project) return

  const url = `https://run.googleapis.com/v2/projects/${project}/locations/${region}/jobs/${jobName}:run`

  const { GoogleAuth } = await import('google-auth-library')
  const auth = new GoogleAuth({ scopes: 'https://www.googleapis.com/auth/cloud-platform' })
  const client = await auth.getClient()
  const token = await client.getAccessToken()

  await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      overrides: {
        containerOverrides: [{
          env: [
            { name: 'MODE', value: 'single' },
            { name: 'REVIEW_ID', value: reviewId },
            { name: 'STORE_ID', value: storeId },
          ],
        }],
      },
    }),
  })
}
