import { NextRequest, NextResponse } from 'next/server'
import { requireReassignAuth, reassignEntityFornitore } from '@/lib/reassign-entity-fornitore'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const { profile, sedeId, error: authErr } = await requireReassignAuth()
  if (authErr) return NextResponse.json(authErr, { status: authErr.status })
  if (!sedeId) return NextResponse.json({ error: 'sede non selezionata' }, { status: 400 })

  let body: { sede_id?: string; bolla_id?: string; nuovo_fornitore_id?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON non valido' }, { status: 400 })
  }

  const bollaId = body.bolla_id?.trim()
  const nuovoFornitoreId = body.nuovo_fornitore_id?.trim()

  if (!bollaId || !nuovoFornitoreId) {
    return NextResponse.json({ error: 'bolla_id e nuovo_fornitore_id richiesti' }, { status: 400 })
  }

  const result = await reassignEntityFornitore('bolle', {
    entityId: bollaId,
    nuovoFornitoreId,
    sedeId,
    userId: profile.id,
  })

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: result.status ?? 500 })
  }

  return NextResponse.json({ ok: true as const })
}
