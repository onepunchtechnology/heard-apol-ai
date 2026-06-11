'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn, formatDistanceToNow } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

const HEARD_FOCUS_CLASS =
  'focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-dim focus-visible:outline-offset-2'

const BADGE_BASE_CLASS =
  'shadow-none font-normal rounded-sm text-[11px] py-[3px] px-2 leading-none border-transparent'

interface AgentRun {
  id: string
  trigger_type: string
  started_at: string
  completed_at: string | null
  reviews_processed: number
  auto_posted: number
  escalated: number
  failed: number
}

interface ReviewAction {
  id: string
  risk_score: number
  sentiment_label: string
  agent_reasoning: string
  agent_trace: unknown
  draft_reply: string
  decision?: string
  confidence?: number
  auto_posted_at?: string | null
}

interface Review {
  id: string
  reviewer_name: string
  rating: number
  body: string
  source: string
  received_at: string
  status: string
  product_title: string | null
  review_actions: ReviewAction | ReviewAction[] | null
}

function getAction(review: Review): ReviewAction | undefined {
  if (!review.review_actions) return undefined
  if (Array.isArray(review.review_actions)) return review.review_actions[0]
  return review.review_actions
}

type FilterTab = 'All' | 'Auto-posted' | 'Escalated' | 'Blocked'
const FILTERS: FilterTab[] = ['All', 'Auto-posted', 'Escalated', 'Blocked']

function isBlocked(review: Review): boolean {
  const flags = (getAction(review)?.agent_trace as { steps?: Array<{ step: string; passed?: boolean }> })?.steps ?? []
  return flags.some((s) => s.step === 'guardrails' && s.passed === false)
}

function matchesFilter(review: Review, filter: FilterTab): boolean {
  if (filter === 'All') return true
  if (filter === 'Auto-posted') return review.status === 'auto_posted'
  if (filter === 'Escalated') return review.status === 'needs_review' || review.status === 'reply_pending_manual'
  if (filter === 'Blocked') return isBlocked(review)
  return true
}

// Parse seed-format agent_trace JSON into display lines
function parseTrace(trace: unknown): Array<{ label: string; data: string; color: string }> {
  if (!trace) return []
  const raw = trace as { steps?: unknown[] }
  const steps: Array<Record<string, unknown>> = Array.isArray(raw)
    ? (raw as Array<Record<string, unknown>>)
    : Array.isArray(raw.steps)
    ? (raw.steps as Array<Record<string, unknown>>)
    : []

  return steps
    .filter((s) => s.step !== 'claim' && !(s.step === 'fetch_order_context' && String(s.status ?? '') === 'skipped'))
    .map((s) => {
      const status = String(s.status ?? '')
      let label = String(s.step ?? '').toUpperCase()
      let data = status
      let color = status === 'complete' ? 'var(--color-success)' : status === 'skipped' ? 'var(--color-muted)' : 'var(--color-escalate)'

      switch (s.step) {
        case 'classify': {
          label = 'CLASSIFIER'
          const r = s.result as Record<string, unknown> | undefined
          if (r) {
            const parts: string[] = []
            if (r.sentiment_label) parts.push(`sentiment: ${r.sentiment_label}`)
            if (r.needs_order_context !== undefined) parts.push(`needs_order_context: ${r.needs_order_context}`)
            if (r.risk_score !== undefined) parts.push(`risk: ${r.risk_score}`)
            if (r.confidence !== undefined) parts.push(`confidence: ${Number(r.confidence).toFixed(2)}`)
            data = parts.join(' | ')
          }
          break
        }
        case 'brand_voice_rag': {
          label = 'BRAND VOICE RAG'
          const snippets = s.snippets as string[] | undefined
          const count = (s.matched_count as number | undefined) ?? snippets?.length ?? 0
          data = `${count} snippet${count !== 1 ? 's' : ''} matched`
          color = 'var(--color-muted)'
          break
        }
        case 'fetch_order_context':
          label = 'SHOPIFY MCP'
          data = s.found ? 'order context fetched' : 'no order found'
          if (s.status === 'skipped') { data = 'skipped'; color = 'var(--color-muted)' }
          break
        case 'draft':
          label = 'DRAFTER'
          data = `draft generated${s.confidence ? ` | confidence: ${(Number(s.confidence) / 100).toFixed(2)}` : ''}`
          break
        case 'guardrails': {
          label = 'GUARDRAILS'
          const passed = s.passed as boolean | undefined
          const flags = s.fired_flags as string[] | undefined
          if (passed === true) {
            data = 'pass | violations: 0'
          } else if (passed === false) {
            const rule = flags?.[0] ? ` | rule: "${flags[0]}"` : ''
            data = `blocked | violations: ${flags?.length ?? 1}${rule}`
            color = 'var(--color-escalate)'
          }
          break
        }
        case 'post':
          label = 'POSTED'
          if (status === 'complete') {
            data = s.posted ? 'reply posted' : 'complete'
          } else if (status === 'skipped') {
            data = 'escalated — skipped'
            color = 'var(--color-muted)'
          }
          break
      }

      return { label, data, color }
    })
}

