'use client'

import { useState } from 'react'

interface Store {
  id: string
  store_domain: string
  google_connection_mode: string | null
  google_location_name: string | null
}

interface BrandVoice {
  id: string
  sample_replies: string[]
  rules: string[]
  tone_description: string | null
}

const DEFAULT_RULES = [
  "Never promise refunds or replacements publicly",
  "Always address the customer by first name",
  "Always thank them for leaving a review",
]

export default function SettingsClient({
  store,
  brandVoice,
}: {
  store: Store | null
  brandVoice: BrandVoice | null
}) {
  const [rules, setRules] = useState<string[]>(brandVoice?.rules ?? DEFAULT_RULES)
  const [samples, setSamples] = useState(brandVoice?.sample_replies?.join('\n') ?? '')
  const [tone, setTone] = useState(brandVoice?.tone_description ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function saveBrandVoice(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await fetch('/api/settings/brand-voice', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sample_replies: samples.split('\n').filter(Boolean),
        rules,
        tone_description: tone,
      }),
    })
    setSaved(true)
    setSaving(false)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="p-8 max-w-2xl">
      <h1
        className="mb-8"
        style={{ fontSize: 'var(--text-lg)', fontWeight: 500, color: 'var(--color-text)' }}
      >
        Settings
      </h1>

      <section className="mb-10">
        <h2
          className="mb-4"
          style={{ fontSize: 'var(--text-base)', fontWeight: 500, color: 'var(--color-text)' }}
        >
          Store Connection
        </h2>
        <div
          className="rounded-md p-5"
          style={{
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--color-surface)',
          }}
        >
          {store ? (
            <div className="flex flex-col gap-3">
              <ConnectionRow
                label="Shopify"
                value={store.store_domain}
                status="connected"
              />
              <ConnectionRow
                label="Judge.me"
                value={store.store_domain}
                status="connected"
              />
              <ConnectionRow
                label="Google Business"
                value={
                  store.google_connection_mode === 'api'
                    ? 'API mode'
                    : store.google_connection_mode === 'manual_paste'
                    ? 'Manual paste mode'
                    : 'Not connected'
                }
                status={store.google_connection_mode ? 'connected' : 'disconnected'}
              />
              {store.google_connection_mode === 'manual_paste' && (
                <div
                  className="mt-2 px-4 py-3 rounded-md"
                  style={{
                    backgroundColor: 'var(--color-warning-bg)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--color-warning)',
                  }}
                >
                  Google Business is connected in manual-paste mode. Request Google Business Profile API access to enable automatic posting.
                </div>
              )}
            </div>
          ) : (
            <p style={{ color: 'var(--color-muted)', fontSize: 'var(--text-sm)' }}>
              No store connected. Complete{' '}
              <a href="/setup" style={{ color: 'var(--color-accent-dim)' }}>
                setup
              </a>{' '}
              to connect your store.
            </p>
          )}
        </div>
      </section>

      <section>
        <h2
          className="mb-4"
          style={{ fontSize: 'var(--text-base)', fontWeight: 500, color: 'var(--color-text)' }}
        >
          Brand Voice
        </h2>
        <form onSubmit={saveBrandVoice} className="flex flex-col gap-5">
          <FormField label="Sample replies (one per line)">
            <textarea
              value={samples}
              onChange={(e) => setSamples(e.target.value)}
              rows={6}
              placeholder="Paste 5–10 past replies you've written to customer reviews, one per line"
              className="w-full px-4 py-3 rounded-md resize-none"
              style={{
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--text-sm)',
                color: 'var(--color-text)',
                fontFamily: 'inherit',
              }}
            />
          </FormField>

          <FormField label="Rules">
            <div className="flex flex-col gap-2">
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
                      backgroundColor: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 'var(--text-sm)',
                      color: 'var(--color-text)',
                      fontFamily: 'inherit',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setRules(rules.filter((_, idx) => idx !== i))}
                    style={{
                      color: 'var(--color-muted)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 'var(--text-sm)',
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setRules([...rules, ''])}
                style={{
                  color: 'var(--color-muted)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 'var(--text-sm)',
                  textAlign: 'left',
                  padding: '4px 0',
                }}
              >
                + Add rule
              </button>
            </div>
          </FormField>

          <FormField label="Tone description (optional)">
            <input
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              placeholder="e.g. Warm, enthusiastic, uses anime references when appropriate"
              className="w-full px-4 py-3 rounded-md"
              style={{
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--text-sm)',
                color: 'var(--color-text)',
                fontFamily: 'inherit',
              }}
            />
          </FormField>

          <button
            type="submit"
            disabled={saving}
            className="self-start px-6 py-2 rounded-md font-medium transition-opacity"
            style={{
              backgroundColor: 'var(--color-accent)',
              color: 'var(--color-text)',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--text-sm)',
              fontWeight: 500,
              border: 'none',
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.5 : 1,
            }}
          >
            {saved ? 'Saved' : saving ? 'Saving...' : 'Save brand voice'}
          </button>
        </form>
      </section>
    </div>
  )
}

function ConnectionRow({
  label,
  value,
  status,
}: {
  label: string
  value: string
  status: 'connected' | 'disconnected'
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <span
          style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--color-text)' }}
        >
          {label}
        </span>
        <span
          className="ml-2"
          style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)' }}
        >
          {value}
        </span>
      </div>
      <span
        style={{
          fontSize: 'var(--text-xs)',
          color: status === 'connected' ? 'var(--color-success)' : 'var(--color-muted)',
        }}
      >
        {status}
      </span>
    </div>
  )
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <label style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)' }}>
        {label}
      </label>
      {children}
    </div>
  )
}
