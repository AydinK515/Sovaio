'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, Suspense } from 'react'
import BrandLogo from '@/components/brand-logo'
import { captureAnalyticsEvent } from '@/lib/posthog-client'
import { POSTHOG_EVENTS } from '@/lib/posthog-events'
import { buildAuthCallbackUrl, normalizeAuthRedirectPath } from '@/lib/security'
import { createClient } from '@/lib/supabase-browser'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = normalizeAuthRedirectPath(searchParams.get('redirect'))
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [magicLinkSent, setMagicLinkSent] = useState(false)

  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      captureAnalyticsEvent(POSTHOG_EVENTS.authLoginCompleted, {
        user_id: data.user.id,
      })
      router.push(redirect)
      router.refresh()
    }
  }

  async function handleMagicLink() {
    setError('')
    if (!email) { setError('Enter your email first'); return }
    setLoading(true)

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: buildAuthCallbackUrl(window.location.origin, redirect) },
    })

    if (error) {
      setError(error.message)
    } else {
      captureAnalyticsEvent(POSTHOG_EVENTS.authMagicLinkRequested, {
        email,
      })
      setMagicLinkSent(true)
    }
    setLoading(false)
  }

  if (magicLinkSent) {
    return (
      <div className="text-center">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
        </div>
        <h2 className="text-xl font-semibold">Check your email</h2>
        <p className="mt-2 text-sm text-muted">We sent a magic link to <strong>{email}</strong></p>
      </div>
    )
  }

  return (
    <form onSubmit={handleLogin} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium mb-1.5">Email</label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
          placeholder="you@example.com"
        />
      </div>
      <div>
        <div className="flex justify-between items-center mb-1.5">
          <label htmlFor="password" className="block text-sm font-medium">Password</label>
          <Link href="/auth/reset-password" className="text-xs text-primary hover:underline">Forgot?</Link>
        </div>
        <input
          id="password"
          type="password"
          required
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
          placeholder="Your password"
        />
      </div>

      {error && <p className="text-sm text-primary bg-primary-light rounded-lg px-4 py-2">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 rounded-xl bg-primary text-white font-medium text-sm hover:bg-primary-hover transition-colors disabled:opacity-50"
      >
        {loading ? 'Signing in...' : 'Sign In'}
      </button>

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
        <div className="relative flex justify-center text-xs"><span className="bg-white px-3 text-muted">or</span></div>
      </div>

      <button
        type="button"
        onClick={handleMagicLink}
        disabled={loading}
        className="w-full py-3 rounded-xl border border-border text-sm font-medium hover:bg-muted-light transition-colors disabled:opacity-50"
      >
        Send Magic Link
      </button>
    </form>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted-light px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <BrandLogo href="/" size="lg" priority className="justify-center" imageClassName="max-h-14 w-auto" />
          <h1 className="mt-4 text-2xl font-bold">Welcome back</h1>
          <p className="mt-1 text-sm text-muted">Sign in to your account</p>
        </div>
        <div className="bg-white rounded-2xl border border-border p-8">
          <Suspense fallback={<div className="text-center text-sm text-muted">Loading...</div>}>
            <LoginForm />
          </Suspense>
        </div>
        <p className="mt-6 text-center text-sm text-muted">
          Don&apos;t have an account?{' '}
          <Link href="/auth/signup" className="text-primary font-medium hover:underline">Sign up</Link>
        </p>
      </div>
    </div>
  )
}
