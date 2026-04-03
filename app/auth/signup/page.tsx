'use client'

import Link from 'next/link'
import { useState } from 'react'
import { captureAnalyticsEvent } from '@/lib/posthog-client'
import { POSTHOG_EVENTS } from '@/lib/posthog-events'
import { createClient } from '@/lib/supabase-browser'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirmSent, setConfirmSent] = useState(false)

  const supabase = createClient()

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    captureAnalyticsEvent(POSTHOG_EVENTS.authSignUpSubmitted, {
      email,
    })

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      if (data.user) {
        captureAnalyticsEvent(POSTHOG_EVENTS.authSignUpCompleted, {
          user_id: data.user.id,
        })
      }
      setConfirmSent(true)
      setLoading(false)
    }
  }

  if (confirmSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted-light px-4">
        <div className="w-full max-w-md text-center">
          <Link href="/" className="font-bold text-2xl text-foreground">
            RateProof <span className="text-primary">AI</span>
          </Link>
          <div className="mt-8 bg-white rounded-2xl border border-border p-8">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            </div>
            <h2 className="text-xl font-semibold">Check your email</h2>
            <p className="mt-2 text-sm text-muted">We sent a confirmation link to <strong>{email}</strong></p>
            <p className="mt-1 text-xs text-muted">Click the link to activate your account and get started.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted-light px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="font-bold text-2xl text-foreground">
            RateProof <span className="text-primary">AI</span>
          </Link>
          <h1 className="mt-4 text-2xl font-bold">Create your account</h1>
          <p className="mt-1 text-sm text-muted">Start getting paid what you&apos;re worth</p>
        </div>
        <div className="bg-white rounded-2xl border border-border p-8">
          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-1.5">Full Name</label>
              <input
                id="name"
                type="text"
                required
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                placeholder="Your name"
              />
            </div>
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
              <label htmlFor="password" className="block text-sm font-medium mb-1.5">Password</label>
              <input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                placeholder="At least 6 characters"
              />
            </div>

            {error && <p className="text-sm text-primary bg-primary-light rounded-lg px-4 py-2">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-primary text-white font-medium text-sm hover:bg-primary-hover transition-colors disabled:opacity-50"
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>
        </div>
        <p className="mt-6 text-center text-sm text-muted">
          Already have an account?{' '}
          <Link href="/auth/login" className="text-primary font-medium hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
