import type { SupabaseClient } from '@supabase/supabase-js'
import { utcBoundsForZonedCalendarDay } from '@/lib/zoned-day-bounds'
import { openDocumentUrl } from '@/lib/open-document-url'
import { inferPendingDocumentKindForQueueRow } from '@/lib/document-bozza-routing'
import { normalizeTipoDocumento } from '@/lib/ocr-tipo-documento'

export type EmailActivityTipoKey = 'invoice' | 'ddt' | 'statement' | 'queue' | 'ordine' | 'resume'

/** Metadati per `OpenDocumentInAppButton` (modale) sul log attività. */
export type EmailActivityOpenTarget =
  | { kind: 'fattura'; id: string; fileUrl: string | null | undefined }
  | { kind: 'bolla'; id: string; fileUrl: string | null | undefined }
  | { kind: 'documento'; id: string; fileUrl: string | null | undefined }

export type EmailActivityRow = {
  /** ISO per ordinamento */
  atIso: string
  tipoLabelKey: EmailActivityTipoKey
  fornitoreNome: string
  importo: number | null
  statusKey: 'saved' | 'needs_supplier' | 'ignored'
  href: string | null
  /** Se `fileUrl` valorizzato → anteprima in modale; altrimenti si usa `href` (navigazione / download). */
  docOpen?: EmailActivityOpenTarget
}

function joinNome(fornitore: unknown): string | null {
  if (Array.isArray(fornitore)) {
    const n = (fornitore[0] as { nome?: string } | undefined)?.nome
    return typeof n === 'string' && n.trim() ? n.trim() : null
  }
  if (fornitore && typeof fornitore === 'object') {
    const n = (fornitore as { nome?: string }).nome
    return typeof n === 'string' && n.trim() ? n.trim() : null
  }
  return null
}

function metaRagioneSociale(metadata: unknown): string {
  if (!metadata || typeof metadata !== 'object') return ''
  const r = (metadata as { ragione_sociale?: string | null }).ragione_sociale
  return typeof r === 'string' && r.trim() ? r.trim() : ''
}

/**
 * Etichetta “Tipo” nel log attività: non usare solo `pending_kind`
 * (può essere suggerimento di routing errato mentre OCR ha già letto dal PDF il tipo reale).
 */
function tipoFromQueueRow(opts: {
  isStatement: boolean
  oggettoMail: string | null | undefined
  fileName: string | null | undefined
  metadata: unknown
}): EmailActivityTipoKey {
  const { isStatement, oggettoMail, fileName, metadata } = opts
  if (isStatement) return 'statement'

  const m =
    metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? (metadata as {
          pending_kind?: string | null
          tipo_documento?: unknown
          ocr_tipo?: unknown
          rejected_reason?: string | null
        })
      : null

  if (m?.rejected_reason === 'curriculum' || normalizeTipoDocumento(m?.tipo_documento) === 'curriculum') {
    return 'resume'
  }

  if (m) {
    const fromTipoDoc = normalizeTipoDocumento(m.tipo_documento)
    if (fromTipoDoc === 'fattura') return 'invoice'
    if (fromTipoDoc === 'bolla') return 'ddt'

    const fromOcrTipo = normalizeTipoDocumento(m.ocr_tipo)
    if (fromOcrTipo === 'fattura') return 'invoice'
    if (fromOcrTipo === 'bolla') return 'ddt'

    const inferred = inferPendingDocumentKindForQueueRow({
      oggetto_mail: oggettoMail ?? null,
      file_name: fileName ?? null,
      metadata: m as {
        ragione_sociale?: string | null
        note_corpo_mail?: string | null
        tipo_documento?: unknown
        numero_fattura?: string | null
        totale_iva_inclusa?: number | null
      },
    })
    if (inferred === 'statement') return 'statement'
    if (inferred === 'fattura') return 'invoice'
    if (inferred === 'bolla') return 'ddt'
    if (inferred === 'ordine') return 'ordine'

    const pk = m.pending_kind
    if (pk === 'statement') return 'statement'
    if (pk === 'bolla') return 'ddt'
    if (pk === 'fattura') return 'invoice'
    if (pk === 'ordine') return 'ordine'
  }

  return 'queue'
}

function sedeVisibleForRow(
  sedeId: string | null,
  scopeId: string | null,
  masterSeesAllSedi: boolean,
): boolean {
  if (masterSeesAllSedi) return true
  if (!scopeId) return true
  if (sedeId === null) return true
  return sedeId === scopeId
}

export type LoadEmailActivityClients = {
  /** Client utente (RLS) per fatture/bolle */
  user: SupabaseClient
  /** Service role per documenti (anche con sede_id NULL) */
  service: SupabaseClient
  timeZone: string
  sedeScopeId: string | null
  masterSeesAllSedi: boolean
}

/**
 * Vista “Attività email”: auto-save oggi (fattura/bolla) + voci coda rilevanti
 * (fornitore da aggiungere, ignorato) senza messaggi tecnici.
 */
