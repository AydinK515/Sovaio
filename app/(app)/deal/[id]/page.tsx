import { createClient } from '@/lib/supabase-server'
import { redirect, notFound } from 'next/navigation'
import type { Deal, DealMessage } from '@/lib/types'
import DealClient from './client'

export default async function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: deal } = await supabase
    .from('deals')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!deal) notFound()

  const { data: messages } = await supabase
    .from('deal_messages')
    .select('*')
    .eq('deal_id', id)
    .order('created_at', { ascending: true })

  return <DealClient deal={deal as Deal} initialMessages={(messages || []) as DealMessage[]} />
}
