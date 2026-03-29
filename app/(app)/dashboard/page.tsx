import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, Upload, DollarSign, BarChart3, FileStack } from 'lucide-react'
import type { RateCard, Deal } from '@/lib/types'
import { formatDealTarget } from '@/lib/deal-chat'

function StatusBadge({ status, finalPrice }: { status: Deal['status'], finalPrice?: number | null }) {
  const styles = {
    negotiating: 'bg-blue-50 text-blue-700 border-blue-200',
    closed_won: 'bg-green-50 text-green-700 border-green-200',
    closed_lost: 'bg-red-50 text-red-700 border-red-200',
    stalled: 'bg-amber-50 text-amber-700 border-amber-200',
  }

  let label: string
  if (status === 'closed_won') {
    label = finalPrice ? `Closed for ${formatCurrency(finalPrice)}` : 'Closed Won'
  } else if (status === 'closed_lost') {
    label = 'Closed Lost'
  } else if (status === 'negotiating') {
    label = 'Negotiating'
  } else {
    label = 'Stalled'
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[status]}`}>
      {label}
    </span>
  )
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatCurrency(n: number | null) {
  if (n == null) return '-'
  return `$${n.toLocaleString()}`
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const { data: rateCards } = await supabase.from('rate_cards').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
  const { data: deals } = await supabase.from('deals').select('*').eq('user_id', user.id).order('updated_at', { ascending: false })

  const hasRateCards = rateCards && rateCards.length > 0
  const hasDeals = deals && deals.length > 0
  const activeDeals = deals?.filter(d => d.status === 'negotiating') || []
  const activeDealCount = activeDeals.length
  const totalPipeline = deals?.filter(d => d.status === 'negotiating').reduce((sum, d) => sum + (d.creator_ask || 0), 0) || 0
  const rateCardById = new Map((rateCards || []).map(rateCard => [rateCard.id, rateCard]))
  const sortedDeals = [...(deals || [])].sort((a, b) => {
    const aIsArchived = a.status !== 'negotiating'
    const bIsArchived = b.status !== 'negotiating'

    if (aIsArchived !== bIsArchived) {
      return aIsArchived ? 1 : -1
    }

    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  })

  const firstName = profile?.full_name?.split(' ')[0] || 'there'

  // Empty state - new user
  if (!hasRateCards && !hasDeals) {
    return (
      <div className="py-12">
        <h1 className="text-3xl md:text-4xl font-bold">
          Welcome, {firstName}
        </h1>
        <p className="mt-2 text-muted text-lg">Let&apos;s get your first rate card generated.</p>

        <div className="mt-12 grid md:grid-cols-2 gap-8">
          <div className="bg-white rounded-2xl border border-border p-8">
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
              <BarChart3 className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold">What is a rate card?</h3>
            <p className="mt-2 text-sm text-muted leading-relaxed">
              A rate card gives brands a clear price range for working with you, so you can stop guessing what to charge and start negotiating from a real position of confidence.
            </p>
            <div className="mt-4 space-y-2 text-sm text-muted leading-relaxed">
              <p>
                Instead of relying on a generic calculator, your card is built from your actual channel data, audience quality, niche, and sponsorship context.
              </p>
              <p>
                That gives you pricing you can actually use in outreach, inbound conversations, and negotiations with brands.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-border p-8">
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
              <Upload className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold">Let&apos;s get started</h3>
            <p className="mt-2 text-sm text-muted leading-relaxed">
              Upload your YouTube Studio reports, answer a few quick questions, and we&apos;ll turn that data into a personalized sponsorship rate card with confidence scoring and outreach-ready pricing.
            </p>
            <p className="mt-3 text-sm text-muted leading-relaxed">
              The more complete your reports are, the stronger the analysis becomes, which helps you walk into deals with better numbers and a better story.
            </p>
            <Link
              href="/generate"
              className="mt-6 inline-flex items-center gap-2 bg-primary text-white font-medium px-6 py-3 rounded-xl hover:bg-primary-hover transition-colors text-sm"
            >
              <Upload className="w-4 h-4" />
              Create My Rate Card
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="py-8">
      <div className="mb-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold">Hi, {firstName}</h1>
          {activeDeals.length > 0 && (
            <p className="mt-1 text-sm text-muted">
              You have {activeDeals.length} active negotiation{activeDeals.length !== 1 ? 's' : ''}.
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-2xl border border-border p-6">
          <p className="text-xs text-muted uppercase tracking-wider font-medium">Total Deals</p>
          <p className="mt-2 text-3xl font-bold">{deals?.length || 0}</p>
        </div>
        <div className="bg-white rounded-2xl border border-border p-6">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-muted" />
            <p className="text-xs text-muted uppercase tracking-wider font-medium">Revenue Pipeline</p>
          </div>
          <p className="mt-2 text-3xl font-bold">${totalPipeline.toLocaleString()}</p>
          {totalPipeline > 0 && <p className="mt-1 text-xs text-success font-medium">In active negotiations</p>}
        </div>
        <div className="bg-white rounded-2xl border border-border p-6">
          <p className="text-xs text-muted uppercase tracking-wider font-medium">Active Deals</p>
          <p className="mt-2 text-3xl font-bold">{activeDealCount}</p>
          {activeDealCount > 0 && <p className="mt-1 text-xs text-success font-medium">Live conversations in progress</p>}
        </div>
      </div>

      {hasRateCards && (
        <div className="bg-white rounded-2xl border border-border overflow-hidden mb-8">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              <FileStack className="w-4 h-4 text-muted" />
              <h2 className="font-semibold">Recent Rate Cards</h2>
            </div>
            <Link href="/rate-card" className="text-sm font-medium text-primary hover:underline">
              View All
            </Link>
          </div>

          <div className="divide-y divide-border">
            {rateCards!.slice(0, 3).map((rateCard: RateCard) => (
              <div key={rateCard.id} className="px-6 py-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium">{rateCard.niche || 'Untitled niche'}</h3>
                    <span className="inline-flex items-center rounded-full border border-border bg-muted-light px-2.5 py-1 text-xs text-muted">
                      {rateCard.report_confidence}% confidence
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {formatDate(rateCard.created_at)}
                    {rateCard.subscriber_count ? ` - ${rateCard.subscriber_count.toLocaleString()} subscribers` : ''}
                    {rateCard.has_sponsorships ? ' - Has sponsorship history' : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-3 lg:shrink-0">
                  <Link
                    href={`/rate-card/${rateCard.id}`}
                    className="inline-flex items-center gap-1 text-primary text-sm font-medium hover:underline"
                  >
                    Open Rate Card
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-border overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold">Deal Matrix</h2>
        </div>

        {hasDeals ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted-light">
                  <th className="text-left px-6 py-3 text-xs font-medium text-muted uppercase tracking-wider">Brand Name</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-muted uppercase tracking-wider">Status</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-muted uppercase tracking-wider">Last Updated</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-muted uppercase tracking-wider">Current Ask</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-muted uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody>
                {sortedDeals.map((deal: Deal) => (
                  <tr key={deal.id} className="border-b border-border last:border-0 hover:bg-muted-light/50 transition-colors">
                    <td className="px-6 py-4 font-medium">{deal.brand_name}</td>
                    <td className="px-6 py-4"><StatusBadge status={deal.status} finalPrice={deal.final_price} /></td>
                    <td className="px-6 py-4 text-muted">{formatDate(deal.updated_at)}</td>
                    <td className="px-6 py-4 font-medium">{formatDealTarget(deal, deal.rate_card_id ? rateCardById.get(deal.rate_card_id) ?? null : null)}</td>
                    <td className="px-6 py-4">
                      <Link
                        href={`/deal/${deal.id}`}
                        className="inline-flex items-center gap-1 text-primary text-sm font-medium hover:underline"
                      >
                        {deal.status === 'negotiating' ? 'Continue Negotiating' : 'Archived'}
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-sm text-muted">
            <p>No deals yet. Generate a rate card and start tracking your first deal.</p>
            <Link href="/generate" className="mt-4 inline-flex items-center gap-2 text-primary font-medium hover:underline text-sm">
              Generate Rate Card <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
