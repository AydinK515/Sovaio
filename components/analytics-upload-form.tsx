'use client'

import Image from 'next/image'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Papa from 'papaparse'
import { strFromU8, unzipSync } from 'fflate'
import { createClient } from '@/lib/supabase-browser'
import { buildAnalyticsSnapshotName } from '@/lib/analytics-context'
import { captureAnalyticsEvent } from '@/lib/posthog-client'
import { POSTHOG_EVENTS } from '@/lib/posthog-events'
import { CSV_TYPES } from '@/lib/types'
import { BarChart3, CheckCircle2, Circle, ExternalLink, FileText, Info, Upload, X } from 'lucide-react'
import step1Image from '@/public/Step 1.jpg'
import step2Image from '@/public/step 2.jpg'
import step3Image from '@/public/Step 3.jpg'
import step4Image from '@/public/Step 4.jpg'

interface ParsedFile {
  type: string
  data: Record<string, unknown>[]
  rowCount: number
  fileName: string
  quality: number
}

const TUTORIAL_STEPS = [
  {
    id: 'step-1',
    label: 'Step 1',
    title: 'Open YouTube Studio Analytics',
    description: 'From the left sidebar in YouTube Studio, click Analytics.',
    image: step1Image,
    alt: 'YouTube Studio sidebar highlighting the Analytics menu item.',
  },
  {
    id: 'step-2',
    label: 'Step 2',
    title: 'Switch to Advanced mode',
    description: 'Use the Advanced mode button in the top-right so you can export the detailed report tables.',
    image: step2Image,
    alt: 'YouTube Studio Analytics page highlighting the Advanced mode button.',
  },
  {
    id: 'step-3',
    label: 'Step 3',
    title: 'Open the report picker',
    description: 'Click the Report dropdown to choose which analytics table you want to export.',
    image: step3Image,
    alt: 'YouTube Studio advanced analytics view highlighting the report dropdown.',
  },
  {
    id: 'step-4',
    label: 'Step 4',
    title: 'Download the right CSVs',
    description: 'Select each report from the dropdown and download it one-by-one as CSV. You can also upload the full zipped export bundle here.',
    image: step4Image,
    alt: 'YouTube Studio report list and download button highlighting which CSVs to export.',
  },
] as const

