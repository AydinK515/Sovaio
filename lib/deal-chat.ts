import type { Deal, RateCard } from '@/lib/types'
import { sanitizeDealPromptText } from '@/lib/security'

export const DEAL_TYPE_LABELS = {
  dedicated_video: 'Dedicated Video',
  integration_60s: 'Integrated (60s)',
  integration_30s: 'Integrated (30s)',
} satisfies Record<Deal['deal_type'], string>

export type DealTypeSelection = Deal['deal_type'] | 'other'

export function normalizeCustomDealTypeLabel(label: string | null | undefined) {
  const trimmed = label?.trim() ?? ''
  return trimmed || 'Other'
}

export function getDealTypeLabel(deal: Pick<Deal, 'deal_type' | 'deal_type_custom'>) {
  if (deal.deal_type_custom?.trim()) {
    return normalizeCustomDealTypeLabel(deal.deal_type_custom)
  }

  return DEAL_TYPE_LABELS[deal.deal_type]
}

export function getDealTypeSelectionValue(deal: Pick<Deal, 'deal_type' | 'deal_type_custom'>): DealTypeSelection {
  return deal.deal_type_custom?.trim() ? 'other' : deal.deal_type
}

export function getDealTypePromptLabel(deal: Pick<Deal, 'deal_type' | 'deal_type_custom'>) {
  const customLabel = deal.deal_type_custom?.trim()

  if (customLabel) {
    return customLabel.toLowerCase() === 'other'
      ? null
      : customLabel
  }

  return DEAL_TYPE_LABELS[deal.deal_type]
}

export function getDealTypeMessageFragment(deal: Pick<Deal, 'deal_type' | 'deal_type_custom'>) {
  const label = getDealTypePromptLabel(deal)
  return label ? ` for a ${label.toLowerCase()}` : ''
}

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
  deal: Pick<Deal, 'creator_ask' | 'deal_type' | 'deal_type_custom'>,
  rateCard?: Pick<RateCard, 'dedicated_video_low' | 'dedicated_video_high' | 'integration_60s_low' | 'integration_60s_high' | 'integration_30s_low' | 'integration_30s_high'> | null
) {
  if (deal.creator_ask != null) {
    return formatCurrency(deal.creator_ask)
  }

  if (deal.deal_type_custom?.trim()) {
    return 'No ask set yet'
  }

  if (!rateCard) {
    return 'No ask set yet'
  }

  const range = getDealTypeRange(rateCard, deal.deal_type)
  return `${formatCurrency(range.low)} - ${formatCurrency(range.high)}`
}

export function getOpeningMessage(
  deal: Pick<Deal, 'brand_name' | 'creator_ask' | 'deal_type' | 'deal_type_custom'>,
  rateCard?: Pick<RateCard, 'dedicated_video_low' | 'dedicated_video_high' | 'integration_60s_low' | 'integration_60s_high' | 'integration_30s_low' | 'integration_30s_high'> | null
) {
  const safeBrandName = sanitizeDealPromptText(deal.brand_name) ?? 'this brand'
  const targetText = deal.creator_ask != null
    ? `You're targeting ${formatDealTarget(deal, rateCard)}${getDealTypeMessageFragment(deal)}.`
    : rateCard || deal.deal_type_custom?.trim()
      ? `You haven't set a creator ask yet, so we'll use your pricing context${getDealTypeMessageFragment(deal)} as the starting point.`
      : `You haven't set a creator ask yet, so we'll work from the negotiation context and set a target together.`

  return `This is a fresh deal thread for ${safeBrandName}. I'm here to help with the live negotiation: evaluating the brand's messages, deciding whether to push back or accept, and drafting what to send next. ${targetText} Tell me what happened in the negotiation, and if you're quoting the brand, paste their exact words.`
}
