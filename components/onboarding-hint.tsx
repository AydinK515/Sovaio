'use client'

import { useEffect } from 'react'
import type { LucideIcon } from 'lucide-react'
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
  icon: Icon = Info,
  iconContainerClassName = '',
  titleClassName = '',
  descriptionClassName = '',
  contentClassName = '',
  childrenClassName = '',
  children,
}: {
  hintKey: string
  title: string
  description: string
  className?: string
  dismissible?: boolean
  icon?: LucideIcon
  iconContainerClassName?: string
  titleClassName?: string
  descriptionClassName?: string
  contentClassName?: string
  childrenClassName?: string
  children?: React.ReactNode
}) {
  const { state, dismissHint } = useOnboarding()
  const isRemovedRateCardHint = hintKey.startsWith('rate-card-') && hintKey.endsWith('-read-guide')

  useEffect(() => {
    if (isRemovedRateCardHint) return
    if (state.dismissed_hints[hintKey]) return

    captureAnalyticsEvent(POSTHOG_EVENTS.onboardingHintViewed, {
      hint_key: hintKey,
    })
  }, [hintKey, isRemovedRateCardHint, state.dismissed_hints])

  if (isRemovedRateCardHint || state.dismissed_hints[hintKey]) {
    return null
  }

  return (
    <div className={`rounded-2xl border border-border bg-white/95 p-4 shadow-sm ${className}`}>
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-light text-primary ${iconContainerClassName}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className={`min-w-0 flex-1 ${contentClassName}`}>
          <p className={`text-sm font-semibold text-foreground ${titleClassName}`}>{title}</p>
          <p className={`mt-1 text-sm leading-relaxed text-muted ${descriptionClassName}`}>{description}</p>
          {children ? <div className={`mt-3 ${childrenClassName}`}>{children}</div> : null}
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
