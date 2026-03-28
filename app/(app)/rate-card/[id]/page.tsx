import { createClient } from '@/lib/supabase-server'
import { redirect, notFound } from 'next/navigation'
import type { RateCard } from '@/lib/types'
import RateCardClient from './client'

export default async function RateCardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: rateCard } = await supabase
    .from('rate_cards')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!rateCard) notFound()

  return <RateCardClient rateCard={rateCard as RateCard} />
}
