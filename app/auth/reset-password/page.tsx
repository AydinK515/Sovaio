'use client'

import Link from 'next/link'
import { useState } from 'react'
import BrandLogo from '@/components/brand-logo'
import { createClient } from '@/lib/supabase-browser'

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const supabase = createClient()

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback`,
    })

    if (error) {
      setError(error.message)
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted-light px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <BrandLogo href="/" size="lg" priority className="justify-center" imageClassName="max-h-14 w-auto" />
          <h1 className="mt-4 text-2xl font-bold">Reset your password</h1>
          <p className="mt-1 text-sm text-muted">We&apos;ll send you a reset link</p>
        </div>
        <div className="bg-white rounded-2xl border border-border p-8">
          {sent ? (
            <div className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              </div>
              <h2 className="text-xl font-semibold">Check your email</h2>
              <p className="mt-2 text-sm text-muted">We sent a reset link to <strong>{email}</strong></p>
            </div>
          ) : (
            <form onSubmit={handleReset} className="space-y-4">
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
