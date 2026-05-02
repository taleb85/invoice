import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, getProfile, getRequestAuth } from '@/utils/supabase/server'

export async function POST(req: NextRequest) {
  const { user } = await getRequestAuth()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const profile = await getProfile()
  const { subscription } = await req.json()

  if (!subscription) {
    return NextResponse.json({ error: 'Subscription mancante' }, { status: 400 })
  }

  const { error } = await service
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

export async function DELETE() {
  const { user } = await getRequestAuth()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  await service.from('push_subscriptions').delete().eq('user_id', user.id)
  return NextResponse.json({ ok: true })
}
