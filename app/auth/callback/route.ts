import { createClient } from '@/lib/supabase-server'
import { POSTHOG_EVENTS } from '@/lib/posthog-events'
import { captureServerEvent } from '@/lib/posthog-server'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const redirect = searchParams.get('redirect') || '/dashboard'

  if (code) {
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      await captureServerEvent({
        distinctId: user.id,
        event: POSTHOG_EVENTS.authLoginCompleted,
        properties: {
          user_id: user.id,
        },
      })
    }
  }

  return NextResponse.redirect(`${origin}${redirect}`)
}
