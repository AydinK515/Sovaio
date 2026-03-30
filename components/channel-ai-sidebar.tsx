'use client'

import React, { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { getChannelAssistantOpeningMessage } from '@/lib/channel-ai'
import type { AnalyticsSnapshot, ChannelAiChat, ChannelAiMessage } from '@/lib/types'
import { Bot, Check, ChevronDown, MessageSquare, Plus, Send, Square, X } from 'lucide-react'
import FancySelect from '@/components/fancy-select'

function renderMarkdown(text: string) {
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let i = 0
  let key = 0

  while (i < lines.length) {
    const line = lines[i]

    if (line.trim() === '') {
      i++
      continue
    }

    if (/^[-*]\s/.test(line.trim())) {
      const items: string[] = []
      while (i < lines.length && /^[-*]\s/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s/, ''))
        i++
      }
      elements.push(
        <ul key={key++} className="list-outside list-disc space-y-0.5 my-1 pl-5">
          {items.map((item, j) => (
            <li key={j} className="pl-1 text-sm leading-relaxed">{inlineFormat(item)}</li>
          ))}
        </ul>
      )
      continue
    }

    if (/^\d+\.\s/.test(line.trim())) {
      const items: string[] = []
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s/, ''))
        i++
      }
      elements.push(
        <ol key={key++} className="list-outside list-decimal space-y-0.5 my-1 pl-5">
          {items.map((item, j) => (
            <li key={j} className="pl-1 text-sm leading-relaxed">{inlineFormat(item)}</li>
          ))}
        </ol>
      )
      continue
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.+)/)
    if (headingMatch) {
      const level = headingMatch[1].length
      const content = headingMatch[2]
      elements.push(
        <p key={key++} className={`font-semibold leading-relaxed ${level === 1 ? 'text-base' : 'text-sm'} mt-2 mb-0.5`}>
          {inlineFormat(content)}
        </p>
      )
      i++
      continue
    }

    elements.push(
      <p key={key++} className="text-sm leading-relaxed">
        {inlineFormat(line)}
      </p>
    )
    i++
  }

  return elements.length > 0 ? <div className="space-y-1">{elements}</div> : null
}

function inlineFormat(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={i}>{part.slice(1, -1)}</em>
    }
    return part
  })
}

const THINKING_LABELS = ['Thinking...', 'Reviewing stats...', 'Checking rates...', 'Shaping advice...']

function ThinkingLabel() {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setIndex(prev => (prev + 1) % THINKING_LABELS.length)
    }, 2400)
    return () => clearInterval(id)
  }, [])

  return <span className="text-sm font-medium text-muted">{THINKING_LABELS[index]}</span>
}

function ReasoningDropdown({ text }: { text: string }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className="flex items-center gap-1 text-xs text-muted hover:text-foreground transition-colors"
      >
        <ChevronDown
          className="h-3.5 w-3.5 transition-transform duration-200"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
        Thought for a couple seconds
      </button>
      {open && (
        <p className="mt-2 border-l-2 border-border pl-3 text-sm leading-relaxed text-muted whitespace-pre-wrap">
          {text}
        </p>
      )}
    </div>
  )
}

const CHANNEL_TEMPLATE_QUESTIONS = [
  'What can you do?',
  'What do you know about my channel?',
]

