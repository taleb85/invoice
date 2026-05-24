/**
 * POST /api/statements/register-also-as-invoice
 *
 * Caso d'uso: il PDF contiene SIA un estratto conto SIA una fattura
 * (riepilogo + dettaglio). L'utente vuole tenere ATTIVO lo statement
 * (per la riconciliazione) ma anche registrare la fattura nel ledger.
 *
 * Differenze rispetto a /api/statements/convert-to-invoice:
 *  - NON elimina lo statement né i suoi rows
 *  - Salva il fattura.id su statements.linked_fattura_id
 *  - autoConvertInvoiceStatements salta gli statement con linked_fattura_id
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, getProfile } from '@/utils/supabase/server'
import { isMasterAdminRole, isSedePrivilegedRole } from '@/lib/roles'
import { logActivity } from '@/lib/activity-logger'

export const dynamic = 'force-dynamic'

type RequestBody = {
  statement_id?: string
  importo?: number | string | null
  numero_fattura?: string | null
}

export async function POST(req: NextRequest) {
  const profile = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const master = isMasterAdminRole(profile.role)
  const privileged = isSedePrivilegedRole(profile.role)
  if (!master && !privileged) {
    return NextResponse.json({ error: 'Accesso negato' }, { status: 403 })
  }

  let body: RequestBody
  try {
    body = (await req.json()) as RequestBody
  } catch {
    return NextResponse.json({ error: 'JSON non valido' }, { status: 400 })
  }

  const statementId = body.statement_id?.trim()
  if (!statementId) return NextResponse.json({ error: 'statement_id richiesto' }, { status: 400 })

  const importoRaw = body.importo
  let importo: number | null = null
  if (importoRaw !== null && importoRaw !== undefined && importoRaw !== '') {
    const n = typeof importoRaw === 'string' ? Number(importoRaw.replace(',', '.')) : Number(importoRaw)
    if (!Number.isFinite(n)) {
      return NextResponse.json({ error: 'Importo non valido' }, { status: 400 })
    }
    importo = n
  }

  const numeroFattura = body.numero_fattura?.trim() || null

  const service = createServiceClient()

  type StmtRow = {
    id: string
    fornitore_id: string | null
    sede_id: string | null
    file_url: string | null
    document_date: string | null
    email_subject: string | null
    linked_fattura_id: string | null
  }

  const r1 = await service
    .from('statements')
    .select('id, fornitore_id, sede_id, file_url, document_date, email_subject, linked_fattura_id')
    .eq('id', statementId)
    .maybeSingle()
  if (r1.error && r1.error.code === '42703') {
    // Colonna linked_fattura_id non presente (migration mancante):
    // blocca con errore esplicito invece di creare la fattura senza link.
    return NextResponse.json({
      error: 'Migration mancante: applica supabase/migrations/20260523000000_statements_linked_fattura.sql',
    }, { status: 500 })
  }
  if (r1.error) return NextResponse.json({ error: r1.error.message }, { status: 500 })
  const stmt: StmtRow | null = r1.data as unknown as StmtRow | null

  if (!stmt) return NextResponse.json({ error: 'Statement non trovato' }, { status: 404 })
  if (!stmt.file_url) return NextResponse.json({ error: 'Lo statement non ha un file allegato' }, { status: 400 })
  if (!stmt.fornitore_id) return NextResponse.json({ error: 'Lo statement non ha un fornitore associato' }, { status: 400 })

  if (!master && profile.sede_id) {
    const stmtSede = stmt.sede_id as string | null
    if (stmtSede && stmtSede !== profile.sede_id) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
    }
  }

  if (stmt.linked_fattura_id) {
    return NextResponse.json(
      { error: 'Una fattura è già stata creata da questo estratto conto', fattura_id: stmt.linked_fattura_id },
      { status: 409 },
    )
  }

  const oggi = new Date().toISOString().split('T')[0]
  const dataDoc = (stmt.document_date as string | null)?.trim() || oggi

  const fatturaPayload: Record<string, unknown> = {
    fornitore_id: stmt.fornitore_id,
    sede_id: stmt.sede_id as string | null,
    data: dataDoc,
    file_url: stmt.file_url,
    importo,
    verificata_estratto_conto: false,
  }
  if (numeroFattura) fatturaPayload.numero_fattura = numeroFattura

  const { data: fattura, error: insErr } = await service
    .from('fatture')
    .insert([fatturaPayload])
    .select('id')
    .single()

  if (insErr) {
    return NextResponse.json({ error: `Errore creazione fattura: ${insErr.message}` }, { status: 500 })
  }

  const { error: linkErr } = await service
    .from('statements')
    .update({ linked_fattura_id: fattura.id })
    .eq('id', statementId)

  if (linkErr) {
    return NextResponse.json(
      { error: `Fattura creata ma collegamento fallito: ${linkErr.message}`, fattura_id: fattura.id },
      { status: 500 },
    )
  }

  await logActivity(service, {
    userId: profile.id,
    sedeId: stmt.sede_id as string | null,
    action: 'fattura.created',
    entityType: 'fattura',
    entityId: fattura.id,
    entityLabel: `Da statement (combinato): ${stmt.email_subject ?? statementId}`,
    metadata: { from_statement: statementId, fornitore_id: stmt.fornitore_id, keep_statement: true },
  })

  return NextResponse.json({ ok: true, fattura_id: fattura.id })
}
