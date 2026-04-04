import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import {
  fetchOnboardingState,
  getMilestoneDurationSeconds,
  getWelcomeDestination,
  normalizeOnboardingState,
  type OnboardingPath,
  type OnboardingStateReader,
  type OnboardingState,
  type OnboardingStepId,
} from '@/lib/onboarding'
import { POSTHOG_EVENTS } from '@/lib/posthog-events'
import { captureServerEvent } from '@/lib/posthog-server'

type RoutePayload =
  | {
      action: 'complete_welcome'
      welcomePath: OnboardingPath
      hasExportReady: boolean
    }
  | {
      action: 'skip_welcome'
    }
  | {
      action: 'dismiss_checklist'
      dismissed: boolean
    }
  | {
      action: 'dismiss_hint'
      hintKey: string
    }
  | {
      action: 'reset_hints'
    }
  | {
      action: 'replay'
    }
  | {
      action: 'mark_step_complete'
      stepId: OnboardingStepId
      route?: string
      metadata?: Record<string, string | number | boolean | null>
    }
  | {
      action: 'mark_negotiation_message'
      route?: string
      metadata?: Record<string, string | number | boolean | null>
    }
  | {
      action: 'mark_seen'
    }

function asRecord(value: unknown) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

async function getAuthedState() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { supabase, user: null, state: null }
  }

  const state = await fetchOnboardingState(supabase as unknown as OnboardingStateReader, user.id)
  return { supabase, user, state }
}

async function upsertState(
  supabase: Awaited<ReturnType<typeof createClient>>,
  state: OnboardingState,
  nextValues: Partial<OnboardingState>
) {
  const payload: Record<string, unknown> = {
    ...state,
    ...nextValues,
    user_id: state.user_id,
  }

  const onboardingTable = supabase.from('onboarding_states') as {
    upsert: (values: Record<string, unknown>) => {
      select: (columns: string) => {
        single: () => PromiseLike<{ data: Partial<OnboardingState> | null; error: { message: string } | null }>
      }
    }
  }

  const { data, error } = await onboardingTable
    .upsert(payload)
    .select('*')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return normalizeOnboardingState(state.user_id, data as Partial<OnboardingState>)
}

async function maybeCompleteOnboarding(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  previousState: OnboardingState,
  nextState: OnboardingState
) {
  if (previousState.completed_at || nextState.completed_at) return nextState
  if (!nextState.rate_card_created) return nextState
  if (!nextState.first_negotiation_message && !nextState.first_channel_advisor_message) return nextState

  const completedState = await upsertState(supabase, nextState, {
    completed_at: new Date().toISOString(),
  })

  await captureServerEvent({
    distinctId: userId,
    event: POSTHOG_EVENTS.onboardingCompleted,
    properties: {
      onboarding_path: completedState.welcome_path,
      has_export_ready: completedState.has_export_ready,
    },
  })

  return completedState
}

function getMilestoneEvent(stepId: OnboardingStepId) {
  switch (stepId) {
    case 'upload_analytics':
      return {
        completedEvent: POSTHOG_EVENTS.timeToFirstSnapshot,
        stateKey: 'snapshot_created_at' as const,
      }
    case 'generate_rate_card':
      return {
        completedEvent: POSTHOG_EVENTS.timeToFirstRateCard,
        stateKey: 'rate_card_created_at' as const,
      }
    case 'start_deal':
      return {
        completedEvent: POSTHOG_EVENTS.timeToFirstDeal,
        stateKey: 'deal_created_at' as const,
      }
    default:
      return null
  }
}

