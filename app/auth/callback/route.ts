import { createClient } from '@/lib/supabase-server'
import { normalizeAuthRedirectPath } from '@/lib/security'
import { fetchOnboardingState, type OnboardingStateReader } from '@/lib/onboarding'
import { POSTHOG_EVENTS } from '@/lib/posthog-events'
import { captureServerEvent } from '@/lib/posthog-server'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const redirect = normalizeAuthRedirectPath(searchParams.get('redirect'))

  if (code) {
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      await supabase
        .from('onboarding_states')
        .upsert({
          user_id: user.id,
          started_at: new Date().toISOString(),
          last_seen_at: new Date().toISOString(),
        })

      const onboardingState = await fetchOnboardingState(supabase as unknown as OnboardingStateReader, user.id)

      await captureServerEvent({
        distinctId: user.id,
        event: POSTHOG_EVENTS.authLoginCompleted,
        properties: {
          user_id: user.id,
        },
      })

      if (!onboardingState.welcome_completed) {
        return NextResponse.redirect(`${origin}/welcome`)
      }
    }
  }

  return NextResponse.redirect(new URL(redirect, origin))
}
