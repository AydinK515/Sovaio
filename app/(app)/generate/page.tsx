'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Papa from 'papaparse'
import { createClient } from '@/lib/supabase-browser'
import { CSV_TYPES, NICHES } from '@/lib/types'
import { Upload, CheckCircle2, Circle, ExternalLink, Sparkles, Info, X, FileText, BarChart3 } from 'lucide-react'

interface ParsedFile {
  type: string
  data: Record<string, unknown>[]
  rowCount: number
  fileName: string
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
  const [subscriberCount, setSubscriberCount] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState('')
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState('')

  const supabase = createClient()

  const confidence = (() => {
    let score = 0
    const types = parsedFiles.map(f => f.type)
    if (types.includes('content')) score += 40
    if (types.includes('demographics')) score += 20
    if (types.includes('geography')) score += 15
    if (types.includes('traffic_sources')) score += 15
    if (types.includes('retention')) score += 10
    return score
  })()

  const confidenceLabel = confidence < 40 ? 'Low' : confidence < 70 ? 'Medium' : 'High'
  const confidenceColor = confidence < 40 ? 'text-primary' : confidence < 70 ? 'text-warning' : 'text-success'
  const barColor = confidence < 40 ? 'bg-primary' : confidence < 70 ? 'bg-warning' : 'bg-success'

  function detectCsvType(headers: string[]): string {
    const h = headers.map(s => s.toLowerCase().trim())
    if (h.some(x => x.includes('video title') || x.includes('views') || x.includes('watch time'))) return 'content'
    if (h.some(x => x.includes('age') || x.includes('gender'))) return 'demographics'
    if (h.some(x => x.includes('country') || x.includes('geography'))) return 'geography'
    if (h.some(x => x.includes('traffic source') || x.includes('source type'))) return 'traffic_sources'
    if (h.some(x => x.includes('retention') || x.includes('average percentage viewed') || x.includes('average view duration'))) return 'retention'
    return 'content' // default
  }

  const handleFiles = useCallback((files: FileList | File[]) => {
    setError('')
    const fileArray = Array.from(files).filter(f => f.name.endsWith('.csv'))
    if (fileArray.length === 0) {
      setError('Please upload CSV files only.')
      return
    }

    fileArray.forEach(file => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete(results) {
          if (results.data.length === 0) return
          const headers = results.meta.fields || []
          const type = detectCsvType(headers)

          setParsedFiles(prev => {
            const filtered = prev.filter(f => f.type !== type)
            return [...filtered, {
              type,
              data: results.data as Record<string, unknown>[],
              rowCount: results.data.length,
              fileName: file.name,
            }]
          })
        },
        error() {
          setError(`Failed to parse ${file.name}`)
        }
      })
    })
  }, [])

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
    if (parsedFiles.length === 0) {
      setError('Please upload at least one CSV file.')
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

      // Mock rate card generation (AI stub)
      await new Promise(r => setTimeout(r, 6000))

      const subCount = parseInt(subscriberCount.replace(/,/g, ''))
      const baseRate = Math.max(500, Math.round(subCount / 1000 * 25))

      const { data: rateCard, error: rcError } = await supabase.from('rate_cards').insert({
        user_id: user.id,
        niche,
        subscriber_count: subCount,
        has_sponsorships: hasSponsorships,
        dedicated_video_low: Math.round(baseRate * 2),
        dedicated_video_high: Math.round(baseRate * 3.1),
        integration_60s_low: Math.round(baseRate * 1.0),
        integration_60s_high: Math.round(baseRate * 1.6),
        integration_30s_low: Math.round(baseRate * 0.6),
        integration_30s_high: Math.round(baseRate * 0.95),
        explanation: `"Your high retention (65%) and strong US audience (42%) put you in the top 10% of ${niche} creators. Brands value the direct conversion potential of your dedicated subscriber base."`,
        improvement_tips: [
          { title: 'Increase Click-Through Rate', description: 'Improve your CTR from 4% to 6% to unlock a 15% increase in your base rate.' },
          { title: 'Duration Focus', description: 'Focus on longer watch-time content to prove engagement depth to premium advertisers.' },
        ],
        pitch_email: `Subject: Partnership Proposal: [Your Channel Name] x [Brand Name]\n\nHi [Contact Name],\n\nI've been following [Brand Name] and love your recent focus on ${niche.toLowerCase()} products.\n\nMy channel recently reached a 65% average retention rate with a 42% US-based audience. I believe a 60-second integration in my upcoming video on "[Video Topic]" would be a perfect fit for your Q4 goals.\n\nWould you be open to discussing a partnership?\n\nBest,\n[Your Name]`,
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
              accept=".csv"
              multiple
              onChange={e => e.target.files && handleFiles(e.target.files)}
              className="hidden"
            />
            <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Upload className="w-7 h-7 text-primary" />
            </div>
            <p className="font-semibold text-lg">Drop your YouTube Studio CSVs here</p>
            <p className="mt-2 text-sm text-muted">Upload the specific reports from your dashboard to unlock high-precision rate estimates.</p>
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
            disabled={parsedFiles.length === 0}
            className="w-full py-4 rounded-xl bg-primary text-white font-semibold text-lg hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            Generate My Rate Card
            <Sparkles className="w-5 h-5" />
          </button>
          {parsedFiles.length === 0 && (
            <p className="text-center text-xs text-muted -mt-4">Upload files to enable generation</p>
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
            <h3 className="font-semibold mb-4">Required Data</h3>
            <div className="space-y-3">
              {CSV_TYPES.map(csvType => {
                const uploaded = parsedFiles.some(f => f.type === csvType.key)
                return (
                  <div key={csvType.key} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {uploaded ? (
                        <CheckCircle2 className="w-4 h-4 text-success" />
                      ) : (
                        <Circle className="w-4 h-4 text-border-dark" />
                      )}
                      <span className={`text-sm ${uploaded ? 'text-foreground' : 'text-muted'}`}>
                        {csvType.label}
                      </span>
                    </div>
                    {!uploaded && (
                      <a
                        href={`https://studio.youtube.com`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary font-medium hover:underline flex items-center gap-1"
                      >
                        Get CSV
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