const REVIEW_SELECT = `
  id, reviewer_name, rating, body, source, received_at, status, product_title, store_id,
  review_actions (
    id, risk_score, sentiment_label, agent_reasoning, agent_trace, draft_reply, decision, confidence, auto_posted_at
  )
`.trim()

export default function AgentsClient({
  runs,
  reviews: initialReviews,
  storeName,
  durations,
}: {
  runs: AgentRun[]
  reviews: Review[]
  storeName: string | null
  durations: Record<string, number>
}) {
  const [reviews, setReviews] = useState<Review[]>(initialReviews)
  const [filter, setFilter] = useState<FilterTab>('All')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()

    async function upsertReview(reviewId: string) {
      const { data } = await supabase
        .from('reviews')
        .select(REVIEW_SELECT)
        .eq('id', reviewId)
        .single()
      if (!data) return
      const row = data as unknown as Review
      setReviews((prev) => {
        const exists = prev.some((r) => r.id === row.id)
        if (exists) return prev.map((r) => (r.id === row.id ? row : r))
        return [row, ...prev]
      })
    }

    const channel = supabase
      .channel('agents-live')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'reviews' },
        (payload) => {
          const updated = payload.new as { id: string; status: string }
          if (updated.status === 'pending' || updated.status === 'imported') return
          upsertReview(updated.id)
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'review_actions' },
        (payload) => {
          const action = payload.new as { review_id: string }
          upsertReview(action.review_id)
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const today = new Date()
  const todayStr = today.toDateString()
  const runsToday = runs.filter((r) => new Date(r.started_at).toDateString() === todayStr).length
  const totalAutoPosted = reviews.filter((r) => r.status === 'auto_posted').length
  const totalEscalated = reviews.filter((r) => r.status === 'needs_review' || r.status === 'reply_pending_manual').length

  const filterCounts: Record<FilterTab, number> = {
    All: reviews.length,
    'Auto-posted': reviews.filter((r) => r.status === 'auto_posted').length,
    Escalated: totalEscalated,
    Blocked: reviews.filter((r) => isBlocked(r)).length,
  }

  const filtered = reviews.filter((r) => matchesFilter(r, filter))

  return (
    <div style={{ padding: '48px 32px', maxWidth: '1200px' }}>
      {/* Page title */}
      <h1
        style={{
          fontSize: 'var(--text-xl)',
          fontWeight: 500,
          color: 'var(--color-text)',
          marginBottom: '20px',
        }}
      >
        Agents
      </h1>

      {/* Header row: summary counters + filter pills */}
      <div
        className="flex items-center justify-between"
        style={{ marginBottom: '24px' }}
      >
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)' }}>
          {runsToday} run{runsToday !== 1 ? 's' : ''} today
          {' · '}{totalAutoPosted} auto-posted
          {' · '}{totalEscalated} escalated
        </p>
        <div className="flex gap-2 overflow-x-auto" aria-label="Agent run filters">
          {FILTERS.map((f) => {
            const selected = filter === f
            const count = filterCounts[f]
            return (
              <button
                key={f}
                type="button"
                aria-pressed={selected}
                onClick={() => setFilter(f)}
                className={cn(
                  'h-8 flex-shrink-0 rounded-sm px-3 text-xs transition-colors',
                  selected
                    ? 'bg-accent text-text font-medium'
                    : 'bg-surface text-muted font-normal hover:bg-surface-2',
                  HEARD_FOCUS_CLASS
                )}
              >
                {f}{count > 0 ? ` (${count})` : ''}
              </button>
            )
          })}
        </div>
      </div>

      {/* Runs list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center" style={{ paddingTop: '80px' }}>
          <p
            className="font-display italic"
            style={{ fontSize: 'var(--text-xl)', color: 'var(--color-muted)', marginBottom: '8px' }}
          >
            No agent runs yet.
          </p>
          <p style={{ fontSize: '14px', color: 'var(--color-muted)' }}>
            Heard will appear here as reviews come in.
          </p>
        </div>
      ) : (
        <div style={{ borderTop: '1px solid var(--color-border)' }}>
          {filtered.map((review) => {
            const action = getAction(review)
            const isExpanded = expandedId === review.id
            const isAutoPosted = review.status === 'auto_posted'
            const isAwaitingApproval = action?.decision === 'auto_post' && review.status !== 'auto_posted' && review.status !== 'approved'
            const isEscalated = review.status === 'needs_review' || action?.decision === 'escalate'
            const isReviewBlocked = isBlocked(review)
            const isProcessing = review.status === 'processing'

            const statusColor = isProcessing
              ? 'var(--color-warning)'
              : isAutoPosted
              ? 'var(--color-success)'
              : isReviewBlocked
              ? 'var(--color-warning)'
              : isAwaitingApproval
              ? 'var(--color-muted)'
              : isEscalated
              ? 'var(--color-escalate)'
              : 'var(--color-muted)'

            const outcomeLabel = isProcessing
              ? 'processing'
              : isAutoPosted
              ? 'auto-posted'
              : isReviewBlocked
              ? 'blocked'
              : isAwaitingApproval
              ? 'awaiting approval'
              : isEscalated
              ? 'escalated'
              : review.status

            const traceLines = parseTrace(action?.agent_trace)

            return (
              <div key={review.id}>
                {/* Collapsed row */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : review.id)}
                  className={cn('w-full text-left', HEARD_FOCUS_CLASS)}
                  style={{
                    height: '56px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    padding: '0 16px',
                    backgroundColor: isExpanded ? 'var(--color-surface)' : 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    transition: `background-color var(--duration-short) var(--ease-out)`,
                  }}
                >
                  {/* Status dot */}
                  <span
                    role="img"
                    className={isProcessing ? 'pulse' : undefined}
                    aria-label={outcomeLabel}
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: statusColor,
                      flexShrink: 0,
                    }}
                  />

                  {/* Review excerpt */}
                  <span
                    className="truncate"
                    style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text)', maxWidth: '320px', minWidth: 0, flexShrink: 1 }}
                  >
                    {review.body}
                  </span>

                  {/* Platform badge */}
                  <PlatformBadge source={review.source} />

                  {/* Store */}
                  <span
                    style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)', flexShrink: 0 }}
                  >
                    {storeName ?? 'OhayoPop'}
                  </span>

                  {/* Duration derived from agent_run that processed this review */}
                  <span
                    style={{
                      fontFamily: '"Martian Mono", monospace',
                      fontSize: '12px',
                      color: 'var(--color-muted)',
                      flexShrink: 0,
                    }}
                  >
                    {(() => {
                      if (review.status === 'processing') return '…'
                      const secs = durations[review.id]
                      if (secs == null) return '—'
                      return secs < 10 ? `${secs.toFixed(1)}s` : `${Math.round(secs)}s`
                    })()}
                  </span>

                  {/* Outcome badge */}
                  <Badge
                    className={cn(
                      BADGE_BASE_CLASS,
                      'flex-shrink-0',
                      isProcessing && 'bg-warning-bg text-warning hover:bg-warning-bg pulse',
                      isAutoPosted && !isProcessing && 'bg-success-bg text-success hover:bg-success-bg',
                      isReviewBlocked && !isProcessing && !isAutoPosted && 'bg-warning-bg text-warning hover:bg-warning-bg',
                      isEscalated && !isProcessing && !isAutoPosted && !isReviewBlocked && 'bg-escalate-bg text-escalate hover:bg-escalate-bg',
                      !isProcessing && !isAutoPosted && !isReviewBlocked && !isEscalated && 'bg-surface text-muted hover:bg-surface'
                    )}
                  >
                    {outcomeLabel}
                  </Badge>

                  {/* Timestamp */}
                  <span
                    style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--color-muted)',
                      flexShrink: 0,
                      marginLeft: 'auto',
                    }}
                  >
                    {formatDistanceToNow(review.received_at)} ago
                  </span>

                  {/* Expand toggle */}
                  <span style={{ color: 'var(--color-muted)', fontSize: '11px', flexShrink: 0 }}>
                    {isExpanded ? '↑' : '↓'}
                  </span>
                </button>

                {/* Expanded trace */}
                {isExpanded && (
                  <div style={{ padding: '0 24px 16px 24px' }}>
                    <Card className="mt-2 rounded-md border-border bg-surface shadow-none">
                      <CardContent className="p-4">
                        {/* Trace steps */}
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px',
                            marginBottom: action?.draft_reply ? '12px' : '0',
                          }}
                        >
                          {traceLines.length > 0 ? (
                            traceLines.map((line, i) => (
                              <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'baseline' }}>
                                <span
                                  style={{
                                    fontFamily: '"Martian Mono", monospace',
                                    fontSize: '12px',
                                    color: line.color,
                                    width: '120px',
                                    flexShrink: 0,
                                    textAlign: 'right',
                                  }}
                                >
                                  {line.label}
                                </span>
                                <span
                                  style={{ fontFamily: '"Martian Mono", monospace', fontSize: '12px', color: 'var(--color-muted)' }}
                                >
                                  →
                                </span>
                                <span
                                  style={{ fontFamily: '"Martian Mono", monospace', fontSize: '12px', color: 'var(--color-text)' }}
                                >
                                  {line.data}
                                </span>
                              </div>
                            ))
                          ) : (
                            <p style={{ fontFamily: '"Martian Mono", monospace', fontSize: '12px', color: 'var(--color-muted)' }}>
                              no trace available
                            </p>
                          )}
                        </div>

                        {/* Draft reply sub-card */}
                        {action?.draft_reply && (
                          <div
                            style={{
                              borderTop: '1px solid var(--color-border)',
                              paddingTop: '12px',
                              marginTop: '4px',
                            }}
                          >
                            <p
                              style={{
                                fontSize: 'var(--text-xs)',
                                color: 'var(--color-muted)',
                                marginBottom: '6px',
                              }}
                            >
                              Draft reply
                            </p>
                            <div
                              style={{
                                backgroundColor: 'var(--color-surface-2)',
                                borderRadius: 'var(--radius-md)',
                                padding: '10px 12px',
                              }}
                            >
                              <p
                                style={{
                                  fontSize: '14px',
                                  fontStyle: 'italic',
                                  color: 'var(--color-text)',
                                  margin: 0,
                                  lineHeight: 1.6,
                                }}
                              >
                                {action.draft_reply}
                              </p>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Collapse link */}
                    <button
                      onClick={() => setExpandedId(null)}
                      className={HEARD_FOCUS_CLASS}
                      style={{
                        display: 'block',
                        margin: '8px auto 0',
                        background: 'none',
                        border: 'none',
                        fontSize: 'var(--text-xs)',
                        color: 'var(--color-muted)',
                        cursor: 'pointer',
                      }}
                    >
                      Show less ↑
                    </button>
                  </div>
                )}
                <Separator />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function PlatformBadge({ source }: { source: string }) {
  const label = source === 'judgeme' ? 'Judge.me' : source === 'google_business' ? 'Google' : source
  return (
    <Badge className="shadow-none font-normal rounded-sm text-[11px] py-[3px] px-2 leading-none border-transparent bg-surface-2 text-muted hover:bg-surface-2 flex-shrink-0">
      {label}
    </Badge>
  )
}
