import { createClient } from '@/lib/supabase/server'
import AgentsClient from './AgentsClient'

export default async function AgentsPage() {
  const supabase = await createClient()

  const { data: runs } = await supabase
    .from('agent_runs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(20)

  const { data: recentReviews } = await supabase
    .from('reviews')
    .select(`
      id, reviewer_name, rating, body, source, received_at, status, product_title,
      review_actions (
        id, risk_score, sentiment_label, agent_reasoning, agent_trace, draft_reply, decision
      )
    `)
    .not('status', 'eq', 'pending')
    .order('received_at', { ascending: false })
    .limit(30)

  return <AgentsClient runs={runs ?? []} reviews={recentReviews ?? []} />
}