export async function loadEmailActivityDayRows(opts: LoadEmailActivityClients): Promise<EmailActivityRow[]> {
  const tz = opts.timeZone.trim() || 'UTC'
  const { start, endExclusive } = utcBoundsForZonedCalendarDay(tz)
  const rows: EmailActivityRow[] = []

  let fattureQ = opts.user
    .from('fatture')
    .select('id, importo, file_url, email_sync_auto_saved_at, fornitore:fornitori(nome)')
    .gte('email_sync_auto_saved_at', start)
    .lt('email_sync_auto_saved_at', endExclusive)
    .not('email_sync_auto_saved_at', 'is', null)

  let bolleQ = opts.user
    .from('bolle')
    .select('id, importo, file_url, email_sync_auto_saved_at, fornitore:fornitori(nome)')
    .gte('email_sync_auto_saved_at', start)
    .lt('email_sync_auto_saved_at', endExclusive)
    .not('email_sync_auto_saved_at', 'is', null)

  if (!opts.masterSeesAllSedi && opts.sedeScopeId) {
    fattureQ = fattureQ.eq('sede_id', opts.sedeScopeId)
    bolleQ = bolleQ.eq('sede_id', opts.sedeScopeId)
  }

  const [fattureRes, bolleRes] = await Promise.all([fattureQ, bolleQ])

  for (const f of fattureRes.data ?? []) {
    const id = String((f as { id?: string }).id ?? '')
    const iso = String((f as { email_sync_auto_saved_at?: string }).email_sync_auto_saved_at ?? '')
    const fileUrl = (f as { file_url?: string | null }).file_url ?? null
    rows.push({
      atIso: iso,
      tipoLabelKey: 'invoice',
      fornitoreNome: joinNome((f as { fornitore?: unknown }).fornitore) ?? '—',
      importo: (f as { importo?: number | null }).importo ?? null,
      statusKey: 'saved',
      href: openDocumentUrl({ fatturaId: id }),
      docOpen: { kind: 'fattura', id, fileUrl },
    })
  }

  for (const b of bolleRes.data ?? []) {
    const id = String((b as { id?: string }).id ?? '')
    const iso = String((b as { email_sync_auto_saved_at?: string }).email_sync_auto_saved_at ?? '')
    const fileUrl = (b as { file_url?: string | null }).file_url ?? null
    rows.push({
      atIso: iso,
      tipoLabelKey: 'ddt',
      fornitoreNome: joinNome((b as { fornitore?: unknown }).fornitore) ?? '—',
      importo: (b as { importo?: number | null }).importo ?? null,
      statusKey: 'saved',
      href: openDocumentUrl({ bollaId: id }),
      docOpen: { kind: 'bolla', id, fileUrl },
    })
  }

  const docQ = opts.service
    .from('documenti_da_processare')
    .select(
      'id, created_at, file_url, file_name, stato, metadata, mittente, oggetto_mail, is_statement, sede_id, fornitore:fornitori(nome)',
    )
    .gte('created_at', start)
    .lt('created_at', endExclusive)
    .or(
      'and(fornitore_id.is.null,stato.in.(da_revisionare,da_associare,da_processare,in_attesa)),and(stato.eq.da_revisionare,fornitore_id.not.is.null),stato.eq.scartato',
    )

  const { data: docRows, error: docErr } = await docQ
  if (docErr) {
    console.error('[email-activity-day] documenti query', docErr.message)
  }

  for (const d of docRows ?? []) {
    const sedeId = (d as { sede_id?: string | null }).sede_id ?? null
    if (!sedeVisibleForRow(sedeId, opts.sedeScopeId, opts.masterSeesAllSedi)) continue

    const iso = String((d as { created_at?: string }).created_at ?? '')
    const stato = String((d as { stato?: string }).stato ?? '')
    const meta = (d as { metadata?: unknown }).metadata
    const isStatement = !!(d as { is_statement?: boolean }).is_statement
    const nomeForn = joinNome((d as { fornitore?: unknown }).fornitore)
    const nome = nomeForn ?? metaRagioneSociale(meta)
    const mitt = String((d as { mittente?: string | null }).mittente ?? '').trim()
    const displayNome = nome || mitt || '—'

    const tot =
      meta && typeof meta === 'object'
        ? (meta as { totale_iva_inclusa?: number | null }).totale_iva_inclusa
        : null
    const importo = typeof tot === 'number' && Number.isFinite(tot) ? tot : null

    const tipoLabelKey = tipoFromQueueRow({
      isStatement,
      oggettoMail: (d as { oggetto_mail?: string | null }).oggetto_mail ?? null,
      fileName: (d as { file_name?: string | null }).file_name ?? null,
      metadata: meta,
    })

    const docId = String((d as { id?: string }).id ?? '')
    const fileUrl = (d as { file_url?: string | null }).file_url ?? null

    if (stato === 'scartato') {
      rows.push({
        atIso: iso,
        tipoLabelKey,
        fornitoreNome: displayNome,
        importo,
        statusKey: 'ignored',
        href: openDocumentUrl({ documentoId: docId }),
        docOpen: { kind: 'documento', id: docId, fileUrl },
      })
      continue
    }

    rows.push({
      atIso: iso,
      tipoLabelKey,
      fornitoreNome: displayNome,
      importo,
      statusKey: 'needs_supplier',
      href: openDocumentUrl({ documentoId: docId }),
      docOpen: { kind: 'documento', id: docId, fileUrl },
    })
  }

  rows.sort((a, b) => (a.atIso < b.atIso ? 1 : a.atIso > b.atIso ? -1 : 0))
  return rows
}

export function countAutoSavedTodayFromRows(rows: EmailActivityRow[]): number {
  return rows.filter((r) => r.statusKey === 'saved').length
}
