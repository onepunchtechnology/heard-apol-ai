'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { SplitHeroLayout } from '@/components/ui/SplitHeroLayout'

type Step = 1 | 2 | 3 | 4
type TonePositive = 'warm' | 'enthusiastic' | 'polished'
type ToneNegative = 'empathetic' | 'solution_focused' | 'measured'

const STEP_LABELS = ['1 Connect', '2 Positive tone', '3 Negative tone', '4 Complete'] as const

const SHOPIFY_DOMAIN_RE = /^[a-zA-Z0-9-]+\.myshopify\.com$/

const POSITIVE_TONES: Array<{ id: TonePositive; label: string; description: string; sample: string }> = [
  {
    id: 'warm',
    label: 'Warm',
    description: 'Caring, personal, and genuine',
    sample: '"Thank you so much for your order! We\'re thrilled you love it — it means everything to us."',
  },
  {
    id: 'enthusiastic',
    label: 'Enthusiastic',
    description: 'Energetic and celebratory',
    sample: '"Arigatou!! This made our whole team\'s day! We\'re so glad you love it! 🌸"',
  },
  {
    id: 'polished',
    label: 'Polished',
    description: 'Confident and precise',
    sample: '"Thank you for your review. We\'re delighted the piece arrived exactly as you hoped."',
  },
]

const NEGATIVE_TONES: Array<{ id: ToneNegative; label: string; description: string; sample: string }> = [
  {
    id: 'empathetic',
    label: 'Empathetic',
    description: 'Lead with understanding before solutions',
    sample: '"We\'re truly sorry this wasn\'t the experience you deserved. Your frustration is completely valid."',
  },
  {
    id: 'solution_focused',
    label: 'Solution-Focused',
    description: 'Acknowledge quickly, move to resolution',
    sample: '"We want to make this right. Please reach out at support@ohayopop.com and we\'ll resolve this immediately."',
  },
  {
    id: 'measured',
    label: 'Measured',
    description: 'Calm and professional, without over-apologizing',
    sample: '"Thank you for letting us know. We\'ll look into this and follow up with you directly."',
  },
]

function ProgressPills({ step }: { step: Step }) {
  const current = step === 4 ? 4 : step
  return (
    <>
      {/* Mobile: compact step indicator */}
      <div
        className="mb-6 md:hidden"
        style={{ fontFamily: 'Epilogue', fontWeight: 500, fontSize: '13px', color: 'var(--color-muted)' }}
      >
        Step {current} of 4
        <span style={{ color: 'var(--color-text)' }}> · {STEP_LABELS[current - 1].replace(/^\d+\s/, '')}</span>
      </div>

      {/* Desktop: full pill row */}
      <div className="hidden md:flex" style={{ gap: '6px', marginBottom: '32px' }}>
        {STEP_LABELS.map((label, i) => {
          const n = (i + 1) as Step
          const done = n < step || step === 4
          const active = n === step && step !== 4
          return (
            <div
              key={n}
              style={{
                height: '38px',
                padding: '0 14px',
                display: 'flex',
                alignItems: 'center',
                borderRadius: 'var(--radius-md)',
                fontFamily: 'Epilogue',
                fontWeight: 500,
                fontSize: '13px',
                backgroundColor: done ? 'var(--color-success-bg)' : active ? 'var(--color-accent)' : 'var(--color-surface)',
                color: done ? 'var(--color-success)' : active ? 'var(--color-text)' : 'var(--color-muted)',
                transition: `background-color var(--duration-short) var(--ease-out), color var(--duration-short) var(--ease-out)`,
              }}
            >
              {done ? `${label} ✓` : label}
            </div>
          )
        })}
      </div>
    </>
  )
}

function StepBadge({ n, total }: { n: number; total: number }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', height: '24px', padding: '0 10px', backgroundColor: 'var(--color-surface-2)', borderRadius: 'var(--radius-sm)', fontFamily: 'Epilogue', fontWeight: 500, fontSize: '12px', color: 'var(--color-text)', marginBottom: '16px' }}>
      Step {n} of {total}
    </div>
  )
}

