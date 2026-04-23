import { NextResponse } from 'next/server'
import { createServiceClient, getProfile } from '@/utils/supabase/server'
import { isMasterAdminRole, isAdminSedeRole } from '@/lib/roles'
import { detectAllDuplicates } from '@/lib/duplicate-detector'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

export async function GET() {
  const profile = await getProfile()
  const isMaster = isMasterAdminRole(profile?.role)
  const isAdminSede = isAdminSedeRole(profile?.role)

  if (!isMaster && !isAdminSede) {
    return NextResponse.json({ error: 'Accesso negato' }, { status: 403 })
  }

  let sedeId = profile?.sede_id ?? null

  // Admin master: check if a sede is selected via cookie
  if (isMaster && !sedeId) {
    const cookieStore = await cookies()
    const adminPick = cookieStore.get('admin-sede-id')?.value?.trim() || null
    if (adminPick) sedeId = adminPick
  }

  if (!sedeId) {
    return NextResponse.json({ error: 'Sede non selezionata' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const report = await detectAllDuplicates(sedeId, supabase)

  return NextResponse.json({ ok: true, report })
}
