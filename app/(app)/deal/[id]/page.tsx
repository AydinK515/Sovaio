import { createClient } from '@/lib/supabase-server'
import { redirect, notFound } from 'next/navigation'
import type { AnalyticsSnapshot, Deal, DealChat, DealMessage, RateCard } from '@/lib/types'
import DealClient from './client'

export default async function DealPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ chat?: string }>
}) {
  const { id } = await params
  const { chat: requestedChatId } = await searchParams
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

  const { data: rateCard } = deal.rate_card_id
    ? await supabase
      .from('rate_cards')
      .select('*')
      .eq('id', deal.rate_card_id)
      .eq('user_id', user.id)
      .single()
    : { data: null }

  const [{ data: messages }, { data: snapshots }] = await Promise.all([
    supabase
      .from('deal_chats')
      .select('*')
      .eq('deal_id', id)
      .eq('user_id', user.id)
      .order('created_at', { ascending: true }),
    supabase
      .from('analytics_snapshots')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
  ])

  const chats = (messages || []) as DealChat[]
  const selectedChat = chats.find(chat => chat.id === requestedChatId) ?? chats[0] ?? null

  const { data: threadMessages } = selectedChat
    ? await supabase
      .from('deal_messages')
      .select('*')
      .eq('deal_id', id)
      .eq('chat_id', selectedChat.id)
      .order('created_at', { ascending: true })
    : { data: [] }

  return (
    <DealClient
      deal={deal as Deal}
      rateCard={(rateCard as RateCard | null) ?? null}
      snapshots={(snapshots || []) as AnalyticsSnapshot[]}
      initialChats={chats}
      initialChat={selectedChat}
      initialMessages={(threadMessages || []) as DealMessage[]}
    />
  )
}
