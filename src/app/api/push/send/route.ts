import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { createServiceClient, getProfile } from '@/utils/supabase/server'
import { isMasterAdminRole, isSedePrivilegedRole } from '@/lib/roles'

export async function POST(req: NextRequest) {
  if (!process.env.VAPID_PRIVATE_KEY || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
    return NextResponse.json({ error: 'Push notifications not configured' }, { status: 503 })
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? 'mailto:admin@smartpair.app',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )

  // Accept either a valid admin session OR the CRON_SECRET bearer token (for internal fire-and-forget calls)
  const cronSecret = process.env.CRON_SECRET
  const authHeader = req.headers.get('authorization')
  const hasCronSecret = !!cronSecret && authHeader === `Bearer ${cronSecret}`

  if (!hasCronSecret) {
    const profile = await getProfile()
    if (!isMasterAdminRole(profile?.role) && !isSedePrivilegedRole(profile?.role)) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
    }
  }

  const { title, body, url, sede_id } = await req.json() as {
    title: string
    body: string
    url?: string
    sede_id?: string
  }

  const service = createServiceClient()
  let query = service.from('push_subscriptions').select('subscription, user_id')
  if (sede_id) query = query.eq('sede_id', sede_id) as typeof query

  const { data: subs } = await query
  if (!subs || subs.length === 0) {
    return NextResponse.json({ sent: 0 })
  }

  const payload = JSON.stringify({
    title,
    body,
    url: url ?? '/',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
  })

  let sent = 0
  const errors: string[] = []

  for (const sub of subs) {
    try {
      await webpush.sendNotification(sub.subscription as webpush.PushSubscription, payload)
      sent++
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(msg)
      // Remove stale subscriptions (410 Gone, 404 Not Found)
      if (msg.includes('410') || msg.includes('404')) {
        await service.from('push_subscriptions').delete().eq('user_id', sub.user_id)
      }
    }
  }

  return NextResponse.json({ sent, errors })
}
