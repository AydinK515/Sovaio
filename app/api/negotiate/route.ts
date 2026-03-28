import { createOpenAI } from '@ai-sdk/openai'
import { streamText, createTextStreamResponse } from 'ai'

export const runtime = 'edge'

export async function POST(req: Request) {
  const { brandMessage, deal, messageHistory } = await req.json()

  const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY })

  const systemPrompt = `You are RateProof AI, an expert negotiation advisor for YouTube creators dealing with brand sponsorship negotiations.

The creator's deal context:
- Brand: ${deal.brand_name}
- Deal type: ${deal.deal_type === 'dedicated_video' ? 'Dedicated Video' : deal.deal_type === 'integration_60s' ? '60-second Integration' : '30-second Integration'}
- Creator's asking price: $${deal.creator_ask?.toLocaleString() ?? 'not set'}
${deal.brand_last_offer ? `- Brand's last known offer: $${deal.brand_last_offer.toLocaleString()}` : ''}
${deal.timeline ? `- Timeline: ${deal.timeline}` : ''}
${deal.notes ? `- Additional notes: ${deal.notes}` : ''}

Your job is to analyze what the brand just said and give the creator tactical negotiation advice. Be direct, confident, and specific.

Format your response in EXACTLY this structure — no other format is acceptable:

[Your tactical analysis and advice in 2-4 sentences. Be specific about leverage, psychology, and what the creator should do next.]

---SCRIPT---
[A ready-to-send reply the creator can use verbatim or adapt. Write it in first person as the creator. Keep it professional but assertive.]

The ---SCRIPT--- separator must appear exactly as written. Do not add anything after the script.`

  const history = (messageHistory as Array<{ role: string; content: string }>)
    .filter(m => m.role === 'brand' || m.role === 'ai')
    .map(m => ({
      role: m.role === 'ai' ? 'assistant' : 'user',
      content: m.content,
    })) as Array<{ role: 'user' | 'assistant'; content: string }>

  const result = streamText({
    model: openai('gpt-4o-mini'),
    system: systemPrompt,
    messages: [
      ...history,
      { role: 'user', content: brandMessage },
    ],
    maxOutputTokens: 400,
    temperature: 0.7,
  })

  return createTextStreamResponse({ textStream: result.textStream })
}
