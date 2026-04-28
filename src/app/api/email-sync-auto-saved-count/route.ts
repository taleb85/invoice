import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { countEmailAutoSavedTodayForSede } from '@/lib/dashboard-notification-counts'

/**
 * GET ?timezone=Europe/Rome
 * Conteggio fatture+bolle con `email_sync_auto_saved_at` nel giorno solare (sede utente).
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const tz = req.nextUrl.searchParams.get('timezone')?.trim() || 'UTC'

  const { data: profile } = await supabase.from('profiles').select('role, sede_id').eq('id', user.id).maybeSingle()

  let sedeId: string | null = profile?.sede_id ?? null
  const isMaster = profile?.role === 'admin'
  if (isMaster) {
    const pick = req.cookies.get('admin-sede-id')?.value?.trim()
    if (pick) sedeId = pick
  }

  if (!sedeId) {
    return NextResponse.json({ count: 0 })
  }

  const n = await countEmailAutoSavedTodayForSede(supabase, sedeId, tz)
  return NextResponse.json({ count: n })
}
