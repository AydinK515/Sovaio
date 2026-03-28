'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'
import type { Deal, DealChat, DealMessage } from '@/lib/types'
import { DEAL_TYPE_LABELS, formatCurrency, getOpeningMessage } from '@/lib/deal-chat'
import { Send, Square, Copy, Check, CheckCircle2, XCircle, Pause, Trophy, MessageSquare, ArrowLeft, Plus, ChevronDown, Trash2, Maximize2, Minimize2, Pencil } from 'lucide-react'

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
  const [deletingChatId, setDeletingChatId] = useState<string | null>(null)
  const [renamingChatId, setRenamingChatId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [chatMenuOpen, setChatMenuOpen] = useState(false)
  const [chatFullscreen, setChatFullscreen] = useState(false)
  const [rateLimitType, setRateLimitType] = useState<'chat' | 'daily' | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const chatMenuRef = useRef<HTMLDivElement>(null)
  const aiTextRef = useRef('')
  const aiScriptTextRef = useRef('')
  const aiScriptSubjectRef = useRef('')

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
    setRateLimitType(null)
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

  useEffect(() => {
    if (!chatFullscreen) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [chatFullscreen])

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

  async function submitRename(chatId: string) {
    const trimmed = renameValue.trim()
    setRenamingChatId(null)
    if (!trimmed) return
    const original = chats.find(c => c.id === chatId)?.title
    if (trimmed === original) return
    renameChat(chatId, trimmed)
    await supabase.from('deal_chats').update({ title: trimmed }).eq('id', chatId)
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

  function stopGeneration() {
    abortRef.current?.abort()
  }

  async function sendMessage() {
    if (!input.trim() || sending) return

    // Frontend guard: check per-chat creator message count before hitting the server.
    const creatorCount = messages.filter(m => m.role === 'creator').length
    if (creatorCount >= 30) {
      setRateLimitType('chat')
      return
    }

    setSending(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setSending(false)
      return
    }

    const userText = input.trim()
    let activeChat = currentChat
    const shouldGenerateTitle = !activeChat || activeChat.title === 'New Chat'

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

    setInput('')
    setSending(false)
    setAiTyping(true)
    setAiText('')
    setAiReasoningText('')
    setAiScriptText('')
    setAiScriptSubject('')
    aiTextRef.current = ''
    aiScriptTextRef.current = ''
    aiScriptSubjectRef.current = ''

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
        if (response.status === 429) {
          const body = await response.text().catch(() => '')
          if (body === 'CHAT_LIMIT_REACHED') {
            setRateLimitType('chat')
          } else {
            setRateLimitType('daily')
          }
          setAiTyping(false)
          setSending(false)
          return
        }
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
        detectedBrandOffer?: number | null
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
              aiTextRef.current = streamedAdvice
              setAiText(streamedAdvice)
            }

            if (typeof event.payload.script === 'string') {
              streamedScript = event.payload.script
              aiScriptTextRef.current = streamedScript
              setAiScriptText(streamedScript)
            }

            if (typeof event.payload.subject === 'string') {
              streamedSubject = event.payload.subject
              aiScriptSubjectRef.current = streamedSubject
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

      if (typeof finalPayload?.detectedBrandOffer === 'number') {
        setDeal(prev => ({ ...prev, brand_last_offer: finalPayload!.detectedBrandOffer as number }))
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
      if (err instanceof Error && err.name === 'AbortError') {
        const partial = aiTextRef.current.trim()
        if (partial) {
          const partialSubject = aiScriptSubjectRef.current.trim() || null
          const partialScript = aiScriptTextRef.current.trim() || null
          const { data: savedPartial } = await supabase.from('deal_messages').insert({
            deal_id: deal.id,
            chat_id: activeChat.id,
            user_id: user?.id ?? '',
            role: 'ai',
            content: partial,
            subject: partialSubject,
            suggested_script: partialScript,
          }).select('*').single()
          setMessages(prev => [...prev, (savedPartial ?? {
            id: crypto.randomUUID(),
            deal_id: deal.id,
            chat_id: activeChat.id,
            user_id: user?.id ?? '',
            role: 'ai',
            content: partial,
            subject: partialSubject,
            suggested_script: partialScript,
            created_at: new Date().toISOString(),
          }) as DealMessage])
        }
      } else if (err instanceof Error) {
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

  function createChat() {
    if (currentChat === null) return
    setCurrentChat(null)
    setMessages([])
    setChatMenuOpen(false)
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
    <div className="flex flex-col py-8 lg:h-[calc(100vh-14rem)] lg:overflow-hidden">
      {chatFullscreen && (
        <div
          className="fixed inset-0 z-30 bg-slate-950/20 backdrop-blur-[2px]"
          onClick={() => setChatFullscreen(false)}
        />
      )}

      <Link href="/dashboard" className="mb-6 inline-flex shrink-0 items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
      </Link>

      <div className="grid flex-1 gap-8 lg:min-h-0 lg:grid-cols-[280px_minmax(0,1fr)]">
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
        <div className={`flex flex-col overflow-hidden rounded-2xl border border-border bg-white ${
          chatFullscreen
            ? 'fixed inset-x-6 bottom-6 top-24 z-40 shadow-2xl lg:inset-x-10 lg:top-20'
            : 'lg:min-h-0 lg:h-full'
        }`}>
          <div className="flex shrink-0 items-center justify-between border-b border-border px-6 py-4">
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
                      {currentChat === null && (
                        <div className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm bg-primary/8 text-foreground">
                          <span className="flex min-w-0 flex-1 items-center justify-between">
                            <span className="truncate font-medium">New Chat</span>
                            <Check className="ml-3 w-4 h-4 shrink-0 text-primary" />
                          </span>
                        </div>
                      )}
                      {chats.map(chat => (
                        <div
                          key={chat.id}
                          className={`flex items-center gap-1 rounded-xl px-3 py-2 text-sm transition-colors ${
                            chat.id === currentChat?.id
                              ? 'bg-primary/8 text-foreground'
                              : 'hover:bg-muted-light'
                          }`}
                        >
                          {renamingChatId === chat.id ? (
                            <input
                              autoFocus
                              type="text"
                              value={renameValue}
                              onChange={e => setRenameValue(e.target.value)}
                              onBlur={() => submitRename(chat.id)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') { e.preventDefault(); submitRename(chat.id) }
                                if (e.key === 'Escape') { e.preventDefault(); setRenamingChatId(null) }
                              }}
                              onClick={e => e.stopPropagation()}
                              className="min-w-0 flex-1 rounded-lg border border-primary/40 bg-white px-2 py-0.5 text-sm font-medium outline-none focus:border-primary"
                            />
                          ) : (
                            <button
                              type="button"
                              onClick={() => openChat(chat.id)}
                              className="flex min-w-0 flex-1 items-center justify-between text-left"
                            >
                              <span className="truncate font-medium">{chat.title}</span>
                              {chat.id === currentChat?.id && <Check className="ml-3 w-4 h-4 shrink-0 text-primary" />}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation()
                              setRenameValue(chat.title)
                              setRenamingChatId(chat.id)
                            }}
                            aria-label={`Rename ${chat.title}`}
                            className="shrink-0 rounded-lg p-1.5 text-muted transition-colors hover:bg-muted-light hover:text-foreground"
                          >
                            <Pencil className="w-3.5 h-3.5" />
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
                        disabled={currentChat === null}
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-3 text-left text-sm font-medium text-muted transition-colors hover:bg-muted-light disabled:opacity-50"
                      >
                        <Plus className="w-4 h-4" />
                        Start a new chat
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted">AI-powered advice</span>
              <button
                type="button"
                onClick={() => setChatFullscreen(prev => !prev)}
                aria-label={chatFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-white text-muted transition-colors hover:bg-muted-light hover:text-foreground"
              >
                {chatFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="min-h-0 flex-1 overflow-y-auto p-6 space-y-4">
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
            <div className="shrink-0 border-t border-border p-4">
              {rateLimitType === 'chat' ? (
                <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-center">
                  <p className="text-sm font-medium text-amber-800">This chat has reached the 30-message limit.</p>
                  <p className="mt-0.5 text-sm text-amber-700">
                    Start a new chat to keep going.{' '}
                    <button
                      type="button"
                      onClick={createChat}
                      disabled={creatingChat}
                      className="font-semibold underline underline-offset-2 hover:no-underline disabled:opacity-50"
                    >
                      {creatingChat ? 'Starting...' : 'New chat'}
                    </button>
                  </p>
                </div>
              ) : rateLimitType === 'daily' ? (
                <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-center">
                  <p className="text-sm font-medium text-red-800">You&apos;ve reached your 100-message daily limit.</p>
                  <p className="mt-0.5 text-sm text-red-700">Come back tomorrow and your limit will reset.</p>
                </div>
              ) : (
                <form onSubmit={e => { e.preventDefault(); sendMessage() }} className="flex items-center gap-3">
                  <input
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder="Tell me what happened in the negotiation..."
                    disabled={sending}
                    className="flex-1 px-4 py-3 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
                  />
                  {aiTyping ? (
                    <button
                      type="button"
                      onClick={stopGeneration}
                      className="w-11 h-11 bg-primary rounded-xl flex items-center justify-center text-white hover:bg-primary-hover transition-colors"
                    >
                      <Square className="w-4 h-4 fill-white" />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={!input.trim() || sending}
                      className="w-11 h-11 bg-primary rounded-xl flex items-center justify-center text-white hover:bg-primary-hover transition-colors disabled:opacity-50"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  )}
                </form>
              )}
            </div>
          )}

          {deal.status !== 'negotiating' && (
            <div className="shrink-0 border-t border-border p-4 text-center">
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
