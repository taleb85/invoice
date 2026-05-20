import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, getProfile, getRequestAuth } from '@/utils/supabase/server'
import { isSedePrivilegedRole } from '@/lib/roles'
import { autoRisolviPerFornitoreChunk } from '@/lib/statement-auto-resolve'
import { logActivity, ACTIVITY_ACTIONS } from '@/lib/activity-logger'

/**
 * POST /api/centro-controllo/auto-risolvi-per-fornitore
 *
 * Versione chunked di auto-risolvi-statement: processa un gruppo di fornitori
 * per volta e restituisce aggiornamenti progressivi al client.
 *
 * Body: { sede_id: string; offset?: number; chunk_size?: number }
 */
export async function POST(req: NextRequest) {
  const auth = await getRequestAuth()
  if (!auth.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await getProfile()
  if (!profile || !isSedePrivilegedRole(profile.role)) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({})) as {
    sede_id?: string
    offset?: number
    chunk_size?: number
  }

  const { sede_id, offset = 0, chunk_size = 4 } = body

  if (!sede_id) {
    return NextResponse.json({ error: 'sede_id obbligatorio' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const result = await autoRisolviPerFornitoreChunk(supabase, sede_id, offset, chunk_size)

  if (result.done && offset === 0) {
    await logActivity(supabase, {
      userId: auth.user.id,
      sedeId: sede_id,
      action: ACTIVITY_ACTIONS.DOCUMENTO_PROCESSED,
      entityType: 'statement',
      metadata: { auto_risolvi_chunked: true, ...result },
    })
  }

  return NextResponse.json(result)
}
