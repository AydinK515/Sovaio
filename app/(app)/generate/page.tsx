import { redirect } from 'next/navigation'
import { isAiEnabledForUser } from '@/lib/ai-access'
import { createClient } from '@/lib/supabase-server'
import type { AnalyticsSnapshot } from '@/lib/types'
import GenerateRateCardClient from './client'

export default async function GeneratePage({
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
  const aiEnabled = await isAiEnabledForUser(supabase, user.id)

  return (
    <GenerateRateCardClient
      aiEnabled={aiEnabled}
      snapshots={(snapshots || []) as AnalyticsSnapshot[]}
      initialSnapshotId={snapshot ?? null}
    />
  )
}
