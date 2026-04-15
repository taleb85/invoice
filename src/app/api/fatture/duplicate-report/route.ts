import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { fetchDuplicateFattureReport } from '@/lib/duplicate-fatture-report'

export const dynamic = 'force-dynamic'

/**
 * GET — report fatture duplicate (stessa chiave salvataggio app), ambito RLS utente.
 */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  }

  try {
    const { groups, scannedRows, truncated } = await fetchDuplicateFattureReport(supabase)
    return NextResponse.json({ ok: true as const, groups, scannedRows, truncated })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Errore sconosciuto'
    console.error('[duplicate-report]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
