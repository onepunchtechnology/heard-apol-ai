'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/confirm?next=/dashboard` },
    })
    setSubmitted(true)
    setLoading(false)
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: 'var(--color-bg)' }}
    >
      <div className="w-full max-w-sm px-4">
        <div className="text-center mb-8">
          <h1
            className="font-display italic"
            style={{ fontSize: 'var(--text-3xl)', color: 'var(--color-text)' }}
          >
            Heard
          </h1>
          <p
            className="mt-1"
            style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)' }}
          >
            by apol.ai
          </p>
        </div>

        <div
          className="rounded-lg p-10"
          style={{
            backgroundColor: 'var(--color-surface)',
            borderRadius: 'var(--radius-lg)',
          }}
        >
          {submitted ? (
            <div className="text-center">
              <p style={{ color: 'var(--color-text)', fontSize: 'var(--text-base)' }}>
                Check your email for a login link.
              </p>
              <p
                className="mt-2"
                style={{ color: 'var(--color-muted)', fontSize: 'var(--text-sm)' }}
              >
                {email}
              </p>
            </div>
          ) : (
            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <label
                htmlFor="email"
                style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)' }}
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-3 rounded-md border"
                style={{
                  backgroundColor: 'var(--color-bg)',
                  borderColor: 'var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 'var(--text-base)',
                  color: 'var(--color-text)',
                }}
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-md font-sans font-medium transition-opacity"
                style={{
                  backgroundColor: 'var(--color-accent)',
                  color: 'var(--color-text)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 'var(--text-base)',
                  opacity: loading ? 0.5 : 1,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  transitionDuration: 'var(--duration-short)',
                }}
              >
                {loading ? 'Sending...' : 'Send login link'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
