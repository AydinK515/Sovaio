'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight, BarChart3, BriefcaseBusiness, Compass, Sparkles } from 'lucide-react'
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
    description: 'I want to upload my analytics, understand my value, and generate a first rate card.',
    icon: BarChart3,
  },
  {
    value: 'negotiate_a_brand_deal',
    title: 'Negotiate a brand deal',
    description: 'I want to get into a live deal workflow fast and let RateProof help me respond confidently.',
    icon: BriefcaseBusiness,
  },
  {
    value: 'just_exploring',
    title: 'Just exploring',
    description: 'Show me the fastest path to understand how the product works before I go deeper.',
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
  const [selectedPath, setSelectedPath] = useState<OnboardingPath>(initialState.welcome_path ?? 'price_my_channel')
  const [hasExportReady, setHasExportReady] = useState(initialState.has_export_ready ?? true)
  const [submitting, setSubmitting] = useState(false)

  async function finishWelcome() {
    setSubmitting(true)

    const payload = await updateOnboardingState({
      action: 'complete_welcome',
      welcomePath: selectedPath,
      hasExportReady,
    })

    captureAnalyticsEvent(POSTHOG_EVENTS.onboardingStarted, {
      onboarding_path: selectedPath,
      has_export_ready: hasExportReady,
      source: isReplay ? 'replay' : 'first_run',
    })

    const destination = hasExportReady
      ? '/analytics/new'
      : selectedPath === 'negotiate_a_brand_deal'
        ? '/dashboard?focus=deal'
        : '/dashboard'

    router.push(destination)
    router.refresh()
    return payload
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
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(254,242,242,0.95),rgba(255,255,255,1)_55%)] px-4 py-10">
      <div className="mx-auto max-w-5xl">
        <div className="rounded-[36px] border border-border bg-white/95 p-6 shadow-[0_30px_90px_-54px_rgba(15,23,42,0.38)] backdrop-blur md:p-10">
          <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
            <section>
              <div className="inline-flex items-center gap-2 rounded-full bg-primary-light px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                {isReplay ? 'Replay onboarding' : 'Welcome to RateProof'}
              </div>
              <h1 className="mt-4 text-4xl font-bold tracking-tight text-foreground md:text-5xl">
                Learn the product while you use it.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">
                RateProof helps YouTube creators turn real analytics into sponsor-ready pricing, better negotiation decisions, and clearer channel strategy. Everything starts with one saved analytics snapshot.
              </p>

              <div className="mt-8 grid gap-4 md:grid-cols-3">
                {[
                  ['1', 'Upload analytics', 'Bring in YouTube Studio reports and save your first snapshot.'],
                  ['2', 'Generate your rate card', 'Turn that snapshot into sponsor-ready ranges and pitch copy.'],
                  ['3', 'Use the AI with context', 'Start a deal or ask Channel Advisor when you are ready.'],
                ].map(([step, title, description]) => (
                  <div key={step} className="rounded-3xl border border-border bg-muted-light p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Step {step}</p>
                    <p className="mt-2 text-sm font-semibold text-foreground">{title}</p>
                    <p className="mt-2 text-sm leading-relaxed text-muted">{description}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[32px] border border-border bg-slate-50 p-5 md:p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Tailor the path</p>
              <h2 className="mt-3 text-2xl font-semibold text-foreground">What do you want to do first?</h2>
              <div className="mt-5 space-y-3">
                {OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setSelectedPath(option.value)}
                    className={`w-full rounded-3xl border p-4 text-left transition-all ${
                      selectedPath === option.value
                        ? 'border-primary bg-primary-light shadow-[0_16px_42px_-34px_rgba(220,38,38,0.85)]'
                        : 'border-border bg-white hover:border-primary/25'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl ${selectedPath === option.value ? 'bg-primary text-white' : 'bg-muted-light text-muted'}`}>
                        <option.icon className="h-4.5 w-4.5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{option.title}</p>
                        <p className="mt-1 text-sm leading-relaxed text-muted">{option.description}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <div className="mt-6 rounded-3xl border border-border bg-white p-4">
                <p className="text-sm font-semibold text-foreground">Do you already have a YouTube Studio export ready?</p>
                <p className="mt-1 text-sm leading-relaxed text-muted">
                  If you do, we&apos;ll send you straight into the upload flow. If not, we&apos;ll guide you from the dashboard first.
                </p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setHasExportReady(true)}
                    className={`rounded-2xl border px-4 py-3 text-sm font-medium transition-colors ${hasExportReady ? 'border-primary bg-primary-light text-primary' : 'border-border hover:bg-muted-light'}`}
                  >
                    Yes, ready to upload
                  </button>
                  <button
                    type="button"
                    onClick={() => setHasExportReady(false)}
                    className={`rounded-2xl border px-4 py-3 text-sm font-medium transition-colors ${!hasExportReady ? 'border-primary bg-primary-light text-primary' : 'border-border hover:bg-muted-light'}`}
                  >
                    Not yet
                  </button>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => void finishWelcome()}
                  disabled={submitting}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-60"
                >
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </button>
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
