import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { fetchOnboardingState, type OnboardingStateReader } from '@/lib/onboarding'
import WelcomeClient from './welcome-client'

export default async function WelcomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const state = await fetchOnboardingState(supabase as unknown as OnboardingStateReader, user.id)
  if (state.welcome_completed) {
    redirect('/dashboard')
  }

  return <WelcomeClient initialState={state} />
}
