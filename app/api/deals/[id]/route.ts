import { createClient } from '@/lib/supabase-server'

async function getAuthedDeal(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { supabase, user: null, deal: null }
  }

  const { data: deal } = await supabase
    .from('deals')
    .select('id, brand_name')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  return { supabase, user, deal }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { supabase, user, deal } = await getAuthedDeal(id)

  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  if (!deal) {
    return new Response('Deal not found.', { status: 404 })
  }

  const { error: messagesError } = await supabase
    .from('deal_messages')
    .delete()
    .eq('deal_id', id)
    .eq('user_id', user.id)

  if (messagesError) {
    return new Response(messagesError.message, { status: 500 })
  }

  const { error: chatsError } = await supabase
    .from('deal_chats')
    .delete()
    .eq('deal_id', id)
    .eq('user_id', user.id)

  if (chatsError) {
    return new Response(chatsError.message, { status: 500 })
  }

  const { error: dealError } = await supabase
    .from('deals')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (dealError) {
    return new Response(dealError.message, { status: 500 })
  }

  return Response.json({ ok: true })
}
