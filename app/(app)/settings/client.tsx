'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { User, CreditCard, Trash2, ExternalLink, Shield } from 'lucide-react'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import type { Profile } from '@/lib/types'

export default function SettingsClient({ user, profile }: { user: SupabaseUser; profile: Profile | null }) {
  const router = useRouter()
  const [showDelete, setShowDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  async function handleDelete() {
    setDeleting(true)
    // In production, this would call an edge function to delete all user data
    // For now, just sign out
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <div className="py-8 max-w-2xl">
      <h1 className="text-3xl font-bold">Settings</h1>
      <p className="mt-2 text-muted">Manage your account and subscription.</p>

      {/* Account */}
      <div className="mt-8 bg-white rounded-2xl border border-border p-6">
        <div className="flex items-center gap-3 mb-6">
          <User className="w-5 h-5 text-muted" />
          <h2 className="text-lg font-semibold">Account</h2>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted uppercase tracking-wider mb-1">Email</label>
            <p className="text-sm">{user.email}</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted uppercase tracking-wider mb-1">Name</label>
            <p className="text-sm">{profile?.full_name || 'Not set'}</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted uppercase tracking-wider mb-1">Member Since</label>
            <p className="text-sm">{new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
          </div>
        </div>
      </div>

      {/* Subscription */}
      <div className="mt-6 bg-white rounded-2xl border border-border p-6">
        <div className="flex items-center gap-3 mb-6">
          <CreditCard className="w-5 h-5 text-muted" />
          <h2 className="text-lg font-semibold">Subscription</h2>
        </div>
        <div className="flex items-center justify-between p-4 bg-muted-light rounded-xl">
          <div>
            <p className="font-medium capitalize">{profile?.subscription_tier || 'Free'} Plan</p>
            <p className="text-xs text-muted mt-0.5">
              {profile?.subscription_tier === 'pro'
                ? 'Unlimited rate cards, negotiation AI, deal tracking'
                : `${profile?.generations_used || 0} of 1 free generation${(profile?.generations_used || 0) >= 1 ? ' used' : ''}`
              }
            </p>
          </div>
          {profile?.subscription_tier !== 'pro' && (
            <button className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary-hover transition-colors">
              Upgrade to Pro
            </button>
          )}
        </div>
        {profile?.subscription_tier === 'pro' && (
          <button className="mt-4 flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors">
            <ExternalLink className="w-4 h-4" />
            Manage Billing Portal
          </button>
        )}
      </div>

      {/* Security */}
      <div className="mt-6 bg-white rounded-2xl border border-border p-6">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="w-5 h-5 text-muted" />
          <h2 className="text-lg font-semibold">Security</h2>
        </div>
        <button
          onClick={handleSignOut}
          className="px-4 py-2.5 border border-border rounded-xl text-sm font-medium hover:bg-muted-light transition-colors"
        >
          Sign Out
        </button>
      </div>

      {/* Danger Zone */}
      <div className="mt-6 bg-white rounded-2xl border border-red-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Trash2 className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-primary">Danger Zone</h2>
        </div>
        <p className="text-sm text-muted mb-4">
          Permanently delete your account and all associated data. This action cannot be undone.
        </p>
        {!showDelete ? (
          <button
            onClick={() => setShowDelete(true)}
            className="px-4 py-2.5 border border-red-200 text-primary rounded-xl text-sm font-medium hover:bg-primary-light transition-colors"
          >
            Delete Account
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-50"
            >
              {deleting ? 'Deleting...' : 'Yes, Delete My Account'}
            </button>
            <button onClick={() => setShowDelete(false)} className="text-sm text-muted hover:text-foreground">
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
