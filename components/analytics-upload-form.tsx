'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Papa from 'papaparse'
import { strFromU8, unzip } from 'fflate'
import OnboardingRouteBanner from '@/components/onboarding-route-banner'
import { useOnboarding } from '@/components/onboarding-provider'
import { createClient } from '@/lib/supabase-browser'
import { buildAnalyticsSnapshotName } from '@/lib/analytics-context'
import { captureAnalyticsEvent } from '@/lib/posthog-client'
import { POSTHOG_EVENTS } from '@/lib/posthog-events'
import { CSV_TYPES } from '@/lib/types'
import {
  BarChart3,
  CheckCircle2,
  ChevronDown,
  Circle,
  ExternalLink,
  FileText,
  Info,
  Lock,
  Upload,
  X,
} from 'lucide-react'

interface ParsedFile {
  type: string
  data: Record<string, unknown>[]
  rowCount: number
  fileName: string
  quality: number
  subscriberCount?: number
}

const MAX_UPLOAD_FILE_SIZE_BYTES = 20 * 1024 * 1024
const MAX_PARSED_ROWS_PER_UPLOAD = 5_000
const MAX_ZIP_UNCOMPRESSED_BYTES = 100 * 1024 * 1024

// ─── URL helpers ─────────────────────────────────────────────────────────────

function extractChannelId(url: string): string | null {
  const match = url.match(/\/channel\/(UC[A-Za-z0-9_-]+)/)
  return match ? match[1] : null
}

const REPORT_BASE_URLS = {
  content:
    'https://studio.youtube.com/channel/CHANNEL_ID/analytics/tab-overview/period-default/explore?entity_type=CHANNEL&entity_id=CHANNEL_ID&time_period=TIME_PERIOD&explore_type=TABLE_AND_CHART&metric=AVERAGE_WATCH_TIME&granularity=DAY&t_metrics=AVERAGE_WATCH_TIME&t_metrics=EXTERNAL_VIEWS&t_metrics=EXTERNAL_WATCH_TIME&t_metrics=SUBSCRIBERS_NET_CHANGE&t_metrics=TOTAL_ESTIMATED_EARNINGS&t_metrics=VIDEO_THUMBNAIL_IMPRESSIONS&t_metrics=VIDEO_THUMBNAIL_IMPRESSIONS_VTR&dimension=VIDEO&o_column=EXTERNAL_WATCH_TIME&o_direction=ANALYTICS_ORDER_DIRECTION_DESC',
  geography:
    'https://studio.youtube.com/channel/CHANNEL_ID/analytics/tab-overview/period-default/explore?entity_type=CHANNEL&entity_id=CHANNEL_ID&time_period=TIME_PERIOD&explore_type=TABLE_AND_CHART&metric=SUBSCRIBERS_NET_CHANGE&granularity=DAY&t_metrics=SUBSCRIBERS_NET_CHANGE&t_metrics=EXTERNAL_VIEWS&t_metrics=EXTERNAL_WATCH_TIME&t_metrics=AVERAGE_WATCH_TIME&dimension=COUNTRY&o_column=EXTERNAL_WATCH_TIME&o_direction=ANALYTICS_ORDER_DIRECTION_DESC',
  age:
    'https://studio.youtube.com/channel/CHANNEL_ID/analytics/tab-overview/period-default/explore?entity_type=CHANNEL&entity_id=CHANNEL_ID&time_period=TIME_PERIOD&explore_type=TABLE_AND_CHART&metric=EXTERNAL_VIEWS&granularity=DAY&t_metrics=EXTERNAL_VIEWS&t_metrics=AVERAGE_WATCH_TIME&t_metrics=AVERAGE_WATCH_PERCENTAGE&t_metrics=EXTERNAL_WATCH_TIME&dimension=VIEWER_AGE&o_column=EXTERNAL_WATCH_TIME&o_direction=ANALYTICS_ORDER_DIRECTION_DESC',
  gender:
    'https://studio.youtube.com/channel/CHANNEL_ID/analytics/tab-overview/period-default/explore?entity_type=CHANNEL&entity_id=CHANNEL_ID&time_period=TIME_PERIOD&explore_type=TABLE_AND_CHART&metric=EXTERNAL_VIEWS&granularity=DAY&t_metrics=EXTERNAL_VIEWS&t_metrics=AVERAGE_WATCH_TIME&t_metrics=AVERAGE_WATCH_PERCENTAGE&t_metrics=EXTERNAL_WATCH_TIME&dimension=VIEWER_GENDER&o_column=VIEWER_GENDER&o_direction=ANALYTICS_ORDER_DIRECTION_ASC',
} as const

type ReportKey = keyof typeof REPORT_BASE_URLS

function getLocalStartOfDayTimestamp(date: Date) {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy.getTime()
}

