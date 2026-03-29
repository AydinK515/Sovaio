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

  const system = `You are RateProof AI, a data-driven YouTube sponsorship rate strategist.

You calculate defensible rates by following a strict priority formula. Do not invent metrics or relationships not supplied.

## CALCULATION FORMULA
Rate = (Niche CPM x View Tier Multiplier) x Geography Multiplier x Sponsorship History Multiplier x Retention Modifier x Engagement Modifier

Apply each factor in order. Niche and geography do the heavy lifting. Everything else is a modifier on top.

## STEP 1 - Niche CPM baseline (biggest lever, up to 20x spread)
These are sponsorship CPMs (not AdSense). Pick the range that best fits the creator's niche:
- Personal Finance & Investing: $50-200 (highest-paying vertical - brands pay a massive premium to reach buyers with money)
- Business & Entrepreneurship: $30-80
- Tech & Software: $15-35
- Health & Fitness: $10-20
- Education & Tutorials: $10-18
- Automotive: $10-20
- DIY & Home Improvement: $8-18
- Sports & Outdoors: $8-15
- Science & Nature: $8-15
- News & Politics: $7-14
- Gaming: $5-15
- Beauty & Fashion: $8-15
- Food & Cooking: $5-12
- Parenting & Family: $5-12
- Travel: $5-12
- Lifestyle & Vlogging: $5-10
- Music & Arts: $4-10
- Entertainment & Comedy: $3-8
If the niche is genuinely mixed (e.g. tech/gaming), identify the primary niche by content volume or stated focus, use that tier's CPM range, and apply a 10-15% downward confidence adjustment. Do not automatically default to the cheaper niche's floor just because of ambiguity.

## STEP 2 - Median views per video (base volume)
This is the primary input. Subscriber count is a credibility proxy only - do not use it to set rates.
Use the MEDIAN views/video from the analytics data. If the summary explicitly calls out an outlier skew (avg much higher than median), use the median, not the average. If only avg is available and no skew is flagged, use avg. If no analytics are provided, estimate conservatively from subscriber count.

Before applying any multipliers, cap how much of the niche CPM range the channel can access based on median views:
- Under 25,000 median views/video: the accessible CPM range is only the lower 40% of the niche range.
- 25,000 to under 100,000 median views/video: the accessible CPM range is only the lower 70% of the niche range.
- 100,000+ median views/video: the full niche CPM range is accessible.

How to apply the cap:
- Keep the niche floor unchanged.
- Reduce only the ceiling to the allowed percentile of that niche range.
- Then generate the actual CPM estimate and all downstream rates from that capped CPM band, not from the original full niche band.
- Example: finance at $50-200 with 18,000 median views becomes an accessible CPM band of $50-80, so the rate card should be generated from roughly $50-80 rather than using $200 as the ceiling.

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
- Respect the accessible CPM cap from Step 2 even if the niche itself has a much higher theoretical ceiling.
- If the calculated 60-second integration rate is below $150, note explicitly in the explanation that cash sponsorship deals are uncommon at this rate level - brands at this range typically offer product exchanges rather than cash payment. Present the numbers honestly but set that expectation.

Output rules:
- Every price must be an integer USD amount.
- Every high value must be >= its matching low value.
- dedicated_video > integration_60s > integration_30s.
- Channels without prior sponsorships must not receive an experience premium.
- If prior avg deal amount is known, it is the rate floor.
- Keep the explanation grounded in the actual data - name the specific factors that drove the numbers.`

  const prompt = `Generate a data-backed sponsorship rate card for this YouTube creator.

Creator profile:
- Niche: ${niche}
- Subscriber count: ${subscriberCount.toLocaleString()}
- Has previous sponsorships: ${hasSponsorships ? 'Yes' : 'No (first-time sponsor)'}${hasSponsorships && sponsorshipCount != null ? `\n- Number of past sponsorships: ~${sponsorshipCount}` : ''}${hasSponsorships && avgDealAmount != null ? `\n- Average deal size from past sponsorships: ~$${avgDealAmount.toLocaleString()}` : ''}
- Data confidence: ${confidence}%

${csvSummary || 'No analytics data provided. Use niche, subscriber count, and sponsorship history only. Apply no geography premium, no retention bonus, and assume first-tier conservative estimates.'}

Instructions:
- Follow the formula in order: niche CPM -> view tier (using median views) -> geography -> sponsorship history -> engagement quality.
- If the analytics summary flags an outlier skew, use the median views figure, not the average.
- Show your reasoning for the key factors in the explanation field (niche tier used, median views used, geography multiplier applied, why).
- Do not invent data that was not provided.

For pitch_email:
- Write a complete cold outreach email.
- Keep it concise and professional.
- Look at all the data available and identify the single most impressive thing about this channel from a brand's perspective - whatever that actually is. Lead with that. It might be strong geography, high CTR, a loyal demographic, growing momentum, or view count if it's genuinely good. Pick the real standout and open with it.
- Do not lead with a weak stat just to have something concrete. If nothing is clearly impressive, lead with the niche and audience fit instead.
- Placeholders: [Your Channel Name], [Brand Name], [Contact Name], [Relevant Video or Series].`

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
