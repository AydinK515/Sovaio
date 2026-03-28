import { parsePartialJson } from 'ai'
import { getOpeningMessage } from '@/lib/deal-chat'
import { createClient } from '@/lib/supabase-server'
import type { Deal, DealChat, DealMessage } from '@/lib/types'

const OPENAI_API_BASE_URL = 'https://api.openai.com/v1'

const negotiationResponseSchema = {
  type: 'object',
  properties: {
    intent: {
      type: 'string',
      enum: ['small_talk', 'meta_question', 'creator_context', 'brand_update', 'strategy_request'],
      description: 'How the assistant interpreted the latest user message',
    },
    title: {
      type: 'string',
      description: 'A 1 to 5 word chat title that summarizes the creator update',
    },
    advice: {
      type: 'string',
      description: 'Tactical negotiation guidance for the creator in 2 to 4 sentences',
    },
    script: {
      type: 'string',
      description: 'A ready-to-send reply. Return an empty string when no script is needed.',
    },
    subject: {
      type: 'string',
      description: 'Email subject line when the recommended script is an email. Return an empty string when no subject is needed.',
    },
  },
  required: ['intent', 'title', 'advice', 'script', 'subject'],
  additionalProperties: false,
} as const

type NegotiationPayload = {
  intent: string
  title: string
  advice: string
  script: string
  subject: string
}

type ConversationInputItem = {
  type: 'message'
  role: 'user' | 'assistant'
  content: string
}

function formatSseEvent(data: unknown) {
  return `data: ${JSON.stringify(data)}\n\n`
}

function buildSystemPrompt(deal: Deal, generateTitle: boolean) {
  return `You are RateProof AI, a smart negotiation copilot for YouTube creators.

The creator's deal context:
- Brand: ${deal.brand_name}
- Deal type: ${deal.deal_type === 'dedicated_video' ? 'Dedicated Video' : deal.deal_type === 'integration_60s' ? '60-second Integration' : '30-second Integration'}
- Creator's asking price: $${deal.creator_ask?.toLocaleString() ?? 'not set'}
${deal.brand_last_offer ? `- Brand's last known offer: $${deal.brand_last_offer.toLocaleString()}` : ''}
${deal.timeline ? `- Timeline: ${deal.timeline}` : ''}
${deal.notes ? `- Additional notes: ${deal.notes}` : ''}

You are speaking to the creator, not the brand.
Treat every user message as the creator talking to you unless they clearly signal they are quoting or paraphrasing the brand with phrasing like "they said", "the brand replied", quotes, pasted email text, or similar context.

Before answering, classify the latest user message into exactly one intent:
- small_talk: greetings, pleasantries, banter, casual check-ins.
- meta_question: asking what you know, what information exists, what happened so far, or how you are reasoning.
- creator_context: the creator is sharing context, goals, emotions, or background, but not a concrete brand response.
- brand_update: the creator clearly shared or pasted what the brand said, offered, requested, or changed.
- strategy_request: the creator is explicitly asking what to do next, whether to counter, whether to accept, or asking for a reply draft.

Behavior rules:
- For small_talk: reply naturally and briefly like a helpful assistant. Do not pivot into negotiation analysis.
- For meta_question: answer only from known facts in the deal context and conversation history. Be precise about what you know vs. what you do not know.
- For creator_context: be helpful, but do not pretend a brand message exists if none was shared.
- For brand_update and strategy_request: give clear, commercially realistic negotiation help.
- Never invent campaign details, exact brand wording, deadlines, usage rights, payment terms, or internal facts that were not provided.
- Do not aggressively ask for missing details unless the user is actually trying to analyze a negotiation step.
- Only provide a recommended script when it would genuinely help.
- If the user is just chatting, asking a meta question, or thinking out loud, return script as an empty string.
- If the user asks for a draft, asks what to send, or has clearly provided enough brand context for a concrete reply, return a useful script.
- If script is email-style and needs a subject line, return subject as just the subject text.
- If no subject is needed, return subject as an empty string.
- Never include "Subject:" inside the script body.
- Preserve paragraph breaks and list formatting inside the script body when useful.
- The advice should fit the detected intent instead of forcing everything into negotiation triage.
- The chat title must be 1 to 5 words, plain text only, and summarize the latest user message.
${generateTitle ? '' : '\n- Keep the title stable if the existing chat title is already good.'}`
}

function isNegotiationPayload(value: unknown): value is NegotiationPayload {
  return Boolean(
    value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      typeof (value as NegotiationPayload).intent === 'string' &&
      typeof (value as NegotiationPayload).title === 'string' &&
      typeof (value as NegotiationPayload).advice === 'string' &&
      typeof (value as NegotiationPayload).script === 'string' &&
      typeof (value as NegotiationPayload).subject === 'string'
  )
}

function buildFallbackPayload(input: {
  latestUserMessage: string
  lastSent: NegotiationPayload
  lastValidPayload: NegotiationPayload | null
}) {
  if (input.lastValidPayload) return input.lastValidPayload

  const trimmedMessage = input.latestUserMessage.trim()
  const fallbackTitle =
    input.lastSent.title ||
    trimmedMessage.split(/\s+/).slice(0, 5).join(' ') ||
    'New Chat'

  const fallbackAdvice =
    input.lastSent.advice ||
    "I couldn't finish my full response, but I did get partway through it. Please send that again and I'll answer cleanly."

  return {
    intent: input.lastSent.intent || 'creator_context',
    title: fallbackTitle,
    advice: fallbackAdvice,
    script: input.lastSent.script || '',
    subject: input.lastSent.subject || '',
  }
}

async function openAiJson<T>(path: string, apiKey: string, body: unknown) {
  const response = await fetch(`${OPENAI_API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(errorText || `OpenAI request failed with status ${response.status}.`)
  }

  return response.json() as Promise<T>
}

