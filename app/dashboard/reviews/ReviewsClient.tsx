'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { cn, formatDistanceToNow } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'

const HEARD_FOCUS_CLASS =
  'focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-dim focus-visible:outline-offset-2'

const BADGE_BASE_CLASS =
  'shadow-none font-normal rounded-sm text-[11px] py-[3px] px-2 leading-none border-transparent flex-shrink-0'

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
  decision?: 'auto_post' | 'escalate' | null
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
  review_actions: ReviewAction | ReviewAction[] | null
}

function getAction(review: Review): ReviewAction | undefined {
  if (!review.review_actions) return undefined
  if (Array.isArray(review.review_actions)) return review.review_actions[0]
  return review.review_actions
}

const FILTERS = ['All', 'Escalated', 'Auto-replied', 'Imported'] as const
type Filter = (typeof FILTERS)[number]

function filterReviews(reviews: Review[], filter: Filter): Review[] {
  if (filter === 'Escalated')
    return reviews.filter((r) => r.status === 'needs_review' || r.status === 'reply_pending_manual')
  if (filter === 'Auto-replied')
    return reviews.filter((r) => r.status === 'auto_posted' || r.status === 'approved')
  if (filter === 'Imported')
    return reviews.filter((r) => r.status === 'imported')
  return reviews
}

function reasonTag(review: Review): string {
  const action = getAction(review)
  if (!action) return ''
  if (action.risk_flags?.includes('refund_offer')) return 'Refund risk'
  if (action.risk_flags?.includes('competitor_mention')) return 'Competitor mention'
  if (action.sentiment_label === 'negative' && action.risk_score >= 7) return 'High risk'
  if (action.sentiment_label === 'negative') return 'Negative sentiment'
  if (action.sentiment_label === 'positive') return 'Positive'
  return 'Order issue'
}