export default function AnalyticsUploadForm() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const [parsedFiles, setParsedFiles] = useState<ParsedFile[]>([])
  const [snapshotName, setSnapshotName] = useState(buildAnalyticsSnapshotName())
  const [subscriberCount, setSubscriberCount] = useState('')
  const [dragActive, setDragActive] = useState(false)
  const [activeTutorialStep, setActiveTutorialStep] = useState(0)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [submitAttempted, setSubmitAttempted] = useState(false)

  const confidence = (() => {
    let score = 0
    const types = parsedFiles.map(file => file.type)
    if (types.includes('content')) score += 35
    if (types.includes('geography')) score += 30
    if (types.includes('demographics')) score += 20
    if (types.includes('audience_growth')) score += 10
    if (types.includes('traffic_sources')) score += 5
    return score
  })()

  const hasRequiredTypes = ['content', 'geography'].every(type => parsedFiles.some(file => file.type === type))
  const missingRequired = (['content', 'geography'] as const).filter(type => !parsedFiles.some(file => file.type === type))
  const confidenceLabel = confidence < 40 ? 'Low' : confidence < 70 ? 'Medium' : 'High'
  const confidenceColor = confidence < 40 ? 'text-primary' : confidence < 70 ? 'text-warning' : 'text-success'
  const barColor = confidence < 40 ? 'bg-primary' : confidence < 70 ? 'bg-warning' : 'bg-success'
  const missingRequiredFields = [
    !snapshotName.trim() ? 'Snapshot name' : null,
    ...missingRequired.map(type => CSV_TYPES.find(item => item.key === type)?.label ?? type),
  ].filter((value): value is string => Boolean(value))
  const canSaveSnapshot = missingRequiredFields.length === 0
  const showFieldErrors = submitAttempted

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
    const hasViews = h.some(x => x === 'views' || x.includes('views'))
    const hasWatchTime = h.some(x => x.includes('watch time'))
    const hasSubscribers = h.some(x => x.includes('subscribers'))
    const hasDate = h.includes('date')
    const hasCountry = h.some(x => x.includes('country') || x.includes('geography'))
    const hasAge = h.some(x => x.includes('age'))
    const hasGender = h.some(x => x.includes('gender'))
    const hasTrafficSource = h.some(x => x.includes('traffic source') || x.includes('source type'))
    const hasRetention = h.some(x => x.includes('retention') || x.includes('average percentage viewed') || x.includes('average view duration'))
    const hasMonthlyAudience = h.some(x => x.includes('monthly audience'))
    const has28DayViewers = h.some(x => x.includes('28-day') && (x.includes('viewer') || x.includes('new') || x.includes('casual') || x.includes('regular')))
    const isSubscriberTimeline = hasDate && hasSubscribers && !hasVideoTitle && !hasContentId && !hasViews && !hasWatchTime && h.length <= 2

    if (hasMonthlyAudience || has28DayViewers || isSubscriberTimeline) return 'audience_growth'
    if ((lowerFileName.includes('totals') || lowerFileName.includes('chart data')) && hasDate && hasViews && !hasVideoTitle) return null
    if (hasAge || hasGender) return 'demographics'
    if (hasCountry) return 'geography'
    if (hasTrafficSource) return 'traffic_sources'
    if (hasRetention) return 'retention'
    if ((hasVideoTitle || hasContentId) && (hasViews || hasWatchTime || hasSubscribers)) return 'content'
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
    if (h.some(x => x.includes('country') || x.includes('geography'))) score += 50
    if (h.some(x => x.includes('28-day') && x.includes('new'))) score += 200
    if (h.some(x => x === 'subscribers') && h.includes('date')) score += 100

    return score
  }

  function normalizeRows(rows: Record<string, unknown>[]) {
    return rows.filter((row) => {
      const values = Object.values(row).filter(value => value !== null && value !== undefined && String(value).trim() !== '')
      if (values.length === 0) return false

      const content = String(row['Content'] ?? '').trim().toLowerCase()
      const title = String(row['Video title'] ?? '').trim().toLowerCase()
      return content !== 'total' && title !== 'total'
    })
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

    const normalizedData = normalizeRows(results.data)
    if (normalizedData.length === 0) return null

    return {
      type,
      data: normalizedData,
      rowCount: normalizedData.length,
      fileName,
      quality: getQualityScore(headers, fileName, normalizedData.length),
    }
  }

  async function extractZipCandidates(file: File) {
    const archive = unzipSync(new Uint8Array(await file.arrayBuffer()))
    const parsed: ParsedFile[] = []

    for (const [entryName, bytes] of Object.entries(archive)) {
      if (!entryName.toLowerCase().endsWith('.csv')) continue

      const text = strFromU8(bytes)
      const candidate = parseCsvText(`${file.name} > ${entryName}`, text)
      if (candidate) parsed.push(candidate)
    }

    return parsed
  }

  async function handleFiles(files: FileList | File[]) {
    setError('')
    const fileArray = Array.from(files).filter(file => {
      const lower = file.name.toLowerCase()
      return lower.endsWith('.csv') || lower.endsWith('.zip')
    })

    if (fileArray.length === 0) {
      captureAnalyticsEvent(POSTHOG_EVENTS.analyticsUploadValidationFailed, {
        reason: 'unsupported_file_type',
      })
      setError('Please upload YouTube CSV files or exported .zip bundles.')
      return
    }

    captureAnalyticsEvent(POSTHOG_EVENTS.analyticsUploadStarted, {
      file_count: fileArray.length,
      includes_zip: fileArray.some(file => file.name.toLowerCase().endsWith('.zip')),
    })

    try {
      const extracted = await Promise.all(fileArray.map(async (file) => {
        if (file.name.toLowerCase().endsWith('.zip')) {
          return extractZipCandidates(file)
        }

        const text = await file.text()
        const candidate = parseCsvText(file.name, text)
        return candidate ? [candidate] : []
      }))

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
          if (candidate.data.length === 0) continue
          const lastRow = candidate.data[candidate.data.length - 1]
          const subs = lastRow['Subscribers']
          if (subs !== undefined && subs !== null && subs !== '') {
            const count = parseInt(String(subs).replace(/[, ]/g, ''))
            if (!isNaN(count) && count > 100) return count.toLocaleString()
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
    }
  }

  function removeFile(type: string) {
    setParsedFiles(prev => prev.filter(file => file.type !== type))
  }

  async function handleCreateSnapshot() {
    setSubmitAttempted(true)

    if (!snapshotName.trim()) {
      setError('Snapshot name is required before you can save an analytics snapshot.')
      return
    }

    if (!hasRequiredTypes) {
      const labels = missingRequired.map(type => CSV_TYPES.find(item => item.key === type)?.label).join(' and ')
      setError(`"${labels}" ${missingRequired.length === 1 ? 'is' : 'are'} required before you can save an analytics snapshot.`)
      return
    }

    setSaving(true)
    setError('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const uploadIds: string[] = []
      for (const file of parsedFiles) {
        const { data, error } = await supabase.from('csv_uploads').insert({
          user_id: user.id,
          upload_type: file.type,
          parsed_data: file.data,
          row_count: file.rowCount,
        }).select('id').single()

        if (error) throw error
        uploadIds.push(data.id)
      }

      const nextSnapshotName = snapshotName.trim() || buildAnalyticsSnapshotName()
      const snapshotSubscriberCount = subscriberCount ? parseInt(subscriberCount.replace(/,/g, '')) : null
      const reportTypes = parsedFiles.map(file => file.type)

      const { data: snapshot, error: snapshotError } = await supabase
        .from('analytics_snapshots')
        .insert({
          user_id: user.id,
          name: nextSnapshotName,
          csv_upload_ids: uploadIds,
          report_confidence: confidence,
          subscriber_count: snapshotSubscriberCount,
          report_types: reportTypes,
        })
        .select('id')
        .single()

      if (snapshotError) throw snapshotError

      if (snapshotSubscriberCount) {
        await supabase.from('profiles').update({
          subscriber_count: snapshotSubscriberCount,
        }).eq('id', user.id)
      }

      captureAnalyticsEvent(POSTHOG_EVENTS.analyticsSnapshotCreated, {
        user_id: user.id,
        analytics_snapshot_id: snapshot.id,
        report_confidence: confidence,
        subscriber_count: snapshotSubscriberCount,
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

  return (
    <div className="py-8">
      <h1 className="text-3xl md:text-4xl font-bold">Upload Your Analytics</h1>
      <p className="mt-2 text-muted">This is the first step. Once you save an analytics snapshot, you can generate rate cards and power both AI assistants with real channel context.</p>

      <div className="mt-8 rounded-[28px] border border-border bg-white p-5 shadow-sm md:p-6">
        <p className="text-xs font-mono uppercase tracking-[0.18em] text-muted">Tutorial</p>
        <h2 className="mt-2 text-2xl font-semibold">How to get the right YouTube Studio files</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          Follow these four steps in YouTube Studio, then upload the CSVs here. The required reports are <span className="font-medium text-foreground">Content</span> and <span className="font-medium text-foreground">Geography</span>.
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          {TUTORIAL_STEPS.map((step, index) => (
            <button
              key={step.id}
              type="button"
              onClick={() => setActiveTutorialStep(index)}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${index === activeTutorialStep ? 'border-primary bg-primary text-white' : 'border-border bg-white text-muted hover:text-foreground'}`}
            >
              {step.label}
            </button>
          ))}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_320px] lg:items-start">
          <div className="overflow-hidden rounded-[24px] border border-border bg-slate-950/95">
            <Image
              src={TUTORIAL_STEPS[activeTutorialStep].image}
              alt={TUTORIAL_STEPS[activeTutorialStep].alt}
              className="h-auto w-full"
              priority={activeTutorialStep === 0}
            />
          </div>

          <div className="rounded-[24px] border border-border bg-slate-50 p-5">
            <p className="text-xs font-mono uppercase tracking-[0.18em] text-muted">{TUTORIAL_STEPS[activeTutorialStep].label}</p>
            <h3 className="mt-3 text-xl font-semibold">{TUTORIAL_STEPS[activeTutorialStep].title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted">{TUTORIAL_STEPS[activeTutorialStep].description}</p>
            <a
              href="https://studio.youtube.com/channel/UC/analytics"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-secondary px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-secondary-hover"
            >
              Open YouTube Studio
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="space-y-8">
          <div
            onDragOver={(event) => { event.preventDefault(); setDragActive(true) }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(event) => {
              event.preventDefault()
              setDragActive(false)
              void handleFiles(event.dataTransfer.files)
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer rounded-2xl border-2 border-dashed p-12 text-center transition-colors ${dragActive ? 'border-primary bg-primary-light' : 'border-border bg-white hover:border-primary/30'}`}
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
            <p className="text-lg font-semibold">Drop your YouTube Studio exports here</p>
            <p className="mt-2 text-sm text-muted">Upload raw CSVs or the zipped exports YouTube gives you. We&apos;ll unpack the right tables automatically.</p>
            <button type="button" className="mt-4 rounded-xl bg-secondary px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-secondary-hover">
              Click to browse files
            </button>
          </div>

          {parsedFiles.length > 0 && (
            <div className="space-y-3">
              {parsedFiles.map(file => (
                <div key={file.type} className="flex items-center justify-between rounded-xl border border-border bg-white px-4 py-3">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm font-medium">{CSV_TYPES.find(item => item.key === file.type)?.label || file.type}</p>
                      <p className="text-xs text-muted">{file.fileName} · {file.rowCount} rows</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => removeFile(file.type)} className="p-1 text-muted hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

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
                className={`w-full rounded-xl border bg-white px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 ${showFieldErrors && !snapshotName.trim() ? 'border-primary' : 'border-border'}`}
              />
              {showFieldErrors && !snapshotName.trim() && (
                <p className="mt-2 text-sm text-primary">Give this analytics snapshot a name before saving it.</p>
              )}
            </div>
            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted">Subscriber Count</label>
              <input
                type="text"
                value={subscriberCount}
                onChange={event => setSubscriberCount(event.target.value)}
                placeholder="e.g. 500,000"
                className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          {error && <p className="rounded-lg bg-primary-light px-4 py-2 text-sm text-primary">{error}</p>}
          {!canSaveSnapshot && (
            <div className="rounded-xl border border-border bg-white px-4 py-3 text-sm text-muted">
              Fill the required fields to continue: {missingRequiredFields.join(', ')}.
            </div>
          )}

          <div className="flex items-center gap-3 rounded-xl border border-border bg-muted-light p-4">
            <Info className="h-5 w-5 shrink-0 text-muted" />
            <p className="text-xs text-muted">We never send raw CSV blobs to the model. We derive compact metrics and summaries from these files and use that context across the app.</p>
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

        <div className="space-y-6">
          <div className="rounded-2xl border border-border bg-white p-6">
            <div className="mb-4 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Snapshot Confidence</h3>
            </div>
            <p className="mb-4 text-xs text-muted">Upload more reports to improve the snapshot quality before you generate a rate card or start a deal.</p>
            <div className="mb-3 h-3 w-full overflow-hidden rounded-full bg-border">
              <div className={`${barColor} h-3 rounded-full transition-all duration-500`} style={{ width: `${confidence}%` }} />
            </div>
            <div className="flex justify-between text-xs">
              <span className={`font-medium ${confidenceColor}`}>{confidenceLabel}</span>
              <span className="text-muted">{confidence}%</span>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-white p-6">
            <h3 className="mb-1 font-semibold">Data Sources</h3>
            <p className="mb-4 text-xs text-muted">Required reports must be uploaded before you can save a usable snapshot.</p>
            <div className="space-y-3">
              {CSV_TYPES.map(csvType => {
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
                          <span className={`text-sm ${uploaded ? 'font-medium text-foreground' : 'text-muted'}`}>{csvType.label}</span>
                          {csvType.required ? (
                            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">Required</span>
                          ) : (
                            <span className="rounded bg-muted-light px-1.5 py-0.5 text-[10px] font-medium text-muted">+{csvType.confidence}%</span>
                          )}
                        </div>
                        <p className="mt-0.5 text-[11px] leading-snug text-muted">{csvType.description}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
