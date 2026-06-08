import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Database } from '@/lib/types/database'

type ReviewRow = Database['public']['Tables']['reviews']['Row']
type StoreRow = Database['public']['Tables']['stores']['Row']

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: reviewId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { reply } = await request.json()

  const admin = createAdminClient()

  const { data: reviewData } = await admin
    .from('reviews')
    .select('id, source, external_id, store_id')
    .eq('id', reviewId)
    .maybeSingle()

  if (!reviewData) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const review = reviewData as Pick<ReviewRow, 'id' | 'source' | 'external_id' | 'store_id'>

  const { data: storeData } = await admin
    .from('stores')
    .select('user_id, shopify_domain, judgeme_api_token, google_connection_mode')
    .eq('id', review.store_id)
    .maybeSingle()

  if (!storeData) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const store = storeData as Pick<StoreRow, 'user_id' | 'shopify_domain' | 'judgeme_api_token' | 'google_connection_mode'>

  if (store.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let posted = false
  let postError: string | null = null

  if (review.source === 'judgeme' && store.judgeme_api_token) {
    const replyUrl = `https://api.judge.me/api/v1/replies?shop_domain=${encodeURIComponent(store.shopify_domain ?? '')}`
    const res = await fetch(replyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Token': store.judgeme_api_token,
      },
      body: JSON.stringify({
        review_id: Number(review.external_id),
        reply: { content: reply },
      }),
    })
    posted = res.ok
    if (!res.ok) postError = await res.text()
  } else if (review.source === 'google_business' && store.google_connection_mode === 'api') {
    postError = 'Google API mode not yet implemented'
  }

  // Fail if we were supposed to post to a live platform but couldn't.
  // Google manual_paste approvals are intentionally silent (merchant posts manually).
  const shouldHavePosted =
    (review.source === 'judgeme' && !!store.judgeme_api_token) ||
    (review.source === 'google_business' && store.google_connection_mode === 'api')
  if (shouldHavePosted && !posted) {
    const msg = postError ?? 'Reply could not be posted to the review platform'
    return NextResponse.json({ error: msg }, { status: 502 })
  }

  await admin.from('reviews').update({ status: 'approved' }).eq('id', reviewId)
  await admin
    .from('review_actions')
    .update({ final_reply: reply, reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq('review_id', reviewId)

  // Learning loop: add approved reply to brand voice learned_replies (non-blocking)
  try {
    const { data: bvData } = await admin
      .from('brand_voice_config')
      .select('id, learned_replies')
      .eq('store_id', review.store_id)
      .maybeSingle()
    if (bvData) {
      const current = (bvData.learned_replies as string[]) ?? []
      const deduped = [reply, ...current.filter((r: string) => r !== reply)]
      await admin
        .from('brand_voice_config')
        .update({ learned_replies: deduped.slice(0, 20) })
        .eq('id', bvData.id)
    }
  } catch {
    // Non-critical — never block the approval response
  }

  return NextResponse.json({ ok: true })
}
