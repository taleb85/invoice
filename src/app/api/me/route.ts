import { NextResponse } from 'next/server'
import { getAppMeShellResult } from '@/lib/me-server'

export async function GET() {
  const r = await getAppMeShellResult()
  if (!r.ok) {
    if (r.kind === 'unauth') return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }
  const me = r.me
  return NextResponse.json(
    {
      user: me.user,
      full_name: me.full_name,
      role: me.role,
      sede_id: me.sede_id,
      sede_nome: me.sede_nome,
      country_code: me.country_code,
      currency: me.currency,
      timezone: me.timezone,
      is_admin: me.is_admin,
      is_admin_sede: me.is_admin_sede,
      all_sedi: me.all_sedi,
    },
    { headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' } },
  )
}
