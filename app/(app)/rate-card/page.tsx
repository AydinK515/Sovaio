import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowRight, Plus, Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase-server'
import type { RateCard } from '@/lib/types'

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

export default async function RateCardsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: rateCards } = await supabase
    .from('rate_cards')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

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

  const latestCard = rateCards[0] as RateCard

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
            <h2 className="text-2xl font-semibold">{latestCard.niche || 'Untitled niche'} rate card</h2>
            <p className="mt-2 text-white/70">
              Generated on {formatDate(latestCard.created_at)} with {latestCard.report_confidence}% confidence.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 min-w-full md:min-w-[520px]">
            <div className="rounded-2xl bg-white/10 px-4 py-4">
              <p className="text-xs text-white/60">Dedicated</p>
              <p className="mt-1 text-lg font-semibold">{formatCurrency(latestCard.dedicated_video_low)} - {formatCurrency(latestCard.dedicated_video_high)}</p>
            </div>
            <div className="rounded-2xl bg-white/10 px-4 py-4">
              <p className="text-xs text-white/60">60s Integration</p>
              <p className="mt-1 text-lg font-semibold">{formatCurrency(latestCard.integration_60s_low)} - {formatCurrency(latestCard.integration_60s_high)}</p>
            </div>
            <div className="rounded-2xl bg-white/10 px-4 py-4">
              <p className="text-xs text-white/60">30s Integration</p>
              <p className="mt-1 text-lg font-semibold">{formatCurrency(latestCard.integration_30s_low)} - {formatCurrency(latestCard.integration_30s_high)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-4">
        {rateCards.map((rateCard) => (
          <div key={rateCard.id} className="bg-white rounded-2xl border border-border p-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold">{rateCard.niche || 'Untitled niche'}</h2>
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${confidenceTone(rateCard.report_confidence)}`}>
                    {rateCard.report_confidence}% confidence
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted">
                  {formatDate(rateCard.created_at)}{rateCard.subscriber_count ? ` - ${rateCard.subscriber_count.toLocaleString()} subscribers` : ''}{rateCard.has_sponsorships ? ' - Has sponsorship history' : ''}
                </p>
                <div className="mt-4 grid sm:grid-cols-3 gap-3 text-sm">
                  <div className="rounded-xl bg-muted-light px-4 py-3">
                    <p className="text-muted">Dedicated Video</p>
                    <p className="mt-1 font-semibold">{formatCurrency(rateCard.dedicated_video_low)} - {formatCurrency(rateCard.dedicated_video_high)}</p>
                  </div>
                  <div className="rounded-xl bg-muted-light px-4 py-3">
                    <p className="text-muted">60-Second Integration</p>
                    <p className="mt-1 font-semibold">{formatCurrency(rateCard.integration_60s_low)} - {formatCurrency(rateCard.integration_60s_high)}</p>
                  </div>
                  <div className="rounded-xl bg-muted-light px-4 py-3">
                    <p className="text-muted">30-Second Integration</p>
                    <p className="mt-1 font-semibold">{formatCurrency(rateCard.integration_30s_low)} - {formatCurrency(rateCard.integration_30s_high)}</p>
                  </div>
                </div>
              </div>

              <div className="flex lg:shrink-0">
                <Link
                  href={`/rate-card/${rateCard.id}`}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-white px-5 py-3 text-sm font-medium hover:bg-primary-hover transition-colors"
                >
                  Open Rate Card
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
