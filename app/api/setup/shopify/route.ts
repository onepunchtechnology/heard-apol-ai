import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { store_domain, access_token } = await request.json()
  if (!store_domain || !access_token) {
    return NextResponse.json({ error: 'store_domain and access_token required' }, { status: 400 })
  }

  const domain = store_domain.replace(/^https?:\/\//, '').replace(/\/$/, '')
  if (!/^[a-zA-Z0-9-]+\.myshopify\.com$/.test(domain)) {
    return NextResponse.json({ error: 'store_domain must be a *.myshopify.com address' }, { status: 400 })
  }

  const res = await fetch(`https://${domain}/admin/api/2026-01/shop.json`, {
    headers: { 'X-Shopify-Access-Token': access_token },
  })
  if (!res.ok) {
    return NextResponse.json({ error: 'Invalid Shopify credentials' }, { status: 422 })
  }

  const shopData = await res.json()
  const storeName = shopData?.shop?.name ?? null

  const admin = createAdminClient()
  await admin.from('stores').upsert(
    {
      user_id: user.id,
      store_domain: domain,
      store_name: storeName,
      platform: 'shopify',
      platform_access_token: access_token,
    },
    { onConflict: 'user_id' },
  )

  return NextResponse.json({ ok: true })
}
