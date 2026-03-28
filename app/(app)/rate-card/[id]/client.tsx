'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import type { RateCard } from '@/lib/types'
import { formatCurrency, getOpeningMessage } from '@/lib/deal-chat'
import { Copy, Check, Download, TrendingUp, Sparkles, FileText, ChevronDown, ImageIcon, FileDown } from 'lucide-react'

export default function RateCardClient({ rateCard }: { rateCard: RateCard }) {
  const router = useRouter()
  const exportRef = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)
  const [brandName, setBrandName] = useState('')
  const [showDealModal, setShowDealModal] = useState(false)
  const [showDownloadMenu, setShowDownloadMenu] = useState(false)
  const [dealType, setDealType] = useState<'dedicated_video' | 'integration_60s' | 'integration_30s'>('integration_60s')
  const [creatorAsk, setCreatorAsk] = useState('')
  const [creatingDeal, setCreatingDeal] = useState(false)
  const [downloadingFormat, setDownloadingFormat] = useState<'png' | 'pdf' | null>(null)

  const supabase = createClient()

  async function copyEmail() {
    await navigator.clipboard.writeText(rateCard.pitch_email || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function renderExportCanvas() {
    const html2canvas = (await import('html2canvas')).default

    const element = exportRef.current
    if (!element) return

    return html2canvas(element, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
    })
  }

  function downloadDataUrl(dataUrl: string, filename: string) {
    const link = document.createElement('a')
    link.href = dataUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  async function handleDownload(format: 'png' | 'pdf') {
    setShowDownloadMenu(false)
    setDownloadingFormat(format)

    try {
      const canvas = await renderExportCanvas()
      if (!canvas) return

      const imgData = canvas.toDataURL('image/png')

      if (format === 'png') {
        downloadDataUrl(imgData, `RateProof-RateCard-${new Date().toISOString().split('T')[0]}.png`)
        return
      }

      const jsPDF = (await import('jspdf')).default
      const pdf = new jsPDF('p', 'mm', 'a4')
      const pageWidth = 210
      const pageHeight = 297
      const margin = 10
      const usableWidth = pageWidth - margin * 2
      const imgHeight = (canvas.height * usableWidth) / canvas.width

      if (imgHeight <= pageHeight - margin * 2) {
        pdf.addImage(imgData, 'PNG', margin, margin, usableWidth, imgHeight)
      } else {
        const scaledPageHeight = ((pageHeight - margin * 2) * canvas.width) / usableWidth
        let currentOffset = 0
        let pageIndex = 0

        while (currentOffset < canvas.height) {
          const pageCanvas = document.createElement('canvas')
          pageCanvas.width = canvas.width
          pageCanvas.height = Math.min(scaledPageHeight, canvas.height - currentOffset)

          const context = pageCanvas.getContext('2d')
          if (!context) break

          context.fillStyle = '#ffffff'
          context.fillRect(0, 0, pageCanvas.width, pageCanvas.height)
          context.drawImage(
            canvas,
            0,
            currentOffset,
            canvas.width,
            pageCanvas.height,
            0,
            0,
            pageCanvas.width,
            pageCanvas.height,
          )

          if (pageIndex > 0) pdf.addPage()
          pdf.addImage(
            pageCanvas.toDataURL('image/png'),
            'PNG',
            margin,
            margin,
            usableWidth,
            (pageCanvas.height * usableWidth) / pageCanvas.width,
          )

          currentOffset += scaledPageHeight
          pageIndex += 1
        }
      }

      pdf.save(`RateProof-RateCard-${new Date().toISOString().split('T')[0]}.pdf`)
    } finally {
      setDownloadingFormat(null)
    }
  }

  async function createDeal() {
    if (!brandName.trim()) return
    setCreatingDeal(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setCreatingDeal(false)
      return
    }

    const askAmount = creatorAsk ? parseInt(creatorAsk.replace(/,/g, '')) : (() => {
      switch (dealType) {
        case 'dedicated_video': return rateCard.dedicated_video_low
        case 'integration_60s': return rateCard.integration_60s_low
        case 'integration_30s': return rateCard.integration_30s_low
      }
    })()

    const { data: deal, error } = await supabase.from('deals').insert({
      user_id: user.id,
      rate_card_id: rateCard.id,
      brand_name: brandName.trim(),
      deal_type: dealType,
      creator_ask: askAmount,
      status: 'negotiating',
    }).select('id').single()

    if (error) {
      setCreatingDeal(false)
      return
    }

    const { data: chat, error: chatError } = await supabase.from('deal_chats').insert({
      deal_id: deal.id,
      user_id: user.id,
      title: 'Chat 1',
    }).select('id').single()

    if (chatError || !chat) {
      setCreatingDeal(false)
      return
    }

    // Create initial AI message
    await supabase.from('deal_messages').insert({
      deal_id: deal.id,
      chat_id: chat.id,
      user_id: user.id,
      role: 'ai',
      content: getOpeningMessage({
        brand_name: brandName.trim(),
        creator_ask: askAmount!,
        deal_type: dealType,
      }),
    })

    router.push(`/deal/${deal.id}?chat=${chat.id}`)
  }

  const tips = rateCard.improvement_tips as { title: string; description: string }[] | null
  const exportAddOns = [
    { label: 'Organic usage rights', value: formatCurrency(Math.round(rateCard.integration_60s_low * 0.5)) },
    { label: 'Paid usage rights', value: formatCurrency(Math.round(rateCard.integration_60s_low * 1.25)) },
    { label: 'Whitelisting', value: formatCurrency(Math.round(rateCard.integration_30s_low * 0.75)) },
    { label: 'Exclusivity (30 days)', value: formatCurrency(Math.round(rateCard.dedicated_video_low * 0.35)) },
    { label: 'Rush fee', value: formatCurrency(Math.round(rateCard.integration_30s_low * 0.4)) },
    { label: 'Extra revision round', value: formatCurrency(Math.round(rateCard.integration_30s_low * 0.25)) },
  ]
  const exportBundles = [
    {
      label: 'Launch package',
      value: formatCurrency(Math.round(rateCard.dedicated_video_low + rateCard.integration_60s_low)),
      description: '1 dedicated video plus 1 integrated follow-up mention for campaign lift and recall.',
    },
    {
      label: 'Momentum package',
      value: formatCurrency(Math.round(rateCard.integration_60s_low * 2.6)),
      description: '3 integrated placements across a short run of uploads to build repetition.',
    },
  ]

  return (
    <div className="py-8">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed left-[-10000px] top-0 z-[-1] opacity-0"
      >
        <div
          ref={exportRef}
          style={{
            width: 1400,
            backgroundColor: '#ffffff',
            color: '#0f172a',
            padding: '56px',
            fontFamily: 'var(--font-geist-sans), system-ui, sans-serif',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '24px' }}>
            <div>
              <h1 style={{ margin: '0', fontSize: '72px', lineHeight: 0.95, fontWeight: 700, letterSpacing: '-0.04em', maxWidth: '760px' }}>
                Sponsorship
                <br />
                Rate Card
              </h1>
            </div>
          </div>

          <div style={{ marginTop: '24px', display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '16px' }}>
            {[
              { value: rateCard.subscriber_count ? rateCard.subscriber_count.toLocaleString() : 'N/A', label: 'Subscribers' },
              { value: rateCard.niche || 'General', label: 'Category' },
              { value: 'Brand integrations', label: 'Media Type' },
              { value: 'USD', label: 'Currency' },
            ].map((item) => (
              <div key={item.label} style={{ border: '1px solid #e2e8f0', borderRadius: '24px', padding: '20px 22px', backgroundColor: '#ffffff' }}>
                <div style={{ fontSize: '14px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {item.label}
                </div>
                <div style={{ marginTop: '10px', fontSize: '28px', fontWeight: 700, lineHeight: 1.2 }}>
                  {item.value}
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '38px', fontSize: '14px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.14em' }}>
            Core Rates
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '18px', marginTop: '16px' }}>
            {[
              {
                label: 'Dedicated Video',
                range: `${formatCurrency(rateCard.dedicated_video_low)} - ${formatCurrency(rateCard.dedicated_video_high)}`,
                note: 'Brand-led feature',
                accent: '#dc2626',
                description: 'Includes full-video integration, dedicated CTA, and sponsor-first positioning.',
              },
              {
                label: '60-Second Integration',
                range: `${formatCurrency(rateCard.integration_60s_low)} - ${formatCurrency(rateCard.integration_60s_high)}`,
                note: 'Mid-roll placement',
                accent: '#16a34a',
                description: 'Includes in-video talking points, natural script fit, and clickable callout.',
              },
              {
                label: '30-Second Integration',
                range: `${formatCurrency(rateCard.integration_30s_low)} - ${formatCurrency(rateCard.integration_30s_high)}`,
                note: 'Efficient awareness slot',
                accent: '#64748b',
                description: 'Best for lighter tests, launches, and repeat campaign exposure.',
              },
            ].map((tier) => (
              <div key={tier.label} style={{ border: '1px solid #e2e8f0', borderRadius: '28px', padding: '28px', backgroundColor: '#ffffff' }}>
                <div style={{ fontSize: '14px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{tier.label}</div>
                <div style={{ marginTop: '18px', fontSize: '46px', fontWeight: 700, lineHeight: 1.02, letterSpacing: '-0.05em', color: '#0f172a' }}>
                  {tier.range}
                </div>
                <div style={{ marginTop: '16px', fontSize: '15px', color: tier.accent, fontWeight: 600 }}>
                  {tier.note}
                </div>
                <div style={{ marginTop: '10px', fontSize: '16px', lineHeight: 1.55, color: '#64748b' }}>
                  {tier.description}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginTop: '24px' }}>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '30px', padding: '30px 32px', backgroundColor: '#f8fafc' }}>
              <div style={{ fontSize: '14px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Audience Snapshot</div>
              <div style={{ marginTop: '16px', fontSize: '18px', color: '#334155', lineHeight: 1.7 }}>
                Sponsor placements are priced for a {rateCard.niche || 'targeted'} audience with current channel momentum and creator-led integrations designed to feel native on-platform.
              </div>
              <div style={{ marginTop: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div style={{ borderRadius: '20px', backgroundColor: '#ffffff', padding: '18px 20px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '13px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Primary Deliverable</div>
                  <div style={{ marginTop: '8px', fontSize: '20px', fontWeight: 700 }}>YouTube Sponsorship</div>
                </div>
                <div style={{ borderRadius: '20px', backgroundColor: '#ffffff', padding: '18px 20px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '13px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Placement Style</div>
                  <div style={{ marginTop: '8px', fontSize: '20px', fontWeight: 700 }}>Host-Read</div>
                </div>
              </div>
            </div>

            <div style={{ borderRadius: '30px', padding: '30px 30px 32px', backgroundColor: '#0f172a', color: '#ffffff' }}>
              <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>What&apos;s Included</div>
              <div style={{ marginTop: '18px', fontSize: '18px', lineHeight: 1.8, color: 'rgba(255,255,255,0.92)' }}>
                <div>- Sponsored segment tailored to the video format</div>
                <div>- Brand mention plus spoken call-to-action</div>
                <div>- Link placement in the description when applicable</div>
                <div>- Creative alignment before final recording</div>
                <div>- Standard performance-friendly integration style</div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '28px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '28px', padding: '28px 30px', backgroundColor: '#ffffff' }}>
              <div style={{ fontSize: '14px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                Package Deals
              </div>
              <div style={{ marginTop: '18px' }}>
                {exportBundles.map((bundle) => (
                  <div key={bundle.label} style={{ marginTop: '18px', paddingTop: '18px', borderTop: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '18px', alignItems: 'baseline' }}>
                      <div style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a' }}>{bundle.label}</div>
                      <div style={{ fontSize: '26px', fontWeight: 700, color: '#dc2626' }}>{bundle.value}</div>
                    </div>
                    <div style={{ marginTop: '8px', fontSize: '17px', color: '#64748b', lineHeight: 1.6 }}>
                      {bundle.description}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ border: '1px solid #e2e8f0', borderRadius: '28px', padding: '28px 30px', backgroundColor: '#ffffff' }}>
              <div style={{ fontSize: '14px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                Add-Ons
              </div>
              <div style={{ marginTop: '18px' }}>
                {exportAddOns.map((item) => (
                  <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', padding: '14px 0', borderTop: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '18px', color: '#0f172a' }}>{item.label}</div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ marginTop: '26px', borderRadius: '28px', padding: '24px 28px', backgroundColor: '#fef2f2', border: '1px solid rgba(220, 38, 38, 0.12)' }}>
            <div style={{ fontSize: '14px', color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700 }}>
              Notes
            </div>
            <div style={{ marginTop: '12px', fontSize: '17px', color: '#64748b', lineHeight: 1.7 }}>
              - Rates are quoted in USD and reflect current channel positioning.
              <br />
              - Final campaign scope, revisions, usage, and timelines are confirmed in writing before production.
              <br />
              - Additional deliverables, extended licensing, or rush timelines are quoted separately.
            </div>
          </div>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3 text-sm">
        <Link href="/rate-card" className="text-primary font-medium hover:underline">
          All Rate Cards
        </Link>
        <span className="text-muted">/</span>
        <span className="text-muted">{new Date(rateCard.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
      </div>

      <div id="rate-card-content">
        <h1 className="text-3xl md:text-4xl font-bold">Your sponsorship rates are ready.</h1>
        <p className="mt-2 text-muted">
          Based on your latest channel performance, audience demographics, and current market demand for {rateCard.niche}.
        </p>

        {/* Rate Tiers */}
        <div className="mt-8 grid sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-border p-6">
            <p className="text-xs font-mono text-muted uppercase">Tier 01</p>
            <h3 className="mt-1 text-lg font-semibold">Dedicated Video</h3>
            <p className="mt-3 text-3xl md:text-4xl font-bold text-primary">
              {formatCurrency(rateCard.dedicated_video_low)} - {formatCurrency(rateCard.dedicated_video_high)}
            </p>
            <p className="mt-2 text-xs text-muted flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Premium Placement
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-border p-6">
            <p className="text-xs font-mono text-muted uppercase">Tier 02</p>
            <h3 className="mt-1 text-lg font-semibold">60-Second Integration</h3>
            <p className="mt-3 text-3xl md:text-4xl font-bold">
              {formatCurrency(rateCard.integration_60s_low)} - {formatCurrency(rateCard.integration_60s_high)}
            </p>
            <p className="mt-2 text-xs text-success flex items-center gap-1">
              <Check className="w-3 h-3" /> Optimal ROI
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-border p-6">
            <p className="text-xs font-mono text-muted uppercase">Tier 03</p>
            <h3 className="mt-1 text-lg font-semibold">30-Second Integration</h3>
            <p className="mt-3 text-3xl md:text-4xl font-bold">
              {formatCurrency(rateCard.integration_30s_low)} - {formatCurrency(rateCard.integration_30s_high)}
            </p>
            <p className="mt-2 text-xs text-muted flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> Quick Turnaround
            </p>
          </div>
        </div>

        {/* Why This Rate */}
        <div className="mt-8 grid lg:grid-cols-2 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </div>
              <h2 className="text-lg font-semibold">Why This Rate</h2>
            </div>
            <blockquote className="bg-white rounded-2xl border border-border p-6 text-sm text-muted leading-relaxed italic">
              {rateCard.explanation}
            </blockquote>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="bg-muted-light border border-border rounded-full px-3 py-1 text-xs">{rateCard.niche} Category: High</span>
              <span className="bg-muted-light border border-border rounded-full px-3 py-1 text-xs">Sentiment: Positive</span>
              <span className="bg-muted-light border border-border rounded-full px-3 py-1 text-xs">Frequency: 2x Monthly</span>
            </div>

            {/* Path to Next Level */}
            {tips && tips.length > 0 && (
              <div className="mt-8">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  <h2 className="text-lg font-semibold">Path to Next Level</h2>
                </div>
                <div className="space-y-4">
                  {tips.map((tip, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                        <TrendingUp className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{tip.title}</p>
                        <p className="text-xs text-muted mt-0.5">{tip.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Pitch Email */}
          <div>
            <h2 className="text-lg font-semibold mb-4">Pitch Email Template</h2>
            <div className="bg-secondary rounded-2xl p-6 text-white">
              <pre className="whitespace-pre-wrap text-sm font-sans leading-relaxed opacity-90">
                {rateCard.pitch_email}
              </pre>
              <button
                onClick={copyEmail}
                className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-medium transition-colors"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy to Clipboard'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-8 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <button
            onClick={() => setShowDownloadMenu(prev => !prev)}
            disabled={downloadingFormat !== null}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-primary text-white font-semibold hover:bg-primary-hover transition-colors disabled:opacity-60"
          >
            <Download className="w-5 h-5" />
            {downloadingFormat ? `Downloading ${downloadFormatLabel(downloadingFormat)}...` : 'Download Rate Card'}
            <ChevronDown className="w-4 h-4" />
          </button>

          {showDownloadMenu && (
            <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 rounded-2xl border border-border bg-white p-2 shadow-xl">
              <button
                onClick={() => handleDownload('png')}
                className="w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left text-sm hover:bg-muted-light transition-colors"
              >
                <ImageIcon className="w-4 h-4 text-primary" />
                <span>Download PNG</span>
              </button>
              <button
                onClick={() => handleDownload('pdf')}
                className="w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left text-sm hover:bg-muted-light transition-colors"
              >
                <FileDown className="w-4 h-4 text-primary" />
                <span>Download PDF</span>
              </button>
            </div>
          )}
        </div>
        <button
          onClick={() => setShowDealModal(true)}
          className="flex-1 flex items-center justify-center gap-2 py-4 rounded-xl bg-secondary text-white font-semibold hover:bg-secondary-hover transition-colors"
        >
          <FileText className="w-5 h-5" />
          Start Tracking This Deal
        </button>
      </div>

      {/* Deal creation modal */}
      {showDealModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full animate-slide-up">
            <h2 className="text-xl font-bold mb-4">Start a New Deal</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Brand Name</label>
                <input
                  value={brandName}
                  onChange={e => setBrandName(e.target.value)}
                  placeholder="e.g. NordVPN, Squarespace"
                  className="w-full px-4 py-3 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Deal Type</label>
                <select
                  value={dealType}
                  onChange={e => setDealType(e.target.value as typeof dealType)}
                  className="w-full px-4 py-3 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  <option value="dedicated_video">Dedicated Video ({formatCurrency(rateCard.dedicated_video_low)} - {formatCurrency(rateCard.dedicated_video_high)})</option>
                  <option value="integration_60s">60-Second Integration ({formatCurrency(rateCard.integration_60s_low)} - {formatCurrency(rateCard.integration_60s_high)})</option>
                  <option value="integration_30s">30-Second Integration ({formatCurrency(rateCard.integration_30s_low)} - {formatCurrency(rateCard.integration_30s_high)})</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Your Ask (optional)</label>
                <input
                  value={creatorAsk}
                  onChange={e => setCreatorAsk(e.target.value)}
                  placeholder="Leave blank to use rate card range"
                  className="w-full px-4 py-3 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button onClick={() => setShowDealModal(false)} className="flex-1 py-3 rounded-xl border border-border text-sm font-medium hover:bg-muted-light transition-colors">
                Cancel
              </button>
              <button
                onClick={createDeal}
                disabled={!brandName.trim() || creatingDeal}
                className="flex-1 py-3 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-50"
              >
                {creatingDeal ? 'Creating...' : 'Start Deal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function downloadFormatLabel(format: 'png' | 'pdf') {
  return format.toUpperCase()
}
