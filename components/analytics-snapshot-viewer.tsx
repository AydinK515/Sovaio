'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { FileStack, MessageSquare, Pencil, Trash2 } from 'lucide-react'
import { captureAnalyticsEvent } from '@/lib/posthog-client'
import { POSTHOG_EVENTS } from '@/lib/posthog-events'
import { CSV_TYPES, type AnalyticsSnapshot, type CsvUpload } from '@/lib/types'

type CsvDataMap = Record<string, Record<string, unknown>[]>

const REPORT_TYPE_META = Object.fromEntries(
  CSV_TYPES.map((type) => [type.key, type])
) as Record<CsvUpload['upload_type'], (typeof CSV_TYPES)[number]>

function formatReportType(type: string) {
  return REPORT_TYPE_META[type as CsvUpload['upload_type']]?.label ?? type.replace(/_/g, ' ')
}

function formatCell(value: unknown) {
  if (value === null || value === undefined || value === '') return '-'
  if (typeof value === 'number') return Number.isFinite(value) ? value.toLocaleString() : '-'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  const text = String(value)
  return text.length > 120 ? `${text.slice(0, 117)}...` : text
}

function collectColumns(rows: Record<string, unknown>[]) {
  const columns: string[] = []

  for (const row of rows.slice(0, 5)) {
    for (const key of Object.keys(row)) {
      if (!columns.includes(key)) {
        columns.push(key)
      }
    }
  }

  return columns
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function AnalyticsSnapshotViewer({
  snapshot,
  csvData,
  csvSummary,
  promptContext,
  rateCardCount,
  dealCount,
  aiChatCount,
}: {
  snapshot: AnalyticsSnapshot
  csvData: CsvDataMap
  csvSummary: string
  promptContext: string
  rateCardCount: number
  dealCount: number
  aiChatCount: number
}) {
  const router = useRouter()
  const rowsPerPage = 10
  const availableReportTypes = snapshot.report_types.filter((type) => Array.isArray(csvData[type]) && csvData[type].length > 0)
  const fallbackReportType = Object.keys(csvData)[0] ?? ''
  const [selectedReportType, setSelectedReportType] = useState(availableReportTypes[0] ?? fallbackReportType)
  const [currentPage, setCurrentPage] = useState(1)
  const [snapshotName, setSnapshotName] = useState(snapshot.name)
  const [editingName, setEditingName] = useState(false)
  const [draftName, setDraftName] = useState(snapshot.name)
  const [pendingAction, setPendingAction] = useState<'rename' | 'delete' | null>(null)
  const [actionError, setActionError] = useState('')

  const selectedRows = selectedReportType ? (csvData[selectedReportType] ?? []) : []
  const selectedColumns = collectColumns(selectedRows)
  const totalPages = Math.max(1, Math.ceil(selectedRows.length / rowsPerPage))
  const paginatedRows = selectedRows.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage)
  const totalRows = Object.values(csvData).reduce((sum, rows) => sum + rows.length, 0)
  const selectedMeta = REPORT_TYPE_META[selectedReportType as CsvUpload['upload_type']]

  useEffect(() => {
    captureAnalyticsEvent(POSTHOG_EVENTS.analyticsSnapshotViewed, {
      analytics_snapshot_id: snapshot.id,
      report_confidence: snapshot.report_confidence,
      subscriber_count: snapshot.subscriber_count,
    })
  }, [snapshot.id, snapshot.report_confidence, snapshot.subscriber_count])

  function handleSelectReportType(reportType: string) {
    setSelectedReportType(reportType)
    setCurrentPage(1)
  }

  async function handleSaveName() {
    const nextName = draftName.trim()
    if (!nextName) {
      setActionError('Snapshot name cannot be empty.')
      return
    }

    setPendingAction('rename')
    setActionError('')

    try {
      const response = await fetch(`/api/analytics-snapshots/${snapshot.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nextName }),
      })

      if (!response.ok) {
        throw new Error(await response.text())
      }

      setSnapshotName(nextName)
      setDraftName(nextName)
      setEditingName(false)
      router.refresh()
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to rename snapshot.')
    } finally {
      setPendingAction(null)
    }
  }

  async function handleDeleteSnapshot() {
    const confirmed = window.confirm(
      `Delete "${snapshotName}"? Existing rate cards and deals will keep their data, but they will no longer be linked to this snapshot.`
    )

    if (!confirmed) return

    setPendingAction('delete')
    setActionError('')

    try {
      const response = await fetch(`/api/analytics-snapshots/${snapshot.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error(await response.text())
      }

      captureAnalyticsEvent(POSTHOG_EVENTS.analyticsSnapshotDeleted, {
        analytics_snapshot_id: snapshot.id,
        report_confidence: snapshot.report_confidence,
      })

      router.push('/analytics')
      router.refresh()
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete snapshot.')
      setPendingAction(null)
    }
  }

  return (
    <div className="py-8">
      <div className="mb-6 flex flex-wrap items-center gap-3 text-sm">
        <Link href="/analytics" className="font-medium text-primary hover:underline">
          All Analytics
        </Link>
        <span className="text-muted">/</span>
        <span className="text-muted">{snapshotName}</span>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          {editingName ? (
            <div className="flex max-w-2xl flex-col gap-3 sm:flex-row">
              <input
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                className="min-w-0 flex-1 rounded-xl border border-border bg-white px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void handleSaveName()}
                  disabled={pendingAction === 'rename'}
                  className="rounded-xl bg-secondary px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-secondary-hover disabled:opacity-50"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingName(false)
                    setDraftName(snapshotName)
                    setActionError('')
                  }}
                  className="rounded-xl border border-border px-4 py-3 text-sm font-medium transition-colors hover:bg-muted-light"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-bold md:text-4xl">{snapshotName}</h1>
              <button
                type="button"
                onClick={() => {
                  setEditingName(true)
                  setDraftName(snapshotName)
                  setActionError('')
                }}
                aria-label={`Rename ${snapshotName}`}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-muted-light hover:text-foreground"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteSnapshot()}
                disabled={pendingAction === 'delete'}
                aria-label={`Delete ${snapshotName}`}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-primary-light hover:text-primary disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
            This is your reusable analytics snapshot. It stores a cleaned, structured version of your YouTube Studio exports so the rest of the app can work from real channel context instead of guesses.
          </p>
          <p className="mt-3 text-xs text-muted">
            Saved {formatDate(snapshot.created_at)}
            {snapshot.subscriber_count ? ` · ${snapshot.subscriber_count.toLocaleString()} subscribers` : ''}
            {snapshot.report_types.length > 0 ? ` · ${snapshot.report_types.length} report types included` : ''}
          </p>
          {actionError && <p className="mt-3 rounded-lg bg-primary-light px-4 py-2 text-sm text-primary">{actionError}</p>}
        </div>

        <div className="flex flex-wrap gap-3">
          <Link href={`/generate?snapshot=${snapshot.id}`} className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover">
            Generate Rate Card
          </Link>
          <Link href={`/deal/new?snapshot=${snapshot.id}`} className="inline-flex items-center justify-center rounded-xl bg-secondary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-secondary-hover">
            Create Deal
          </Link>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-border bg-white p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted">Confidence</p>
          <p className="mt-2 text-3xl font-bold">{snapshot.report_confidence}%</p>
          <p className="mt-2 text-sm text-muted">How complete this snapshot is based on the reports you uploaded.</p>
        </div>
        <div className="rounded-2xl border border-border bg-white p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted">Rows Parsed</p>
          <p className="mt-2 text-3xl font-bold">{totalRows.toLocaleString()}</p>
          <p className="mt-2 text-sm text-muted">Structured analytics rows available for pricing, summaries, and AI context.</p>
        </div>
        <div className="rounded-2xl border border-border bg-white p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted">Rate Cards Built</p>
          <p className="mt-2 text-3xl font-bold">{rateCardCount}</p>
          <p className="mt-2 text-sm text-muted">Rate cards already generated from this exact snapshot.</p>
        </div>
        <div className="rounded-2xl border border-border bg-white p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted">AI-Linked Threads</p>
          <p className="mt-2 text-3xl font-bold">{dealCount + aiChatCount}</p>
          <p className="mt-2 text-sm text-muted">Deals and Channel Advisor chats currently grounded in this snapshot.</p>
        </div>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-3xl border border-border bg-white p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-light text-primary">
              <FileStack className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">What you can do with this snapshot</h2>
            </div>
          </div>

          <div className="mt-6 grid gap-4">
            <div className="rounded-2xl border border-border bg-slate-50 p-4">
              <h3 className="text-sm font-semibold">Generate a rate card from it</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                The app reads this saved snapshot, pulls out your strongest channel signals, and uses those to estimate your sponsorship pricing.
              </p>
              <div className="mt-4">
                <Link
                  href={`/generate?snapshot=${snapshot.id}`}
                  className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
                >
                  Generate Rate Card
                </Link>
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-slate-50 p-4">
              <h3 className="text-sm font-semibold">Give our AIs context</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                When you pick this snapshot in Channel Advisor or a deal, our AIs get real channel context from this snapshot instead of answering generically. The more complete the snapshot, the smarter the AI.
              </p>
              <div className="mt-4">
                <Link
                  href={`/deal/new?snapshot=${snapshot.id}`}
                  className="inline-flex items-center justify-center rounded-xl bg-secondary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-secondary-hover"
                >
                  Create Deal
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-border bg-white p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-light text-primary">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Snapshot summary</h2>
              <p className="text-sm text-muted">This is the exact summary that our AIs will receive when you use this snapshot, like when you generate a rate card.</p>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-border bg-slate-50 p-5">
            <pre className="whitespace-pre-wrap break-words text-sm leading-relaxed text-muted">
              {csvSummary || promptContext || 'No summary could be built from this snapshot yet.'}
            </pre>
          </div>
        </section>
      </div>

      <section className="mt-8 rounded-3xl border border-border bg-white p-6">
        <div>
          <h2 className="text-xl font-semibold">Snapshot contents viewer</h2>
          <p className="mt-1 text-sm text-muted">
            Browse the actual parsed report data stored inside this snapshot. This is the structured content the app works from after upload.
          </p>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {availableReportTypes.map((reportType) => (
            <button
              key={reportType}
              type="button"
              onClick={() => handleSelectReportType(reportType)}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                selectedReportType === reportType
                  ? 'border-primary bg-primary text-white'
                  : 'border-border bg-white text-muted hover:text-foreground'
              }`}
            >
              {formatReportType(reportType)}
            </button>
          ))}
        </div>

        {selectedReportType ? (
          <>
            {selectedMeta && (
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-border bg-slate-50 p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted">What this report tells you</p>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{selectedMeta.description}</p>
                </div>
                <div className="rounded-2xl border border-border bg-slate-50 p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted">Where it came from in YouTube Studio</p>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{selectedMeta.studioPath}</p>
                </div>
              </div>
            )}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted">
                Viewing <span className="font-medium text-foreground">{formatReportType(selectedReportType)}</span>
                {selectedRows.length > 0 ? ` · ${selectedRows.length.toLocaleString()} rows` : ''}
              </p>

              {selectedRows.length > rowsPerPage && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                    disabled={currentPage === 1}
                    className="rounded-lg border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted-light disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-muted">
                    Page <span className="font-medium text-foreground">{currentPage}</span> of {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                    disabled={currentPage === totalPages}
                    className="rounded-lg border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted-light disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>

            <div className="mt-4 overflow-hidden rounded-2xl border border-border">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-muted-light">
                    <tr>
                      {selectedColumns.map((column) => (
                        <th key={column} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRows.map((row, index) => (
                      <tr key={`${selectedReportType}-${currentPage}-${index}`} className="border-t border-border align-top">
                        {selectedColumns.map((column) => (
                          <td key={`${selectedReportType}-${currentPage}-${index}-${column}`} className="max-w-[320px] px-4 py-3 text-muted">
                            {formatCell(row[column])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {selectedRows.length > rowsPerPage && (
              <p className="mt-3 text-xs text-muted">
                Showing rows {((currentPage - 1) * rowsPerPage + 1).toLocaleString()}-{Math.min(currentPage * rowsPerPage, selectedRows.length).toLocaleString()} of {selectedRows.length.toLocaleString()}.
              </p>
            )}
          </>
        ) : (
          <div className="mt-6 rounded-2xl border border-border bg-slate-50 p-6 text-sm text-muted">
            No parsed report rows were available to preview for this snapshot.
          </div>
        )}
      </section>
    </div>
  )
}
