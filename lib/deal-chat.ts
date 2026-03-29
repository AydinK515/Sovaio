import type { Deal, RateCard } from '@/lib/types'

export const DEAL_TYPE_LABELS = {
  dedicated_video: 'Dedicated Video',
  integration_60s: 'Integrated (60s)',
  integration_30s: 'Integrated (30s)',
} satisfies Record<Deal['deal_type'], string>

export function formatCurrency(value: number | null) {
  if (value == null) return '--'
  return `$${value.toLocaleString()}`
}

export function getDealTypeRange(rateCard: Pick<RateCard, 'dedicated_video_low' | 'dedicated_video_high' | 'integration_60s_low' | 'integration_60s_high' | 'integration_30s_low' | 'integration_30s_high'>, dealType: Deal['deal_type']) {
  switch (dealType) {
    case 'dedicated_video':
      return {
        low: rateCard.dedicated_video_low,
        high: rateCard.dedicated_video_high,
      }
    case 'integration_60s':
      return {
        low: rateCard.integration_60s_low,
        high: rateCard.integration_60s_high,
      }
    case 'integration_30s':
      return {
        low: rateCard.integration_30s_low,
        high: rateCard.integration_30s_high,
      }
  }
}

export function formatDealTarget(
  deal: Pick<Deal, 'creator_ask' | 'deal_type'>,
  rateCard?: Pick<RateCard, 'dedicated_video_low' | 'dedicated_video_high' | 'integration_60s_low' | 'integration_60s_high' | 'integration_30s_low' | 'integration_30s_high'> | null
) {
  if (deal.creator_ask != null) {
    return formatCurrency(deal.creator_ask)
  }

  if (!rateCard) {
    return 'the selected rate card range'
  }

  const range = getDealTypeRange(rateCard, deal.deal_type)
  return `${formatCurrency(range.low)} - ${formatCurrency(range.high)}`
}

export function getOpeningMessage(
  deal: Pick<Deal, 'brand_name' | 'creator_ask' | 'deal_type'>,
  rateCard?: Pick<RateCard, 'dedicated_video_low' | 'dedicated_video_high' | 'integration_60s_low' | 'integration_60s_high' | 'integration_30s_low' | 'integration_30s_high'> | null
) {
  return `This is a fresh negotiation thread for ${deal.brand_name}. You're targeting ${formatDealTarget(deal, rateCard)} for a ${DEAL_TYPE_LABELS[deal.deal_type].toLowerCase()}. Tell me what happened in the negotiation, and if you're quoting the brand, paste their exact words.`
}
