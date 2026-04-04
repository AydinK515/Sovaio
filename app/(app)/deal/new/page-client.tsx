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
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const dealTypeOptions = useMemo(
    () => Object.entries(DEAL_TYPE_LABELS).map(([value, label]) => ({ value, label })),
    []
  )
  const snapshotOptions = useMemo(
    () => snapshots.map((snapshot) => ({ value: snapshot.id, label: snapshot.name })),
    [snapshots]
  )
  const missingRequiredFields = useMemo(() => {
    const missing: string[] = []

    if (!brandName.trim()) missing.push('Brand name')
    if (!analyticsSnapshotId) missing.push('Analytics snapshot')

    return missing
  }, [analyticsSnapshotId, brandName])
  const canCreateDeal = missingRequiredFields.length === 0
  const showFieldErrors = submitAttempted

  function RequiredMark() {
    return (
      <span aria-hidden="true" className="ml-1 text-primary">
        *
      </span>
    )
  }

  async function handleCreateDeal() {
    setSubmitAttempted(true)

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
        <p className="mb-4 text-xs text-muted">
          <span className="font-semibold text-primary">*</span> Required before you can create a deal
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted">
              Brand Name
              <RequiredMark />
            </label>
            <input
              value={brandName}
              onChange={(event) => setBrandName(event.target.value)}
              placeholder="e.g. NordVPN"
              className={`w-full rounded-xl border px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 ${showFieldErrors && !brandName.trim() ? 'border-primary' : 'border-border'}`}
            />
            {showFieldErrors && !brandName.trim() && (
              <p className="mt-2 text-sm text-primary">Enter the brand you are negotiating with.</p>
            )}
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
            <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted">
              Analytics Snapshot
              <RequiredMark />
            </label>
            <FancySelect
              value={analyticsSnapshotId}
              onChange={setAnalyticsSnapshotId}
              options={snapshotOptions}
              triggerClassName={showFieldErrors && !analyticsSnapshotId ? 'border-primary shadow-[0_0_0_3px_rgba(220,38,38,0.08)]' : undefined}
            />
            {showFieldErrors && !analyticsSnapshotId && (
              <p className="mt-2 text-sm text-primary">Choose which analytics snapshot should power this deal.</p>
            )}
          </div>
          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted">Your Ask</label>
            <input
              value={creatorAsk}
              onChange={(event) => setCreatorAsk(event.target.value)}
              placeholder="e.g. 2,500"
              className="w-full rounded-xl border border-border px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        {error && <p className="mt-4 rounded-lg bg-primary-light px-4 py-2 text-sm text-primary">{error}</p>}
        {!canCreateDeal && (
          <div className="mt-4 rounded-xl border border-border bg-white px-4 py-3 text-sm text-muted">
            Fill the required fields to continue: {missingRequiredFields.join(', ')}.
          </div>
        )}

        <button
          type="button"
          onClick={() => void handleCreateDeal()}
          disabled={!canCreateDeal || loading}
          className="mt-6 inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Creating Deal...' : 'Create Deal'}
        </button>
      </div>
    </div>
  )
}
