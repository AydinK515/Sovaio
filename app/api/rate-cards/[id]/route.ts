import { createClient } from '@/lib/supabase-server'

async function getAuthedRateCard(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { supabase, user: null, rateCard: null }
  }

  const { data: rateCard } = await supabase
    .from('rate_cards')
    .select('id, name')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  return { supabase, user, rateCard }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { supabase, user, rateCard } = await getAuthedRateCard(id)

  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { name } = await request.json()
  const nextName = String(name ?? '').trim()

  if (!nextName) {
    return new Response('Rate card name is required.', { status: 400 })
  }

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

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { supabase, user, rateCard } = await getAuthedRateCard(id)

  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  if (!rateCard) {
    return new Response('Rate card not found.', { status: 404 })
  }

  const { error: dealsError } = await supabase
    .from('deals')
    .update({ rate_card_id: null })
    .eq('user_id', user.id)
    .eq('rate_card_id', id)

  if (dealsError) {
    return new Response(dealsError.message, { status: 500 })
  }

  const { error: deleteError } = await supabase
    .from('rate_cards')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (deleteError) {
    return new Response(deleteError.message, { status: 500 })
  }

  return Response.json({ ok: true })
}
