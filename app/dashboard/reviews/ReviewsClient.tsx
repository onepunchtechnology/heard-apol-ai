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
  agent_trace: unknown
  confidence?: number
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
  if (filter === 'Escalated')
    return reviews.filter((r) => r.status === 'needs_review' || r.status === 'reply_pending_manual')
  if (filter === 'Auto-replied')
    return reviews.filter((r) => r.status === 'auto_posted' || r.status === 'approved')
  return reviews
}

function reasonTag(review: Review): string {
  const action = review.review_actions?.[0]
  if (!action) return ''
  if (action.risk_flags?.includes('refund_offer_risk')) return 'Refund risk'
  if (action.risk_flags?.includes('competitor_mention')) return 'Competitor mention'
  if (action.sentiment_label === 'negative' && action.risk_score >= 7) return 'High risk'
  if (action.sentiment_label === 'negative') return 'Negative sentiment'
  if (action.sentiment_label === 'positive') return 'Positive'
  return 'Order issue'
}

export default function ReviewsClient({ reviews }: { reviews: Review[] }) {
  const [filter, setFilter] = useState<Filter>('All')
  const [selectedId, setSelectedId] = useState<string | null>(
    reviews.find((r) => r.status === 'needs_review')?.id ?? null,
  )
  const [postedIds, setPostedIds] = useState<Set<string>>(new Set())

  const filtered = filterReviews(reviews, filter)
  const selected = filtered.find((r) => r.id === selectedId) ?? null

  const escalatedCount = reviews.filter(
    (r) => r.status === 'needs_review' || r.status === 'reply_pending_manual',
  ).length
  const autoRepliedCount = reviews.filter(
    (r) => r.status === 'auto_posted' || r.status === 'approved',
  ).length
  const allCaughtUp = reviews.length > 0 && escalatedCount === 0

  function handlePosted(id: string) {
    setPostedIds((prev) => new Set(Array.from(prev).concat(id)))
    // Collapse the row after 3s
    setTimeout(() => {
      setPostedIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }, 3000)
  }

  // No reviews at all
  if (reviews.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p
            className="font-display italic"
            style={{ fontSize: 'var(--text-2xl)', color: 'var(--color-accent-dim)' }}
          >
            All caught up.
          </p>
          <p className="mt-2" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)' }}>
            Heard handled reviews overnight. Nothing needs your attention.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {/* Left panel — review list */}
      <div
        className="flex flex-col overflow-hidden"
        style={{ width: '420px', flexShrink: 0, borderRight: '1px solid var(--color-border)' }}
      >
        {/* Header */}
        <div
          className="px-5 pt-5 pb-3 border-b"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <h1 style={{ fontSize: 'var(--text-lg)', fontWeight: 500, color: 'var(--color-text)' }}>
            Reviews
          </h1>
          {allCaughtUp ? (
            <p className="mt-1" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-success)' }}>
              {autoRepliedCount} auto-replied · 0 need attention
            </p>
          ) : escalatedCount > 0 ? (
            <p className="mt-1" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-escalate)' }}>
              {escalatedCount} need attention
            </p>
          ) : null}

          {/* Filter tabs */}
          <div className="flex gap-1 mt-3">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  fontSize: 'var(--text-xs)',
                  height: '28px',
                  padding: '0 10px',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: filter === f ? 'var(--color-surface-2)' : 'transparent',
                  color: filter === f ? 'var(--color-text)' : 'var(--color-muted)',
                  fontWeight: filter === f ? 500 : 400,
                  transition: `background-color var(--duration-short) var(--ease-out)`,
                }}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Review rows */}
        <div className="flex-1 overflow-y-auto">
          {filtered.map((review) => {
            const action = review.review_actions?.[0]
            const isEscalated =
              review.status === 'needs_review' || review.status === 'reply_pending_manual'
            const isAutoReplied = review.status === 'auto_posted' || review.status === 'approved'
            const isSelected = review.id === selectedId
            const justPosted = postedIds.has(review.id)

            return (
              <button
                key={review.id}
                onClick={() => setSelectedId(review.id)}
                className="w-full text-left border-b"
                style={{
                  borderColor: 'var(--color-border)',
                  borderLeft: justPosted
                    ? '3px solid var(--color-success)'
                    : isEscalated
                    ? '3px solid var(--color-escalate)'
                    : isAutoReplied
                    ? '3px solid var(--color-success)'
                    : '3px solid transparent',
                  backgroundColor: isSelected ? 'var(--color-surface-2)' : 'transparent',
                  display: 'block',
                  padding: '10px 20px 10px 17px',
                  minHeight: '56px',
                  cursor: 'pointer',
                  transition: `background-color var(--duration-short) var(--ease-out), border-left-color var(--duration-short) var(--ease-out)`,
                }}
              >
                {/* Line 1: stars + platform + name + time */}
                <div className="flex items-center gap-2 mb-0.5">
                  <StarRating rating={review.rating} />
                  <PlatformBadge source={review.source} />
                  {review.reviewer_name && (
                    <span
                      className="truncate"
                      style={{
                        fontSize: 'var(--text-xs)',
                        color: 'var(--color-text)',
                        maxWidth: '90px',
                      }}
                    >
                      {review.reviewer_name}
                    </span>
                  )}
                  <span
                    style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--color-muted)',
                      marginLeft: 'auto',
                      flexShrink: 0,
                    }}
                  >
                    {formatDistanceToNow(review.received_at)}
                  </span>
                </div>
                {/* Line 2: excerpt */}
                <p
                  className="truncate mb-0.5"
                  style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}
                >
                  {review.body}
                </p>
                {/* Line 3: status badge + reason tag */}
                <div className="flex items-center gap-2">
                  <StatusBadge status={justPosted ? 'approved' : review.status} />
                  {action && isEscalated && (
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)' }}>
                      {reasonTag(review)}
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 overflow-y-auto p-6">
        {allCaughtUp && !selected ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p
                className="font-display italic"
                style={{ fontSize: 'var(--text-2xl)', color: 'var(--color-accent-dim)', marginBottom: '12px' }}
              >
                All caught up.
              </p>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)', maxWidth: '320px' }}>
                Heard handled {autoRepliedCount} review{autoRepliedCount !== 1 ? 's' : ''} overnight.
                Nothing needs your attention.
              </p>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', marginTop: '8px' }}>
                {reviews[0] && `Last reply posted ${formatDistanceToNow(reviews[0].received_at)} ago`}
              </p>
            </div>
          </div>
        ) : selected ? (
          <ReviewDetail
            key={selected.id}
            review={selected}
            onPosted={() => handlePosted(selected.id)}
          />
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

function ReviewDetail({
  review,
  onPosted,
}: {
  review: Review
  onPosted: () => void
}) {
  const action = review.review_actions?.[0]
  const [draft, setDraft] = useState(action?.draft_reply ?? '')
  const [loading, setLoading] = useState(false)
  const [posted, setPosted] = useState(
    review.status === 'auto_posted' || review.status === 'approved',
  )
  const [editMode, setEditMode] = useState(false)

  const isManualPaste = review.status === 'reply_pending_manual'
  const isGoogleManual = review.source === 'google_business' && isManualPaste
  const wordCount = draft.trim() ? draft.trim().split(/\s+/).length : 0

  async function handleApprove() {
    setLoading(true)
    const res = await fetch(`/api/reviews/${review.id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reply: draft }),
    })
    if (res.ok) {
      setPosted(true)
      onPosted()
    }
    setLoading(false)
  }

  async function handleReject() {
    await fetch(`/api/reviews/${review.id}/reject`, { method: 'POST' })
  }

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p style={{ fontSize: 'var(--text-base)', fontWeight: 500, color: 'var(--color-text)' }}>
            {review.reviewer_name}
          </p>
          {(review.title || review.product_title) && (
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)', marginTop: '2px' }}>
              {review.title ?? review.product_title}
            </p>
          )}
        </div>
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-3 mb-4">
        <StarRating rating={review.rating} />
        <PlatformBadge source={review.source} />
        <StatusBadge status={review.status} />
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', marginLeft: 'auto' }}>
          {formatDistanceToNow(review.received_at)} ago
        </span>
      </div>

      {/* Review body */}
      <p
        className="mb-4"
        style={{ fontSize: 'var(--text-base)', color: 'var(--color-text)', lineHeight: 1.6 }}
      >
        {review.body}
      </p>

      {/* Order context */}
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
            {action.order_context.order_name
              ? `Order ${action.order_context.order_name}`
              : 'Order'}
            {' · '}
            {action.order_context.fulfillment_status === 'fulfilled'
              ? 'Delivered'
              : action.order_context.fulfillment_status ?? 'Unfulfilled'}
            {(() => {
              const d = action.order_context.created_at
                ? new Date(action.order_context.created_at)
                : null
              return d && !isNaN(d.getTime())
                ? ` · ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                : null
            })()}
          </p>
          {Array.isArray(action.order_context.line_items) &&
            action.order_context.line_items.length > 0 && (
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', marginTop: '4px' }}>
                {action.order_context.line_items
                  .map((i) => `${i.title} ×${i.quantity}`)
                  .join(', ')}
              </p>
            )}
        </div>
      )}

      {/* Draft reply */}
      {action && (
        <div className="mb-4">
          {/* Draft header: label + confidence + word count */}
          <div className="flex items-center gap-2 mb-2">
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)' }}>
              Draft reply
            </span>
            {action.confidence !== undefined && (
              <span
                style={{
                  fontSize: 'var(--text-xs)',
                  backgroundColor: 'var(--color-success-bg)',
                  color: 'var(--color-success)',
                  padding: '1px 6px',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                {action.confidence}% confidence
              </span>
            )}
            <span
              style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', opacity: 0.7 }}
            >
              {wordCount} words
            </span>
          </div>

          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={5}
            className="w-full rounded-md px-4 py-3 resize-none"
            style={{
              backgroundColor: 'var(--color-surface)',
              border: editMode ? '1px solid var(--color-accent-dim)' : '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--text-sm)',
              color: 'var(--color-text)',
              fontFamily: 'inherit',
              outline: 'none',
              transition: `border-color var(--duration-short) var(--ease-out)`,
            }}
            onFocus={() => setEditMode(true)}
            onBlur={() => setEditMode(false)}
          />

          <div className="flex items-center justify-between mt-1">
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)' }}>
              AI-generated · {review.source === 'judgeme' ? 'Judge.me' : 'Google'} brand voice
            </p>
            <button
              style={{
                background: 'none',
                border: 'none',
                fontSize: 'var(--text-xs)',
                color: 'var(--color-muted)',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              Regenerate draft
            </button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      {!posted && action && (
        <div className="flex items-center gap-3">
          <button
            onClick={handleReject}
            style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--color-muted)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0 4px',
            }}
          >
            Skip
          </button>

          <button
            onClick={() => setEditMode(true)}
            style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--color-text)',
              background: 'none',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              padding: '7px 16px',
              transition: `border-color var(--duration-short) var(--ease-out)`,
            }}
          >
            Request Edit
          </button>

          {isGoogleManual ? (
            <ManualPasteButton reviewId={review.id} draft={draft} onPosted={onPosted} />
          ) : (
            <button
              onClick={handleApprove}
              disabled={loading}
              style={{
                backgroundColor: 'var(--color-accent)',
                color: 'var(--color-text)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--text-sm)',
                fontWeight: 500,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.5 : 1,
                padding: '8px 20px',
                transition: `opacity var(--duration-short) var(--ease-out)`,
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
          <span>✓ Posted</span>
        </div>
      )}
    </div>
  )
}

