import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, getProfile, getRequestAuth } from '@/utils/supabase/server'
import { isBranchSedeStaffRole, isMasterAdminRole } from '@/lib/roles'
import { deleteConfermaOrdineRow } from '@/lib/conferme-ordine-delete'

export async function POST(req: NextRequest) {
  const { user } = await getRequestAuth()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const profile = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Profilo non trovato' }, { status: 401 })

  const master = isMasterAdminRole(profile.role)
  const staff = isBranchSedeStaffRole(profile.role)
  if (!master && !staff) {
    return NextResponse.json({ error: 'Accesso negato' }, { status: 403 })
  }

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id richiesto' }, { status: 400 })

  const service = createServiceClient()

  const { data: row } = await service
    .from('conferme_ordine')
    .select('id, fornitore_id, file_url')
    .eq('id', id)
    .maybeSingle()

  if (!row) return NextResponse.json({ error: 'Ordine non trovato' }, { status: 404 })

  // Check access: staff can only delete orders in their sede
  if (!master && staff && row.fornitore_id) {
    const { data: f } = await service
      .from('fornitori')
      .select('sede_id')
      .eq('id', row.fornitore_id)
      .maybeSingle()
    if (f?.sede_id !== profile.sede_id) {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 })
    }
  }

  const { error } = await deleteConfermaOrdineRow(service, {
    id: row.id,
    fileUrl: row.file_url,
    otherFileUrlsStillInUse: new Set(),
  })

  if (error) return NextResponse.json({ error }, { status: 500 })

  return NextResponse.json({ ok: true })
}
