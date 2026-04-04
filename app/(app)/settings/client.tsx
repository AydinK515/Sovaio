'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { captureAnalyticsEvent, resetAnalytics } from '@/lib/posthog-client'
import { POSTHOG_EVENTS } from '@/lib/posthog-events'
import { createClient } from '@/lib/supabase-browser'
import { User, CreditCard, Trash2, ExternalLink, Shield, Upload, Camera, Loader2 } from 'lucide-react'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import type { Profile } from '@/lib/types'
import ConfirmationModal from '@/components/confirmation-modal'

export default function SettingsClient({ user, profile }: { user: SupabaseUser; profile: Profile | null }) {
  const router = useRouter()
  const [supabase] = useState(() => createClient())
  const [channelName, setChannelName] = useState(profile?.channel_name || '')
  const [avatarPath, setAvatarPath] = useState(profile?.avatar_path || null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [savingProfile, setSavingProfile] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showSignOutModal, setShowSignOutModal] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadAvatar() {
      if (!avatarPath) {
        setAvatarUrl(null)
        return
      }

      const { data, error: signedUrlError } = await supabase
        .storage
        .from('avatars')
        .createSignedUrl(avatarPath, 60 * 60)

      if (cancelled) return

      if (signedUrlError || !data?.signedUrl) {
        setAvatarUrl(null)
        return
      }

      setAvatarUrl(data.signedUrl)
    }

    loadAvatar()

    return () => {
      cancelled = true
    }
  }, [avatarPath, supabase])

  function resetStatus() {
    setMessage('')
    setError('')
  }

  async function handleSaveProfile() {
    resetStatus()
    setSavingProfile(true)

    const trimmedChannelName = channelName.trim()

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        channel_name: trimmedChannelName || null,
      })
      .eq('id', user.id)

    setSavingProfile(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setMessage('Profile saved.')
    router.refresh()
  }

  async function handleAvatarUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) return

    resetStatus()

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      setError('Please upload a JPG, PNG, or WebP image.')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Avatar must be 5MB or smaller.')
      return
    }

    setUploadingAvatar(true)

    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const nextPath = `${user.id}/avatar-${Date.now()}.${extension}`

    const { error: uploadError } = await supabase
      .storage
      .from('avatars')
      .upload(nextPath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type,
      })

    if (uploadError) {
      setUploadingAvatar(false)
      setError(uploadError.message)
      return
    }

    const previousAvatarPath = avatarPath

    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        avatar_path: nextPath,
      })
      .eq('id', user.id)

    if (profileError) {
      await supabase.storage.from('avatars').remove([nextPath])
      setUploadingAvatar(false)
      setError(profileError.message)
      return
    }

    if (previousAvatarPath) {
      await supabase.storage.from('avatars').remove([previousAvatarPath])
    }

    setAvatarPath(nextPath)
    setUploadingAvatar(false)
    setMessage('Profile photo updated.')
    router.refresh()
  }

  async function handleSignOut() {
    setShowSignOutModal(false)
    setSigningOut(true)
    captureAnalyticsEvent(POSTHOG_EVENTS.authSignOut, {
      user_id: user.id,
    })
    resetAnalytics()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  async function handleDelete() {
    setShowDeleteModal(false)
    setDeleting(true)
    // In production, this would call an edge function to delete all user data
    // For now, just sign out
    captureAnalyticsEvent(POSTHOG_EVENTS.authSignOut, {
      user_id: user.id,
    })
    resetAnalytics()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <div className="py-8 max-w-2xl">
      <ConfirmationModal
        open={showSignOutModal}
        title="Sign out?"
        message="Are you sure you want to sign out of your account?"
        confirmLabel="Sign Out"
        pending={signingOut}
        onClose={() => setShowSignOutModal(false)}
        onConfirm={() => {
          void handleSignOut()
        }}
      />
      <ConfirmationModal
        open={showDeleteModal}
        title="Delete account?"
        message="Permanently delete your account and all associated data? This action cannot be undone."
        confirmLabel="Delete Account"
        tone="danger"
        pending={deleting}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={() => {
          void handleDelete()
        }}
      />
      <h1 className="text-3xl font-bold">Settings</h1>
      <p className="mt-2 text-muted">Manage your account and subscription.</p>

      {(message || error) && (
        <div className={`mt-6 rounded-2xl border px-4 py-3 text-sm ${error ? 'border-red-200 bg-primary-light text-primary' : 'border-green-200 bg-green-50 text-green-700'}`}>
          {error || message}
        </div>
      )}

      {/* Channel Profile */}
      <div className="mt-8 bg-white rounded-2xl border border-border p-6">
        <div className="flex items-center gap-3 mb-6">
          <Camera className="w-5 h-5 text-muted" />
          <h2 className="text-lg font-semibold">Channel Profile</h2>
        </div>

        <div className="flex flex-col sm:flex-row gap-6">
          <div className="shrink-0">
            <div className="w-28 h-28 rounded-3xl border border-border bg-muted-light overflow-hidden flex items-center justify-center">
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt={channelName ? `${channelName} avatar` : 'Channel avatar'}
                  width={112}
                  height={112}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-center px-3">
                  <Camera className="w-7 h-7 text-muted mx-auto" />
                  <p className="mt-2 text-[11px] uppercase tracking-wider text-muted">No photo</p>
                </div>
              )}
            </div>

            <label className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 border border-border rounded-xl text-sm font-medium hover:bg-muted-light transition-colors cursor-pointer">
              {uploadingAvatar ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploadingAvatar ? 'Uploading...' : 'Upload Photo'}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleAvatarUpload}
                disabled={uploadingAvatar}
                className="hidden"
              />
            </label>
            <p className="mt-2 text-xs text-muted">JPG, PNG, or WebP up to 5MB.</p>
          </div>

          <div className="flex-1 space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted uppercase tracking-wider mb-1.5">Channel Name</label>
              <input
                value={channelName}
                onChange={(event) => setChannelName(event.target.value)}
                placeholder="Enter your YouTube channel name"
                className="w-full px-4 py-3 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>

            <div className="rounded-xl bg-muted-light px-4 py-3 text-sm text-muted">
              This channel name and profile photo are used for your creator profile inside the app and future sponsor-facing materials.
            </div>

            <button
              onClick={handleSaveProfile}
              disabled={savingProfile}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary-hover transition-colors disabled:opacity-60"
            >
              {savingProfile && <Loader2 className="w-4 h-4 animate-spin" />}
              {savingProfile ? 'Saving...' : 'Save Channel Profile'}
            </button>
          </div>
        </div>
      </div>

      {/* Account */}
      <div className="mt-6 bg-white rounded-2xl border border-border p-6">
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
            <label className="block text-xs font-medium text-muted uppercase tracking-wider mb-1">Channel Name</label>
            <p className="text-sm">{channelName.trim() || 'Not set'}</p>
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
          onClick={() => setShowSignOutModal(true)}
          disabled={signingOut}
          className="px-4 py-2.5 border border-border rounded-xl text-sm font-medium hover:bg-muted-light transition-colors"
        >
          {signingOut ? 'Signing Out...' : 'Sign Out'}
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
        <button
          onClick={() => setShowDeleteModal(true)}
          disabled={deleting}
          className="px-4 py-2.5 border border-red-200 text-primary rounded-xl text-sm font-medium hover:bg-primary-light transition-colors disabled:opacity-50"
        >
          {deleting ? 'Deleting...' : 'Delete Account'}
        </button>
      </div>
    </div>
  )
}