function buildCustomTimePeriod(daysBack: number) {
  const safeDaysBack = Math.max(1, Math.floor(daysBack))
  const end = new Date()
  const start = new Date(end)
  start.setDate(start.getDate() - safeDaysBack)

  return `${getLocalStartOfDayTimestamp(start)},${getLocalStartOfDayTimestamp(end)}`
}

function generateReportUrl(
  channelId: string,
  timePeriod: string,
  includeShorts: boolean,
  reportKey: ReportKey,
): string {
  let url = REPORT_BASE_URLS[reportKey]
    .replace(/CHANNEL_ID/g, channelId)
    .replace('TIME_PERIOD', timePeriod)
  if (!includeShorts) {
    url += '&ur_dimensions=CREATOR_CONTENT_TYPE&ur_values=%27VIDEO_ON_DEMAND%27'
  }
  return url
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SNAPSHOT_RANGES = [
  { label: 'Last 28 days', value: '4_weeks' },
  { label: 'Last 90 days', value: 'quarter' },
  { label: 'Last 365 days', value: 'year' },
  { label: 'Lifetime', value: 'lifetime' },
  { label: 'Custom', value: 'custom' },
] as const

type SnapshotRangeValue = (typeof SNAPSHOT_RANGES)[number]['value']

const REQUIRED_REPORTS: { key: ReportKey; label: string; description: string; required: boolean }[] = [
  { key: 'content', label: 'Content Breakdown', description: 'Average watch time, views, and revenue per video', required: true },
  { key: 'geography', label: 'Audience Geography', description: 'Country breakdown of your viewers', required: true },
  { key: 'age', label: 'Audience Age', description: 'Age distribution for demographic context', required: false },
  { key: 'gender', label: 'Audience Gender', description: 'Gender breakdown', required: false },
]

// ─── Component ────────────────────────────────────────────────────────────────

export default function AnalyticsUploadForm() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()
  const { completeStep } = useOnboarding()

  // Upload state
  const [parsedFiles, setParsedFiles] = useState<ParsedFile[]>([])
  const [snapshotName, setSnapshotName] = useState(buildAnalyticsSnapshotName())
  const [subscriberCount, setSubscriberCount] = useState('')
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [submitAttempted, setSubmitAttempted] = useState(false)

  // Setup flow state
  const [studioUrl, setStudioUrl] = useState('')
  const [channelId, setChannelId] = useState<string | null>(null)
  const [channelIdError, setChannelIdError] = useState('')
  const [includeShorts, setIncludeShorts] = useState(false)
  const [snapshotRange, setSnapshotRange] = useState<SnapshotRangeValue>('4_weeks')
  const [customDaysBack, setCustomDaysBack] = useState(30)
  const [customDaysDraft, setCustomDaysDraft] = useState('30')
  const [customRangeError, setCustomRangeError] = useState('')
  const [showCustomRangeModal, setShowCustomRangeModal] = useState(false)
  const [showUrlPopover, setShowUrlPopover] = useState(false)
  const urlPopoverRef = useRef<HTMLDivElement>(null)

  const resolvedTimePeriod =
    snapshotRange === 'custom' ? buildCustomTimePeriod(customDaysBack) : snapshotRange

  useEffect(() => {
    if (!showUrlPopover) return
    function handleClickOutside(event: MouseEvent) {
      if (urlPopoverRef.current && !urlPopoverRef.current.contains(event.target as Node)) {
        setShowUrlPopover(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showUrlPopover])

  useEffect(() => {
    if (!showCustomRangeModal) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closeCustomRangeModal()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [showCustomRangeModal])

  function handleStudioUrlChange(url: string) {
    setStudioUrl(url)
    if (!url.trim()) {
      setChannelId(null)
      setChannelIdError('')
      return
    }
    // Accept a bare channel ID as well as a full Studio URL
    const bareId = url.trim().match(/^(UC[A-Za-z0-9_-]+)$/)
    if (bareId) {
      setChannelId(bareId[1])
      setChannelIdError('')
      return
    }
    const id = extractChannelId(url)
    if (id) {
      setChannelId(id)
      setChannelIdError('')
    } else {
      setChannelId(null)
      setChannelIdError(
        'No channel ID found. Paste the full URL from your browser while on the YouTube Studio Analytics page.',
      )
    }
  }

  // ─── Confidence ────────────────────────────────────────────────────────────

  const confidence = (() => {
    let score = 0
    const types = parsedFiles.map(file => file.type)
    if (types.includes('content')) score += 40
    if (types.includes('geography')) score += 35
    if (types.includes('age')) score += 15
    if (types.includes('gender')) score += 10
    return score
  })()

  const hasRequiredTypes = ['content', 'geography'].every(type =>
    parsedFiles.some(file => file.type === type),
  )
  const missingRequired = (['content', 'geography'] as const).filter(
    type => !parsedFiles.some(file => file.type === type),
  )
  const confidenceLabel = confidence < 40 ? 'Low' : confidence < 70 ? 'Medium' : 'High'
  const confidenceColor =
    confidence < 40 ? 'text-primary' : confidence < 70 ? 'text-warning' : 'text-success'
  const barColor =
    confidence < 40 ? 'bg-primary' : confidence < 70 ? 'bg-warning' : 'bg-success'
  const missingRequiredFields = [
    !snapshotName.trim() ? 'Snapshot name' : null,
    ...missingRequired.map(type => CSV_TYPES.find(item => item.key === type)?.label ?? type),
  ].filter((value): value is string => Boolean(value))
  const canSaveSnapshot = missingRequiredFields.length === 0
  const showFieldErrors = submitAttempted

  // ─── Render helpers ────────────────────────────────────────────────────────

  function renderDataSourcesList(badgeClassName: string) {
    return CSV_TYPES.map(csvType => {
      const uploaded = parsedFiles.some(file => file.type === csvType.key)
      return (
        <div key={csvType.key} className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-2">
            {uploaded ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            ) : (
              <Circle className="mt-0.5 h-4 w-4 shrink-0 text-border-dark" />
            )}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={`text-sm ${uploaded ? 'font-medium text-foreground' : 'text-muted'}`}
                >
                  {csvType.label}
                </span>
                {csvType.required ? (
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                    Required
                  </span>
                ) : (
                  <span className={badgeClassName}>+{csvType.confidence}%</span>
                )}
              </div>
              <p className="mt-0.5 text-[11px] leading-snug text-muted">{csvType.description}</p>
            </div>
          </div>
        </div>
      )
    })
  }

  function renderSnapshotConfidenceCard(className: string) {
    return (
      <div className={className}>
        <div className="mb-4 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Snapshot Confidence</h3>
        </div>
        <p className="mb-4 text-xs text-muted">
          Upload more reports to improve the snapshot quality before you generate a rate card or
          start a deal.
        </p>
        <div className="mb-3 h-3 w-full overflow-hidden rounded-full bg-border">
          <div
            className={`${barColor} h-3 rounded-full transition-all duration-500`}
            style={{ width: `${confidence}%` }}
          />
        </div>
        <div className="flex justify-between text-xs">
          <span className={`font-medium ${confidenceColor}`}>{confidenceLabel}</span>
          <span className="text-muted">{confidence}%</span>
        </div>

        <details className="group mt-5 rounded-xl border border-border bg-slate-50 p-4 md:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Data Sources</p>
              <p className="mt-1 text-xs text-muted">
                See which reports are included in this snapshot.
              </p>
            </div>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-4 space-y-3">
            {renderDataSourcesList('rounded bg-white px-1.5 py-0.5 text-[10px] font-medium text-muted')}
          </div>
        </details>
      </div>
    )
  }

  // ─── Analytics + CSV parsing ───────────────────────────────────────────────

  useEffect(() => {
    captureAnalyticsEvent(POSTHOG_EVENTS.onboardingStepViewed, {
      step_id: 'upload_analytics',
      route: '/analytics/new',
    })
  }, [])

  function RequiredMark() {
    return (
      <span aria-hidden="true" className="ml-1 text-primary">
        *
      </span>
    )
  }

  function detectCsvType(headers: string[], fileName: string): string | null {
    const h = headers.map(s => s.toLowerCase().trim())
    const lowerFileName = fileName.toLowerCase()

    const hasVideoTitle = h.some(x => x.includes('video title'))
    const hasContentId = h.includes('content')
    const hasViews = h.some(x => x === 'views' || x === 'views (%)')
    const hasWatchTime = h.some(x => x.includes('watch time'))
    const hasSubscribers = h.some(x => x.includes('subscribers'))
    const hasGeography = h.some(x => x === 'geography' || x.includes('country'))
    // Use specific "viewer age" / "viewer gender" to avoid false matches on
    // columns like "average percentage viewed (%)" which contains "age"
    const hasViewerAge = h.some(x => x.includes('viewer age'))
    const hasViewerGender = h.some(x => x.includes('viewer gender'))

    // Skip chart/totals rollup files that aren't the detailed table export
    if (
      (lowerFileName.includes('totals') || lowerFileName.includes('chart data')) &&
      !hasVideoTitle
    )
      return null

    if (hasViewerGender) return 'gender'
    if (hasViewerAge) return 'age'
    if (hasGeography) return 'geography'
    if ((hasVideoTitle || hasContentId) && (hasViews || hasWatchTime || hasSubscribers))
      return 'content'

    return null
  }

  function getQualityScore(headers: string[], fileName: string, rowCount: number) {
    const h = headers.map(s => s.toLowerCase().trim())
    const lowerFileName = fileName.toLowerCase()
    let score = rowCount + h.length * 5

    if (lowerFileName.includes('table data')) score += 500
    if (lowerFileName.includes('chart data')) score -= 250
    if (lowerFileName.includes('totals')) score -= 500
    if (h.some(x => x.includes('video title'))) score += 100
    if (h.some(x => x.includes('watch time'))) score += 50
    if (h.some(x => x.includes('geography') || x.includes('country'))) score += 50
    if (h.some(x => x.includes('viewer age'))) score += 75
    if (h.some(x => x.includes('viewer gender'))) score += 50

    return score
  }

  function normalizeRows(rows: Record<string, unknown>[]) {
    return rows.filter(row => {
      const values = Object.values(row).filter(
        value => value !== null && value !== undefined && String(value).trim() !== '',
      )
      if (values.length === 0) return false

      // Filter out summary/total rows across all report types
      const content = String(row['Content'] ?? '').trim().toLowerCase()
      const title = String(row['Video title'] ?? '').trim().toLowerCase()
      const geography = String(row['Geography'] ?? '').trim().toLowerCase()
      return content !== 'total' && title !== 'total' && geography !== 'total'
    })
  }

  function extractSubscriberCountFromTotalRow(rows: Record<string, unknown>[]): number | undefined {
    // The Total summary row appears at the top of Content and Geography exports.
    // Content: row where Content === 'Total' → Subscribers column = cumulative total
    // Geography: row where Geography === 'Total' → Subscribers column = cumulative total
    for (const row of rows) {
      const isContentTotal = String(row['Content'] ?? '').trim().toLowerCase() === 'total'
      const isGeographyTotal = String(row['Geography'] ?? '').trim().toLowerCase() === 'total'
      if (isContentTotal || isGeographyTotal) {
        const raw = row['Subscribers']
        if (raw !== undefined && raw !== null && raw !== '') {
          const count = parseInt(String(raw).replace(/[, ]/g, ''))
          if (!isNaN(count) && count > 0) return count
        }
      }
    }
    return undefined
  }

  function parseCsvText(fileName: string, text: string): ParsedFile | null {
    const results = Papa.parse<Record<string, unknown>>(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: header => header.trim(),
    })

    const headers = results.meta.fields || []
    const type = detectCsvType(headers, fileName)
    if (!type) return null

    // Extract subscriber count from the Total row before filtering it out
    const subscriberCount = extractSubscriberCountFromTotalRow(results.data)

    const normalizedData = normalizeRows(results.data)
    if (normalizedData.length === 0) return null
    const storedData = normalizedData.slice(0, MAX_PARSED_ROWS_PER_UPLOAD)

    return {
      type,
      data: storedData,
      rowCount: storedData.length,
      fileName,
      quality: getQualityScore(headers, fileName, normalizedData.length),
      subscriberCount,
    }
  }

  async function extractZipCandidates(file: File) {
    const bytes = new Uint8Array(await file.arrayBuffer())
    const archive = await new Promise<Record<string, Uint8Array>>((resolve, reject) => {
      unzip(bytes, (error, unzipped) => {
        if (error || !unzipped) {
          reject(error ?? new Error('Failed to unzip archive.'))
          return
        }
        resolve(unzipped)
      })
    })
    const totalUncompressedBytes = Object.values(archive).reduce(
      (sum, entry) => sum + entry.byteLength,
      0,
    )

    if (totalUncompressedBytes > MAX_ZIP_UNCOMPRESSED_BYTES) {
      throw new Error('Archive expands beyond the allowed limit.')
    }

    const parsed: ParsedFile[] = []

    for (const [entryName, entryBytes] of Object.entries(archive)) {
      const lowerEntry = entryName.toLowerCase()
      if (!lowerEntry.endsWith('.csv')) continue
      // Chart data files are enormous time-series blobs (up to 120k+ rows) with
      // no pricing value — drop them before decoding bytes
      if (lowerEntry.includes('chart data')) continue
      const text = strFromU8(entryBytes)
      const candidate = parseCsvText(`${file.name} > ${entryName}`, text)
      if (candidate) parsed.push(candidate)
    }

    return parsed
  }

  async function handleFiles(files: FileList | File[]) {
    setError('')
    const fileArray = Array.from(files).filter(file => {
      const lower = file.name.toLowerCase()
      if (!lower.endsWith('.csv') && !lower.endsWith('.zip')) return false
      // Drop directly-uploaded chart data files the same way we drop them from zips
      if (lower.includes('chart data')) return false
      return true
    })

    if (fileArray.length === 0) {
      captureAnalyticsEvent(POSTHOG_EVENTS.analyticsUploadValidationFailed, {
        reason: 'unsupported_file_type',
      })
      setError('Please upload YouTube CSV files or exported .zip bundles.')
      return
    }

    const oversizedFile = fileArray.find(file => file.size > MAX_UPLOAD_FILE_SIZE_BYTES)
    if (oversizedFile) {
      captureAnalyticsEvent(POSTHOG_EVENTS.analyticsUploadValidationFailed, {
        reason: 'file_too_large',
        file_name: oversizedFile.name,
      })
      setError('Files must be 20 MB or smaller.')
      return
    }

    captureAnalyticsEvent(POSTHOG_EVENTS.analyticsUploadStarted, {
      file_count: fileArray.length,
      includes_zip: fileArray.some(file => file.name.toLowerCase().endsWith('.zip')),
    })

    try {
      const extracted = await Promise.all(
        fileArray.map(async file => {
          if (file.name.toLowerCase().endsWith('.zip')) {
            return extractZipCandidates(file)
          }
          const text = await file.text()
          const candidate = parseCsvText(file.name, text)
          return candidate ? [candidate] : []
        }),
      )

      const candidates = extracted.flat()
      if (candidates.length === 0) {
        captureAnalyticsEvent(POSTHOG_EVENTS.analyticsUploadValidationFailed, {
          reason: 'no_supported_reports_found',
        })
        setError('No supported YouTube report tables were found in those files.')
        return
      }

      setSubscriberCount(prev => {
        if (prev) return prev
        for (const candidate of candidates) {
          if (candidate.subscriberCount && candidate.subscriberCount > 0) {
            return candidate.subscriberCount.toLocaleString()
          }
        }
        return prev
      })

      setParsedFiles(prev => {
        const bestByType = new Map(prev.map(file => [file.type, file]))
        for (const candidate of candidates) {
          const existing = bestByType.get(candidate.type)
          if (!existing || candidate.quality >= existing.quality) {
            bestByType.set(candidate.type, candidate)
          }
        }
        return Array.from(bestByType.values())
      })
    } catch {
      captureAnalyticsEvent(POSTHOG_EVENTS.analyticsUploadValidationFailed, {
        reason: 'parse_failed',
      })
      setError('One of the uploaded files could not be unpacked or parsed.')
    } finally {
      // Allow re-selecting the same file after a removal or failed upload attempt.
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  function openCustomRangeModal() {
    setCustomDaysDraft(String(customDaysBack))
    setCustomRangeError('')
    setShowCustomRangeModal(true)
  }

  function closeCustomRangeModal() {
    setShowCustomRangeModal(false)
    setCustomRangeError('')
  }

  function saveCustomRange() {
    const parsed = Number.parseInt(customDaysDraft.trim(), 10)

    if (!Number.isFinite(parsed) || parsed < 1) {
      setCustomRangeError('Enter a whole number of days greater than 0.')
      return
    }

    setCustomDaysBack(parsed)
    setSnapshotRange('custom')
    setShowCustomRangeModal(false)
    setCustomRangeError('')
  }

  function removeFile(type: string) {
    setParsedFiles(prev => prev.filter(file => file.type !== type))
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  async function handleCreateSnapshot() {
    setSubmitAttempted(true)

    if (!snapshotName.trim()) {
      setError('Snapshot name is required before you can save an analytics snapshot.')
      return
    }

    if (!hasRequiredTypes) {
      const labels = missingRequired
        .map(type => CSV_TYPES.find(item => item.key === type)?.label)
        .join(' and ')
      setError(
        `"${labels}" ${missingRequired.length === 1 ? 'is' : 'are'} required before you can save an analytics snapshot.`,
      )
      return
    }

    setSaving(true)
    setError('')

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const uploadIds: string[] = []
      for (const file of parsedFiles) {
        const { data, error } = await supabase
          .from('csv_uploads')
          .insert({
            user_id: user.id,
            upload_type: file.type,
            parsed_data: file.data,
            row_count: file.rowCount,
          })
          .select('id')
          .single()

        if (error) throw error
        uploadIds.push(data.id)
      }

      const nextSnapshotName = snapshotName.trim() || buildAnalyticsSnapshotName()
      const snapshotSubscriberCount = subscriberCount
        ? parseInt(subscriberCount.replace(/,/g, ''))
        : null
      const reportTypes = parsedFiles.map(file => file.type)
      const persistedSnapshotRange =
        snapshotRange === 'custom' ? `custom:${customDaysBack}` : snapshotRange

      const { data: snapshot, error: snapshotError } = await supabase
        .from('analytics_snapshots')
        .insert({
          user_id: user.id,
          name: nextSnapshotName,
          csv_upload_ids: uploadIds,
          report_confidence: confidence,
          subscriber_count: snapshotSubscriberCount,
          include_shorts: includeShorts,
          snapshot_range: persistedSnapshotRange,
          report_types: reportTypes,
        })
        .select('id')
        .single()

      if (snapshotError) throw snapshotError

      if (snapshotSubscriberCount) {
        await supabase
          .from('profiles')
          .update({ subscriber_count: snapshotSubscriberCount })
          .eq('id', user.id)
      }

      captureAnalyticsEvent(POSTHOG_EVENTS.analyticsSnapshotCreated, {
        user_id: user.id,
        analytics_snapshot_id: snapshot.id,
        report_confidence: confidence,
        subscriber_count: snapshotSubscriberCount,
        include_shorts: includeShorts,
        snapshot_range: persistedSnapshotRange,
      })
      await completeStep('upload_analytics', {
        snapshot_id: snapshot.id,
        report_confidence: confidence,
      })

      router.push(`/analytics/${snapshot.id}`)
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setSaving(false)
      return
    }

    setSaving(false)
  }

  // ─── JSX ──────────────────────────────────────────────────────────────────

  return (
    <div className="py-8">
      <h1 className="text-3xl font-bold md:text-4xl">Upload Your Analytics</h1>
      <p className="mt-2 text-muted">
        Once you save an analytics snapshot, you can generate rate cards and power both AI
        assistants with real channel context.
      </p>

      <div className="mt-8">
        <OnboardingRouteBanner
          bannerKey="analytics-upload-basics"
          eyebrow="Before you upload"
          title="Save one snapshot, then reuse it everywhere"
          description="Once you upload your analytics, we'll save it as a snapshot. You can then use it to generate rate cards, prep deals, and power our AI assistants with channel-specific context."
        />
      </div>

      {/* ── Setup card ──────────────────────────────────────────────────────── */}
      <div className="mt-8 rounded-[28px] border border-border bg-white p-5 shadow-sm md:p-6">
        <p className="text-xs font-mono uppercase tracking-[0.18em] text-muted">Setup</p>
        <h2 className="mt-2 text-2xl font-semibold">Set up your YouTube Studio export</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Complete the steps below, then upload your files. This is where you upload your YouTube
          analytics so Sovaio knows how to price your channel.
        </p>

        {/* ── Section 1: Paste URL ──────────────────────────────────────────── */}
        <div className="mt-8">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-white">
              1
            </span>
            <h3 className="font-semibold">Paste your YouTube Studio URL</h3>
            {channelId && (
              <span className="flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Channel found
              </span>
            )}
            {/* Why popover */}
            <div ref={urlPopoverRef} className="relative">
              <button
                type="button"
                onClick={() => setShowUrlPopover(v => !v)}
                className="flex items-center gap-1 text-xs text-muted transition-colors hover:text-foreground"
              >
                <ChevronDown className={`h-3 w-3 transition-transform ${showUrlPopover ? 'rotate-180' : ''}`} />
                Why do I need this?
              </button>
              {showUrlPopover && (
                <div className="absolute right-0 top-full z-50 mt-2 w-[min(18rem,calc(100vw-2rem))] rounded-xl border border-border bg-white p-4 shadow-lg md:left-0 md:right-auto md:w-72">
                  <p className="mb-2 text-xs font-semibold text-foreground">Why we need your Studio URL</p>
                  <p className="text-xs leading-relaxed text-muted">
                    Your URL contains your <span className="font-medium text-foreground">channel ID</span> — a unique code like <span className="font-mono text-foreground">UCad0x…</span>. We use it to build direct links to the exact report pages in your Studio so you don&apos;t have to navigate there manually.
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-muted">
                    We don&apos;t use it to access your channel or make any requests on your behalf. The URL is parsed locally in your browser — nothing is sent anywhere.
                  </p>
                </div>
              )}
            </div>
          </div>
          <p className="mt-2 text-sm text-muted md:ml-9">
            <a
              href="https://studio.youtube.com/channel/UC"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-foreground hover:text-primary transition-colors"
            >
              Open YouTube Studio
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            {' '}and copy the URL from your browser&apos;s address bar.
          </p>

          {/* Browser bar mockup */}
          <div className="mt-4 hidden overflow-hidden rounded-xl border border-border bg-slate-50 md:ml-9 md:block">
            <div className="flex items-center gap-2 border-b border-border bg-slate-100 px-3 py-2">
              <div className="flex gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                <div className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                <div className="h-2.5 w-2.5 rounded-full bg-slate-300" />
              </div>
              <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md border border-border bg-white px-2.5 py-1">
                <Lock className="h-3 w-3 shrink-0 text-success" />
                <span className="truncate font-mono text-[11px] text-muted">
                  https://studio.youtube.com/channel/
                  <span className="font-semibold text-primary">UCad0xYHB_RLgRWGMPC5DCdw</span>
                </span>
              </div>
            </div>
          </div>

          <div className="mt-3 md:ml-9">
            <input
              type="url"
              value={studioUrl}
              onChange={e => handleStudioUrlChange(e.target.value)}
              placeholder="https://studio.youtube.com/channel/UC..."
              className={`w-full rounded-xl border bg-white px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                channelIdError ? 'border-primary' : channelId ? 'border-success' : 'border-border'
              }`}
            />
            {channelIdError && (
              <p className="mt-2 text-sm text-primary">{channelIdError}</p>
            )}
            {channelId && (
              <p className="mt-2 text-sm text-success">
                Channel ID: <span className="font-mono font-medium">{channelId}</span>
              </p>
            )}
          </div>
        </div>

        <div className="mt-8 border-t border-border" />

        {/* ── Section 2: Snapshot settings ─────────────────────────────────── */}
        <div className="mt-8">
          <div className="flex items-center gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-white">
              2
            </span>
            <h3 className="font-semibold">Choose snapshot settings</h3>
          </div>
          <p className="mt-2 text-sm text-muted md:ml-9">
            These settings control what data you want us to include in this snapshot.
          </p>

          <div className="mt-5 space-y-6 md:ml-9">
            {/* Include Shorts toggle */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-foreground">Include YouTube Shorts</p>
                <p className="mt-0.5 text-xs text-muted">
                  Turn this off if you want your analytics to reflect long-form videos only. Most
                  sponsors care about non-Shorts views.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={includeShorts}
                onClick={() => setIncludeShorts(v => !v)}
                className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                  includeShorts ? 'bg-primary' : 'bg-border-dark'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                    includeShorts ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>

            {/* Snapshot range */}
            <div>
              <p className="text-sm font-medium text-foreground">Snapshot range</p>
              <p className="mt-0.5 text-xs text-muted">
                Select the Youtube analytics date range to use for this snapshot. Go further back if you post less often
                or want a fuller view of your channel.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {SNAPSHOT_RANGES.map(range => (
                  <button
                    key={range.value}
                    type="button"
                    onClick={() => {
                      if (range.value === 'custom') {
                        openCustomRangeModal()
                        return
                      }

                      setSnapshotRange(range.value)
                    }}
                    className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                      snapshotRange === range.value
                        ? 'border-primary bg-primary text-white'
                        : 'border-border bg-white text-muted hover:text-foreground'
                    }`}
                  >
                    {range.value === 'custom' && snapshotRange === 'custom'
                      ? `Custom (${customDaysBack} days)`
                      : range.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 border-t border-border" />

        {/* ── Section 3: Download reports ───────────────────────────────────── */}
        <div className="mt-8">
          <div className="flex items-center gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-white">
              3
            </span>
            <h3 className="font-semibold">Open and download required reports</h3>
          </div>
          <p className="mt-2 text-sm text-muted md:ml-9">
            Everything below is already set up for you. Just open each report, download the CSV,
            and upload the files in Step 4.
          </p>

          <div className="mt-5 md:ml-9">
            {!channelId ? (
              <div className="rounded-xl border border-dashed border-border bg-slate-50 px-5 py-6 text-center">
                <p className="text-sm text-muted">
                  Paste your YouTube Studio URL in Step 1 to generate your report links.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
                  <div className="space-y-3 min-w-0">
                    {REQUIRED_REPORTS.map(report => (
                      <div
                        key={report.key}
                        className="flex flex-col gap-4 rounded-xl border border-border bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-sm font-medium text-foreground">{report.label}</span>
                            {report.required ? (
                              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                                Required
                              </span>
                            ) : (
                              <span className="rounded bg-muted-light px-1.5 py-0.5 text-[10px] font-medium text-muted">
                                Optional
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-xs text-muted">{report.description}</p>
                        </div>
                        <a
                          href={generateReportUrl(channelId, resolvedTimePeriod, includeShorts, report.key)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 self-start rounded-xl bg-secondary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-secondary-hover sm:shrink-0"
                        >
                          Open
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    ))}
                  </div>

                  <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
                    <Image
                      src="/DownloadReport.jpg"
                      alt="YouTube Studio screenshot highlighting the Download CSV button"
                      width={2145}
                      height={1350}
                      className="h-full w-full object-cover"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 rounded-xl border border-border bg-muted-light px-4 py-3">
                  <Info className="h-4 w-4 shrink-0 text-muted" />
                  <p className="text-xs leading-relaxed text-muted">
                    Inside each report, click the{' '}
                    <span className="font-medium text-foreground">Download</span> button (top right)
                    and export as CSV. Come back here and upload all the files in the next step.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Section 4: Upload + save ─────────────────────────────────────────── */}
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="space-y-8">
          {/* Step label */}
          <div className="flex items-center gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-white">
              4
            </span>
            <h3 className="font-semibold">Upload your exported files</h3>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={event => {
              event.preventDefault()
              setDragActive(true)
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={event => {
              event.preventDefault()
              setDragActive(false)
              void handleFiles(event.dataTransfer.files)
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer rounded-2xl border-2 border-dashed p-12 text-center transition-colors ${
              dragActive
                ? 'border-primary bg-primary-light'
                : 'border-border bg-white hover:border-primary/30'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.zip"
              multiple
              onChange={event => event.target.files && void handleFiles(event.target.files)}
              className="hidden"
            />
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <Upload className="h-7 w-7 text-primary" />
            </div>
            <p className="text-lg font-semibold">Drop your downloaded reports here</p>
            <p className="mt-2 text-sm text-muted">
              Upload the CSVs you downloaded from the links above, or drop the full zipped export
              bundle. We&apos;ll detect the right tables automatically.
            </p>
            <button
              type="button"
              className="mt-4 rounded-xl bg-secondary px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-secondary-hover"
            >
              Click to browse files
            </button>
          </div>

          {/* Uploaded files list */}
          {parsedFiles.length > 0 && (
            <div className="space-y-3">
              {parsedFiles.map(file => (
                <div
                  key={file.type}
                  className="flex items-center justify-between rounded-xl border border-border bg-white px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm font-medium">
                        {CSV_TYPES.find(item => item.key === file.type)?.label || file.type}
                      </p>
                      <p className="text-xs text-muted">
                        {file.fileName} · {file.rowCount} rows
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(file.type)}
                    className="p-1 text-muted hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {renderSnapshotConfidenceCard('rounded-2xl border border-border bg-white p-6 md:hidden')}

          {/* Snapshot metadata */}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted">
                Snapshot Name
                <RequiredMark />
              </label>
              <input
                type="text"
                value={snapshotName}
                onChange={event => setSnapshotName(event.target.value)}
                className={`w-full rounded-xl border bg-white px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                  showFieldErrors && !snapshotName.trim() ? 'border-primary' : 'border-border'
                }`}
              />
              {showFieldErrors && !snapshotName.trim() && (
                <p className="mt-2 text-sm text-primary">
                  Give this analytics snapshot a name before saving it.
                </p>
              )}
            </div>
            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted">
                Subscriber Count
              </label>
              <input
                type="text"
                value={subscriberCount}
                onChange={event => setSubscriberCount(event.target.value)}
                placeholder="e.g. 500,000"
                className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          {error && (
            <p className="rounded-lg bg-primary-light px-4 py-2 text-sm text-primary">{error}</p>
          )}
          {!canSaveSnapshot && (
            <div className="rounded-xl border border-border bg-white px-4 py-3 text-sm text-muted">
              Fill the required fields to continue: {missingRequiredFields.join(', ')}.
            </div>
          )}

          <div className="flex items-center gap-3 rounded-xl border border-border bg-muted-light p-4">
            <Info className="h-5 w-5 shrink-0 text-muted" />
            <p className="text-xs text-muted">
              We never send raw CSV blobs to the model. We derive compact metrics and summaries from
              these files and use that context across the app.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void handleCreateSnapshot()}
            disabled={!canSaveSnapshot || saving}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-4 text-lg font-semibold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Saving Analytics Snapshot...' : 'Save Analytics Snapshot'}
          </button>

          {!canSaveSnapshot && (
            <p className="text-center text-xs text-muted">
              {parsedFiles.length === 0 && !snapshotName.trim()
                ? 'Name your snapshot and upload the required files to save it'
                : parsedFiles.length === 0
                  ? 'Upload files to save your first snapshot'
                  : !snapshotName.trim() && missingRequired.length === 0
                    ? 'Add a snapshot name to save this upload'
                    : `Still need: ${missingRequiredFields.join(' and ')}`}
            </p>
          )}
        </div>

        {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
        <div className="space-y-6">
          {renderSnapshotConfidenceCard(
            'hidden rounded-2xl border border-border bg-white p-6 md:block',
          )}

          <div className="hidden rounded-2xl border border-border bg-white p-6 md:block">
            <h3 className="mb-1 font-semibold">Data Sources</h3>
            <p className="mb-4 text-xs text-muted">
              Required reports must be uploaded before you can save a usable snapshot.
            </p>
            <div className="space-y-3">
              {renderDataSourcesList(
                'rounded bg-muted-light px-1.5 py-0.5 text-[10px] font-medium text-muted',
              )}
            </div>
          </div>
        </div>
      </div>

      {showCustomRangeModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4"
          onClick={closeCustomRangeModal}
        >
          <div
            className="w-full max-w-lg rounded-[28px] border border-border bg-white p-6 shadow-2xl animate-pop-in md:p-7"
            onClick={event => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="custom-range-modal-title"
          >
            <h3 id="custom-range-modal-title" className="text-2xl font-semibold text-foreground">
              Custom snapshot range
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              How many days back should this snapshot go to?
            </p>

            <label className="mt-5 block text-xs font-medium uppercase tracking-[0.18em] text-muted">
              Days Back
            </label>
            <input
              type="number"
              min="1"
              step="1"
              value={customDaysDraft}
              onChange={event => {
                setCustomDaysDraft(event.target.value)
                if (customRangeError) setCustomRangeError('')
              }}
              onKeyDown={event => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  saveCustomRange()
                }
              }}
              className="mt-2 w-full rounded-xl border border-border px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            {customRangeError && (
              <p className="mt-2 text-sm text-primary">{customRangeError}</p>
            )}

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeCustomRangeModal}
                className="rounded-xl border border-border px-4 py-3 text-sm font-medium transition-colors hover:bg-muted-light"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveCustomRange}
                className="rounded-xl bg-secondary px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-secondary-hover"
              >
                Use Custom Range
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

