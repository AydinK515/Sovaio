import type { SupabaseClient } from '@supabase/supabase-js'

const AI_DISABLED_MESSAGE = 'AI features are disabled for this account.'

type MinimalSupabase = Pick<SupabaseClient, 'from'>

export async function isAiEnabledForUser(
  supabase: MinimalSupabase,
  userId: string
) {
  const { data, error } = await supabase
    .from('user_uneditable')
    .select('ai_enabled')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load AI access settings: ${error.message}`)
  }

  return data?.ai_enabled ?? true
}

export async function requireAiEnabled(
  supabase: MinimalSupabase,
  userId: string
) {
  const aiEnabled = await isAiEnabledForUser(supabase, userId)

  if (!aiEnabled) {
    return new Response(AI_DISABLED_MESSAGE, { status: 403 })
  }

  return null
}

export function getAiDisabledMessage() {
  return AI_DISABLED_MESSAGE
}
