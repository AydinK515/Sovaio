'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import BrandLogo from '@/components/brand-logo'
import { createClient } from '@/lib/supabase-browser'

type ResetMode = 'request' | 'update'

export default function ResetPasswordPage() {
  const supabase = useMemo(() => createClient(), [])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [sent, setSent] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<ResetMode>('request')

  useEffect(() => {
    const detectRecoveryFlow = () => {
      const hash = window.location.hash
      const searchParams = new URLSearchParams(window.location.search)
      const hashParams = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash)

      if (
        searchParams.get('type') === 'recovery' ||
        hashParams.get('type') === 'recovery' ||
        hashParams.has('access_token')
      ) {
        setMode('update')
      }
    }

    detectRecoveryFlow()

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setMode('update')
        setSent(false)
        setCompleted(false)
        setError('')
      }
    })

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [supabase])

  async function handleResetRequest(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })

    if (error) {
      setError(error.message)
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  async function handlePasswordUpdate(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setError(error.message)
    } else {
      setCompleted(true)
      setPassword('')
      setConfirmPassword('')
      window.history.replaceState({}, document.title, '/auth/reset-password')
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted-light px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <BrandLogo href="/" size="lg" priority className="justify-center" imageClassName="max-h-14 w-auto" />
          <h1 className="mt-4 text-2xl font-bold">
            {mode === 'update' ? 'Choose a new password' : 'Reset your password'}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {mode === 'update'
              ? 'Enter your new password below'
              : "We'll send you a reset link"}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-border p-8">
          {mode === 'update' ? (
            completed ? (
              <div className="text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                </div>
                <h2 className="text-xl font-semibold">Password updated</h2>
                <p className="mt-2 text-sm text-muted">Your password has been changed successfully.</p>
                <Link href="/auth/login" className="mt-6 inline-block text-primary font-medium hover:underline">
                  Back to sign in
                </Link>
              </div>
            ) : (
              <form onSubmit={handlePasswordUpdate} className="space-y-4">
                <div>
                  <label htmlFor="password" className="block text-sm font-medium mb-1.5">New password</label>
                  <input
                    id="password"
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                    placeholder="Enter a new password"
                  />
                </div>
                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium mb-1.5">Confirm password</label>
                  <input
                    id="confirmPassword"
                    type="password"
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                    placeholder="Re-enter your new password"
                  />
                </div>
                {error && <p className="text-sm text-primary bg-primary-light rounded-lg px-4 py-2">{error}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-primary text-white font-medium text-sm hover:bg-primary-hover transition-colors disabled:opacity-50"
                >
                  {loading ? 'Updating...' : 'Update Password'}
                </button>
              </form>
            )
          ) : sent ? (
            <div className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              </div>
              <h2 className="text-xl font-semibold">Check your email</h2>
              <p className="mt-2 text-sm text-muted">We sent a reset link to <strong>{email}</strong></p>
            </div>
          ) : (
            <form onSubmit={handleResetRequest} className="space-y-4">
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
              {error && <p className="text-sm text-primary bg-primary-light rounded-lg px-4 py-2">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-primary text-white font-medium text-sm hover:bg-primary-hover transition-colors disabled:opacity-50"
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>
          )}
        </div>
        <p className="mt-6 text-center text-sm text-muted">
          <Link href="/auth/login" className="text-primary font-medium hover:underline">Back to sign in</Link>
        </p>
      </div>
    </div>
  )
}
