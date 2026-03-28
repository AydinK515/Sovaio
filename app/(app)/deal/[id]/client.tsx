'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'
import type { Deal, DealChat, DealMessage } from '@/lib/types'
import { DEAL_TYPE_LABELS, formatCurrency, getOpeningMessage } from '@/lib/deal-chat'
import { Send, Copy, Check, CheckCircle2, XCircle, Pause, Trophy, MessageSquare, ArrowLeft, Plus, ChevronDown, Trash2 } from 'lucide-react'

function getDraftChat(deal: Deal): DealChat {
  return {
    id: '__draft__',
    deal_id: deal.id,
    user_id: deal.user_id,
    title: 'New Chat',
    openai_conversation_id: null,
    openai_last_response_id: null,
    created_at: deal.created_at,
    updated_at: deal.updated_at,
  }
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
  const [aiReasoningText, setAiReasoningText] = useState('')
  const [aiScriptText, setAiScriptText] = useState('')
  const [aiScriptSubject, setAiScriptSubject] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [showCloseModal, setShowCloseModal] = useState(false)
  const [finalPrice, setFinalPrice] = useState('')
  const [creatingChat, setCreatingChat] = useState(false)
  const [deletingChatId, setDeletingChatId] = useState<string | null>(null)
  const [chatMenuOpen, setChatMenuOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const chatMenuRef = useRef<HTMLDivElement>(null)

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
  }, [messages, aiText, aiReasoningText, aiScriptText, aiScriptSubject])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!chatMenuRef.current?.contains(event.target as Node)) {
        setChatMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function markChatUpdated(chatId: string, updatedAt: string) {
    setChats(prev =>
      prev.map(chat =>
        chat.id === chatId
          ? { ...chat, updated_at: updatedAt }
          : chat
      )
    )
  }

  function renameChat(chatId: string, title: string) {
    setChats(prev =>
      prev.map(chat =>
        chat.id === chatId
          ? { ...chat, title }
          : chat
      )
    )

    setCurrentChat(prev => (
      prev && prev.id === chatId
        ? { ...prev, title }
        : prev
    ))
  }

  function getVisibleMessages() {
    const activeChat = currentChat ?? getDraftChat(deal)
    const openingMessage = getOpeningMessage(deal)
    const hasOpeningMessage = messages.some(msg => msg.role === 'ai' && msg.content === openingMessage)

    if (hasOpeningMessage) {
      return messages
    }

    return [
      {
        id: `opening-${activeChat.id}`,
        deal_id: deal.id,
        chat_id: activeChat.id,
        user_id: deal.user_id,
        role: 'ai',
        content: openingMessage,
        suggested_script: null,
        created_at: activeChat.created_at,
      } as DealMessage,
      ...messages,
    ]
  }

  async function copyScript(text: string, id: string) {
    await navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  async function sendMessage() {
    if (!input.trim() || sending) return
    setSending(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setSending(false)
      return
    }

    const userText = input.trim()
    const shouldGenerateTitle = messages.filter(msg => msg.role !== 'ai').length === 0
    let activeChat = currentChat

    if (!activeChat) {
      const { data: newChat, error: newChatError } = await supabase.from('deal_chats').insert({
        deal_id: deal.id,
        user_id: user.id,
        title: 'New Chat',
      }).select('*').single()

      if (newChatError || !newChat) {
        setSending(false)
        return
      }

      const { data: openingAiMsg } = await supabase.from('deal_messages').insert({
        deal_id: deal.id,
        chat_id: newChat.id,
        user_id: user.id,
        role: 'ai',
        content: getOpeningMessage(deal),
      }).select('*').single()

      activeChat = newChat as DealChat
      setChats(prev => [...prev, activeChat!])
      setCurrentChat(activeChat)
      setChatMenuOpen(false)

      if (openingAiMsg) {
        setMessages([openingAiMsg as DealMessage])
      } else {
        setMessages([])
      }

      router.push(`/deal/${deal.id}?chat=${newChat.id}`)
    }

    if (!activeChat) {
      setSending(false)
      return
    }

    const { data: userMsg } = await supabase.from('deal_messages').insert({
      deal_id: deal.id,
      chat_id: activeChat.id,
      user_id: user.id,
      role: 'creator',
      content: userText,
    }).select('*').single()

    if (userMsg) {
      setMessages(prev => [...prev, userMsg as DealMessage])
    }

    const messageTimestamp = new Date().toISOString()
    await supabase.from('deal_chats').update({ updated_at: messageTimestamp }).eq('id', activeChat.id)
    await supabase.from('deals').update({ updated_at: messageTimestamp }).eq('id', deal.id)
    markChatUpdated(activeChat.id, messageTimestamp)

    // Extract dollar amount from brand message for offer tracking
    const numberMatch = userText.match(/\$?([\d,]+)/)
    if (numberMatch) {
      const offer = parseInt(numberMatch[1].replace(/,/g, ''))
      await supabase.from('deals').update({ brand_last_offer: offer, updated_at: new Date().toISOString() }).eq('id', deal.id)
      setDeal(prev => ({ ...prev, brand_last_offer: offer }))
    }

    setInput('')
    setSending(false)
    setAiTyping(true)
    setAiText('')
    setAiReasoningText('')
    setAiScriptText('')
    setAiScriptSubject('')

    // Request AI response
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const response = await fetch('/api/negotiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          chatId: activeChat.id,
          userMessage: userText,
          generateTitle: shouldGenerateTitle,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text().catch(() => '')
        throw new Error(errorText || `API error: ${response.status}`)
      }
      if (!response.body) throw new Error('API returned no response body')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let eventBuffer = ''
      let streamedTitle = ''
      let streamedAdvice = ''
      let streamedReasoning = ''
      let streamedScript = ''
      let streamedSubject = ''
      type StreamPayload = {
        title?: string
        advice?: string
        reasoning?: string
        script?: string
        subject?: string
        updatedAt?: string
        message?: DealMessage | null
      }
      let finalPayload: StreamPayload | null = null

      while (true) {
        const { value, done } = await reader.read()
        if (done) break

        eventBuffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n')

        while (true) {
          const boundaryIndex = eventBuffer.indexOf('\n\n')
          if (boundaryIndex === -1) break

          const rawEvent = eventBuffer.slice(0, boundaryIndex)
          eventBuffer = eventBuffer.slice(boundaryIndex + 2)

          const data = rawEvent
            .split('\n')
            .filter(line => line.startsWith('data:'))
            .map(line => line.slice(5).trim())
            .join('\n')

          if (!data) continue

          const event = JSON.parse(data) as
            | { type: 'partial'; payload: StreamPayload }
            | { type: 'reasoning'; payload: StreamPayload }
            | { type: 'final'; payload: StreamPayload }
            | { type: 'error'; message?: string }

          if (event.type === 'error') {
            throw new Error(event.message || 'Streaming failed')
          }

          if (event.type === 'reasoning') {
            if (typeof event.payload.reasoning === 'string') {
              streamedReasoning = event.payload.reasoning
              setAiReasoningText(streamedReasoning)
            }
            continue
          }

          if (event.type === 'partial' || event.type === 'final') {
            if (typeof event.payload.title === 'string') {
              streamedTitle = event.payload.title
            }

            if (typeof event.payload.advice === 'string') {
              streamedAdvice = event.payload.advice
              setAiText(streamedAdvice)
            }

            if (typeof event.payload.script === 'string') {
              streamedScript = event.payload.script
              setAiScriptText(streamedScript)
            }

            if (typeof event.payload.subject === 'string') {
              streamedSubject = event.payload.subject
              setAiScriptSubject(streamedSubject)
            }

            if (typeof event.payload.reasoning === 'string') {
              streamedReasoning = event.payload.reasoning
              setAiReasoningText(streamedReasoning)
            }
          }

          if (event.type === 'final') {
            finalPayload = event.payload
          }
        }
      }

      const messageContent = (finalPayload?.advice ?? streamedAdvice).trim() || 'I generated a response, but it came back empty.'
      const finalScript = (finalPayload?.script ?? streamedScript).trim() || null
      const finalSubject = (finalPayload?.subject ?? streamedSubject).trim() || null
      const finalTitle = (finalPayload?.title ?? streamedTitle).trim()

      setAiText(messageContent)
      setAiReasoningText(streamedReasoning)
      setAiScriptText(finalScript || '')
      setAiScriptSubject(finalSubject || '')

      if (finalTitle && shouldGenerateTitle) {
        renameChat(activeChat.id, finalTitle)
      }

      if (finalPayload?.updatedAt) {
        markChatUpdated(activeChat.id, finalPayload.updatedAt)
      }

      if (finalPayload?.message) {
        setMessages(prev => [...prev, finalPayload.message!])
      } else if (messageContent) {
        setMessages(prev => [...prev, {
          id: crypto.randomUUID(),
          deal_id: deal.id,
          chat_id: activeChat.id,
          user_id: user.id,
          role: 'ai',
          content: messageContent,
          subject: finalSubject,
          suggested_script: finalScript,
          created_at: new Date().toISOString(),
        } as DealMessage])
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        // Save error message so conversation isn't broken
        setMessages(prev => [...prev, {
          id: crypto.randomUUID(),
          deal_id: deal.id,
          chat_id: activeChat.id,
          user_id: user?.id ?? '',
          role: 'ai',
          content: `Sorry, I ran into an error${err.message ? `: ${err.message}` : '.'}`,
          subject: null,
          suggested_script: null,
          created_at: new Date().toISOString(),
        } as DealMessage])
      }
    } finally {
      setAiTyping(false)
      setAiText('')
      setAiReasoningText('')
      setAiScriptText('')
      setAiScriptSubject('')
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

    const title = 'New Chat'
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
    setChatMenuOpen(false)
    router.push(`/deal/${deal.id}?chat=${newChat.id}`)
    router.refresh()
  }

  function openChat(chatId: string) {
    if (chatId === currentChat?.id) return
    setChatMenuOpen(false)
    router.push(`/deal/${deal.id}?chat=${chatId}`)
  }

  async function deleteChat(chatId: string) {
    if (deletingChatId) return

    const remainingChats = chats.filter(chat => chat.id !== chatId)
    const nextChat = currentChat?.id === chatId ? remainingChats[0] ?? null : currentChat

    setDeletingChatId(chatId)

    const { error } = await supabase.from('deal_chats').delete().eq('id', chatId)

    if (error) {
      setDeletingChatId(null)
      return
    }

    setChats(remainingChats)

    if (currentChat?.id === chatId) {
      setCurrentChat(nextChat)
      setMessages([])
      setAiText('')
      setAiScriptText('')
      setInput('')
    }

    setDeletingChatId(null)

    if (nextChat) {
      router.push(`/deal/${deal.id}?chat=${nextChat.id}`)
    } else {
      router.push(`/deal/${deal.id}`)
      router.refresh()
    }
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

  const visibleMessages = getVisibleMessages()
  const displayChat = currentChat ?? getDraftChat(deal)

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
              <div className="relative" ref={chatMenuRef}>
                <h3 className="font-semibold text-sm">Negotiation Assistant</h3>
                <button
                  type="button"
                  onClick={() => setChatMenuOpen(prev => !prev)}
                  className="mt-1 inline-flex items-center gap-2 rounded-xl border border-border bg-muted-light px-3 py-2 text-sm font-medium transition-colors hover:bg-muted-light/80"
                >
                  <span className="max-w-[180px] truncate">{displayChat.title}</span>
                  <ChevronDown className={`w-4 h-4 text-muted transition-transform ${chatMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {chatMenuOpen && (
                  <div className="absolute left-0 top-full z-20 mt-2 w-72 rounded-2xl border border-border bg-white p-2 shadow-xl">
                    <div className="max-h-72 overflow-y-auto">
                      {chats.map(chat => (
                        <div
                          key={chat.id}
                          className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors ${
                            chat.id === currentChat?.id
                              ? 'bg-primary/8 text-foreground'
                              : 'hover:bg-muted-light'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => openChat(chat.id)}
                            className="flex min-w-0 flex-1 items-center justify-between text-left"
                          >
                            <span className="truncate font-medium">{chat.title}</span>
                            {chat.id === currentChat?.id && <Check className="ml-3 w-4 h-4 shrink-0 text-primary" />}
                          </button>
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation()
                              deleteChat(chat.id)
                            }}
                            disabled={deletingChatId === chat.id}
                            aria-label={`Delete ${chat.title}`}
                            className="shrink-0 rounded-lg p-1.5 text-muted transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="mt-2 border-t border-border pt-2">
                      <button
                        type="button"
                        onClick={createChat}
                        disabled={creatingChat}
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-3 text-left text-sm font-medium text-muted transition-colors hover:bg-muted-light disabled:opacity-50"
                      >
                        <Plus className="w-4 h-4" />
                        {creatingChat ? 'Starting...' : 'Start a new chat'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <span className="text-xs text-muted">AI-powered advice</span>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {visibleMessages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'brand' || msg.role === 'creator' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] ${
                  msg.role === 'brand' || msg.role === 'creator'
                    ? 'bg-secondary text-white rounded-2xl rounded-br-sm px-5 py-3'
                    : msg.role === 'ai'
                    ? 'bg-muted-light rounded-2xl rounded-bl-sm px-5 py-3'
                    : 'bg-blue-50 rounded-2xl px-5 py-3'
                }`}>
                  <p className="text-xs font-medium mb-1 opacity-60">
                    {msg.role === 'ai' ? 'RateProof AI' : 'You'}
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
                      {msg.subject && (
                        <p className="mb-2 text-sm font-semibold text-foreground whitespace-pre-wrap">{msg.subject}</p>
                      )}
                      <p className="text-sm italic text-muted leading-relaxed whitespace-pre-wrap">{msg.suggested_script}</p>
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
                  {aiReasoningText && (
                    <div className="mt-3 rounded-xl border border-border bg-white/50 p-4">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted">Thinking</span>
                      <p className="mt-2 text-sm leading-relaxed text-muted whitespace-pre-wrap">{aiReasoningText}</p>
                    </div>
                  )}
                  {aiScriptText && (
                    <div className="mt-3 rounded-xl border border-primary/20 bg-white/10 p-4">
                      <span className="text-xs font-semibold uppercase tracking-wider text-primary">Recommended Script</span>
                      {aiScriptSubject && (
                        <p className="mt-2 text-sm font-semibold text-foreground whitespace-pre-wrap">{aiScriptSubject}</p>
                      )}
                      <p className="mt-2 text-sm italic leading-relaxed text-muted whitespace-pre-wrap">{aiScriptText}</p>
                    </div>
                  )}
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
                  placeholder="Tell me what happened in the negotiation..."
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
