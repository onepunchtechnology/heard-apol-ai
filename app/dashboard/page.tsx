import { createClient } from '@/lib/supabase/server'
import ActivityClient from './ActivityClient'

export default async function ActivityPage() {
  const supabase = await createClient()

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { data: latestRun },
    { count: autoPostedCount },
    { count: escalatedCount },
    { count: totalCount },
    { data: recentEscalated },
    { data: trendRows },
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
    supabase
      .from('reviews')
      .select('received_at')
      .eq('status', 'auto_posted')
      .gte('received_at', sevenDaysAgo),
  ])

  // Bucket auto-posted count by day for the last 7 days (Mon=0 ... Sun=6 relative to today)
  const today = new Date()
  const trend = Array.from({ length: 7 }, (_, i) => {
    const dayStart = new Date(today)
    dayStart.setDate(dayStart.getDate() - (6 - i))
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(dayStart)
    dayEnd.setDate(dayEnd.getDate() + 1)
    return (trendRows ?? []).filter((r) => {
      const t = new Date(r.received_at)
      return t >= dayStart && t < dayEnd
    }).length
  })

  const stats = {
    autoPosted: autoPostedCount ?? 0,
    escalated: escalatedCount ?? 0,
    total: totalCount ?? 0,
    lastRunAt: latestRun ? (latestRun as { completed_at: string | null }).completed_at : null,
  }

  return <ActivityClient stats={stats} recentEscalated={recentEscalated ?? []} trend={trend} />
}
