import { AppNav, Footer } from '@/components/navbar'
import ChannelAiSidebar from '@/components/channel-ai-sidebar'
import { createClient } from '@/lib/supabase-server'
import type { AnalyticsSnapshot, ChannelAiChat, ChannelAiMessage } from '@/lib/types'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let channelName: string | null = null
  let snapshots: AnalyticsSnapshot[] = []
  let chats: ChannelAiChat[] = []
  let selectedChat: ChannelAiChat | null = null
  let messages: ChannelAiMessage[] = []

  if (user) {
    const [
      profileResponse,
      snapshotsResponse,
      chatsResponse,
    ] = await Promise.all([
      supabase.from('profiles').select('channel_name').eq('id', user.id).single(),
      supabase.from('analytics_snapshots').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('channel_ai_chats').select('*').eq('user_id', user.id).order('updated_at', { ascending: false }),
    ])

    channelName = profileResponse.data?.channel_name ?? null
    snapshots = (snapshotsResponse.data || []) as AnalyticsSnapshot[]
    chats = (chatsResponse.data || []) as ChannelAiChat[]
    selectedChat = chats[0] ?? null

    if (selectedChat) {
      const { data: chatMessages } = await supabase
        .from('channel_ai_messages')
        .select('*')
        .eq('chat_id', selectedChat.id)
        .order('created_at', { ascending: true })

      messages = (chatMessages || []) as ChannelAiMessage[]
    }
  }

  return (
    <>
      <AppNav hasAnalytics={snapshots.length > 0} />
      <div className="mx-auto flex w-full max-w-[120rem] items-start">
        <div className="min-w-0 flex-1">
          <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </main>
          <Footer />
        </div>
        <ChannelAiSidebar
          initialSnapshots={snapshots}
          initialChats={chats}
          initialChat={selectedChat}
          initialMessages={messages}
          channelName={channelName}
        />
      </div>
    </>
  )
}
