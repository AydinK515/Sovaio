'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import type { RateCard } from '@/lib/types'
import { formatCurrency, getOpeningMessage } from '@/lib/deal-chat'
import { Copy, Check, Download, TrendingUp, Sparkles, FileText } from 'lucide-react'

export default function RateCardClient({ rateCard }: { rateCard: RateCard }) {
  const router = useRouter()
  const [copied, setCopied] = useState(false)
  const [brandName, setBrandName] = useState('')
  const [showDealModal, setShowDealModal] = useState(false)
  const [dealType, setDealType] = useState<'dedicated_video' | 'integration_60s' | 'integration_30s'>('integration_60s')
  const [creatorAsk, setCreatorAsk] = useState('')
  const [creatingDeal, setCreatingDeal] = useState(false)

  const supabase = createClient()

  async function copyEmail() {
    await navigator.clipboard.writeText(rateCard.pitch_email || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleDownloadPdf() {
    const html2canvas = (await import('html2canvas')).default
    const jsPDF = (await import('jspdf')).default

    const element = document.getElementById('rate-card-content')
    if (!element) return

    const canvas = await html2canvas(element, { scale: 2, backgroundColor: '#ffffff' })
    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF('p', 'mm', 'a4')
    const imgWidth = 210
    const imgHeight = (canvas.height * imgWidth) / canvas.width
    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight)
    pdf.save(`RateProof-RateCard-${new Date().toISOString().split('T')[0]}.pdf`)
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

  return (
    <div className="py-8">
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
        <button
          onClick={handleDownloadPdf}
          className="flex-1 flex items-center justify-center gap-2 py-4 rounded-xl bg-primary text-white font-semibold hover:bg-primary-hover transition-colors"
        >
          <Download className="w-5 h-5" />
          Download PDF Rate Card
        </button>
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
