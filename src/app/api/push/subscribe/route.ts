import { NextRequest, NextResponse } from 'next/server'
import { createClient, getProfile } from '@/utils/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const profile = await getProfile()
  const { subscription } = await req.json()

  if (!subscription) {
    return NextResponse.json({ error: 'Subscription mancante' }, { status: 400 })
  }

  const { error } = await supabase
    .from('push_subscriptions')
    .upsert([{
      user_id: user.id,
      sede_id: profile?.sede_id ?? null,
      subscription,
      updated_at: new Date().toISOString(),
    }], { onConflict: 'user_id,sede_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  await supabase.from('push_subscriptions').delete().eq('user_id', user.id)
  return NextResponse.json({ ok: true })
}
