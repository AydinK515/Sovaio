'use client'

import posthog from 'posthog-js'
import type { AnalyticsEventProperties, PostHogEventName } from '@/lib/posthog-events'

export type PostHogIdentifyProperties = {
  email?: string | null
  full_name?: string | null
  channel_name?: string | null
  subscription_tier?: string | null
  has_sponsorships?: boolean | null
  subscriber_count?: number | null
  niche?: string | null
  ai_enabled?: boolean | null
}

function sanitizeProperties(properties?: AnalyticsEventProperties | PostHogIdentifyProperties) {
  if (!properties) {
    return undefined
  }

  return Object.fromEntries(
    Object.entries(properties).filter(([, value]) => value !== undefined)
  )
}

export function isPostHogBrowserEnabled() {
  return Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY && process.env.NEXT_PUBLIC_POSTHOG_HOST)
}

export function getPostHog() {
  return posthog
}

export function captureAnalyticsEvent(
  event: PostHogEventName,
  properties?: AnalyticsEventProperties
) {
  if (!isPostHogBrowserEnabled()) {
    return
  }

  posthog.capture(event, sanitizeProperties(properties))
}

export function identifyAnalyticsUser(
  distinctId: string,
  properties?: PostHogIdentifyProperties
) {
  if (!isPostHogBrowserEnabled()) {
    return
  }

  posthog.identify(distinctId, sanitizeProperties(properties))
}

export function resetAnalytics() {
  if (!isPostHogBrowserEnabled()) {
    return
  }

  posthog.reset()
}
