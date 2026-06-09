import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { triggerCloudRunJob } from '@/lib/agent-trigger'

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

  if (!process.env.GCP_PROJECT_NUMBER) {
    return NextResponse.json({ error: 'Cloud Run not configured' }, { status: 503 })
  }

  const store = storeData as { id: string }

  try {
    await triggerCloudRunJob({
      mode,
      storeId: store.id,
      reviewId: reviewId ?? undefined,
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
