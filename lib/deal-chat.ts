import type { Deal } from '@/lib/types'

export const DEAL_TYPE_LABELS = {
  dedicated_video: 'Dedicated Video',
  integration_60s: 'Integrated (60s)',
  integration_30s: 'Integrated (30s)',
} satisfies Record<Deal['deal_type'], string>

export function formatCurrency(value: number | null) {
  if (value == null) return '--'
  return `$${value.toLocaleString()}`
}

export function getOpeningMessage(deal: Pick<Deal, 'brand_name' | 'creator_ask' | 'deal_type'>) {
  return `This is a fresh negotiation thread for ${deal.brand_name}. You're targeting ${formatCurrency(deal.creator_ask)} for a ${DEAL_TYPE_LABELS[deal.deal_type].toLowerCase()}. Tell me what happened in the negotiation, and if you're quoting the brand, paste their exact words.`
}
