import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { reviewId, mode = 'single' } = await request.json()

  const serviceSupabase = await createServiceClient()
  const { data: storeData } = await serviceSupabase
    .from('stores')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!storeData) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

  const triggerUrl = process.env.CLOUD_RUN_TRIGGER_URL
  const triggerSecret = process.env.INTERNAL_AGENT_TRIGGER_SECRET

  if (!triggerUrl || !triggerSecret) {
    return NextResponse.json({ error: 'Cloud Run not configured' }, { status: 503 })
  }

  const store = storeData as { id: string }
  const body: Record<string, string> = { mode, store_id: store.id }
  if (reviewId) body.review_id = reviewId

  const res = await fetch(triggerUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${triggerSecret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    return NextResponse.json({ error: text }, { status: 502 })
  }

  return NextResponse.json({ ok: true })
}
