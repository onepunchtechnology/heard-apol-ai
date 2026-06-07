import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PUT(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { reply_mode } = await request.json()
  if (reply_mode !== 'auto_post' && reply_mode !== 'manual_approval') {
    return NextResponse.json({ error: 'Invalid reply_mode' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: store } = await admin.from('stores').select('id').eq('user_id', user.id).maybeSingle()
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

  await admin.from('stores').update({ reply_mode }).eq('id', store.id)

  return NextResponse.json({ ok: true })
}
