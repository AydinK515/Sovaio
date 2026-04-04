'use client'

import { useEffect } from 'react'
import { Sparkles } from 'lucide-react'
import { useOnboarding } from '@/components/onboarding-provider'
import { captureAnalyticsEvent } from '@/lib/posthog-client'
import { POSTHOG_EVENTS } from '@/lib/posthog-events'

export default function OnboardingRouteBanner({
  bannerKey,
  eyebrow,
  title,
  description,
  children,
}: {
  bannerKey: string
  eyebrow?: string
  title: string
  description: string
  children?: React.ReactNode
}) {
  const { state } = useOnboarding()

  useEffect(() => {
    if (state.dismissed_hints[bannerKey]) return
    captureAnalyticsEvent(POSTHOG_EVENTS.onboardingHintViewed, {
      hint_key: bannerKey,
      source: 'route_banner',
    })
  }, [bannerKey, state.dismissed_hints])

  if (state.dismissed_hints[bannerKey]) {
    return null
  }

  return (
    <div className="rounded-[28px] border border-primary/15 bg-[linear-gradient(135deg,rgba(254,242,242,0.95),rgba(255,255,255,1))] p-5 shadow-[0_18px_50px_-40px_rgba(220,38,38,0.5)]">
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-white">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          {eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{eyebrow}</p> : null}
          <h2 className="mt-1 text-xl font-semibold text-foreground">{title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">{description}</p>
          {children ? <div className="mt-4">{children}</div> : null}
        </div>
      </div>
    </div>
  )
}
