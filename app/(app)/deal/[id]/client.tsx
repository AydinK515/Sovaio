'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'
import type { Deal, DealMessage } from '@/lib/types'
import { Send, Copy, Check, CheckCircle2, XCircle, Pause, Trophy, MessageSquare, ArrowLeft } from 'lucide-react'

function formatCurrency(n: number | null) {
  if (n == null) return '—'
  return `$${n.toLocaleString()}`
}

const DEAL_TYPE_LABELS = {
  dedicated_video: 'Dedicated Video',
  integration_60s: 'Integrated (60s)',
  integration_30s: 'Integrated (30s)',
}

// Mock AI responses for the negotiation advisor
const MOCK_AI_RESPONSES = [
  {
    content: "That's a significant gap. They're likely testing your flexibility since your historical CTR in the niche is nearly 2.4x the industry average. Don't drop your price yet. Instead, pivot the conversation to ROI.",
    script: "\"I appreciate the context on budget. However, given my 68% audience retention on similar product reviews and the historical performance of my tech integrations, I'm confident in the valuation. Would you be open to a performance-based bonus to bridge the gap?\"",
  },
  {
    content: "They're coming up, which is a good sign. The fact that they increased their offer means they have more room. I'd suggest a small concession — come down 10% but add a usage rights limitation to protect your value.",
    script: "\"Thanks for moving on this. I can come down to [slightly lower price] if we limit usage rights to 90 days and one platform. For extended rights, we'd need to revisit the rate. Does that work for your team?\"",
  },
  {
    content: "This is a strong offer — it's within your rate card range and above the niche average for this type of integration. I'd recommend accepting but negotiating on payment terms to protect your cash flow.",
    script: "\"That works for me. I'd like to confirm: 50% upfront before production begins, net-30 on the remainder after publish. I'll send over a simple agreement for us to sign. Looking forward to this!\"",
  },
]

