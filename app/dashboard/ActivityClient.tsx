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
  review_actions: Array<{
    risk_score: number
    sentiment_label: string
    agent_reasoning: string
  }>
}

interface ActivityClientProps {
  stats: Stats
  recentEscalated: EscalatedReview[]
}

export default function ActivityClient({ stats, recentEscalated }: ActivityClientProps) {
  const timeSaved = Math.floor(stats.autoPosted * 4.5)

  return (
    <div className="p-8 max-w-5xl">
      <div
        className="mb-6 flex items-center gap-2"
        style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)' }}
      >
        <span
          className="inline-block w-2 h-2 rounded-full"
          style={{ backgroundColor: 'var(--color-accent)', boxShadow: '0 0 0 3px var(--color-surface)' }}
        />
        watching 1 store
        {stats.lastRunAt && (
          <>
            {' · '}last reply {formatDistanceToNow(stats.lastRunAt)} ago
          </>
        )}
        {' · '}always on
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <MetricCard
          value={stats.autoPosted}
          label="auto-replied"
          valueColor="var(--color-success)"
        />
        <MetricCard
          value={stats.escalated}
          label="drafts ready"
          valueColor="var(--color-accent-dim)"
        />
        <MetricCard
          value={stats.total}
          label="total reviews"
          valueColor="var(--color-muted)"
        />
      </div>

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
            color: 'var(--color-text)',
            fontWeight: 500,
            marginBottom: '8px',
          }}
        >
          Replies trend — last 7 days
        </p>
        <div
          style={{
            height: '80px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-muted)',
            fontSize: 'var(--text-sm)',
          }}
        >
          {stats.total > 0 ? 'Chart coming soon' : 'No reviews yet'}
        </div>
      </div>

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
            {recentEscalated.map((review) => (
              <div
                key={review.id}
                className="px-6 py-4 border-b"
                style={{
                  borderColor: 'var(--color-border)',
                  borderLeft: '3px solid var(--color-escalate)',
                }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>
                    {review.reviewer_name}
                  </span>
                  <div className="flex items-center gap-2">
                    <StarRating rating={review.rating} />
                    <PlatformBadge source={review.source} />
                  </div>
                </div>
                <p
                  className="line-clamp-2"
                  style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)' }}
                >
                  {review.body}
                </p>
                {review.review_actions?.[0] && (
                  <div className="mt-2 flex gap-2">
                    <RiskBadge score={review.review_actions[0].risk_score} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div
        className="mt-6 px-4 py-2 rounded-md inline-block"
        style={{ backgroundColor: 'var(--color-success-bg)' }}
      >
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-success)' }}>
          ~{timeSaved} min saved this week
        </span>
      </div>
    </div>
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
      className="rounded-md p-6"
      style={{
        backgroundColor: 'var(--color-bg)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        boxShadow: '0 1px 3px rgba(45, 0, 19, 0.06)',
      }}
    >
      <p
        className="font-display italic"
        style={{ fontSize: 'var(--text-3xl)', color: valueColor, lineHeight: 1 }}
      >
        {value}
      </p>
      <p
        className="mt-1"
        style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)' }}
      >
        {label}
      </p>
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
      className="px-2 py-0.5 rounded-sm"
      style={{
        fontSize: 'var(--text-xs)',
        backgroundColor: 'var(--color-surface)',
        color: 'var(--color-muted)',
        borderRadius: 'var(--radius-sm)',
      }}
    >
      {label}
    </span>
  )
}

function RiskBadge({ score }: { score: number }) {
  const isHigh = score >= 7
  return (
    <span
      className="px-2 py-0.5 rounded-sm"
      style={{
        fontSize: 'var(--text-xs)',
        backgroundColor: isHigh ? 'var(--color-escalate-bg)' : 'var(--color-warning-bg)',
        color: isHigh ? 'var(--color-escalate)' : 'var(--color-warning)',
        borderRadius: 'var(--radius-sm)',
      }}
    >
      risk {score}
    </span>
  )
}
