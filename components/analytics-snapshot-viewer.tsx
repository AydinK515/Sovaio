'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ArrowLeft, BarChart3, Bot, FileStack, MessageSquare, Sparkles } from 'lucide-react'
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
  const availableReportTypes = snapshot.report_types.filter((type) => Array.isArray(csvData[type]) && csvData[type].length > 0)
  const fallbackReportType = Object.keys(csvData)[0] ?? ''
  const [selectedReportType, setSelectedReportType] = useState(availableReportTypes[0] ?? fallbackReportType)

  const selectedRows = selectedReportType ? (csvData[selectedReportType] ?? []) : []
  const selectedColumns = collectColumns(selectedRows)
  const previewRows = selectedRows.slice(0, 25)
  const totalRows = Object.values(csvData).reduce((sum, rows) => sum + rows.length, 0)
  const selectedMeta = REPORT_TYPE_META[selectedReportType as CsvUpload['upload_type']]

  return (
    <div className="py-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link href="/analytics" className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
            <ArrowLeft className="h-4 w-4" />
            Back to Snapshots
          </Link>
          <h1 className="mt-4 text-3xl font-bold md:text-4xl">{snapshot.name}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
            This is your reusable analytics snapshot. It stores a cleaned, structured version of your YouTube Studio exports so the rest of the app can work from real channel context instead of guesses.
          </p>
          <p className="mt-3 text-xs text-muted">
            Saved {formatDate(snapshot.created_at)}
            {snapshot.subscriber_count ? ` · ${snapshot.subscriber_count.toLocaleString()} subscribers` : ''}
            {snapshot.report_types.length > 0 ? ` · ${snapshot.report_types.length} report types included` : ''}
          </p>
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
              <h2 className="text-xl font-semibold">What this snapshot actually does</h2>
              <p className="text-sm text-muted">A plain-English explanation of what you can do with it.</p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-1 xl:grid-cols-3">
            <div className="rounded-2xl border border-border bg-slate-50 p-4">
              <BarChart3 className="h-5 w-5 text-primary" />
              <h3 className="mt-3 text-sm font-semibold">Generate a rate card from it</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                The app reads this saved snapshot, pulls out your strongest channel signals, and uses those to estimate your sponsorship pricing.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-slate-50 p-4">
              <Sparkles className="h-5 w-5 text-primary" />
              <h3 className="mt-3 text-sm font-semibold">What “based off of” means</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                It means the output is grounded in this snapshot&apos;s subscribers, audience mix, geography, performance summaries, and other derived metrics.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-slate-50 p-4">
              <Bot className="h-5 w-5 text-primary" />
              <h3 className="mt-3 text-sm font-semibold">Give the AI channel knowledge</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Pick this snapshot in Channel Advisor or a deal, and the AI gets your real channel context instead of answering generically.
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-primary/15 bg-primary-light/40 p-5">
            <h3 className="text-sm font-semibold text-foreground">How to add this snapshot to AI context</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              In Channel Advisor, choose this snapshot from the snapshot selector and the assistant will use it for channel-level questions about your audience, positioning, and pricing. In deals, create a new deal from this snapshot or switch the deal&apos;s selected snapshot so the negotiation AI uses the same channel context.
            </p>
          </div>
        </section>

        <section className="rounded-3xl border border-border bg-white p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-light text-primary">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Snapshot summary</h2>
              <p className="text-sm text-muted">This is the condensed summary built from the reports inside this snapshot.</p>
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
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Snapshot contents viewer</h2>
            <p className="mt-1 text-sm text-muted">
              Browse the actual parsed report data stored inside this snapshot. This is the structured content the app works from after upload.
            </p>
          </div>
          {selectedReportType && (
            <div className="text-sm text-muted">
              Viewing <span className="font-medium text-foreground">{formatReportType(selectedReportType)}</span>
              {selectedRows.length > 0 ? ` · ${selectedRows.length.toLocaleString()} rows` : ''}
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {availableReportTypes.map((reportType) => (
            <button
              key={reportType}
              type="button"
              onClick={() => setSelectedReportType(reportType)}
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

            <div className="mt-6 overflow-hidden rounded-2xl border border-border">
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
                    {previewRows.map((row, index) => (
                      <tr key={`${selectedReportType}-${index}`} className="border-t border-border align-top">
                        {selectedColumns.map((column) => (
                          <td key={`${selectedReportType}-${index}-${column}`} className="max-w-[320px] px-4 py-3 text-muted">
                            {formatCell(row[column])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <p className="mt-3 text-xs text-muted">
              Showing the first {previewRows.length.toLocaleString()} rows of {selectedRows.length.toLocaleString()} stored rows for this report.
            </p>
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
