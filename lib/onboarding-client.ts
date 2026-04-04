'use client'

import type { OnboardingPath, OnboardingState, OnboardingStepId } from '@/lib/onboarding'

type OnboardingAction =
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

export async function updateOnboardingState(input: OnboardingAction) {
  const response = await fetch('/api/onboarding', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  if (!response.ok) {
    throw new Error(await response.text())
  }

  const payload = await response.json()
  return payload.state as OnboardingState
}
