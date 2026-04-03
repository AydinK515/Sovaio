import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Plus, Sparkles } from 'lucide-react'
import RateCardsClient from '@/components/rate-cards-client'
import { createClient } from '@/lib/supabase-server'
import type { AnalyticsSnapshot, RateCard } from '@/lib/types'

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

      <RateCardsClient
        initialRateCards={(rateCards || []) as RateCard[]}
        snapshots={(snapshots || []) as AnalyticsSnapshot[]}
      />
    </div>
  )
}
