'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { buildRateCardName } from '@/lib/analytics-context'
import type { AnalyticsSnapshot } from '@/lib/types'

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
            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted">Snapshot</label>
              <select
                value={snapshotId}
                onChange={(event) => setSnapshotId(event.target.value)}
                className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                {snapshots.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </div>
            {snapshot && (
              <div className="rounded-xl border border-border bg-muted-light px-4 py-3 text-sm text-muted">
                <p>{snapshot.report_confidence}% confidence</p>
                <p className="mt-1">{snapshot.subscriber_count ? `${snapshot.subscriber_count.toLocaleString()} subscribers` : 'Subscriber count not available'}</p>
                {snapshot.report_types.length > 0 && <p className="mt-1">Reports: {snapshot.report_types.join(', ')}</p>}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-white p-6">
          <h2 className="text-lg font-semibold">Pricing Inputs</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted">Niche</label>
              <input
                value={niche}
                onChange={(event) => setNiche(event.target.value)}
                placeholder="e.g. Tech & Software"
                className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted">Sponsorship History</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setHasSponsorships(true)} className={`flex-1 rounded-xl border py-3 text-sm font-medium ${hasSponsorships === true ? 'border-primary bg-primary-light text-primary' : 'border-border hover:bg-muted-light'}`}>Yes</button>
                <button type="button" onClick={() => setHasSponsorships(false)} className={`flex-1 rounded-xl border py-3 text-sm font-medium ${hasSponsorships === false ? 'border-primary bg-primary-light text-primary' : 'border-border hover:bg-muted-light'}`}>No</button>
              </div>
            </div>
            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted">Dedicated Videos?</label>
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
