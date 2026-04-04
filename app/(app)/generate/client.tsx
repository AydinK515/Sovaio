'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BarChart3, CircleHelp, FileText, Sparkles, Users } from 'lucide-react'
import OnboardingHint from '@/components/onboarding-hint'
import OnboardingRouteBanner from '@/components/onboarding-route-banner'
import { useOnboarding } from '@/components/onboarding-provider'
import { createClient } from '@/lib/supabase-browser'
import { buildRateCardName } from '@/lib/analytics-context'
import { captureAnalyticsEvent } from '@/lib/posthog-client'
import { POSTHOG_EVENTS } from '@/lib/posthog-events'
import { CSV_TYPES, type AnalyticsSnapshot, type CsvUpload, NICHES } from '@/lib/types'
import FancySelect from '@/components/fancy-select'

const REPORT_TYPE_LABELS: Record<CsvUpload['upload_type'], string> = Object.fromEntries(
  CSV_TYPES.map(type => [type.key, type.label])
) as Record<CsvUpload['upload_type'], string>

const GENERATION_PHASES = [
  {
    label: 'Phase 1',
    title: 'Reading your analytics',
    body: 'We pull the strongest signals from your saved YouTube snapshot.',
    icon: BarChart3,
  },
  {
    label: 'Phase 2',
    title: 'Pricing your inventory',
    body: 'We estimate dedicated and integration ranges based on your channel context.',
    icon: Sparkles,
  },
  {
    label: 'Phase 3',
    title: 'Drafting your pitch',
    body: 'We package the numbers into a usable rate card with explanation and email copy.',
    icon: FileText,
  },
] as const