function serializeAssistantMessage(message: DealMessage) {
  const sections = [message.content.trim()]

  if (message.subject?.trim() || message.suggested_script?.trim()) {
    const scriptSection = ['Recommended script:']

    if (message.subject?.trim()) {
      scriptSection.push(`Subject: ${message.subject.trim()}`)
    }

    if (message.suggested_script?.trim()) {
      scriptSection.push(message.suggested_script.trim())
    }

    sections.push(scriptSection.join('\n'))
  }

  return sections.filter(Boolean).join('\n\n')
}

function buildConversationSeedItems(messages: DealMessage[], deal: Deal, latestUserMessage: string) {
  const openingMessage = getOpeningMessage(deal)
  const trimmedLatestMessage = latestUserMessage.trim()
  const messagesToSeed = [...messages]
  const newestMessage = messagesToSeed.at(-1)

  if (
    newestMessage?.role === 'creator' &&
    newestMessage.content.trim() === trimmedLatestMessage
  ) {
    messagesToSeed.pop()
  }

  return messagesToSeed
    .filter(message => {
      if (
        message.role === 'ai' &&
        message.content === openingMessage &&
        !message.subject &&
        !message.suggested_script
      ) {
        return false
      }

      return true
    })
    .map<ConversationInputItem | null>(message => {
      if (message.role === 'ai') {
        const content = serializeAssistantMessage(message)
        return content
          ? {
              type: 'message',
              role: 'assistant',
              content,
            }
          : null
      }

      const content =
        message.role === 'brand'
          ? `Quoted brand message:\n${message.content.trim()}`
          : message.content.trim()

      return content
        ? {
            type: 'message',
            role: 'user',
            content,
          }
        : null
    })
    .filter((item): item is ConversationInputItem => Boolean(item))
}

async function ensureConversationState(input: {
  apiKey: string
  chat: DealChat
  deal: Deal
  latestUserMessage: string
  messages: DealMessage[]
  supabase: Awaited<ReturnType<typeof createClient>>
}) {
  if (input.chat.openai_conversation_id) {
    return input.chat.openai_conversation_id
  }

  const seedItems = buildConversationSeedItems(input.messages, input.deal, input.latestUserMessage)
  const initialItems = seedItems.slice(0, 20)
  const remainingItems = seedItems.slice(20)

  const createdConversation = await openAiJson<{ id: string }>(
    '/conversations',
    input.apiKey,
    {
      metadata: {
        deal_chat_id: input.chat.id,
        deal_id: input.chat.deal_id,
        brand_name: input.deal.brand_name.slice(0, 512),
      },
      ...(initialItems.length > 0 ? { items: initialItems } : {}),
    }
  )

  for (let i = 0; i < remainingItems.length; i += 20) {
    await openAiJson(
      `/conversations/${createdConversation.id}/items`,
      input.apiKey,
      {
        items: remainingItems.slice(i, i + 20),
      }
    )
  }

  const { error: updateError } = await input.supabase
    .from('deal_chats')
    .update({ openai_conversation_id: createdConversation.id })
    .eq('id', input.chat.id)
    .eq('user_id', input.chat.user_id)

  if (updateError) {
    throw new Error(`Failed to store OpenAI conversation state: ${updateError.message}`)
  }

  return createdConversation.id
}

