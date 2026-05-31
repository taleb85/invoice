import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, getProfile } from '@/utils/supabase/server'
import { isMasterAdminRole, isSedePrivilegedRole } from '@/lib/roles'
import { mergeFornitori } from '@/lib/merge-fornitori'

export async function POST(req: NextRequest) {
  try {
    const profile = await getProfile()
    if (!profile) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

    const privileged = isMasterAdminRole(profile.role) || isSedePrivilegedRole(profile.role)
    if (!privileged) {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 })
    }

    const body = (await req.json()) as { target_id?: string; source_id?: string }
    const targetId = body.target_id?.trim()
    const sourceId = body.source_id?.trim()
    if (!targetId || !sourceId) {
      return NextResponse.json({ error: 'target_id e source_id richiesti' }, { status: 400 })
    }

    const service = createServiceClient()
    const { data: targetRow } = await service.from('fornitori').select('sede_id').eq('id', targetId).maybeSingle()
    if (!targetRow) return NextResponse.json({ error: 'Fornitore destinazione non trovato' }, { status: 404 })

    if (!isMasterAdminRole(profile.role) && profile.sede_id && targetRow.sede_id !== profile.sede_id) {
      return NextResponse.json({ error: 'Non autorizzato per questa sede' }, { status: 403 })
    }

    const result = await mergeFornitori(service, {
      targetId,
      sourceId,
      userId: profile.id,
    })

    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Errore unione fornitori'
    console.error('[POST /api/fornitori/merge]', message)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
