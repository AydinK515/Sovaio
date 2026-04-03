'use client'

import { useEffect, useRef } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase-browser'
import {
  identifyAnalyticsUser,
  isPostHogBrowserEnabled,
  resetAnalytics,
} from '@/lib/posthog-client'

async function buildIdentifyPayload(user: User) {
  const supabase = createClient()
  const [{ data: profile }, { data: userFlags }] = await Promise.all([
    supabase
      .from('profiles')
      .select('email, full_name, channel_name, subscription_tier, has_sponsorships, subscriber_count, niche')
      .eq('id', user.id)
      .maybeSingle(),
    supabase
      .from('user_uneditable')
      .select('ai_enabled')
      .eq('user_id', user.id)
      .maybeSingle(),
  ])

  return {
    email: profile?.email ?? user.email ?? null,
    full_name: profile?.full_name ?? null,
    channel_name: profile?.channel_name ?? null,
    subscription_tier: profile?.subscription_tier ?? null,
    has_sponsorships: profile?.has_sponsorships ?? null,
    subscriber_count: profile?.subscriber_count ?? null,
    niche: profile?.niche ?? null,
    ai_enabled: userFlags?.ai_enabled ?? true,
  }
}

export default function PostHogProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const syncedUserIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!isPostHogBrowserEnabled()) {
      return
    }

    const supabase = createClient()

    const syncUser = async (user: User | null) => {
      if (!user) {
        syncedUserIdRef.current = null
        resetAnalytics()
        return
      }

      if (syncedUserIdRef.current === user.id) {
        return
      }

      const identifyProperties = await buildIdentifyPayload(user)
      identifyAnalyticsUser(user.id, identifyProperties)
      syncedUserIdRef.current = user.id
    }

    void supabase.auth.getUser().then(({ data }) => syncUser(data.user))

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event: string, session: Session | null) => {
        void syncUser(session?.user ?? null)
      }
    )

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [])

  return <>{children}</>
}
