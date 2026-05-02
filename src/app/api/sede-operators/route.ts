import { type NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient, type SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/utils/supabase/server'
import { isProfilesBranchDeskRole } from '@/lib/roles'

function serviceDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createServiceClient(url, key)
}

function canListOperatorsSessionScope(profile: { sede_id?: string | null; role?: string | null } | null): boolean {
  if (!profile?.sede_id || String(profile.sede_id).trim() === '') return false
  return isProfilesBranchDeskRole(profile.role)
}

/** Elenco operatori + country sede usando il client passato (sessione o service). */
async function jsonForSedeIdWithClient(supabase: SupabaseClient, sedeId: string) {
  const [profilesRes, sedeRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, role')
      .eq('sede_id', sedeId)
      .in('role', ['operatore', 'admin_sede', 'admin_tecnico'])
      .order('full_name'),
    supabase.from('sedi').select('country_code').eq('id', sedeId).maybeSingle(),
  ])

  if (profilesRes.error) {
    console.error('[sede-operators] profiles select', profilesRes.error.message)
    return NextResponse.json({ sede_id: sedeId, country_code: null, operators: [] })
  }

  return NextResponse.json({
    sede_id: sedeId,
    country_code: (sedeRes.data as { country_code?: string | null } | null)?.country_code ?? null,
    operators: (profilesRes.data ?? []).map((p) => ({
      id: p.id,
      full_name: (p.full_name ?? '') as string,
    })),
  })
}

/** Kiosk / cookie: nessun utente Auth → serve service role per bypass RLS. */
async function jsonForSedeIdServiceOnly(sedeId: string) {
  const svc = serviceDb()
  if (!svc) {
    return NextResponse.json({ operators: [] })
  }
  return jsonForSedeIdWithClient(svc, sedeId)
}

/**
 * GET /api/sede-operators
 *
 * - `?sedeScope=session`: elenco dalla sede del profilo autenticato — client di sessione (funziona senza service role in locale).
 * - altrimenti: cookie `sede-verified` (kiosk / sede-lock), richiede `SUPABASE_SERVICE_ROLE_KEY`.
 * Returns only { id, full_name } — no email or sensitive data.
 */
export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get('sedeScope') === 'session') {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ sede_id: null, country_code: null, operators: [] })
    }
    const { data: p } = await supabase
      .from('profiles')
      .select('sede_id, role')
      .eq('id', user.id)
      .maybeSingle()
    if (!canListOperatorsSessionScope(p)) {
      return NextResponse.json({ sede_id: null, country_code: null, operators: [] })
    }
    return jsonForSedeIdWithClient(supabase, String(p!.sede_id).trim())
  }

  const sedeId = req.cookies.get('sede-verified')?.value?.trim()
  if (!sedeId) {
    return NextResponse.json({ operators: [] })
  }
  return jsonForSedeIdServiceOnly(sedeId)
}
