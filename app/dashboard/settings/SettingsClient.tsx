'use client'

import { useState, useRef, KeyboardEvent } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'

interface Store {
  id: string
  store_domain: string
  store_name: string | null
  google_connection_mode: string | null
  google_location_name: string | null
  reply_mode: 'auto_post' | 'manual_approval'
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

const HEARD_FOCUS_CLASS =
  'focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-dim focus-visible:outline-offset-2'

const BADGE_BASE_CLASS =
  'shadow-none font-normal rounded-sm text-[11px] py-[3px] px-2 leading-none border-transparent'

export default function SettingsClient({
  store,
  brandVoice,
  judgemeConnected,
  shopifyConnected,
}: {
  store: Store | null
  brandVoice: BrandVoice | null
  judgemeConnected: boolean
  shopifyConnected: boolean
}) {
  // Reply mode state
  const [replyMode, setReplyMode] = useState<'auto_post' | 'manual_approval'>(
    store?.reply_mode ?? 'manual_approval'
  )
  const [replyModeStatus, setReplyModeStatus] = useState('')

  async function handleReplyModeChange(mode: 'auto_post' | 'manual_approval') {
    if (mode === replyMode) return
    setReplyMode(mode)
    setReplyModeStatus('Saving reply mode')

    const res = await fetch('/api/settings/reply-mode', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reply_mode: mode }),
    })

    if (res.ok) {
      setReplyModeStatus('Reply mode saved')
      toast('Reply mode saved')
      setTimeout(() => setReplyModeStatus(''), 2000)
    } else {
      setReplyModeStatus('Reply mode failed to save')
      toast('Reply mode failed to save')
    }
  }

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
    <div className="max-w-[1200px] px-4 py-6 md:px-8 md:py-12">
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

      {/* ── Section 0: Reply Mode ── */}
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
            marginBottom: '4px',
          }}
        >
          Reply Mode
        </h2>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)', margin: '0 0 16px' }}>
          Controls whether Heard posts replies automatically or holds every draft for your approval.
        </p>
        <Separator className="mb-6" />

        <div className="flex flex-wrap gap-2" style={{ marginBottom: '12px' }}>
          <button
            type="button"
            className="min-h-[44px] md:min-h-0"
            onClick={() => handleReplyModeChange('manual_approval')}
            style={{
              height: '40px',
              padding: '0 18px',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--text-sm)',
              fontWeight: replyMode === 'manual_approval' ? 500 : 400,
              border: replyMode === 'manual_approval' ? '2px solid var(--color-accent)' : '1px solid var(--color-border)',
              backgroundColor: replyMode === 'manual_approval' ? 'var(--color-surface)' : 'var(--color-bg)',
              color: 'var(--color-text)',
              cursor: 'pointer',
              transition: `border-color var(--duration-short) var(--ease-out), background-color var(--duration-short) var(--ease-out)`,
            }}
          >
            Manual Approval
          </button>
          <button
            type="button"
            className="min-h-[44px] md:min-h-0"
            onClick={() => handleReplyModeChange('auto_post')}
            style={{
              height: '40px',
              padding: '0 18px',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--text-sm)',
              fontWeight: replyMode === 'auto_post' ? 500 : 400,
              border: replyMode === 'auto_post' ? '2px solid var(--color-accent)' : '1px solid var(--color-border)',
              backgroundColor: replyMode === 'auto_post' ? 'var(--color-surface)' : 'var(--color-bg)',
              color: 'var(--color-text)',
              cursor: 'pointer',
              transition: `border-color var(--duration-short) var(--ease-out), background-color var(--duration-short) var(--ease-out)`,
            }}
          >
            Auto-Post
          </button>
          <span className="sr-only" aria-live="polite">
            {replyModeStatus}
          </span>
        </div>

        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', margin: 0 }}>
          {replyMode === 'manual_approval'
            ? 'Heard drafts every reply and waits for your approval before posting. Nothing is sent automatically.'
            : 'Heard posts replies automatically when risk is low. High-risk reviews are always held for your review.'}
        </p>
      </div>

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
        <Separator className="mb-6" />

        {store ? (
          <>
            {/* Judge.me */}
            <div style={{ paddingBottom: '24px', marginBottom: '24px' }}>
              <div className="flex items-center justify-between" style={{ marginBottom: '12px' }}>
                <span style={{ fontSize: 'var(--text-base)', fontWeight: 500, color: 'var(--color-text)' }}>
                  Judge.me
                </span>
                <StatusPill connected={judgemeConnected} />
              </div>
              <label
                htmlFor="judgeme-api-token"
                style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--color-text)', display: 'block', marginBottom: '6px' }}
              >
                API Token
              </label>
              <Input
                id="judgeme-api-token"
                type="password"
                value={judgeToken}
                onChange={(e) => setJudgeToken(e.target.value)}
                placeholder="••••••••••••••••"
                className={cn('bg-surface border-border text-sm h-12 mb-1.5 font-sans', HEARD_FOCUS_CLASS)}
              />
              <a
                href="https://judge.me/admin/settings/integrations"
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)', textDecoration: 'none' }}
              >
                Where do I find this?
              </a>
              {tokenResult === 'error' && (
                <p style={{ fontSize: '12px', color: 'var(--color-escalate)', margin: '6px 0 0' }}>
                  Failed to update token. Please try again.
                </p>
              )}
              <div className="flex flex-wrap gap-3 items-center" style={{ marginTop: '12px' }}>
                <Button
                  type="button"
                  onClick={handleUpdateToken}
                  disabled={tokenSaving || !judgeToken.trim()}
                  className={cn(
                    'h-10 text-sm font-medium',
                    HEARD_FOCUS_CLASS,
                    tokenResult === 'saved'
                      ? 'bg-success-bg text-success hover:bg-success-bg shadow-none'
                      : 'bg-accent text-text hover:bg-accent/90 shadow-none'
                  )}
                >
                  {tokenSaving ? 'Updating…' : tokenResult === 'saved' ? 'Saved ✓' : 'Update Token'}
                </Button>
                <Button
                  variant="ghost"
                  disabled
                  className={cn(
                    'text-escalate hover:text-escalate hover:bg-transparent p-0 h-auto text-sm opacity-50 shadow-none',
                    HEARD_FOCUS_CLASS
                  )}
                >
                  Disconnect
                </Button>
              </div>
              <Separator className="mb-0 mt-6" />
            </div>

            {/* Shopify */}
            <div style={{ paddingBottom: '24px', marginBottom: '24px' }}>
              <div className="flex items-center justify-between" style={{ marginBottom: '8px' }}>
                <span style={{ fontSize: 'var(--text-base)', fontWeight: 500, color: 'var(--color-text)' }}>
                  Shopify
                </span>
                <StatusPill connected={shopifyConnected} />
              </div>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)' }}>
                {shopifyConnected ? `Connected via OAuth · ${store.store_name ?? store.store_domain}` : 'Connect via Shopify OAuth in the setup wizard.'}
              </p>
              <Button
                variant="ghost"
                disabled
                className={cn(
                  'mt-3 text-escalate hover:text-escalate hover:bg-transparent p-0 h-auto text-sm opacity-50 shadow-none',
                  HEARD_FOCUS_CLASS
                )}
              >
                Disconnect store
              </Button>
              <Separator className="mb-0 mt-6" />
            </div>

            {/* Google Business Profile */}
            <div>
              <div className="flex items-center justify-between" style={{ marginBottom: '8px' }}>
                <span style={{ fontSize: 'var(--text-base)', fontWeight: 500, color: 'var(--color-text)' }}>
                  Google Business Profile
                </span>
                {store.google_connection_mode ? (
                  <Badge className={cn(BADGE_BASE_CLASS, 'bg-warning-bg text-warning hover:bg-warning-bg')}>
                    Manual mode
                  </Badge>
                ) : (
                  <StatusPill connected={false} />
                )}
              </div>

              <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--color-text)', display: 'block', marginBottom: '8px' }}>
                Connection Mode
              </label>
              <div className="flex flex-wrap gap-2" style={{ marginBottom: '12px' }}>
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
                  <label
                    htmlFor="google-review-paste"
                    style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text)', display: 'block', marginBottom: '6px' }}
                  >
                    Review URL or content
                  </label>
                  <Textarea
                    id="google-review-paste"
                    value={googlePaste}
                    onChange={(e) => setGooglePaste(e.target.value)}
                    rows={3}
                    placeholder="Paste a Google review URL or review text to add it manually."
                    className={cn('bg-surface border-border text-sm resize-none font-sans', HEARD_FOCUS_CLASS)}
                  />
                </div>
              )}

              <p style={{ fontSize: '12px', color: 'var(--color-muted)' }}>
                Google Business Profile API requires formal approval from Google.{' '}
                <a
                  href="https://developers.google.com/my-business/content/prereqs#request-access"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--color-muted)', textDecoration: 'none' }}
                >
                  Apply for access ↗
                </a>
              </p>
            </div>
          </>
        ) : (
          <p style={{ color: 'var(--color-muted)', fontSize: 'var(--text-sm)' }}>
            No store connected.{' '}
            <a href="/setup" style={{ color: 'var(--color-muted)' }}>
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
        <Separator className="mb-6" />

        {/* Brand description */}
        <FieldGroup label="Brand description" htmlFor="brand-description">
          <Textarea
            id="brand-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="Describe your store's personality and how you want to sound to customers."
            className={cn('bg-surface border-border text-sm resize-none h-[100px] font-sans', HEARD_FOCUS_CLASS)}
          />
        </FieldGroup>

        {/* Tone for positive reviews */}
        <FieldGroup label="Tone — positive reviews">
          <div className="flex flex-wrap gap-2">
            {POSITIVE_TONES.map((t) => (
              <button
                key={t.id}
                type="button"
                className="min-h-[44px] md:min-h-0"
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
          <div className="flex flex-wrap gap-2">
            {NEGATIVE_TONES.map((t) => (
              <button
                key={t.id}
                type="button"
                className="min-h-[44px] md:min-h-0"
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
        <FieldGroup label="Prohibited phrases" htmlFor="prohibited-phrase-input">
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
                  aria-label={`Remove prohibited phrase ${phrase}`}
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
              id="prohibited-phrase-input"
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
        <FieldGroup label="Custom rules" htmlFor="custom-rules">
          <Textarea
            id="custom-rules"
            value={customRules}
            onChange={(e) => setCustomRules(e.target.value)}
            rows={3}
            placeholder="e.g. Always offer a 10% discount code for 1-star reviews. Never name competitor brands."
            className={cn('bg-surface border-border text-sm resize-none h-20 font-sans', HEARD_FOCUS_CLASS)}
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
                color: 'var(--color-muted)',
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
              {SAMPLE_REPLIES[previewIdx]}
            </p>
          </div>
        </div>

        {/* Save button */}
        <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            type="submit"
            disabled={saving}
            className={cn(
              'w-60 h-12 text-base font-medium shadow-none',
              HEARD_FOCUS_CLASS,
              saved
                ? 'bg-success-bg text-success hover:bg-success-bg'
                : 'bg-accent text-text hover:bg-accent/90'
            )}
          >
            {saved ? 'Saved ✓' : saving ? 'Saving…' : 'Save settings'}
          </Button>
        </div>
      </form>
    </div>
  )
}

function StatusPill({ connected }: { connected: boolean }) {
  return (
    <Badge
      className={cn(
        BADGE_BASE_CLASS,
        connected
          ? 'bg-success-bg text-success hover:bg-success-bg'
          : 'bg-warning-bg text-warning hover:bg-warning-bg'
      )}
    >
      {connected ? 'Connected' : 'Not connected'}
    </Badge>
  )
}

function FieldGroup({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '24px' }}>
      <label htmlFor={htmlFor} style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--color-text)' }}>
        {label}
      </label>
      {children}
    </div>
  )
}
