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
  const message =
    risolte > 0
      ? `Auto-risolte ${risolte} righe (${result.righeOk} da triple-check, ${result.falseErrorsOk} correzioni importo). Restano ${result.righeAncoraAnomale} anomalie reali da verificare.`
      : result.righeRivalutate > 0
        ? `Rivalutate ${result.righeRivalutate} righe: ${result.righeAncoraAnomale} anomalie reali (importi discordanti o fatture mancanti).`
        : 'Nessuna riga estratto conto da auto-risolvere.'

  return NextResponse.json({ ok: true, ...result, risolte, message })
}
