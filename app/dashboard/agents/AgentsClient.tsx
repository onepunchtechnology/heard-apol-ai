'use client'

import { useState } from 'react'
import { formatDistanceToNow } from '@/lib/utils'

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

interface AgentTraceStep {
  step: string
  label: string
  status: 'complete' | 'skipped' | 'warning' | 'failed'
  summary: string
  metadata?: Record<string, unknown>
  occurred_at: string
}

interface ReviewAction {
  id: string
  risk_score: number
  sentiment_label: string
  agent_reasoning: string
  agent_trace: AgentTraceStep[]
  draft_reply: string
  decision?: string
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
  review_actions: ReviewAction[]
}

const STEP_COLORS: Record<string, string> = {
  complete: 'var(--color-success)',
  skipped:  'var(--color-muted)',
  warning:  'var(--color-warning)',
  failed:   'var(--color-escalate)',
}

export default function AgentsClient({
  runs,
  reviews,
}: {
  runs: AgentRun[]
  reviews: Review[]
}) {
  const [expandedReviewId, setExpandedReviewId] = useState<string | null>(null)

  return (
    <div className="p-8 max-w-4xl">
      <h1
        className="mb-6"
        style={{ fontSize: 'var(--text-lg)', fontWeight: 500, color: 'var(--color-text)' }}
      >
        Agents
      </h1>

      {reviews.length === 0 ? (
        <div
          className="rounded-md p-12 text-center"
          style={{
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <p style={{ color: 'var(--color-muted)', fontSize: 'var(--text-sm)' }}>
            No agent runs yet. Reviews will appear here after the agent processes them.
          </p>
        </div>
      ) : (
        <div
          className="rounded-md overflow-hidden"
          style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}
        >
          {reviews.map((review) => {
            const action = review.review_actions?.[0]
            const isExpanded = expandedReviewId === review.id

            return (
              <div key={review.id}>
                <button
                  onClick={() => setExpandedReviewId(isExpanded ? null : review.id)}
                  className="w-full text-left px-5 py-4 border-b flex items-center gap-4 transition-colors"
                  style={{
                    borderColor: 'var(--color-border)',
                    backgroundColor: isExpanded ? 'var(--color-surface)' : 'transparent',
                    cursor: 'pointer',
                    transitionDuration: 'var(--duration-short)',
                  }}
                >
                  <StarRating rating={review.rating} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>
                        {review.reviewer_name}
                      </span>
                      <PlatformBadge source={review.source} />
                    </div>
                    <p
                      className="truncate"
                      style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)' }}
                    >
                      {review.body}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {action && (
                      <span
                        style={{
                          fontSize: 'var(--text-xs)',
                          color: action.decision === 'auto_post' ? 'var(--color-success)' : 'var(--color-escalate)',
                        }}
                      >
                        {action.decision === 'auto_post' ? 'auto-posted' : 'escalated'}
                      </span>
                    )}
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)' }}>
                      {formatDistanceToNow(review.received_at)}
                    </span>
                    <span style={{ color: 'var(--color-muted)', fontSize: '10px' }}>
                      {isExpanded ? '▲' : '▼'}
                    </span>
                  </div>
                </button>

                {isExpanded && action?.agent_trace && (
                  <div
                    className="px-5 py-4 border-b"
                    style={{
                      borderColor: 'var(--color-border)',
                      backgroundColor: 'var(--color-surface)',
                    }}
                  >
                    <div className="flex flex-col gap-2">
                      {action.agent_trace.map((step, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <span
                            className="font-mono flex-shrink-0"
                            style={{
                              fontSize: 'var(--text-xs)',
                              color: STEP_COLORS[step.status] ?? 'var(--color-muted)',
                              width: '110px',
                            }}
                          >
                            {step.label.toUpperCase()}
                          </span>
                          <span
                            className="font-mono"
                            style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)' }}
                          >
                            → {step.summary}
                          </span>
                        </div>
                      ))}
                    </div>
                    {action.agent_reasoning && (
                      <p
                        className="mt-3 italic"
                        style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)' }}
                      >
                        {action.agent_reasoning}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function StarRating({ rating }: { rating: number }) {
  return (
    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', flexShrink: 0 }}>
      {'★'.repeat(rating)}{'☆'.repeat(5 - rating)}
    </span>
  )
}

function PlatformBadge({ source }: { source: string }) {
  const label = source === 'judgeme' ? 'Judge.me' : source === 'google_business' ? 'Google' : source
  return (
    <span
      style={{
        fontSize: 'var(--text-xs)',
        backgroundColor: 'var(--color-bg)',
        color: 'var(--color-muted)',
        borderRadius: 'var(--radius-sm)',
        padding: '1px 6px',
        border: '1px solid var(--color-border)',
      }}
    >
      {label}
    </span>
  )
}
