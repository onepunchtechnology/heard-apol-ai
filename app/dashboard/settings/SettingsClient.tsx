'use client'

import { useState, useRef, KeyboardEvent } from 'react'

interface Store {
  id: string
  store_domain: string
  store_name: string | null
  google_connection_mode: string | null
  google_location_name: string | null
}

interface BrandVoice {
  id: string
  sample_replies: string[]
  rules: string[]
  tone_description: string | null
  tone_positive: string | null
  tone_negative: string | null
}

type TonePositive = 'warm' | 'enthusiastic' | 'polished'
type ToneNegative = 'empathetic' | 'solution_focused' | 'measured'

const POSITIVE_TONES: Array<{ id: TonePositive; label: string }> = [
  { id: 'warm', label: 'Warm' },
  { id: 'enthusiastic', label: 'Enthusiastic' },
  { id: 'polished', label: 'Polished' },
]

const NEGATIVE_TONES: Array<{ id: ToneNegative; label: string }> = [
  { id: 'empathetic', label: 'Empathetic' },
  { id: 'solution_focused', label: 'Solution-Focused' },
  { id: 'measured', label: 'Measured' },
]

const SAMPLE_REVIEWS = [
  { text: 'Paid $89 for this figure and it arrived with a snapped base. Completely unacceptable.', reviewer: 'Tyler B.' },
  { text: 'Best anime store I\'ve found online. The packaging is always perfect and figures arrive pristine.', reviewer: 'Mei C.' },
  { text: 'The figure itself is gorgeous — the wing detail is incredible. Minor accessory was loose.', reviewer: 'Jordan K.' },
]

const SAMPLE_REPLIES = [
  'Hi Tyler — we are so sorry to hear your figure arrived damaged. This is not the standard we hold ourselves to. Please email us at support@ohayopop.com and we will make this right right away.',
  'Arigatou, Mei! It makes us so happy to hear you\'re loving your order. Thank you for being such a wonderful part of the OhayoPop community. We can\'t wait for you to see what\'s coming next! 🌸',
  'Thank you for the thoughtful review, Jordan! We\'re so glad the figure impressed. We\'re passing your packaging feedback along to our team. We hope it looks incredible on display! 🙌',
]

