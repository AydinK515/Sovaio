import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import type { AnalyticsSnapshot } from '@/lib/types'

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: snapshots } = await supabase
    .from('analytics_snapshots')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const items = (snapshots || []) as AnalyticsSnapshot[]

  return (
    <div className="py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold">Analytics Snapshots</h1>
          <p className="mt-2 text-muted">Snapshots are the foundation of the app. They power rate cards, deals, and both AI assistants.</p>
        </div>
        <Link
          href="/analytics/new"
          className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
        >
          Upload Analytics
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="mt-10 rounded-3xl border border-border bg-white p-8">
          <h2 className="text-xl font-semibold">No analytics snapshots yet</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted">Upload your YouTube Studio exports first. Once you save a snapshot, you can generate rate cards and start deals with real channel context.</p>
          <Link
            href="/analytics/new"
            className="mt-6 inline-flex items-center rounded-xl bg-primary px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
          >
            Upload Your First Snapshot
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-4">
          {items.map((snapshot) => (
            <div key={snapshot.id} className="rounded-2xl border border-border bg-white p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold">{snapshot.name}</h2>
                    <span className="inline-flex rounded-full border border-border bg-muted-light px-2.5 py-1 text-xs text-muted">
                      {snapshot.report_confidence}% confidence
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {formatDate(snapshot.created_at)}
                    {snapshot.subscriber_count ? ` - ${snapshot.subscriber_count.toLocaleString()} subscribers` : ''}
                  </p>
                  {snapshot.report_types.length > 0 && (
                    <p className="mt-3 text-xs text-muted">Includes: {snapshot.report_types.join(', ')}</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link href={`/generate?snapshot=${snapshot.id}`} className="inline-flex items-center justify-center rounded-xl border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted-light">
                    Generate Rate Card
                  </Link>
                  <Link href={`/deal/new?snapshot=${snapshot.id}`} className="inline-flex items-center justify-center rounded-xl bg-secondary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-secondary-hover">
                    Create Deal
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
