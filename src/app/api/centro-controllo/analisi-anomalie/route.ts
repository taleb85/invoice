import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, getProfile, getRequestAuth } from '@/utils/supabase/server'
import { isSedePrivilegedRole } from '@/lib/roles'
import { analyzeAnomaliePerFornitore } from '@/lib/statement-auto-resolve'

/**
 * POST /api/centro-controllo/analisi-anomalie
 *
 * Fase 1 della pipeline AI: analisi read-only delle anomalie per fornitore.
 * Non modifica nessun dato — restituisce solo il breakdown per tipo.
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

  const { sede_id, offset = 0, chunk_size = 6 } = body
  if (!sede_id) return NextResponse.json({ error: 'sede_id obbligatorio' }, { status: 400 })

  const supabase = createServiceClient()
  const result = await analyzeAnomaliePerFornitore(supabase, sede_id, offset, chunk_size)
  return NextResponse.json(result)
}
