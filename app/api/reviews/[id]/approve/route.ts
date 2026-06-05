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
    const res = await fetch(`https://judge.me/api/v1/reviews/${review.external_id}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shopify_domain: store.shopify_domain,
        api_token: store.judgeme_api_token,
        reply: { body: reply },
      }),
    })
    posted = res.ok
    if (!res.ok) postError = await res.text()
  } else if (review.source === 'google_business' && store.google_connection_mode === 'api') {
    postError = 'Google API mode not yet implemented'
  }

  if (!posted && postError) {
    return NextResponse.json({ error: postError }, { status: 502 })
  }

  await admin.from('reviews').update({ status: 'approved' }).eq('id', reviewId)
  await admin
    .from('review_actions')
    .update({ final_reply: reply, reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq('review_id', reviewId)

  return NextResponse.json({ ok: true })
}
