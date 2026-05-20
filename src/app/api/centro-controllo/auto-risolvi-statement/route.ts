import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, getProfile, getRequestAuth } from '@/utils/supabase/server'
import { isSedePrivilegedRole } from '@/lib/roles'
import { autoRisolviStatementRows } from '@/lib/statement-auto-resolve'
import { logActivity, ACTIVITY_ACTIONS } from '@/lib/activity-logger'

/**
 * POST /api/centro-controllo/auto-risolvi-statement
 *
 * Rivaluta in bulk le righe estratto conto (triple-check + correzione falsi errori).
 * Le righe risolte escono automaticamente dalla coda — nessuna conferma manuale.
 */
export async function POST(req: NextRequest) {
  const auth = await getRequestAuth()
  if (!auth.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await getProfile()
  if (!profile || !isSedePrivilegedRole(profile.role)) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({})) as { sede_id?: string }
  const { sede_id } = body

  if (!sede_id) {
    return NextResponse.json({ error: 'sede_id obbligatorio' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const result = await autoRisolviStatementRows(supabase, sede_id)

  await logActivity(supabase, {
    userId: auth.user.id,
    sedeId: sede_id,
    action: ACTIVITY_ACTIONS.DOCUMENTO_PROCESSED,
    entityType: 'statement',
    metadata: { auto_risolvi: true, ...result },
  })

  const risolte = result.righeOk + result.falseErrorsOk
  let message: string

  if (risolte > 0) {
    const parts: string[] = []
    if (result.fastFixed > 0) parts.push(`${result.fastFixed} falsi allarmi chiusi`)
    const slowFixed = risolte - result.fastFixed
    if (slowFixed > 0) parts.push(`${slowFixed} righe riprocessate`)
    message = `✓ ${parts.join(', ')}. Restano ${result.righeAncoraAnomale} anomalie che richiedono intervento manuale (fatture non ancora caricate o importi discordanti).`
  } else if (result.righeAncoraAnomale > 0) {
    message = `Nessuna anomalia risolvibile automaticamente. Le ${result.righeAncoraAnomale} righe rimaste sono fatture non ancora presenti in archivio — caricale e poi usa "Ricalcola tutto il triple-check".`
  } else {
    message = 'Nessuna anomalia negli estratti conto.'
  }

  return NextResponse.json({ ok: true, ...result, risolte, message })
}
