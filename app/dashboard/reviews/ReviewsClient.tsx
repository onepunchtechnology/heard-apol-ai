'use client'

import { useState } from 'react'
import { formatDistanceToNow } from '@/lib/utils'

interface OrderContext {
  order_name: string
  financial_status: string
  fulfillment_status: string | null
  line_items: Array<{ title: string; quantity: number }>
  created_at: string
}

interface ReviewAction {
  id: string
  risk_score: number
  risk_flags: string[]
  sentiment_label: string
  agent_reasoning: string
  draft_reply: string
  final_reply: string | null
  order_context: OrderContext | null
  agent_trace: AgentTraceStep[]
  confidence?: number
}

interface AgentTraceStep {
  step: string
  status: string
  at: string
  [key: string]: unknown
}

interface Review {
  id: string
  reviewer_name: string
  rating: number
  title: string | null
  body: string
  source: string
  received_at: string
  status: string
  product_title: string | null
  review_actions: ReviewAction[]
}

const FILTERS = ['All', 'Escalated', 'Auto-replied'] as const
type Filter = (typeof FILTERS)[number]

function filterReviews(reviews: Review[], filter: Filter): Review[] {
  if (filter === 'Escalated') return reviews.filter((r) => r.status === 'needs_review' || r.status === 'reply_pending_manual')
  if (filter === 'Auto-replied') return reviews.filter((r) => r.status === 'auto_posted' || r.status === 'approved')
  return reviews
}

