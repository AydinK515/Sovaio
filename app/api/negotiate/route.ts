import { createOpenAI } from '@ai-sdk/openai'
import { streamText } from 'ai'

export async function POST(req: Request) {
  try {
    const { brandMessage, userMessage, deal, messageHistory, generateTitle } = await req.json()
    const latestUserMessage = (userMessage ?? brandMessage ?? '').trim()
    const apiKey = process.env.OPENAI_API_KEY

    if (!apiKey) {
      return new Response('Missing OPENAI_API_KEY', { status: 500 })
    }

    const openai = createOpenAI({ apiKey })

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

Format your response in EXACTLY this structure:

---TITLE---
[A 1-5 word title for this chat.${generateTitle ? '' : ' If the chat already has a solid title, return the existing title or a stable short summary.'}]

---ADVICE---
[Your tactical analysis and advice in 2-4 sentences.]

---SCRIPT---
[A ready-to-send reply the creator can use verbatim or adapt. Write it in first person as the creator. If they have not yet clearly shared the brand's exact response, write a short message they can send or a short prompt asking them what to paste next.]

The separators ---TITLE---, ---ADVICE---, and ---SCRIPT--- must appear exactly as written. Do not add anything after the script.`

    const history = (messageHistory as Array<{ role: string; content: string }>)
      .filter(m => m.role === 'brand' || m.role === 'creator' || m.role === 'ai')
      .map(m => ({
        role: m.role === 'ai' ? 'assistant' : 'user',
        content: m.content,
      })) as Array<{ role: 'user' | 'assistant'; content: string }>

    const result = streamText({
      model: openai('gpt-5-mini'),
      system: systemPrompt,
      messages: [
        ...history,
        { role: 'user', content: latestUserMessage },
      ],
      maxOutputTokens: 400,
      providerOptions: {
        openai: {
          reasoningEffort: 'minimal',
          textVerbosity: 'low',
        },
      },
    })
    
    return result.toTextStreamResponse({
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    })
  } catch (error) {
    console.error('Negotiation AI failed', error)
    return new Response('Failed to generate negotiation advice.', { status: 500 })
  }
}
