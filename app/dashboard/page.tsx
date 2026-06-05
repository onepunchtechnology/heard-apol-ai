import { createClient } from '@/lib/supabase/server'
import ActivityClient from './ActivityClient'

export default async function ActivityPage() {
  const supabase = await createClient()

  const [
    { data: latestRun },
    { count: autoPostedCount },
    { count: escalatedCount },
    { count: totalCount },
    { data: recentEscalated },
  ] = await Promise.all([
    supabase
      .from('agent_runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('reviews')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'auto_posted'),
    supabase
      .from('reviews')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'needs_review'),
    supabase
      .from('reviews')
      .select('*', { count: 'exact', head: true })
      .not('status', 'eq', 'pending'),
    supabase
      .from('reviews')
      .select(`
        id, reviewer_name, rating, body, source, received_at, status,
        review_actions (risk_score, sentiment_label, agent_reasoning)
      `)
      .eq('status', 'needs_review')
      .order('received_at', { ascending: false })
      .limit(5),
  ])

  const stats = {
    autoPosted: autoPostedCount ?? 0,
    escalated: escalatedCount ?? 0,
    total: totalCount ?? 0,
    lastRunAt: latestRun ? (latestRun as { completed_at: string | null }).completed_at : null,
  }

  return <ActivityClient stats={stats} recentEscalated={recentEscalated ?? []} />
}
