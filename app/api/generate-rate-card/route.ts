import { createOpenAI } from '@ai-sdk/openai'
import { generateObject } from 'ai'
import { z } from 'zod'
import { buildCsvSummary, toNumber } from '@/lib/csv-summary'
import { createClient } from '@/lib/supabase-server'

const RateCardSchema = z.object({
  dedicated_video_low: z.number().describe('Low end of dedicated video rate in USD'),
  dedicated_video_high: z.number().describe('High end of dedicated video rate in USD'),
  integration_60s_low: z.number().describe('Low end of 60-second integration rate in USD'),
  integration_60s_high: z.number().describe('High end of 60-second integration rate in USD'),
  integration_30s_low: z.number().describe('Low end of 30-second integration rate in USD'),
  integration_30s_high: z.number().describe('High end of 30-second integration rate in USD'),
  explanation: z.string().describe('2-3 sentence plain-English explanation of the rates and key value drivers without including numeric ranges, percentages, multipliers, CPM values, or intermediate calculations'),
  improvement_tips: z.array(z.object({
    title: z.string(),
    description: z.string(),
  })).describe('2-3 actionable tips to increase rates'),
  pitch_email: z.string().describe('A complete pitch email template the creator can use to reach out to brands'),
})

const NICHE_CPM_BANDS: Record<string, { low: number; high: number }> = {
  'Personal Finance & Investing': { low: 50, high: 200 },
  'Business & Entrepreneurship': { low: 30, high: 80 },
  'Tech & Software': { low: 15, high: 35 },
  'Health & Fitness': { low: 10, high: 20 },
  'Education & Tutorials': { low: 10, high: 18 },
  Automotive: { low: 10, high: 20 },
  'DIY & Home Improvement': { low: 8, high: 18 },
  'Sports & Outdoors': { low: 8, high: 15 },
  'Science & Nature': { low: 8, high: 15 },
  'News & Politics': { low: 7, high: 14 },
  Gaming: { low: 5, high: 15 },
  'Beauty & Fashion': { low: 8, high: 15 },
  'Food & Cooking': { low: 5, high: 12 },
  'Parenting & Family': { low: 5, high: 12 },
  Travel: { low: 5, high: 12 },
  'Lifestyle & Vlogging': { low: 5, high: 10 },
  'Music & Arts': { low: 4, high: 10 },
  'Entertainment & Comedy': { low: 3, high: 8 },
  Other: { low: 5, high: 12 },
}

function getMedianViews(csvData: Record<string, Record<string, unknown>[]>) {
  const rows = Array.isArray(csvData.content)
    ? csvData.content
        .filter(row => String(row['Video title'] ?? '').trim() !== '')
        .slice(0, 10)
    : []

  if (rows.length === 0) {
    return null
  }

  const viewCounts = rows
    .map(row => toNumber(row['Views'] ?? row['views']))
    .filter(value => value > 0)
    .sort((a, b) => a - b)

  if (viewCounts.length === 0) {
    return null
  }

  const middle = Math.floor(viewCounts.length / 2)
  return viewCounts.length % 2 === 0
    ? Math.round((viewCounts[middle - 1] + viewCounts[middle]) / 2)
    : viewCounts[middle]
}

function getAccessibleCpmBand(niche: string, medianViews: number | null) {
  const baseBand = NICHE_CPM_BANDS[niche] ?? NICHE_CPM_BANDS.Other

  if (medianViews === null) {
    return baseBand
  }

  const ceilingMultiplier =
    medianViews < 25_000 ? 0.4
    : medianViews < 100_000 ? 0.7
    : 1

  return {
    low: baseBand.low,
    high: Math.max(baseBand.low, Math.round(baseBand.high * ceilingMultiplier)),
  }
}

function getTopVideo(csvData: Record<string, Record<string, unknown>[]>) {
  const rows = Array.isArray(csvData.content)
    ? csvData.content.filter(row => String(row['Video title'] ?? '').trim() !== '').slice(0, 10)
    : []

  return rows.reduce<Record<string, unknown> | null>((best, row) => {
    if (!best) return row
    return toNumber(row['Views'] ?? row['views']) > toNumber(best['Views'] ?? best['views']) ? row : best
  }, null)
}

