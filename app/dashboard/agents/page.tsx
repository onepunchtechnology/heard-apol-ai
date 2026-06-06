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
      .order('received_at', { ascending: false })
      .limit(30),
    supabase.from('stores').select('store_name').maybeSingle(),
  ])

  return (
    <AgentsClient
      runs={runs ?? []}
      reviews={recentReviews ?? []}
      storeName={(storeData as { store_name: string | null } | null)?.store_name ?? null}
    />
  )
}
