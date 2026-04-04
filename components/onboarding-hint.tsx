'use client'

import { useEffect } from 'react'
import { Info, X } from 'lucide-react'
import { useOnboarding } from '@/components/onboarding-provider'
import { captureAnalyticsEvent } from '@/lib/posthog-client'
import { POSTHOG_EVENTS } from '@/lib/posthog-events'

export default function OnboardingHint({
  hintKey,
  title,
  description,
  className = '',
  dismissible = true,
  children,
}: {
  hintKey: string
  title: string
  description: string
  className?: string
  dismissible?: boolean
  children?: React.ReactNode
}) {
  const { state, dismissHint } = useOnboarding()

  useEffect(() => {
    if (state.dismissed_hints[hintKey]) return

    captureAnalyticsEvent(POSTHOG_EVENTS.onboardingHintViewed, {
      hint_key: hintKey,
    })
  }, [hintKey, state.dismissed_hints])

  if (state.dismissed_hints[hintKey]) {
    return null
  }

  return (
    <div className={`rounded-2xl border border-border bg-white/95 p-4 shadow-sm ${className}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-light text-primary">
          <Info className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="mt-1 text-sm leading-relaxed text-muted">{description}</p>
          {children ? <div className="mt-3">{children}</div> : null}
        </div>
        {dismissible ? (
          <button
            type="button"
            onClick={() => void dismissHint(hintKey)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-muted transition-colors hover:bg-muted-light hover:text-foreground"
            aria-label={`Dismiss ${title}`}
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </div>
  )
}
