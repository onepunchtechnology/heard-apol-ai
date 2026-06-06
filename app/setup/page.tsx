'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Step = 1 | 2 | 3 | 4

const STEPS = [
  { n: 1, label: 'Shopify' },
  { n: 2, label: 'Judge.me' },
  { n: 3, label: 'Google Business' },
  { n: 4, label: 'Brand Voice' },
] as const

export default function SetupPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)

  const [shopDomain, setShopDomain] = useState('')
  const [shopifyToken, setShopifyToken] = useState('')
  const [judgemeToken, setJudgemeToken] = useState('')
  const [sampleReplies, setSampleReplies] = useState('')
  const [rules, setRules] = useState([
    "Never promise refunds or replacements publicly",
    "Always address the customer by first name",
    "Always thank them for leaving a review",
  ])
  const [tone, setTone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleShopify(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const res = await fetch('/api/setup/shopify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ store_domain: shopDomain, access_token: shopifyToken }),
    })
    if (!res.ok) {
      const { error: err } = await res.json()
      setError(err ?? 'Connection failed')
    } else {
      setStep(2)
    }
    setLoading(false)
  }

  async function handleJudgeme(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const res = await fetch('/api/setup/judgeme', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ judgeme_api_token: judgemeToken }),
    })
    if (!res.ok) {
      const { error: err } = await res.json()
      setError(err ?? 'Connection failed')
    } else {
      setStep(3)
    }
    setLoading(false)
  }

  async function handleGoogleSkip() {
    setStep(4)
  }

  async function handleFinish(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await fetch('/api/setup/brand-voice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sample_replies: sampleReplies.split('\n').filter(Boolean),
        rules,
        tone_description: tone,
      }),
    })
    router.push('/dashboard')
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: 'var(--color-bg)' }}
    >
      <div className="w-full max-w-lg px-4">
        <div className="text-center mb-8">
          <h1
            className="font-display italic"
            style={{ fontSize: 'var(--text-xl)', color: 'var(--color-text)' }}
          >
            Heard
          </h1>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)', marginTop: '4px' }}>
            Set up your store
          </p>
        </div>

        <div className="flex gap-2 mb-8 justify-center">
          {STEPS.map(({ n, label }) => (
            <div key={n} className="flex items-center gap-1">
              <div
                className="flex items-center justify-center rounded-full text-xs"
                style={{
                  width: '24px',
                  height: '24px',
                  backgroundColor:
                    n < step ? 'var(--color-success-bg)' : n === step ? 'var(--color-accent)' : 'var(--color-surface)',
                  color:
                    n < step ? 'var(--color-success)' : n === step ? 'var(--color-text)' : 'var(--color-muted)',
                  fontSize: 'var(--text-xs)',
                  fontWeight: 500,
                }}
              >
                {n < step ? '✓' : n}
              </div>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)' }}>
                {label}
              </span>
            </div>
          ))}
        </div>

        <div
          className="rounded-lg p-8"
          style={{
            backgroundColor: 'var(--color-surface)',
            borderRadius: 'var(--radius-lg)',
          }}
        >
          {error && (
            <div
              className="mb-4 px-4 py-3 rounded-md"
              style={{
                backgroundColor: 'var(--color-escalate-bg)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--color-escalate)',
                fontSize: 'var(--text-sm)',
              }}
            >
              {error}
            </div>
          )}

          {step === 1 && (
            <form onSubmit={handleShopify} className="flex flex-col gap-4">
              <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 500 }}>Connect Shopify</h2>
              <SetupInput
                label="Shop domain"
                placeholder="yourstore.myshopify.com"
                value={shopDomain}
                onChange={setShopDomain}
                type="text"
              />
              <SetupInput
                label="Private app access token"
                placeholder="shpat_..."
                value={shopifyToken}
                onChange={setShopifyToken}
                type="password"
              />
              <SubmitButton loading={loading}>Test &amp; Continue</SubmitButton>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleJudgeme} className="flex flex-col gap-4">
              <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 500 }}>Connect Judge.me</h2>
              <SetupInput
                label="Private API token"
                placeholder="From Judge.me Admin → Settings → Integrations → API"
                value={judgemeToken}
                onChange={setJudgemeToken}
                type="password"
              />
              <SubmitButton loading={loading}>Test &amp; Continue</SubmitButton>
            </form>
          )}

          {step === 3 && (
            <div className="flex flex-col gap-4">
              <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 500 }}>Connect Google Business</h2>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)' }}>
                Google Business Profile reviews will be drafted by the agent and queued for you to post manually until API access is granted.
              </p>
              <a
                href="/api/auth/google"
                className="block text-center py-3 rounded-md transition-colors"
                style={{
                  backgroundColor: 'var(--color-surface-2)',
                  color: 'var(--color-text)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 500,
                  textDecoration: 'none',
                }}
              >
                Connect Google Business
              </a>
              <button
                onClick={handleGoogleSkip}
                style={{
                  color: 'var(--color-muted)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 'var(--text-sm)',
                }}
              >
                Skip for now
              </button>
            </div>
          )}

          {step === 4 && (
            <form onSubmit={handleFinish} className="flex flex-col gap-5">
              <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 500 }}>Train Brand Voice</h2>
              <div className="flex flex-col gap-2">
                <label style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)' }}>
                  Paste 5–10 past review replies (one per line)
                </label>
                <textarea
                  value={sampleReplies}
                  onChange={(e) => setSampleReplies(e.target.value)}
                  rows={5}
                  placeholder="Hi Yuki! Thanks so much for your review..."
                  className="w-full px-4 py-3 rounded-md resize-none"
                  style={{
                    backgroundColor: 'var(--color-bg)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--text-sm)',
                    fontFamily: 'inherit',
                    color: 'var(--color-text)',
                  }}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)' }}>
                  Rules
                </label>
                {rules.map((rule, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      value={rule}
                      onChange={(e) => {
                        const updated = [...rules]
                        updated[i] = e.target.value
                        setRules(updated)
                      }}
                      className="flex-1 px-3 py-2 rounded-md"
                      style={{
                        backgroundColor: 'var(--color-bg)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: 'var(--text-sm)',
                        fontFamily: 'inherit',
                        color: 'var(--color-text)',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setRules(rules.filter((_, idx) => idx !== i))}
                      style={{ color: 'var(--color-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setRules([...rules, ''])}
                  style={{ color: 'var(--color-muted)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 'var(--text-sm)' }}
                >
                  + Add rule
                </button>
              </div>
              <div className="flex flex-col gap-2">
                <label style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)' }}>
                  Tone description (optional)
                </label>
                <input
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  placeholder="e.g. Warm and enthusiastic, love for anime culture"
                  className="px-4 py-3 rounded-md"
                  style={{
                    backgroundColor: 'var(--color-bg)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--text-sm)',
                    fontFamily: 'inherit',
                    color: 'var(--color-text)',
                  }}
                />
              </div>
              <SubmitButton loading={loading}>Finish setup</SubmitButton>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

function SetupInput({
  label,
  placeholder,
  value,
  onChange,
  type,
}: {
  label: string
  placeholder: string
  value: string
  onChange: (v: string) => void
  type: string
}) {
  return (
    <div className="flex flex-col gap-2">
      <label style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)' }}>{label}</label>
      <input
        type={type}
        required
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-4 py-3 rounded-md"
        style={{
          backgroundColor: 'var(--color-bg)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          fontSize: 'var(--text-sm)',
          fontFamily: 'inherit',
          color: 'var(--color-text)',
        }}
      />
    </div>
  )
}

function SubmitButton({ children, loading }: { children: React.ReactNode; loading: boolean }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full py-3 rounded-md font-medium transition-opacity"
      style={{
        backgroundColor: 'var(--color-accent)',
        color: 'var(--color-text)',
        borderRadius: 'var(--radius-md)',
        fontSize: 'var(--text-sm)',
        fontWeight: 500,
        border: 'none',
        cursor: loading ? 'not-allowed' : 'pointer',
        opacity: loading ? 0.5 : 1,
      }}
    >
      {loading ? 'Connecting...' : children}
    </button>
  )
}
