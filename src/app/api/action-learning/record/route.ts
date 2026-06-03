import { NextRequest, NextResponse } from 'next/server'
import { assertItemSedeAccess } from '@/lib/action-learning/context'
import { rpcUpsertActionLearning } from '@/lib/action-learning/server-rpc'
import type { CommandId, CodaItem } from '@/lib/command-system/types'
import { isMasterAdminRole } from '@/lib/roles'
import { createServiceClient, getProfile } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const profile = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as {
    item?: CodaItem
    azioneId?: CommandId
    eraSuggerimento?: boolean
    seguitoConsiglio?: boolean
  }

  const { item, azioneId, eraSuggerimento = false, seguitoConsiglio = true } = body
  if (!item?.id || !azioneId) {
    return NextResponse.json({ error: 'item e azioneId richiesti' }, { status: 400 })
  }

  if (!assertItemSedeAccess(profile.sede_id, isMasterAdminRole(profile.role), item)) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
  }

  const service = createServiceClient()
  const { ok, error } = await rpcUpsertActionLearning(
    service,
    item,
    azioneId,
    eraSuggerimento,
    seguitoConsiglio,
  )

  if (!ok) {
    console.error('[ActionLearning] upsert_action_learning:', error)
    return NextResponse.json({ ok: false, error: error ?? 'Errore' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
