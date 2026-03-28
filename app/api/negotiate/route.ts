import { parsePartialJson } from 'ai'

const negotiationResponseSchema = {
  type: 'object',
  properties: {
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
      description: 'A ready-to-send reply or a short prompt asking the creator for missing context',
    },
  },
  required: ['title', 'advice', 'script'],
  additionalProperties: false,
} as const

function formatSseEvent(data: unknown) {
  return `data: ${JSON.stringify(data)}\n\n`
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

    const systemPrompt = `You are RateProof AI, an expert negotiation advisor for YouTube creators dealing with brand sponsorship negotiations.

The creator's deal context:
- Brand: ${deal.brand_name}
- Deal type: ${deal.deal_type === 'dedicated_video' ? 'Dedicated Video' : deal.deal_type === 'integration_60s' ? '60-second Integration' : '30-second Integration'}
- Creator's asking price: $${deal.creator_ask?.toLocaleString() ?? 'not set'}
${deal.brand_last_offer ? `- Brand's last known offer: $${deal.brand_last_offer.toLocaleString()}` : ''}
${deal.timeline ? `- Timeline: ${deal.timeline}` : ''}
${deal.notes ? `- Additional notes: ${deal.notes}` : ''}

You are speaking to the creator, not the brand.
Treat every user message as the creator talking to you unless they clearly signal they are quoting or paraphrasing the brand with phrasing like "they said", "the brand replied", quotes, pasted email text, or similar context.

Your job is to help the creator think through the negotiation update they just shared and give tactical advice. Be direct, specific, and commercially realistic.

Rules:
- Protect the creator's leverage without sounding hostile.
- If the creator clearly shared the brand's position, analyze it and suggest a credible next move.
- If the creator did not clearly share what the brand said, do not pretend they did. Ask for the missing context and tell them exactly what details to paste next.
- Never invent campaign details that were not provided.
- Keep the advice concise and the reply usable in a real email or DM thread.
- The chat title must be 1 to 5 words, plain text only, and summarize the creator's latest update.
${generateTitle ? '' : '\n- Keep the title stable if the existing chat title is already good.'}`

    const history = (messageHistory as Array<{ role: string; content: string }>)
      .filter(m => m.role === 'brand' || m.role === 'creator' || m.role === 'ai')
      .map(m => ({
        role: m.role === 'ai' ? 'assistant' : 'user',
        content: m.content,
      })) as Array<{ role: 'user' | 'assistant'; content: string }>

    const upstreamResponse = await fetch(
      `${useGateway ? 'https://ai-gateway.vercel.sh/v1' : 'https://api.openai.com/v1'}/chat/completions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: useGateway ? 'openai/gpt-5-mini' : 'gpt-5-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            ...history,
            { role: 'user', content: latestUserMessage },
          ],
          stream: true,
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'negotiation_response',
              description: 'Structured negotiation guidance for a creator-brand discussion',
              schema: negotiationResponseSchema,
            },
          },
          max_completion_tokens: 400,
          reasoning_effort: 'minimal',
          verbosity: 'low',
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
        let lastSent = {
          title: '',
          advice: '',
          script: '',
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

              const chunk = JSON.parse(data) as {
                choices?: Array<{ delta?: { content?: string | null } }>
              }
              const content = chunk.choices?.[0]?.delta?.content
              if (!content) continue

              jsonBuffer += content

              const parsed = await parsePartialJson(jsonBuffer)
              const partial = parsed.value

              if (!partial || typeof partial !== 'object' || Array.isArray(partial)) {
                continue
              }

              const next = {
                title: typeof partial.title === 'string' ? partial.title : '',
                advice: typeof partial.advice === 'string' ? partial.advice : '',
                script: typeof partial.script === 'string' ? partial.script : '',
              }

              if (
                next.title !== lastSent.title ||
                next.advice !== lastSent.advice ||
                next.script !== lastSent.script
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

          if (
            finalObject &&
            typeof finalObject === 'object' &&
            !Array.isArray(finalObject) &&
            typeof finalObject.title === 'string' &&
            typeof finalObject.advice === 'string' &&
            typeof finalObject.script === 'string'
          ) {
            controller.enqueue(
              encoder.encode(
                formatSseEvent({
                  type: 'final',
                  payload: {
                    title: finalObject.title,
                    advice: finalObject.advice,
                    script: finalObject.script,
                  },
                })
              )
            )
          } else {
            controller.enqueue(
              encoder.encode(
                formatSseEvent({
                  type: 'error',
                  message: 'The model returned an invalid structured response.',
                })
              )
            )
          }
        } catch (error) {
          console.error('Negotiation AI streaming failed', error)
          controller.enqueue(
            encoder.encode(
              formatSseEvent({
                type: 'error',
                message: 'Failed to stream negotiation advice.',
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
