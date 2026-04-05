import { createClient } from '@/lib/supabase-server'
import { POSTHOG_EVENTS } from '@/lib/posthog-events'
import {
  captureServerEvent,
  createPostHogServerClient,
  shutdownPostHog,
} from '@/lib/posthog-server'

type FeedbackType = 'bug_report' | 'feature_request' | 'general_feedback'

type FeedbackRequest = {
  feedbackType?: FeedbackType
  message?: string
  pagePath?: string
  canContact?: boolean
}

type FeedbackResponse = {
  error?: string
}

const VALID_FEEDBACK_TYPES: FeedbackType[] = [
  'bug_report',
  'feature_request',
  'general_feedback',
]

export async function POST(request: Request) {
  const supabase = await createClient()
  const posthog = createPostHogServerClient()

  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError) {
      return Response.json({ error: authError.message } satisfies FeedbackResponse, { status: 401 })
    }

    if (!user) {
      return Response.json({ error: 'Unauthorized' } satisfies FeedbackResponse, { status: 401 })
    }

    const body = (await request.json().catch(() => null)) as FeedbackRequest | null

    if (!body) {
      return Response.json({ error: 'Invalid request body.' } satisfies FeedbackResponse, { status: 400 })
    }

    const feedbackType = body.feedbackType
    const message = body.message?.trim() ?? ''
    const pagePath = typeof body.pagePath === 'string' ? body.pagePath.slice(0, 250) : null
    const canContact = body.canContact !== false

    if (!feedbackType || !VALID_FEEDBACK_TYPES.includes(feedbackType)) {
      return Response.json({ error: 'Choose a feedback type.' } satisfies FeedbackResponse, { status: 400 })
    }

    if (message.length < 10) {
      return Response.json({ error: 'Feedback must be at least 10 characters.' } satisfies FeedbackResponse, { status: 400 })
    }

    if (message.length > 4000) {
      return Response.json({ error: 'Feedback must be 4000 characters or fewer.' } satisfies FeedbackResponse, { status: 400 })
    }

    const { error: insertError } = await supabase.from('feedback_submissions').insert({
      user_id: user.id,
      email: user.email ?? null,
      feedback_type: feedbackType,
      message,
      page_path: pagePath,
      can_contact: canContact,
    })

    if (insertError) {
      return Response.json({ error: insertError.message } satisfies FeedbackResponse, { status: 500 })
    }

    await captureServerEvent({
      client: posthog,
      distinctId: user.id,
      event: POSTHOG_EVENTS.feedbackSubmitted,
      properties: {
        user_id: user.id,
        feedback_type: feedbackType,
        can_contact: canContact,
        page_path: pagePath,
        message,
        message_length: message.length,
      },
    })

    return Response.json({ ok: true })
  } finally {
    await shutdownPostHog(posthog)
  }
}
