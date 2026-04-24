import { type NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function serviceDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createServiceClient(url, key)
}

/**
 * GET /api/sede-operators
 *
 * Returns the list of operatori/admin_sede for the current branch.
 * Reads the `sede-verified` cookie set by the sede-lock screen — no auth required.
 * Returns only { id, full_name } — no email or sensitive data.
 */
export async function GET(req: NextRequest) {
  const sedeId = req.cookies.get('sede-verified')?.value?.trim()

  if (!sedeId) {
    return NextResponse.json({ operators: [] })
  }

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
