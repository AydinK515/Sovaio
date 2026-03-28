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

  const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY })

  const csvSummary = buildCsvSummary(csvData)

  const prompt = `You are an expert YouTube creator monetization analyst. Generate a data-driven sponsorship rate card for a YouTube creator.

Creator profile:
- Niche: ${niche}
- Subscriber count: ${subscriberCount.toLocaleString()}
- Has previous sponsorships: ${hasSponsorships ? 'Yes' : 'No (first-time sponsor)'}
- Data confidence: ${confidence}%

${csvSummary}

Industry context for rate calculation:
- CPM benchmarks vary widely by niche: Finance/Business ($15-50 CPM), Tech ($10-30 CPM), Gaming ($5-15 CPM), Lifestyle ($5-20 CPM)
- Dedicated videos typically command 2-3x the rate of integrations
- 60-second integrations are ~60-70% of dedicated video rate
- 30-second integrations are ~35-50% of dedicated video rate
- Channels with proven sponsorship history command 20-40% premiums
- US/UK/CA/AU audience concentration significantly boosts rates
- Retention above 50% is a premium signal

Generate realistic, defensible rates a creator could charge brands. Rates should reflect actual market conditions — not aspirational maximums.

For the pitch_email, write a complete, personalized template referencing the creator's niche and a placeholder for their top metric. Use placeholders like [Your Channel Name], [Brand Name], [Contact Name], [Video Topic].`

  const { object } = await generateObject({
    model: openai('gpt-4o'),
    schema: RateCardSchema,
    prompt,
    temperature: 0.3,
  })

  return Response.json(object)
}

function buildCsvSummary(csvData: Record<string, Record<string, unknown>[]>): string {
  const parts: string[] = []

  if (csvData.content && csvData.content.length > 0) {
    const rows = csvData.content.slice(0, 10)
    const totalViews = rows.reduce((sum: number, row: Record<string, unknown>) => {
      const views = Number(row['Views'] || row['views'] || 0)
      return sum + views
    }, 0)
    const avgViews = rows.length > 0 ? Math.round(totalViews / rows.length) : 0
    parts.push(`Content performance: ${rows.length} recent videos, avg ${avgViews.toLocaleString()} views/video`)
  }

  if (csvData.demographics && csvData.demographics.length > 0) {
    const sample = csvData.demographics.slice(0, 5)
    parts.push(`Demographics sample: ${JSON.stringify(sample)}`)
  }

  if (csvData.geography && csvData.geography.length > 0) {
    const topCountries = csvData.geography.slice(0, 5)
    parts.push(`Top geographies: ${JSON.stringify(topCountries)}`)
  }

  if (csvData.retention && csvData.retention.length > 0) {
    const sample = csvData.retention.slice(0, 3)
    parts.push(`Retention data sample: ${JSON.stringify(sample)}`)
  }

  if (csvData.traffic_sources && csvData.traffic_sources.length > 0) {
    const sample = csvData.traffic_sources.slice(0, 5)
    parts.push(`Traffic sources: ${JSON.stringify(sample)}`)
  }

  return parts.length > 0
    ? `YouTube Analytics data:\n${parts.join('\n')}`
    : 'No CSV analytics data provided — generate rates based on subscriber count and niche alone.'
}
