import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const { email } = await request.json() as { email: string }

  const demoEmail = process.env.DEMO_ACCOUNT_EMAIL
  if (demoEmail && email.trim().toLowerCase() === demoEmail.toLowerCase()) {
    const admin = createAdminClient()
    const { data, error } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: demoEmail,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/confirm?next=/dashboard`,
      },
    })
    if (error || !data?.properties?.action_link) {
      return NextResponse.json({ error: 'Demo login unavailable' }, { status: 500 })
    }
    const hashedToken = data.properties.hashed_token
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
    const confirmUrl = hashedToken
      ? `${appUrl}/auth/confirm?token_hash=${hashedToken}&type=magiclink&next=/dashboard`
      : data.properties.action_link
    return NextResponse.json({ demo: true, url: confirmUrl })
  }

  return NextResponse.json({ demo: false })
}
