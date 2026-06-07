import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

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

  return NextResponse.redirect(data.properties.action_link)
}