function PlatformPill({ name }: { name: string }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', height: '32px', padding: '0 12px', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)', fontFamily: 'Epilogue', fontSize: '13px', color: 'var(--color-text)', marginRight: '8px', marginTop: '8px' }}>
      {name}
    </div>
  )
}

function OrDivider() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--color-border)' }} />
      <span style={{ fontFamily: 'Epilogue', fontSize: '13px', color: 'var(--color-muted)' }}>or</span>
      <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--color-border)' }} />
    </div>
  )
}

function PrimaryButton({ children, loading, type = 'submit', onClick }: {
  children: React.ReactNode
  loading?: boolean
  type?: 'submit' | 'button'
  onClick?: () => void
}) {
  return (
    <button
      type={type}
      disabled={loading}
      onClick={onClick}
      style={{ width: '100%', height: '48px', backgroundColor: 'var(--color-accent)', border: 'none', borderRadius: 'var(--radius-md)', fontFamily: 'Epilogue', fontWeight: 500, fontSize: '15px', color: 'var(--color-text)', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.5 : 1, transition: `opacity var(--duration-short) var(--ease-out)` }}
    >
      {children}
    </button>
  )
}

function SkipLink({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ background: 'none', border: 'none', padding: 0, fontFamily: 'Epilogue', fontSize: '13px', color: 'var(--color-muted)', cursor: 'pointer', textAlign: 'center', width: '100%' }}
    >
      {children}
    </button>
  )
}

function ToneCard<T extends string>({
  tone,
  selected,
  onSelect,
}: {
  tone: { id: T; label: string; description: string; sample: string }
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        width: '100%',
        textAlign: 'left',
        padding: '14px 16px',
        borderRadius: 'var(--radius-md)',
        border: selected ? '2px solid var(--color-accent)' : '1px solid var(--color-border)',
        backgroundColor: selected ? 'var(--color-surface)' : 'var(--color-bg)',
        cursor: 'pointer',
        transition: `border-color var(--duration-micro) var(--ease-out), background-color var(--duration-micro) var(--ease-out)`,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
        <span style={{ fontFamily: 'Epilogue', fontWeight: 500, fontSize: '14px', color: 'var(--color-text)' }}>
          {tone.label}
        </span>
        {selected && (
          <span style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: 'var(--color-accent)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="10" height="8" viewBox="0 0 10 8" fill="none" aria-hidden="true">
              <path d="M1 4L3.5 6.5L9 1" stroke="var(--color-text)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
        )}
      </div>
      <p style={{ fontFamily: 'Epilogue', fontSize: '12px', color: 'var(--color-muted)', margin: '0 0 10px' }}>
        {tone.description}
      </p>
      <p style={{ fontFamily: 'Epilogue', fontSize: '13px', fontStyle: 'italic', color: 'var(--color-text)', margin: 0, lineHeight: 1.5 }}>
        {tone.sample}
      </p>
    </button>
  )
}

function ShopifyConnectedBadge({ domain }: { domain: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', backgroundColor: 'var(--color-success-bg)', borderRadius: 'var(--radius-md)' }}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="8" cy="8" r="8" fill="var(--color-success)" fillOpacity="0.2"/>
        <path d="M4.5 8L7 10.5L11.5 6" stroke="var(--color-success)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <span style={{ fontFamily: 'Epilogue', fontSize: '13px', color: 'var(--color-success)', fontWeight: 500 }}>
        Shopify connected — {domain}
      </span>
    </div>
  )
}

function SetupContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [step, setStep] = useState<Step>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [shopifyConnected, setShopifyConnected] = useState(false)
  const [shopifyDomain, setShopifyDomain] = useState('')
  const [shopDomainInput, setShopDomainInput] = useState('')
  const [judgemeToken, setJudgemeToken] = useState('')
  const [storeConnected, setStoreConnected] = useState(false)

  const [tonePositive, setTonePositive] = useState<TonePositive>('warm')
  const [toneNegative, setToneNegative] = useState<ToneNegative>('empathetic')
  const [importedSamples, setImportedSamples] = useState<string[]>([])
  const [importCount, setImportCount] = useState({ reviews: 0, replies: 0 })

  useEffect(() => {
    const shopifyParam = searchParams.get('shopify')
    const shopParam = searchParams.get('shop')
    if (shopifyParam === 'connected' && shopParam) {
      setShopifyConnected(true)
      setShopifyDomain(shopParam)
      setStoreConnected(true)
      window.history.replaceState({}, '', '/setup')
    }
    const errorParam = searchParams.get('error')
    if (errorParam) {
      const messages: Record<string, string> = {
        invalid_shop: 'Invalid Shopify domain.',
        invalid_state: 'Authorization expired — please try again.',
        invalid_hmac: 'Security check failed — please try again.',
        token_exchange: 'Shopify refused the connection — verify the app is installed.',
        misconfigured: 'Shopify app not configured on this server.',
      }
      setError(messages[errorParam] ?? 'Shopify connection failed.')
      window.history.replaceState({}, '', '/setup')
    }
  }, [searchParams])

  function handleConnectShopify() {
    setError(null)
    const normalized = shopDomainInput.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase()
    if (!SHOPIFY_DOMAIN_RE.test(normalized)) {
      setError('Enter a valid *.myshopify.com domain first.')
      return
    }
    window.location.href = `/api/auth/shopify?shop=${encodeURIComponent(normalized)}`
  }

  async function handleStep1(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      let anyConnected = shopifyConnected
      if (judgemeToken) {
        const res = await fetch('/api/setup/judgeme', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ judgeme_api_token: judgemeToken }),
        })
        if (!res.ok) {
          const { error: err } = await res.json()
          setError(err ?? 'Judge.me connection failed')
          return
        }
        const json = await res.json()
        if (json.imported_replies?.length > 0) {
          setImportedSamples(json.imported_replies)
          setImportCount({ reviews: json.review_count ?? 0, replies: json.reply_count ?? 0 })
        }
        anyConnected = true
      }
      setStoreConnected(anyConnected)
      setStep(2)
    } finally {
      setLoading(false)
    }
  }

  function handleStep2(e: React.FormEvent) {
    e.preventDefault()
    setStep(3)
  }

  async function handleStep3(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/setup/brand-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tone_positive: tonePositive,
          tone_negative: toneNegative,
          sample_replies: importedSamples,
          rules: [],
        }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setError(json.error ?? 'Could not save brand voice. Please complete Step 1 first.')
        return
      }
      // Fire-and-forget: process any pending reviews immediately on setup completion
      fetch('/api/agent/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'sweep' }),
      }).catch(() => {})
      setStep(4)
    } finally {
      setLoading(false)
    }
  }

  const leftContent: Record<Step, React.ReactNode> = {
    1: (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <StepBadge n={1} total={4} />
        <p style={{ fontFamily: '"Instrument Serif"', fontStyle: 'italic', fontSize: 'clamp(28px, 7vw, 36px)', color: 'var(--color-text)', lineHeight: 1.1, margin: '0 0 16px', maxWidth: '280px' }}>
          Connect your store.
        </p>
        <p style={{ fontFamily: 'Epilogue', fontSize: '15px', color: 'var(--color-muted)', maxWidth: '270px', lineHeight: 1.6, margin: '0 0 24px' }}>
          Link your platforms so Heard can read reviews and post replies on your behalf.
        </p>
        <div>
          <PlatformPill name="Shopify" />
          <PlatformPill name="Judge.me" />
          <PlatformPill name="Google Business" />
        </div>
        <div style={{ marginTop: 'auto', paddingTop: '32px' }}>
          <p style={{ fontFamily: 'Epilogue', fontSize: '12px', color: 'var(--color-muted)', margin: 0 }}>
            Your credentials are encrypted at rest.
          </p>
        </div>
      </div>
    ),

    2: (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <StepBadge n={2} total={4} />
        <p style={{ fontFamily: '"Instrument Serif"', fontStyle: 'italic', fontSize: 'clamp(28px, 7vw, 36px)', color: 'var(--color-text)', lineHeight: 1.1, margin: '0 0 16px', maxWidth: '280px' }}>
          When customers love it.
        </p>
        <p style={{ fontFamily: 'Epilogue', fontSize: '15px', color: 'var(--color-muted)', maxWidth: '270px', lineHeight: 1.6, margin: '0 0 24px' }}>
          Pick the tone Heard uses for five-star moments and positive reviews.
        </p>
        {importCount.replies > 0 && (
          <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)', padding: '12px 16px' }}>
            <p style={{ fontFamily: 'Epilogue', fontSize: '13px', fontWeight: 500, color: 'var(--color-text)', margin: '0 0 2px' }}>
              {importCount.replies} {importCount.replies === 1 ? 'reply' : 'replies'} imported
            </p>
            <p style={{ fontFamily: 'Epilogue', fontSize: '12px', color: 'var(--color-muted)', margin: 0 }}>
              From your store&apos;s real review history. Heard will use these as voice examples.
            </p>
          </div>
        )}
        <div style={{ marginTop: 'auto', paddingTop: '32px' }}>
          <p style={{ fontFamily: 'Epilogue', fontSize: '12px', color: 'var(--color-muted)', margin: 0 }}>
            You can edit your brand voice anytime in Settings.
          </p>
        </div>
      </div>
    ),

    3: (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <StepBadge n={3} total={4} />
        <p style={{ fontFamily: '"Instrument Serif"', fontStyle: 'italic', fontSize: 'clamp(28px, 7vw, 36px)', color: 'var(--color-text)', lineHeight: 1.1, margin: '0 0 16px', maxWidth: '280px' }}>
          When something goes wrong.
        </p>
        <p style={{ fontFamily: 'Epilogue', fontSize: '15px', color: 'var(--color-muted)', maxWidth: '270px', lineHeight: 1.6, margin: '0 0 24px' }}>
          This tone shapes how Heard handles complaints, damaged orders, and unhappy customers.
        </p>
        <div style={{ marginTop: 'auto', paddingTop: '32px' }}>
          <p style={{ fontFamily: 'Epilogue', fontSize: '12px', color: 'var(--color-muted)', margin: 0 }}>
            You can edit your brand voice anytime in Settings.
          </p>
        </div>
      </div>
    ),

    4: (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <p style={{ fontFamily: '"Instrument Serif"', fontStyle: 'italic', fontSize: 'clamp(30px, 8vw, 40px)', color: 'var(--color-text)', lineHeight: 1.1, margin: '0 0 16px', maxWidth: '280px' }}>
          Heard is listening.
        </p>
        <p style={{ fontFamily: 'Epilogue', fontSize: '16px', color: 'var(--color-muted)', maxWidth: '270px', lineHeight: 1.6, margin: '0 0 32px' }}>
          Your first review will be drafted within minutes — ready for your approval.
        </p>
        <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', padding: '20px', display: 'flex', gap: '24px', marginBottom: '24px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: '"Instrument Serif"', fontStyle: 'italic', fontSize: '28px', color: 'var(--color-accent-dim)', lineHeight: 1 }}>0</div>
            <div style={{ fontFamily: 'Epilogue', fontSize: '11px', color: 'var(--color-muted)', marginTop: '4px' }}>drafts</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: '"Instrument Serif"', fontStyle: 'italic', fontSize: '28px', color: 'var(--color-success)', lineHeight: 1 }}>0</div>
            <div style={{ fontFamily: 'Epilogue', fontSize: '11px', color: 'var(--color-muted)', marginTop: '4px' }}>posted</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: '"Instrument Serif"', fontStyle: 'italic', fontSize: '28px', color: 'var(--color-muted)', lineHeight: 1 }}>0</div>
            <div style={{ fontFamily: 'Epilogue', fontSize: '11px', color: 'var(--color-muted)', marginTop: '4px' }}>escalations</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: storeConnected ? 'var(--color-success)' : 'var(--color-muted)' }} />
          <span style={{ fontFamily: 'Epilogue', fontSize: '13px', color: 'var(--color-muted)' }}>
            {storeConnected ? `${shopifyDomain || 'Your store'} · Live` : 'No store connected'}
          </span>
        </div>
        <div style={{ marginTop: 'auto', paddingTop: '32px' }}>
          <p style={{ fontFamily: 'Epilogue', fontSize: '12px', color: 'var(--color-muted)', margin: 0 }}>heard.apol.ai</p>
        </div>
      </div>
    ),
  }

  const rightContent: Record<Step, React.ReactNode> = {
    1: (
      <div style={{ width: '100%', maxWidth: '420px' }}>
        <ProgressPills step={step} />
        {error && (
          <div style={{ marginBottom: '16px', padding: '12px 16px', backgroundColor: 'var(--color-escalate-bg)', borderRadius: 'var(--radius-md)', fontFamily: 'Epilogue', fontSize: '13px', color: 'var(--color-escalate)' }}>
            {error}
          </div>
        )}
        <form onSubmit={handleStep1} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h1 className="sr-only md:not-sr-only" style={{ fontFamily: 'Epilogue', fontWeight: 500, fontSize: '20px', color: 'var(--color-text)', margin: 0 }}>
            Connect your store
          </h1>

          {shopifyConnected ? (
            <ShopifyConnectedBadge domain={shopifyDomain} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontFamily: 'Epilogue', fontSize: '13px', color: 'var(--color-text)', fontWeight: 500 }}>
                Shopify store domain
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={shopDomainInput}
                  onChange={(e) => setShopDomainInput(e.target.value)}
                  placeholder="yourstore.myshopify.com"
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleConnectShopify() } }}
                  style={{ flex: 1, minWidth: 0, height: '48px', padding: '0 16px', backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontFamily: 'Epilogue', fontSize: '15px', color: 'var(--color-text)' }}
                />
                <button
                  type="button"
                  onClick={handleConnectShopify}
                  style={{ height: '48px', padding: '0 18px', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontFamily: 'Epilogue', fontWeight: 500, fontSize: '14px', color: 'var(--color-text)', cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  Connect →
                </button>
              </div>
            </div>
          )}

          <OrDivider />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <label style={{ fontFamily: 'Epilogue', fontSize: '13px', color: 'var(--color-text)', fontWeight: 500 }}>
                Judge.me API token
              </label>
              <a href="https://judge.me/admin/settings/integrations" target="_blank" rel="noopener noreferrer" style={{ fontFamily: 'Epilogue', fontSize: '13px', color: 'var(--color-accent-dim)', textDecoration: 'none' }}>
                Where do I find this?
              </a>
            </div>
            <input
              type="password"
              value={judgemeToken}
              onChange={(e) => setJudgemeToken(e.target.value)}
              placeholder="Paste your private API token"
              style={{ width: '100%', height: '48px', padding: '0 16px', backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontFamily: 'Epilogue', fontSize: '15px', color: 'var(--color-text)' }}
            />
          </div>

          <OrDivider />

          <a
            href="/api/auth/google"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '48px', backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontFamily: 'Epilogue', fontSize: '15px', color: 'var(--color-text)', textDecoration: 'none' }}
          >
            Connect Google Business Profile
          </a>

          <PrimaryButton loading={loading}>
            {loading ? 'Verifying...' : 'Verify & Continue →'}
          </PrimaryButton>
          <SkipLink onClick={() => { setError(null); setStep(2) }}>Skip for now</SkipLink>
        </form>
      </div>
    ),

    2: (
      <div style={{ width: '100%', maxWidth: '420px' }}>
        <ProgressPills step={step} />
        <form onSubmit={handleStep2} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h1 className="sr-only md:not-sr-only" style={{ fontFamily: 'Epilogue', fontWeight: 500, fontSize: '20px', color: 'var(--color-text)', margin: 0 }}>
            Tone for positive reviews
          </h1>
          <p className="hidden md:block" style={{ fontFamily: 'Epilogue', fontSize: '14px', color: 'var(--color-muted)', margin: 0, lineHeight: 1.6 }}>
            How should Heard sound when replying to happy customers?
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {POSITIVE_TONES.map((tone) => (
              <ToneCard
                key={tone.id}
                tone={tone}
                selected={tonePositive === tone.id}
                onSelect={() => setTonePositive(tone.id)}
              />
            ))}
          </div>
          <PrimaryButton>Next →</PrimaryButton>
        </form>
      </div>
    ),

    3: (
      <div style={{ width: '100%', maxWidth: '420px' }}>
        <ProgressPills step={step} />
        <form onSubmit={handleStep3} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {error && (
            <div style={{ padding: '12px 16px', backgroundColor: 'var(--color-escalate-bg)', borderRadius: 'var(--radius-md)', fontFamily: 'Epilogue', fontSize: '13px', color: 'var(--color-escalate)' }}>
              {error}
            </div>
          )}
          <h1 className="sr-only md:not-sr-only" style={{ fontFamily: 'Epilogue', fontWeight: 500, fontSize: '20px', color: 'var(--color-text)', margin: 0 }}>
            Tone for complaints
          </h1>
          <p className="hidden md:block" style={{ fontFamily: 'Epilogue', fontSize: '14px', color: 'var(--color-muted)', margin: 0, lineHeight: 1.6 }}>
            How should Heard sound when something went wrong for a customer?
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {NEGATIVE_TONES.map((tone) => (
              <ToneCard
                key={tone.id}
                tone={tone}
                selected={toneNegative === tone.id}
                onSelect={() => setToneNegative(tone.id)}
              />
            ))}
          </div>
          <PrimaryButton loading={loading}>
            {loading ? 'Saving...' : 'Finish Setup →'}
          </PrimaryButton>
          <SkipLink onClick={() => setStep(4)}>Skip — use defaults</SkipLink>
        </form>
      </div>
    ),

    4: (
      <div style={{ width: '100%', maxWidth: '420px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <ProgressPills step={step} />
        <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'var(--color-success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M4.5 11L9 15.5L17.5 7" stroke="#216F3F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h1 style={{ fontFamily: 'Epilogue', fontWeight: 500, fontSize: '28px', color: 'var(--color-text)', margin: '0 0 12px' }}>
          You&apos;re all set.
        </h1>
        <p style={{ fontFamily: 'Epilogue', fontSize: '15px', color: 'var(--color-muted)', maxWidth: '380px', lineHeight: 1.6, margin: '0 0 24px' }}>
          {storeConnected
            ? 'Heard is listening — drafts will appear in your approval queue as reviews come in. Check the Reviews screen to review and post.'
            : 'No store connected yet. Visit Settings to connect your store and start receiving drafts.'}
        </p>
        {storeConnected && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '14px 16px', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)', marginBottom: '24px', maxWidth: '400px', width: '100%' }}>
            <div style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: 'var(--color-accent-dim)', marginTop: '5px', flexShrink: 0 }} />
            <div>
              <p style={{ fontFamily: 'Epilogue', fontWeight: 500, fontSize: '13px', color: 'var(--color-text)', margin: '0 0 2px' }}>
                Starting in Manual Approval mode
              </p>
              <p style={{ fontFamily: 'Epilogue', fontSize: '12px', color: 'var(--color-muted)', margin: 0, lineHeight: 1.5 }}>
                Nothing posts automatically — every draft waits for you. Switch to Auto-Post anytime in{' '}
                <a href="/dashboard/settings" style={{ color: 'var(--color-accent-dim)', textDecoration: 'none' }}>
                  Settings
                </a>
                {' '}when you&apos;re ready.
              </p>
            </div>
          </div>
        )}
        <button
          onClick={() => router.push('/dashboard')}
          style={{ width: '400px', maxWidth: '100%', height: '52px', backgroundColor: 'var(--color-accent)', border: 'none', borderRadius: 'var(--radius-md)', fontFamily: 'Epilogue', fontWeight: 500, fontSize: '15px', color: 'var(--color-text)', cursor: 'pointer', marginBottom: '16px' }}
        >
          Go to Dashboard →
        </button>
        <button
          onClick={() => router.push('/dashboard/settings')}
          style={{ background: 'none', border: 'none', fontFamily: 'Epilogue', fontSize: '13px', color: 'var(--color-muted)', cursor: 'pointer' }}
        >
          Review your settings first
        </button>
      </div>
    ),
  }

  return <SplitHeroLayout left={leftContent[step]} right={rightContent[step]} />
}

export default function SetupPage() {
  return (
    <Suspense fallback={<div />}>
      <SetupContent />
    </Suspense>
  )
}
