'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'
import type { Deal, DealChat, DealMessage } from '@/lib/types'
import { Send, Copy, Check, CheckCircle2, XCircle, Pause, Trophy, MessageSquare, ArrowLeft, Plus } from 'lucide-react'

function formatCurrency(n: number | null) {
  if (n == null) return '--'
  return `$${n.toLocaleString()}`
}

const SCRIPT_SEPARATOR = '---SCRIPT---'

function parseNegotiationText(text: string) {
  const scriptIndex = text.indexOf(SCRIPT_SEPARATOR)
  const advice = (scriptIndex === -1 ? text : text.slice(0, scriptIndex)).trim()
  const script = (scriptIndex === -1 ? '' : text.slice(scriptIndex + SCRIPT_SEPARATOR.length)).trim()

  return {
    advice,
    script: script || null,
  }
}

const DEAL_TYPE_LABELS = {
  dedicated_video: 'Dedicated Video',
  integration_60s: 'Integrated (60s)',
  integration_30s: 'Integrated (30s)',
}

function getOpeningMessage(deal: Deal) {
  return `This is a fresh negotiation thread for ${deal.brand_name}. You're targeting ${formatCurrency(deal.creator_ask)} for a ${DEAL_TYPE_LABELS[deal.deal_type].toLowerCase()}. Paste the latest brand reply here and I'll help you work this angle.`
}

