'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Papa from 'papaparse'
import { strFromU8, unzipSync } from 'fflate'
import { createClient } from '@/lib/supabase-browser'
import { CSV_TYPES, NICHES } from '@/lib/types'
import { Upload, CheckCircle2, Circle, ExternalLink, Sparkles, Info, X, FileText, BarChart3 } from 'lucide-react'

interface ParsedFile {
  type: string
  data: Record<string, unknown>[]
  rowCount: number
  fileName: string
  quality: number
}

const LOADING_MESSAGES = [
  'Analyzing your audience demographics...',
  'Calculating niche benchmarks...',
  'Reviewing your top content performance...',
  'Evaluating audience retention patterns...',
  'Comparing traffic source quality...',
  'Generating price range models...',
  'Crafting your pitch email template...',
  'Finalizing your rate card...',
]

export default function GeneratePage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [parsedFiles, setParsedFiles] = useState<ParsedFile[]>([])
  const [niche, setNiche] = useState('')
  const [hasSponsorships, setHasSponsorships] = useState<boolean | null>(null)
  const [sponsorshipCount, setSponsorshipCount] = useState('')
  const [avgDealAmount, setAvgDealAmount] = useState('')
  const [subscriberCount, setSubscriberCount] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState('')
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState('')

  const supabase = createClient()

  const confidence = (() => {
    let score = 0
    const types = parsedFiles.map(f => f.type)
    if (types.includes('content')) score += 35
    if (types.includes('audience_growth')) score += 25
    if (types.includes('demographics')) score += 20
    if (types.includes('geography')) score += 10
    if (types.includes('traffic_sources')) score += 10
    return score
  })()

  const hasRequiredTypes = ['content', 'audience_growth'].every(t => parsedFiles.some(f => f.type === t))
  const missingRequired = (['content', 'audience_growth'] as const).filter(t => !parsedFiles.some(f => f.type === t))

  const confidenceLabel = confidence < 40 ? 'Low' : confidence < 70 ? 'Medium' : 'High'
  const confidenceColor = confidence < 40 ? 'text-primary' : confidence < 70 ? 'text-warning' : 'text-success'
  const barColor = confidence < 40 ? 'bg-primary' : confidence < 70 ? 'bg-warning' : 'bg-success'

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

    // Audience size & growth report types
    const hasMonthlyAudience = h.some(x => x.includes('monthly audience'))
    const has28DayViewers = h.some(x => x.includes('28-day') && (x.includes('viewer') || x.includes('new') || x.includes('casual') || x.includes('regular')))
    // Subscribers.csv: exactly 2 columns (Date + Subscribers), no video-level data
    const isSubscriberTimeline = hasDate && hasSubscribers && !hasVideoTitle && !hasContentId && !hasViews && !hasWatchTime && h.length <= 2

    if (hasMonthlyAudience || has28DayViewers || isSubscriberTimeline) return 'audience_growth'

    if ((lowerFileName.includes('totals') || lowerFileName.includes('chart data')) && hasDate && hasViews && !hasVideoTitle) {
      return null
    }

    if (hasAge || hasGender) return 'demographics'
    if (hasCountry) return 'geography'
    if (hasTrafficSource) return 'traffic_sources'
    if (hasRetention) return 'retention'

    if ((hasVideoTitle || hasContentId) && (hasViews || hasWatchTime || hasSubscribers)) return 'content'
    if (h.some(x => x.includes('age') || x.includes('gender'))) return 'demographics'
    if (h.some(x => x.includes('country') || x.includes('geography'))) return 'geography'
    if (h.some(x => x.includes('traffic source') || x.includes('source type'))) return 'traffic_sources'
    if (h.some(x => x.includes('retention') || x.includes('average percentage viewed') || x.includes('average view duration'))) return 'retention'

    return null
  }

  function getQualityScore(headers: string[], fileName: string, rowCount: number): number {
    const h = headers.map(s => s.toLowerCase().trim())
    const lowerFileName = fileName.toLowerCase()
    let score = rowCount + h.length * 5

    if (lowerFileName.includes('table data')) score += 500
    if (lowerFileName.includes('chart data')) score -= 250
    if (lowerFileName.includes('totals')) score -= 500
    if (h.some(x => x.includes('video title'))) score += 100
    if (h.some(x => x.includes('watch time'))) score += 50
    if (h.some(x => x.includes('country') || x.includes('geography'))) score += 50
    // Viewer loyalty data (new/casual/regular split) is the richest audience_growth signal
    if (h.some(x => x.includes('28-day') && x.includes('new'))) score += 200
    // Subscriber timeline is useful for growth rate
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
    const fileArray = Array.from(files).filter(f => {
      const lower = f.name.toLowerCase()
      return lower.endsWith('.csv') || lower.endsWith('.zip')
    })

    if (fileArray.length === 0) {
      setError('Please upload YouTube CSV files or exported .zip bundles.')
      return
    }

    try {
      const extracted = await Promise.all(fileArray.map(async (file) => {
        const lower = file.name.toLowerCase()
        if (lower.endsWith('.zip')) {
          return extractZipCandidates(file)
        }

        const text = await file.text()
        const candidate = parseCsvText(file.name, text)
        return candidate ? [candidate] : []
      }))

      const candidates = extracted.flat()
      if (candidates.length === 0) {
        setError('No supported YouTube report tables were found in those files.')
        return
      }

      // Auto-fill subscriber count from any candidate that has a Subscribers column
      // (picks up Subscribers.csv from the Audience size & growth zip)
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
      setError('One of the uploaded files could not be unpacked or parsed.')
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragActive(false)
    handleFiles(e.dataTransfer.files)
  }

  function removeFile(type: string) {
    setParsedFiles(prev => prev.filter(f => f.type !== type))
  }

  async function handleGenerate() {
    if (!niche || hasSponsorships === null || !subscriberCount) {
      setError('Please fill in all required fields.')
      return
    }
    if (hasSponsorships && (!sponsorshipCount || !avgDealAmount)) {
      setError('Please fill in your sponsorship history details.')
      return
    }
    if (parsedFiles.length === 0) {
      setError('Please upload at least one CSV file.')
      return
    }
    if (missingRequired.length > 0) {
      const labels = missingRequired.map(t => CSV_TYPES.find(c => c.key === t)?.label).join(' and ')
      setError(`"${labels}" ${missingRequired.length === 1 ? 'is' : 'are'} required to generate a rate card. Download ${missingRequired.length === 1 ? 'it' : 'them'} from YouTube Studio and upload the zip.`)
      return
    }

    setLoading(true)
    setError('')

    // Rotate loading messages
    let msgIndex = 0
    setLoadingMessage(LOADING_MESSAGES[0])
    const interval = setInterval(() => {
      msgIndex = (msgIndex + 1) % LOADING_MESSAGES.length
      setLoadingMessage(LOADING_MESSAGES[msgIndex])
    }, 2500)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Store parsed CSV data
      const uploadIds: string[] = []
      for (const pf of parsedFiles) {
        const { data, error } = await supabase.from('csv_uploads').insert({
          user_id: user.id,
          upload_type: pf.type,
          parsed_data: pf.data,
          row_count: pf.rowCount,
        }).select('id').single()
        if (error) throw error
        uploadIds.push(data.id)
      }

      const subCount = parseInt(subscriberCount.replace(/,/g, ''))

      // Build a keyed map of CSV data for the AI
      const csvData: Record<string, Record<string, unknown>[]> = {}
      for (const pf of parsedFiles) {
        csvData[pf.type] = pf.data
      }

      // Call AI to generate rate card
      const aiResponse = await fetch('/api/generate-rate-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          niche,
          subscriberCount: subCount,
          hasSponsorships,
          sponsorshipCount: sponsorshipCount ? parseInt(sponsorshipCount.replace(/,/g, '')) : null,
          avgDealAmount: avgDealAmount ? parseInt(avgDealAmount.replace(/[$,]/g, '')) : null,
          csvData,
          confidence,
        }),
      })

      if (!aiResponse.ok) {
        const err = await aiResponse.text()
        throw new Error(`AI generation failed: ${err}`)
      }

      const aiRates = await aiResponse.json()

      const { data: rateCard, error: rcError } = await supabase.from('rate_cards').insert({
        user_id: user.id,
        niche,
        subscriber_count: subCount,
        has_sponsorships: hasSponsorships,
        sponsorship_count: hasSponsorships && sponsorshipCount ? parseInt(sponsorshipCount.replace(/,/g, '')) : null,
        avg_deal_amount: hasSponsorships && avgDealAmount ? parseInt(avgDealAmount.replace(/[$,]/g, '')) : null,
        dedicated_video_low: aiRates.dedicated_video_low,
        dedicated_video_high: aiRates.dedicated_video_high,
        integration_60s_low: aiRates.integration_60s_low,
        integration_60s_high: aiRates.integration_60s_high,
        integration_30s_low: aiRates.integration_30s_low,
        integration_30s_high: aiRates.integration_30s_high,
        explanation: aiRates.explanation,
        improvement_tips: aiRates.improvement_tips,
        pitch_email: aiRates.pitch_email,
        report_confidence: confidence,
        csv_upload_ids: uploadIds,
      }).select('id').single()

      if (rcError) throw rcError

      clearInterval(interval)

      // Update profile
      await supabase.from('profiles').update({
        niche,
        subscriber_count: subCount,
        has_sponsorships: hasSponsorships,
        generations_used: (await supabase.from('rate_cards').select('id').eq('user_id', user.id)).data?.length || 1,
      }).eq('id', user.id)

      router.push(`/rate-card/${rateCard.id}`)
    } catch (err: unknown) {
      clearInterval(interval)
      setLoading(false)
      setError(err instanceof Error ? err.message : 'Something went wrong')
    }
  }

  // Full-page loading state
  if (loading) {
    return (
      <div className="fixed inset-0 bg-white z-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-8">
            <Sparkles className="w-10 h-10 text-primary animate-pulse" />
          </div>
          <h2 className="text-2xl font-bold mb-4">Generating Your Rate Card</h2>
          <p className="text-muted mb-8 animate-fade-in" key={loadingMessage}>{loadingMessage}</p>
          <div className="w-full bg-border rounded-full h-2 overflow-hidden">
            <div className="bg-primary h-2 rounded-full animate-pulse" style={{ width: '60%' }} />
          </div>
          <p className="mt-4 text-xs text-muted">This usually takes about 10 seconds</p>
        </div>
      </div>
    )
  }

  return (
    <div className="py-8">
      <h1 className="text-3xl md:text-4xl font-bold">Upload Your Insights</h1>
      <p className="mt-2 text-muted">Connect your YouTube Studio data to generate a verified rate card powered by AI.</p>

      <div className="mt-8 grid lg:grid-cols-[1fr_340px] gap-8">
        {/* Main column */}
        <div className="space-y-8">
          {/* Dropzone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragActive(true) }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-colors ${
              dragActive ? 'border-primary bg-primary-light' : 'border-border hover:border-primary/30 bg-white'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.zip"
              multiple
              onChange={e => e.target.files && handleFiles(e.target.files)}
              className="hidden"
            />
            <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Upload className="w-7 h-7 text-primary" />
            </div>
            <p className="font-semibold text-lg">Drop your YouTube Studio exports here</p>
            <p className="mt-2 text-sm text-muted">Upload raw CSVs or the zipped exports YouTube gives you. We&apos;ll unpack the right table automatically.</p>
            <button className="mt-4 px-6 py-2.5 bg-secondary text-white text-sm font-medium rounded-xl hover:bg-secondary-hover transition-colors">
              Click to browse files
            </button>
          </div>

          {/* Uploaded files */}
          {parsedFiles.length > 0 && (
            <div className="space-y-3">
              {parsedFiles.map(pf => (
                <div key={pf.type} className="flex items-center justify-between bg-white rounded-xl border border-border px-4 py-3">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-primary" />
                    <div>
                      <p className="text-sm font-medium">{CSV_TYPES.find(t => t.key === pf.type)?.label || pf.type}</p>
                      <p className="text-xs text-muted">{pf.fileName} &middot; {pf.rowCount} rows</p>
                    </div>
                  </div>
                  <button onClick={() => removeFile(pf.type)} className="text-muted hover:text-foreground p-1">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Form fields */}
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted uppercase tracking-wider mb-2">Niche Category</label>
              <select
                value={niche}
                onChange={e => setNiche(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="">Select niche</option>
                {NICHES.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted uppercase tracking-wider mb-2">Sponsorship History</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setHasSponsorships(true)}
                  className={`flex-1 py-3 rounded-xl border text-sm font-medium transition-colors ${
                    hasSponsorships === true ? 'border-primary bg-primary-light text-primary' : 'border-border hover:bg-muted-light'
                  }`}
                >
                  Yes
                </button>
                <button
                  onClick={() => setHasSponsorships(false)}
                  className={`flex-1 py-3 rounded-xl border text-sm font-medium transition-colors ${
                    hasSponsorships === false ? 'border-primary bg-primary-light text-primary' : 'border-border hover:bg-muted-light'
                  }`}
                >
                  No
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted uppercase tracking-wider mb-2">Subscriber Count</label>
              <input
                type="text"
                value={subscriberCount}
                onChange={e => setSubscriberCount(e.target.value)}
                placeholder="e.g. 500,000"
                className="w-full px-4 py-3 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
          </div>

          {hasSponsorships === true && (
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted uppercase tracking-wider mb-2">How Many Sponsorships?</label>
                <input
                  type="text"
                  value={sponsorshipCount}
                  onChange={e => setSponsorshipCount(e.target.value)}
                  placeholder="e.g. 10"
                  className="w-full px-4 py-3 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted uppercase tracking-wider mb-2">Average Deal Amount (USD)</label>
                <input
                  type="text"
                  value={avgDealAmount}
                  onChange={e => setAvgDealAmount(e.target.value)}
                  placeholder="e.g. $2,000"
                  className="w-full px-4 py-3 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
            </div>
          )}

          {error && <p className="text-sm text-primary bg-primary-light rounded-lg px-4 py-2">{error}</p>}

          {/* Privacy notice */}
          <div className="flex items-start gap-3 bg-muted-light rounded-xl p-4 border border-border">
            <Info className="w-5 h-5 text-muted shrink-0 mt-0.5" />
            <p className="text-xs text-muted">
              We never store your raw CSV data. Our AI extracts metrics and discards the files immediately.
            </p>
          </div>

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={!hasRequiredTypes}
            className="w-full py-4 rounded-xl bg-primary text-white font-semibold text-lg hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            Generate My Rate Card
            <Sparkles className="w-5 h-5" />
          </button>
          {!hasRequiredTypes && (
            <p className="text-center text-xs text-muted -mt-4">
              {parsedFiles.length === 0
                ? 'Upload files to enable generation'
                : `Still need: ${missingRequired.map(t => CSV_TYPES.find(c => c.key === t)?.label).join(' and ')}`}
            </p>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Confidence Meter */}
          <div className="bg-white rounded-2xl border border-border p-6">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">Report Confidence</h3>
            </div>
            <div className="w-full bg-border rounded-full h-3 overflow-hidden mb-3">
              <div className={`${barColor} h-3 rounded-full transition-all duration-500`} style={{ width: `${confidence}%` }} />
            </div>
            <div className="flex justify-between text-xs">
              <span className={`font-medium ${confidenceColor}`}>{confidenceLabel}</span>
              <span className="text-muted">{confidence}%</span>
            </div>
          </div>

          {/* Required Data */}
          <div className="bg-white rounded-2xl border border-border p-6">
            <h3 className="font-semibold mb-1">Data Sources</h3>
            <p className="text-xs text-muted mb-4">Required reports must be uploaded to generate</p>
            <div className="space-y-3">
              {CSV_TYPES.map(csvType => {
                const uploaded = parsedFiles.some(f => f.type === csvType.key)
                return (
                  <div key={csvType.key} className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0">
                      {uploaded ? (
                        <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" />
                      ) : (
                        <Circle className="w-4 h-4 text-border-dark shrink-0 mt-0.5" />
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-sm ${uploaded ? 'text-foreground font-medium' : 'text-muted'}`}>
                            {csvType.label}
                          </span>
                          {csvType.required ? (
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-primary bg-primary/10 px-1.5 py-0.5 rounded">Required</span>
                          ) : (
                            <span className="text-[10px] font-medium text-muted bg-muted-light px-1.5 py-0.5 rounded">+{csvType.confidence}%</span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted mt-0.5 leading-snug">{csvType.description}</p>
                      </div>
                    </div>
                    {!uploaded && (
                      <a
                        href="https://studio.youtube.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary font-medium hover:underline flex items-center gap-1 shrink-0"
                      >
                        Get
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
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