export default function GenerateRateCardClient({
  aiEnabled,
  snapshots,
  initialSnapshotId,
}: {
  aiEnabled: boolean
  snapshots: AnalyticsSnapshot[]
  initialSnapshotId: string | null
}) {
  const router = useRouter()
  const supabase = createClient()
  const defaultRateCardName = buildRateCardName({ niche: '' })
  const { completeStep } = useOnboarding()

  const [snapshotId, setSnapshotId] = useState(initialSnapshotId ?? '')
  const [niche, setNiche] = useState('')
  const [rateCardName, setRateCardName] = useState(defaultRateCardName)
  const [rateCardNameCustomized, setRateCardNameCustomized] = useState(false)
  const [hasSponsorships, setHasSponsorships] = useState<boolean | null>(null)
  const [offersDedicatedVideos, setOffersDedicatedVideos] = useState<boolean | null>(null)
  const [sponsorshipCount, setSponsorshipCount] = useState('')
  const [avgDealAmount, setAvgDealAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [error, setError] = useState('')
  const [submitAttempted, setSubmitAttempted] = useState(false)

  const snapshot = useMemo(
    () => snapshots.find(item => item.id === snapshotId) ?? null,
    [snapshotId, snapshots]
  )
  const missingReports = useMemo(() => {
    if (!snapshot) return []

    const reportSet = new Set(snapshot.report_types)
    return CSV_TYPES.filter(type => !reportSet.has(type.key))
  }, [snapshot])
  const confidenceTone = snapshot
    ? snapshot.report_confidence < 40
      ? {
          badge: 'Needs more data',
          accent: 'bg-primary',
          accentSoft: 'bg-primary/10 text-primary',
        }
      : snapshot.report_confidence < 70
        ? {
            badge: 'Solid baseline',
            accent: 'bg-warning',
            accentSoft: 'bg-warning/15 text-amber-700',
          }
        : {
            badge: 'High confidence',
            accent: 'bg-success',
            accentSoft: 'bg-success/10 text-success',
          }
    : null
  const confidenceMessage = snapshot
    ? snapshot.report_confidence >= 90
      ? {
          title: `Great, this analytics snapshot has ${snapshot.report_confidence}% confidence.`,
          body: 'We have enough channel context to generate your most accurate rate card from this data.',
        }
      : snapshot.report_confidence >= 60
        ? {
            title: `This analytics snapshot has ${snapshot.report_confidence}% confidence.`,
            body: missingReports.length > 0
              ? `Your rate card should be solid, but adding ${missingReports.map(report => report.label).join(' and ')} would tighten the estimate even more.`
              : 'Your rate card should be solid, and there is enough coverage here to price with confidence.',
          }
        : {
            title: `This analytics snapshot has ${snapshot.report_confidence}% confidence, so pricing will be more conservative.`,
            body: missingReports.length > 0
              ? `For a stronger estimate, upload ${missingReports.map(report => report.label).join(' and ')} before generating your rate card.`
              : 'Uploading a fuller analytics mix will help us generate a more reliable rate card.',
          }
    : null
  const snapshotOptions = useMemo(
    () => [
      { value: '', label: 'Select an analytics snapshot' },
      ...snapshots.map((item) => ({ value: item.id, label: item.name })),
    ],
    [snapshots]
  )
  const nicheOptions = useMemo(
    () => NICHES.map((option) => ({ value: option, label: option })),
    []
  )
  const activePhaseIndex = loadingProgress < 33 ? 0 : loadingProgress < 66 ? 1 : 2
  const activePhase = GENERATION_PHASES[activePhaseIndex]
  const needsSponsorshipHistory = hasSponsorships === true
  const generatedRateCardName = useMemo(
    () => buildRateCardName({ niche }),
    [niche]
  )
  const missingRequiredFields = useMemo(() => {
    const missing: string[] = []

    if (!snapshotId) missing.push('Analytics snapshot')
    if (!niche) missing.push('Niche')
    if (!rateCardName.trim()) missing.push('Rate card name')
    if (hasSponsorships === null) missing.push('Sponsorship history')
    if (offersDedicatedVideos === null) missing.push('Dedicated videos')
    if (needsSponsorshipHistory && !sponsorshipCount.trim()) missing.push('Number of past sponsorships')
    return missing
  }, [hasSponsorships, needsSponsorshipHistory, niche, offersDedicatedVideos, rateCardName, snapshotId, sponsorshipCount])
  const canGenerate = aiEnabled && missingRequiredFields.length === 0
  const showFieldErrors = submitAttempted

  function RequiredMark() {
    return (
      <span aria-hidden="true" className="ml-1 text-primary">
        *
      </span>
    )
  }

  useEffect(() => {
    captureAnalyticsEvent(POSTHOG_EVENTS.onboardingStepViewed, {
      step_id: 'generate_rate_card',
      route: '/generate',
    })
  }, [])

  useEffect(() => {
    if (!rateCardNameCustomized) {
      setRateCardName(generatedRateCardName)
    }
  }, [generatedRateCardName, rateCardNameCustomized])

  useEffect(() => {
    if (!loading) {
      setLoadingProgress(0)
      return
    }

    const freezeTarget = 93 + Math.floor(Math.random() * 8)

    const startedAt = Date.now()
    const interval = window.setInterval(() => {
      const elapsed = Date.now() - startedAt
      let nextProgress = 0

      if (elapsed <= 5000) {
        const t = elapsed / 5000
        nextProgress = 40 * (1 - Math.pow(1 - t, 2.5))
      } else {
        const t = Math.min((elapsed - 5000) / 55000, 1)
        nextProgress = 40 + (freezeTarget - 40) * (1 - Math.pow(1 - t, 4.2))
      }

      setLoadingProgress(Math.min(nextProgress, freezeTarget))

      if (elapsed >= 60000) {
        window.clearInterval(interval)
      }
    }, 120)

    return () => window.clearInterval(interval)
  }, [loading])

  async function handleGenerate() {
    setSubmitAttempted(true)

    if (!aiEnabled) {
      setError('AI features are disabled for this account.')
      return
    }

    if (!snapshotId || !niche || !rateCardName.trim() || hasSponsorships === null || offersDedicatedVideos === null) {
      setError('Please choose an analytics snapshot and fill in the required pricing inputs.')
      return
    }

    if (hasSponsorships && !sponsorshipCount) {
      setError('Please fill in your sponsorship history details.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      captureAnalyticsEvent(POSTHOG_EVENTS.rateCardGenerationStarted, {
        user_id: user.id,
        analytics_snapshot_id: snapshotId,
        report_confidence: snapshot?.report_confidence ?? null,
        niche,
        has_sponsorships: hasSponsorships,
        subscriber_count: snapshot?.subscriber_count ?? null,
      })

      const response = await fetch('/api/generate-rate-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analyticsSnapshotId: snapshotId,
          niche,
          hasSponsorships,
          offersDedicatedVideos,
          sponsorshipCount: sponsorshipCount ? parseInt(sponsorshipCount.replace(/,/g, '')) : null,
          avgDealAmount: avgDealAmount ? parseInt(avgDealAmount.replace(/[$,]/g, '')) : null,
        }),
      })

      if (!response.ok) {
        throw new Error(await response.text())
      }

      const aiRates = await response.json()
      const nextRateCardName = rateCardName.trim()

      const { data: rateCard, error: saveError } = await supabase
        .from('rate_cards')
        .insert({
          user_id: user.id,
          name: nextRateCardName,
          analytics_snapshot_id: snapshotId,
          niche,
          subscriber_count: snapshot?.subscriber_count ?? null,
          has_sponsorships: hasSponsorships,
          offers_dedicated_videos: offersDedicatedVideos,
          sponsorship_count: hasSponsorships && sponsorshipCount ? parseInt(sponsorshipCount.replace(/,/g, '')) : null,
          avg_deal_amount: hasSponsorships && avgDealAmount ? parseInt(avgDealAmount.replace(/[$,]/g, '')) : null,
          dedicated_video_low: aiRates.dedicated_video_low,
          dedicated_video_high: aiRates.dedicated_video_high,
          integration_60s_low: aiRates.integration_60s_low,
          integration_60s_high: aiRates.integration_60s_high,
          integration_30s_low: aiRates.integration_30s_low,
          integration_30s_high: aiRates.integration_30s_high,
          explanation: aiRates.explanation,
          improvement_tips: aiRates.improvement_tips,
          pitch_email: aiRates.pitch_email,
          report_confidence: snapshot?.report_confidence ?? 0,
          csv_upload_ids: snapshot?.csv_upload_ids ?? [],
        })
        .select('id')
        .single()

      if (saveError) throw saveError

      await supabase.from('profiles').update({
        niche,
        has_sponsorships: hasSponsorships,
        subscriber_count: snapshot?.subscriber_count ?? null,
      }).eq('id', user.id)

      captureAnalyticsEvent(POSTHOG_EVENTS.rateCardGenerationSucceeded, {
        user_id: user.id,
        analytics_snapshot_id: snapshotId,
        rate_card_id: rateCard.id,
        report_confidence: snapshot?.report_confidence ?? null,
        niche,
        has_sponsorships: hasSponsorships,
        subscriber_count: snapshot?.subscriber_count ?? null,
      })
      await completeStep('generate_rate_card', {
        rate_card_id: rateCard.id,
        snapshot_id: snapshotId,
        niche,
      })

      router.push(`/rate-card/${rateCard.id}`)
      router.refresh()
      return
    } catch (err: unknown) {
      captureAnalyticsEvent(POSTHOG_EVENTS.rateCardGenerationFailed, {
        analytics_snapshot_id: snapshotId,
        report_confidence: snapshot?.report_confidence ?? null,
        niche: niche || null,
        error: err instanceof Error ? err.message : 'unknown_error',
      })
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
      return
    }
  }

  if (snapshots.length === 0) {
    return (
      <div className="py-8">
        <h1 className="text-3xl md:text-4xl font-bold">Generate a Rate Card</h1>
        <div className="mt-8 rounded-3xl border border-border bg-white p-8">
          <h2 className="text-xl font-semibold">Upload analytics first</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted">Rate cards are generated from analytics snapshots. Upload a snapshot first so we have the real context needed to price your channel properly.</p>
          <button
            type="button"
            onClick={() => router.push('/analytics/new')}
            className="mt-6 inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
          >
            Upload Analytics
          </button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-[calc(100dvh-16rem)] items-center justify-center py-8">
        <div className="mx-auto w-full max-w-3xl rounded-[2rem] border border-border bg-white p-8 shadow-sm md:p-12">
          <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
            <div className="relative h-28 w-36">
              <div className="absolute inset-x-3 bottom-0 top-3 rounded-[1.6rem] border border-slate-200 bg-linear-to-b from-white via-white to-slate-50 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.45)]" />
              <div className="absolute left-9 right-9 top-10 h-1.5 rounded-full bg-slate-200" />
              <div className="absolute left-9 right-11 top-15 h-1.5 rounded-full bg-slate-200" />
              <div className="absolute left-9 right-14 top-20 h-1.5 rounded-full bg-slate-200" />
              <div
                className="absolute left-10 top-7 h-14 w-4 rounded-full bg-primary shadow-[0_10px_20px_-12px_rgba(239,68,68,0.9)] transition-transform duration-150"
                style={{
                  transform: `translateX(${loadingProgress * 0.72}px) translateY(${Math.sin(loadingProgress / 8) * 3}px) rotate(32deg)`,
                }}
              >
                <div className="absolute left-1/2 top-[-6px] h-3 w-3 -translate-x-1/2 rounded-t-full bg-amber-200" />
                <div className="absolute bottom-[-8px] left-1/2 h-0 w-0 -translate-x-1/2 border-x-[6px] border-t-[10px] border-x-transparent border-t-slate-700" />
              </div>
              <div
                className="absolute left-11 top-22 h-0.5 rounded-full bg-primary/35 transition-all duration-150"
                style={{ width: `${18 + loadingProgress * 0.7}px` }}
              />
              <div
                className="absolute left-11 top-17 h-0.5 rounded-full bg-primary/20 transition-all duration-150"
                style={{ width: `${10 + loadingProgress * 0.45}px` }}
              />
            </div>

            <h1 className="mt-7 text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              Generating your rate card
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted md:text-base">
              {activePhase.title}. We&apos;re turning your analytics and sponsorship inputs into a tailored creator rate card.
            </p>

            <div className="mt-8 grid w-full gap-3 text-left md:grid-cols-3">
              {GENERATION_PHASES.map((item, index) => (
                <div
                  key={item.title}
                  className={`rounded-2xl border p-4 transition-all duration-300 ${
                    index === activePhaseIndex
                      ? 'border-primary/30 bg-primary-light/60 shadow-[0_18px_38px_-30px_rgba(239,68,68,0.9)]'
                      : index < activePhaseIndex
                        ? 'border-emerald-200 bg-emerald-50/70'
                        : 'border-border bg-linear-to-br from-white to-slate-50'
                  }`}
                >
                  <item.icon className="h-5 w-5 text-primary" />
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <h2 className="text-sm font-semibold text-foreground">{item.title}</h2>
                    <span className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-white text-xs font-semibold text-muted">
                      {index + 1}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{item.body}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 w-full">
              <div className="mb-2 flex items-center justify-between gap-4 text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                <span>{activePhase.title}</span>
                <span>{Math.floor(loadingProgress)}%</span>
              </div>
              <div className="relative h-3 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-linear-to-r from-primary via-rose-400 to-orange-300 transition-[width] duration-150"
                  style={{ width: `${loadingProgress}%` }}
                />
                <div
                  className="absolute top-1/2 h-6 w-6 -translate-y-1/2 rounded-full border border-white/80 bg-white/70 shadow-[0_10px_24px_-16px_rgba(239,68,68,0.95)] backdrop-blur-sm transition-[left] duration-150"
                  style={{ left: `calc(${loadingProgress}% - 12px)` }}
                >
                  <div className="absolute inset-1 rounded-full bg-primary/75" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="py-8">
      <h1 className="text-3xl md:text-4xl font-bold">Generate a Rate Card</h1>
      <p className="mt-2 text-muted">Choose the analytics snapshot you want to price from, then fill in the sponsorship-specific details.</p>

      <div className="mt-8">
        <OnboardingRouteBanner
          bannerKey="generate-rate-card-guide"
          eyebrow="What this page does"
          title="Turn saved analytics into sponsor-ready pricing"
          description="You are not filling out a generic calculator. This page combines your saved analytics snapshot with a small amount of business context so RateProof can produce realistic starting ranges and a pitch email."
        />
      </div>

      <div className="mt-8 space-y-8">
        <div className="rounded-2xl border border-border bg-white p-6">
          <h2 className="text-lg font-semibold">Analytics Snapshot</h2>
          <p className="mt-1 text-sm text-muted">This snapshot powers the channel context. We only send derived metrics and summaries to the model, never giant raw CSV blobs.</p>
          <p className="mt-3 text-xs text-muted">
            <span className="font-semibold text-primary">*</span> Required before you can generate a rate card
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="flex h-full flex-col">
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted">
                  Snapshot
                  <RequiredMark />
                </label>
                <FancySelect
                  value={snapshotId}
                  onChange={setSnapshotId}
                  options={snapshotOptions}
                  placeholder="Select an analytics snapshot"
                  triggerClassName={showFieldErrors && !snapshotId ? 'border-primary shadow-[0_0_0_3px_rgba(220,38,38,0.08)]' : undefined}
                />
                {showFieldErrors && !snapshotId && (
                  <p className="mt-2 text-sm text-primary">Choose the analytics snapshot you want to price from.</p>
                )}
              </div>

              {snapshot && confidenceTone && confidenceMessage && (
                <div className="mt-4 flex-1 rounded-2xl border border-border bg-linear-to-br from-white via-slate-50 to-emerald-50/35 p-5">
                  <h3 className="text-lg font-semibold text-foreground">{confidenceMessage.title}</h3>
                  <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">{confidenceMessage.body}</p>

                  {missingReports.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {missingReports.map((report) => (
                        <span
                          key={report.key}
                          className="rounded-full border border-border bg-white px-3 py-1 text-xs font-medium text-muted"
                        >
                          Add {report.label}
                        </span>
                      ))}
                    </div>
                  )}

                  {missingReports.length > 0 && (
                    <button
                      type="button"
                      onClick={() => router.push('/analytics/new')}
                      className="mt-5 inline-flex rounded-xl bg-secondary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-secondary-hover"
                    >
                      Upload Missing Reports
                    </button>
                  )}
                </div>
              )}
            </div>
            {snapshot && confidenceTone && (
              <div className="rounded-2xl border border-border bg-linear-to-br from-slate-50 to-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">Snapshot Health</p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">{snapshot.report_confidence}% confidence</span>
                    </div>
                  </div>
                  <BarChart3 className="h-5 w-5 text-muted" />
                </div>

                <div className="mt-4 h-2 overflow-hidden rounded-full bg-border">
                  <div
                    className={`${confidenceTone.accent} h-full rounded-full transition-all duration-500`}
                    style={{ width: `${snapshot.report_confidence}%` }}
                  />
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-border/80 bg-white px-3 py-3">
                    <div className="flex items-center gap-2 text-muted">
                      <Users className="h-4 w-4" />
                      <span className="text-[11px] font-medium uppercase tracking-[0.16em]">Subscribers</span>
                    </div>
                    <p className="mt-2 text-lg font-semibold text-foreground">
                      {snapshot.subscriber_count ? snapshot.subscriber_count.toLocaleString() : 'Unavailable'}
                    </p>
                  </div>

                  <div className="rounded-xl border border-border/80 bg-white px-3 py-3">
                    <div className="flex items-center gap-2 text-muted">
                      <FileText className="h-4 w-4" />
                      <span className="text-[11px] font-medium uppercase tracking-[0.16em]">Reports Included</span>
                    </div>
                    <p className="mt-2 text-lg font-semibold text-foreground">{snapshot.report_types.length}</p>
                  </div>
                </div>

                {snapshot.report_types.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {snapshot.report_types.map((reportType) => (
                      <span
                        key={reportType}
                        className="rounded-full border border-border bg-white px-3 py-1 text-xs font-medium text-muted"
                      >
                        {REPORT_TYPE_LABELS[reportType as CsvUpload['upload_type']] ?? reportType.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-white p-6">
          <h2 className="text-lg font-semibold">Pricing Inputs</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted">
                Rate Card Name
                <RequiredMark />
              </label>
              <input
                value={rateCardName}
                onChange={(event) => {
                  setRateCardNameCustomized(true)
                  setRateCardName(event.target.value)
                }}
                className={`w-full rounded-xl border bg-white px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 ${showFieldErrors && !rateCardName.trim() ? 'border-primary' : 'border-border'}`}
              />
              {showFieldErrors && !rateCardName.trim() && (
                <p className="mt-2 text-sm text-primary">Give this rate card a name before generating it.</p>
              )}
            </div>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted">
                Niche
                <RequiredMark />
              </label>
              <FancySelect
                value={niche}
                onChange={setNiche}
                options={nicheOptions}
                placeholder="Select your primary niche"
                triggerClassName={showFieldErrors && !niche ? 'border-primary shadow-[0_0_0_3px_rgba(220,38,38,0.08)]' : undefined}
              />
              {showFieldErrors && !niche && (
                <p className="mt-2 text-sm text-primary">Select the niche that best matches your channel.</p>
              )}
            </div>
            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted">
                Sponsorship History
                <RequiredMark />
              </label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setHasSponsorships(true)} className={`flex-1 rounded-xl border py-3 text-sm font-medium ${hasSponsorships === true ? 'border-primary bg-primary-light text-primary' : showFieldErrors && hasSponsorships === null ? 'border-primary text-primary' : 'border-border hover:bg-muted-light'}`}>Yes</button>
                <button type="button" onClick={() => setHasSponsorships(false)} className={`flex-1 rounded-xl border py-3 text-sm font-medium ${hasSponsorships === false ? 'border-primary bg-primary-light text-primary' : showFieldErrors && hasSponsorships === null ? 'border-primary text-primary' : 'border-border hover:bg-muted-light'}`}>No</button>
              </div>
              {showFieldErrors && hasSponsorships === null && (
                <p className="mt-2 text-sm text-primary">Tell us whether you have past sponsorship experience.</p>
              )}
            </div>
            <div>
              <div className="mb-2 flex items-center gap-2">
                <label className="block text-xs font-medium uppercase tracking-wider text-muted">
                  Dedicated Videos
                  <RequiredMark />
                </label>
                <div className="group relative">
                  <button
                    type="button"
                    aria-label="What are dedicated videos?"
                    onClick={() => captureAnalyticsEvent(POSTHOG_EVENTS.tooltipOpened, {
                      tooltip_key: 'dedicated_videos',
                      route: '/generate',
                    })}
                    className="flex h-4 w-4 items-center justify-center rounded-full text-muted transition-colors hover:text-foreground"
                  >
                    <CircleHelp className="h-4 w-4" />
                  </button>
                  <div className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 w-64 -translate-x-1/2 rounded-xl border border-border bg-white p-3 text-left text-xs leading-relaxed text-muted opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
                    A dedicated video is a full upload centered on one sponsor, instead of a shorter in-video integration.
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setOffersDedicatedVideos(true)} className={`flex-1 rounded-xl border py-3 text-sm font-medium ${offersDedicatedVideos === true ? 'border-primary bg-primary-light text-primary' : showFieldErrors && offersDedicatedVideos === null ? 'border-primary text-primary' : 'border-border hover:bg-muted-light'}`}>Yes</button>
                <button type="button" onClick={() => setOffersDedicatedVideos(false)} className={`flex-1 rounded-xl border py-3 text-sm font-medium ${offersDedicatedVideos === false ? 'border-primary bg-primary-light text-primary' : showFieldErrors && offersDedicatedVideos === null ? 'border-primary text-primary' : 'border-border hover:bg-muted-light'}`}>No</button>
              </div>
              {showFieldErrors && offersDedicatedVideos === null && (
                <p className="mt-2 text-sm text-primary">Choose whether you offer dedicated sponsor videos.</p>
              )}
            </div>
          </div>

          {needsSponsorshipHistory && (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted">
                  Number of Past Sponsorships
                  <RequiredMark />
                </label>
                <input
                  value={sponsorshipCount}
                  onChange={(event) => setSponsorshipCount(event.target.value)}
                  placeholder="e.g. 10"
                  className={`w-full rounded-xl border bg-white px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 ${showFieldErrors && !sponsorshipCount.trim() ? 'border-primary' : 'border-border'}`}
                />
                {showFieldErrors && !sponsorshipCount.trim() && (
                  <p className="mt-2 text-sm text-primary">Enter roughly how many sponsorships you have done.</p>
                )}
              </div>
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <label className="block text-xs font-medium uppercase tracking-wider text-muted">
                    Average Deal Amount
                  </label>
                  <div className="group relative">
                    <button
                      type="button"
                      aria-label="Why we ask for average deal amount"
                      onClick={() => captureAnalyticsEvent(POSTHOG_EVENTS.tooltipOpened, {
                        tooltip_key: 'average_deal_amount',
                        route: '/generate',
                      })}
                      className="flex h-4 w-4 items-center justify-center rounded-full text-muted transition-colors hover:text-foreground"
                    >
                      <CircleHelp className="h-4 w-4" />
                    </button>
                    <div className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 w-72 -translate-x-1/2 rounded-xl border border-border bg-white p-3 text-left text-xs leading-relaxed text-muted opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
                      This does not need to be exact. We know sponsorship pricing changes a lot based on scope, brand fit, usage rights, turnaround time, and plenty of other details. We just want a rough estimate so the model has a realistic anchor point for your past deals.
                    </div>
                  </div>
                </div>
                <input
                  value={avgDealAmount}
                  onChange={(event) => setAvgDealAmount(event.target.value)}
                  placeholder="e.g. $2,000"
                  className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <p className="mt-2 text-xs text-muted">Optional, but helpful if you want the model to anchor to your typical deal size.</p>
              </div>
            </div>
          )}
        </div>

        {error && <p className="rounded-lg bg-primary-light px-4 py-2 text-sm text-primary">{error}</p>}
        {!aiEnabled && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Rate card generation is disabled for this account because AI features are turned off.
          </p>
        )}
        {aiEnabled && !canGenerate && (
          <div className="rounded-xl border border-border bg-white px-4 py-3 text-sm text-muted">
            Fill the required fields to continue: {missingRequiredFields.join(', ')}.
          </div>
        )}

        <OnboardingHint
          hintKey="generate-terms-explainer"
          title="Simple meaning of the pricing terms"
          description="Dedicated video means a full sponsor-focused upload. A 60-second integration is roughly a one-minute in-video sponsor segment. A 30-second integration is a shorter sponsor mention. These are starting ranges, not locked quotes."
        />

        <button
          type="button"
          onClick={() => void handleGenerate()}
          disabled={!canGenerate || loading}
          className="flex w-full items-center justify-center rounded-xl bg-primary py-4 text-lg font-semibold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Generating Rate Card...' : !aiEnabled ? 'AI Disabled' : 'Generate My Rate Card'}
        </button>
      </div>
    </div>
  )
}
