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

  const { draft } = await request.json()
  if (typeof draft !== 'string') {
    return NextResponse.json({ error: 'draft is required' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: review } = await admin
    .from('reviews')
    .select('store_id')
    .eq('id', reviewId)
    .maybeSingle()
  if (!review) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: store } = await admin
    .from('stores')
    .select('user_id')
    .eq('id', review.store_id)
    .maybeSingle()
  if (!store || store.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await admin
    .from('review_actions')
    .update({ draft_reply: draft })
    .eq('review_id', reviewId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
