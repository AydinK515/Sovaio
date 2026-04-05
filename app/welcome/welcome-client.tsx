'use client'

import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, ArrowRight, BarChart3, BriefcaseBusiness, Camera, Compass, Loader2, Sparkles, Upload } from 'lucide-react'
import { updateOnboardingState } from '@/lib/onboarding-client'
import type { OnboardingPath, OnboardingState } from '@/lib/onboarding'
import type { Profile } from '@/lib/types'
import { captureAnalyticsEvent } from '@/lib/posthog-client'
import { POSTHOG_EVENTS } from '@/lib/posthog-events'
import { createClient } from '@/lib/supabase-browser'

const OPTIONS: Array<{
  value: OnboardingPath
  title: string
  description: string
  icon: typeof BarChart3
}> = [
  {
    value: 'price_my_channel',
    title: 'Price my channel',
    description: 'I want to understand my value, upload analytics, and generate a strong first rate card.',
    icon: BarChart3,
  },
  {
    value: 'negotiate_a_brand_deal',
    title: 'Negotiate a brand deal',
    description: 'I want to get into a real deal workflow quickly and use Sovaio to respond with confidence.',
    icon: BriefcaseBusiness,
  },
  {
    value: 'just_exploring',
    title: 'Just exploring',
    description: 'I want a guided tour of how snapshots, rate cards, deals, and AI fit together.',
    icon: Compass,
  },
]

