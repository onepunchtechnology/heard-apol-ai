'use client'

import { formatDistanceToNow } from '@/lib/utils'

interface Stats {
  autoPosted: number
  escalated: number
  total: number
  lastRunAt: string | null
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
  stats: Stats
  recentEscalated: EscalatedReview[]
  trend: number[]
  storeCount: number
}

const DEMO_TREND = [3, 5, 2, 8, 4, 6, 7]

export default function ActivityClient({ stats, recentEscalated, trend, storeCount }: ActivityClientProps) {
  const chartValues = trend.length === 7 ? trend : DEMO_TREND

  return (
    <div className="p-8 max-w-5xl">
      {/* Status bar */}
      <div
        className="mb-6 flex items-center gap-2"
        style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)' }}
      >
        <span
          className="pulse inline-block flex-shrink-0 rounded-full"
          style={{ width: '8px', height: '8px', backgroundColor: 'var(--color-accent)' }}
        />
        watching {storeCount} store{storeCount !== 1 ? 's' : ''}
        {stats.lastRunAt && (
          <> · last reply {formatDistanceToNow(stats.lastRunAt)} ago</>
        )}
        {' · '}always on
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <MetricCard value={stats.autoPosted} label="auto-replied" valueColor="var(--color-success)" />
        <MetricCard value={stats.escalated} label="drafts ready" valueColor="var(--color-accent-dim)" />
        <MetricCard value={stats.total} label="total reviews" valueColor="var(--color-muted)" />
      </div>

      {/* Trend chart */}
      <div
        className="rounded-md p-6 mb-8"
        style={{
          backgroundColor: 'var(--color-bg)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          boxShadow: '0 1px 3px rgba(45, 0, 19, 0.06)',
        }}
      >
        <p
          style={{
            fontSize: 'var(--text-base)',
            fontWeight: 500,
            color: 'var(--color-text)',
            marginBottom: '16px',
          }}
        >
          Replies trend — last 7 days
        </p>
        <TrendChart values={chartValues} />
      </div>

      {/* Escalation queue */}
      <div
        className="rounded-md"
        style={{
          backgroundColor: 'var(--color-bg)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          boxShadow: '0 1px 3px rgba(45, 0, 19, 0.06)',
        }}
      >
        <div
          className="px-6 py-4 border-b"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 500, color: 'var(--color-text)' }}>
            Escalation Queue
          </h2>
        </div>

        {recentEscalated.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p
              className="font-display italic"
              style={{ fontSize: 'var(--text-xl)', color: 'var(--color-accent-dim)' }}
            >
              All caught up.
            </p>
            <p
              className="mt-2"
              style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)' }}
            >
              No reviews need your attention right now.
            </p>
          </div>
        ) : (
          <div>
            {recentEscalated.map((review, idx) => {
              const action = Array.isArray(review.review_actions) ? review.review_actions[0] : review.review_actions
              const isLast = idx === recentEscalated.length - 1
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
                  {/* Line 1: stars + platform + reviewer + time */}
                  <div className="flex items-center gap-2 mb-1">
                    <StarRating rating={review.rating} />
                    <PlatformBadge source={review.source} />
                    {review.reviewer_name && (
                      <span
                        style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text)', fontWeight: 500 }}
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
                      {formatDistanceToNow(review.received_at)} ago
                    </span>
                  </div>
                  {/* Line 2: body excerpt */}
                  <p
                    className="line-clamp-1 mb-1"
                    style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}
                  >
                    {review.body}
                  </p>
                  {/* Line 3: status badge + reason tag */}
                  <div className="flex items-center gap-2">
                    <span
                      style={{
                        fontSize: 'var(--text-xs)',
                        backgroundColor: 'var(--color-escalate-bg)',
                        color: 'var(--color-escalate)',
                        padding: '1px 6px',
                        borderRadius: 'var(--radius-sm)',
                      }}
                    >
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
    </div>
  )
}

function TrendChart({ values }: { values: number[] }) {
  const W = 1000
  const H = 96
  const PX = 20
  const PY = 12
  const innerW = W - PX * 2
  const innerH = H - PY * 2
  const max = Math.max(...values, 1)
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  const pts = values.map((v, i) => ({
    x: PX + (i / (values.length - 1)) * innerW,
    y: PY + (1 - v / max) * innerH,
  }))

  // Smooth bezier path
  const linePath = pts.reduce((d, p, i) => {
    if (i === 0) return `M ${p.x.toFixed(1)} ${p.y.toFixed(1)}`
    const prev = pts[i - 1]
    const cx = ((prev.x + p.x) / 2).toFixed(1)
    return `${d} C ${cx} ${prev.y.toFixed(1)} ${cx} ${p.y.toFixed(1)} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`
  }, '')

  const areaPath = `${linePath} L ${pts[pts.length - 1].x.toFixed(1)} ${(PY + innerH).toFixed(1)} L ${pts[0].x.toFixed(1)} ${(PY + innerH).toFixed(1)} Z`

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${W} ${H + 24}`}
      style={{ display: 'block', overflow: 'visible' }}
      aria-hidden="true"
    >
      <path d={areaPath} fill="#FF99C8" fillOpacity="0.14" />
      <path
        d={linePath}
        fill="none"
        stroke="#FF99C8"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="4.5" fill="#FF99C8" />
      ))}
      {days.map((d, i) => (
        <text
          key={d}
          x={PX + (i / (days.length - 1)) * innerW}
          y={H + 20}
          textAnchor="middle"
          fontSize="11"
          fill="#8B003D"
          fontFamily="Epilogue, sans-serif"
        >
          {d}
        </text>
      ))}
    </svg>
  )
}

function MetricCard({
  value,
  label,
  valueColor,
}: {
  value: number
  label: string
  valueColor: string
}) {
  return (
    <div
      style={{
        backgroundColor: 'var(--color-bg)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        boxShadow: '0 1px 3px rgba(45, 0, 19, 0.06)',
        padding: '20px 24px',
        minHeight: '96px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      }}
    >
      <p
        className="font-display italic"
        style={{ fontSize: 'var(--text-3xl)', color: valueColor, lineHeight: 1 }}
      >
        {value}
      </p>
      <p className="mt-2" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)' }}>
        {label}
      </p>
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
    <span
      style={{
        fontSize: 'var(--text-xs)',
        backgroundColor: 'var(--color-surface)',
        color: 'var(--color-muted)',
        padding: '1px 6px',
        borderRadius: 'var(--radius-sm)',
      }}
    >
      {label}
    </span>
  )
}
