import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, ArrowRight, Upload, BookOpen, TrendingUp, DollarSign, BarChart3 } from 'lucide-react'
import type { RateCard, Deal } from '@/lib/types'

function StatusBadge({ status }: { status: Deal['status'] }) {
  const styles = {
    negotiating: 'bg-blue-50 text-blue-700 border-blue-200',
    closed_won: 'bg-green-50 text-green-700 border-green-200',
    closed_lost: 'bg-red-50 text-red-700 border-red-200',
    stalled: 'bg-amber-50 text-amber-700 border-amber-200',
  }
  const labels = {
    negotiating: 'Negotiating',
    closed_won: 'Closed Won',
    closed_lost: 'Closed Lost',
    stalled: 'Stalled',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[status]}`}>
      {labels[status]}
    </span>
  )
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatCurrency(n: number | null) {
  if (n == null) return '—'
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
  const totalPipeline = deals?.filter(d => d.status === 'negotiating').reduce((sum, d) => sum + (d.creator_ask || 0), 0) || 0
  const avgRateIncrease = hasRateCards ? '+42%' : '—'

  const firstName = profile?.full_name?.split(' ')[0] || 'there'

  // Empty state — new user
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
              <Upload className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold">Step 1: Export Your Data</h3>
            <p className="mt-2 text-sm text-muted leading-relaxed">
              Go to <a href="https://studio.youtube.com/channel/UC/analytics" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">YouTube Studio Analytics</a>, switch to Advanced Mode, and export your data as CSVs.
            </p>
            <div className="mt-4 space-y-2 text-sm text-muted">
              <p>You&apos;ll need exports from:</p>
              <ul className="list-disc list-inside space-y-1">
                <li><strong>Content</strong> (Top videos) — <span className="text-primary">Required</span></li>
                <li>Demographics (Age & Gender)</li>
                <li>Geography (Viewer locations)</li>
                <li>Traffic Sources</li>
                <li>Retention</li>
              </ul>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-border p-8">
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
              <BarChart3 className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold">Step 2: Generate Your Rate Card</h3>
            <p className="mt-2 text-sm text-muted leading-relaxed">
              Upload your CSVs and fill in a few details about your channel. We&apos;ll analyze everything and generate your sponsorship rate card with a pitch email.
            </p>
            <Link
              href="/generate"
              className="mt-6 inline-flex items-center gap-2 bg-primary text-white font-medium px-6 py-3 rounded-xl hover:bg-primary-hover transition-colors text-sm"
            >
              <Upload className="w-4 h-4" />
              Upload Analytics
            </Link>
          </div>
        </div>

        <div className="mt-12 bg-secondary rounded-2xl p-8 text-white text-center">
          <h3 className="text-xl font-semibold">Optimize Your Leverage</h3>
          <p className="mt-2 text-white/70">The more data you upload, the higher your Report Confidence and the stronger your negotiating position.</p>
          <div className="mt-6 flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/generate" className="inline-flex items-center gap-2 bg-primary hover:bg-primary-hover text-white font-medium px-6 py-3 rounded-xl transition-colors text-sm">
              <Upload className="w-4 h-4" />
              Upload Analytics
            </Link>
            <a href="https://studio.youtube.com" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-medium px-6 py-3 rounded-xl transition-colors text-sm">
              <BookOpen className="w-4 h-4" />
              Read Creator Guide
            </a>
          </div>
        </div>
      </div>
    )
  }

  // User has rate cards and/or deals
  return (
    <div className="py-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold">Hi, {firstName}</h1>
          {activeDeals.length > 0 && (
            <p className="mt-1 text-sm text-muted">
              You have {activeDeals.length} active negotiation{activeDeals.length !== 1 ? 's' : ''}.
            </p>
          )}
        </div>
        <Link
          href="/generate"
          className="inline-flex items-center gap-2 bg-primary text-white font-medium px-5 py-2.5 rounded-xl hover:bg-primary-hover transition-colors text-sm"
        >
          <Plus className="w-4 h-4" />
          New Rate Card
        </Link>
      </div>

      {/* Stats */}
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
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-muted" />
            <p className="text-xs text-muted uppercase tracking-wider font-medium">Avg Rate Increase</p>
          </div>
          <p className="mt-2 text-3xl font-bold text-success">{avgRateIncrease}</p>
        </div>
      </div>

      {/* Deal Matrix */}
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
                {deals!.map((deal: Deal) => (
                  <tr key={deal.id} className="border-b border-border last:border-0 hover:bg-muted-light/50 transition-colors">
                    <td className="px-6 py-4 font-medium">{deal.brand_name}</td>
                    <td className="px-6 py-4"><StatusBadge status={deal.status} /></td>
                    <td className="px-6 py-4 text-muted">{formatDate(deal.updated_at)}</td>
                    <td className="px-6 py-4 font-medium">{formatCurrency(deal.creator_ask)}</td>
                    <td className="px-6 py-4">
                      <Link
                        href={`/deal/${deal.id}`}
                        className="inline-flex items-center gap-1 text-primary text-sm font-medium hover:underline"
                      >
                        {deal.status === 'negotiating' ? 'Continue Negotiating' : deal.status === 'closed_won' ? 'View Contract' : 'Archived'}
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

      {/* CTA */}
      <div className="mt-8 bg-secondary rounded-2xl p-8 text-white text-center">
        <h3 className="text-xl font-semibold">Optimize Your Leverage</h3>
        <p className="mt-2 text-white/70">Ready to land your next deal? Upload your latest YouTube Studio CSVs to generate a fresh rate card.</p>
        <div className="mt-6 flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/generate" className="inline-flex items-center gap-2 bg-primary hover:bg-primary-hover text-white font-medium px-6 py-3 rounded-xl transition-colors text-sm">
            <Upload className="w-4 h-4" />
            Upload Analytics
          </Link>
          <a href="https://studio.youtube.com" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-medium px-6 py-3 rounded-xl transition-colors text-sm">
            <BookOpen className="w-4 h-4" />
            Read Creator Guide
          </a>
        </div>
      </div>
    </div>
  )
}
