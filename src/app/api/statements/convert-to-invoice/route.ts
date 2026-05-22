import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, getProfile } from '@/utils/supabase/server'
import { isMasterAdminRole, isSedePrivilegedRole } from '@/lib/roles'
import { logActivity } from '@/lib/activity-logger'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const profile = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const master = isMasterAdminRole(profile.role)
  const privileged = isSedePrivilegedRole(profile.role)
  if (!master && !privileged) {
    return NextResponse.json({ error: 'Accesso negato' }, { status: 403 })
  }

  let body: { statement_id?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON non valido' }, { status: 400 })
  }

  const statementId = body.statement_id?.trim()
  if (!statementId) return NextResponse.json({ error: 'statement_id richiesto' }, { status: 400 })

  const service = createServiceClient()

  const { data: stmt, error: stmtErr } = await service
    .from('statements')
    .select('id, fornitore_id, sede_id, file_url, document_date, email_subject')
    .eq('id', statementId)
    .maybeSingle()

  if (stmtErr || !stmt) return NextResponse.json({ error: 'Statement non trovato' }, { status: 404 })
  if (!stmt.file_url) return NextResponse.json({ error: 'Lo statement non ha un file allegato' }, { status: 400 })
  if (!stmt.fornitore_id) return NextResponse.json({ error: 'Lo statement non ha un fornitore associato' }, { status: 400 })

  if (!master && profile.sede_id) {
    const stmtSede = stmt.sede_id as string | null
    if (stmtSede && stmtSede !== profile.sede_id) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
    }
  }

  const oggi = new Date().toISOString().split('T')[0]
  const dataDoc = (stmt.document_date as string | null)?.trim() || oggi

  const { data: fattura, error: insErr } = await service
    .from('fatture')
    .insert([{
      fornitore_id: stmt.fornitore_id,
      sede_id: stmt.sede_id as string | null,
      data: dataDoc,
      file_url: stmt.file_url,
      importo: null,
      verificata_estratto_conto: false,
    }])
    .select('id')
    .single()

  if (insErr) {
    return NextResponse.json({ error: `Errore creazione fattura: ${insErr.message}` }, { status: 500 })
  }

  await service.from('statement_rows').delete().eq('statement_id', statementId)
  await service.from('statements').delete().eq('id', statementId)

  await logActivity(service, {
    userId: profile.id,
    sedeId: stmt.sede_id as string | null,
    action: 'fattura.created',
    entityType: 'fattura',
    entityId: fattura.id,
    entityLabel: `Da statement: ${stmt.email_subject ?? statementId}`,
    metadata: { from_statement: statementId, fornitore_id: stmt.fornitore_id },
  })

  return NextResponse.json({ ok: true, fattura_id: fattura.id })
}