export async function POST(req: Request) {
  try {
    const { chatId, userMessage, generateTitle } = await req.json()
    const latestUserMessage = typeof userMessage === 'string' ? userMessage.trim() : ''
    const apiKey = process.env.OPENAI_API_KEY

    if (!apiKey) {
      return new Response('Missing OPENAI_API_KEY.', { status: 500 })
    }

    if (!chatId || !latestUserMessage) {
      return new Response('Missing chatId or userMessage.', { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return new Response('Unauthorized.', { status: 401 })
    }

    const { data: chat } = await supabase
      .from('deal_chats')
      .select('*')
      .eq('id', chatId)
      .eq('user_id', user.id)
      .single()

    if (!chat) {
      return new Response('Chat not found.', { status: 404 })
    }

    const { data: deal } = await supabase
      .from('deals')
      .select('*')
      .eq('id', chat.deal_id)
      .eq('user_id', user.id)
      .single()

    if (!deal) {
      return new Response('Deal not found.', { status: 404 })
    }

    const { data: existingMessages } = await supabase
      .from('deal_messages')
      .select('*')
      .eq('chat_id', chat.id)
      .order('created_at', { ascending: true })

    const conversationId = await ensureConversationState({
      apiKey,
      chat: chat as DealChat,
      deal: deal as Deal,
      latestUserMessage,
      messages: (existingMessages || []) as DealMessage[],
      supabase,
    })

    const upstreamResponse = await fetch(`${OPENAI_API_BASE_URL}/responses`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5',
        conversation: conversationId,
        instructions: buildSystemPrompt(deal as Deal, Boolean(generateTitle)),
        input: [
          {
            role: 'user',
            content: latestUserMessage,
          },
        ],
        stream: true,
        text: {
          format: {
            type: 'json_schema',
            name: 'negotiation_response',
            schema: negotiationResponseSchema,
            description: 'Structured negotiation guidance for a creator-brand discussion',
            strict: true,
          },
          verbosity: 'low',
        },
        max_output_tokens: 2000,
        reasoning: {
          effort: 'low',
          summary: 'concise',
        },
      }),
    })

    if (!upstreamResponse.ok || !upstreamResponse.body) {
      const errorText = await upstreamResponse.text().catch(() => '')
      console.error('Negotiation AI upstream failed', upstreamResponse.status, errorText)
      return new Response('Failed to generate negotiation advice.', { status: 500 })
    }

    const encoder = new TextEncoder()
    const decoder = new TextDecoder()

    const stream = new ReadableStream({
      async start(controller) {
        const reader = upstreamResponse.body!.getReader()
        let eventBuffer = ''
        let jsonBuffer = ''
        let reasoningBuffer = ''
        let lastValidPayload: NegotiationPayload | null = null
        let lastSent: NegotiationPayload = {
          intent: '',
          title: '',
          advice: '',
          script: '',
          subject: '',
        }
        let latestResponseId: string | null = null

        try {
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

              if (!data || data === '[DONE]') continue

              const event = JSON.parse(data) as {
                type?: string
                delta?: string
                response?: { id?: string }
                error?: { message?: string }
              }

              if (
                (event.type === 'response.created' || event.type === 'response.completed') &&
                typeof event.response?.id === 'string'
              ) {
                latestResponseId = event.response.id
              }

              if (event.type === 'response.output_text.delta' && typeof event.delta === 'string') {
                jsonBuffer += event.delta
              }

              if (event.type === 'response.reasoning_summary_text.delta' && typeof event.delta === 'string') {
                reasoningBuffer += event.delta
                controller.enqueue(
                  encoder.encode(
                    formatSseEvent({
                      type: 'reasoning',
                      payload: {
                        reasoning: reasoningBuffer,
                      },
                    })
                  )
                )
              }

              if (event.type === 'error' || event.type === 'response.error') {
                throw new Error(event.error?.message || 'The model stream returned an error.')
              }

              if (event.type !== 'response.output_text.delta') {
                continue
              }

              const parsed = await parsePartialJson(jsonBuffer)
              const partial = parsed.value

              if (!partial || typeof partial !== 'object' || Array.isArray(partial)) {
                continue
              }

              const next: NegotiationPayload = {
                intent: typeof partial.intent === 'string' ? partial.intent : '',
                title: typeof partial.title === 'string' ? partial.title : '',
                advice: typeof partial.advice === 'string' ? partial.advice : '',
                script: typeof partial.script === 'string' ? partial.script : '',
                subject: typeof partial.subject === 'string' ? partial.subject : '',
              }

              if (next.intent && next.title && next.advice) {
                lastValidPayload = next
              }

              if (
                next.intent !== lastSent.intent ||
                next.title !== lastSent.title ||
                next.advice !== lastSent.advice ||
                next.script !== lastSent.script ||
                next.subject !== lastSent.subject
              ) {
                lastSent = next
                controller.enqueue(
                  encoder.encode(
                    formatSseEvent({
                      type: 'partial',
                      payload: next,
                    })
                  )
                )
              }
            }
          }

          const finalParsed = await parsePartialJson(jsonBuffer)
          const finalPayload = isNegotiationPayload(finalParsed.value)
            ? finalParsed.value
            : buildFallbackPayload({
                latestUserMessage,
                lastSent,
                lastValidPayload,
              })

          let savedMessage: DealMessage | null = null
          const messageContent = finalPayload.advice.trim() || 'I generated a response, but it came back empty.'
          const finalScript = finalPayload.script.trim() || null
          const finalSubject = finalPayload.subject.trim() || null
          const nextTitle = Boolean(generateTitle) && finalPayload.title.trim()
            ? finalPayload.title.trim()
            : null

          const { data: insertedAiMessage, error: aiMessageError } = await supabase
            .from('deal_messages')
            .insert({
              deal_id: chat.deal_id,
              chat_id: chat.id,
              user_id: user.id,
              role: 'ai',
              content: messageContent,
              subject: finalSubject,
              suggested_script: finalScript,
            })
            .select('*')
            .single()

          if (aiMessageError) {
            console.error('Failed to persist negotiation AI message', aiMessageError)
          } else if (insertedAiMessage) {
            savedMessage = insertedAiMessage as DealMessage
          }

          const chatUpdatedAt = savedMessage?.created_at ?? new Date().toISOString()
          const chatUpdate: {
            updated_at: string
            openai_last_response_id?: string
            title?: string
          } = {
            updated_at: chatUpdatedAt,
          }

          if (latestResponseId) {
            chatUpdate.openai_last_response_id = latestResponseId
          }

          if (nextTitle) {
            chatUpdate.title = nextTitle
          }

          const { error: chatUpdateError } = await supabase
            .from('deal_chats')
            .update(chatUpdate)
            .eq('id', chat.id)
            .eq('user_id', user.id)

          if (chatUpdateError) {
            console.error('Failed to persist negotiation chat state', chatUpdateError)
          }

          controller.enqueue(
            encoder.encode(
              formatSseEvent({
                type: 'final',
                payload: {
                  ...finalPayload,
                  reasoning: reasoningBuffer,
                  message: savedMessage,
                  updatedAt: chatUpdatedAt,
                },
              })
            )
          )
        } catch (error) {
          console.error('Negotiation AI streaming failed', error)
          controller.enqueue(
            encoder.encode(
              formatSseEvent({
                type: 'error',
                message: error instanceof Error ? error.message : 'Failed to stream negotiation advice.',
              })
            )
          )
        } finally {
          try {
            await reader.cancel()
          } catch {}
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    })
  } catch (error) {
    console.error('Negotiation AI failed', error)
    return new Response('Failed to generate negotiation advice.', { status: 500 })
  }
}
