import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowRight, BarChart3, DollarSign, FileStack, MessageSquare, Upload } from 'lucide-react'
import { createClient } from '@/lib/supabase-server'
import { formatDealTarget } from '@/lib/deal-chat'
import type { AnalyticsSnapshot, Deal, RateCard } from '@/lib/types'

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatCurrency(value: number | null) {
  if (value == null) return '-'
  return `$${value.toLocaleString()}`
}

function StatusBadge({ status, finalPrice }: { status: Deal['status']; finalPrice?: number | null }) {
  const styles = {
    negotiating: 'bg-blue-50 text-blue-700 border-blue-200',
    closed_won: 'bg-green-50 text-green-700 border-green-200',
    closed_lost: 'bg-red-50 text-red-700 border-red-200',
    stalled: 'bg-amber-50 text-amber-700 border-amber-200',
  }

  let label = 'Negotiating'
  if (status === 'closed_won') label = finalPrice ? `Closed for ${formatCurrency(finalPrice)}` : 'Closed Won'
  if (status === 'closed_lost') label = 'Closed Lost'
  if (status === 'stalled') label = 'Stalled'

  return <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}>{label}</span>
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const [{ data: profile }, { data: snapshots }, { data: rateCards }, { data: deals }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('analytics_snapshots').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    supabase.from('rate_cards').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    supabase.from('deals').select('*').eq('user_id', user.id).order('updated_at', { ascending: false }),
  ])

  const snapshotItems = (snapshots || []) as AnalyticsSnapshot[]
  const rateCardItems = (rateCards || []) as RateCard[]
  const dealItems = (deals || []) as Deal[]
  const snapshotById = new Map(snapshotItems.map(snapshot => [snapshot.id, snapshot]))
  const rateCardById = new Map(rateCardItems.map(rateCard => [rateCard.id, rateCard]))
  const firstName = profile?.full_name?.split(' ')[0] || 'there'
  const activeDeals = dealItems.filter(deal => deal.status === 'negotiating')
  const totalPipeline = activeDeals.reduce((sum, deal) => sum + (deal.creator_ask || 0), 0)

  if (snapshotItems.length === 0) {
    return (
      <div className="py-12">
        <h1 className="text-3xl md:text-4xl font-bold">Welcome, {firstName}</h1>
        <p className="mt-2 text-lg text-muted">Everything starts with your analytics snapshot. Upload your YouTube Studio exports first, and then we can power the rest of the app from that real channel context.</p>

        <div className="mt-12 grid gap-8 md:grid-cols-2">
          <div className="rounded-2xl border border-border bg-white p-8">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <BarChart3 className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-lg font-semibold">What is an analytics snapshot?</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              It&apos;s a reusable channel context built from your exported YouTube Studio reports. We use it to generate rate cards, guide live negotiations, and answer channel questions without relying on guesswork.
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-white p-8">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Upload className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-lg font-semibold">Upload analytics first</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Upload the required Content and Geography reports, save a snapshot, and then you&apos;ll be able to generate rate cards or start deals with AI that actually knows your channel.
            </p>
            <Link
              href="/analytics/new"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
            >
              <Upload className="h-4 w-4" />
              Upload Analytics
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="py-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold">Hi, {firstName}</h1>
          <p className="mt-1 text-sm text-muted">Your snapshots power everything here: rate cards, deals, and both AI assistants.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/analytics/new" className="inline-flex items-center justify-center rounded-xl border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted-light">Upload Analytics</Link>
          <Link href="/generate" className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover">Generate Rate Card</Link>
          <Link href={`/deal/new?snapshot=${snapshotItems[0].id}`} className="inline-flex items-center justify-center rounded-xl bg-secondary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-secondary-hover">Create Deal</Link>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-border bg-white p-6">
          <p className="text-xs font-medium uppercase tracking-wider text-muted">Snapshots</p>
          <p className="mt-2 text-3xl font-bold">{snapshotItems.length}</p>
        </div>
        <div className="rounded-2xl border border-border bg-white p-6">
          <p className="text-xs font-medium uppercase tracking-wider text-muted">Rate Cards</p>
          <p className="mt-2 text-3xl font-bold">{rateCardItems.length}</p>
        </div>
        <div className="rounded-2xl border border-border bg-white p-6">
          <p className="text-xs font-medium uppercase tracking-wider text-muted">Active Deals</p>
          <p className="mt-2 text-3xl font-bold">{activeDeals.length}</p>
        </div>
        <div className="rounded-2xl border border-border bg-white p-6">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-muted" />
            <p className="text-xs font-medium uppercase tracking-wider text-muted">Pipeline</p>
          </div>
          <p className="mt-2 text-3xl font-bold">${totalPipeline.toLocaleString()}</p>
        </div>
      </div>

      <div className="mt-8 space-y-8">
        <section className="overflow-hidden rounded-2xl border border-border bg-white">
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <div className="flex items-center gap-2">
              <Upload className="h-4 w-4 text-muted" />
              <h2 className="font-semibold">Analytics Snapshots</h2>
            </div>
            <Link href="/analytics" className="text-sm font-medium text-primary hover:underline">View All</Link>
          </div>
          <div className="divide-y divide-border">
            {snapshotItems.slice(0, 3).map((snapshot) => (
              <div key={snapshot.id} className="flex flex-col gap-4 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium">{snapshot.name}</h3>
                    <span className="inline-flex rounded-full border border-border bg-muted-light px-2.5 py-1 text-xs text-muted">{snapshot.report_confidence}% confidence</span>
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {formatDate(snapshot.created_at)}
                    {snapshot.subscriber_count ? ` - ${snapshot.subscriber_count.toLocaleString()} subscribers` : ''}
                  </p>
                  {snapshot.report_types.length > 0 && (
                    <p className="mt-2 text-xs text-muted">Reports: {snapshot.report_types.join(', ')}</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link href={`/analytics/${snapshot.id}`} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">View Snapshot <ArrowRight className="h-3.5 w-3.5" /></Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-border bg-white">
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <div className="flex items-center gap-2">
              <FileStack className="h-4 w-4 text-muted" />
              <h2 className="font-semibold">Recent Rate Cards</h2>
            </div>
            <Link href="/rate-card" className="text-sm font-medium text-primary hover:underline">View All</Link>
          </div>
          {rateCardItems.length === 0 ? (
            <div className="p-8 text-sm text-muted">
              No rate cards yet. Pick one of your snapshots and generate your first pricing artifact.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {rateCardItems.slice(0, 3).map((rateCard) => (
                <div key={rateCard.id} className="flex flex-col gap-4 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium">{rateCard.name || 'Untitled rate card'}</h3>
                      <span className="inline-flex rounded-full border border-border bg-muted-light px-2.5 py-1 text-xs text-muted">{rateCard.report_confidence}% confidence</span>
                    </div>
                    <p className="mt-1 text-sm text-muted">
                      {formatDate(rateCard.created_at)}
                      {rateCard.analytics_snapshot_id ? ` - Built from ${snapshotById.get(rateCard.analytics_snapshot_id)?.name || 'snapshot'}` : ''}
                    </p>
                  </div>
                  <Link href={`/rate-card/${rateCard.id}`} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">Open Rate Card <ArrowRight className="h-3.5 w-3.5" /></Link>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-2xl border border-border bg-white">
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted" />
              <h2 className="font-semibold">Deals</h2>
            </div>
          </div>
          {dealItems.length === 0 ? (
            <div className="p-8 text-sm text-muted">
              No deals yet. Create a deal from one of your analytics snapshots so the AI has real context from day one.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted-light">
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">Brand</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">Snapshot</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">Current Ask</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {dealItems.map((deal) => (
                    <tr key={deal.id} className="border-b border-border last:border-0">
                      <td className="px-6 py-4 font-medium">{deal.brand_name}</td>
                      <td className="px-6 py-4 text-muted">{deal.analytics_snapshot_id ? snapshotById.get(deal.analytics_snapshot_id)?.name || 'Snapshot' : 'No snapshot'}</td>
                      <td className="px-6 py-4"><StatusBadge status={deal.status} finalPrice={deal.final_price} /></td>
                      <td className="px-6 py-4 font-medium">{formatDealTarget(deal, deal.rate_card_id ? rateCardById.get(deal.rate_card_id) ?? null : null)}</td>
                      <td className="px-6 py-4">
                        <Link href={`/deal/${deal.id}`} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                          Open Deal
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
