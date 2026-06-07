import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const SHOPIFY_DOMAIN_RE = /^[a-zA-Z0-9-]+\.myshopify\.com$/

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', request.url))

  const rawShop = request.nextUrl.searchParams.get('shop') ?? ''
  const shop = rawShop.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase()

  if (!SHOPIFY_DOMAIN_RE.test(shop)) {
    return NextResponse.json({ error: 'Invalid shop domain' }, { status: 400 })
  }

  const state = crypto.randomUUID()
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/shopify/callback`
  const authUrl =
    `https://${shop}/admin/oauth/authorize` +
    `?client_id=${process.env.SHOPIFY_API_KEY}` +
    `&scope=read_orders` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${state}`

  const response = NextResponse.redirect(authUrl)
  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const, // lax required — Strict blocks the redirect back from Shopify
    maxAge: 600,
    path: '/',
  }
  response.cookies.set('shopify_oauth_state', state, cookieOpts)
  response.cookies.set('shopify_oauth_shop', shop, cookieOpts)
  return response
}