export default function DealClient({ deal: initialDeal, initialMessages }: { deal: Deal; initialMessages: DealMessage[] }) {
  const router = useRouter()
  const [deal, setDeal] = useState(initialDeal)
  const [messages, setMessages] = useState(initialMessages)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [aiTyping, setAiTyping] = useState(false)
  const [aiText, setAiText] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [showCloseModal, setShowCloseModal] = useState(false)
  const [finalPrice, setFinalPrice] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const mockResponseIndex = useRef(0)

  const supabase = createClient()

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, aiText])

  async function copyScript(text: string, id: string) {
    await navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  async function sendMessage() {
    if (!input.trim() || sending) return
    setSending(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Save brand message
    const { data: brandMsg } = await supabase.from('deal_messages').insert({
      deal_id: deal.id,
      user_id: user.id,
      role: 'brand',
      content: input.trim(),
    }).select('*').single()

    if (brandMsg) {
      setMessages(prev => [...prev, brandMsg as DealMessage])
    }

    // Extract number from brand message for offer tracking
    const numberMatch = input.match(/\$?([\d,]+)/);
    if (numberMatch) {
      const offer = parseInt(numberMatch[1].replace(/,/g, ''))
      await supabase.from('deals').update({ brand_last_offer: offer, updated_at: new Date().toISOString() }).eq('id', deal.id)
      setDeal(prev => ({ ...prev, brand_last_offer: offer }))
    }

    setInput('')
    setSending(false)

    // Simulate AI streaming response
    setAiTyping(true)
    const mockResponse = MOCK_AI_RESPONSES[mockResponseIndex.current % MOCK_AI_RESPONSES.length]
    mockResponseIndex.current++

    // Typewriter effect
    const fullText = mockResponse.content
    let charIndex = 0
    setAiText('')

    await new Promise(r => setTimeout(r, 800)) // Thinking delay

    await new Promise<void>(resolve => {
      const interval = setInterval(() => {
        charIndex++
        setAiText(fullText.slice(0, charIndex))
        if (charIndex >= fullText.length) {
          clearInterval(interval)
          resolve()
        }
      }, 20)
    })

    // Save AI message
    const { data: aiMsg } = await supabase.from('deal_messages').insert({
      deal_id: deal.id,
      user_id: user.id,
      role: 'ai',
      content: mockResponse.content,
      suggested_script: mockResponse.script,
    }).select('*').single()

    if (aiMsg) {
      setMessages(prev => [...prev, aiMsg as DealMessage])
    }
    setAiTyping(false)
    setAiText('')
  }

  async function updateStatus(status: Deal['status']) {
    if (status === 'closed_won') {
      setShowCloseModal(true)
      return
    }

    await supabase.from('deals').update({ status, updated_at: new Date().toISOString() }).eq('id', deal.id)
    setDeal(prev => ({ ...prev, status }))
  }

  async function closeDealWon() {
    const price = finalPrice ? parseInt(finalPrice.replace(/,/g, '')) : null
    await supabase.from('deals').update({
      status: 'closed_won',
      final_price: price,
      updated_at: new Date().toISOString(),
    }).eq('id', deal.id)
    setDeal(prev => ({ ...prev, status: 'closed_won', final_price: price }))
    setShowCloseModal(false)
  }

  return (
    <div className="py-8">
      <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
      </Link>

      <div className="grid lg:grid-cols-[280px_1fr] gap-8">
        {/* Sidebar */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-border p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold text-sm">
                {deal.brand_name.charAt(0)}
              </div>
              <div>
                <h2 className="font-semibold">{deal.brand_name}</h2>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  deal.status === 'negotiating' ? 'bg-blue-50 text-blue-700' :
                  deal.status === 'closed_won' ? 'bg-green-50 text-green-700' :
                  deal.status === 'closed_lost' ? 'bg-red-50 text-red-700' :
                  'bg-amber-50 text-amber-700'
                }`}>
                  {deal.status === 'negotiating' ? 'Negotiating' : deal.status === 'closed_won' ? 'Closed Won' : deal.status === 'closed_lost' ? 'Closed Lost' : 'Stalled'}
                </span>
              </div>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-muted uppercase tracking-wider mb-1">Your Ask</p>
                <p className="text-2xl font-bold">{formatCurrency(deal.creator_ask)}</p>
              </div>
              {deal.brand_last_offer && (
                <div className="border-t border-border pt-3">
                  <p className="text-xs text-muted uppercase tracking-wider mb-1">Their Last Offer</p>
                  <p className="text-2xl font-bold text-primary">{formatCurrency(deal.brand_last_offer)}</p>
                </div>
              )}
              {deal.final_price && (
                <div className="border-t border-border pt-3">
                  <p className="text-xs text-muted uppercase tracking-wider mb-1">Final Price</p>
                  <p className="text-2xl font-bold text-success">{formatCurrency(deal.final_price)}</p>
                </div>
              )}
            </div>
          </div>

          {/* Status Controls */}
          <div className="bg-white rounded-2xl border border-border p-6">
            <h3 className="text-sm font-semibold mb-3">Deal Status Controls</h3>
            <div className="space-y-2">
              <button
                onClick={() => updateStatus('closed_won')}
                className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
              >
                <CheckCircle2 className="w-4 h-4" /> Closed Won
              </button>
              <button
                onClick={() => updateStatus('closed_lost')}
                className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-red-50 text-red-700 hover:bg-red-100 transition-colors"
              >
                <XCircle className="w-4 h-4" /> Closed Lost
              </button>
              <button
                onClick={() => updateStatus('stalled')}
                className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
              >
                <Pause className="w-4 h-4" /> Stalled
              </button>
            </div>
          </div>

          {/* Campaign Details */}
          <div className="bg-white rounded-2xl border border-border p-6">
            <h3 className="text-sm font-semibold mb-3">Campaign Details</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Type:</span>
                <span className="font-medium">{DEAL_TYPE_LABELS[deal.deal_type]}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Timeline:</span>
                <span className="font-medium">{deal.timeline || 'Not set'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Chat Area */}
        <div className="bg-white rounded-2xl border border-border flex flex-col" style={{ minHeight: '600px' }}>
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <MessageSquare className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Negotiation Assistant</h3>
              </div>
            </div>
            <span className="text-xs text-muted">AI-powered advice</span>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'brand' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] ${
                  msg.role === 'brand'
                    ? 'bg-secondary text-white rounded-2xl rounded-br-sm px-5 py-3'
                    : msg.role === 'ai'
                    ? 'bg-muted-light rounded-2xl rounded-bl-sm px-5 py-3'
                    : 'bg-blue-50 rounded-2xl px-5 py-3'
                }`}>
                  <p className="text-xs font-medium mb-1 opacity-60">
                    {msg.role === 'ai' ? 'RateProof AI' : msg.role === 'brand' ? 'You' : 'Creator'}
                  </p>
                  <p className="text-sm leading-relaxed">{msg.content}</p>

                  {msg.suggested_script && (
                    <div className="mt-3 bg-white/10 rounded-xl p-4 border border-primary/20">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-primary uppercase tracking-wider">Recommended Script</span>
                        <button
                          onClick={() => copyScript(msg.suggested_script!, msg.id)}
                          className="text-xs flex items-center gap-1 text-muted hover:text-foreground transition-colors"
                        >
                          {copiedId === msg.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          {copiedId === msg.id ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                      <p className="text-sm italic text-muted leading-relaxed">{msg.suggested_script}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* AI typing indicator */}
            {aiTyping && (
              <div className="flex justify-start">
                <div className="max-w-[80%] bg-muted-light rounded-2xl rounded-bl-sm px-5 py-3">
                  <p className="text-xs font-medium mb-1 opacity-60">RateProof AI</p>
                  <p className="text-sm leading-relaxed">
                    {aiText || (
                      <span className="flex items-center gap-1 text-muted">
                        <span className="w-2 h-2 bg-muted rounded-full" style={{ animation: 'pulse-dot 1.4s infinite 0s' }} />
                        <span className="w-2 h-2 bg-muted rounded-full" style={{ animation: 'pulse-dot 1.4s infinite 0.2s' }} />
                        <span className="w-2 h-2 bg-muted rounded-full" style={{ animation: 'pulse-dot 1.4s infinite 0.4s' }} />
                      </span>
                    )}
                  </p>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          {deal.status === 'negotiating' && (
            <div className="p-4 border-t border-border">
              <form onSubmit={e => { e.preventDefault(); sendMessage() }} className="flex items-center gap-3">
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="Tell me what they said..."
                  disabled={sending || aiTyping}
                  className="flex-1 px-4 py-3 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || sending || aiTyping}
                  className="w-11 h-11 bg-primary rounded-xl flex items-center justify-center text-white hover:bg-primary-hover transition-colors disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          )}

          {deal.status !== 'negotiating' && (
            <div className="p-4 border-t border-border text-center">
              <p className="text-sm text-muted">
                This deal is {deal.status === 'closed_won' ? 'closed (won)' : deal.status === 'closed_lost' ? 'closed (lost)' : 'stalled'}.
                {deal.status === 'stalled' && (
                  <button onClick={() => updateStatus('negotiating')} className="ml-2 text-primary font-medium hover:underline">Resume</button>
                )}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Close Won Modal */}
      {showCloseModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full animate-slide-up">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trophy className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-xl font-bold">Congratulations!</h2>
              <p className="mt-1 text-sm text-muted">What was the final deal price?</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Final Price</label>
              <input
                value={finalPrice}
                onChange={e => setFinalPrice(e.target.value)}
                placeholder="e.g. 2,500"
                className="w-full px-4 py-3 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div className="mt-6 flex gap-3">
              <button onClick={() => setShowCloseModal(false)} className="flex-1 py-3 rounded-xl border border-border text-sm font-medium hover:bg-muted-light transition-colors">
                Cancel
              </button>
              <button
                onClick={closeDealWon}
                className="flex-1 py-3 rounded-xl bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors"
              >
                Close Deal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
