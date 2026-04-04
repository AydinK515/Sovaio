import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'

type DeleteResponse = {
  error: string
}

async function deleteFromTable(admin: ReturnType<typeof createAdminClient>, table: string, column: string, value: string) {
  const { error } = await admin.from(table).delete().eq(column, value)
  if (error) {
    throw new Error(error.message)
  }
}

async function removeAvatarObjects(admin: ReturnType<typeof createAdminClient>, userId: string) {
  const { data, error } = await admin.storage.from('avatars').list(userId, {
    limit: 1000,
  })

  if (error) {
    throw new Error(error.message)
  }

  if (!data || data.length === 0) return

  const paths = data
    .filter((item) => item.name)
    .map((item) => `${userId}/${item.name}`)

  if (paths.length === 0) return

  const { error: removeError } = await admin.storage.from('avatars').remove(paths)

  if (removeError) {
    throw new Error(removeError.message)
  }
}

export async function DELETE() {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError) {
    return Response.json<DeleteResponse>({ error: authError.message }, { status: 401 })
  }

  if (!user) {
    return Response.json<DeleteResponse>({ error: 'Unauthorized' }, { status: 401 })
  }

  let admin: ReturnType<typeof createAdminClient>

  try {
    admin = createAdminClient()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Supabase admin client is not configured.'
    return Response.json<DeleteResponse>({ error: message }, { status: 500 })
  }

  try {
    await removeAvatarObjects(admin, user.id)

    await deleteFromTable(admin, 'deal_messages', 'user_id', user.id)
    await deleteFromTable(admin, 'channel_ai_messages', 'user_id', user.id)
    await deleteFromTable(admin, 'deal_chats', 'user_id', user.id)
    await deleteFromTable(admin, 'channel_ai_chats', 'user_id', user.id)
    await deleteFromTable(admin, 'deals', 'user_id', user.id)
    await deleteFromTable(admin, 'rate_cards', 'user_id', user.id)
    await deleteFromTable(admin, 'analytics_snapshots', 'user_id', user.id)
    await deleteFromTable(admin, 'csv_uploads', 'user_id', user.id)
    await deleteFromTable(admin, 'user_uneditable', 'user_id', user.id)
    await deleteFromTable(admin, 'onboarding_states', 'user_id', user.id)
    await deleteFromTable(admin, 'profiles', 'id', user.id)

    const { error: deleteUserError } = await admin.auth.admin.deleteUser(user.id)

    if (deleteUserError) {
      throw new Error(deleteUserError.message)
    }

    return Response.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to delete account.'
    return Response.json<DeleteResponse>({ error: message }, { status: 500 })
  }
}
