import posthog from 'posthog-js'

try {
  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY
  const apiHost = process.env.NEXT_PUBLIC_POSTHOG_HOST

  if (apiKey && apiHost && !posthog.__loaded) {
    posthog.init(apiKey, {
      api_host: apiHost,
      autocapture: true,
      capture_pageview: 'history_change',
      capture_pageleave: true,
      capture_exceptions: true,
      disable_session_recording: false,
      session_recording: {
        maskAllInputs: false,
        maskInputOptions: {
          password: true,
        },
      },
      person_profiles: 'identified_only',
    })
  }
} catch (error) {
  console.error('Failed to initialize PostHog client instrumentation', error)
}
