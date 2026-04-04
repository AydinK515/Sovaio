'use client'

import { useEffect, useRef, useState, type RefObject } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import OnboardingHint from '@/components/onboarding-hint'
import { useOnboarding } from '@/components/onboarding-provider'
import { createClient } from '@/lib/supabase-browser'
import { captureAnalyticsEvent } from '@/lib/posthog-client'
import { POSTHOG_EVENTS } from '@/lib/posthog-events'
import type { RateCard, Profile } from '@/lib/types'
import { formatCurrency } from '@/lib/deal-chat'
import { Copy, Check, Download, TrendingUp, Sparkles, FileText, ChevronDown, ImageIcon, FileDown, ArrowRight, Pencil, Trash2, X } from 'lucide-react'
import ConfirmationModal from '@/components/confirmation-modal'

type AudienceSnapshot = {
  genderSplit: string
  usUkCaAuAudience: string
  ageGroupBreakdown: Array<{ label: string; value: string; isDominant: boolean }>
}

type PerformanceSnapshotItem = {
  label: string
  value: string
}

export default function RateCardClient({
  rateCard,
  profile,
  snapshotName,
  audienceSnapshot,
  performanceSnapshot,
}: {
  rateCard: RateCard
  profile: Profile | null
  snapshotName: string | null
  audienceSnapshot: AudienceSnapshot
  performanceSnapshot: PerformanceSnapshotItem[]
}) {
  const router = useRouter()
  const { state: onboardingState, dismissHint } = useOnboarding()
  const exportRef = useRef<HTMLDivElement>(null)
  const previewViewportRef = useRef<HTMLDivElement>(null)
  const previewContentRef = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)
  const [showDownloadMenu, setShowDownloadMenu] = useState(false)
  const [downloadingFormat, setDownloadingFormat] = useState<'png' | 'pdf' | null>(null)
  const [expandedRangeInfo, setExpandedRangeInfo] = useState<'dedicated_video' | 'integration_60s' | 'integration_30s' | null>(null)
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [previewScale, setPreviewScale] = useState(1)
  const [previewHeight, setPreviewHeight] = useState(0)
  const [cardName, setCardName] = useState(rateCard.name || rateCard.niche || 'Untitled rate card')
  const [editingCardName, setEditingCardName] = useState(false)
  const [draftCardName, setDraftCardName] = useState(rateCard.name || rateCard.niche || 'Untitled rate card')
  const [savingCardName, setSavingCardName] = useState(false)
  const [deletingCard, setDeletingCard] = useState(false)
  const [cardNameError, setCardNameError] = useState('')
  const [showDeleteCardModal, setShowDeleteCardModal] = useState(false)
  const rangesHintKey = `rate-card-${rateCard.id}-ranges-tip`

  const [supabase] = useState(() => createClient())
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  useEffect(() => {
    const nextCardName = rateCard.name || rateCard.niche || 'Untitled rate card'
    setCardName(nextCardName)
    setDraftCardName(nextCardName)
  }, [rateCard.name, rateCard.niche])

  useEffect(() => {
    if (!profile?.avatar_path) return
    let cancelled = false

    supabase.storage.from('avatars').createSignedUrl(profile.avatar_path, 60 * 60).then(({ data }) => {
      if (!cancelled && data?.signedUrl) setAvatarUrl(data.signedUrl)
    })

    return () => { cancelled = true }
  }, [profile?.avatar_path, supabase])

  useEffect(() => {
    captureAnalyticsEvent(POSTHOG_EVENTS.rateCardViewed, {
      rate_card_id: rateCard.id,
      analytics_snapshot_id: rateCard.analytics_snapshot_id,
      report_confidence: rateCard.report_confidence,
      niche: rateCard.niche,
      subscriber_count: rateCard.subscriber_count,
      has_sponsorships: rateCard.has_sponsorships,
    })
  }, [
    rateCard.analytics_snapshot_id,
    rateCard.has_sponsorships,
    rateCard.id,
    rateCard.niche,
    rateCard.report_confidence,
    rateCard.subscriber_count,
  ])

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const target = event.target
      if (!(target instanceof Element)) return

      if (!target.closest('[data-range-info-root]')) {
        setExpandedRangeInfo(null)
      }

      if (!target.closest('[data-download-root]')) {
        setShowDownloadMenu(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [])

  useEffect(() => {
    if (!showPreviewModal) return

    const viewport = previewViewportRef.current
    const content = previewContentRef.current
    if (!viewport || !content) return

    const updatePreviewScale = () => {
      const availableWidth = viewport.clientWidth - 24
      const nextScale = Math.min(availableWidth / 1400, 1)
      setPreviewScale(nextScale)
      setPreviewHeight(content.scrollHeight * nextScale)
    }

    updatePreviewScale()

    const resizeObserver = new ResizeObserver(() => updatePreviewScale())
    resizeObserver.observe(viewport)
    resizeObserver.observe(content)

    return () => resizeObserver.disconnect()
  }, [showPreviewModal, avatarUrl, profile?.channel_name, rateCard])

  const liveRateTiers = [
    {
      id: 'dedicated_video' as const,
      tier: 'Tier 01',
       title: 'Dedicated Video',
      range: `${formatCurrency(rateCard.dedicated_video_low)} - ${formatCurrency(rateCard.dedicated_video_high)}`,
      badge: 'Premium Placement',
      badgeClassName: 'text-primary',
      icon: Sparkles,
      explanation: (
        <>
          This is your expected pricing band for a full sponsor-focused video, not one exact price. The low end fits shorter or simpler dedicated deliverables, while the high end fits bigger asks like longer videos, heavier scripting, more revisions, or deeper brand integration.{' '}
          <strong className="font-semibold text-foreground">Dedicated video ranges are usually the widest because total workload changes a lot depending on video length and production scope.</strong> It is rare to reach the upper end of this range.
        </>
      ),
    },
    {
      id: 'integration_60s' as const,
      tier: 'Tier 02',
      title: '60-Second Integration',
      range: `${formatCurrency(rateCard.integration_60s_low)} - ${formatCurrency(rateCard.integration_60s_high)}`,
      badge: 'Optimal ROI',
      badgeClassName: 'text-success',
      icon: Check,
      explanation: 'This range is your likely quote band for a standard one-minute in-video sponsor segment. The lower end is for straightforward placements with lighter creative demands, while the upper end fits stronger audience quality, better geography, or campaigns that need more polish, brand talking points, or a better slot in the video.',
    },
    {
      id: 'integration_30s' as const,
      tier: 'Tier 03',
      title: '30-Second Integration',
      range: `${formatCurrency(rateCard.integration_30s_low)} - ${formatCurrency(rateCard.integration_30s_high)}`,
      badge: 'Quick Turnaround',
      badgeClassName: 'text-muted',
      icon: TrendingUp,
      explanation: 'This range covers shorter sponsor mentions that still benefit from your audience trust and delivery style. The low end works for lighter, test-budget campaigns, while the high end fits stronger-performing videos, better placement, or brands that want a tighter, more polished mention without paying for a full 60-second read.',
    },
  ]
  const visibleLiveRateTiers = liveRateTiers.filter((tier) => rateCard.offers_dedicated_videos || tier.id !== 'dedicated_video')

  async function copyEmail() {
    await navigator.clipboard.writeText(rateCard.pitch_email || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function renderExportCanvas() {
    const html2canvas = (await import('html2canvas')).default

    const element = exportRef.current
    if (!element) return

    if ('fonts' in document) {
      await document.fonts.ready
    }

    const images = Array.from(element.querySelectorAll('img'))
    await Promise.all(
      images.map(async (image) => {
        if (!image.complete) {
          await new Promise<void>((resolve) => {
            const finalize = () => resolve()
            image.addEventListener('load', finalize, { once: true })
            image.addEventListener('error', finalize, { once: true })
          })
        }

        if (typeof image.decode === 'function') {
          await image.decode().catch(() => undefined)
        }
      })
    )

    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))

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

  async function saveCardName() {
    const nextName = draftCardName.trim()
    if (!nextName) {
      setCardNameError('Rate card name cannot be empty.')
      return
    }

    setSavingCardName(true)
    setCardNameError('')

    try {
      const response = await fetch(`/api/rate-cards/${rateCard.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nextName }),
      })

      if (!response.ok) {
        throw new Error(await response.text())
      }

      setCardName(nextName)
      setEditingCardName(false)
      router.refresh()
    } catch (err: unknown) {
      setCardNameError(err instanceof Error ? err.message : 'Failed to rename rate card.')
    } finally {
      setSavingCardName(false)
    }
  }

  async function deleteCard() {
    setShowDeleteCardModal(false)
    setDeletingCard(true)
    setCardNameError('')

    try {
      const response = await fetch(`/api/rate-cards/${rateCard.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error(await response.text())
      }

      router.push('/rate-card')
      router.refresh()
    } catch (err: unknown) {
      setCardNameError(err instanceof Error ? err.message : 'Failed to delete rate card.')
      setDeletingCard(false)
    }
  }

  const tips = rateCard.improvement_tips as { title: string; description: string }[] | null
  const exportAddOns = [
    { label: 'Organic usage rights (30 days)', value: formatCurrency(Math.round(rateCard.integration_60s_low * 0.2)) },
    { label: 'Paid usage rights (30 days)', value: formatCurrency(Math.round(rateCard.integration_60s_low * 0.3)) },
    { label: 'Exclusivity (30 days)', value: formatCurrency(Math.round((rateCard.offers_dedicated_videos ? rateCard.dedicated_video_low : rateCard.integration_60s_high) * 0.3)) },
    { label: 'Rush fee', value: formatCurrency(Math.round(rateCard.integration_30s_low * 0.4)) },
    { label: 'Extra revision round', value: formatCurrency(Math.round(rateCard.integration_30s_low * 0.25)) },
  ]
  return (
        <div className="py-8">
      <ConfirmationModal
        open={showDeleteCardModal}
        title="Delete rate card?"
        message={`Delete "${cardName}"? Existing deals will keep their data, but they will no longer be linked to this rate card.`}
        confirmLabel="Delete Rate Card"
        tone="danger"
        pending={deletingCard}
        onClose={() => setShowDeleteCardModal(false)}
        onConfirm={() => {
          void deleteCard()
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed left-[-10000px] top-0 z-[-1] opacity-0"
      >
        <ExportRateCardContent
          containerRef={exportRef}
          rateCard={rateCard}
          profile={profile}
          audienceSnapshot={audienceSnapshot}
          performanceSnapshot={performanceSnapshot}
          avatarUrl={avatarUrl}
          exportAddOns={exportAddOns}
        />
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3 text-sm">
        <Link href="/rate-card" className="text-primary font-medium hover:underline">
          All Rate Cards
        </Link>
        <span className="text-muted">/</span>
        <span className="text-muted">{cardName}</span>
      </div>

      <div id="rate-card-content">
        <h1 className="text-3xl md:text-4xl font-bold">Your sponsorship rates are ready.</h1>
        <div className="mt-4">
          {editingCardName ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <input
                value={draftCardName}
                onChange={(event) => setDraftCardName(event.target.value)}
                className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:w-auto sm:min-w-[20rem] sm:max-w-[32rem]"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void saveCardName()}
                  disabled={savingCardName}
                  className="rounded-xl bg-secondary px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-secondary-hover disabled:opacity-50"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingCardName(false)
                    setDraftCardName(cardName)
                    setCardNameError('')
                  }}
                  className="rounded-xl border border-border px-4 py-3 text-sm font-medium transition-colors hover:bg-muted-light"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-semibold text-foreground">{cardName}</h2>
              <button
                type="button"
                onClick={() => {
                  setDraftCardName(cardName)
                  setEditingCardName(true)
                }}
                aria-label={`Edit ${cardName}`}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-muted-light hover:text-foreground"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteCardModal(true)}
                disabled={deletingCard}
                aria-label={`Delete ${cardName}`}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}
          {cardNameError && <p className="mt-3 text-sm text-primary">{cardNameError}</p>}
        </div>
        <p className="mt-2 text-muted">
          Based on your latest channel performance, audience demographics, and current market demand for {rateCard.niche}.
        </p>
        {snapshotName && (
          <p className="mt-2 text-sm text-muted">Generated from analytics snapshot: <span className="font-medium text-foreground">{snapshotName}</span></p>
        )}

        <div className="mt-6">
          <OnboardingHint
            hintKey={`rate-card-${rateCard.id}-read-guide`}
            title="Treat these as smart starting ranges"
            description="These numbers are designed to help you open confidently, not quote the bare minimum. Start near the upper-middle when the scope is normal, move upward when usage rights or exclusivity expand, and use “Start Tracking A Deal” when you want help in a live negotiation."
          />
        </div>

        {/* Low-volume advisory — shown when 60s rate implies avg views are too small for real deals */}
        {rateCard.integration_60s_low <= 25 && (
          <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 px-6 py-5">
            <p className="text-sm font-semibold text-amber-800">At your current view level, most brands won&apos;t engage for paid deals yet.</p>
            <p className="mt-1.5 text-sm text-amber-700 leading-relaxed">
              Your calculated rates reflect genuine market value, but deals this size rarely clear a brand&apos;s minimum budget threshold — which means your outreach will mostly go unanswered. The highest-leverage move right now is growing your average views per video. Focus on publishing consistency, strong titles and thumbnails, and going deeper into your niche to build the audience density that unlocks real sponsorship conversations.
            </p>
          </div>
        )}

        {!onboardingState.dismissed_hints[rangesHintKey] && (
          <div className="relative mt-8 rounded-[28px] border border-primary/15 bg-[linear-gradient(135deg,rgba(254,243,199,0.45),rgba(255,255,255,0.98))] px-6 py-6 shadow-sm">
            <button
              type="button"
              onClick={() => void dismissHint(rangesHintKey)}
              className="absolute right-5 top-5 inline-flex h-9 w-9 items-center justify-center rounded-xl text-muted transition-colors hover:bg-muted-light hover:text-foreground"
              aria-label="Dismiss How To Use These Ranges"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#fde7df] text-[#ef4444]">
                <TrendingUp className="h-4 w-4" />
              </div>
              <h2 className="text-[1.15rem] font-semibold tracking-[-0.02em] text-foreground sm:text-[1.3rem]">
                How To Use These Ranges
              </h2>
            </div>

            <p className="mt-4 max-w-none text-sm leading-[1.45] text-slate-500 sm:text-[15px] sm:leading-[1.45]">
              These numbers are not telling you to default to the bottom. In most normal negotiations, you should usually open in the upper-middle of the range and try to hold there unless the scope is especially light.
            </p>

            <div className="mt-6 grid gap-3 md:grid-cols-3">
              <div className="rounded-[24px] bg-white/70 px-4 py-4">
                <p className="text-xs font-mono uppercase tracking-[0.26em] text-slate-500 sm:text-[13px]">Where To Start</p>
                <p className="mt-2.5 text-sm leading-[1.45] text-foreground sm:text-[15px] sm:leading-[1.45]">
                  Aim to quote above the midpoint when the brand fit is strong, the brief is standard, and you are not desperate to close quickly.
                </p>
              </div>
              <div className="rounded-[24px] bg-white/70 px-4 py-4">
                <p className="text-xs font-mono uppercase tracking-[0.26em] text-slate-500 sm:text-[13px]">When To Push Higher</p>
                <p className="mt-2.5 text-sm leading-[1.45] text-foreground sm:text-[15px] sm:leading-[1.45]">
                  Push toward the top when they want tighter scripting, stronger placement, usage rights, exclusivity, extra revisions, or a fast turnaround.
                </p>
              </div>
              <div className="rounded-[24px] bg-white/70 px-4 py-4">
                <p className="text-xs font-mono uppercase tracking-[0.26em] text-slate-500 sm:text-[13px]">About The Low End</p>
                <p className="mt-2.5 text-sm leading-[1.45] text-foreground sm:text-[15px] sm:leading-[1.45]">
                  The lower bound is still a fair rate, not a failure. It is the right outcome for lighter-scope deals, test budgets, or brands with less flexibility.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Rate Tiers */}
        <div className={`mt-8 grid gap-4 ${visibleLiveRateTiers.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
          {visibleLiveRateTiers.map((tier) => {
            const isOpen = expandedRangeInfo === tier.id
            const Icon = tier.icon

            return (
              <div
                key={tier.id}
                className={`relative overflow-visible rounded-2xl border border-border bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md ${
                  isOpen ? 'z-30' : 'z-0 hover:z-10'
                }`}
              >
                <p className="text-xs font-mono text-muted uppercase">{tier.tier}</p>
                <h3 className="mt-1 text-lg font-semibold">{tier.title}</h3>
                <p className="mt-3 text-3xl md:text-4xl font-bold">
                  {tier.range}*
                </p>
                <p className={`mt-2 text-xs flex items-center gap-1 ${tier.badgeClassName}`}>
                  <Icon className="w-3 h-3" /> {tier.badge}
                </p>

                <div data-range-info-root className="relative mt-4 inline-block">
                  <button
                    type="button"
                    onClick={() => setExpandedRangeInfo(isOpen ? null : tier.id)}
                    aria-expanded={isOpen}
                    aria-controls={`range-info-${tier.id}`}
                    className="inline-flex items-center gap-2 rounded-full border border-border bg-slate-50 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-slate-100"
                  >
                    What does this range mean?
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                  </button>

                  <div
                    id={`range-info-${tier.id}`}
                    className={`pointer-events-none absolute top-full z-20 mt-3 w-[26rem] max-w-[calc(100vw-3rem)] transition-all duration-200 ease-out ${
                      tier.id === 'integration_30s' ? 'left-0 right-auto sm:left-auto sm:right-0' : 'left-0 right-auto'
                    } ${
                      isOpen ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
                    }`}
                  >
                    <div className="rounded-2xl border border-primary/10 bg-primary-light/95 p-4 text-sm leading-relaxed text-muted shadow-[0_18px_50px_rgba(15,23,42,0.14)] backdrop-blur-sm">
                      {tier.explanation}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          * Final price depends on scope, usage rights, placement, etc. These numbers are intended as a range, not one fixed quote.
        </p>

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
      <div className="mt-8">
        <div className="grid gap-4 sm:grid-cols-2">
          <div data-download-root className="relative">
          <button
            onClick={() => setShowDownloadMenu(prev => !prev)}
            disabled={downloadingFormat !== null}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-primary text-white font-semibold hover:bg-primary-hover transition-colors disabled:opacity-60"
          >
            <Download className="w-5 h-5" />
            {downloadingFormat ? `Downloading ${downloadFormatLabel(downloadingFormat)}...` : 'Download Rate Card'}
            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showDownloadMenu ? 'rotate-180' : ''}`} />
          </button>

          {showDownloadMenu && (
            <div className="absolute bottom-[calc(100%+0.5rem)] left-0 right-0 z-20 rounded-2xl border border-border bg-white p-2 shadow-xl animate-in fade-in zoom-in-95 duration-150">
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
              <div className="my-2 border-t-2 border-slate-300" />
              <button
                onClick={() => {
                  setShowDownloadMenu(false)
                  setShowPreviewModal(true)
                }}
                className="w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left text-sm hover:bg-muted-light transition-colors"
              >
                <FileText className="w-4 h-4 text-primary" />
                <span>Preview Rate Card</span>
              </button>
            </div>
          )}
        </div>
          <button
            onClick={() => {
              const href = rateCard.analytics_snapshot_id
                ? `/deal/new?snapshot=${rateCard.analytics_snapshot_id}`
                : '/deal/new'
              captureAnalyticsEvent(POSTHOG_EVENTS.emptyStateCtaClicked, {
                cta_location: 'rate_card_start_deal',
                destination: href,
                rate_card_id: rateCard.id,
              })
              router.push(href)
            }}
            className="flex items-center justify-center gap-2 py-4 rounded-xl bg-secondary text-white font-semibold hover:bg-secondary-hover transition-colors"
          >
            <FileText className="w-5 h-5" />
            Start Tracking A Deal
          </button>
        </div>
        <div className="mt-4 flex justify-center">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 text-sm font-medium text-muted transition-colors hover:text-foreground"
          >
            <span>Continue to dashboard</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {showPreviewModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
          onClick={() => setShowPreviewModal(false)}
        >
          <div
            className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl animate-slide-up"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-5">
              <div>
                <h2 className="text-xl font-bold">Rate Card Preview</h2>
                <p className="mt-1 text-sm text-muted">This is exactly what your exported PNG and PDF will look like.</p>
              </div>
              <button
                onClick={() => setShowPreviewModal(false)}
                className="rounded-xl border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted-light"
              >
                Close
              </button>
            </div>

            <div className="flex flex-col gap-3 border-b border-border bg-slate-50 px-6 py-4 sm:flex-row">
              <button
                onClick={() => handleDownload('png')}
                disabled={downloadingFormat !== null}
                className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-60"
              >
                <ImageIcon className="w-4 h-4" />
                {downloadingFormat === 'png' ? 'Downloading PNG...' : 'Download PNG'}
              </button>
              <button
                onClick={() => handleDownload('pdf')}
                disabled={downloadingFormat !== null}
                className="flex items-center justify-center gap-2 rounded-xl border border-border bg-white px-4 py-3 text-sm font-medium transition-colors hover:bg-muted-light disabled:opacity-60"
              >
                <FileDown className="w-4 h-4 text-primary" />
                {downloadingFormat === 'pdf' ? 'Downloading PDF...' : 'Download PDF'}
              </button>
            </div>

            <div className="overflow-y-auto bg-slate-100 p-4 md:p-6">
              <div className="mx-auto rounded-[32px] border border-border bg-white p-3 shadow-sm md:p-4">
                <div ref={previewViewportRef} className="w-full">
                  <div style={{ height: previewHeight || undefined }}>
                    <div
                      style={{
                        width: '1400px',
                        transform: `scale(${previewScale})`,
                        transformOrigin: 'top left',
                      }}
                    >
                      <ExportRateCardContent
                        containerRef={previewContentRef}
                        rateCard={rateCard}
                        profile={profile}
                        audienceSnapshot={audienceSnapshot}
                        performanceSnapshot={performanceSnapshot}
                        avatarUrl={avatarUrl}
                        exportAddOns={exportAddOns}
                      />
                    </div>
                  </div>
                </div>
              </div>
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

function roundToNearestFifty(value: number) {
  return Math.round(value / 50) * 50
}

function formatStartingFromRate(value: number) {
  return `Starting from ${formatCurrency(roundToNearestFifty(value))}`
}

function ExportRateCardContent({
  rateCard,
  profile,
  audienceSnapshot,
  performanceSnapshot,
  avatarUrl,
  exportAddOns,
  containerRef,
}: {
  rateCard: RateCard
  profile: Profile | null
  audienceSnapshot: AudienceSnapshot
  performanceSnapshot: PerformanceSnapshotItem[]
  avatarUrl: string | null
  exportAddOns: { label: string; value: string }[]
  containerRef?: RefObject<HTMLDivElement | null>
}) {
  const exportRateTiers = [
    ...(rateCard.offers_dedicated_videos
      ? [{
          label: 'Dedicated Video',
          range: formatStartingFromRate(rateCard.dedicated_video_low),
          note: 'Brand-led feature',
          accent: '#dc2626',
          description: 'Includes full-video integration, dedicated CTA, and sponsor-first positioning.',
        }]
      : []),
    {
      label: '60-Second Integration',
      range: formatStartingFromRate(rateCard.integration_60s_low),
      note: 'Mid-roll placement',
      accent: '#16a34a',
      description: 'Includes in-video talking points, natural script fit, and clickable callout.',
    },
    {
      label: '30-Second Integration',
      range: formatStartingFromRate(rateCard.integration_30s_low),
      note: 'High-efficiency brand mention',
      accent: '#64748b',
      description: 'Best for lighter tests, launches, and repeat campaign exposure.',
    },
  ]

  return (
    <div
      ref={containerRef}
      style={{
        width: 1400,
        backgroundColor: '#ffffff',
        color: '#0f172a',
        padding: '56px',
        fontFamily: 'var(--font-geist-sans), system-ui, sans-serif',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '24px' }}>
        <div style={{ flex: '1 1 auto', paddingBottom: '10px' }}>
          <h1 style={{ margin: '0 0 14px 0', fontSize: '72px', lineHeight: 0.95, fontWeight: 700, letterSpacing: '-0.04em', maxWidth: '760px' }}>
            Sponsorship
            <br />
            Rate Card
          </h1>
        </div>
        {(avatarUrl || profile?.channel_name) && (
          <div style={{ display: 'flex', alignItems: 'center', alignSelf: 'center', gap: '16px', minHeight: '120px' }}>
            {profile?.channel_name && (
              <div style={{ display: 'flex', alignItems: 'center', minHeight: '120px', fontSize: '36px', fontWeight: 700, color: '#0f172a', textAlign: 'right', whiteSpace: 'nowrap', letterSpacing: '-0.03em', lineHeight: 1, transform: 'translateY(-8px)' }}>
                {profile.channel_name}
              </div>
            )}
            {avatarUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt={profile?.channel_name ?? 'Channel avatar'}
                style={{ width: '120px', height: '120px', borderRadius: '50%', objectFit: 'cover', display: 'block' }}
                crossOrigin="anonymous"
              />
            )}
          </div>
        )}
      </div>

      <div style={{ marginTop: '24px', display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '16px' }}>
        {[
          { value: rateCard.subscriber_count ? rateCard.subscriber_count.toLocaleString() : 'N/A', label: 'Subscribers' },
          { value: rateCard.niche || 'General', label: 'Category' },
          { value: 'YouTube sponsorships', label: 'Sponsorship Type' },
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

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${exportRateTiers.length}, minmax(0, 1fr))`, gap: '18px', marginTop: '16px' }}>
        {exportRateTiers.map((tier) => (
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
      <div style={{ marginTop: '14px', fontSize: '15px', lineHeight: 1.6, color: '#64748b' }}>
        Final price depends on scope, usage rights, placement, and timeline. Starting rates increase for broader deliverables.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginTop: '24px' }}>
        <div style={{ border: '1px solid #e2e8f0', borderRadius: '30px', padding: '30px 32px', backgroundColor: '#f8fafc' }}>
          <div style={{ fontSize: '14px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Audience Snapshot</div>
          <div style={{ marginTop: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div style={{ display: 'grid', gap: '14px' }}>
              <div style={{ borderRadius: '20px', backgroundColor: '#ffffff', padding: '18px 20px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '13px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Gender Split</div>
                <div style={{ marginTop: '8px', fontSize: '20px', fontWeight: 700 }}>{audienceSnapshot.genderSplit}</div>
              </div>
              <div style={{ borderRadius: '20px', backgroundColor: '#ffffff', padding: '18px 20px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '13px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>US / UK / CA / AU Audience</div>
                <div style={{ marginTop: '8px', fontSize: '20px', fontWeight: 700 }}>{audienceSnapshot.usUkCaAuAudience}</div>
              </div>
            </div>
            <div style={{ borderRadius: '20px', backgroundColor: '#ffffff', padding: '18px 20px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
              <div style={{ fontSize: '13px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Age Group Breakdown</div>
              <div style={{ marginTop: '16px', display: 'grid', gap: '10px' }}>
                {audienceSnapshot.ageGroupBreakdown.length > 0 ? (
                  audienceSnapshot.ageGroupBreakdown.map((group) => (
                    <div key={group.label} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '15px', lineHeight: 1.35 }}>
                      <span style={{ color: group.isDominant ? '#0f172a' : '#64748b', fontWeight: group.isDominant ? 700 : 500 }}>{group.label}</span>
                      <span style={{ fontWeight: group.isDominant ? 800 : 700, color: '#0f172a' }}>{group.value}</span>
                    </div>
                  ))
                ) : (
                  <div style={{ fontSize: '15px', color: '#64748b' }}>Not available</div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            borderRadius: '30px',
            padding: '30px 30px 34px',
            background: 'linear-gradient(135deg, rgba(254,243,199,0.45), rgba(255,255,255,0.98))',
            border: '1px solid rgba(251, 191, 36, 0.16)',
            boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
            color: '#0f172a',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '999px',
                backgroundColor: '#fde7df',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <TrendingUp size={26} color="#ef4444" />
            </div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a' }}>What&apos;s Included</div>
          </div>
          <div
            style={{
              marginTop: '20px',
              borderRadius: '24px',
              backgroundColor: 'rgba(255,255,255,0.72)',
              padding: '22px 24px',
              border: '1px solid rgba(255,255,255,0.82)',
            }}
          >
            <div style={{ display: 'grid', gap: '14px', fontSize: '18px', lineHeight: 1.65, color: '#334155' }}>
              <div>One in-video sponsorship placement sized to the package selected</div>
              <div>Brand talking points delivered in my normal style</div>
              <div>Description link placement when included in campaign scope</div>
              <div>One standard brand review pass for factual or compliance notes</div>
              <div>Final quote confirmed based on scope, usage rights, exclusivity, and timeline</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: '28px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
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

        <div style={{ border: '1px solid #e2e8f0', borderRadius: '28px', padding: '28px 30px', backgroundColor: '#ffffff' }}>
          <div style={{ fontSize: '14px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
            Performance
          </div>
          <div style={{ marginTop: '18px' }}>
            {(performanceSnapshot.length > 0 ? performanceSnapshot : [{ label: 'Performance Snapshot', value: 'Available upon request' }]).map((item) => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', padding: '14px 0', borderTop: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '18px', color: '#0f172a' }}>{item.label}</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', textAlign: 'right' }}>{item.value}</div>
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
  )
}
