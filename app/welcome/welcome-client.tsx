'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, ArrowRight, BarChart3, BriefcaseBusiness, Compass, Sparkles } from 'lucide-react'
import { updateOnboardingState } from '@/lib/onboarding-client'
import type { OnboardingPath, OnboardingState } from '@/lib/onboarding'
import { captureAnalyticsEvent } from '@/lib/posthog-client'
import { POSTHOG_EVENTS } from '@/lib/posthog-events'

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
}: {
  initialState: OnboardingState
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isReplay = searchParams.get('mode') === 'replay'
  const [step, setStep] = useState(0)
  const [selectedPath, setSelectedPath] = useState<OnboardingPath>(initialState.welcome_path ?? 'price_my_channel')
  const [submitting, setSubmitting] = useState(false)

  async function finishWelcome() {
    setSubmitting(true)

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

  async function skipWelcome() {
    setSubmitting(true)
    await updateOnboardingState({ action: 'skip_welcome' })
    captureAnalyticsEvent(POSTHOG_EVENTS.onboardingSkipped, {
      source: isReplay ? 'replay' : 'first_run',
    })
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(254,242,242,0.95),rgba(255,255,255,1)_52%)] px-4 py-10">
      <div className="mx-auto max-w-5xl">
        <div className="overflow-hidden rounded-[36px] border border-border bg-white/95 shadow-[0_30px_90px_-54px_rgba(15,23,42,0.38)] backdrop-blur">
          <div className="grid min-h-[720px] lg:grid-cols-[1.05fr_0.95fr]">
            <section className="relative overflow-hidden border-b border-border px-6 py-8 md:px-10 md:py-10 lg:border-b-0 lg:border-r">
              <div className="absolute inset-x-10 top-0 h-32 rounded-full bg-[radial-gradient(circle,rgba(220,38,38,0.08),transparent_72%)] blur-3xl" />
              <div className="relative">
                <div className="inline-flex items-center gap-2 rounded-full bg-primary-light px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                  <Sparkles className="h-3.5 w-3.5" />
                  {isReplay ? 'Replay onboarding' : 'Welcome to Sovaio'}
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
                ) : (
                  <>
                    <p className="mt-5 text-sm font-semibold uppercase tracking-[0.18em] text-muted">
                      Step 2 of 2
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

            <section className="flex flex-col justify-between bg-[linear-gradient(180deg,rgba(248,250,252,0.82),#ffffff)] px-6 py-8 md:px-8 md:py-10">
              <div>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                      {step === 0 ? 'Overview' : 'Tailor the path'}
                    </p>
                    <p className="mt-3 text-2xl font-semibold text-foreground">
                      {step === 0 ? 'Start simple' : 'Choose your starting point'}
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-3 py-2 text-xs font-medium text-muted">
                    <span className={`h-2 w-2 rounded-full ${step === 0 ? 'bg-primary' : 'bg-border-dark'}`} />
                    <span className={`h-2 w-2 rounded-full ${step === 1 ? 'bg-primary' : 'bg-border-dark'}`} />
                  </div>
                </div>

                <div className="mt-8 rounded-[32px] border border-border bg-white p-5 shadow-[0_20px_45px_-40px_rgba(15,23,42,0.28)]">
                  {step === 0 ? (
                    <>
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
                  ) : (
                    <>
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
                {step === 1 ? (
                  <button
                    type="button"
                    onClick={() => setStep(0)}
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

                {!isReplay ? (
                  <button
                    type="button"
                    onClick={() => void skipWelcome()}
                    disabled={submitting}
                    className="inline-flex items-center justify-center rounded-2xl border border-border px-5 py-3 text-sm font-medium transition-colors hover:bg-muted-light disabled:opacity-60"
                  >
                    Skip for now
                  </button>
                ) : null}
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  )
}