export default function ReviewsClient({ reviews: initialReviews, replyMode }: { reviews: Review[]; replyMode: 'auto_post' | 'manual_approval' }) {
  const [reviews, setReviews] = useState<Review[]>(initialReviews)
  const [filter, setFilter] = useState<Filter>('All')
  const [selectedId, setSelectedId] = useState<string | null>(
    initialReviews.find((r) => r.status === 'needs_review')?.id ?? null,
  )
  const [postedIds, setPostedIds] = useState<Set<string>>(new Set())
  const [locallyApprovedIds, setLocallyApprovedIds] = useState<Set<string>>(new Set())
  const isDirtyRef = useRef(false)

  function trySelectReview(id: string) {
    if (id === selectedId) return
    if (isDirtyRef.current) {
      const discard = window.confirm('You have unsaved changes to the draft reply. Discard them?')
      if (!discard) return
    }
    setSelectedId(id)
  }

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('reviews-live')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'reviews' },
        async (payload) => {
          const updated = payload.new as { id: string; status: string }
          if (['needs_review', 'reply_pending_manual', 'auto_posted'].includes(updated.status)) {
            const { data } = await supabase
              .from('reviews')
              .select(`
                id, reviewer_name, rating, title, body, source, received_at, status, product_title,
                review_actions (
                  id, risk_score, risk_flags, sentiment_label, agent_reasoning, draft_reply,
                  final_reply, order_context, agent_trace, confidence, decision
                )
              `)
              .eq('id', updated.id)
              .single()
            if (data) {
              const row = data as Review
              setReviews((prev) => {
                const exists = prev.some((r) => r.id === row.id)
                if (exists) return prev.map((r) => (r.id === row.id ? row : r))
                return [row, ...prev]
              })
              setSelectedId((prev) => prev ?? row.id)
            }
          } else {
            setReviews((prev) =>
              prev.map((r) => (r.id === updated.id ? { ...r, status: updated.status } : r)),
            )
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'reviews' },
        (payload) => {
          const row = payload.new as Review
          setReviews((prev) => [{ ...row, review_actions: null }, ...prev])
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const effectiveReviews = reviews.map((r) =>
    locallyApprovedIds.has(r.id) ? { ...r, status: 'approved' as const } : r,
  )

  const filtered = filterReviews(effectiveReviews, filter)
  const selected = filtered.find((r) => r.id === selectedId) ?? null

  const escalatedCount = effectiveReviews.filter(
    (r) => r.status === 'needs_review' || r.status === 'reply_pending_manual',
  ).length
  const autoRepliedCount = effectiveReviews.filter(
    (r) => r.status === 'auto_posted' || r.status === 'approved',
  ).length
  const inFlightCount = effectiveReviews.filter(
    (r) => r.status === 'pending' || r.status === 'processing',
  ).length
  const allCaughtUp = reviews.length > 0 && escalatedCount === 0 && inFlightCount === 0

  function handlePosted(id: string) {
    setPostedIds((prev) => new Set(Array.from(prev).concat(id)))
    const nextEscalated = effectiveReviews.find(
      (r) => (r.status === 'needs_review' || r.status === 'reply_pending_manual') && r.id !== id,
    )
    const nextId = nextEscalated?.id ?? null
    setTimeout(() => {
      setPostedIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      setLocallyApprovedIds((prev) => new Set(Array.from(prev).concat(id)))
      setSelectedId(nextId)
    }, 3000)
  }

  // No reviews at all — new user empty state
  if (reviews.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p
            className="font-display italic"
            style={{ fontSize: 'var(--text-2xl)', color: 'var(--color-accent-dim)' }}
          >
            Heard is listening.
          </p>
          <p className="mt-2" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)' }}>
            Your first draft will appear here the moment a new review comes in.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-full flex-col md:h-full md:flex-row">
      {/* Left panel — review list */}
      <div
        className="flex max-h-[55vh] w-full flex-col overflow-hidden border-b border-border md:h-full md:max-h-none md:w-[420px] md:flex-shrink-0 md:border-b-0 md:border-r"
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
          <div className="mt-3">
            <div className="flex gap-1 overflow-x-auto" aria-label="Review filters">
              {FILTERS.map((f) => {
                const selected = filter === f
                return (
                  <button
                    key={f}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setFilter(f)}
                    className={cn(
                      'h-7 flex-shrink-0 rounded-sm px-3 text-xs transition-colors',
                      selected
                        ? 'bg-surface-2 text-text font-medium'
                        : 'bg-transparent text-muted font-normal hover:bg-surface',
                      HEARD_FOCUS_CLASS
                    )}
                  >
                    {f}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Reply mode note */}
        <div
          className="flex items-center justify-between px-5 py-2"
          style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}
        >
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)' }}>
            {replyMode === 'manual_approval'
              ? 'Manual Approval — every draft requires your approval'
              : 'Auto-Post — low-risk replies post automatically'}
          </span>
          <a
            href="/dashboard/settings"
            style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', textDecoration: 'none', flexShrink: 0, marginLeft: '8px' }}
          >
            Change in Settings →
          </a>
        </div>

        {/* Review rows */}
        <div className="flex-1 overflow-y-auto">
          {filtered.map((review) => {
            const action = getAction(review)
            const effectiveStatus = locallyApprovedIds.has(review.id) ? 'approved' : review.status
            const isEscalated =
              effectiveStatus === 'needs_review' || effectiveStatus === 'reply_pending_manual'
            const isAutoReplied = effectiveStatus === 'auto_posted' || effectiveStatus === 'approved'
            const isSelected = review.id === selectedId
            const justPosted = postedIds.has(review.id)

            return (
              <button
                key={review.id}
                onClick={() => trySelectReview(review.id)}
                className={cn('w-full text-left border-b', HEARD_FOCUS_CLASS)}
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
                  <StatusBadge status={justPosted ? 'approved' : effectiveStatus} decision={action?.decision} />
                  {action && isEscalated && action?.decision !== 'auto_post' && (
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
      <div className="min-h-[420px] flex-1 overflow-y-auto p-5 md:p-6">
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
            onDirtyChange={(dirty) => { isDirtyRef.current = dirty }}
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
  onDirtyChange,
}: {
  review: Review
  onPosted: () => void
  onDirtyChange?: (dirty: boolean) => void
}) {
  const action = getAction(review)
  const originalDraft = useRef(action?.draft_reply ?? '')
  const [draft, setDraft] = useState(action?.draft_reply ?? '')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [posted, setPosted] = useState(
    review.status === 'auto_posted' || review.status === 'approved',
  )
  const [editMode, setEditMode] = useState(false)
  const [approveError, setApproveError] = useState<string | null>(null)
  const hasUnsavedChanges = draft !== originalDraft.current

  useEffect(() => {
    onDirtyChange?.(hasUnsavedChanges)
  }, [hasUnsavedChanges, onDirtyChange])

  const isManualPaste = review.status === 'reply_pending_manual'
  const isGoogleManual = review.source === 'google_business' && isManualPaste
  const wordCount = draft.trim() ? draft.trim().split(/\s+/).length : 0

  async function handleApprove() {
    setLoading(true)
    setApproveError(null)
    const res = await fetch(`/api/reviews/${review.id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reply: draft }),
    })
    if (res.ok) {
      setPosted(true)
      toast('Reply posted to Judge.me')
      onPosted()
    } else {
      const body = await res.json().catch(() => ({}))
      setApproveError(body.error ?? 'Failed to post reply. Check your Judge.me connection.')
    }
    setLoading(false)
  }

  async function handleSave() {
    setSaving(true)
    const res = await fetch(`/api/reviews/${review.id}/save-draft`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ draft }),
    })
    if (res.ok) {
      originalDraft.current = draft
      onDirtyChange?.(false)
      toast('Draft saved')
    } else {
      toast('Failed to save draft')
    }
    setSaving(false)
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
        <StatusBadge status={review.status} decision={action?.decision} />
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
        <Card className="mb-4 rounded-md border-border bg-surface shadow-none">
          <CardContent className="px-4 py-3">
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
          </CardContent>
        </Card>
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
              <Badge className={cn(BADGE_BASE_CLASS, 'bg-success-bg text-success hover:bg-success-bg')}>
                {action.confidence}% confidence
              </Badge>
            )}
            <span
              style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', opacity: 0.7 }}
            >
              {wordCount} words
            </span>
          </div>

          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={5}
            className={cn(
              'bg-surface text-sm resize-none font-sans outline-none transition-colors',
              HEARD_FOCUS_CLASS,
              editMode ? 'border-accent-dim' : 'border-border'
            )}
            onFocus={() => setEditMode(true)}
            onBlur={() => setEditMode(false)}
          />

          <div className="flex items-center justify-end mt-1">
            <button
              className={HEARD_FOCUS_CLASS}
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
          {hasUnsavedChanges && (
            <Button
              variant="outline"
              onClick={handleSave}
              disabled={saving}
              className={cn('border-border text-text hover:bg-surface hover:text-text text-sm shadow-none', HEARD_FOCUS_CLASS)}
            >
              {saving ? 'Saving...' : 'Save'}
            </Button>
          )}

          {isGoogleManual ? (
            <ManualPasteButton reviewId={review.id} draft={draft} onPosted={onPosted} />
          ) : (
            <Button
              onClick={handleApprove}
              disabled={loading}
              className={cn('bg-accent text-text hover:bg-accent/90 text-sm font-medium shadow-none', HEARD_FOCUS_CLASS)}
            >
              {loading ? 'Posting...' : 'Approve & Post'}
            </Button>
          )}
        </div>
      )}

      {approveError && (
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-escalate)', marginTop: '8px' }}>
          {approveError}
        </p>
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
      <Button
        onClick={handleCopy}
        className={cn('bg-accent text-text hover:bg-accent/90 text-sm font-medium shadow-none', HEARD_FOCUS_CLASS)}
      >
        Copy &amp; Post to Google
      </Button>
      {step === 'copied' && (
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)' }}>
            Copied. Did you post it?
          </span>
          <Button
            variant="ghost"
            onClick={handleMarkPosted}
            className={cn('text-muted hover:text-muted hover:bg-transparent text-xs shadow-none px-1 h-auto', HEARD_FOCUS_CLASS)}
          >
            Mark as posted
          </Button>
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
    <Badge className="shadow-none font-normal rounded-sm text-[11px] py-[3px] px-1.5 leading-none border-border bg-surface text-muted hover:bg-surface flex-shrink-0">
      {label}
    </Badge>
  )
}

function StatusBadge({ status, decision }: { status: string; decision?: 'auto_post' | 'escalate' | null }) {
  const isManualHold = (status === 'needs_review' || status === 'reply_pending_manual') && decision === 'auto_post'

  const map: Record<string, { className: string; label: string }> = {
    needs_review: isManualHold
      ? { className: 'bg-surface-2 text-muted hover:bg-surface-2', label: 'awaiting approval' }
      : { className: 'bg-escalate-bg text-escalate hover:bg-escalate-bg', label: 'escalated' },
    reply_pending_manual: isManualHold
      ? { className: 'bg-surface-2 text-muted hover:bg-surface-2', label: 'awaiting approval' }
      : { className: 'bg-warning-bg text-warning hover:bg-warning-bg', label: 'manual post' },
    auto_posted: { className: 'bg-success-bg text-success hover:bg-success-bg', label: 'auto-replied' },
    approved: { className: 'bg-success-bg text-success hover:bg-success-bg', label: 'posted' },
    imported: { className: 'bg-surface text-muted hover:bg-surface', label: 'imported' },
    pending: { className: 'bg-surface text-muted hover:bg-surface', label: 'pending' },
    processing: { className: 'bg-warning-bg text-warning hover:bg-warning-bg pulse', label: 'processing' },
  }
  const cfg = map[status] ?? { className: 'bg-surface text-muted hover:bg-surface', label: status }
  return (
    <Badge className={cn(BADGE_BASE_CLASS, cfg.className)}>
      {cfg.label}
    </Badge>
  )
}
