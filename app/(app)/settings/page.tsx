import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import SettingsClient from './client'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()

  return <SettingsClient user={user} profile={profile} />
}
