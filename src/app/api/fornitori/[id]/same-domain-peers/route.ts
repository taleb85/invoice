import { NextResponse } from 'next/server'
import { createServiceClient, getProfile } from '@/utils/supabase/server'
import { findSameDomainConflictsForFornitore } from '@/lib/fornitore-same-domain'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const profile = await getProfile()
    if (!profile) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

    const { id: fornitoreId } = await context.params
    const service = createServiceClient()
    const conflicts = await findSameDomainConflictsForFornitore(service, fornitoreId)

    return NextResponse.json({ conflicts })
  } catch (err) {
    console.error('[GET same-domain-peers]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Errore recupero fornitori stesso dominio' }, { status: 500 })
  }
}
