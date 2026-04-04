import type { AnalyticsEventProperties } from '@/lib/posthog-events'

export const ONBOARDING_PATHS = [
  'price_my_channel',
  'negotiate_a_brand_deal',
  'just_exploring',
] as const

export const ONBOARDING_STEP_IDS = [
  'upload_analytics',
  'save_snapshot',
  'generate_rate_card',
  'start_deal',
  'ask_channel_ai',
] as const

export type OnboardingPath = (typeof ONBOARDING_PATHS)[number]
export type OnboardingStepId = (typeof ONBOARDING_STEP_IDS)[number]

export type OnboardingChecklistState = Partial<Record<OnboardingStepId, {
  dismissed?: boolean
  opened_at?: string | null
}>>

export type OnboardingDismissedHints = Record<string, string>

export interface OnboardingState {
  user_id: string
  started_at: string
  completed_at: string | null
  dismissed_at: string | null
  last_seen_at: string | null
  updated_at: string | null
  welcome_completed: boolean
  welcome_path: OnboardingPath | null
  has_export_ready: boolean | null
  snapshot_created: boolean
  snapshot_created_at: string | null
  rate_card_created: boolean
  rate_card_created_at: string | null
  deal_created: boolean
  deal_created_at: string | null
  first_negotiation_message: boolean
  first_negotiation_message_at: string | null
  first_channel_advisor_message: boolean
  first_channel_advisor_message_at: string | null
  checklist_dismissed: boolean
  route_hints_dismissed: boolean
  dismissed_hints: OnboardingDismissedHints
  checklist_state: OnboardingChecklistState
}

export type OnboardingStepStatus = 'complete' | 'active' | 'locked'

export interface OnboardingChecklistItem {
  id: OnboardingStepId
  title: string
  description: string
  href: string
  status: OnboardingStepStatus
}

type OnboardingRow = Partial<OnboardingState> | null

export function getDefaultOnboardingState(userId: string): OnboardingState {
  const startedAt = new Date().toISOString()

  return {
    user_id: userId,
    started_at: startedAt,
    completed_at: null,
    dismissed_at: null,
    last_seen_at: null,
    updated_at: null,
    welcome_completed: false,
    welcome_path: null,
    has_export_ready: null,
    snapshot_created: false,
    snapshot_created_at: null,
    rate_card_created: false,
    rate_card_created_at: null,
    deal_created: false,
    deal_created_at: null,
    first_negotiation_message: false,
    first_negotiation_message_at: null,
    first_channel_advisor_message: false,
    first_channel_advisor_message_at: null,
    checklist_dismissed: false,
    route_hints_dismissed: false,
    dismissed_hints: {},
    checklist_state: {},
  }
}

