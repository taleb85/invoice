import { NextResponse } from 'next/server'
import { getAppMeShellResult } from '@/lib/me-server'
import { getRequestAuth } from '@/utils/supabase/server'
import { checkSessionValid, recordActivity } from '@/lib/session-activity'
import type { UserRole } from '@/lib/session-policy'

export async function GET() {
  const r = await getAppMeShellResult()
  if (!r.ok) {
    if (r.kind === 'unauth') return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  const me = r.me

  // Only enforce strict session limits for operatori.
  // Admins use longer, standard Supabase token lifetimes.
  if (me.role === 'operatore') {
    // getRequestAuth is memoised with React.cache() — no extra round-trip.
    const { supabase, user } = await getRequestAuth()
    if (user) {
      const { valid, reason } = await checkSessionValid(supabase, user.id, me.role as UserRole)
      if (!valid) {
        await supabase.auth.signOut()
        return NextResponse.json(
          { error: 'session_expired', reason: reason ?? 'max_age' },
          { status: 401 },
        )
      }
      // Record heartbeat — runs at most every ~30–60 s due to Cache-Control + SWR dedup.
      await recordActivity(supabase, user.id)
    }
  }

  return NextResponse.json(
    {
      user:         me.user,
      full_name:    me.full_name,
      role:         me.role,
      sede_id:      me.sede_id,
      sede_nome:    me.sede_nome,
      country_code: me.country_code,
      currency:     me.currency,
      timezone:     me.timezone,
      is_admin:     me.is_admin,
      is_admin_sede: me.is_admin_sede,
      all_sedi:     me.all_sedi,
      onboarding_complete: me.onboarding_complete,
    },
    { headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' } },
  )
}
