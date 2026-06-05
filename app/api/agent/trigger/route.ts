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

  const store = storeData as { id: string }

  const jobName = process.env.CLOUD_RUN_JOB_NAME
  const project = process.env.GOOGLE_CLOUD_PROJECT
  const region = process.env.CLOUD_RUN_JOB_REGION ?? 'us-central1'

  if (!jobName || !project) {
    return NextResponse.json({ error: 'Cloud Run not configured' }, { status: 503 })
  }

  const url = `https://run.googleapis.com/v2/projects/${project}/locations/${region}/jobs/${jobName}:run`

  const { GoogleAuth } = await import('google-auth-library')
  const auth = new GoogleAuth({ scopes: 'https://www.googleapis.com/auth/cloud-platform' })
  const client = await auth.getClient()
  const token = await client.getAccessToken()

  const envVars = [
    { name: 'MODE', value: mode },
    { name: 'STORE_ID', value: store.id },
    ...(reviewId ? [{ name: 'REVIEW_ID', value: reviewId }] : []),
  ]

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      overrides: { containerOverrides: [{ env: envVars }] },
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    return NextResponse.json({ error: text }, { status: 502 })
  }

  return NextResponse.json({ ok: true })
}
