'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { SplitHeroLayout } from '@/components/ui/SplitHeroLayout'

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908C16.658 14.148 17.64 11.84 17.64 9.2z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  )
}

export default function LoginPage() {
  const [mode, setMode] = useState<'default' | 'email'>('default')
  const [email, setEmail] = useState('')
  const [emailState, setEmailState] = useState<'idle' | 'loading' | 'sent'>('idle')
  const [googleLoading, setGoogleLoading] = useState(false)

  async function handleGoogleSignIn() {
    setGoogleLoading(true)
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/confirm?next=/dashboard` },
    })
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    setEmailState('loading')
    const supabase = createClient()
    await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/confirm?next=/dashboard` },
    })
    setEmailState('sent')
  }

  const left = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div>
        <div style={{ fontFamily: '"Instrument Serif"', fontStyle: 'italic', fontSize: '28px', color: 'var(--color-text)', lineHeight: 1 }}>
          Heard
        </div>
        <div style={{ fontFamily: 'Epilogue', fontSize: '12px', color: 'var(--color-muted)', marginTop: '4px' }}>
          by apol.ai
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <p style={{ fontFamily: 'Epilogue', fontWeight: 500, fontSize: '24px', color: 'var(--color-text)', maxWidth: '260px', lineHeight: 1.4, margin: 0 }}>
          Your reviews, answered while you sleep.
        </p>
        <div style={{ display: 'flex', gap: '8px', marginTop: '24px', flexWrap: 'wrap' }}>
          <span style={{ backgroundColor: 'var(--color-success-bg)', color: 'var(--color-success)', padding: '4px 10px', borderRadius: 'var(--radius-sm)', fontFamily: 'Epilogue', fontSize: '13px' }}>
            15 auto-replied
          </span>
          <span style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-accent-dim)', padding: '4px 10px', borderRadius: 'var(--radius-sm)', fontFamily: 'Epilogue', fontSize: '13px' }}>
            3 drafts ready
          </span>
          <span style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-muted)', padding: '4px 10px', borderRadius: 'var(--radius-sm)', fontFamily: 'Epilogue', fontSize: '13px' }}>
            18 total
          </span>
        </div>
      </div>

    </div>
  )

  const right = (
    <div style={{ width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ fontFamily: '"Instrument Serif"', fontStyle: 'italic', fontSize: '18px', color: 'var(--color-text)', marginBottom: '16px' }}>
          Heard
        </div>

        <h1 style={{ fontFamily: 'Epilogue', fontWeight: 500, fontSize: '28px', color: 'var(--color-text)', margin: '0 0 8px', lineHeight: 1.2 }}>
          Welcome to Heard
        </h1>
        <p style={{ fontFamily: 'Epilogue', fontSize: '15px', color: 'var(--color-muted)', margin: '0 0 32px', lineHeight: 1.6 }}>
          Sign in with your Google account to get started.
        </p>

        <button
          onClick={handleGoogleSignIn}
          disabled={googleLoading}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            width: '320px',
            height: '48px',
            backgroundColor: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            fontFamily: 'Epilogue',
            fontWeight: 500,
            fontSize: '15px',
            color: 'var(--color-text)',
            cursor: googleLoading ? 'not-allowed' : 'pointer',
            opacity: googleLoading ? 0.6 : 1,
            transition: `border-color var(--duration-short) var(--ease-out)`,
          }}
        >
          <GoogleLogo />
          {googleLoading ? 'Redirecting...' : 'Continue with Google'}
        </button>

        <p style={{ fontFamily: 'Epilogue', fontSize: '12px', color: 'var(--color-muted)', margin: '12px 0 0' }}>
          No credit card required · Set up in under 2 minutes
        </p>

        {mode === 'default' && (
          <button
            onClick={() => setMode('email')}
            style={{ background: 'none', border: 'none', padding: 0, marginTop: '20px', fontFamily: 'Epilogue', fontSize: '13px', color: 'var(--color-muted)', cursor: 'pointer', textAlign: 'left', textDecoration: 'underline', textDecorationColor: 'var(--color-border)' }}
          >
            Sign in with email instead →
          </button>
        )}

        {mode === 'email' && emailState !== 'sent' && (
          <form onSubmit={handleEmailSubmit} style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={{ width: '320px', height: '48px', padding: '0 16px', backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontFamily: 'Epilogue', fontSize: '15px', color: 'var(--color-text)' }}
            />
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                type="submit"
                disabled={emailState === 'loading'}
                style={{ height: '40px', padding: '0 20px', backgroundColor: 'var(--color-accent)', border: 'none', borderRadius: 'var(--radius-md)', fontFamily: 'Epilogue', fontWeight: 500, fontSize: '13px', color: 'var(--color-text)', cursor: emailState === 'loading' ? 'not-allowed' : 'pointer', opacity: emailState === 'loading' ? 0.6 : 1 }}
              >
                {emailState === 'loading' ? 'Sending...' : 'Send magic link'}
              </button>
              <button
                type="button"
                onClick={() => { setMode('default'); setEmail('') }}
                style={{ background: 'none', border: 'none', fontFamily: 'Epilogue', fontSize: '13px', color: 'var(--color-muted)', cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {mode === 'email' && emailState === 'sent' && (
          <div style={{ marginTop: '20px' }}>
            <p style={{ fontFamily: 'Epilogue', fontSize: '13px', color: 'var(--color-success)', margin: 0 }}>
              Magic link sent to {email}
            </p>
            <p style={{ fontFamily: 'Epilogue', fontSize: '12px', color: 'var(--color-muted)', margin: '4px 0 0' }}>
              Check your email and click the link to sign in.
            </p>
          </div>
        )}
      </div>

      <div style={{ fontFamily: 'Epilogue', fontSize: '12px', color: 'var(--color-muted)' }}>
        heard.apol.ai
      </div>
    </div>
  )

  return <SplitHeroLayout left={left} right={right} />
}
