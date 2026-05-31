import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, getProfile } from '@/utils/supabase/server'
import { isMasterAdminRole, isSedePrivilegedRole } from '@/lib/roles'
import { normalizeTipoDocumento, type NormalizedTipoDocumento } from '@/lib/ocr-tipo-documento'

export const dynamic = 'force-dynamic'

/**
 * POST { bolla_id, tipo_documento }
 *
 * Aggiorna manualmente `metadata.tipo_documento` sulla riga `documenti_da_processare`
 * collegata a una bolla (cercata prima per `bolla_id`, poi per `file_url`).
 *
 * Le scritture su `documenti_da_processare` sono riservate al service role
 * (vedi policy `documenti_write_service` in 20260421000000_rls_hardening.sql),
 * quindi il client browser non può aggiornare la riga in autonomia: serve questo
 * endpoint per persistire l'override del tipo documento scelto manualmente
 * dall'utente nel tab Bolle del fornitore.
 *
 * Solo admin / admin_sede (come `convert-to-fattura`).
 */
export async function POST(req: NextRequest) {
  const profile = await getProfile()
  if (!profile) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  }

  const role = String(profile.role ?? '').toLowerCase()
  if (role === 'operatore') {
    return NextResponse.json({ error: 'Operatore: non autorizzato' }, { status: 403 })
  }
  if (!isMasterAdminRole(profile.role) && !isSedePrivilegedRole(profile.role)) {
    return NextResponse.json({ error: 'Solo amministratore o responsabile sede' }, { status: 403 })
  }

  let bollaId = ''
  let tipoRaw: NormalizedTipoDocumento = null
  try {
    const body = (await req.json()) as { bolla_id?: string; tipo_documento?: string }
    bollaId = (body.bolla_id ?? '').trim()
    tipoRaw = normalizeTipoDocumento(body.tipo_documento)
  } catch {
    return NextResponse.json({ error: 'Body JSON non valido' }, { status: 400 })
  }
  if (!bollaId) {
    return NextResponse.json({ error: 'bolla_id richiesto' }, { status: 400 })
  }
  if (!tipoRaw) {
    return NextResponse.json({ error: 'tipo_documento non valido' }, { status: 400 })
  }

  const service = createServiceClient()

  const { data: bolla, error: bollaErr } = await service
    .from('bolle')
    .select('id, sede_id, file_url')
    .eq('id', bollaId)
    .maybeSingle()

  if (bollaErr) return NextResponse.json({ error: bollaErr.message }, { status: 500 })
  if (!bolla) return NextResponse.json({ error: 'Bolla non trovata' }, { status: 404 })

  if (isSedePrivilegedRole(profile.role) && bolla.sede_id !== profile.sede_id) {
    return NextResponse.json({ error: 'Sede non consentita' }, { status: 403 })
  }

  // Cerca la riga `documenti_da_processare` collegata: prima per `bolla_id`,
  // poi come fallback per `file_url` (alcune righe storiche non sono collegate).
  const fileUrl = bolla.file_url?.trim() ?? ''

  let docRow: { id: string; metadata: unknown } | null = null

  const byBolla = await service
    .from('documenti_da_processare')
    .select('id, metadata, created_at')
    .eq('bolla_id', bollaId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (byBolla.data) {
    docRow = byBolla.data as { id: string; metadata: unknown }
  } else if (fileUrl) {
    const byFile = await service
      .from('documenti_da_processare')
      .select('id, metadata, created_at')
      .eq('file_url', fileUrl)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (byFile.data) {
      docRow = byFile.data as { id: string; metadata: unknown }
    }
  }

  if (!docRow) {
    return NextResponse.json(
      { error: 'Nessun documento collegato alla bolla', code: 'no_doc' },
      { status: 404 },
    )
  }

  const existing =
    docRow.metadata && typeof docRow.metadata === 'object' && !Array.isArray(docRow.metadata)
      ? (docRow.metadata as Record<string, unknown>)
      : {}

  const { error: updErr } = await service
    .from('documenti_da_processare')
    .update({
      metadata: { ...existing, tipo_documento: tipoRaw, tipo_documento_manual: true },
    })
    .eq('id', docRow.id)

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, documento_id: docRow.id, tipo_documento: tipoRaw })
}
