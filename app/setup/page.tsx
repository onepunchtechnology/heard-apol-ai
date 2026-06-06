'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { SplitHeroLayout } from '@/components/ui/SplitHeroLayout'

type Step = 1 | 2 | 3

const STEP_LABELS = ['1 Connect', '2 Customize', '3 Complete'] as const

function ProgressPills({ step }: { step: Step }) {
  return (
    <div style={{ display: 'flex', gap: '6px', marginBottom: '32px' }}>
      {STEP_LABELS.map((label, i) => {
        const n = (i + 1) as Step
        const done = n < step || step === 3
        const active = n === step && step !== 3
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

function FormInput({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  helpLink,
  helpText,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder: string
  type?: string
  helpLink?: string
  helpText?: string
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <label style={{ fontFamily: 'Epilogue', fontSize: '13px', color: 'var(--color-text)', fontWeight: 500 }}>
          {label}
        </label>
        {helpLink && helpText && (
          <a href={helpLink} target="_blank" rel="noopener noreferrer" style={{ fontFamily: 'Epilogue', fontSize: '13px', color: 'var(--color-accent-dim)', textDecoration: 'none' }}>
            {helpText}
          </a>
        )}
      </div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ width: '100%', height: '48px', padding: '0 16px', backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontFamily: 'Epilogue', fontSize: '15px', color: 'var(--color-text)' }}
      />
    </div>
  )
}

function PrimaryButton({ children, loading, type = 'submit' }: { children: React.ReactNode; loading?: boolean; type?: 'submit' | 'button' }) {
  return (
    <button
      type={type}
      disabled={loading}
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

function OrDivider() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--color-border)' }} />
      <span style={{ fontFamily: 'Epilogue', fontSize: '13px', color: 'var(--color-muted)' }}>or</span>
      <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--color-border)' }} />
    </div>
  )
}

export default function SetupPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [shopDomain, setShopDomain] = useState('')
  const [shopifyToken, setShopifyToken] = useState('')
  const [judgemeToken, setJudgemeToken] = useState('')

  const [voiceDescription, setVoiceDescription] = useState('')
  const [tone, setTone] = useState<'Friendly' | 'Professional' | 'Playful'>('Friendly')
  const [voiceFeedback, setVoiceFeedback] = useState<'positive' | 'negative' | null>(null)

  async function handleStep1(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      if (shopDomain && shopifyToken) {
        const res = await fetch('/api/setup/shopify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ store_domain: shopDomain, access_token: shopifyToken }),
        })
        if (!res.ok) {
          const { error: err } = await res.json()
          setError(err ?? 'Shopify connection failed')
          return
        }
      }
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
      }
      setStep(2)
    } finally {
      setLoading(false)
    }
  }

  async function handleStep2(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await fetch('/api/setup/brand-voice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tone_description: voiceDescription || tone,
        sample_replies: [],
        rules: [],
      }),
    })
    setLoading(false)
    setStep(3)
  }

  const leftContent: Record<Step, React.ReactNode> = {
    1: (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <StepBadge n={1} total={3} />
        <p style={{ fontFamily: '"Instrument Serif"', fontStyle: 'italic', fontSize: '36px', color: 'var(--color-text)', lineHeight: 1.1, margin: '0 0 16px', maxWidth: '280px' }}>
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
        <StepBadge n={2} total={3} />
        <p style={{ fontFamily: '"Instrument Serif"', fontStyle: 'italic', fontSize: '36px', color: 'var(--color-text)', lineHeight: 1.1, margin: '0 0 16px', maxWidth: '280px' }}>
          Teach Heard your voice.
        </p>
        <p style={{ fontFamily: 'Epilogue', fontSize: '15px', color: 'var(--color-muted)', maxWidth: '270px', lineHeight: 1.6, margin: '0 0 24px' }}>
          We analyzed 3 recent OhayoPop reviews. Does this sound like you?
        </p>
        <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', padding: '16px', marginBottom: '12px' }}>
          <div style={{ fontFamily: 'Epilogue', fontSize: '11px', color: 'var(--color-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Sample reply
          </div>
          <p style={{ fontFamily: 'Epilogue', fontSize: '14px', color: 'var(--color-text)', fontStyle: 'italic', margin: 0, lineHeight: 1.6 }}>
            &ldquo;Hi Yuki! Thank you so much for your wonderful review — we&apos;re thrilled you love your Demon Slayer figure. Your passion for anime inspires everything we do at OhayoPop. Hope to see you again soon! 🎌&rdquo;
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setVoiceFeedback('positive')}
            style={{ height: '32px', padding: '0 14px', borderRadius: 'var(--radius-md)', fontFamily: 'Epilogue', fontSize: '13px', border: 'none', cursor: 'pointer', backgroundColor: voiceFeedback === 'positive' ? 'var(--color-success-bg)' : 'var(--color-surface-2)', color: voiceFeedback === 'positive' ? 'var(--color-success)' : 'var(--color-text)', transition: `background-color var(--duration-micro) var(--ease-out)` }}
          >
            Sounds like us ✓
          </button>
          <button
            onClick={() => setVoiceFeedback('negative')}
            style={{ height: '32px', padding: '0 14px', borderRadius: 'var(--radius-md)', fontFamily: 'Epilogue', fontSize: '13px', border: 'none', cursor: 'pointer', backgroundColor: voiceFeedback === 'negative' ? 'var(--color-escalate-bg)' : 'var(--color-surface-2)', color: voiceFeedback === 'negative' ? 'var(--color-escalate)' : 'var(--color-text)', transition: `background-color var(--duration-micro) var(--ease-out)` }}
          >
            Too formal
          </button>
        </div>
        <div style={{ marginTop: 'auto', paddingTop: '32px' }}>
          <p style={{ fontFamily: 'Epilogue', fontSize: '11px', color: 'var(--color-muted)', margin: 0 }}>
            Powered by Gemini 2.5 Flash
          </p>
        </div>
      </div>
    ),

    3: (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <p style={{ fontFamily: '"Instrument Serif"', fontStyle: 'italic', fontSize: '40px', color: 'var(--color-text)', lineHeight: 1.1, margin: '0 0 16px', maxWidth: '280px' }}>
          Heard is listening.
        </p>
        <p style={{ fontFamily: 'Epilogue', fontSize: '16px', color: 'var(--color-muted)', maxWidth: '270px', lineHeight: 1.6, margin: '0 0 32px' }}>
          Your first review will be auto-replied within minutes.
        </p>
        <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', padding: '20px', display: 'flex', gap: '24px', marginBottom: '24px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: '"Instrument Serif"', fontStyle: 'italic', fontSize: '28px', color: 'var(--color-success)', lineHeight: 1 }}>0</div>
            <div style={{ fontFamily: 'Epilogue', fontSize: '11px', color: 'var(--color-muted)', marginTop: '4px' }}>auto-replied</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: '"Instrument Serif"', fontStyle: 'italic', fontSize: '28px', color: 'var(--color-accent-dim)', lineHeight: 1 }}>0</div>
            <div style={{ fontFamily: 'Epilogue', fontSize: '11px', color: 'var(--color-muted)', marginTop: '4px' }}>drafts</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: '"Instrument Serif"', fontStyle: 'italic', fontSize: '28px', color: 'var(--color-muted)', lineHeight: 1 }}>0</div>
            <div style={{ fontFamily: 'Epilogue', fontSize: '11px', color: 'var(--color-muted)', marginTop: '4px' }}>escalations</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: 'var(--color-success)' }} />
          <span style={{ fontFamily: 'Epilogue', fontSize: '13px', color: 'var(--color-muted)' }}>OhayoPop · Live</span>
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
          <h1 style={{ fontFamily: 'Epilogue', fontWeight: 500, fontSize: '20px', color: 'var(--color-text)', margin: 0 }}>
            Connect your store
          </h1>
          <FormInput label="Shopify store domain" placeholder="yourstore.myshopify.com" value={shopDomain} onChange={setShopDomain} />
          <FormInput label="Shopify access token" placeholder="shpat_..." type="password" value={shopifyToken} onChange={setShopifyToken} />
          <OrDivider />
          <FormInput
            label="Judge.me API token"
            placeholder="Paste your private API token"
            type="password"
            value={judgemeToken}
            onChange={setJudgemeToken}
            helpLink="https://judge.me/admin/settings/integrations"
            helpText="Where do I find this?"
          />
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
        <form onSubmit={handleStep2} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <h1 style={{ fontFamily: 'Epilogue', fontWeight: 500, fontSize: '20px', color: 'var(--color-text)', margin: '0 0 8px' }}>
              Brand Voice Setup
            </h1>
            <p style={{ fontFamily: 'Epilogue', fontSize: '14px', color: 'var(--color-muted)', margin: 0, lineHeight: 1.6 }}>
              Heard will use your brand voice for every reply. You can always edit it in Settings.
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontFamily: 'Epilogue', fontSize: '13px', color: 'var(--color-text)', fontWeight: 500 }}>
              How would you describe your brand voice?
            </label>
            <textarea
              value={voiceDescription}
              onChange={(e) => setVoiceDescription(e.target.value)}
              placeholder="e.g. Warm and enthusiastic, with genuine love for anime culture. Always address customers by first name."
              style={{ width: '100%', height: '120px', padding: '12px 16px', backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontFamily: 'Epilogue', fontSize: '14px', color: 'var(--color-text)', resize: 'none', lineHeight: 1.6 }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontFamily: 'Epilogue', fontSize: '13px', color: 'var(--color-text)', fontWeight: 500 }}>Tone</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {(['Friendly', 'Professional', 'Playful'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTone(t)}
                  style={{ height: '36px', padding: '0 16px', borderRadius: 'var(--radius-md)', fontFamily: 'Epilogue', fontSize: '13px', border: 'none', cursor: 'pointer', backgroundColor: tone === t ? 'var(--color-accent)' : 'var(--color-surface)', color: tone === t ? 'var(--color-text)' : 'var(--color-muted)', fontWeight: tone === t ? 500 : 400, transition: `background-color var(--duration-micro) var(--ease-out)` }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <PrimaryButton loading={loading}>
            {loading ? 'Saving...' : 'Save Voice & Continue →'}
          </PrimaryButton>
          <SkipLink onClick={() => setStep(3)}>Skip — use defaults</SkipLink>
        </form>
      </div>
    ),

    3: (
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
        <p style={{ fontFamily: 'Epilogue', fontSize: '15px', color: 'var(--color-muted)', maxWidth: '380px', lineHeight: 1.6, margin: '0 0 32px' }}>
          Heard is now monitoring OhayoPop reviews and will reply automatically. Check the Activity screen for live updates.
        </p>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '32px', width: '100%', justifyContent: 'center' }}>
          <div style={{ flex: 1, maxWidth: '180px', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
            <div style={{ fontFamily: 'Epilogue', fontWeight: 500, fontSize: '13px', color: 'var(--color-success)', marginBottom: '4px' }}>Auto-reply</div>
            <div style={{ fontFamily: 'Epilogue', fontSize: '12px', color: 'var(--color-success)' }}>On</div>
          </div>
          <div style={{ flex: 1, maxWidth: '180px', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
            <div style={{ fontFamily: 'Epilogue', fontWeight: 500, fontSize: '13px', color: 'var(--color-escalate)', marginBottom: '4px' }}>Human review</div>
            <div style={{ fontFamily: 'Epilogue', fontSize: '12px', color: 'var(--color-escalate)' }}>Risk ≥ 4</div>
          </div>
        </div>
        <button
          onClick={() => router.push('/dashboard')}
          style={{ width: '400px', height: '52px', backgroundColor: 'var(--color-accent)', border: 'none', borderRadius: 'var(--radius-md)', fontFamily: 'Epilogue', fontWeight: 500, fontSize: '15px', color: 'var(--color-text)', cursor: 'pointer', marginBottom: '16px' }}
        >
          Go to Dashboard →
        </button>
        <button
          onClick={() => router.push('/settings')}
          style={{ background: 'none', border: 'none', fontFamily: 'Epilogue', fontSize: '13px', color: 'var(--color-muted)', cursor: 'pointer' }}
        >
          Review your settings first
        </button>
      </div>
    ),
  }

  return <SplitHeroLayout left={leftContent[step]} right={rightContent[step]} />
}
