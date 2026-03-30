import { createClient } from '@/lib/supabase-server'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { name } = await request.json()
  const nextName = String(name ?? '').trim()

  if (!nextName) {
    return new Response('Rate card name is required.', { status: 400 })
  }

  const { data: rateCard } = await supabase
    .from('rate_cards')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!rateCard) {
    return new Response('Rate card not found.', { status: 404 })
  }

  const { error } = await supabase
    .from('rate_cards')
    .update({ name: nextName })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    return new Response(error.message, { status: 500 })
  }

  return Response.json({ ok: true, name: nextName })
}
