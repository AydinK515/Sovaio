import { parsePartialJson } from 'ai'

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

function formatSseEvent(data: unknown) {
  return `data: ${JSON.stringify(data)}\n\n`
}

function buildFallbackPayload(input: {
  latestUserMessage: string
  lastSent: { intent: string; title: string; advice: string; script: string; subject: string }
  lastValidPayload: { intent: string; title: string; advice: string; script: string; subject: string } | null
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

export async function POST(req: Request) {
  try {
    const { brandMessage, userMessage, deal, messageHistory, generateTitle } = await req.json()
    const latestUserMessage = (userMessage ?? brandMessage ?? '').trim()
    const apiKey = process.env.AI_GATEWAY_API_KEY ?? process.env.OPENAI_API_KEY
    const useGateway = Boolean(process.env.AI_GATEWAY_API_KEY)

    if (!apiKey) {
      return new Response('Missing AI_GATEWAY_API_KEY or OPENAI_API_KEY', { status: 500 })
    }

    const systemPrompt = `You are RateProof AI, a smart negotiation copilot for YouTube creators.

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

    const history = (messageHistory as Array<{ role: string; content: string }>)
      .filter(m => m.role === 'brand' || m.role === 'creator' || m.role === 'ai')
      .map(m => ({
        role: m.role === 'ai' ? 'assistant' : 'user',
        content: m.content,
      })) as Array<{ role: 'user' | 'assistant'; content: string }>

    const upstreamResponse = await fetch(
      `${useGateway ? 'https://ai-gateway.vercel.sh/v1' : 'https://api.openai.com/v1'}/responses`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: useGateway ? 'openai/gpt-5' : 'gpt-5',
          instructions: systemPrompt,
          input: [
            ...history,
            { role: 'user', content: latestUserMessage },
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
      }
    )

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
        let lastValidPayload: {
          intent: string
          title: string
          advice: string
          script: string
          subject: string
        } | null = null
        let lastSent = {
          intent: '',
          title: '',
          advice: '',
          script: '',
          subject: '',
        }

        try {
          while (true) {
            const { value, done } = await reader.read()
            if (done) break

            eventBuffer += decoder.decode(value, { stream: true })

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
              if (data === '[DONE]') continue

              const event = JSON.parse(data) as
                | { type?: string; delta?: string }
                | { type?: string; error?: { message?: string } }

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

              const next = {
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
          const finalObject = finalParsed.value

          const finalPayload =
            finalObject &&
            typeof finalObject === 'object' &&
            !Array.isArray(finalObject) &&
            typeof finalObject.intent === 'string' &&
            typeof finalObject.title === 'string' &&
            typeof finalObject.advice === 'string' &&
            typeof finalObject.script === 'string' &&
            typeof finalObject.subject === 'string'
              ? {
                  intent: finalObject.intent,
                  title: finalObject.title,
                  advice: finalObject.advice,
                  script: finalObject.script,
                  subject: finalObject.subject,
                }
              : buildFallbackPayload({
                  latestUserMessage,
                  lastSent,
                  lastValidPayload,
                })

          controller.enqueue(
            encoder.encode(
              formatSseEvent({
                type: 'final',
                payload: {
                  ...finalPayload,
                  reasoning: reasoningBuffer,
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