export default function ReviewsClient({ reviews }: { reviews: Review[] }) {
  const [filter, setFilter] = useState<Filter>('All')
  const [selectedId, setSelectedId] = useState<string | null>(reviews[0]?.id ?? null)

  const filtered = filterReviews(reviews, filter)
  const selected = filtered.find((r) => r.id === selectedId) ?? filtered[0] ?? null

  const escalatedCount = reviews.filter(
    (r) => r.status === 'needs_review' || r.status === 'reply_pending_manual',
  ).length

  if (reviews.length === 0) {
    return (
      <div className="flex h-full">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p
              className="font-display italic"
              style={{ fontSize: 'var(--text-2xl)', color: 'var(--color-accent-dim)' }}
            >
              All caught up.
            </p>
            <p
              className="mt-2"
              style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)' }}
            >
              Heard handled reviews overnight. Nothing needs your attention.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      <div
        className="flex flex-col border-r overflow-hidden"
        style={{ width: '420px', borderColor: 'var(--color-border)', flexShrink: 0 }}
      >
        <div
          className="px-5 pt-5 pb-3 border-b"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <h1
            style={{ fontSize: 'var(--text-lg)', fontWeight: 500, color: 'var(--color-text)' }}
          >
            Reviews
          </h1>
          {escalatedCount > 0 && (
            <p
              className="mt-1"
              style={{ fontSize: 'var(--text-sm)', color: 'var(--color-escalate)' }}
            >
              {escalatedCount} need attention
            </p>
          )}
          <div className="flex gap-1 mt-3">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="px-3 py-1 rounded-sm text-sm transition-colors"
                style={{
                  fontSize: 'var(--text-xs)',
                  backgroundColor: filter === f ? 'var(--color-surface-2)' : 'transparent',
                  color: filter === f ? 'var(--color-text)' : 'var(--color-muted)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid',
                  borderColor: filter === f ? 'var(--color-border)' : 'transparent',
                  cursor: 'pointer',
                  transitionDuration: 'var(--duration-short)',
                }}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.map((review) => {
            const action = review.review_actions?.[0]
            const isEscalated = review.status === 'needs_review' || review.status === 'reply_pending_manual'
            const isAutoReplied = review.status === 'auto_posted' || review.status === 'approved'
            const isSelected = review.id === selectedId

            return (
              <button
                key={review.id}
                onClick={() => setSelectedId(review.id)}
                className="w-full text-left px-5 py-3 border-b flex flex-col gap-1 transition-colors"
                style={{
                  borderColor: 'var(--color-border)',
                  borderLeft: isEscalated
                    ? '3px solid var(--color-escalate)'
                    : isAutoReplied
                    ? '3px solid var(--color-success)'
                    : '3px solid transparent',
                  backgroundColor: isSelected ? 'var(--color-surface-2)' : 'transparent',
                  height: '56px',
                  cursor: 'pointer',
                  transitionDuration: 'var(--duration-short)',
                }}
              >
                <div className="flex items-center gap-2">
                  <StarRating rating={review.rating} />
                  <PlatformBadge source={review.source} />
                  {review.reviewer_name && (
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text)' }}>
                      {review.reviewer_name}
                    </span>
                  )}
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', marginLeft: 'auto' }}>
                    {formatDistanceToNow(review.received_at)}
                  </span>
                </div>
                <p
                  className="truncate"
                  style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}
                >
                  {review.body}
                </p>
                <div className="flex items-center gap-2">
                  <StatusBadge status={review.status} />
                  {action?.risk_flags?.[0] && (
                    <span
                      style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)' }}
                    >
                      {action.risk_flags[0]}
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {selected ? (
          <ReviewDetail review={selected} />
        ) : (
          <div className="flex items-center justify-center h-full">
            <p style={{ color: 'var(--color-muted)', fontSize: 'var(--text-sm)' }}>
              Select a review
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function ReviewDetail({ review }: { review: Review }) {
  const action = review.review_actions?.[0]
  const [draft, setDraft] = useState(action?.draft_reply ?? '')
  const [loading, setLoading] = useState(false)
  const [posted, setPosted] = useState(review.status === 'auto_posted' || review.status === 'approved')

  async function handleApprove() {
    setLoading(true)
    const res = await fetch(`/api/reviews/${review.id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reply: draft }),
    })
    if (res.ok) {
      setPosted(true)
    }
    setLoading(false)
  }

  async function handleReject() {
    await fetch(`/api/reviews/${review.id}/reject`, { method: 'POST' })
  }

  const isManualPaste = review.status === 'reply_pending_manual'
  const isGoogleManual = review.source === 'google_business' && isManualPaste
  const wordCount = draft.trim() ? draft.trim().split(/\s+/).length : 0

  return (
    <div className="max-w-2xl">
      <div className="mb-3">
        <p style={{ fontSize: 'var(--text-base)', fontWeight: 500, color: 'var(--color-text)' }}>
          {review.reviewer_name}
        </p>
        {(review.title || review.product_title) && (
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)', marginTop: '2px' }}>
            {review.title ?? review.product_title}
          </p>
        )}
      </div>
      <div className="flex items-center gap-3 mb-4">
        <StarRating rating={review.rating} />
        <PlatformBadge source={review.source} />
        <StatusBadge status={review.status} />
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', marginLeft: 'auto' }}>
          {formatDistanceToNow(review.received_at)} ago
        </span>
      </div>

      <p
        className="mb-4"
        style={{ fontSize: 'var(--text-base)', color: 'var(--color-text)', lineHeight: 1.6 }}
      >
        {review.body}
      </p>

      {action?.order_context && (
        <div
          className="rounded-md px-4 py-3 mb-4"
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text)', fontWeight: 500 }}>
            Order {action.order_context.order_name}
            {' · '}
            {action.order_context.fulfillment_status === 'fulfilled'
              ? 'Delivered'
              : action.order_context.fulfillment_status ?? 'Unfulfilled'}
            {' · '}
            {new Date(action.order_context.created_at).toLocaleDateString('en-US', {
              month: 'short', day: 'numeric', year: 'numeric',
            })}
          </p>
          {action.order_context.line_items.length > 0 && (
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', marginTop: '4px' }}>
              {action.order_context.line_items.map((i) => `${i.title} ×${i.quantity}`).join(', ')}
            </p>
          )}
        </div>
      )}

      {action && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)' }}>
              Draft reply
            </span>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', opacity: 0.7 }}>
              {wordCount} words
            </span>
            {action.confidence !== undefined && (
              <span
                className="px-2 py-0.5 rounded-sm"
                style={{
                  fontSize: 'var(--text-xs)',
                  backgroundColor: 'var(--color-success-bg)',
                  color: 'var(--color-success)',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                {action.confidence}% confidence
              </span>
            )}
          </div>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={5}
            className="w-full rounded-md px-4 py-3 resize-none"
            style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--text-sm)',
              color: 'var(--color-text)',
              fontFamily: 'inherit',
            }}
          />
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', marginTop: '4px' }}>
            AI-generated · brand voice
          </p>

          {action.agent_reasoning && (
            <p
              className="mt-2 italic"
              style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)' }}
            >
              {action.agent_reasoning}
            </p>
          )}
        </div>
      )}

      {!posted && action && (
        <div className="flex gap-3">
          <button
            onClick={handleReject}
            style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--color-muted)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '8px 0',
            }}
          >
            Skip
          </button>
          {isGoogleManual ? (
            <ManualPasteButton reviewId={review.id} draft={draft} />
          ) : (
            <button
              onClick={handleApprove}
              disabled={loading}
              className="px-4 py-2 rounded-md font-medium transition-opacity"
              style={{
                backgroundColor: 'var(--color-accent)',
                color: 'var(--color-text)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--text-sm)',
                fontWeight: 500,
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.5 : 1,
                transitionDuration: 'var(--duration-short)',
              }}
            >
              {loading ? 'Posting...' : 'Approve & Post'}
            </button>
          )}
        </div>
      )}

      {posted && (
        <div
          className="flex items-center gap-2"
          style={{ color: 'var(--color-success)', fontSize: 'var(--text-sm)' }}
        >
          <span>Posted</span>
        </div>
      )}

      {action?.agent_trace && action.agent_trace.length > 0 && (
        <AgentTrace steps={action.agent_trace} />
      )}
    </div>
  )
}

function ManualPasteButton({ reviewId, draft }: { reviewId: string; draft: string }) {
  const [step, setStep] = useState<'idle' | 'copied'>('idle')

  async function handleCopyPost() {
    await navigator.clipboard.writeText(draft)
    setStep('copied')
  }

  async function handleMarkPosted() {
    await fetch(`/api/reviews/${reviewId}/mark-posted`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reply: draft }),
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleCopyPost}
        className="px-4 py-2 rounded-md font-medium"
        style={{
          backgroundColor: 'var(--color-accent)',
          color: 'var(--color-text)',
          borderRadius: 'var(--radius-md)',
          fontSize: 'var(--text-sm)',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        Copy &amp; Post to Google
      </button>
      {step === 'copied' && (
        <div
          className="flex items-center gap-2"
          style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)' }}
        >
          <span>Copied. Did you post it?</span>
          <button
            onClick={handleMarkPosted}
            style={{
              color: 'var(--color-accent-dim)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 'var(--text-xs)',
            }}
          >
            Mark as posted
          </button>
        </div>
      )}
    </div>
  )
}

function AgentTrace({ steps }: { steps: AgentTraceStep[] }) {
  return (
    <div
      className="mt-6 rounded-md p-4"
      style={{
        backgroundColor: 'var(--color-surface)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--color-border)',
      }}
    >
      <p
        className="mb-3"
        style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', fontWeight: 500 }}
      >
        Agent Replay
      </p>
      <div className="flex flex-col gap-2">
        {steps.map((step, i) => {
          const extras = Object.entries(step)
            .filter(([k]) => !['step', 'status', 'at'].includes(k))
            .map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`)
            .join(' ')
          return (
            <div key={i} className="flex items-start gap-3">
              <span
                className="font-mono"
                style={{
                  fontSize: 'var(--text-xs)',
                  color: step.status === 'complete' ? 'var(--color-success)' : 'var(--color-muted)',
                  width: '80px',
                  flexShrink: 0,
                }}
              >
                {step.step.toUpperCase()}
              </span>
              <span
                className="font-mono"
                style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)' }}
              >
                {step.status}{extras ? ` — ${extras}` : ''}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function StarRating({ rating }: { rating: number }) {
  return (
    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)' }}>
      {'★'.repeat(rating)}{'☆'.repeat(5 - rating)}
    </span>
  )
}

function PlatformBadge({ source }: { source: string }) {
  const label = source === 'judgeme' ? 'Judge.me' : source === 'google_business' ? 'Google' : source
  return (
    <span
      className="px-2 py-0.5"
      style={{
        fontSize: 'var(--text-xs)',
        backgroundColor: 'var(--color-surface)',
        color: 'var(--color-muted)',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--color-border)',
      }}
    >
      {label}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    needs_review:         { bg: 'var(--color-escalate-bg)', color: 'var(--color-escalate)',  label: 'escalated' },
    reply_pending_manual: { bg: 'var(--color-warning-bg)',  color: 'var(--color-warning)',   label: 'manual post' },
    auto_posted:          { bg: 'var(--color-success-bg)',  color: 'var(--color-success)',   label: 'auto-replied' },
    approved:             { bg: 'var(--color-success-bg)',  color: 'var(--color-success)',   label: 'posted' },
    pending:              { bg: 'var(--color-surface)',      color: 'var(--color-muted)',     label: 'pending' },
    processing:           { bg: 'var(--color-warning-bg)',  color: 'var(--color-warning)',   label: 'processing' },
  }
  const config = map[status] ?? { bg: 'var(--color-surface)', color: 'var(--color-muted)', label: status }

  return (
    <span
      className="px-2 py-0.5"
      style={{
        fontSize: 'var(--text-xs)',
        backgroundColor: config.bg,
        color: config.color,
        borderRadius: 'var(--radius-sm)',
      }}
    >
      {config.label}
    </span>
  )
}
