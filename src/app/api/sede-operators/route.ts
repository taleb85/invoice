import { type NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/utils/supabase/server'

function serviceDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createServiceClient(url, key)
}

async function jsonForSedeId(sedeId: string) {
  const svc = serviceDb()
  if (!svc) {
    return NextResponse.json({ operators: [] })
  }
  const [profilesRes, sedeRes] = await Promise.all([
    svc
      .from('profiles')
      .select('id, full_name, role')
      .eq('sede_id', sedeId)
      .in('role', ['operatore', 'admin_sede'])
      .order('full_name'),
    svc
      .from('sedi')
      .select('country_code')
      .eq('id', sedeId)
      .maybeSingle(),
  ])

  if (profilesRes.error) {
    return NextResponse.json({ operators: [] })
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

/**
 * GET /api/sede-operators
 *
 * - `?sedeScope=session`: elenco dalla sede del profilo autenticato (operatore / admin_sede) — usato su `/accesso` PWA.
 * - altrimenti: cookie `sede-verified` (kiosk / sede-lock).
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
    const r = String(p?.role ?? '').toLowerCase()
    if (!p?.sede_id || (r !== 'operatore' && r !== 'admin_sede')) {
      return NextResponse.json({ sede_id: null, country_code: null, operators: [] })
    }
    return jsonForSedeId(p.sede_id)
  }

  const sedeId = req.cookies.get('sede-verified')?.value?.trim()
  if (!sedeId) {
    return NextResponse.json({ operators: [] })
  }
  return jsonForSedeId(sedeId)
}
