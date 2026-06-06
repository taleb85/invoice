import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, getRequestAuth } from '@/utils/supabase/server'
import {
  backfillFornitoreAnagraficaFromDocuments,
  backfillFornitoreContattiFromDocuments,
} from '@/lib/fornitore-merge-from-doc-metadata'

export async function POST(
  _req: NextRequest,
  segmentCtx: { params: Promise<{ id: string }> },
) {
  const { id: fornitoreId } = await segmentCtx.params
  const { user } = await getRequestAuth()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const { data: profile } = await service.from('profiles').select('role, sede_id').eq('id', user.id).single()
  const { data: fornitore } = await service
    .from('fornitori')
    .select('id, sede_id')
    .eq('id', fornitoreId)
    .maybeSingle()

  if (!fornitore) return NextResponse.json({ error: 'Fornitore non trovato' }, { status: 404 })

  const isAdmin = profile?.role === 'admin'
  if (!isAdmin && profile?.sede_id && fornitore.sede_id && profile.sede_id !== fornitore.sede_id) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
  }

  const [anagrafica, contatti] = await Promise.all([
    backfillFornitoreAnagraficaFromDocuments(service, fornitoreId),
    backfillFornitoreContattiFromDocuments(service, fornitoreId),
  ])

  return NextResponse.json({ ok: true, anagrafica, contatti })
}
