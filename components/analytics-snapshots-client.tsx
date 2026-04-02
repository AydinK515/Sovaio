'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import type { AnalyticsSnapshot } from '@/lib/types'

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function AnalyticsSnapshotsClient({
  initialSnapshots,
}: {
  initialSnapshots: AnalyticsSnapshot[]
}) {
  const router = useRouter()
  const [snapshots, setSnapshots] = useState(initialSnapshots)
  const [editingSnapshotId, setEditingSnapshotId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const [pendingSnapshotId, setPendingSnapshotId] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function saveSnapshotName(snapshotId: string) {
    const nextName = draftName.trim()
    if (!nextName) {
      setError('Snapshot name cannot be empty.')
      return
    }

    setPendingSnapshotId(snapshotId)
    setError('')

    try {
      const response = await fetch(`/api/analytics-snapshots/${snapshotId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nextName }),
      })

      if (!response.ok) {
        throw new Error(await response.text())
      }

      setSnapshots((current) => current.map((snapshot) => (
        snapshot.id === snapshotId ? { ...snapshot, name: nextName } : snapshot
      )))
      setEditingSnapshotId(null)
      setDraftName('')
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to rename snapshot.')
    } finally {
      setPendingSnapshotId(null)
    }
  }

  async function deleteSnapshot(snapshotId: string) {
    const snapshot = snapshots.find((item) => item.id === snapshotId)
    if (!snapshot) return

    const confirmed = window.confirm(
      `Delete "${snapshot.name}"? Existing rate cards and deals will keep their data, but they will no longer be linked to this snapshot.`
    )

    if (!confirmed) return

    setPendingSnapshotId(snapshotId)
    setError('')

    try {
      const response = await fetch(`/api/analytics-snapshots/${snapshotId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error(await response.text())
      }

      setSnapshots((current) => current.filter((snapshotItem) => snapshotItem.id !== snapshotId))
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete snapshot.')
    } finally {
      setPendingSnapshotId(null)
    }
  }

  if (snapshots.length === 0) {
    return (
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
    )
  }

  return (
    <div className="mt-8 grid gap-4">
      {error && <p className="rounded-lg bg-primary-light px-4 py-2 text-sm text-primary">{error}</p>}

      {snapshots.map((snapshot) => (
        <div key={snapshot.id} className="rounded-2xl border border-border bg-white p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {editingSnapshotId === snapshot.id ? (
                  <div className="flex w-full max-w-xl flex-col gap-3 sm:flex-row">
                    <input
                      value={draftName}
                      onChange={(event) => setDraftName(event.target.value)}
                      className="min-w-0 flex-1 rounded-xl border border-border bg-white px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void saveSnapshotName(snapshot.id)}
                        disabled={pendingSnapshotId === snapshot.id}
                        className="rounded-xl bg-secondary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-secondary-hover disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingSnapshotId(null)
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
                      <h2 className="text-lg font-semibold">{snapshot.name}</h2>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingSnapshotId(snapshot.id)
                          setDraftName(snapshot.name)
                        }}
                        aria-label={`Rename ${snapshot.name}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-muted-light hover:text-foreground"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteSnapshot(snapshot.id)}
                        disabled={pendingSnapshotId === snapshot.id}
                        aria-label={`Delete ${snapshot.name}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-primary-light hover:text-primary disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <span className="inline-flex rounded-full border border-border bg-muted-light px-2.5 py-1 text-xs text-muted">
                      {snapshot.report_confidence}% confidence
                    </span>
                  </>
                )}
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
              <Link href={`/analytics/${snapshot.id}`} className="inline-flex items-center justify-center rounded-xl border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted-light">
                View Snapshot
              </Link>
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
  )
}
