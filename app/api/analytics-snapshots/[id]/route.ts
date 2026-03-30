import { createClient } from '@/lib/supabase-server'

async function getAuthedSnapshot(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { supabase, user: null, snapshot: null }
  }

  const { data: snapshot } = await supabase
    .from('analytics_snapshots')
    .select('id, name')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  return { supabase, user, snapshot }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { supabase, user, snapshot } = await getAuthedSnapshot(id)

  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  if (!snapshot) {
    return new Response('Snapshot not found.', { status: 404 })
  }

  const { name } = await request.json()
  const nextName = String(name ?? '').trim()

  if (!nextName) {
    return new Response('Snapshot name is required.', { status: 400 })
  }

  const { error } = await supabase
    .from('analytics_snapshots')
    .update({ name: nextName })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    return new Response(error.message, { status: 500 })
  }

  return Response.json({ ok: true, name: nextName })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { supabase, user, snapshot } = await getAuthedSnapshot(id)

  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  if (!snapshot) {
    return new Response('Snapshot not found.', { status: 404 })
  }

  const [{ error: rateCardsError }, { error: dealsError }, { error: channelChatsError }] = await Promise.all([
    supabase.from('rate_cards').update({ analytics_snapshot_id: null }).eq('user_id', user.id).eq('analytics_snapshot_id', id),
    supabase.from('deals').update({ analytics_snapshot_id: null }).eq('user_id', user.id).eq('analytics_snapshot_id', id),
    supabase.from('channel_ai_chats').update({ analytics_snapshot_id: null }).eq('user_id', user.id).eq('analytics_snapshot_id', id),
  ])

  const relationError = rateCardsError || dealsError || channelChatsError
  if (relationError) {
    return new Response(relationError.message, { status: 500 })
  }

  const { error: deleteError } = await supabase
    .from('analytics_snapshots')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (deleteError) {
    return new Response(deleteError.message, { status: 500 })
  }

  return Response.json({ ok: true })
}
