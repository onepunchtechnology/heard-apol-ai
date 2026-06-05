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

  const { reply } = await request.json()

  const admin = createAdminClient()

  await admin.from('reviews').update({ status: 'approved' }).eq('id', reviewId)
  await admin
    .from('review_actions')
    .update({ final_reply: reply, reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq('review_id', reviewId)

  return NextResponse.json({ ok: true })
}
