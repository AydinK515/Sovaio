'use client'

import { createContext, useContext, useMemo, useState, useTransition } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  getChecklistAnalyticsProperties,
  getChecklistItems,
  getOnboardingCompletionCount,
  getOnboardingNextHref,
  isOnboardingCompleted,
  shouldQuietOnboarding,
  type OnboardingState,
  type OnboardingStepId,
} from '@/lib/onboarding'
import { updateOnboardingState } from '@/lib/onboarding-client'
import { captureAnalyticsEvent } from '@/lib/posthog-client'
import { POSTHOG_EVENTS } from '@/lib/posthog-events'

type OnboardingContextValue = {
  state: OnboardingState
  checklistOpen: boolean
  isPending: boolean
  setChecklistOpen: (open: boolean) => void
  dismissChecklist: () => Promise<void>
  reopenChecklist: () => Promise<void>
  dismissHint: (hintKey: string) => Promise<void>
  resetHints: () => Promise<void>
  replayOnboarding: () => Promise<void>
  completeStep: (stepId: OnboardingStepId, metadata?: Record<string, string | number | boolean | null>) => Promise<void>
  markNegotiationMessage: (metadata?: Record<string, string | number | boolean | null>) => Promise<void>
  trackChecklistClick: (stepId: OnboardingStepId, source?: string) => void
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null)

export function OnboardingProvider({
  initialState,
  children,
}: {
  initialState: OnboardingState
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [state, setState] = useState(initialState)
  const [checklistOpen, setChecklistOpen] = useState(!initialState.checklist_dismissed)
  const [isPending, startTransition] = useTransition()

  async function runOptimisticUpdate({
    optimisticState,
    optimisticChecklistOpen,
    request,
    onSuccess,
  }: {
    optimisticState?: OnboardingState
    optimisticChecklistOpen?: boolean
    request: () => Promise<OnboardingState>
    onSuccess?: (nextState: OnboardingState) => void
  }) {
    const previousState = state
    const previousChecklistOpen = checklistOpen

    if (optimisticState) {
      setState(optimisticState)
    }

    if (typeof optimisticChecklistOpen === 'boolean') {
      setChecklistOpen(optimisticChecklistOpen)
    }

    try {
      const nextState = await request()
      setState(nextState)
      onSuccess?.(nextState)
      return nextState
    } catch (error) {
      setState(previousState)
      setChecklistOpen(previousChecklistOpen)
      throw error
    }
  }

  const value = useMemo<OnboardingContextValue>(() => ({
    state,
    checklistOpen,
    isPending,
    setChecklistOpen,
    dismissChecklist: async () => {
      const optimisticState = {
        ...state,
        checklist_dismissed: true,
      }

      await runOptimisticUpdate({
        optimisticState,
        optimisticChecklistOpen: false,
        request: () => updateOnboardingState({ action: 'dismiss_checklist', dismissed: true }),
      })
    },
    reopenChecklist: async () => {
      const optimisticState = {
        ...state,
        checklist_dismissed: false,
      }

      await runOptimisticUpdate({
        optimisticState,
        optimisticChecklistOpen: true,
        request: () => updateOnboardingState({ action: 'dismiss_checklist', dismissed: false }),
      })
    },
    dismissHint: async (hintKey: string) => {
      const optimisticState = {
        ...state,
        dismissed_hints: {
          ...state.dismissed_hints,
          [hintKey]: new Date().toISOString(),
        },
      }

      await runOptimisticUpdate({
        optimisticState,
        request: () => updateOnboardingState({ action: 'dismiss_hint', hintKey }),
      })
    },
    resetHints: async () => {
      const optimisticState = {
        ...state,
        dismissed_hints: {},
        route_hints_dismissed: false,
        checklist_dismissed: false,
      }

      await runOptimisticUpdate({
        optimisticState,
        optimisticChecklistOpen: true,
        request: () => updateOnboardingState({ action: 'reset_hints' }),
      })
    },
    replayOnboarding: async () => {
      captureAnalyticsEvent(POSTHOG_EVENTS.onboardingReplayed, {
        route: pathname,
        onboarding_path: state.welcome_path,
      })
      const nextState = await updateOnboardingState({ action: 'replay' })
      setState(nextState)
      setChecklistOpen(true)
      router.push('/welcome?mode=replay')
      router.refresh()
    },
    completeStep: async (stepId, metadata) => {
      const route = pathname
      const nextState = await updateOnboardingState({
        action: 'mark_step_complete',
        stepId,
        route,
        metadata,
      })
      setState(nextState)
      startTransition(() => router.refresh())
    },
    markNegotiationMessage: async (metadata) => {
      const nextState = await updateOnboardingState({
        action: 'mark_negotiation_message',
        route: pathname,
        metadata,
      })
      setState(nextState)
      startTransition(() => router.refresh())
    },
    trackChecklistClick: (stepId, source) => {
      captureAnalyticsEvent(
        POSTHOG_EVENTS.onboardingChecklistItemClicked,
        getChecklistAnalyticsProperties(state, stepId, pathname, { source })
      )
    },
  }), [checklistOpen, isPending, pathname, router, state])

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>
}

export function useOnboarding() {
  const value = useContext(OnboardingContext)
  if (!value) {
    throw new Error('useOnboarding must be used inside OnboardingProvider.')
  }
  return value
}

export function useOnboardingChecklist() {
  const { state } = useOnboarding()

  return {
    items: getChecklistItems(state),
    completedCount: getOnboardingCompletionCount(state),
    totalCount: getChecklistItems(state).length,
    nextHref: getOnboardingNextHref(state),
    quieted: shouldQuietOnboarding(state),
    completed: isOnboardingCompleted(state),
  }
}
