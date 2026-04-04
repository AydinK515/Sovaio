'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { captureAnalyticsEvent } from '@/lib/posthog-client'
import { POSTHOG_EVENTS } from '@/lib/posthog-events'

export default function OnboardingSpotlightCard({
  title,
  description,
  ctaHref,
  ctaLabel,
  secondary,
}: {
  title: string
  description: string
  ctaHref: string
  ctaLabel: string
  secondary?: React.ReactNode
}) {
  return (
    <div className="rounded-[28px] border border-border bg-white p-6 shadow-[0_18px_50px_-40px_rgba(15,23,42,0.3)]">
      <h2 className="text-xl font-semibold text-foreground">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">{description}</p>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Link
          href={ctaHref}
          onClick={() => captureAnalyticsEvent(POSTHOG_EVENTS.emptyStateCtaClicked, {
            cta_location: 'spotlight_card',
            destination: ctaHref,
          })}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
        >
          {ctaLabel}
          <ArrowRight className="h-4 w-4" />
        </Link>
        {secondary}
      </div>
    </div>
  )
}
