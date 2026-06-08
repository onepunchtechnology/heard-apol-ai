import { createClient } from '@/lib/supabase/server'
import AgentsClient from './AgentsClient'

export default async function AgentsPage() {
  const supabase = await createClient()

  const [{ data: runs }, { data: recentReviews }, { data: storeData }] = await Promise.all([
    supabase
      .from('agent_runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(20),
    supabase
      .from('reviews')
      .select(`
        id, reviewer_name, rating, body, source, received_at, status, product_title, store_id,
        review_actions (
          id, risk_score, sentiment_label, agent_reasoning, agent_trace, draft_reply, decision, confidence, auto_posted_at
        )
      `)
      .not('status', 'eq', 'pending')
      .not('status', 'eq', 'imported')
      .order('received_at', { ascending: false })
      .limit(30),
    supabase.from('stores').select('store_name').maybeSingle(),
  ])

  const durationMap: Record<string, number> = {}
  for (const run of runs ?? []) {
    const r = run as typeof run & { review_ids?: string[] }
    if (r.completed_at && r.review_ids?.length) {
      const secs = (new Date(r.completed_at).getTime() - new Date(r.started_at).getTime()) / 1000
      for (const rid of r.review_ids) {
        durationMap[rid] = secs
      }
    }
  }

  return (
    <AgentsClient
      runs={runs ?? []}
      reviews={recentReviews ?? []}
      storeName={(storeData as { store_name: string | null } | null)?.store_name ?? null}
      durations={durationMap}
    />
  )
}
