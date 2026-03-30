import type { AnalyticsSnapshot } from '@/lib/types'

export function getChannelAssistantOpeningMessage(snapshot: AnalyticsSnapshot | null, channelName: string | null) {
  const subject = channelName ? `${channelName}'s channel` : 'your channel'

  if (!snapshot) {
    return `Hi, I'm your channel advisor. I'm here for general questions about ${subject}, your audience, your sponsorship positioning, and your channel performance. Upload an analytics snapshot first and I’ll be able to ground my answers in your real channel data.`
  }

  return `Hi, I'm your channel advisor. Ask me anything about ${subject}, your sponsorship positioning, your audience, or what your analytics suggest. I'm already grounded in your selected analytics snapshot, ${snapshot.name}.`
}