export default function WelcomeClient({
  initialState,
  initialProfile,
}: {
  initialState: OnboardingState
  initialProfile: Profile | null
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isReplay = searchParams.get('mode') === 'replay'
  const supabase = useMemo(() => createClient(), [])
  const [step, setStep] = useState(0)
  const [selectedPath, setSelectedPath] = useState<OnboardingPath>(initialState.welcome_path ?? 'price_my_channel')
  const [channelName, setChannelName] = useState(initialProfile?.channel_name ?? '')
  const [avatarPath, setAvatarPath] = useState(initialProfile?.avatar_path ?? null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const profileStepIndex = 1

  useEffect(() => {
    let cancelled = false

    async function loadAvatar() {
      if (!avatarPath) {
        setAvatarUrl(null)
        return
      }

      const { data, error } = await supabase.storage.from('avatars').createSignedUrl(avatarPath, 60 * 60)

      if (cancelled) return

      if (error || !data?.signedUrl) {
        setAvatarUrl(null)
        return
      }

      setAvatarUrl(data.signedUrl)
    }

    void loadAvatar()

    return () => {
      cancelled = true
    }
  }, [avatarPath, supabase])

  async function saveProfileDetails() {
    const trimmedChannelName = channelName.trim()

    const { error } = await supabase
      .from('profiles')
      .update({
        channel_name: trimmedChannelName || null,
        avatar_path: avatarPath,
      })
      .eq('id', initialState.user_id)

    if (error) {
      setProfileError(error.message)
      return false
    }

    setProfileError('')
    return true
  }

  async function handleAvatarUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) return

    setProfileError('')

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      setProfileError('Please upload a JPG, PNG, or WebP image.')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setProfileError('Profile photo must be 5MB or smaller.')
      return
    }

    setUploadingAvatar(true)

    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const nextPath = `${initialState.user_id}/avatar-${Date.now()}.${extension}`

    const { error: uploadError } = await supabase.storage.from('avatars').upload(nextPath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type,
    })

    if (uploadError) {
      setUploadingAvatar(false)
      setProfileError(uploadError.message)
      return
    }

    if (avatarPath) {
      await supabase.storage.from('avatars').remove([avatarPath])
    }

    setAvatarPath(nextPath)
    setUploadingAvatar(false)
  }

  async function finishWelcome() {
    setProfileError('')
    setSubmitting(true)

    const profileSaved = await saveProfileDetails()

    if (!profileSaved) {
      setSubmitting(false)
      setStep(1)
      return
    }

    await updateOnboardingState({
      action: 'complete_welcome',
      welcomePath: selectedPath,
      hasExportReady: false,
    })

    captureAnalyticsEvent(POSTHOG_EVENTS.onboardingStarted, {
      onboarding_path: selectedPath,
      has_export_ready: false,
      source: isReplay ? 'replay' : 'first_run',
    })

    const destination = selectedPath === 'price_my_channel'
      ? '/analytics/new'
      : selectedPath === 'negotiate_a_brand_deal'
        ? '/dashboard?focus=deal'
        : '/dashboard'

    router.push(destination)
    router.refresh()
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(254,242,242,0.95),rgba(255,255,255,1)_52%)] px-4 py-10">
      <div className={`mx-auto ${step === 1 ? 'max-w-3xl' : 'max-w-5xl'}`}>
        <div className="overflow-hidden rounded-[36px] border border-border bg-white/95 shadow-[0_30px_90px_-54px_rgba(15,23,42,0.38)] backdrop-blur">
          <div className={`grid min-h-[720px] ${step === 1 ? 'lg:grid-cols-1' : 'lg:grid-cols-[1.05fr_0.95fr]'}`}>
            <section className={`relative overflow-hidden border-b border-border px-6 py-8 md:px-10 md:py-10 ${step === 1 ? '' : 'lg:border-b-0 lg:border-r'}`}>
              <div className="absolute inset-x-10 top-0 h-32 rounded-full bg-[radial-gradient(circle,rgba(220,38,38,0.08),transparent_72%)] blur-3xl" />
              <div className={`relative ${step === 1 ? 'mx-auto w-full max-w-3xl' : ''}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="inline-flex items-center gap-2 rounded-full bg-primary-light px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                    <Sparkles className="h-3.5 w-3.5" />
                    {isReplay ? 'Replay onboarding' : 'Welcome to Sovaio'}
                  </div>
                  {step === 1 ? (
                    <div className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-3 py-2 text-xs font-medium text-muted">
                      <span className={`h-2 w-2 rounded-full ${profileStepIndex === 0 ? 'bg-primary' : 'bg-border-dark'}`} />
                      <span className={`h-2 w-2 rounded-full ${profileStepIndex === 1 ? 'bg-primary' : 'bg-border-dark'}`} />
                      <span className={`h-2 w-2 rounded-full ${profileStepIndex === 2 ? 'bg-primary' : 'bg-border-dark'}`} />
                    </div>
                  ) : null}
                </div>

                {step === 0 ? (
                  <>
                    <h1 className="mt-5 max-w-3xl text-4xl font-bold tracking-tight text-foreground md:text-5xl">
                      Let&apos;s get started.
                    </h1>
                    <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted md:text-lg">
                      Sovaio helps YouTube creators turn channel analytics into clear sponsor pricing, stronger negotiation decisions, and better positioning. The product teaches itself once you have one saved snapshot.
                    </p>
                  </>
                ) : step === 1 ? (
                  <>
                    <p className="mt-5 text-sm font-semibold uppercase tracking-[0.18em] text-muted">
                      Step 2 of 3
                    </p>
                    <h1 className="mt-3 max-w-3xl text-4xl font-bold tracking-tight text-foreground md:text-5xl">
                      Set up your channel profile
                    </h1>
                    <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted md:text-lg">
                      Add the channel name and profile image you want Sovaio to use across your workspace, rate cards, and sponsor-facing assets.
                    </p>

                    <div className="mt-8 rounded-[28px] border border-border bg-white p-5 shadow-[0_20px_45px_-36px_rgba(15,23,42,0.18)]">
                      <div className="flex flex-col gap-6 md:flex-row">
                        <div className="shrink-0">
                          <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-[28px] border border-border bg-muted-light">
                            {avatarUrl ? (
                              <Image
                                src={avatarUrl}
                                alt={channelName ? `${channelName} avatar` : 'Channel avatar'}
                                width={112}
                                height={112}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="px-3 text-center">
                                <Camera className="mx-auto h-7 w-7 text-muted" />
                                <p className="mt-2 text-[11px] uppercase tracking-wider text-muted">No photo</p>
                              </div>
                            )}
                          </div>

                          <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted-light">
                            {uploadingAvatar ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                            {uploadingAvatar ? 'Uploading...' : 'Upload photo'}
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/webp"
                              onChange={handleAvatarUpload}
                              disabled={uploadingAvatar || submitting}
                              className="hidden"
                            />
                          </label>
                          <p className="mt-2 text-xs text-muted">JPG, PNG, or WebP up to 5MB.</p>
                        </div>

                        <div className="flex-1">
                          <label className="block text-xs font-medium uppercase tracking-[0.18em] text-muted">
                            Channel name
                          </label>
                          <input
                            value={channelName}
                            onChange={(event) => {
                              setChannelName(event.target.value)
                              if (profileError) {
                                setProfileError('')
                              }
                            }}
                            placeholder="Enter your YouTube channel name"
                            className="mt-2 w-full rounded-2xl border border-border px-4 py-3 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                          />
                          <p className="mt-2 text-sm leading-relaxed text-muted">
                            This shows up in your workspace and helps make exports and sponsor-facing assets feel like they belong to your brand.
                          </p>
                          {profileError ? (
                            <p className="mt-3 rounded-2xl border border-red-200 bg-primary-light px-4 py-3 text-sm text-primary">
                              {profileError}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                      <button
                        type="button"
                        onClick={() => setStep(0)}
                        disabled={submitting}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border px-5 py-3 text-sm font-medium transition-colors hover:bg-muted-light disabled:opacity-60"
                      >
                        <ArrowLeft className="h-4 w-4" />
                        Back
                      </button>
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      disabled={submitting || uploadingAvatar}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-60"
                      >
                      Continue
                      <ArrowRight className="h-4 w-4" />
                    </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="mt-5 text-sm font-semibold uppercase tracking-[0.18em] text-muted">
                      Step 3 of 3
                    </p>
                    <h1 className="mt-3 max-w-3xl text-4xl font-bold tracking-tight text-foreground md:text-5xl">
                      What brought you to Sovaio?
                    </h1>
                    <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted md:text-lg">
                      Pick the reason that feels closest. We&apos;ll shape the next step around it and keep the onboarding focused.
                    </p>

                    <div className="mt-8 space-y-4">
                      {OPTIONS.map((option) => {
                        const active = selectedPath === option.value
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setSelectedPath(option.value)}
                            className={`w-full rounded-[28px] border px-5 py-5 text-left transition-all ${
                              active
                                ? 'border-primary bg-primary-light shadow-[0_20px_45px_-36px_rgba(220,38,38,0.45)]'
                                : 'border-border bg-white hover:border-primary/30 hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-stretch gap-4">
                              <div className={`flex w-16 shrink-0 items-center justify-center self-stretch rounded-2xl border ${
                                active
                                  ? 'border-primary bg-primary text-white'
                                  : 'border-border bg-white text-muted'
                              }`}>
                                <option.icon className="h-6 w-6" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-base font-semibold text-foreground">{option.title}</p>
                                <p className="mt-1.5 text-sm leading-relaxed text-muted">{option.description}</p>
                              </div>
                            </div>
                          </button>
                        )
                      })}
                    </div>

                  </>
                )}
              </div>
            </section>

            {step !== 1 ? (
            <section className="flex flex-col justify-between bg-[linear-gradient(180deg,rgba(248,250,252,0.82),#ffffff)] px-6 py-8 md:px-8 md:py-10">
              <div>
                <div className="flex items-center justify-end gap-4">
                  <div className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-3 py-2 text-xs font-medium text-muted">
                    <span className={`h-2 w-2 rounded-full ${step === 0 ? 'bg-primary' : 'bg-border-dark'}`} />
                    <span className={`h-2 w-2 rounded-full ${step === 1 ? 'bg-primary' : 'bg-border-dark'}`} />
                    <span className={`h-2 w-2 rounded-full ${step === 2 ? 'bg-primary' : 'bg-border-dark'}`} />
                  </div>
                </div>

                <div className={`mt-8 ${step === 1 ? 'min-h-[420px]' : 'rounded-[32px] border border-border bg-white p-5 shadow-[0_20px_45px_-40px_rgba(15,23,42,0.28)]'}`}>
                  {step === 0 ? (
                    <>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                        Overview
                      </p>
                      <p className="mt-3 text-2xl font-semibold text-foreground">
                        Start simple
                      </p>
                      <p className="text-sm font-semibold text-foreground">What Sovaio actually does</p>
                      <div className="mt-4 space-y-4">
                        <div className="rounded-2xl border border-border bg-muted-light px-4 py-4">
                          <p className="text-sm font-semibold text-foreground">Snapshots turn exports into reusable context</p>
                          <p className="mt-1.5 text-sm leading-relaxed text-muted">
                            Instead of re-explaining your channel every time, you save one analytics snapshot and reuse it across pricing, deals, and AI.
                          </p>
                        </div>
                        <div className="rounded-2xl border border-border bg-muted-light px-4 py-4">
                          <p className="text-sm font-semibold text-foreground">Rate cards give you a confident starting point</p>
                          <p className="mt-1.5 text-sm leading-relaxed text-muted">
                            Your first rate card is usually the moment the product clicks, because it turns raw channel data into something useful immediately.
                          </p>
                        </div>
                        <div className="rounded-2xl border border-border bg-muted-light px-4 py-4">
                          <p className="text-sm font-semibold text-foreground">The AI works best after the snapshot exists</p>
                          <p className="mt-1.5 text-sm leading-relaxed text-muted">
                            Channel Advisor helps with strategy and pricing context. Deal Assistant helps once you are in a live negotiation.
                          </p>
                        </div>
                      </div>
                    </>
                  ) : step === 1 ? (
                    <div className="min-h-[420px]" />
                  ) : (
                    <>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                        Tailor the path
                      </p>
                      <p className="mt-3 text-2xl font-semibold text-foreground">
                        Choose your starting point
                      </p>
                      <p className="text-sm font-semibold text-foreground">Recommended next move</p>
                      <div className="mt-4 rounded-[28px] border border-primary/20 bg-primary-light px-4 py-5">
                        <p className="text-lg font-semibold text-foreground">
                          {selectedPath === 'price_my_channel'
                            ? 'Go save your first analytics snapshot'
                            : selectedPath === 'negotiate_a_brand_deal'
                              ? 'Get your deal workflow set up with real context'
                              : 'Explore the dashboard with guidance turned on'}
                        </p>
                        <p className="mt-2 text-sm leading-relaxed text-muted">
                          {selectedPath === 'price_my_channel'
                            ? 'That gives Sovaio what it needs to generate accurate pricing instead of generic guesses.'
                            : selectedPath === 'negotiate_a_brand_deal'
                              ? 'We\'ll keep nudging you toward the snapshot first, because that is what makes negotiation advice actually useful.'
                              : 'You can move through the product naturally and let the onboarding surface the next action at the right moment.'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void finishWelcome()}
                        disabled={submitting}
                        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-60"
                      >
                        Start with this path
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                {step > 0 ? (
                  <button
                    type="button"
                    onClick={() => setStep((current) => Math.max(current - 1, 0))}
                    disabled={submitting}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border px-5 py-3 text-sm font-medium transition-colors hover:bg-muted-light disabled:opacity-60"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </button>
                ) : null}

                {step === 0 ? (
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    disabled={submitting}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-60"
                  >
                    Continue
                    <ArrowRight className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            </section>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  )
}
