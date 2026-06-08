import { createHmac, timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

const SHOPIFY_DOMAIN_RE = /^[a-zA-Z0-9-]+\.myshopify\.com$/
const SHOPIFY_API_VERSION = '2026-01'

function verifyHmac(params: URLSearchParams, secret: string, provided: string): boolean {
  const entries: Record<string, string> = {}
  params.forEach((value, key) => { if (key !== 'hmac') entries[key] = value })
  const message = Object.keys(entries).sort().map(k => `${k}=${entries[k]}`).join('&')
  const computed = createHmac('sha256', secret).update(message).digest()
  let providedBuf: Buffer
  try {
    providedBuf = Buffer.from(provided, 'hex')
  } catch {
    return false
  }
  return providedBuf.length === computed.length && timingSafeEqual(providedBuf, computed)
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const shop = searchParams.get('shop') ?? ''
  const code = searchParams.get('code') ?? ''
  const hmac = searchParams.get('hmac') ?? ''
  const state = searchParams.get('state') ?? ''

  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`/setup?error=${reason}`, request.url))

  if (!SHOPIFY_DOMAIN_RE.test(shop)) return fail('invalid_shop')

  const storedState = request.cookies.get('shopify_oauth_state')?.value
  if (storedState && storedState !== state) return fail('invalid_state')

  const apiSecret = process.env.SHOPIFY_API_SECRET
  if (!apiSecret) return fail('misconfigured')

  if (!verifyHmac(searchParams, apiSecret, hmac)) return fail('invalid_hmac')

  // Exchange code for access token
  const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.SHOPIFY_API_KEY,
      client_secret: apiSecret,
      code,
    }),
  })
  if (!tokenRes.ok) return fail('token_exchange')
  const { access_token } = await tokenRes.json() as { access_token: string }

  // Fetch shop metadata — provides public domain and display name
  const shopRes = await fetch(
    `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/shop.json`,
    { headers: { 'X-Shopify-Access-Token': access_token } },
  )
  const shopJson = shopRes.ok
    ? ((await shopRes.json()) as { shop?: { name?: string; domain?: string } })?.shop
    : null
  const storeName: string | null = shopJson?.name ?? null
  // shop.domain is the primary domain (e.g. ohayopop.com); fall back to myshopify domain if unavailable
  const storeDomain: string = shopJson?.domain ?? shop

  // Session cookie is present on return from Shopify (same domain, first-party)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', request.url))

  const admin = createAdminClient()
  await admin.from('stores').upsert(
    {
      user_id: user.id,
      store_domain: storeDomain,   // public domain (e.g. ohayopop.com)
      shopify_domain: shop,         // myshopify domain for Admin API + Judge.me
      store_name: storeName,
      platform: 'shopify',
      platform_access_token: access_token,
    },
    { onConflict: 'user_id' },
  )

  const response = NextResponse.redirect(
    new URL(`/setup?shopify=connected&shop=${encodeURIComponent(shop)}`, request.url),
  )
  response.cookies.delete('shopify_oauth_state')
  response.cookies.delete('shopify_oauth_shop')
  return response
}
