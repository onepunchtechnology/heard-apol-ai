import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PUT(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { sample_replies, rules, tone_description } = await request.json()

  const admin = createAdminClient()
  const { data: store } = await admin.from('stores').select('id').eq('user_id', user.id).maybeSingle()
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

  await admin.from('brand_voice_config').upsert(
    {
      store_id: store.id,
      sample_replies: sample_replies ?? [],
      rules: rules ?? [],
      tone_description: tone_description ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'store_id' },
  )

  return NextResponse.json({ ok: true })
}
