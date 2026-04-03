'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { DEAL_TYPE_LABELS, getOpeningMessage } from '@/lib/deal-chat'
import { captureAnalyticsEvent } from '@/lib/posthog-client'
import { POSTHOG_EVENTS } from '@/lib/posthog-events'
import type { AnalyticsSnapshot, Deal } from '@/lib/types'
import FancySelect from '@/components/fancy-select'

export default function NewDealClient({
  snapshots,
  initialSnapshotId,
}: {
  snapshots: AnalyticsSnapshot[]
  initialSnapshotId: string | null
}) {
  const router = useRouter()
  const supabase = createClient()

  const [brandName, setBrandName] = useState('')
  const [dealType, setDealType] = useState<Deal['deal_type']>('integration_60s')
  const [analyticsSnapshotId, setAnalyticsSnapshotId] = useState(initialSnapshotId ?? snapshots[0]?.id ?? '')
  const [creatorAsk, setCreatorAsk] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const dealTypeOptions = useMemo(
    () => Object.entries(DEAL_TYPE_LABELS).map(([value, label]) => ({ value, label })),
    []
  )
  const snapshotOptions = useMemo(
    () => snapshots.map((snapshot) => ({ value: snapshot.id, label: snapshot.name })),
    [snapshots]
  )

  async function handleCreateDeal() {
    if (!brandName.trim() || !analyticsSnapshotId) {
      setError('Please choose a snapshot and enter the brand name.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const askAmount = creatorAsk ? parseInt(creatorAsk.replace(/,/g, '')) : null

      const { data: deal, error: dealError } = await supabase
        .from('deals')
        .insert({
          user_id: user.id,
          analytics_snapshot_id: analyticsSnapshotId,
          brand_name: brandName.trim(),
          deal_type: dealType,
          creator_ask: askAmount,
          status: 'negotiating',
        })
        .select('id')
        .single()

      if (dealError) throw dealError

      captureAnalyticsEvent(POSTHOG_EVENTS.dealCreated, {
        user_id: user.id,
        deal_id: deal.id,
        analytics_snapshot_id: analyticsSnapshotId,
        deal_type: dealType,
      })

      const { data: chat, error: chatError } = await supabase
        .from('deal_chats')
        .insert({
          deal_id: deal.id,
          user_id: user.id,
          title: 'New Chat',
        })
        .select('id')
        .single()

      if (chatError || !chat) throw chatError || new Error('Failed to create chat')

      await supabase.from('deal_messages').insert({
        deal_id: deal.id,
        chat_id: chat.id,
        user_id: user.id,
        role: 'ai',
        content: getOpeningMessage({
          brand_name: brandName.trim(),
          creator_ask: askAmount,
          deal_type: dealType,
        }),
      })

      router.push(`/deal/${deal.id}?chat=${chat.id}`)
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create deal')
      setLoading(false)
      return
    }

    setLoading(false)
  }

  if (snapshots.length === 0) {
    return (
      <div className="py-8">
        <h1 className="text-3xl md:text-4xl font-bold">Create Deal</h1>
        <div className="mt-8 rounded-3xl border border-border bg-white p-8">
          <h2 className="text-xl font-semibold">Upload analytics first</h2>
          <p className="mt-2 text-sm text-muted">Deals need an analytics snapshot so the AI knows how big your channel is, what audience you reach, and what context to use while negotiating.</p>
          <button type="button" onClick={() => router.push('/analytics/new')} className="mt-6 inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-hover">
            Upload Analytics
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="py-8">
      <h1 className="text-3xl md:text-4xl font-bold">Create Deal</h1>
      <p className="mt-2 text-muted">Choose the analytics snapshot this negotiation should use. That gives the AI channel-size, audience, geography, and performance context right from the start.</p>

      <div className="mt-8 rounded-2xl border border-border bg-white p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted">Brand Name</label>
            <input
              value={brandName}
              onChange={(event) => setBrandName(event.target.value)}
              placeholder="e.g. NordVPN"
              className="w-full rounded-xl border border-border px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted">Deal Type</label>
            <FancySelect
              value={dealType}
              onChange={(nextValue) => setDealType(nextValue as Deal['deal_type'])}
              options={dealTypeOptions}
            />
          </div>
          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted">Analytics Snapshot</label>
            <FancySelect
              value={analyticsSnapshotId}
              onChange={setAnalyticsSnapshotId}
              options={snapshotOptions}
            />
          </div>
          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted">Your Ask (optional)</label>
            <input
              value={creatorAsk}
              onChange={(event) => setCreatorAsk(event.target.value)}
              placeholder="e.g. 2,500"
              className="w-full rounded-xl border border-border px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        {error && <p className="mt-4 rounded-lg bg-primary-light px-4 py-2 text-sm text-primary">{error}</p>}

        <button
          type="button"
          onClick={() => void handleCreateDeal()}
          disabled={loading}
          className="mt-6 inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
        >
          {loading ? 'Creating Deal...' : 'Create Deal'}
        </button>
      </div>
    </div>
  )
}
