import { createOpenAI } from '@ai-sdk/openai'
import { generateObject } from 'ai'
import { z } from 'zod'
import { buildCsvSummary } from '@/lib/csv-summary'

const RateCardSchema = z.object({
  dedicated_video_low: z.number().describe('Low end of dedicated video rate in USD'),
  dedicated_video_high: z.number().describe('High end of dedicated video rate in USD'),
  integration_60s_low: z.number().describe('Low end of 60-second integration rate in USD'),
  integration_60s_high: z.number().describe('High end of 60-second integration rate in USD'),
  integration_30s_low: z.number().describe('Low end of 30-second integration rate in USD'),
  integration_30s_high: z.number().describe('High end of 30-second integration rate in USD'),
  explanation: z.string().describe('2-3 sentence explanation of the rates and key value drivers'),
  improvement_tips: z.array(z.object({
    title: z.string(),
    description: z.string(),
  })).describe('2-3 actionable tips to increase rates'),
  pitch_email: z.string().describe('A complete pitch email template the creator can use to reach out to brands'),
})

export async function POST(req: Request) {
  const { niche, subscriberCount, hasSponsorships, sponsorshipCount, avgDealAmount, csvData, confidence } = await req.json()
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    return new Response('Missing OPENAI_API_KEY', { status: 500 })
  }

  const openai = createOpenAI({ apiKey })
  const csvSummary = buildCsvSummary(csvData)

  const system = `You are RateProof AI, a conservative YouTube sponsorship strategist.

You build defendable rate cards from creator analytics, not hype.
Use only the supplied inputs and broad market heuristics.
If the data is incomplete or low-confidence, be more conservative.
Do not invent unavailable metrics, brand relationships, or sponsorship results.

Output rules:
- Every price must be an integer USD amount.
- Every high value must be greater than or equal to its matching low value.
- dedicated_video rates must be higher than 60-second integrations.
- 60-second integrations must be higher than 30-second integrations.
- Channels without prior sponsorships should not receive an experience premium.
- If a channel has prior sponsorships with a known average deal size, treat that as real market evidence of their rate floor. Their new rates should be at or above that average unless data signals a decline.
- More past sponsorships = more proven track record; factor this in as a mild upward signal on rates.
- Keep the explanation grounded in the actual data summary.`

  const prompt = `Generate a data-backed sponsorship rate card for this YouTube creator.

Creator profile:
- Niche: ${niche}
- Subscriber count: ${subscriberCount.toLocaleString()}
- Has previous sponsorships: ${hasSponsorships ? 'Yes' : 'No (first-time sponsor)'}${hasSponsorships && sponsorshipCount != null ? `\n- Number of past sponsorships: ~${sponsorshipCount}` : ''}${hasSponsorships && avgDealAmount != null ? `\n- Average deal size from past sponsorships: ~$${avgDealAmount.toLocaleString()}` : ''}
- Data confidence: ${confidence}%

${csvSummary || 'No analytics table data was provided. Generate rates using only niche, subscriber count, sponsorship history, and low confidence assumptions.'}

Guidance:
- Weight recent content performance more than subscriber count alone.
- Favor conservative, defensible pricing over best-case pricing.
- If audience quality signals are missing, do not assume premium geography or retention.
- Treat the confidence score as a cap on certainty in your explanation.

For pitch_email:
- Write a complete cold outreach email.
- Keep it concise and usable.
- Reference the creator's niche and one concrete performance point from the provided data when possible.
- Use placeholders like [Your Channel Name], [Brand Name], [Contact Name], and [Relevant Video or Series].`

  console.log('\n=== generate-rate-card SYSTEM PROMPT ===\n', system, '\n=== USER PROMPT ===\n', prompt, '\n========================================\n')

  const { object } = await generateObject({
    model: openai('gpt-5-mini'),
    schema: RateCardSchema,
    system,
    prompt,
  })

  console.log('\n=== generate-rate-card RESPONSE ===\n', JSON.stringify(object, null, 2), '\n===================================\n')

  return Response.json(object)
}