export default function SettingsClient({
  store,
  brandVoice,
  judgemeConnected,
}: {
  store: Store | null
  brandVoice: BrandVoice | null
  judgemeConnected: boolean
}) {
  // Brand voice state
  const [description, setDescription] = useState(brandVoice?.tone_description ?? '')
  const [tonePositive, setTonePositive] = useState<TonePositive>(
    (brandVoice?.tone_positive as TonePositive | null) ?? 'warm'
  )
  const [toneNegative, setToneNegative] = useState<ToneNegative>(
    (brandVoice?.tone_negative as ToneNegative | null) ?? 'empathetic'
  )
  const [prohibitedPhrases, setProhibitedPhrases] = useState<string[]>(
    brandVoice?.rules ?? ['I apologize', 'Unfortunately'],
  )
  const [customRules, setCustomRules] = useState('')
  const [phraseInput, setPhraseInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const phraseInputRef = useRef<HTMLInputElement>(null)

  // Store connections state
  const [judgeToken, setJudgeToken] = useState('')
  const [tokenSaving, setTokenSaving] = useState(false)
  const [tokenResult, setTokenResult] = useState<'saved' | 'error' | null>(null)
  const [googlePaste, setGooglePaste] = useState('')
  const [previewIdx, setPreviewIdx] = useState(0)

  async function handleUpdateToken() {
    if (!judgeToken.trim()) return
    setTokenSaving(true)
    setTokenResult(null)
    const res = await fetch('/api/settings/judgeme-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: judgeToken }),
    })
    setTokenSaving(false)
    if (res.ok) {
      setJudgeToken('')
      setTokenResult('saved')
      setTimeout(() => setTokenResult(null), 2000)
    } else {
      setTokenResult('error')
    }
  }

  function addPhrase(phrase: string) {
    const trimmed = phrase.trim()
    if (trimmed && !prohibitedPhrases.includes(trimmed)) {
      setProhibitedPhrases((prev) => [...prev, trimmed])
    }
    setPhraseInput('')
  }

  function handlePhraseKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      addPhrase(phraseInput)
    }
  }

  function removePhrase(idx: number) {
    setProhibitedPhrases((prev) => prev.filter((_, i) => i !== idx))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const allRules = [
      ...prohibitedPhrases,
      ...(customRules.trim() ? customRules.split('\n').filter(Boolean) : []),
    ]
    await fetch('/api/settings/brand-voice', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tone_description: description,
        tone_positive: tonePositive,
        tone_negative: toneNegative,
        rules: allRules,
        sample_replies: brandVoice?.sample_replies ?? [],
      }),
    })
    setSaved(true)
    setSaving(false)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div style={{ padding: '48px 32px', maxWidth: '1200px' }}>
      <h1
        style={{
          fontSize: 'var(--text-xl)',
          fontWeight: 500,
          color: 'var(--color-text)',
          marginBottom: '32px',
        }}
      >
        Settings
      </h1>

      {/* ── Section 1: Store Connections ── */}
      <div
        style={{
          backgroundColor: 'var(--color-bg)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          padding: '24px',
          marginBottom: '32px',
        }}
      >
        <h2
          style={{
            fontSize: 'var(--text-lg)',
            fontWeight: 500,
            color: 'var(--color-text)',
            marginBottom: '16px',
          }}
        >
          Store Connections
        </h2>
        <div style={{ height: '1px', backgroundColor: 'var(--color-border)', marginBottom: '24px' }} />

        {store ? (
          <>
            {/* Judge.me */}
            <div style={{ paddingBottom: '24px', marginBottom: '24px', borderBottom: '1px solid var(--color-border)' }}>
              <div className="flex items-center justify-between" style={{ marginBottom: '12px' }}>
                <span style={{ fontSize: 'var(--text-base)', fontWeight: 500, color: 'var(--color-text)' }}>
                  Judge.me
                </span>
                <StatusPill connected={judgemeConnected} />
              </div>
              <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--color-text)', display: 'block', marginBottom: '6px' }}>
                API Token
              </label>
              <input
                type="password"
                value={judgeToken}
                onChange={(e) => setJudgeToken(e.target.value)}
                placeholder="••••••••••••••••"
                style={{
                  width: '100%',
                  height: '48px',
                  padding: '0 16px',
                  backgroundColor: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--color-text)',
                  fontFamily: 'inherit',
                  marginBottom: '6px',
                }}
              />
              <a
                href="https://judge.me/admin/settings/integrations"
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 'var(--text-sm)', color: 'var(--color-accent-dim)', textDecoration: 'none' }}
              >
                Where do I find this?
              </a>
              {tokenResult === 'error' && (
                <p style={{ fontSize: '12px', color: 'var(--color-escalate)', margin: '6px 0 0' }}>
                  Failed to update token. Please try again.
                </p>
              )}
              <div className="flex gap-3 items-center" style={{ marginTop: '12px' }}>
                <button
                  onClick={handleUpdateToken}
                  disabled={tokenSaving || !judgeToken.trim()}
                  style={{
                    height: '40px',
                    padding: '0 16px',
                    backgroundColor: tokenResult === 'saved' ? 'var(--color-success-bg)' : 'var(--color-accent)',
                    color: tokenResult === 'saved' ? 'var(--color-success)' : 'var(--color-text)',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: tokenSaving || !judgeToken.trim() ? 'not-allowed' : 'pointer',
                    opacity: tokenSaving || !judgeToken.trim() ? 0.5 : 1,
                    transition: `background-color var(--duration-short) var(--ease-out), color var(--duration-short) var(--ease-out)`,
                  }}
                >
                  {tokenSaving ? 'Updating…' : tokenResult === 'saved' ? 'Saved ✓' : 'Update Token'}
                </button>
                <button
                  disabled
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: 'var(--text-sm)',
                    color: 'var(--color-escalate)',
                    cursor: 'not-allowed',
                    padding: 0,
                    opacity: 0.5,
                  }}
                >
                  Disconnect
                </button>
              </div>
            </div>

            {/* Shopify */}
            <div style={{ paddingBottom: '24px', marginBottom: '24px', borderBottom: '1px solid var(--color-border)' }}>
              <div className="flex items-center justify-between" style={{ marginBottom: '8px' }}>
                <span style={{ fontSize: 'var(--text-base)', fontWeight: 500, color: 'var(--color-text)' }}>
                  Shopify
                </span>
                <StatusPill connected />
              </div>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)' }}>
                Connected via OAuth · {store.store_name ?? store.store_domain}
              </p>
              <button
                disabled
                style={{
                  marginTop: '12px',
                  background: 'none',
                  border: 'none',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--color-escalate)',
                  cursor: 'not-allowed',
                  padding: 0,
                  opacity: 0.5,
                }}
              >
                Disconnect store
              </button>
            </div>

            {/* Google Business Profile */}
            <div>
              <div className="flex items-center justify-between" style={{ marginBottom: '8px' }}>
                <span style={{ fontSize: 'var(--text-base)', fontWeight: 500, color: 'var(--color-text)' }}>
                  Google Business Profile
                </span>
                {store.google_connection_mode ? (
                  <span
                    style={{
                      fontSize: 'var(--text-xs)',
                      backgroundColor: 'var(--color-warning-bg)',
                      color: 'var(--color-warning)',
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    Manual mode
                  </span>
                ) : (
                  <StatusPill connected={false} />
                )}
              </div>

              <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--color-text)', display: 'block', marginBottom: '8px' }}>
                Connection Mode
              </label>
              <div className="flex gap-2" style={{ marginBottom: '12px' }}>
                <button
                  style={{
                    height: '32px',
                    padding: '0 14px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 'var(--text-sm)',
                    border: 'none',
                    cursor: 'pointer',
                    backgroundColor: store.google_connection_mode === 'manual_paste' || !store.google_connection_mode
                      ? 'var(--color-accent)'
                      : 'var(--color-surface)',
                    color: store.google_connection_mode === 'manual_paste' || !store.google_connection_mode
                      ? 'var(--color-text)'
                      : 'var(--color-muted)',
                  }}
                >
                  Manual paste
                </button>
                <button
                  disabled
                  style={{
                    height: '32px',
                    padding: '0 14px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 'var(--text-sm)',
                    border: 'none',
                    cursor: 'not-allowed',
                    backgroundColor: 'var(--color-surface)',
                    color: 'var(--color-muted)',
                    opacity: 0.6,
                  }}
                >
                  API connection
                  <span style={{ fontSize: 'var(--text-xs)', marginLeft: '6px' }}>Pending approval</span>
                </button>
              </div>

              {(store.google_connection_mode === 'manual_paste' || !store.google_connection_mode) && (
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text)', display: 'block', marginBottom: '6px' }}>
                    Review URL or content
                  </label>
                  <textarea
                    value={googlePaste}
                    onChange={(e) => setGooglePaste(e.target.value)}
                    rows={3}
                    placeholder="Paste a Google review URL or review text to add it manually."
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      backgroundColor: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 'var(--text-sm)',
                      color: 'var(--color-text)',
                      fontFamily: 'inherit',
                      resize: 'none',
                    }}
                  />
                </div>
              )}

              <p style={{ fontSize: '12px', color: 'var(--color-muted)' }}>
                Google Business Profile API requires formal approval from Google.{' '}
                <a
                  href="https://developers.google.com/my-business/content/prereqs#request-access"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--color-accent-dim)', textDecoration: 'none' }}
                >
                  Apply for access ↗
                </a>
              </p>
            </div>
          </>
        ) : (
          <p style={{ color: 'var(--color-muted)', fontSize: 'var(--text-sm)' }}>
            No store connected.{' '}
            <a href="/setup" style={{ color: 'var(--color-accent-dim)' }}>
              Complete setup
            </a>{' '}
            to connect your store.
          </p>
        )}
      </div>

      {/* ── Section 2: Brand Voice ── */}
      <form
        onSubmit={handleSave}
        style={{
          backgroundColor: 'var(--color-bg)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          padding: '24px',
        }}
      >
        <h2
          style={{
            fontSize: 'var(--text-lg)',
            fontWeight: 500,
            color: 'var(--color-text)',
            marginBottom: '16px',
          }}
        >
          Brand Voice
        </h2>
        <div style={{ height: '1px', backgroundColor: 'var(--color-border)', marginBottom: '24px' }} />

        {/* Brand description */}
        <FieldGroup label="Brand description">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="Describe your store's personality and how you want to sound to customers."
            style={{
              width: '100%',
              height: '100px',
              padding: '10px 14px',
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--text-sm)',
              color: 'var(--color-text)',
              fontFamily: 'inherit',
              resize: 'none',
            }}
          />
        </FieldGroup>

        {/* Tone for positive reviews */}
        <FieldGroup label="Tone — positive reviews">
          <div className="flex gap-2">
            {POSITIVE_TONES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTonePositive(t.id)}
                style={{
                  height: '32px',
                  padding: '0 14px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 'var(--text-sm)',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: tonePositive === t.id ? 'var(--color-accent)' : 'var(--color-surface)',
                  color: tonePositive === t.id ? 'var(--color-text)' : 'var(--color-muted)',
                  fontWeight: tonePositive === t.id ? 500 : 400,
                  transition: `background-color var(--duration-micro) var(--ease-out)`,
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </FieldGroup>

        {/* Tone for negative reviews */}
        <FieldGroup label="Tone — complaints &amp; negative reviews">
          <div className="flex gap-2">
            {NEGATIVE_TONES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setToneNegative(t.id)}
                style={{
                  height: '32px',
                  padding: '0 14px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 'var(--text-sm)',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: toneNegative === t.id ? 'var(--color-accent)' : 'var(--color-surface)',
                  color: toneNegative === t.id ? 'var(--color-text)' : 'var(--color-muted)',
                  fontWeight: toneNegative === t.id ? 500 : 400,
                  transition: `background-color var(--duration-micro) var(--ease-out)`,
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </FieldGroup>

        {/* Prohibited phrases tag input */}
        <FieldGroup label="Prohibited phrases">
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '6px',
              padding: '10px 12px',
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              minHeight: '48px',
              cursor: 'text',
            }}
            onClick={() => phraseInputRef.current?.focus()}
          >
            {prohibitedPhrases.map((phrase, i) => (
              <span
                key={i}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  backgroundColor: 'var(--color-escalate-bg)',
                  color: 'var(--color-escalate)',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 'var(--text-xs)',
                }}
              >
                {phrase}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removePhrase(i) }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-escalate)',
                    cursor: 'pointer',
                    padding: 0,
                    lineHeight: 1,
                    fontSize: '12px',
                  }}
                >
                  ×
                </button>
              </span>
            ))}
            <input
              ref={phraseInputRef}
              value={phraseInput}
              onChange={(e) => setPhraseInput(e.target.value)}
              onKeyDown={handlePhraseKeyDown}
              onBlur={() => { if (phraseInput.trim()) addPhrase(phraseInput) }}
              placeholder={prohibitedPhrases.length === 0 ? 'Add a phrase…' : ''}
              style={{
                border: 'none',
                outline: 'none',
                background: 'transparent',
                fontSize: 'var(--text-xs)',
                color: 'var(--color-text)',
                fontFamily: 'inherit',
                minWidth: '80px',
                flex: 1,
              }}
            />
          </div>
          <p style={{ fontSize: '11px', color: 'var(--color-muted)', marginTop: '4px' }}>
            Press Enter to add. Agent will never use these phrases in replies.
          </p>
        </FieldGroup>

        {/* Custom rules */}
        <FieldGroup label="Custom rules">
          <textarea
            value={customRules}
            onChange={(e) => setCustomRules(e.target.value)}
            rows={3}
            placeholder="e.g. Always offer a 10% discount code for 1-star reviews. Never name competitor brands."
            style={{
              width: '100%',
              height: '80px',
              padding: '10px 14px',
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--text-sm)',
              color: 'var(--color-text)',
              fontFamily: 'inherit',
              resize: 'none',
            }}
          />
        </FieldGroup>

        {/* Voice preview */}
        <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '24px', marginTop: '8px', marginBottom: '24px' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: '12px' }}>
            <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text)' }}>
              Voice preview
            </span>
            <button
              type="button"
              onClick={() => setPreviewIdx((i) => (i + 1) % SAMPLE_REVIEWS.length)}
              style={{
                background: 'none',
                border: 'none',
                fontSize: 'var(--text-xs)',
                color: 'var(--color-accent-dim)',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              Regenerate ↻
            </button>
          </div>

          {/* Sample review */}
          <div
            style={{
              backgroundColor: 'var(--color-surface)',
              borderRadius: 'var(--radius-md)',
              padding: '12px',
              marginBottom: '8px',
            }}
          >
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', marginBottom: '4px' }}>
              Sample review — {SAMPLE_REVIEWS[previewIdx].reviewer}
            </p>
            <p style={{ fontSize: 'var(--text-sm)', fontStyle: 'italic', color: 'var(--color-text)', margin: 0 }}>
              &ldquo;{SAMPLE_REVIEWS[previewIdx].text}&rdquo;
            </p>
          </div>

          <p style={{ textAlign: 'center', fontSize: 'var(--text-xs)', color: 'var(--color-muted)', margin: '4px 0' }}>→</p>

          {/* Draft reply */}
          <div
            style={{
              backgroundColor: 'var(--color-surface-2)',
              borderRadius: 'var(--radius-md)',
              padding: '12px',
            }}
          >
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', marginBottom: '4px' }}>
              Draft reply
            </p>
            <p style={{ fontSize: '14px', color: 'var(--color-text)', margin: 0, lineHeight: 1.6 }}>
              {brandVoice?.sample_replies?.[previewIdx] ?? SAMPLE_REPLIES[previewIdx]}
            </p>
            <p style={{ fontSize: '11px', color: 'var(--color-muted)', marginTop: '6px', marginBottom: 0 }}>
              Powered by Gemini 2.5 Flash
            </p>
          </div>
        </div>

        {/* Save button */}
        <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="submit"
            disabled={saving}
            style={{
              width: '240px',
              height: '48px',
              backgroundColor: 'var(--color-accent)',
              color: saved ? 'var(--color-success)' : 'var(--color-text)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--text-base)',
              fontWeight: 500,
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.6 : 1,
              transition: `color var(--duration-medium) var(--ease-out), opacity var(--duration-short) var(--ease-out)`,
            }}
          >
            {saved ? 'Saved ✓' : saving ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      </form>
    </div>
  )
}

function StatusPill({ connected }: { connected: boolean }) {
  return (
    <span
      style={{
        fontSize: 'var(--text-xs)',
        backgroundColor: connected ? 'var(--color-success-bg)' : 'var(--color-warning-bg)',
        color: connected ? 'var(--color-success)' : 'var(--color-warning)',
        padding: '2px 8px',
        borderRadius: 'var(--radius-sm)',
      }}
    >
      {connected ? 'Connected' : 'Not connected'}
    </span>
  )
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '24px' }}>
      <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--color-text)' }}>
        {label}
      </label>
      {children}
    </div>
  )
}
