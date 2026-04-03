import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowRight, Plus, Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase-server'
import type { AnalyticsSnapshot, RateCard } from '@/lib/types'

function formatCurrency(n: number) {
  return `$${n.toLocaleString()}`
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function confidenceTone(confidence: number) {
  if (confidence >= 70) return 'text-success bg-green-50 border-green-200'
  if (confidence >= 40) return 'text-warning bg-amber-50 border-amber-200'
  return 'text-primary bg-primary-light border-primary/20'
}

function getVisibleRateSummaries(rateCard: RateCard) {
  return [
    ...(rateCard.offers_dedicated_videos
      ? [{
          label: 'Dedicated Video',
          shortLabel: 'Dedicated',
          range: `${formatCurrency(rateCard.dedicated_video_low)} - ${formatCurrency(rateCard.dedicated_video_high)}`,
        }]
      : []),
    {
      label: '60-Second Integration',
      shortLabel: '60s Integration',
      range: `${formatCurrency(rateCard.integration_60s_low)} - ${formatCurrency(rateCard.integration_60s_high)}`,
    },
    {
      label: '30-Second Integration',
      shortLabel: '30s Integration',
      range: `${formatCurrency(rateCard.integration_30s_low)} - ${formatCurrency(rateCard.integration_30s_high)}`,
    },
  ]
}

export default async function RateCardsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: rateCards } = await supabase
    .from('rate_cards')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
  const { data: snapshots } = await supabase
    .from('analytics_snapshots')
    .select('*')
    .eq('user_id', user.id)

  if (!snapshots?.length) {
    return (
      <div className="py-12">
        <h1 className="text-3xl md:text-4xl font-bold">Your rate cards</h1>
        <p className="mt-2 text-muted text-lg">Upload analytics first so you can generate your first rate card.</p>

        <div className="mt-10 bg-white rounded-3xl border border-border p-8 md:p-10">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-7 h-7 text-primary" />
          </div>
          <h2 className="mt-6 text-xl font-semibold">No analytics snapshots yet</h2>
          <p className="mt-2 text-sm text-muted max-w-xl">
            Snapshots are the source context for every rate card. Upload your YouTube Studio exports first, then come back here to generate pricing artifacts from them.
          </p>
          <Link
            href="/analytics/new"
            className="mt-6 inline-flex items-center gap-2 bg-primary text-white font-medium px-6 py-3 rounded-xl hover:bg-primary-hover transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            Upload Analytics
          </Link>
        </div>
      </div>
    )
  }

  if (!rateCards?.length) {
    return (
      <div className="py-12">
        <h1 className="text-3xl md:text-4xl font-bold">Your rate cards</h1>
        <p className="mt-2 text-muted text-lg">You haven&apos;t saved any rate cards yet.</p>

        <div className="mt-10 bg-white rounded-3xl border border-border p-8 md:p-10">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-7 h-7 text-primary" />
          </div>
          <h2 className="mt-6 text-xl font-semibold">Generate your first card</h2>
          <p className="mt-2 text-sm text-muted max-w-xl">
            Upload your latest YouTube Studio exports and we&apos;ll turn them into a reusable sponsorship rate card you can come back to anytime.
          </p>
          <Link
            href="/generate"
            className="mt-6 inline-flex items-center gap-2 bg-primary text-white font-medium px-6 py-3 rounded-xl hover:bg-primary-hover transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            Create Rate Card
          </Link>
        </div>
      </div>
    )
  }

  const snapshotById = new Map(((snapshots || []) as AnalyticsSnapshot[]).map(snapshot => [snapshot.id, snapshot]))
  const latestCard = rateCards[0] as RateCard
  const latestCardSummaries = getVisibleRateSummaries(latestCard)

  return (
    <div className="py-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold">Your rate cards</h1>
          <p className="mt-2 text-muted">Every card you generate is saved here so you can revisit, compare, and start deals later.</p>
        </div>
        <Link
          href="/generate"
          className="inline-flex items-center gap-2 bg-primary text-white font-medium px-5 py-2.5 rounded-xl hover:bg-primary-hover transition-colors text-sm"
        >
          <Plus className="w-4 h-4" />
          New Rate Card
        </Link>
      </div>

      <div className="mt-8 bg-secondary rounded-3xl p-6 md:p-8 text-white">
        <p className="text-xs uppercase tracking-[0.24em] text-white/60">Latest saved</p>
        <div className="mt-4 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div>
            <h2 className="text-2xl font-semibold">{latestCard.name || latestCard.niche || 'Untitled rate card'}</h2>
            <p className="mt-2 text-white/70">
              Generated on {formatDate(latestCard.created_at)} with {latestCard.report_confidence}% confidence.
              {latestCard.analytics_snapshot_id ? ` Built from ${snapshotById.get(latestCard.analytics_snapshot_id)?.name || 'snapshot'}.` : ''}
            </p>
          </div>
          <div className={`grid grid-cols-1 gap-3 min-w-full ${latestCardSummaries.length === 3 ? 'sm:grid-cols-3 md:min-w-[520px]' : 'sm:grid-cols-2 md:min-w-[360px]'}`}>
            {latestCardSummaries.map((summary) => (
              <div key={summary.label} className="rounded-2xl bg-white/10 px-4 py-4">
                <p className="text-xs text-white/60">{summary.shortLabel}</p>
                <p className="mt-1 text-lg font-semibold">{summary.range}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={`/rate-card/${latestCard.id}`}
            className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-secondary transition-colors hover:bg-white/90"
          >
            View Rate Card
          </Link>
        </div>
      </div>

      <div className="mt-8 grid gap-4">
        {rateCards.map((rateCard) => {
          const summaries = getVisibleRateSummaries(rateCard as RateCard)

          return (
          <div key={rateCard.id} className="bg-white rounded-2xl border border-border p-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold">{rateCard.name || rateCard.niche || 'Untitled rate card'}</h2>
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${confidenceTone(rateCard.report_confidence)}`}>
                    {rateCard.report_confidence}% confidence
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted">
                  {formatDate(rateCard.created_at)}
                  {rateCard.subscriber_count ? ` - ${rateCard.subscriber_count.toLocaleString()} subscribers` : ''}
                  {rateCard.has_sponsorships ? ' - Has sponsorship history' : ''}
                  {rateCard.analytics_snapshot_id ? ` - Built from ${snapshotById.get(rateCard.analytics_snapshot_id)?.name || 'snapshot'}` : ''}
                </p>
                <div className={`mt-4 grid gap-3 text-sm ${summaries.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
                  {summaries.map((summary) => (
                    <div key={summary.label} className="rounded-xl bg-muted-light px-4 py-3">
                      <p className="text-muted">{summary.label}</p>
                      <p className="mt-1 font-semibold">{summary.range}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex lg:shrink-0">
                <Link
                  href={`/rate-card/${rateCard.id}`}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-foreground px-5 py-3 text-sm font-medium text-white transition-colors hover:opacity-90"
                >
                  Open Rate Card
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        )})}
      </div>
    </div>
  )
}
