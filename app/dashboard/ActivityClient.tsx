'use client'

import { useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList, Cell,
  LineChart, Line, Legend, Tooltip, ResponsiveContainer,
} from 'recharts'
import { createClient } from '@/lib/supabase/client'
import { formatDistanceToNow } from '@/lib/utils'

interface StatusCounts {
  pending: number
  processing: number
  needsAttention: number
  autoPosted: number
  failed: number
  imported: number
}

interface EscalatedReview {
  id: string
  reviewer_name: string
  rating: number
  body: string
  source: string
  received_at: string
  status: string
  review_actions: {
    risk_score: number
    sentiment_label: string
    agent_reasoning: string
  } | {
    risk_score: number
    sentiment_label: string
    agent_reasoning: string
  }[] | null
}

interface ActivityClientProps {
  lastRunAt: string | null
  storeCount: number
  statusCounts: StatusCounts
  reviewsTrend: number[]
  repliesTrend: number[]
  recentEscalated: EscalatedReview[]
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
  storeCount,
  statusCounts: initialStatusCounts,
  reviewsTrend: initialReviewsTrend,
  repliesTrend: initialRepliesTrend,
  recentEscalated: initialEscalated,
  isDemoAccount,
}: ActivityClientProps) {
  const [lastRunAt, setLastRunAt] = useState<string | null>(initialLastRunAt)
  const [statusCounts, setStatusCounts] = useState<StatusCounts>(initialStatusCounts)
  const [reviewsTrend, setReviewsTrend] = useState<number[]>(initialReviewsTrend)
  const [repliesTrend, setRepliesTrend] = useState<number[]>(initialRepliesTrend)
  const [recentEscalated, setRecentEscalated] = useState<EscalatedReview[]>(initialEscalated)

  useEffect(() => {
    const supabase = createClient()

    async function refreshStats() {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

      const [
        { data: runs },
        { data: latestStatuses },
        { data: escalated },
        { data: newRepliesRows },
        { data: newReviewsRows },
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
            review_actions (risk_score, sentiment_label, agent_reasoning)
          `)
          .in('status', ['needs_review', 'reply_pending_manual'])
          .order('received_at', { ascending: false })
          .limit(5),
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
      ])

      setLastRunAt((runs?.[0] as { completed_at: string | null } | undefined)?.completed_at ?? null)
      setStatusCounts(computeStatusCounts(latestStatuses ?? []))
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
      {/* Status bar */}
      <div
        className="mb-5 flex items-center gap-2"
        style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)' }}
      >
        <span
          className="pulse inline-block flex-shrink-0 rounded-full"
          style={{ width: '8px', height: '8px', backgroundColor: 'var(--color-accent)' }}
        />
        watching {storeCount} store{storeCount !== 1 ? 's' : ''}
        {lastRunAt && (
          <> · last reply {formatDistanceToNow(lastRunAt)} ago</>
        )}
        {' · '}always on
      </div>

      {/* Row 1: Hackathon panel */}
      {isDemoAccount && <HackathonPanel />}

      {/* Row 2: Charts */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        <StatusPipelineChart statusCounts={statusCounts} />
        <ReviewsTrendChart reviewsTrend={reviewsTrend} repliesTrend={repliesTrend} />
      </div>

      {/* Row 3: Escalation queue */}
      <EscalationQueue reviews={recentEscalated} />
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
    <div style={{
      backgroundColor: 'var(--color-bg)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-md)',
      boxShadow: '0 1px 3px rgba(45, 0, 19, 0.06)',
      padding: '24px',
    }}>
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
    </div>
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
    <div style={{
      backgroundColor: 'var(--color-bg)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-md)',
      boxShadow: '0 1px 3px rgba(45, 0, 19, 0.06)',
      padding: '24px',
    }}>
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
    </div>
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

function EscalationQueue({ reviews }: { reviews: EscalatedReview[] }) {
  return (
    <div style={{
      backgroundColor: 'var(--color-bg)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-md)',
      boxShadow: '0 1px 3px rgba(45, 0, 19, 0.06)',
    }}>
      <div
        className="flex items-center justify-between px-6 py-4"
        style={{ borderBottom: '1px solid var(--color-border)' }}
      >
        <div className="flex items-center gap-3">
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 500, color: 'var(--color-text)' }}>
            Escalation Queue
          </h2>
          {reviews.length > 0 && (
            <span style={{
              fontSize: 'var(--text-xs)',
              backgroundColor: 'var(--color-escalate-bg)',
              color: 'var(--color-escalate)',
              padding: '2px 8px',
              borderRadius: 'var(--radius-sm)',
              fontWeight: 500,
            }}>
              {reviews.length} need{reviews.length !== 1 ? '' : 's'} attention
            </span>
          )}
        </div>
        {reviews.length > 0 && (
          <a
            href="/dashboard/reviews"
            style={{ fontSize: 'var(--text-sm)', color: 'var(--color-accent-dim)', textDecoration: 'none' }}
          >
            View all →
          </a>
        )}
      </div>

      {reviews.length === 0 ? (
        <div className="px-6 py-16 text-center">
          <p
            className="font-display italic"
            style={{ fontSize: 'var(--text-xl)', color: 'var(--color-accent-dim)' }}
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
            const reasonTag =
              action?.sentiment_label === 'negative'
                ? action.risk_score >= 7
                  ? 'High risk'
                  : 'Negative sentiment'
                : action?.sentiment_label === 'positive'
                ? 'Positive'
                : 'Neutral'

            return (
              <div
                key={review.id}
                style={{
                  borderBottom: isLast ? 'none' : '1px solid var(--color-border)',
                  borderLeft: '3px solid var(--color-escalate)',
                  padding: '12px 24px 12px 21px',
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
                  className="line-clamp-1 mb-1"
                  style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}
                >
                  {review.body}
                </p>
                <div className="flex items-center gap-2">
                  <span style={{
                    fontSize: 'var(--text-xs)',
                    backgroundColor: 'var(--color-escalate-bg)',
                    color: 'var(--color-escalate)',
                    padding: '1px 6px',
                    borderRadius: 'var(--radius-sm)',
                  }}>
                    escalated
                  </span>
                  {action && (
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)' }}>
                      {reasonTag}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
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
    <span style={{
      fontSize: 'var(--text-xs)',
      backgroundColor: 'var(--color-surface)',
      color: 'var(--color-muted)',
      padding: '1px 6px',
      borderRadius: 'var(--radius-sm)',
    }}>
      {label}
    </span>
  )
}