function buildPitchEmailContext(input: {
  channelName: string | null
  creatorName: string | null
  subscriberCount: number
  medianViews: number | null
  csvData: Record<string, Record<string, unknown>[]>
}) {
  const facts: string[] = []

  if (input.channelName) {
    facts.push(`- Actual channel name: ${input.channelName}`)
  }

  if (input.creatorName) {
    facts.push(`- Actual creator name: ${input.creatorName}`)
  }

  facts.push(`- Subscriber count: ${input.subscriberCount.toLocaleString()}`)

  if (input.medianViews != null) {
    facts.push(`- Median views per recent video: ${input.medianViews.toLocaleString()}`)
  }

  const topVideo = getTopVideo(input.csvData)
  if (topVideo) {
    const topVideoTitle = String(topVideo['Video title'] ?? '').trim()
    const topVideoViews = toNumber(topVideo['Views'] ?? topVideo['views'])
    const topVideoCtr = toNumber(topVideo['Impressions click-through rate (%)'] ?? topVideo['impressions click-through rate (%)'])

    if (topVideoTitle) {
      facts.push(`- Strongest recent video title: "${topVideoTitle}"`)
    }

    if (topVideoViews > 0) {
      facts.push(`- Strongest recent video views: ${topVideoViews.toLocaleString()}`)
    }

    if (topVideoCtr > 0) {
      facts.push(`- Strongest recent video CTR: ${topVideoCtr}%`)
    }
  }

  return facts.join('\n')
}

