import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import type { AnalyticsSnapshot } from '@/lib/types'
import AnalyticsSnapshotsClient from '@/components/analytics-snapshots-client'

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

      <AnalyticsSnapshotsClient initialSnapshots={items} />
    </div>
  )
}
