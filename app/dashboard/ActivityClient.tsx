'use client'

import { useState, useEffect, useRef } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList, Cell,
  LineChart, Line, Legend, Tooltip, ResponsiveContainer,
  PieChart, Pie,
} from 'recharts'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { cn, formatDistanceToNow } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'

const BADGE_BASE_CLASS =
  'shadow-none font-normal rounded-sm text-[11px] py-[3px] px-2 leading-none border-transparent'

interface StatusCounts {
  pending: number
  processing: number
  needsAttention: number
  autoPosted: number
  failed: number
  imported: number
}

interface EscalatedAction {
  risk_score: number
  sentiment_label: string
  agent_reasoning: string
  draft_reply: string | null
}

interface EscalatedReview {
  id: string
  reviewer_name: string
  rating: number
  body: string
  source: string
  received_at: string
  status: string
  review_actions: EscalatedAction | EscalatedAction[] | null
}

interface SentimentCounts {
  positive: number
  neutral: number
  negative: number
}

interface ActivityClientProps {
  lastRunAt: string | null
  statusCounts: StatusCounts
  sentimentCounts: SentimentCounts
  reviewsTrend: number[]
  repliesTrend: number[]
  recentEscalated: EscalatedReview[]
  totalEscalatedCount: number
  isDemoAccount?: boolean
}

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

