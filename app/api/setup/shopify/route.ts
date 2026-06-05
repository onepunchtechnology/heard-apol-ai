import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { shopify_domain, shopify_access_token } = await request.json()
  if (!shopify_domain || !shopify_access_token) {
    return NextResponse.json({ error: 'shopify_domain and shopify_access_token required' }, { status: 400 })
  }

  const domain = shopify_domain.replace(/^https?:\/\//, '').replace(/\/$/, '')

  const res = await fetch(`https://${domain}/admin/api/2026-01/shop.json`, {
    headers: { 'X-Shopify-Access-Token': shopify_access_token },
  })
  if (!res.ok) {
    return NextResponse.json({ error: 'Invalid Shopify credentials' }, { status: 422 })
  }

  const admin = createAdminClient()
  const { data: existing } = await admin.from('stores').select('id').eq('user_id', user.id).maybeSingle()

  if (existing) {
    await admin.from('stores').update({ shopify_domain: domain, shopify_access_token }).eq('id', existing.id)
  } else {
    await admin.from('stores').insert({ user_id: user.id, shopify_domain: domain, shopify_access_token })
  }

  return NextResponse.json({ ok: true })
}
