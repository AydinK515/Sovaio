import type { RateCard } from '@/lib/types'

export function getChannelAssistantOpeningMessage(rateCard: RateCard | null, channelName: string | null) {
  const subject = channelName ? `${channelName}'s channel` : 'your channel'

  if (!rateCard) {
    return `Hi, I'm your channel advisor. I can answer general questions about ${subject}, but I don't see a saved rate card yet. Generate one first and I'll be able to ground my answers in your real channel data and pricing ranges.`
  }

  const primaryRate = rateCard.offers_dedicated_videos
    ? `dedicated videos at $${rateCard.dedicated_video_low.toLocaleString()}-$${rateCard.dedicated_video_high.toLocaleString()}`
    : `60-second integrations at $${rateCard.integration_60s_low.toLocaleString()}-$${rateCard.integration_60s_high.toLocaleString()}`

  return `Hi, I'm your channel advisor. Ask me anything about ${subject}, your sponsorship positioning, or your current rates. I already have your latest rate card, including ${primaryRate}.`
}
