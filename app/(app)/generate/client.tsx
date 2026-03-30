'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BarChart3, ChevronDown, CircleHelp, FileText, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'
import { buildRateCardName } from '@/lib/analytics-context'
import { CSV_TYPES, type AnalyticsSnapshot, type CsvUpload, NICHES } from '@/lib/types'

const REPORT_TYPE_LABELS: Record<CsvUpload['upload_type'], string> = Object.fromEntries(
  CSV_TYPES.map(type => [type.key, type.label])
) as Record<CsvUpload['upload_type'], string>

export default function GenerateRateCardClient({
  snapshots,
  initialSnapshotId,
}: {
  snapshots: AnalyticsSnapshot[]
  initialSnapshotId: string | null
}) {
  const router = useRouter()
  const supabase = createClient()

  const [snapshotId, setSnapshotId] = useState(initialSnapshotId ?? snapshots[0]?.id ?? '')
  const [niche, setNiche] = useState('')
  const [hasSponsorships, setHasSponsorships] = useState<boolean | null>(null)
  const [offersDedicatedVideos, setOffersDedicatedVideos] = useState<boolean | null>(null)
  const [sponsorshipCount, setSponsorshipCount] = useState('')
  const [avgDealAmount, setAvgDealAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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

  async function handleGenerate() {
    if (!snapshotId || !niche || hasSponsorships === null || offersDedicatedVideos === null) {
      setError('Please choose an analytics snapshot and fill in the required pricing inputs.')
      return
    }

    if (hasSponsorships && (!sponsorshipCount || !avgDealAmount)) {
      setError('Please fill in your sponsorship history details.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

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
      const rateCardName = buildRateCardName({ niche })

      const { data: rateCard, error: saveError } = await supabase
        .from('rate_cards')
        .insert({
          user_id: user.id,
          name: rateCardName,
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

      router.push(`/rate-card/${rateCard.id}`)
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
      return
    }

    setLoading(false)
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

  return (
    <div className="py-8">
      <h1 className="text-3xl md:text-4xl font-bold">Generate a Rate Card</h1>
      <p className="mt-2 text-muted">Choose the analytics snapshot you want to price from, then fill in the sponsorship-specific details.</p>

      <div className="mt-8 space-y-8">
        <div className="rounded-2xl border border-border bg-white p-6">
          <h2 className="text-lg font-semibold">Analytics Snapshot</h2>
          <p className="mt-1 text-sm text-muted">This snapshot powers the channel context. We only send derived metrics and summaries to the model, never giant raw CSV blobs.</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="flex h-full flex-col">
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted">Snapshot</label>
                <div className="relative">
                  <select
                    value={snapshotId}
                    onChange={(event) => setSnapshotId(event.target.value)}
                    className="w-full appearance-none rounded-xl border border-border bg-white px-4 py-3 pr-11 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    {snapshots.map((item) => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                </div>
              </div>

              {snapshot && confidenceTone && confidenceMessage && (
                <div className="mt-4 flex-1 rounded-2xl border border-border bg-linear-to-br from-white via-slate-50 to-emerald-50/35 p-5">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${confidenceTone.accentSoft}`}>
                    {confidenceTone.badge}
                  </span>
                  <h3 className="mt-3 text-lg font-semibold text-foreground">{confidenceMessage.title}</h3>
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
                      className="mt-5 inline-flex rounded-xl border border-border bg-white px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted-light"
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
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${confidenceTone.accentSoft}`}>
                        {confidenceTone.badge}
                      </span>
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
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted">Niche</label>
              <div className="relative">
                <select
                  value={niche}
                  onChange={(event) => setNiche(event.target.value)}
                  className="w-full appearance-none rounded-xl border border-border bg-white px-4 py-3 pr-11 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="" disabled>Select your primary niche</option>
                  {NICHES.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              </div>
            </div>
            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted">Sponsorship History</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setHasSponsorships(true)} className={`flex-1 rounded-xl border py-3 text-sm font-medium ${hasSponsorships === true ? 'border-primary bg-primary-light text-primary' : 'border-border hover:bg-muted-light'}`}>Yes</button>
                <button type="button" onClick={() => setHasSponsorships(false)} className={`flex-1 rounded-xl border py-3 text-sm font-medium ${hasSponsorships === false ? 'border-primary bg-primary-light text-primary' : 'border-border hover:bg-muted-light'}`}>No</button>
              </div>
            </div>
            <div>
              <div className="mb-2 flex items-center gap-2">
                <label className="block text-xs font-medium uppercase tracking-wider text-muted">Dedicated Videos</label>
                <div className="group relative">
                  <button
                    type="button"
                    aria-label="What are dedicated videos?"
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
                <button type="button" onClick={() => setOffersDedicatedVideos(true)} className={`flex-1 rounded-xl border py-3 text-sm font-medium ${offersDedicatedVideos === true ? 'border-primary bg-primary-light text-primary' : 'border-border hover:bg-muted-light'}`}>Yes</button>
                <button type="button" onClick={() => setOffersDedicatedVideos(false)} className={`flex-1 rounded-xl border py-3 text-sm font-medium ${offersDedicatedVideos === false ? 'border-primary bg-primary-light text-primary' : 'border-border hover:bg-muted-light'}`}>No</button>
              </div>
            </div>
          </div>

          {hasSponsorships === true && (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted">Past Sponsorships</label>
                <input
                  value={sponsorshipCount}
                  onChange={(event) => setSponsorshipCount(event.target.value)}
                  placeholder="e.g. 10"
                  className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted">Average Deal Amount</label>
                <input
                  value={avgDealAmount}
                  onChange={(event) => setAvgDealAmount(event.target.value)}
                  placeholder="e.g. $2,000"
                  className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
          )}
        </div>

        {error && <p className="rounded-lg bg-primary-light px-4 py-2 text-sm text-primary">{error}</p>}

        <button
          type="button"
          onClick={() => void handleGenerate()}
          disabled={loading}
          className="flex w-full items-center justify-center rounded-xl bg-primary py-4 text-lg font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
        >
          {loading ? 'Generating Rate Card...' : 'Generate My Rate Card'}
        </button>
      </div>
    </div>
  )
}