export default function ChannelAiSidebar({
  initialSnapshots,
  initialChats,
  initialChat,
  initialMessages,
  channelName,
}: {
  initialSnapshots: AnalyticsSnapshot[]
  initialChats: ChannelAiChat[]
  initialChat: ChannelAiChat | null
  initialMessages: ChannelAiMessage[]
  channelName: string | null
}) {
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [snapshots] = useState(initialSnapshots)
  const [chats, setChats] = useState(initialChats)
  const [currentChat, setCurrentChat] = useState(initialChat)
  const [messages, setMessages] = useState(initialMessages)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [aiTyping, setAiTyping] = useState(false)
  const [aiText, setAiText] = useState('')
  const [aiReasoningText, setAiReasoningText] = useState('')
  const [rateLimitType, setRateLimitType] = useState<'chat' | 'daily' | null>(null)
  const [chatMenuOpen, setChatMenuOpen] = useState(false)
  const [selectedSnapshotId, setSelectedSnapshotId] = useState(initialChat?.analytics_snapshot_id ?? initialSnapshots[0]?.id ?? '')
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const aiTextRef = useRef('')
  const chatMenuRef = useRef<HTMLDivElement | null>(null)

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
    if (open) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [open, messages, aiTyping, aiText, aiReasoningText])

  function sortChats(nextChats: ChannelAiChat[]) {
    return [...nextChats].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
  }

  function renameChatLocally(chatId: string, title: string) {
    setChats(prev => prev.map(chat => chat.id === chatId ? { ...chat, title } : chat))
    setCurrentChat(prev => prev && prev.id === chatId ? { ...prev, title } : prev)
  }

  function markChatUpdated(chatId: string, updatedAt: string) {
    setChats(prev => sortChats(prev.map(chat => chat.id === chatId ? { ...chat, updated_at: updatedAt } : chat)))
  }

  function getVisibleMessages() {
    const activeSnapshot = snapshots.find(snapshot => snapshot.id === (currentChat?.analytics_snapshot_id ?? selectedSnapshotId)) ?? null
    const openingMessage = getChannelAssistantOpeningMessage(activeSnapshot, channelName)
    if (messages.some(message => message.role === 'ai' && message.content === openingMessage)) {
      return messages
    }

    return [
      {
        id: `opening-${currentChat?.id ?? 'draft'}`,
        chat_id: currentChat?.id ?? 'draft',
        user_id: currentChat?.user_id ?? 'draft',
        role: 'ai',
        content: openingMessage,
        created_at: currentChat?.created_at ?? new Date().toISOString(),
      } as ChannelAiMessage,
      ...messages,
    ]
  }

  async function loadChat(chat: ChannelAiChat) {
    const { data } = await supabase
      .from('channel_ai_messages')
      .select('*')
      .eq('chat_id', chat.id)
      .order('created_at', { ascending: true })

    setCurrentChat(chat)
    setSelectedSnapshotId(chat.analytics_snapshot_id ?? snapshots[0]?.id ?? '')
    setMessages((data || []) as ChannelAiMessage[])
    setRateLimitType(null)
  }

  function createChat() {
    setCurrentChat(null)
    setMessages([])
    setInput('')
    setRateLimitType(null)
  }

  async function updateSnapshot(nextSnapshotId: string) {
    setSelectedSnapshotId(nextSnapshotId)

    if (!currentChat) return

    await supabase
      .from('channel_ai_chats')
      .update({
        analytics_snapshot_id: nextSnapshotId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', currentChat.id)

    setCurrentChat(prev => prev ? { ...prev, analytics_snapshot_id: nextSnapshotId } : prev)
    setChats(prev => prev.map(chat => chat.id === currentChat.id ? { ...chat, analytics_snapshot_id: nextSnapshotId } : chat))
  }

  function stopGeneration() {
    abortRef.current?.abort()
  }

  async function sendMessage(prefilledText?: string) {
    const trimmedInput = (prefilledText ?? input).trim()
    if (!trimmedInput || sending) return

    const creatorCount = messages.filter(message => message.role === 'creator').length
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

    let activeChat = currentChat
    const userText = trimmedInput
    const shouldGenerateTitle = !activeChat || activeChat.title === 'New Chat'

    if (!activeChat) {
      const { data: newChat } = await supabase
        .from('channel_ai_chats')
        .insert({
          user_id: user.id,
          analytics_snapshot_id: selectedSnapshotId || null,
          title: 'New Chat',
        })
        .select('*')
        .single()

      if (!newChat) {
        setSending(false)
        return
      }

      const openingSnapshot = snapshots.find(snapshot => snapshot.id === (selectedSnapshotId || newChat.analytics_snapshot_id)) ?? null
      const openingMessage = getChannelAssistantOpeningMessage(openingSnapshot, channelName)
      const { data: openingAiMessage } = await supabase
        .from('channel_ai_messages')
        .insert({
          chat_id: newChat.id,
          user_id: user.id,
          role: 'ai',
          content: openingMessage,
        })
        .select('*')
        .single()

      activeChat = newChat as ChannelAiChat
      setChats(prev => sortChats([activeChat!, ...prev]))
      setCurrentChat(activeChat)
      setMessages(openingAiMessage ? [openingAiMessage as ChannelAiMessage] : [])
    }

    if (!activeChat) {
      setSending(false)
      return
    }

    const { data: userMessage } = await supabase
      .from('channel_ai_messages')
      .insert({
        chat_id: activeChat.id,
        user_id: user.id,
        role: 'creator',
        content: userText,
      })
      .select('*')
      .single()

    if (userMessage) {
      setMessages(prev => [...prev, userMessage as ChannelAiMessage])
    }

    const messageTimestamp = new Date().toISOString()
    await supabase.from('channel_ai_chats').update({ updated_at: messageTimestamp }).eq('id', activeChat.id)
    markChatUpdated(activeChat.id, messageTimestamp)

    setInput('')
    setSending(false)
    setAiTyping(true)
    setAiText('')
    setAiReasoningText('')
    aiTextRef.current = ''

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const response = await fetch('/api/channel-assistant', {
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
          setRateLimitType(body === 'CHAT_LIMIT_REACHED' ? 'chat' : 'daily')
          setAiTyping(false)
          return
        }
        throw new Error(await response.text().catch(() => 'Failed to generate channel advice.'))
      }

      if (!response.body) throw new Error('API returned no response body')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let eventBuffer = ''
      let streamedTitle = ''
      let streamedAdvice = ''
      let streamedReasoning = ''
      let finalPayload: { title?: string; advice?: string; updatedAt?: string; message?: ChannelAiMessage | null } | null = null

      while (true) {
        const { value, done } = await reader.read()
        if (done) break

        eventBuffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n')

        while (true) {
          const boundaryIndex = eventBuffer.indexOf('\n\n')
          if (boundaryIndex === -1) break
          const rawEvent = eventBuffer.slice(0, boundaryIndex)
          eventBuffer = eventBuffer.slice(boundaryIndex + 2)
          const data = rawEvent.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trim()).join('\n')
          if (!data) continue

          const event = JSON.parse(data) as
            | { type: 'partial'; payload: { title?: string; advice?: string } }
            | { type: 'reasoning'; payload: { reasoningDelta?: string } }
            | { type: 'final'; payload: { title?: string; advice?: string; updatedAt?: string; message?: ChannelAiMessage | null } }
            | { type: 'error'; message?: string }

          if (event.type === 'error') throw new Error(event.message || 'Streaming failed')
          if (event.type === 'reasoning' && typeof event.payload.reasoningDelta === 'string') {
            streamedReasoning += event.payload.reasoningDelta
            setAiReasoningText(streamedReasoning)
            continue
          }
          if (event.type === 'partial' || event.type === 'final') {
            if (typeof event.payload.title === 'string') streamedTitle = event.payload.title
            if (typeof event.payload.advice === 'string') {
              streamedAdvice = event.payload.advice
              aiTextRef.current = streamedAdvice
              setAiText(streamedAdvice)
            }
          }
          if (event.type === 'final') finalPayload = event.payload
        }
      }

      const finalTitle = (finalPayload?.title ?? streamedTitle).trim()
      const finalAdvice = (finalPayload?.advice ?? streamedAdvice).trim() || 'I generated a response, but it came back empty.'

      if (finalTitle && shouldGenerateTitle) {
        renameChatLocally(activeChat.id, finalTitle)
      }
      if (finalPayload?.updatedAt) {
        markChatUpdated(activeChat.id, finalPayload.updatedAt)
      }

      setMessages(prev => [...prev, finalPayload?.message ?? {
        id: crypto.randomUUID(),
        chat_id: activeChat.id,
        user_id: user.id,
        role: 'ai',
        content: finalAdvice,
        reasoning_summary: streamedReasoning.trim() || null,
        created_at: new Date().toISOString(),
      } as ChannelAiMessage])
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        const partial = aiTextRef.current.trim()
        if (partial) {
          const { data: savedPartial } = await supabase
            .from('channel_ai_messages')
            .insert({
              chat_id: activeChat.id,
              user_id: user.id,
              role: 'ai',
              content: partial,
              reasoning_summary: aiReasoningText.trim() || null,
            })
            .select('*')
            .single()
          setMessages(prev => [...prev, (savedPartial ?? {
            id: crypto.randomUUID(),
            chat_id: activeChat.id,
            user_id: user.id,
            role: 'ai',
            content: partial,
            reasoning_summary: aiReasoningText.trim() || null,
            created_at: new Date().toISOString(),
          }) as ChannelAiMessage])
        }
      } else {
        setMessages(prev => [...prev, {
          id: crypto.randomUUID(),
          chat_id: activeChat.id,
          user_id: user.id,
          role: 'ai',
          content: 'Sorry, I ran into an error while answering that.',
          created_at: new Date().toISOString(),
        } as ChannelAiMessage])
      }
    } finally {
      setAiTyping(false)
      setAiText('')
      setAiReasoningText('')
      abortRef.current = null
    }
  }

  const visibleMessages = getVisibleMessages()
  const showTemplateQuestions = currentChat === null && messages.length === 0 && !aiTyping
  const currentSnapshot = snapshots.find(snapshot => snapshot.id === (currentChat?.analytics_snapshot_id ?? selectedSnapshotId)) ?? null
  const snapshotOptions = snapshots.map((snapshot) => ({
    value: snapshot.id,
    label: snapshot.name,
  }))

  return (
    <aside
      className={`sticky top-[65px] hidden h-[calc(100dvh-65px)] shrink-0 border-l border-border bg-white transition-[width] duration-300 ease-out lg:flex ${
        open ? 'w-[420px] xl:w-[460px]' : 'w-16'
      }`}
    >
      {open ? (
        <div className="flex w-full min-w-0 flex-col">
            <div className="border-b border-border px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary text-white">
                      <MessageSquare className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-sm font-semibold">Channel Advisor</h2>
                      <p className="text-xs text-muted">For your channel stats, sponsorship positioning, and analytics-backed context</p>
                      <div className="relative mt-2" ref={chatMenuRef}>
                        <button
                          type="button"
                          onClick={() => setChatMenuOpen(prev => !prev)}
                          className="inline-flex max-w-full items-center gap-2 rounded-xl border border-border bg-muted-light px-3 py-2 text-sm font-medium transition-colors hover:bg-muted-light/80"
                        >
                          <span className="max-w-[180px] truncate">{currentChat?.title || 'New Chat'}</span>
                          <ChevronDown className={`h-4 w-4 text-muted transition-transform ${chatMenuOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {chatMenuOpen && (
                          <div className="absolute left-0 top-full z-20 mt-2 w-80 rounded-2xl border border-border bg-white p-2 shadow-xl">
                            <div className="max-h-80 overflow-y-auto">
                              {currentChat === null && (
                                <div className="flex items-center gap-2 rounded-xl bg-primary/8 px-3 py-2 text-sm text-foreground">
                                  <span className="flex min-w-0 flex-1 items-center justify-between">
                                    <span className="truncate font-medium">New Chat</span>
                                    <Check className="ml-3 h-4 w-4 shrink-0 text-primary" />
                                  </span>
                                </div>
                              )}
                              {chats.map(chat => (
                                <button
                                  key={chat.id}
                                  type="button"
                                  onClick={() => {
                                    void loadChat(chat)
                                    setChatMenuOpen(false)
                                  }}
                                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-medium transition-colors ${
                                    chat.id === currentChat?.id ? 'bg-primary/8 text-foreground' : 'hover:bg-muted-light'
                                  }`}
                                >
                                  <span className="truncate">{chat.title}</span>
                                  {chat.id === currentChat?.id && <Check className="ml-3 h-4 w-4 shrink-0 text-primary" />}
                                </button>
                              ))}
                            </div>

                            <div className="mt-2 border-t border-border pt-2">
                              <button
                                type="button"
                                onClick={() => {
                                  createChat()
                                  setChatMenuOpen(false)
                                }}
                                className="flex w-full items-center gap-2 rounded-xl px-3 py-3 text-left text-sm font-medium text-muted transition-colors hover:bg-muted-light hover:text-foreground"
                              >
                                <Plus className="h-4 w-4" />
                                Start a new chat
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  {snapshots.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      <FancySelect
                        value={currentChat?.analytics_snapshot_id ?? selectedSnapshotId}
                        onChange={(nextValue) => void updateSnapshot(nextValue)}
                        options={snapshotOptions}
                        triggerClassName="px-3 py-2"
                      />
                      <p className="text-xs text-muted">{channelName || 'Your channel'} | {currentSnapshot ? `${currentSnapshot.report_confidence}% confidence snapshot` : 'Select snapshot'}</p>
                    </div>
                  ) : (
                    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs leading-relaxed text-amber-800">
                      Upload analytics first so Channel Advisor can ground its answers in your real channel data.
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border text-muted transition-colors hover:bg-muted-light hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5">
              {visibleMessages.map(message => (
                <div key={message.id} className={`flex ${message.role === 'creator' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[88%] rounded-2xl px-4 py-3 ${
                    message.role === 'creator'
                      ? 'rounded-br-sm bg-secondary text-white'
                      : 'rounded-bl-sm bg-muted-light text-foreground'
                  }`}>
                    <p className="mb-1 text-xs font-medium opacity-60">
                      {message.role === 'creator' ? 'You' : 'RateProof AI'}
                    </p>
                    {message.role === 'ai' && message.reasoning_summary && (
                      <ReasoningDropdown text={message.reasoning_summary} />
                    )}
                    {message.role === 'ai'
                      ? <div className="space-y-1">{renderMarkdown(message.content)}</div>
                      : <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>}
                  </div>
                </div>
              ))}

              {aiTyping && (
                <div className="flex justify-start">
                  <div className="max-w-[88%] rounded-2xl rounded-bl-sm bg-muted-light px-4 py-3 text-foreground">
                    <p className="mb-1 text-xs font-medium opacity-60">RateProof AI</p>
                    {!aiText && (
                      <div className="text-sm leading-relaxed">
                        {aiReasoningText
                          ? <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted">{aiReasoningText}</p>
                          : <ThinkingLabel />}
                      </div>
                    )}
                    {aiText && (
                      <>
                        {aiReasoningText && <ReasoningDropdown text={aiReasoningText} />}
                        <div className="mt-1 space-y-1 text-sm leading-relaxed">
                          {renderMarkdown(aiText)}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

          <div className="border-t border-border p-4">
              {rateLimitType === 'chat' ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center">
                  <p className="text-sm font-medium text-amber-800">This chat has reached the 30-message limit.</p>
                  <p className="mt-0.5 text-sm text-amber-700">Start a new chat to keep going.</p>
                </div>
              ) : rateLimitType === 'daily' ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center">
                  <p className="text-sm font-medium text-red-800">You&apos;ve reached your 100-message daily limit.</p>
                  <p className="mt-0.5 text-sm text-red-700">That limit is shared across the sidebar and negotiation chats.</p>
                </div>
              ) : (
                <>
                  {showTemplateQuestions && (
                    <div className="mb-3 flex flex-col gap-2">
                      {CHANNEL_TEMPLATE_QUESTIONS.map(question => (
                        <button
                          key={question}
                          type="button"
                          onClick={() => sendMessage(question)}
                          disabled={sending}
                          className="rounded-2xl border border-border bg-white px-4 py-3 text-left text-sm font-medium text-foreground transition-colors hover:bg-muted-light disabled:opacity-50"
                        >
                          {question}
                        </button>
                      ))}
                    </div>
                  )}
                  <form onSubmit={event => { event.preventDefault(); sendMessage() }} className="flex items-end gap-3">
                    <textarea
                      value={input}
                      onChange={event => setInput(event.target.value)}
                      onKeyDown={event => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault()
                          sendMessage()
                        }
                      }}
                      placeholder={snapshots.length > 0 ? 'Ask about your channel, audience, or positioning...' : 'Upload analytics first to use Channel Advisor'}
                      disabled={sending || snapshots.length === 0}
                      rows={1}
                      className="flex-1 resize-none overflow-hidden rounded-xl border border-border px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
                      style={{ minHeight: '44px', maxHeight: '160px' }}
                      ref={element => {
                        if (element) {
                          element.style.height = 'auto'
                          element.style.height = Math.min(element.scrollHeight, 160) + 'px'
                        }
                      }}
                    />
                    {aiTyping ? (
                      <button
                        type="button"
                        onClick={stopGeneration}
                        className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-white transition-colors hover:bg-primary-hover"
                      >
                        <Square className="h-4 w-4 fill-white" />
                      </button>
                    ) : (
                      <button
                        type="submit"
                        disabled={!input.trim() || sending || snapshots.length === 0}
                        className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
                      >
                        <Send className="h-4 w-4" />
                      </button>
                    )}
                  </form>
                </>
              )}
          </div>
        </div>
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-between py-4">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-white shadow-sm transition-colors hover:bg-primary-hover"
            aria-label="Open Channel Advisor"
          >
            <Bot className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="[writing-mode:vertical-rl] rotate-180 text-xs font-semibold uppercase tracking-[0.3em] text-muted"
          >
            Channel Advisor
          </button>
          <div className="h-11 w-11" />
        </div>
      )}
    </aside>
  )
}
