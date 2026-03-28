import { createOpenAI } from '@ai-sdk/openai'
import { generateObject } from 'ai'
import { z } from 'zod'

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
  const { niche, subscriberCount, hasSponsorships, csvData, confidence } = await req.json()
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
- Keep the explanation grounded in the actual data summary.`

  const prompt = `Generate a data-backed sponsorship rate card for this YouTube creator.

Creator profile:
- Niche: ${niche}
- Subscriber count: ${subscriberCount.toLocaleString()}
- Has previous sponsorships: ${hasSponsorships ? 'Yes' : 'No (first-time sponsor)'}
- Data confidence: ${confidence}%

${csvSummary}

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

  const { object } = await generateObject({
    model: openai('gpt-5-mini'),
    schema: RateCardSchema,
    system,
    prompt,
  })

  return Response.json(object)
}

function buildCsvSummary(csvData: Record<string, Record<string, unknown>[]>): string {
  const parts: string[] = []

  if (csvData.content && csvData.content.length > 0) {
    const rows = csvData.content
      .filter(row => String(row['Video title'] ?? '').trim() !== '')
      .slice(0, 10)

    const totalViews = rows.reduce((sum, row) => sum + toNumber(row['Views'] ?? row['views']), 0)
    const totalWatchHours = rows.reduce((sum, row) => sum + toNumber(row['Watch time (hours)'] ?? row['watch time (hours)']), 0)
    const totalSubscribers = rows.reduce((sum, row) => sum + toNumber(row['Subscribers'] ?? row['subscribers']), 0)
    const ctrValues = rows
      .map(row => toNumber(row['Impressions click-through rate (%)'] ?? row['impressions click-through rate (%)']))
      .filter(value => value > 0)
    const avgViews = rows.length > 0 ? Math.round(totalViews / rows.length) : 0
    const avgCtr = ctrValues.length > 0 ? (ctrValues.reduce((sum, value) => sum + value, 0) / ctrValues.length).toFixed(1) : null
    const topVideo = rows.reduce<Record<string, unknown> | null>((best, row) => {
      if (!best) return row
      return toNumber(row['Views'] ?? row['views']) > toNumber(best['Views'] ?? best['views']) ? row : best
    }, null)

    parts.push(
      `Content performance: ${rows.length} videos analyzed, avg ${avgViews.toLocaleString()} views/video, ${Math.round(totalWatchHours).toLocaleString()} watch hours total, ${totalSubscribers.toLocaleString()} subscribers gained from sampled videos${avgCtr ? `, avg CTR ${avgCtr}%` : ''}.`
    )

    if (topVideo) {
      parts.push(
        `Top sampled video: "${String(topVideo['Video title'])}" with ${toNumber(topVideo['Views'] ?? topVideo['views']).toLocaleString()} views.`
      )
    }
  }

  if (csvData.demographics && csvData.demographics.length > 0) {
    const sample = csvData.demographics.slice(0, 5).map(summarizeRow).join('; ')
    parts.push(`Audience demographics sample: ${sample}`)
  }

  if (csvData.geography && csvData.geography.length > 0) {
    const topCountries = csvData.geography.slice(0, 5).map(summarizeRow).join('; ')
    parts.push(`Top geographies: ${topCountries}`)
  }

  if (csvData.retention && csvData.retention.length > 0) {
    const sample = csvData.retention.slice(0, 3).map(summarizeRow).join('; ')
    parts.push(`Retention sample: ${sample}`)
  }

  if (csvData.traffic_sources && csvData.traffic_sources.length > 0) {
    const sample = csvData.traffic_sources.slice(0, 5).map(summarizeRow).join('; ')
    parts.push(`Traffic sources: ${sample}`)
  }

  return parts.length > 0
    ? `YouTube Analytics data:\n${parts.join('\n')}`
    : 'No analytics table data was provided. Generate rates using only niche, subscriber count, sponsorship history, and low confidence assumptions.'
}

function toNumber(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value !== 'string') return 0

  const normalized = value.replace(/[$,%\s]/g, '').replace(/,/g, '')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

function summarizeRow(row: Record<string, unknown>) {
  return Object.entries(row)
    .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== '')
    .slice(0, 4)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(', ')
}