export async function POST(req: Request) {
  const { niche, subscriberCount, hasSponsorships, offersDedicatedVideos, sponsorshipCount, avgDealAmount, csvData, confidence } = await req.json()
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    return new Response('Missing OPENAI_API_KEY', { status: 500 })
  }

  const openai = createOpenAI({ apiKey })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, channel_name')
    .eq('id', user.id)
    .single()

  const csvSummary = buildCsvSummary(csvData)
  const medianViews = getMedianViews(csvData)
  const accessibleCpmBand = getAccessibleCpmBand(niche, medianViews)
  const pitchEmailContext = buildPitchEmailContext({
    channelName: profile?.channel_name ?? null,
    creatorName: profile?.full_name ?? null,
    subscriberCount,
    medianViews,
    csvData,
  })

  const system = `You are RateProof AI, a data-driven YouTube sponsorship rate strategist.

You calculate defensible rates by following a strict priority formula. Do not invent metrics or relationships not supplied.

## CALCULATION FORMULA
Rate = (Niche CPM x View Tier Multiplier) x Geography Multiplier x Sponsorship History Multiplier x Retention Modifier x Engagement Modifier

Apply each factor in order. Niche and geography do the heavy lifting. Everything else is a modifier on top.

## STEP 1 - Niche CPM baseline (biggest lever, up to 20x spread)
Use the niche CPM baseline provided in the creator profile. Treat that range as the correct starting point for this creator and do not widen or replace it.
If the niche is genuinely mixed (e.g. tech/gaming), stay anchored to the provided primary niche baseline and apply a 10-15% downward confidence adjustment. Do not automatically default to the cheaper niche's floor just because of ambiguity.

## STEP 2 - Median views per video (base volume)
This is the primary input. Subscriber count is a credibility proxy only - do not use it to set rates.
Use the MEDIAN views/video from the analytics data. If the summary explicitly calls out an outlier skew (avg much higher than median), use the median, not the average. If only avg is available and no skew is flagged, use avg. If no analytics are provided, estimate conservatively from subscriber count.

View tier multipliers - small-channel premium is conditional, not automatic:
- <5,000 views/video: CPM multiplier 1.0-1.5x. The 1.5x end only applies if engagement signals are strong (CTR above 5%, meaningful subscriber gain per view). Weak or missing engagement signals: use 1.0-1.2x.
- 5,000-15,000 views/video: CPM multiplier 1.2-1.5x
- 15,000-50,000 views/video: CPM multiplier 1.0-1.2x
- 50,000-250,000 views/video: CPM multiplier 0.8-1.0x
- 250,000-750,000 views/video: CPM multiplier 0.5-0.8x
- >750,000 views/video: CPM multiplier 0.4-0.6x (volume discount applies)

## STEP 3 - Geography multiplier (second biggest lever, up to ~2x)
Based on % of views from US, UK, CA, AU, NZ (premium CPM markets):
- 70%+ premium market views: 1.5-2.0x
- 50-70%: 1.3-1.5x
- 30-50%: 1.1-1.3x
- <30% premium market views: 0.8-1.0x
If geography data is missing, do NOT assume a premium. Use 1.0x and note the assumption.

## STEP 4 - Sponsorship history multiplier
- No prior sponsorships: 0.7x (first-timer discount is real)
- 1-3 sponsorships: 1.0x
- 4-10 sponsorships: 1.1-1.2x
- 10+ sponsorships: 1.2-1.4x
- If prior avg deal amount is known, use that as a hard rate floor - new rates should not be below it.

## STEP 5 - Engagement quality modifier (+/-15-20%)
The YouTube Studio CSV does not export video length, so true retention % (watch time / video length) cannot be computed. Do not attempt to infer retention from raw watch hours alone - it is uninterpretable without knowing video duration.

Instead, use subscriber gain per view as the engagement quality signal:
- High sub-per-view ratio (e.g. >0.01 subs per view, meaning 1+ sub per 100 views): +10-20% - audience is converting, signals strong trust and content quality
- Average (roughly 0.002-0.01): 0%
- Very low (<0.001): -10-15% - views are not translating to engaged fans, likely low trust or passive audience
If no subscriber gain data: 0% modifier.

## STEP 6 - Engagement modifier (+/-15-25%)
- High engagement (strong like ratio, comments per view): +10-20%
- Low engagement: -10-20%
If no engagement data: 0% modifier.

## RATE STRUCTURE
Once you have a CPM estimate, derive integration rates:
- 60-second integration = CPM x (median_views / 1000)
- 30-second integration = 60-second x 0.65-0.75
- Dedicated video = 60-second x 3.0-5.0

Round to clean numbers. Low end = conservative, high end = with favorable modifiers.

## HONESTY RULES
- If median views/video is very low (under 1,000), the rates will be small - say so plainly. Do not artificially inflate.
- If a channel has 1 subscriber or tiny traction, produce honest low rates. That is more useful than fake optimism.
- If data confidence is low, skew toward the conservative end of every range.
- Never assume premium geography or strong engagement unless the data shows it.
- If the calculated 60-second integration rate is below $150, note explicitly in the explanation that cash sponsorship deals are uncommon at this rate level - brands at this range typically offer product exchanges rather than cash payment. Present the numbers honestly but set that expectation.

Output rules:
- Every price must be an integer USD amount.
- Every high value must be >= its matching low value.
- dedicated_video > integration_60s > integration_30s.
- Channels without prior sponsorships must not receive an experience premium.
- If prior avg deal amount is known, it is the rate floor.
- Keep the explanation grounded in the actual data - name the specific factors that drove the numbers.
- The explanation must stay qualitative. Do not include any raw numbers, dollar amounts, CPM bands, percentages, multipliers, ranges, parentheses with figures, or intermediate math.
- In the explanation, describe the factors in plain English instead, for example: strong premium-market audience, modest view volume for the niche, first-time sponsor discount, or strong engagement signals.`

  const prompt = `Generate a data-backed sponsorship rate card for this YouTube creator.

Creator profile:
- Niche: ${niche}
- Niche CPM baseline for this creator: $${accessibleCpmBand.low}-$${accessibleCpmBand.high}
- Subscriber count: ${subscriberCount.toLocaleString()}
- Median views/video to use for pricing: ${medianViews?.toLocaleString() ?? 'Not available from analytics'}
- Has previous sponsorships: ${hasSponsorships ? 'Yes' : 'No (first-time sponsor)'}${hasSponsorships && sponsorshipCount != null ? `\n- Number of past sponsorships: ~${sponsorshipCount}` : ''}${hasSponsorships && avgDealAmount != null ? `\n- Average deal size from past sponsorships: ~$${avgDealAmount.toLocaleString()}` : ''}
- Creator currently offers dedicated videos: ${offersDedicatedVideos === false ? 'No' : 'Yes'}
- Data confidence: ${confidence}%

${csvSummary || 'No analytics data provided. Use niche, subscriber count, and sponsorship history only. Apply no geography premium, no retention bonus, and assume first-tier conservative estimates.'}

${pitchEmailContext ? `Pitch email personalization data:\n${pitchEmailContext}` : ''}

Instructions:
- Follow the formula in order: niche CPM -> view tier (using median views) -> geography -> sponsorship history -> engagement quality.
- Use the provided niche CPM baseline exactly as the starting band for your calculations.
- If the analytics summary flags an outlier skew, use the median views figure, not the average.
- In the explanation field, explain the main drivers in plain English without exposing any numeric inputs or calculations.
- Do not include values such as dollar ranges, view counts, percentages, x-multipliers, CPM bands, or final CPM math in the explanation.
- Do not invent data that was not provided.

For pitch_email:
- Write a complete cold outreach email.
- Keep it concise and professional.
- Look at all the data available and identify the single most impressive thing about this channel from a brand's perspective - whatever that actually is. Lead with that. It might be strong geography, high CTR, a loyal demographic, growing momentum, or view count if it's genuinely good. Pick the real standout and open with it.
- Do not lead with a weak stat just to have something concrete. If nothing is clearly impressive, lead with the niche and audience fit instead.
- Use the real channel name and real creator name whenever they are available in the provided data. Do not leave [Your Channel Name] or [Your Name] as placeholders if you know them.
- Use actual video titles, channel stats, and audience numbers when they materially strengthen the pitch. Good examples include subscriber count, median views, top-video views, premium-country audience share, CTR, or audience demographic concentration.
- If a concrete recent video title is available, prefer citing that exact title instead of using [Relevant Video or Series].
- Keep placeholders only for information that is truly unknown or brand-specific, such as [Brand Name] or [Contact Name].
- Do not invent achievements, campaigns, or stats that are not in the provided data.`

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
