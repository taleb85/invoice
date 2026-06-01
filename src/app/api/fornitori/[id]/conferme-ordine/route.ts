import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, getProfile } from '@/utils/supabase/server'
import { fetchFilteredConfermeOrdine } from '@/lib/conferme-ordine-query'
import { isBranchSedeStaffRole, isMasterAdminRole } from '@/lib/roles'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const profile = await getProfile()
    if (!profile) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

    const { id: fornitoreId } = await params
    if (!fornitoreId) {
      return NextResponse.json({ error: 'fornitore_id richiesto' }, { status: 400 })
    }

    const from = req.nextUrl.searchParams.get('from') ?? undefined
    const to = req.nextUrl.searchParams.get('to') ?? undefined

    const service = createServiceClient()

    const { data: fornitoreRow } = await service
      .from('fornitori')
      .select('sede_id')
      .eq('id', fornitoreId)
      .maybeSingle()

    if (!fornitoreRow) {
      return NextResponse.json({ error: 'Fornitore non trovato' }, { status: 404 })
    }

    if (
      isBranchSedeStaffRole(profile.role) &&
      profile.sede_id &&
      fornitoreRow.sede_id &&
      fornitoreRow.sede_id !== profile.sede_id
    ) {
      return NextResponse.json({ error: 'Fornitore non accessibile' }, { status: 403 })
    }

    if (!isMasterAdminRole(profile.role) && !fornitoreRow.sede_id) {
      return NextResponse.json({ error: 'Fornitore senza sede' }, { status: 403 })
    }

    const { rows } = await fetchFilteredConfermeOrdine(service, {
      fornitoreId,
      from,
      toExclusive: to,
    })

    return NextResponse.json(rows)
  } catch (err) {
    console.error('[GET /api/fornitori/conferme-ordine]', err instanceof Error ? err.message : err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Errore caricamento conferme' },
      { status: 500 },
    )
  }
}
