import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Plus } from 'lucide-react'
import EmptyStateLaunchpad from '@/components/empty-state-launchpad'
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
        <p className="mt-2 text-muted text-lg">Upload analytics first so your first rate card is grounded in real channel context.</p>

        <div className="mt-10">
          <EmptyStateLaunchpad
            eyebrow="Before pricing"
            title="You need one saved snapshot before you can price anything."
            description="Rate cards are built from saved analytics snapshots, not generic assumptions. Once you upload your YouTube Studio exports and save a snapshot, this page becomes your reusable library of pricing assets."
            primaryHref="/analytics/new"
            primaryLabel="Upload analytics"
            secondaryHref="/dashboard"
            secondaryLabel="Back to dashboard"
          />
        </div>
      </div>
    )
  }

  if (!rateCards?.length) {
    return (
      <div className="py-12">
        <h1 className="text-3xl md:text-4xl font-bold">Your rate cards</h1>
        <p className="mt-2 text-muted text-lg">You haven&apos;t saved any rate cards yet.</p>

        <div className="mt-10">
          <EmptyStateLaunchpad
            eyebrow="Your pricing library"
            title="Generate your first sponsor-ready rate card"
            description="A rate card gives you reusable ranges for dedicated videos and in-video integrations, plus explanation and pitch copy you can keep coming back to. This is usually the product's first real aha moment."
            primaryHref="/generate"
            primaryLabel="Create rate card"
            secondaryHref="/analytics"
            secondaryLabel="Review snapshots"
          />
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
