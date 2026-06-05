import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

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
  if (!store) return NextResponse.json({ error: 'Complete Shopify setup first' }, { status: 422 })

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

  return NextResponse.json({ ok: true })
}
