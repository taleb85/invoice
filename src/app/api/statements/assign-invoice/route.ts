import { NextResponse } from 'next/server'
import { createServiceClient, getProfile, getRequestAuth } from '@/utils/supabase/server'
import { isSedePrivilegedRole } from '@/lib/roles'
import { runTripleCheck } from '@/lib/triple-check'

export async function POST(req: Request) {
  const auth = await getRequestAuth()
  if (!auth.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const profile = await getProfile()
  if (!profile || !isSedePrivilegedRole(profile.role)) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
  }

  const body = await req.json()
  const { row_id, fattura_id } = body

  if (!row_id || !fattura_id) {
    return NextResponse.json({ error: 'row_id e fattura_id obbligatori' }, { status: 400 })
  }

  const service = createServiceClient()

  const { data: row, error: rowErr } = await service
    .from('statement_rows')
    .select('id, numero_doc, importo, data_doc, statement_id, statements(fornitore_id, sede_id)')
    .eq('id', row_id)
    .maybeSingle()

  if (rowErr || !row) {
    return NextResponse.json({ error: rowErr?.message ?? 'Riga non trovata' }, { status: 404 })
  }

  const stmtRaw = row.statements
  const stmt = (Array.isArray(stmtRaw) ? stmtRaw[0] : stmtRaw) as
    | { fornitore_id: string | null; sede_id: string | null }
    | null

  const { data: fattura } = await service
    .from('fatture')
    .select('numero_fattura')
    .eq('id', fattura_id)
    .maybeSingle()

  const { error } = await service
    .from('statement_rows')
    .update({
      fattura_id,
      fattura_numero: fattura?.numero_fattura ?? null,
    })
    .eq('id', row_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { results } = await runTripleCheck(
    service,
    [{
      numero: row.numero_doc ?? '',
      importo: row.importo ?? 0,
      data: row.data_doc ?? null,
    }],
    stmt?.sede_id ?? null,
    stmt?.fornitore_id ?? null,
  )

  const r = results[0]
  if (r) {
    const bolle_json =
      r.bolle.length > 0
        ? r.bolle.map((b) => ({
            id: b.id,
            numero_bolla: b.numero_bolla,
            importo: b.importo,
            data: b.data,
          }))
        : null

    await service
      .from('statement_rows')
      .update({
        check_status: r.status,
        delta_importo: r.deltaImporto,
        fattura_id: r.fattura?.id ?? fattura_id,
        fattura_numero: r.fattura?.numero_fattura ?? fattura?.numero_fattura ?? null,
        fornitore_id: r.fornitore?.id ?? stmt?.fornitore_id ?? null,
        bolle_json,
      })
      .eq('id', row_id)
  }

  return NextResponse.json({
    ok: true,
    check_status: r?.status ?? null,
    message: r?.status === 'ok' ? 'Fattura assegnata e riga verificata' : 'Fattura assegnata — verifica importi in sospeso',
  })
}
