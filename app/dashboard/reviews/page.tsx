import { createClient } from '@/lib/supabase/server'
import ReviewsClient from './ReviewsClient'

export default async function ReviewsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: reviews }, { data: storeData }] = await Promise.all([
    supabase
      .from('reviews')
      .select(`
        id, reviewer_name, rating, title, body, source, received_at, status, product_title,
        review_actions (
          id, risk_score, risk_flags, sentiment_label, agent_reasoning, draft_reply,
          final_reply, order_context, agent_trace, confidence, decision
        )
      `)
      .in('status', ['pending', 'processing', 'needs_review', 'reply_pending_manual', 'auto_posted', 'approved'])
      .order('received_at', { ascending: false })
      .limit(50),
    supabase
      .from('stores')
      .select('reply_mode')
      .eq('user_id', user!.id)
      .maybeSingle(),
  ])

  const replyMode = (storeData as { reply_mode: 'auto_post' | 'manual_approval' } | null)?.reply_mode ?? 'manual_approval'

  return <ReviewsClient reviews={reviews ?? []} replyMode={replyMode} />
}
