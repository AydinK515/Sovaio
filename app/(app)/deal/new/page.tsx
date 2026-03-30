import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import type { AnalyticsSnapshot } from '@/lib/types'
import NewDealClient from './page-client'

export default async function NewDealPage({
  searchParams,
}: {
  searchParams: Promise<{ snapshot?: string }>
}) {
  const { snapshot } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: snapshots } = await supabase
    .from('analytics_snapshots')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <NewDealClient
      snapshots={(snapshots || []) as AnalyticsSnapshot[]}
      initialSnapshotId={snapshot ?? null}
    />
  )
}
