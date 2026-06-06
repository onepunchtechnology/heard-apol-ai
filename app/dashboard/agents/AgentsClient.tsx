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
  review_actions: ReviewAction[]
}

type FilterTab = 'All' | 'Auto-posted' | 'Escalated' | 'Blocked'
const FILTERS: FilterTab[] = ['All', 'Auto-posted', 'Escalated', 'Blocked']

function matchesFilter(review: Review, filter: FilterTab): boolean {
  if (filter === 'All') return true
  if (filter === 'Auto-posted') return review.status === 'auto_posted' || review.review_actions?.[0]?.decision === 'auto_post'
  if (filter === 'Escalated') return review.status === 'needs_review' || review.review_actions?.[0]?.decision === 'escalate'
  if (filter === 'Blocked') {
    const flags = (review.review_actions?.[0]?.agent_trace as { steps?: Array<{ step: string; passed?: boolean; fired_flags?: string[] }> })?.steps ?? []
    return flags.some((s) => s.step === 'guardrails' && s.passed === false)
  }
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

export default function AgentsClient({
  runs,
  reviews,
  storeName,
  durations,
}: {
  runs: AgentRun[]
  reviews: Review[]
  storeName: string | null
  durations: Record<string, number>
}) {
  const [filter, setFilter] = useState<FilterTab>('All')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const today = new Date()
  const todayStr = today.toDateString()
  const runsToday = runs.filter((r) => new Date(r.started_at).toDateString() === todayStr).length
  const totalAutoPosted = runs.reduce((s, r) => s + (r.auto_posted ?? 0), 0)
  const totalEscalated = runs.reduce((s, r) => s + (r.escalated ?? 0), 0)

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
        <div className="flex gap-2">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                height: '32px',
                padding: '0 12px',
                borderRadius: 'var(--radius-sm)',
                fontSize: 'var(--text-xs)',
                fontWeight: filter === f ? 500 : 400,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: filter === f ? 'var(--color-accent)' : 'var(--color-surface)',
                color: filter === f ? 'var(--color-text)' : 'var(--color-muted)',
                transition: `background-color var(--duration-short) var(--ease-out)`,
              }}
            >
              {f}
            </button>
          ))}
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
            const action = review.review_actions?.[0]
            const isExpanded = expandedId === review.id
            const isAutoPosted = review.status === 'auto_posted' || action?.decision === 'auto_post'
            const isEscalated = review.status === 'needs_review' || action?.decision === 'escalate'
            const isBlocked = (() => {
              const tr = action?.agent_trace as { steps?: Array<{ step: string; passed?: boolean }> } | null
              return tr?.steps?.some((s) => s.step === 'guardrails' && s.passed === false) ?? false
            })()
            const isProcessing = review.status === 'processing'

            const statusColor = isProcessing
              ? 'var(--color-accent)'
              : isAutoPosted
              ? 'var(--color-success)'
              : isBlocked
              ? 'var(--color-escalate)'
              : isEscalated
              ? 'var(--color-warning)'
              : 'var(--color-muted)'

            const outcomeLabel = isProcessing
              ? 'processing'
              : isAutoPosted
              ? 'auto-posted'
              : isBlocked
              ? 'blocked'
              : isEscalated
              ? 'escalated'
              : review.status

            const outcomeStyle = isProcessing
              ? { bg: 'var(--color-surface)', color: 'var(--color-accent)' }
              : isAutoPosted
              ? { bg: 'var(--color-success-bg)', color: 'var(--color-success)' }
              : isBlocked || isEscalated
              ? { bg: 'var(--color-escalate-bg)', color: 'var(--color-escalate)' }
              : { bg: 'var(--color-surface)', color: 'var(--color-muted)' }

            const traceLines = parseTrace(action?.agent_trace)

            return (
              <div key={review.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                {/* Collapsed row */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : review.id)}
                  className="w-full text-left"
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
                    className={isProcessing ? 'pulse' : undefined}
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
                  <span
                    style={{
                      fontSize: 'var(--text-xs)',
                      backgroundColor: outcomeStyle.bg,
                      color: outcomeStyle.color,
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-sm)',
                      flexShrink: 0,
                    }}
                  >
                    {outcomeLabel}
                  </span>

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
                    <div
                      style={{
                        backgroundColor: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)',
                        padding: '16px',
                        marginTop: '8px',
                      }}
                    >
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
                    </div>

                    {/* Collapse link */}
                    <button
                      onClick={() => setExpandedId(null)}
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
    <span
      style={{
        fontSize: 'var(--text-xs)',
        backgroundColor: 'var(--color-surface-2)',
        color: 'var(--color-muted)',
        padding: '2px 7px',
        borderRadius: 'var(--radius-sm)',
        flexShrink: 0,
      }}
    >
      {label}
    </span>
  )
}
