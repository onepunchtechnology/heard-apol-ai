import { createClient } from '@/lib/supabase/server'
import ActivityClient from './ActivityClient'

function bucketByDay(rows: { received_at: string }[]): number[] {
  const today = new Date()
  return Array.from({ length: 7 }, (_, i) => {
    const dayStart = new Date(today)
    dayStart.setDate(dayStart.getDate() - (6 - i))
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(dayStart)
    dayEnd.setDate(dayEnd.getDate() + 1)
    return rows.filter(r => {
      const t = new Date(r.received_at)
      return t >= dayStart && t < dayEnd
    }).length
  })
}

export default async function ActivityPage() {
  const supabase = await createClient()

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { data: latestRun },
    { data: allStatuses },
    { count: storeCount },
    { data: recentEscalated },
    { count: totalEscalatedCount },
    { data: repliesTrendRows },
    { data: reviewsTrendRows },
    { data: sentimentRows },
  ] = await Promise.all([
    supabase
      .from('agent_runs')
      .select('completed_at')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('reviews')
      .select('status'),
    supabase
      .from('stores')
      .select('id', { count: 'exact', head: true }),
    supabase
      .from('reviews')
      .select(`
        id, reviewer_name, rating, body, source, received_at, status,
        review_actions (risk_score, sentiment_label, agent_reasoning, draft_reply)
      `)
      .in('status', ['needs_review', 'reply_pending_manual'])
      .order('received_at', { ascending: false })
      .limit(5),
    supabase
      .from('reviews')
      .select('id', { count: 'exact', head: true })
      .in('status', ['needs_review', 'reply_pending_manual']),
    supabase
      .from('reviews')
      .select('received_at')
      .eq('status', 'auto_posted')
      .gte('received_at', sevenDaysAgo),
    supabase
      .from('reviews')
      .select('received_at')
      .not('status', 'eq', 'imported')
      .gte('received_at', sevenDaysAgo),
    supabase
      .from('review_actions')
      .select('sentiment_label'),
  ])

  const statusCounts = (allStatuses ?? []).reduce(
    (acc, r) => {
      if (r.status === 'pending') acc.pending++
      else if (r.status === 'processing') acc.processing++
      else if (r.status === 'needs_review' || r.status === 'reply_pending_manual') acc.needsAttention++
      else if (r.status === 'auto_posted') acc.autoPosted++
      else if (r.status === 'failed') acc.failed++
      else if (r.status === 'imported') acc.imported++
      return acc
    },
    { pending: 0, processing: 0, needsAttention: 0, autoPosted: 0, failed: 0, imported: 0 }
  )

  const sentimentCounts = (sentimentRows ?? []).reduce(
    (acc, r) => {
      const label = (r as { sentiment_label: string | null }).sentiment_label
      if (label === 'positive') acc.positive++
      else if (label === 'negative') acc.negative++
      else if (label === 'neutral') acc.neutral++
      return acc
    },
    { positive: 0, neutral: 0, negative: 0 }
  )

  const { data: { user } } = await supabase.auth.getUser()

  return (
    <ActivityClient
      lastRunAt={(latestRun as { completed_at: string | null } | null)?.completed_at ?? null}
      storeCount={storeCount ?? 1}
      statusCounts={statusCounts}
      sentimentCounts={sentimentCounts}
      reviewsTrend={bucketByDay(reviewsTrendRows ?? [])}
      repliesTrend={bucketByDay(repliesTrendRows ?? [])}
      recentEscalated={recentEscalated ?? []}
      totalEscalatedCount={totalEscalatedCount ?? 0}
      isDemoAccount={user?.email === 'google-hackathon-demo-9c25d0@apol.ai'}
    />
  )
}
