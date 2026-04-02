import { notFound, redirect } from 'next/navigation'
import AnalyticsSnapshotViewer from '@/components/analytics-snapshot-viewer'
import { getAnalyticsSnapshotContext } from '@/lib/analytics-context'
import { createClient } from '@/lib/supabase-server'

export default async function AnalyticsSnapshotPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const [context, rateCardsResponse, dealsResponse, aiChatsResponse] = await Promise.all([
    getAnalyticsSnapshotContext({
      supabase,
      snapshotId: id,
      userId: user.id,
    }),
    supabase
      .from('rate_cards')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('analytics_snapshot_id', id),
    supabase
      .from('deals')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('analytics_snapshot_id', id),
    supabase
      .from('channel_ai_chats')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('analytics_snapshot_id', id),
  ])

  if (!context) {
    notFound()
  }

  return (
    <AnalyticsSnapshotViewer
      snapshot={context.snapshot}
      csvData={context.csvData}
      csvSummary={context.csvSummary}
      promptContext={context.promptContext}
      rateCardCount={rateCardsResponse.count ?? 0}
      dealCount={dealsResponse.count ?? 0}
      aiChatCount={aiChatsResponse.count ?? 0}
    />
  )
}
