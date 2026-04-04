'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { captureAnalyticsEvent } from '@/lib/posthog-client'
import { POSTHOG_EVENTS } from '@/lib/posthog-events'

export default function EmptyStateLaunchpad({
  eyebrow,
  title,
  description,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
}: {
  eyebrow: string
  title: string
  description: string
  primaryHref: string
  primaryLabel: string
  secondaryHref?: string
  secondaryLabel?: string
}) {
  return (
    <div className="rounded-[32px] border border-border bg-white p-8 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.32)] md:p-10">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{eyebrow}</p>
      <h2 className="mt-3 text-2xl font-semibold text-foreground md:text-3xl">{title}</h2>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted md:text-base">{description}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href={primaryHref}
          onClick={() => captureAnalyticsEvent(POSTHOG_EVENTS.emptyStateCtaClicked, {
            cta_location: 'empty_state_launchpad_primary',
            destination: primaryHref,
          })}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
        >
          {primaryLabel}
          <ArrowRight className="h-4 w-4" />
        </Link>
        {secondaryHref && secondaryLabel ? (
          <Link
            href={secondaryHref}
            onClick={() => captureAnalyticsEvent(POSTHOG_EVENTS.emptyStateCtaClicked, {
              cta_location: 'empty_state_launchpad_secondary',
              destination: secondaryHref,
            })}
            className="inline-flex items-center gap-2 rounded-xl border border-border px-5 py-3 text-sm font-medium transition-colors hover:bg-muted-light"
          >
            {secondaryLabel}
          </Link>
        ) : null}
      </div>
    </div>
  )
}
