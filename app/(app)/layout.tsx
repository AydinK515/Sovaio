import type { Metadata } from 'next'
import { AppNav, Footer } from '@/components/navbar'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}
import ChannelAiSidebar from '@/components/channel-ai-sidebar'
import OnboardingShell from '@/components/onboarding-shell'
import { OnboardingProvider } from '@/components/onboarding-provider'
import { isAiEnabledForUser } from '@/lib/ai-access'
import { fetchOnboardingState, type OnboardingStateReader } from '@/lib/onboarding'
import { createClient } from '@/lib/supabase-server'
import type { AnalyticsSnapshot, ChannelAiChat, ChannelAiMessage } from '@/lib/types'
import { redirect } from 'next/navigation'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let channelName: string | null = null
  let snapshots: AnalyticsSnapshot[] = []
  let chats: ChannelAiChat[] = []
  let selectedChat: ChannelAiChat | null = null
  let messages: ChannelAiMessage[] = []
  let aiEnabled = true
  let onboardingState = null

  if (user) {
    const [
      profileResponse,
      snapshotsResponse,
      chatsResponse,
      nextAiEnabled,
      nextOnboardingState,
    ] = await Promise.all([
      supabase.from('profiles').select('channel_name').eq('id', user.id).single(),
      supabase.from('analytics_snapshots').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('channel_ai_chats').select('*').eq('user_id', user.id).order('updated_at', { ascending: false }),
      isAiEnabledForUser(supabase, user.id),
      fetchOnboardingState(supabase as unknown as OnboardingStateReader, user.id),
    ])

    channelName = profileResponse.data?.channel_name ?? null
    snapshots = (snapshotsResponse.data || []) as AnalyticsSnapshot[]
    chats = (chatsResponse.data || []) as ChannelAiChat[]
    selectedChat = chats[0] ?? null
    aiEnabled = nextAiEnabled
    onboardingState = nextOnboardingState

    if (!onboardingState.welcome_completed) {
      redirect('/welcome')
    }

    if (selectedChat) {
      const { data: chatMessages } = await supabase
        .from('channel_ai_messages')
        .select('*')
        .eq('chat_id', selectedChat.id)
        .order('created_at', { ascending: true })

      messages = (chatMessages || []) as ChannelAiMessage[]
    }
  }

  if (!user || !onboardingState) {
    return null
  }

  return (
    <OnboardingProvider initialState={onboardingState}>
      <AppNav hasAnalytics={snapshots.length > 0} />
      <div className="flex min-h-[calc(100dvh-65px)] w-full items-start">
        <div className="flex min-w-0 flex-1 flex-col self-stretch">
          <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </main>
          <Footer />
        </div>
        <ChannelAiSidebar
          aiEnabled={aiEnabled}
          initialSnapshots={snapshots}
          initialChats={chats}
          initialChat={selectedChat}
          initialMessages={messages}
          channelName={channelName}
        />
        <OnboardingShell />
      </div>
    </OnboardingProvider>
  )
}