function computeStatusCounts(rows: { status: string }[]): StatusCounts {
  return rows.reduce(
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
}

export default function ActivityClient({
  lastRunAt: initialLastRunAt,
  statusCounts: initialStatusCounts,
  sentimentCounts: initialSentimentCounts,
  reviewsTrend: initialReviewsTrend,
  repliesTrend: initialRepliesTrend,
  recentEscalated: initialEscalated,
  totalEscalatedCount: initialTotalEscalatedCount,
  isDemoAccount,
}: ActivityClientProps) {
  const [lastRunAt, setLastRunAt] = useState<string | null>(initialLastRunAt)
  const [statusCounts, setStatusCounts] = useState<StatusCounts>(initialStatusCounts)
  const [sentimentCounts, setSentimentCounts] = useState<SentimentCounts>(initialSentimentCounts)
  const [reviewsTrend, setReviewsTrend] = useState<number[]>(initialReviewsTrend)
  const [repliesTrend, setRepliesTrend] = useState<number[]>(initialRepliesTrend)
  const [recentEscalated, setRecentEscalated] = useState<EscalatedReview[]>(initialEscalated)
  const [totalEscalatedCount, setTotalEscalatedCount] = useState<number>(initialTotalEscalatedCount)

  useEffect(() => {
    const supabase = createClient()

    async function refreshStats() {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

      const [
        { data: runs },
        { data: latestStatuses },
        { data: escalated },
        { count: freshTotalEscalated },
        { data: newRepliesRows },
        { data: newReviewsRows },
        { data: sentimentRows },
      ] = await Promise.all([
        supabase
          .from('agent_runs')
          .select('completed_at')
          .order('started_at', { ascending: false })
          .limit(1),
        supabase
          .from('reviews')
          .select('status'),
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

      setLastRunAt((runs?.[0] as { completed_at: string | null } | undefined)?.completed_at ?? null)
      setStatusCounts(computeStatusCounts(latestStatuses ?? []))
      setTotalEscalatedCount(freshTotalEscalated ?? 0)
      setSentimentCounts(
        (sentimentRows ?? []).reduce(
          (acc, r) => {
            const label = (r as { sentiment_label: string | null }).sentiment_label
            if (label === 'positive') acc.positive++
            else if (label === 'negative') acc.negative++
            else if (label === 'neutral') acc.neutral++
            return acc
          },
          { positive: 0, neutral: 0, negative: 0 }
        )
      )
      setRepliesTrend(bucketByDay(newRepliesRows ?? []))
      setReviewsTrend(bucketByDay(newReviewsRows ?? []))
      setRecentEscalated((escalated ?? []) as EscalatedReview[])
    }

    const channel = supabase
      .channel('activity-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reviews' }, refreshStats)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agent_runs' }, refreshStats)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  return (
    <div className="p-8 w-full max-w-5xl">
      {/* Row 1: Hackathon panel */}
      {isDemoAccount && <HackathonPanel />}

      {lastRunAt && (
        <p className="mb-5 text-xs text-muted">
          last reply {formatDistanceToNow(lastRunAt)} ago
        </p>
      )}

      {/* Row 2: Trend chart (full width) */}
      <div className="mb-6">
        <ReviewsTrendChart reviewsTrend={reviewsTrend} repliesTrend={repliesTrend} />
      </div>

      {/* Row 3: Pipeline + Sentiment */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        <StatusPipelineChart statusCounts={statusCounts} />
        <SentimentPieChart sentimentCounts={sentimentCounts} />
      </div>

      {/* Row 4: Escalation queue */}
      <EscalationQueue reviews={recentEscalated} totalCount={totalEscalatedCount} />
    </div>
  )
}

function StatusPipelineChart({ statusCounts }: { statusCounts: StatusCounts }) {
  const pipelineData = [
    { label: 'Imported', value: statusCounts.imported, bg: '#FFF0F7', fg: '#8B003D' },
    { label: 'Pending', value: statusCounts.pending, bg: '#FCF6BD', fg: '#6B5904' },
    { label: 'Processing', value: statusCounts.processing, bg: '#FFD6E9', fg: '#FF479D' },
    { label: 'Needs Attention', value: statusCounts.needsAttention, bg: '#FCEAE4', fg: '#8C4A35' },
    { label: 'Auto-posted', value: statusCounts.autoPosted, bg: '#D0F4DE', fg: '#216F3F' },
    ...(statusCounts.failed > 0
      ? [{ label: 'Failed', value: statusCounts.failed, bg: '#FCEAE4', fg: '#8C4A35' }]
      : []),
  ]

  return (
    <Card className="rounded-md border-border bg-bg shadow-[0_1px_3px_rgba(45,0,19,0.06)]">
      <CardContent className="p-6">
        <p style={{ fontSize: 'var(--text-base)', fontWeight: 500, color: 'var(--color-text)', marginBottom: '4px' }}>
          Review Pipeline
        </p>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', marginBottom: '20px' }}>
          Reviews by current status
        </p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart
            layout="vertical"
            data={pipelineData}
            margin={{ top: 0, right: 36, left: 0, bottom: 0 }}
          >
            <CartesianGrid horizontal={false} stroke="#FFC2DE" strokeDasharray="3 3" />
            <YAxis
              dataKey="label"
              type="category"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: '#8B003D', fontFamily: 'Epilogue, sans-serif' }}
              width={108}
            />
            <XAxis type="number" hide />
            <Tooltip
              cursor={{ fill: '#FFF0F7' }}
              formatter={(value: number) => [value, 'Reviews']}
              contentStyle={{
                borderColor: '#FFC2DE',
                borderRadius: '8px',
                fontSize: '12px',
                fontFamily: 'Epilogue, sans-serif',
                backgroundColor: '#FFFFFF',
                color: '#2D0013',
              }}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={22} minPointSize={2}>
              {pipelineData.map((entry, idx) => (
                <Cell key={`cell-${idx}`} fill={entry.bg} stroke={entry.fg} strokeWidth={0.75} />
              ))}
              <LabelList
                dataKey="value"
                position="right"
                offset={8}
                style={{ fontSize: '12px', fontFamily: 'Epilogue, sans-serif', fill: '#2D0013', fontWeight: 500 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function ReviewsTrendChart({ reviewsTrend, repliesTrend }: { reviewsTrend: number[]; repliesTrend: number[] }) {
  const today = new Date()
  const chartData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() - (6 - i))
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return {
      tick: `${mm}/${dd} ${WEEKDAYS[d.getDay()]}`,
      reviews: reviewsTrend[i] ?? 0,
      replies: repliesTrend[i] ?? 0,
    }
  })

  const maxVal = Math.max(...reviewsTrend, ...repliesTrend, 4)

  return (
    <Card className="rounded-md border-border bg-bg shadow-[0_1px_3px_rgba(45,0,19,0.06)]">
      <CardContent className="p-6">
        <p style={{ fontSize: 'var(--text-base)', fontWeight: 500, color: 'var(--color-text)', marginBottom: '4px' }}>
          Reviews &amp; Replies
        </p>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', marginBottom: '20px' }}>
          Last 7 days
        </p>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={chartData} margin={{ top: 4, right: 8, left: -8, bottom: 32 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#FFC2DE" vertical={false} />
            <XAxis
              dataKey="tick"
              tickLine={false}
              axisLine={false}
              interval={0}
              tick={<TrendAxisTick />}
            />
            <YAxis
              allowDecimals={false}
              domain={[0, maxVal + 1]}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10, fill: '#8B003D', fontFamily: 'Epilogue, sans-serif' }}
              width={24}
            />
            <Tooltip
              formatter={(value: number, name: string) => [value, name === 'reviews' ? 'Reviews received' : 'Replies posted']}
              contentStyle={{
                borderColor: '#FFC2DE',
                borderRadius: '8px',
                fontSize: '12px',
                fontFamily: 'Epilogue, sans-serif',
                backgroundColor: '#FFFFFF',
                color: '#2D0013',
              }}
            />
            <Legend
              formatter={(value: string) => value === 'reviews' ? 'Reviews received' : 'Replies posted'}
              wrapperStyle={{ fontSize: '11px', fontFamily: 'Epilogue, sans-serif', paddingTop: '8px' }}
              iconType="circle"
              iconSize={8}
            />
            <Line
              type="monotone"
              dataKey="reviews"
              stroke="#8B003D"
              strokeWidth={2}
              dot={{ fill: '#8B003D', r: 3, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="replies"
              stroke="#216F3F"
              strokeWidth={2}
              dot={{ fill: '#216F3F', r: 3, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

const SENTIMENT_COLORS = [
  { label: 'Positive', color: '#D0F4DE', stroke: '#216F3F' },
  { label: 'Neutral', color: '#FCF6BD', stroke: '#6B5904' },
  { label: 'Negative', color: '#FCEAE4', stroke: '#8C4A35' },
]

function SentimentPieChart({ sentimentCounts }: { sentimentCounts: SentimentCounts }) {
  const total = sentimentCounts.positive + sentimentCounts.neutral + sentimentCounts.negative
  const data = [
    { name: 'Positive', value: sentimentCounts.positive },
    { name: 'Neutral', value: sentimentCounts.neutral },
    { name: 'Negative', value: sentimentCounts.negative },
  ]

  return (
    <Card className="rounded-md border-border bg-bg shadow-[0_1px_3px_rgba(45,0,19,0.06)]">
      <CardContent className="p-6">
        <p style={{ fontSize: 'var(--text-base)', fontWeight: 500, color: 'var(--color-text)', marginBottom: '4px' }}>
          Sentiment Analysis
        </p>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', marginBottom: '20px' }}>
          {total} reviews analyzed
        </p>
        {total === 0 ? (
          <div className="flex items-center justify-center" style={{ height: 180 }}>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)' }}>No data yet</p>
          </div>
        ) : (
          <div className="flex items-center gap-6">
            <ResponsiveContainer width="55%" height={180}>
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={72}
                  paddingAngle={2}
                  dataKey="value"
                  strokeWidth={1}
                >
                  {data.map((_, idx) => (
                    <Cell
                      key={`cell-${idx}`}
                      fill={SENTIMENT_COLORS[idx].color}
                      stroke={SENTIMENT_COLORS[idx].stroke}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string) => [value, name]}
                  contentStyle={{
                    borderColor: '#FFC2DE',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontFamily: 'Epilogue, sans-serif',
                    backgroundColor: '#FFFFFF',
                    color: '#2D0013',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-col gap-3">
              {data.map((entry, idx) => {
                const pct = total > 0 ? Math.round((entry.value / total) * 100) : 0
                return (
                  <div key={entry.name} className="flex items-center gap-2">
                    <span
                      className="inline-block rounded-sm flex-shrink-0"
                      style={{
                        width: 10,
                        height: 10,
                        backgroundColor: SENTIMENT_COLORS[idx].color,
                        border: `1px solid ${SENTIMENT_COLORS[idx].stroke}`,
                      }}
                    />
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text)', minWidth: 56 }}>
                      {entry.name}
                    </span>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', fontVariantNumeric: 'tabular-nums' }}>
                      {entry.value} ({pct}%)
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function TrendAxisTick({ x, y, payload }: { x?: number; y?: number; payload?: { value: string } }) {
  if (!x || !y || !payload) return null
  const parts = payload.value.split(' ')
  const date = parts[0]
  const weekday = parts[1]
  return (
    <g transform={`translate(${x},${y})`}>
      <text textAnchor="middle" y={12} fontSize={10} fill="#8B003D" fontFamily="Epilogue, sans-serif">
        {date}
      </text>
      <text textAnchor="middle" y={23} fontSize={9} fill="#8B003D" fontFamily="Epilogue, sans-serif">
        {weekday}
      </text>
    </g>
  )
}

function EscalationQueue({ reviews: initialReviews, totalCount }: { reviews: EscalatedReview[]; totalCount: number }) {
  const [reviews, setReviews] = useState(initialReviews)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => { setReviews(initialReviews) }, [initialReviews])

  function handleApproved(id: string) {
    setExpandedId(null)
    setReviews((prev) => prev.filter((r) => r.id !== id))
  }

  return (
    <Card className="rounded-md border-border bg-bg shadow-[0_1px_3px_rgba(45,0,19,0.06)]">
      <CardHeader className="flex flex-row items-center justify-between px-6 py-4 space-y-0 border-b border-border">
        <div className="flex items-center gap-3">
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 500, color: 'var(--color-text)' }}>
            Escalation Queue
          </h2>
          {totalCount > 0 && (
            <Badge className="shadow-none font-medium rounded-sm text-[11px] py-[3px] px-2 leading-none border-transparent bg-escalate-bg text-escalate hover:bg-escalate-bg">
              {totalCount} need{totalCount !== 1 ? '' : 's'} attention
            </Badge>
          )}
        </div>
        {totalCount > 0 && (
          <a
            href="/dashboard/reviews"
            style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)', textDecoration: 'none' }}
          >
            View all →
          </a>
        )}
      </CardHeader>

      <CardContent className="p-0">
        {reviews.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p
              className="font-display italic"
              style={{ fontSize: 'var(--text-xl)', color: 'var(--color-muted)' }}
            >
              All caught up.
            </p>
            <p className="mt-2" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)' }}>
              No reviews need your attention right now.
            </p>
          </div>
        ) : (
          <div>
            {reviews.map((review, idx) => {
              const action = Array.isArray(review.review_actions)
                ? review.review_actions[0]
                : review.review_actions
              const isLast = idx === reviews.length - 1
              const isExpanded = expandedId === review.id
              const reasonTag =
                action?.sentiment_label === 'negative'
                  ? action.risk_score >= 7
                    ? 'High risk'
                    : 'Negative sentiment'
                  : action?.sentiment_label === 'positive'
                  ? 'Positive'
                  : 'Neutral'

              return (
                <div key={review.id}>
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : review.id)}
                    className="w-full text-left"
                    style={{
                      borderLeft: '3px solid var(--color-escalate)',
                      padding: '12px 24px 12px 21px',
                      cursor: 'pointer',
                      backgroundColor: isExpanded ? 'var(--color-surface)' : 'transparent',
                      transition: 'background-color 0.15s ease',
                      display: 'block',
                      border: 'none',
                      borderLeftStyle: 'solid',
                      borderLeftWidth: '3px',
                      borderLeftColor: 'var(--color-escalate)',
                    }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <StarRating rating={review.rating} />
                      <PlatformBadge source={review.source} />
                      {review.reviewer_name && (
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text)', fontWeight: 500 }}>
                          {review.reviewer_name}
                        </span>
                      )}
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', marginLeft: 'auto', flexShrink: 0 }}>
                        {formatDistanceToNow(review.received_at)} ago
                      </span>
                    </div>
                    <p
                      className={isExpanded ? 'mb-1' : 'line-clamp-1 mb-1'}
                      style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}
                    >
                      {review.body}
                    </p>
                    <div className="flex items-center gap-2">
                      <Badge className={cn(BADGE_BASE_CLASS, 'bg-escalate-bg text-escalate hover:bg-escalate-bg')}>
                        escalated
                      </Badge>
                      {action && (
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)' }}>
                          {reasonTag}
                        </span>
                      )}
                    </div>
                  </button>
                  {isExpanded && action?.draft_reply && (
                    <InlineDraftEditor
                      reviewId={review.id}
                      initialDraft={action.draft_reply}
                      onApproved={() => handleApproved(review.id)}
                    />
                  )}
                  {!isLast && <Separator />}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

const HEARD_FOCUS_CLASS =
  'focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-dim focus-visible:outline-offset-2'

function InlineDraftEditor({
  reviewId,
  initialDraft,
  onApproved,
}: {
  reviewId: string
  initialDraft: string
  onApproved: () => void
}) {
  const [draft, setDraft] = useState(initialDraft)
  const originalDraft = useRef(initialDraft)
  const [saving, setSaving] = useState(false)
  const [posting, setPosting] = useState(false)
  const hasChanges = draft !== originalDraft.current

  async function handleSave() {
    setSaving(true)
    const res = await fetch(`/api/reviews/${reviewId}/save-draft`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ draft }),
    })
    if (res.ok) {
      originalDraft.current = draft
      toast('Draft saved')
    } else {
      toast('Failed to save draft')
    }
    setSaving(false)
  }

  async function handleApprove() {
    setPosting(true)
    const res = await fetch(`/api/reviews/${reviewId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reply: draft }),
    })
    if (res.ok) {
      toast('Reply posted')
      onApproved()
    } else {
      const body = await res.json().catch(() => ({}))
      toast(body.error ?? 'Failed to post reply')
    }
    setPosting(false)
  }

  return (
    <div
      style={{
        borderLeft: '3px solid var(--color-escalate)',
        padding: '0 24px 16px 21px',
        backgroundColor: 'var(--color-surface)',
      }}
    >
      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', marginBottom: '6px' }}>
        Draft reply
      </p>
      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={4}
        className={cn(
          'bg-bg text-sm resize-none font-sans outline-none border-border',
          HEARD_FOCUS_CLASS,
        )}
      />
      <div className="flex items-center gap-2 mt-2">
        {hasChanges && (
          <Button
            variant="outline"
            onClick={handleSave}
            disabled={saving}
            className={cn('border-border text-text hover:bg-surface hover:text-text text-xs shadow-none h-8', HEARD_FOCUS_CLASS)}
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        )}
        <Button
          onClick={handleApprove}
          disabled={posting}
          className={cn('bg-accent text-text hover:bg-accent/90 text-xs font-medium shadow-none h-8', HEARD_FOCUS_CLASS)}
        >
          {posting ? 'Posting...' : 'Approve & Post'}
        </Button>
      </div>
    </div>
  )
}

type PanelState = 'idle' | 'confirm' | 'loading' | 'done' | 'error'

function HackathonPanel() {
  const [resetState, setResetState] = useState<PanelState>('idle')
  const [sweepState, setSweepState] = useState<PanelState>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleReset() {
    if (resetState === 'idle') { setResetState('confirm'); return }
    setResetState('loading')
    try {
      const res = await fetch('/api/demo/reset', { method: 'POST' })
      if (!res.ok) {
        const body = await res.json()
        setErrorMsg(body.error ?? 'Reset failed')
        setResetState('error')
      } else {
        setResetState('done')
        setTimeout(() => setResetState('idle'), 3000)
      }
    } catch {
      setErrorMsg('Network error')
      setResetState('error')
      setTimeout(() => setResetState('idle'), 3000)
    }
  }

  async function handleSweep() {
    setSweepState('loading')
    try {
      const res = await fetch('/api/agent/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'sweep' }),
      })
      if (!res.ok) {
        const body = await res.json()
        setErrorMsg(body.error ?? 'Sweep failed')
        setSweepState('error')
        setTimeout(() => setSweepState('idle'), 3000)
      } else {
        setSweepState('done')
        setTimeout(() => setSweepState('idle'), 4000)
      }
    } catch {
      setErrorMsg('Network error')
      setSweepState('error')
      setTimeout(() => setSweepState('idle'), 3000)
    }
  }

  const resetLabel =
    resetState === 'confirm' ? 'Confirm reset?' :
    resetState === 'loading' ? 'Resetting…' :
    resetState === 'done' ? 'Reset complete' :
    resetState === 'error' ? 'Error — retry' :
    'Reset demo'

  const sweepLabel =
    sweepState === 'loading' ? 'Triggering…' :
    sweepState === 'done' ? 'Sweep triggered — check Reviews' :
    sweepState === 'error' ? 'Error — retry' :
    'Run sweep'

  return (
    <div
      className="mb-7 rounded-md"
      style={{
        backgroundColor: 'var(--color-bg)',
        border: '1px dashed var(--color-border)',
        borderRadius: 'var(--radius-md)',
        padding: '20px 24px',
      }}
    >
      <p style={{
        fontSize: 'var(--text-xs)',
        fontWeight: 600,
        color: 'var(--color-muted)',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        marginBottom: '4px',
      }}>
        Hackathon
      </p>
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)', marginBottom: '16px' }}>
        Demo controls — visible only to the demo account.
      </p>
      <div className="flex gap-3 flex-wrap">
        <button
          onClick={handleReset}
          disabled={resetState === 'loading'}
          style={{
            height: '36px',
            padding: '0 16px',
            borderRadius: 'var(--radius-sm)',
            fontSize: 'var(--text-sm)',
            fontWeight: 500,
            border: '1px solid var(--color-border)',
            cursor: resetState === 'loading' ? 'not-allowed' : 'pointer',
            backgroundColor: resetState === 'confirm'
              ? 'var(--color-escalate-bg)'
              : resetState === 'done'
              ? 'var(--color-success-bg)'
              : 'var(--color-surface)',
            color: resetState === 'confirm'
              ? 'var(--color-escalate)'
              : resetState === 'done'
              ? 'var(--color-success)'
              : 'var(--color-text)',
            transition: 'background-color 0.15s ease, color 0.15s ease',
          }}
        >
          {resetLabel}
        </button>
        {resetState === 'confirm' && (
          <button
            onClick={() => setResetState('idle')}
            style={{
              height: '36px',
              padding: '0 12px',
              borderRadius: 'var(--radius-sm)',
              fontSize: 'var(--text-sm)',
              border: '1px solid var(--color-border)',
              cursor: 'pointer',
              backgroundColor: 'transparent',
              color: 'var(--color-muted)',
            }}
          >
            Cancel
          </button>
        )}
        <button
          onClick={handleSweep}
          disabled={sweepState === 'loading' || sweepState === 'done'}
          style={{
            height: '36px',
            padding: '0 16px',
            borderRadius: 'var(--radius-sm)',
            fontSize: 'var(--text-sm)',
            fontWeight: 500,
            border: '1px solid var(--color-border)',
            cursor: sweepState === 'loading' || sweepState === 'done' ? 'not-allowed' : 'pointer',
            backgroundColor: sweepState === 'done'
              ? 'var(--color-success-bg)'
              : 'var(--color-surface)',
            color: sweepState === 'done'
              ? 'var(--color-success)'
              : 'var(--color-text)',
            transition: 'background-color 0.15s ease, color 0.15s ease',
          }}
        >
          {sweepLabel}
        </button>
      </div>
      {(resetState === 'error' || sweepState === 'error') && (
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-escalate)', marginTop: '8px' }}>
          {errorMsg}
        </p>
      )}
    </div>
  )
}

function StarRating({ rating }: { rating: number }) {
  return (
    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)' }}>
      {'★'.repeat(rating)}
      {'☆'.repeat(5 - rating)}
    </span>
  )
}

function PlatformBadge({ source }: { source: string }) {
  const label = source === 'judgeme' ? 'Judge.me' : source === 'google_business' ? 'Google' : source
  return (
    <Badge className="shadow-none font-normal rounded-sm text-[11px] py-[3px] px-1.5 leading-none border-transparent bg-surface text-muted hover:bg-surface">
      {label}
    </Badge>
  )
}
