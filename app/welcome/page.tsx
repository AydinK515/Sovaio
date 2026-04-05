import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { fetchOnboardingState, type OnboardingStateReader } from '@/lib/onboarding'
import type { Profile } from '@/lib/types'
import WelcomeClient from './welcome-client'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Welcome',
  robots: { index: false, follow: false },
}

export default async function WelcomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const state = await fetchOnboardingState(supabase as unknown as OnboardingStateReader, user.id)
  if (state.welcome_completed) {
    redirect('/dashboard')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return <WelcomeClient initialState={state} initialProfile={(profile as Profile | null) ?? null} />
}
