import { NextResponse } from 'next/server'
import { createServiceClient, getRequestAuth, getProfile } from '@/utils/supabase/server'
import { isSedePrivilegedRole } from '@/lib/roles'
import { logActivity, ACTIVITY_ACTIONS } from '@/lib/activity-logger'
import { TRIPLE_CHECK_TOLERANCE } from '@/lib/triple-check'

export async function POST() {
  const auth = await getRequestAuth()
  if (!auth.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await getProfile()
  if (!profile || !isSedePrivilegedRole(profile.role)) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
  }

  const service = createServiceClient()

  const { data: rows } = await service
    .from('statement_rows')
    .select('id, importo, delta_importo, fattura_id, bolle_json, check_status, statement_id')
    .eq('check_status', 'errore_importo')
    .not('fattura_id', 'is', null)

  if (!rows?.length) {
    return NextResponse.json({ ok: true, fixed: 0, message: 'Nessuna riga da correggere.' })
  }

  let fixed = 0
  let okCount = 0
  let missingBolleCount = 0

  for (const row of rows) {
    const bolleJson = Array.isArray(row.bolle_json) ? row.bolle_json : []
    const bolleSum = bolleJson.reduce((s: number, b: { importo?: number }) => s + (b.importo ?? 0), 0)
    const bollaeDeltaOk = bolleJson.length === 0 || Math.abs(bolleSum - Number(row.importo)) <= TRIPLE_CHECK_TOLERANCE

    let newStatus: string
    if (bolleJson.length > 0 && !bollaeDeltaOk) {
      newStatus = 'bolle_mancanti'
      missingBolleCount++
    } else {
      newStatus = 'ok'
      okCount++
    }

    const { error: updErr } = await service
      .from('statement_rows')
      .update({ check_status: newStatus })
      .eq('id', row.id)

    if (!updErr) fixed++
  }

  await logActivity(service, {
    userId: auth.user.id,
    sedeId: null,
    action: ACTIVITY_ACTIONS.DOCUMENTO_PROCESSED,
    entityType: 'statement',
    metadata: {
      recheck_false_errors: true,
      fixed,
      set_ok: okCount,
      set_bolle_mancanti: missingBolleCount,
    },
  })

  return NextResponse.json({
    ok: true,
    fixed,
    set_ok: okCount,
    set_bolle_mancanti: missingBolleCount,
    message: `Corrette ${fixed} righe: ${okCount} → ok, ${missingBolleCount} → bolle_mancanti.`,
  })
}
