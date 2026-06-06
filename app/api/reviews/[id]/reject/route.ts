import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: reviewId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: reviewData } = await admin
    .from('reviews')
    .select('store_id')
    .eq('id', reviewId)
    .maybeSingle()

  if (!reviewData) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: storeData } = await admin
    .from('stores')
    .select('user_id')
    .eq('id', reviewData.store_id)
    .maybeSingle()

  if (!storeData || storeData.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await admin.from('reviews').update({ status: 'rejected' }).eq('id', reviewId)
  await admin
    .from('review_actions')
    .update({ reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq('review_id', reviewId)

  return NextResponse.json({ ok: true })
}
