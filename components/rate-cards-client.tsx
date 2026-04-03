'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ArrowRight, Pencil, Trash2 } from 'lucide-react'
import type { AnalyticsSnapshot, RateCard } from '@/lib/types'

function formatCurrency(n: number) {
  return `$${n.toLocaleString()}`
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function confidenceTone(confidence: number) {
  if (confidence >= 70) return 'text-success bg-green-50 border-green-200'
  if (confidence >= 40) return 'text-warning bg-amber-50 border-amber-200'
  return 'text-primary bg-primary-light border-primary/20'
}

function getVisibleRateSummaries(rateCard: RateCard) {
  return [
    ...(rateCard.offers_dedicated_videos
      ? [{
          label: 'Dedicated Video',
          shortLabel: 'Dedicated',
          range: `${formatCurrency(rateCard.dedicated_video_low)} - ${formatCurrency(rateCard.dedicated_video_high)}`,
        }]
      : []),
    {
      label: '60-Second Integration',
      shortLabel: '60s Integration',
      range: `${formatCurrency(rateCard.integration_60s_low)} - ${formatCurrency(rateCard.integration_60s_high)}`,
    },
    {
      label: '30-Second Integration',
      shortLabel: '30s Integration',
      range: `${formatCurrency(rateCard.integration_30s_low)} - ${formatCurrency(rateCard.integration_30s_high)}`,
    },
  ]
}

export default function RateCardsClient({
  initialRateCards,
  snapshots,
}: {
  initialRateCards: RateCard[]
  snapshots: AnalyticsSnapshot[]
}) {
  const router = useRouter()
  const [rateCards, setRateCards] = useState(initialRateCards)
  const [editingRateCardId, setEditingRateCardId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const [pendingRateCardId, setPendingRateCardId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const snapshotById = new Map(snapshots.map(snapshot => [snapshot.id, snapshot]))
  const latestCard = rateCards[0] ?? null
  const latestCardSummaries = latestCard ? getVisibleRateSummaries(latestCard) : []

  async function saveRateCardName(rateCardId: string) {
    const nextName = draftName.trim()
    if (!nextName) {
      setError('Rate card name cannot be empty.')
      return
    }

    setPendingRateCardId(rateCardId)
    setError('')

    try {
      const response = await fetch(`/api/rate-cards/${rateCardId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nextName }),
      })

      if (!response.ok) {
        throw new Error(await response.text())
      }

      setRateCards(current => current.map(rateCard => (
        rateCard.id === rateCardId ? { ...rateCard, name: nextName } : rateCard
      )))
      setEditingRateCardId(null)
      setDraftName('')
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to rename rate card.')
    } finally {
      setPendingRateCardId(null)
    }
  }

  async function deleteRateCard(rateCardId: string) {
    const rateCard = rateCards.find(item => item.id === rateCardId)
    if (!rateCard) return

    const confirmed = window.confirm(
      `Delete "${rateCard.name || rateCard.niche || 'Untitled rate card'}"? Existing deals will keep their data, but they will no longer be linked to this rate card.`
    )

    if (!confirmed) return

    setPendingRateCardId(rateCardId)
    setError('')

    try {
      const response = await fetch(`/api/rate-cards/${rateCardId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error(await response.text())
      }

      setRateCards(current => current.filter(rateCardItem => rateCardItem.id !== rateCardId))
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete rate card.')
    } finally {
      setPendingRateCardId(null)
    }
  }

  return (
    <div className="mt-8">
      {error && <p className="rounded-lg bg-primary-light px-4 py-2 text-sm text-primary">{error}</p>}

      {latestCard && (
        <div className="mt-4 rounded-3xl bg-secondary p-6 text-white md:p-8">
          <p className="text-xs uppercase tracking-[0.24em] text-white/60">Latest saved</p>
          <div className="mt-4 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-semibold">{latestCard.name || latestCard.niche || 'Untitled rate card'}</h2>
              <p className="mt-2 text-white/70">
                Generated on {formatDate(latestCard.created_at)} with {latestCard.report_confidence}% confidence.
                {latestCard.analytics_snapshot_id ? ` Built from ${snapshotById.get(latestCard.analytics_snapshot_id)?.name || 'snapshot'}.` : ''}
              </p>
            </div>

            <div className={`grid grid-cols-1 gap-3 min-w-full ${latestCardSummaries.length === 3 ? 'sm:grid-cols-3 lg:min-w-[520px]' : 'sm:grid-cols-2 lg:min-w-[360px]'}`}>
              {latestCardSummaries.map((summary) => (
                <div key={summary.label} className="rounded-2xl bg-white/10 px-4 py-4">
                  <p className="text-xs text-white/60">{summary.shortLabel}</p>
                  <p className="mt-1 text-lg font-semibold">{summary.range}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={`/rate-card/${latestCard.id}`}
              className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-secondary transition-colors hover:bg-white/90"
            >
              View Rate Card
            </Link>
          </div>
        </div>
      )}

      <div className="mt-8 grid gap-4">
        {rateCards.map((rateCard) => {
          const summaries = getVisibleRateSummaries(rateCard)
          const rateCardName = rateCard.name || rateCard.niche || 'Untitled rate card'

          return (
            <div key={rateCard.id} className="rounded-2xl border border-border bg-white p-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {editingRateCardId === rateCard.id ? (
                      <div className="flex w-full max-w-xl flex-col gap-3 sm:flex-row">
                        <input
                          value={draftName}
                          onChange={(event) => setDraftName(event.target.value)}
                          className="min-w-0 flex-1 rounded-xl border border-border bg-white px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => void saveRateCardName(rateCard.id)}
                            disabled={pendingRateCardId === rateCard.id}
                            className="rounded-xl bg-secondary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-secondary-hover disabled:opacity-50"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingRateCardId(null)
                              setDraftName('')
                            }}
                            className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted-light"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <h2 className="text-lg font-semibold">{rateCardName}</h2>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingRateCardId(rateCard.id)
                              setDraftName(rateCardName)
                            }}
                            aria-label={`Rename ${rateCardName}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-muted-light hover:text-foreground"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteRateCard(rateCard.id)}
                            disabled={pendingRateCardId === rateCard.id}
                            aria-label={`Delete ${rateCardName}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-primary-light hover:text-primary disabled:opacity-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${confidenceTone(rateCard.report_confidence)}`}>
                          {rateCard.report_confidence}% confidence
                        </span>
                      </>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {formatDate(rateCard.created_at)}
                    {rateCard.subscriber_count ? ` - ${rateCard.subscriber_count.toLocaleString()} subscribers` : ''}
                    {rateCard.has_sponsorships ? ' - Has sponsorship history' : ''}
                    {rateCard.analytics_snapshot_id ? ` - Built from ${snapshotById.get(rateCard.analytics_snapshot_id)?.name || 'snapshot'}` : ''}
                  </p>
                  <div className={`mt-4 grid gap-3 text-sm ${summaries.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
                    {summaries.map((summary) => (
                      <div key={summary.label} className="rounded-xl bg-muted-light px-4 py-3">
                        <p className="text-muted">{summary.label}</p>
                        <p className="mt-1 font-semibold">{summary.range}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex lg:shrink-0">
                  <Link
                    href={`/rate-card/${rateCard.id}`}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-foreground px-5 py-3 text-sm font-medium text-white transition-colors hover:opacity-90"
                  >
                    Open Rate Card
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