function ManualPasteButton({
  reviewId,
  draft,
  onPosted,
}: {
  reviewId: string
  draft: string
  onPosted: () => void
}) {
  const [step, setStep] = useState<'idle' | 'copied'>('idle')

  async function handleCopy() {
    await navigator.clipboard.writeText(draft)
    setStep('copied')
  }

  async function handleMarkPosted() {
    await fetch(`/api/reviews/${reviewId}/mark-posted`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reply: draft }),
    })
    onPosted()
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleCopy}
        style={{
          backgroundColor: 'var(--color-accent)',
          color: 'var(--color-text)',
          border: 'none',
          borderRadius: 'var(--radius-md)',
          fontSize: 'var(--text-sm)',
          cursor: 'pointer',
          padding: '8px 16px',
        }}
      >
        Copy &amp; Post to Google
      </button>
      {step === 'copied' && (
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)' }}>
            Copied. Did you post it?
          </span>
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

function StarRating({ rating }: { rating: number }) {
  return (
    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', flexShrink: 0 }}>
      {'★'.repeat(rating)}
      {'☆'.repeat(5 - rating)}
    </span>
  )
}

function PlatformBadge({ source }: { source: string }) {
  const label =
    source === 'judgeme' ? 'Judge.me' : source === 'google_business' ? 'Google' : source
  return (
    <span
      style={{
        fontSize: 'var(--text-xs)',
        backgroundColor: 'var(--color-surface)',
        color: 'var(--color-muted)',
        padding: '1px 6px',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--color-border)',
        flexShrink: 0,
      }}
    >
      {label}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    needs_review: { bg: 'var(--color-escalate-bg)', color: 'var(--color-escalate)', label: 'escalated' },
    reply_pending_manual: { bg: 'var(--color-warning-bg)', color: 'var(--color-warning)', label: 'manual post' },
    auto_posted: { bg: 'var(--color-success-bg)', color: 'var(--color-success)', label: 'auto-replied' },
    approved: { bg: 'var(--color-success-bg)', color: 'var(--color-success)', label: 'posted' },
    pending: { bg: 'var(--color-surface)', color: 'var(--color-muted)', label: 'pending' },
    processing: { bg: 'var(--color-warning-bg)', color: 'var(--color-warning)', label: 'processing' },
  }
  const cfg = map[status] ?? { bg: 'var(--color-surface)', color: 'var(--color-muted)', label: status }
  return (
    <span
      style={{
        fontSize: 'var(--text-xs)',
        backgroundColor: cfg.bg,
        color: cfg.color,
        padding: '1px 6px',
        borderRadius: 'var(--radius-sm)',
        flexShrink: 0,
      }}
    >
      {cfg.label}
    </span>
  )
}
