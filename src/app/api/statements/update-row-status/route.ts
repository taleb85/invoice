import { NextResponse } from 'next/server'
import { createServiceClient, getRequestAuth } from '@/utils/supabase/server'

const VALID_STATUSES = new Set(['ok', 'pending', 'fattura_mancante', 'bolle_mancanti', 'errore_importo', 'rekki_prezzo_discordanza'])

export async function POST(req: Request) {
  const auth = await getRequestAuth()
  if (!auth.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { rowId, status } = body

  if (!rowId || !status) {
    return NextResponse.json({ error: 'rowId e status obbligatori' }, { status: 400 })
  }

  if (!VALID_STATUSES.has(status)) {
    return NextResponse.json({ error: `Status non valido: ${status}` }, { status: 400 })
  }

  const service = createServiceClient()

  const { error } = await service
    .from('statement_rows')
    .update({ check_status: status })
    .eq('id', rowId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, message: 'Riga aggiornata' })
}
