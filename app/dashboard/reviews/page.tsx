import { createClient } from '@/lib/supabase/server'
import ReviewsClient from './ReviewsClient'

export default async function ReviewsPage() {
  const supabase = await createClient()

  const { data: reviews } = await supabase
    .from('reviews')
    .select(`
      id, reviewer_name, rating, title, body, source, received_at, status, product_title,
      review_actions (
        id, risk_score, risk_flags, sentiment_label, agent_reasoning, draft_reply,
        final_reply, order_context, agent_trace, confidence
      )
    `)
    .in('status', ['needs_review', 'reply_pending_manual', 'auto_posted', 'approved'])
    .order('received_at', { ascending: false })
    .limit(50)

  return <ReviewsClient reviews={reviews ?? []} />
}
