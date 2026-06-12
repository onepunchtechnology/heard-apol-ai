import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const demoEmail = process.env.DEMO_ACCOUNT_EMAIL
  if (!demoEmail) return NextResponse.redirect(new URL('/login', request.url))

  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: demoEmail,
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/confirm?next=/dashboard`,
    },
  })

  if (error || !data?.properties?.action_link) {
    return NextResponse.redirect(new URL('/login?error=demo', request.url))
  }

  const hashedToken = data.properties.hashed_token
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin
  if (hashedToken) {
    const confirmUrl = `${appUrl}/auth/confirm?token_hash=${hashedToken}&type=magiclink&next=/dashboard`
    return NextResponse.redirect(confirmUrl)
  }

  return NextResponse.redirect(data.properties.action_link)
}