export async function POST(request: Request) {
  const { supabase, user, state } = await getAuthedState()

  if (!user || !state) {
    return new Response('Unauthorized', { status: 401 })
  }

  const body = await request.json() as RoutePayload
  const now = new Date().toISOString()
  let nextState = state

  if (body.action === 'complete_welcome') {
    nextState = await upsertState(supabase, state, {
      welcome_completed: true,
      welcome_path: body.welcomePath,
      has_export_ready: body.hasExportReady,
      last_seen_at: now,
      dismissed_at: null,
    })

    await captureServerEvent({
      distinctId: user.id,
      event: POSTHOG_EVENTS.onboardingStarted,
      properties: {
        onboarding_path: body.welcomePath,
        has_export_ready: body.hasExportReady,
      },
    })

    return NextResponse.json({
      state: nextState,
      destination: getWelcomeDestination(body.welcomePath, body.hasExportReady),
    })
  }

  if (body.action === 'skip_welcome') {
    nextState = await upsertState(supabase, state, {
      welcome_completed: true,
      dismissed_at: now,
      last_seen_at: now,
    })

    await captureServerEvent({
      distinctId: user.id,
      event: POSTHOG_EVENTS.onboardingSkipped,
      properties: {
        onboarding_path: state.welcome_path,
      },
    })

    return NextResponse.json({
      state: nextState,
      destination: '/dashboard',
    })
  }

  if (body.action === 'dismiss_checklist') {
    nextState = await upsertState(supabase, state, {
      checklist_dismissed: body.dismissed,
      dismissed_at: body.dismissed ? now : state.dismissed_at,
      last_seen_at: now,
    })

    return NextResponse.json({ state: nextState })
  }

  if (body.action === 'dismiss_hint') {
    const dismissedHints = {
      ...state.dismissed_hints,
      [body.hintKey]: now,
    }

    nextState = await upsertState(supabase, state, {
      dismissed_hints: dismissedHints,
      last_seen_at: now,
    })

    await captureServerEvent({
      distinctId: user.id,
      event: POSTHOG_EVENTS.onboardingHintDismissed,
      properties: {
        hint_key: body.hintKey,
      },
    })

    return NextResponse.json({ state: nextState })
  }

  if (body.action === 'reset_hints') {
    nextState = await upsertState(supabase, state, {
      dismissed_hints: {},
      route_hints_dismissed: false,
      checklist_dismissed: false,
      dismissed_at: null,
      last_seen_at: now,
    })

    return NextResponse.json({ state: nextState })
  }

  if (body.action === 'replay') {
    nextState = await upsertState(supabase, state, {
      started_at: now,
      completed_at: null,
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
      dismissed_hints: {},
      checklist_state: {},
      route_hints_dismissed: false,
      checklist_dismissed: false,
      dismissed_at: null,
      last_seen_at: now,
    })

    return NextResponse.json({ state: nextState })
  }

  if (body.action === 'mark_seen') {
    nextState = await upsertState(supabase, state, { last_seen_at: now })
    return NextResponse.json({ state: nextState })
  }

  if (body.action === 'mark_step_complete') {
    const metadata = asRecord(body.metadata)
    const updates: Partial<OnboardingState> = {
      last_seen_at: now,
      checklist_dismissed: false,
    }

    if (body.stepId === 'upload_analytics') {
      updates.snapshot_created = true
      updates.snapshot_created_at = state.snapshot_created_at ?? now
    }

    if (body.stepId === 'generate_rate_card') {
      updates.rate_card_created = true
      updates.rate_card_created_at = state.rate_card_created_at ?? now
    }

    if (body.stepId === 'start_deal') {
      updates.deal_created = true
      updates.deal_created_at = state.deal_created_at ?? now
    }

    if (body.stepId === 'ask_channel_ai') {
      updates.first_channel_advisor_message = true
      updates.first_channel_advisor_message_at = state.first_channel_advisor_message_at ?? now
    }

    nextState = await upsertState(supabase, state, updates)

    await captureServerEvent({
      distinctId: user.id,
      event: POSTHOG_EVENTS.onboardingStepCompleted,
      properties: {
        step_id: body.stepId,
        route: body.route ?? null,
        onboarding_path: nextState.welcome_path,
        ...metadata,
      },
    })

    const milestoneEvent = getMilestoneEvent(body.stepId)
    if (milestoneEvent) {
      const seconds = getMilestoneDurationSeconds(nextState.started_at, nextState[milestoneEvent.stateKey])
      if (seconds !== null && !state[milestoneEvent.stateKey]) {
        await captureServerEvent({
          distinctId: user.id,
          event: milestoneEvent.completedEvent,
          properties: {
            onboarding_path: nextState.welcome_path,
            seconds_to_milestone: seconds,
            route: body.route ?? null,
            ...metadata,
          },
        })
      }
    }

    if (body.stepId === 'ask_channel_ai' && !state.first_channel_advisor_message) {
      await captureServerEvent({
        distinctId: user.id,
        event: POSTHOG_EVENTS.firstChannelAdvisorMessage,
        properties: {
          onboarding_path: nextState.welcome_path,
          route: body.route ?? null,
          ...metadata,
        },
      })
    }

    nextState = await maybeCompleteOnboarding(supabase, user.id, state, nextState)

    return NextResponse.json({ state: nextState })
  }

  if (body.action === 'mark_negotiation_message') {
    nextState = await upsertState(supabase, state, {
      first_negotiation_message: true,
      first_negotiation_message_at: state.first_negotiation_message_at ?? now,
      checklist_dismissed: false,
      last_seen_at: now,
    })

    if (!state.first_negotiation_message) {
      await captureServerEvent({
        distinctId: user.id,
        event: POSTHOG_EVENTS.firstAiNegotiationMessage,
        properties: {
          onboarding_path: nextState.welcome_path,
          route: body.route ?? null,
          ...asRecord(body.metadata),
        },
      })
    }

    nextState = await maybeCompleteOnboarding(supabase, user.id, state, nextState)
    return NextResponse.json({ state: nextState })
  }

  return new Response('Unsupported onboarding action.', { status: 400 })
}