export default function DealClient({
  deal: initialDeal,
  initialChats,
  initialChat,
  initialMessages,
}: {
  deal: Deal
  initialChats: DealChat[]
  initialChat: DealChat | null
  initialMessages: DealMessage[]
}) {
  const router = useRouter()
  const [deal, setDeal] = useState(initialDeal)
  const [chats, setChats] = useState(initialChats)
  const [currentChat, setCurrentChat] = useState(initialChat)
  const [messages, setMessages] = useState(initialMessages)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [aiTyping, setAiTyping] = useState(false)
  const [aiText, setAiText] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [showCloseModal, setShowCloseModal] = useState(false)
  const [finalPrice, setFinalPrice] = useState('')
  const [creatingChat, setCreatingChat] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const supabase = createClient()

  useEffect(() => {
    setDeal(initialDeal)
  }, [initialDeal])

  useEffect(() => {
    setChats(initialChats)
  }, [initialChats])

  useEffect(() => {
    setCurrentChat(initialChat)
  }, [initialChat])

  useEffect(() => {
    setMessages(initialMessages)
  }, [initialMessages])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, aiText])

  function markChatUpdated(chatId: string, updatedAt: string) {
    setChats(prev =>
      prev.map(chat =>
        chat.id === chatId
          ? { ...chat, updated_at: updatedAt }
          : chat
      )
    )
  }

  async function copyScript(text: string, id: string) {
    await navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  async function sendMessage() {
    if (!input.trim() || sending || !currentChat) return
    setSending(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setSending(false)
      return
    }

    const brandText = input.trim()

    // Save brand message to Supabase
    const { data: brandMsg } = await supabase.from('deal_messages').insert({
      deal_id: deal.id,
      chat_id: currentChat.id,
      user_id: user.id,
      role: 'brand',
      content: brandText,
    }).select('*').single()

    if (brandMsg) {
      setMessages(prev => [...prev, brandMsg as DealMessage])
    }

    const messageTimestamp = new Date().toISOString()
    await supabase.from('deal_chats').update({ updated_at: messageTimestamp }).eq('id', currentChat.id)
    await supabase.from('deals').update({ updated_at: messageTimestamp }).eq('id', deal.id)
    markChatUpdated(currentChat.id, messageTimestamp)

    // Extract dollar amount from brand message for offer tracking
    const numberMatch = brandText.match(/\$?([\d,]+)/)
    if (numberMatch) {
      const offer = parseInt(numberMatch[1].replace(/,/g, ''))
      await supabase.from('deals').update({ brand_last_offer: offer, updated_at: new Date().toISOString() }).eq('id', deal.id)
      setDeal(prev => ({ ...prev, brand_last_offer: offer }))
    }

    setInput('')
    setSending(false)
    setAiTyping(true)
    setAiText('')

    // Build message history for context (exclude the message we just saved so it goes as the final user turn)
    const historyForContext = messages.map(m => ({ role: m.role, content: m.content }))

    // Request AI response
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const response = await fetch('/api/negotiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          brandMessage: brandText,
          deal: {
            brand_name: deal.brand_name,
            deal_type: deal.deal_type,
            creator_ask: deal.creator_ask,
            brand_last_offer: deal.brand_last_offer,
            timeline: deal.timeline,
            notes: deal.notes,
          },
          messageHistory: historyForContext,
        }),
      })

      if (!response.ok) throw new Error(`API error: ${response.status}`)
      if (!response.body) throw new Error('API returned no response body')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let fullText = ''

      while (true) {
        const { value, done } = await reader.read()
        if (done) break

        fullText += decoder.decode(value, { stream: true })
        const partial = parseNegotiationText(fullText)
        setAiText(partial.advice || fullText.trim())
      }

      fullText += decoder.decode()

      const { advice, script } = parseNegotiationText(fullText)
      const messageContent = advice || fullText.trim() || 'I generated a response, but it came back empty.'

      setAiText(messageContent)

      // Save AI message to Supabase
      const { data: aiMsg } = await supabase.from('deal_messages').insert({
        deal_id: deal.id,
        chat_id: currentChat.id,
        user_id: user.id,
        role: 'ai',
        content: messageContent,
        suggested_script: script,
      }).select('*').single()

      if (aiMsg) {
        setMessages(prev => [...prev, aiMsg as DealMessage])
      } else if (messageContent) {
        setMessages(prev => [...prev, {
          id: crypto.randomUUID(),
          deal_id: deal.id,
          chat_id: currentChat.id,
          user_id: user.id,
          role: 'ai',
          content: messageContent,
          suggested_script: script,
          created_at: new Date().toISOString(),
        } as DealMessage])
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        // Save error message so conversation isn't broken
        setMessages(prev => [...prev, {
          id: crypto.randomUUID(),
          deal_id: deal.id,
          chat_id: currentChat.id,
          user_id: user?.id ?? '',
          role: 'ai',
          content: 'Sorry, I ran into an error. Please check that your OpenAI API key is configured.',
          suggested_script: null,
          created_at: new Date().toISOString(),
        } as DealMessage])
      }
    } finally {
      setAiTyping(false)
      setAiText('')
      abortRef.current = null
    }
  }

  async function createChat() {
    if (creatingChat) return
    setCreatingChat(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setCreatingChat(false)
      return
    }

    const title = `Chat ${chats.length + 1}`
    const { data: newChat, error } = await supabase.from('deal_chats').insert({
      deal_id: deal.id,
      user_id: user.id,
      title,
    }).select('*').single()

    if (error || !newChat) {
      setCreatingChat(false)
      return
    }

    await supabase.from('deal_messages').insert({
      deal_id: deal.id,
      chat_id: newChat.id,
      user_id: user.id,
      role: 'ai',
      content: getOpeningMessage(deal),
    })

    await supabase.from('deals').update({ updated_at: new Date().toISOString() }).eq('id', deal.id)

    setCreatingChat(false)
    router.push(`/deal/${deal.id}?chat=${newChat.id}`)
    router.refresh()
  }

  function openChat(chatId: string) {
    if (chatId === currentChat?.id) return
    router.push(`/deal/${deal.id}?chat=${chatId}`)
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

          <div className="bg-white rounded-2xl border border-border p-6">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h3 className="text-sm font-semibold">Deal Chats</h3>
              <button
                onClick={createChat}
                disabled={creatingChat}
                className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted-light transition-colors disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                {creatingChat ? 'Creating...' : 'New Chat'}
              </button>
            </div>
            <div className="space-y-2">
              {chats.map(chat => (
                <button
                  key={chat.id}
                  onClick={() => openChat(chat.id)}
                  className={`w-full rounded-xl border px-3 py-3 text-left transition-colors ${
                    chat.id === currentChat?.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-muted-light'
                  }`}
                >
                  <p className="text-sm font-medium">{chat.title}</p>
                  <p className="mt-1 text-xs text-muted">
                    {new Date(chat.updated_at).toLocaleDateString()}
                  </p>
                </button>
              ))}
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
                <p className="text-xs text-muted">{currentChat?.title || 'No chat selected'}</p>
              </div>
            </div>
            <span className="text-xs text-muted">AI-powered advice</span>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {!currentChat && (
              <div className="flex h-full min-h-[240px] items-center justify-center rounded-2xl border border-dashed border-border bg-muted-light/30 p-8 text-center">
                <div>
                  <p className="text-sm font-medium">No chat selected yet.</p>
                  <p className="mt-1 text-sm text-muted">Create a new chat for this deal to start a separate negotiation thread.</p>
                </div>
              </div>
            )}
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

            {/* AI streaming indicator */}
            {aiTyping && (
              <div className="flex justify-start">
                <div className="max-w-[80%] bg-muted-light rounded-2xl rounded-bl-sm px-5 py-3">
                  <p className="text-xs font-medium mb-1 opacity-60">RateProof AI</p>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
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
                  placeholder={currentChat ? 'Paste what the brand said...' : 'Create a chat to begin'}
                  disabled={sending || aiTyping || !currentChat}
                  className="flex-1 px-4 py-3 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || sending || aiTyping || !currentChat}
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