export function normalizeOnboardingState(userId: string, row: OnboardingRow): OnboardingState {
  const fallback = getDefaultOnboardingState(userId)

  return {
    ...fallback,
    ...row,
    user_id: userId,
    welcome_path: isOnboardingPath(row?.welcome_path) ? row.welcome_path : null,
    dismissed_hints: isRecord(row?.dismissed_hints) ? row.dismissed_hints as OnboardingDismissedHints : {},
    checklist_state: isRecord(row?.checklist_state) ? row.checklist_state as OnboardingChecklistState : {},
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isOnboardingPath(value: unknown): value is OnboardingPath {
  return typeof value === 'string' && (ONBOARDING_PATHS as readonly string[]).includes(value)
}

export function shouldShowWelcome(state: OnboardingState) {
  return !state.welcome_completed
}

export function isOnboardingCompleted(state: OnboardingState) {
  return Boolean(state.completed_at)
}

export function shouldQuietOnboarding(state: OnboardingState) {
  return state.rate_card_created && (state.first_negotiation_message || state.first_channel_advisor_message)
}

export function getChecklistItems(state: OnboardingState): OnboardingChecklistItem[] {
  const statuses: Record<OnboardingStepId, OnboardingStepStatus> = {
    upload_analytics: state.snapshot_created ? 'complete' : 'active',
    save_snapshot: state.snapshot_created ? 'complete' : 'active',
    generate_rate_card: state.rate_card_created ? 'complete' : state.snapshot_created ? 'active' : 'locked',
    start_deal: state.deal_created ? 'complete' : state.rate_card_created ? 'active' : 'locked',
    ask_channel_ai: state.first_channel_advisor_message ? 'complete' : state.snapshot_created ? 'active' : 'locked',
  }

  const items: OnboardingChecklistItem[] = [
    {
      id: 'upload_analytics',
      title: 'Upload analytics',
      description: 'Bring in your YouTube Studio exports so RateProof can work from real channel data.',
      href: '/analytics/new',
      status: statuses.upload_analytics,
    },
    {
      id: 'save_snapshot',
      title: 'Save your first snapshot',
      description: 'Snapshots are your saved channel context for pricing, deals, and AI.',
      href: '/analytics/new',
      status: statuses.save_snapshot,
    },
    {
      id: 'generate_rate_card',
      title: 'Generate your first rate card',
      description: 'Turn your snapshot into sponsor-ready pricing and a pitch email.',
      href: '/generate',
      status: statuses.generate_rate_card,
    },
    {
      id: 'start_deal',
      title: 'Start your first deal',
      description: 'Create a negotiation workspace with your pricing and snapshot already attached.',
      href: '/deal/new',
      status: statuses.start_deal,
    },
    {
      id: 'ask_channel_ai',
      title: 'Ask AI about your channel',
      description: 'Use Channel Advisor to understand your positioning, audience, and pricing strategy.',
      href: '/dashboard',
      status: statuses.ask_channel_ai,
    },
  ]

  if (state.welcome_path === 'negotiate_a_brand_deal') {
    return [items[0], items[1], items[3], items[2], items[4]]
  }

  return items
}

export function getOnboardingCompletionCount(state: OnboardingState) {
  return getChecklistItems(state).filter((item) => item.status === 'complete').length
}

export function getOnboardingNextHref(state: OnboardingState) {
  if (!state.welcome_completed) return '/welcome'
  const nextItem = getChecklistItems(state).find((item) => item.status === 'active')
  return nextItem?.href ?? '/dashboard'
}

export function getWelcomeDestination(path: OnboardingPath | null, hasExportReady: boolean | null) {
  if (hasExportReady) return '/analytics/new'
  if (path === 'negotiate_a_brand_deal') return '/dashboard?focus=deal'
  return '/dashboard'
}

export function getMilestoneDurationSeconds(startedAt: string | null, completedAt: string | null) {
  if (!startedAt || !completedAt) return null

  const start = new Date(startedAt).getTime()
  const end = new Date(completedAt).getTime()

  if (Number.isNaN(start) || Number.isNaN(end) || end < start) {
    return null
  }

  return Math.round((end - start) / 1000)
}

export function getChecklistAnalyticsProperties(
  state: OnboardingState,
  stepId: OnboardingStepId,
  route: string,
  extra?: AnalyticsEventProperties
): AnalyticsEventProperties {
  return {
    onboarding_path: state.welcome_path,
    step_id: stepId,
    route,
    checklist_position: getChecklistItems(state).findIndex((item) => item.id === stepId),
    has_export_ready: state.has_export_ready,
    ...extra,
  }
}

type OnboardingStateQuery = {
  select: (columns: string) => {
    eq: (column: string, value: string) => {
      maybeSingle: () => PromiseLike<{ data: OnboardingRow; error: { message: string } | null }>
    }
  }
}

export type OnboardingStateReader = {
  from: (table: string) => OnboardingStateQuery
}

export async function fetchOnboardingState(
  supabase: OnboardingStateReader,
  userId: string
) {
  const { data, error } = await supabase
    .from('onboarding_states')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return normalizeOnboardingState(userId, data)
}
