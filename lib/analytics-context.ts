import type { SupabaseClient } from '@supabase/supabase-js'
import { buildCsvSummary } from '@/lib/csv-summary'
import type { AnalyticsSnapshot } from '@/lib/types'

type CsvDataMap = Record<string, Record<string, unknown>[]>

export type AnalyticsContext = {
  snapshot: AnalyticsSnapshot
  csvData: CsvDataMap
  csvSummary: string
  compactFacts: string[]
  promptContext: string
}

const analyticsContextCache = new Map<string, AnalyticsContext | null>()

export function invalidateAnalyticsSnapshotContext(snapshotId: string) {
  analyticsContextCache.delete(snapshotId)
}

function formatSnapshotRange(snapshot: AnalyticsSnapshot) {
  const value = snapshot.snapshot_range

  switch (value) {
    case '4_weeks':
      return 'Last 28 days'
    case 'quarter':
      return 'Last 90 days'
    case 'year':
      return 'Last 365 days'
    case 'lifetime':
      return 'Lifetime'
    default:
      if (typeof value === 'string' && value.startsWith('custom:')) {
        const parsedDaysBack = Number.parseInt(value.slice('custom:'.length), 10)
        return Number.isFinite(parsedDaysBack) && parsedDaysBack > 0
          ? `Custom (${parsedDaysBack} days back)`
          : 'Custom'
      }

      return null
  }
}

function buildCompactFacts(snapshot: AnalyticsSnapshot, csvSummary: string) {
  const snapshotRangeLabel = formatSnapshotRange(snapshot)
  const facts = [
    `Selected analytics snapshot: ${snapshot.name}`,
    `- Report confidence: ${snapshot.report_confidence}%`,
    snapshot.subscriber_count ? `- Subscribers: ${snapshot.subscriber_count.toLocaleString()}` : null,
    snapshotRangeLabel ? `- Snapshot range: ${snapshotRangeLabel}` : null,
    snapshot.include_shorts === null
      ? null
      : snapshot.include_shorts
        ? '- Includes YouTube Shorts: Yes'
        : '- Includes YouTube Shorts: No (long-form only)',
    snapshot.report_types.length > 0 ? `- Included reports: ${snapshot.report_types.join(', ')}` : null,
    csvSummary || null,
  ].filter((value): value is string => Boolean(value))

  return facts
}

export async function getAnalyticsSnapshotContext(input: {
  supabase: SupabaseClient
  snapshotId: string | null | undefined
  userId: string
}) {
  const snapshotId = input.snapshotId?.trim()
  if (!snapshotId) return null

  const cached = analyticsContextCache.get(snapshotId)
  if (cached !== undefined) return cached

  const { data: snapshot } = await input.supabase
    .from('analytics_snapshots')
    .select('*')
    .eq('id', snapshotId)
    .eq('user_id', input.userId)
    .maybeSingle()

  if (!snapshot) {
    analyticsContextCache.set(snapshotId, null)
    return null
  }

  const csvUploadIds = Array.isArray(snapshot.csv_upload_ids) ? snapshot.csv_upload_ids : []
  const { data: csvUploads } = csvUploadIds.length > 0
    ? await input.supabase
        .from('csv_uploads')
        .select('upload_type, parsed_data')
        .eq('user_id', input.userId)
        .in('id', csvUploadIds)
    : { data: [] }

  const csvData: CsvDataMap = {}
  for (const upload of csvUploads || []) {
    const rows = Array.isArray(upload.parsed_data) ? upload.parsed_data as Record<string, unknown>[] : []
    if (rows.length > 0) {
      csvData[upload.upload_type] = rows
    }
  }

  const csvSummary = buildCsvSummary(csvData)
  const compactFacts = buildCompactFacts(snapshot as AnalyticsSnapshot, csvSummary)
  const context: AnalyticsContext = {
    snapshot: snapshot as AnalyticsSnapshot,
    csvData,
    csvSummary,
    compactFacts,
    promptContext: compactFacts.join('\n'),
  }

  analyticsContextCache.set(snapshotId, context)
  return context
}

export function buildAnalyticsSnapshotName(date = new Date()) {
  return `Analytics Snapshot - ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
}

export function buildRateCardName(input: { niche: string | null; createdAt?: string | Date }) {
  const date = input.createdAt ? new Date(input.createdAt) : new Date()
  const dateLabel = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  if (input.niche?.trim()) {
    return `${input.niche.trim()} Rate Card - ${dateLabel}`
  }

  return `Rate Card - ${dateLabel}`
}
