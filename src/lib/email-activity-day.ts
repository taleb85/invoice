import type { SupabaseClient } from '@supabase/supabase-js'
import { utcBoundsForZonedCalendarDay } from '@/lib/zoned-day-bounds'
import { openDocumentUrl } from '@/lib/open-document-url'
import { inferPendingDocumentKindForQueueRow } from '@/lib/document-bozza-routing'
import { normalizeTipoDocumento } from '@/lib/ocr-tipo-documento'
import { extractEmailFromSenderHeader } from '@/lib/sender-email'

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
  /** Mittente email, nome fornitore collegato, o — (non più la ragione sociale OCR come titolo della colonna fornitore). */
  fornitoreNome: string
  /** Testo sul PDF (RS ecc.) quando non coincide col mittente — non è l’anagrafica collegata. */
  docDetectedHint?: string | null
  importo: number | null
  statusKey: 'saved' | 'needs_supplier' | 'ignored'
  href: string | null
  /** Se `fileUrl` valorizzato → anteprima in modale; altrimenti si usa `href` (navigazione / download). */
  docOpen?: EmailActivityOpenTarget
  /** Mittente grezzo (header email) — per blacklist / azioni su code. */
  mittenteRaw?: string | null
  /** Email canonica estratta da `mittenteRaw`, se presente. */
  mittenteEmail?: string | null
  /** Sede della riga coda — per blacklist e creazione fornitore. */
  sedeId?: string | null
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

/** Colonna mittente/fornitore: senza legame DB non dare priorità alla RS OCR (è spesso cliente o terza parte). */
function queueSupplierCell(opts: {
  nomeFornitoreCollegato: string | null
  mittente: string
  ragioneSocialeOcr: string
}): { primary: string; docDetectedHint: string | null } {
  const mitt = opts.mittente.trim()
  const rs = opts.ragioneSocialeOcr.trim()
  const linked = opts.nomeFornitoreCollegato?.trim() || null

  if (linked) {
    return { primary: linked, docDetectedHint: null }
  }

  const looseSame = (a: string, b: string) => {
    if (!a || !b) return false
    const x = a.toLowerCase()
    const y = b.toLowerCase()
    if (x === y) return true
    if (x.includes('@') && y.includes('@')) return x === y
    const short = Math.min(14, x.length, y.length)
    if (short < 4) return false
    return x.slice(0, short) === y.slice(0, short)
  }

  if (mitt) {
    const docDetectedHint = rs && !looseSame(mitt, rs) ? rs : null
    return { primary: mitt, docDetectedHint }
  }

  if (rs) {
    return { primary: '—', docDetectedHint: rs }
  }

  return { primary: '—', docDetectedHint: null }
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
    if (fromTipoDoc === 'comunicazione_cliente') return 'queue'
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

export type LoadEmailActivityClients = {
  /** Client utente (RLS) per fatture/bolle */
  user: SupabaseClient
  /** Service role per documenti (anche con sede_id NULL) */
  service: SupabaseClient
  timeZone: string
  sedeScopeId: string | null
  masterSeesAllSedi: boolean
}

/** Filtro stati documenti in coda mostrati nel log attività (come query storica). */
export const EMAIL_ACTIVITY_QUEUE_STATO_OR =
  'and(fornitore_id.is.null,stato.in.(da_revisionare,da_associare,da_processare,in_attesa)),and(stato.eq.da_revisionare,fornitore_id.not.is.null),stato.eq.scartato'

/** Righe per pagina SSR (payload DOM). */
export const EMAIL_ACTIVITY_QUEUE_PAGE_SIZE = 100

/** Allineato a `reprocess-log-documents`: max ID per richiesta. */
export const EMAIL_ACTIVITY_QUEUE_PROCESS_ID_CAP = 120

/** Evita `?p=999999` e URL assurdi. */
export const EMAIL_ACTIVITY_QUEUE_MAX_PAGE = 500

function queueDayBounds(timeZone: string) {
  const tz = timeZone.trim() || 'UTC'
  return utcBoundsForZonedCalendarDay(tz)
}

function applyQueueSede<Q extends { or: (s: string) => Q }>(q: Q, opts: LoadEmailActivityClients): Q {
  if (!opts.masterSeesAllSedi && opts.sedeScopeId) {
    return q.or(`sede_id.eq.${opts.sedeScopeId},sede_id.is.null`) as Q
  }
  return q
}

function mapDocRowToActivity(d: Record<string, unknown>): EmailActivityRow {
  const sedeId = (d.sede_id as string | null | undefined) ?? null
  const iso = String((d.created_at as string | undefined) ?? '')
  const stato = String((d.stato as string | undefined) ?? '')
  const meta = d.metadata
  const isStatement = !!(d.is_statement as boolean | undefined)
  const nomeForn = joinNome(d.fornitore)
  const rs = metaRagioneSociale(meta)
  const mitt = String((d.mittente as string | null | undefined) ?? '').trim()
  const mittenteEmail = extractEmailFromSenderHeader(mitt)
  const { primary: displayNome, docDetectedHint } = queueSupplierCell({
    nomeFornitoreCollegato: nomeForn,
    mittente: mitt,
    ragioneSocialeOcr: rs,
  })

  const tot =
    meta && typeof meta === 'object' ? (meta as { totale_iva_inclusa?: number | null }).totale_iva_inclusa : null
  const importo = typeof tot === 'number' && Number.isFinite(tot) ? tot : null

  const tipoLabelKey = tipoFromQueueRow({
    isStatement,
    oggettoMail: (d.oggetto_mail as string | null | undefined) ?? null,
    fileName: (d.file_name as string | null | undefined) ?? null,
    metadata: meta,
  })

  const docId = String((d.id as string | undefined) ?? '')
  const fileUrl = (d.file_url as string | null | undefined) ?? null

  if (stato === 'scartato') {
    return {
      atIso: iso,
      tipoLabelKey,
      fornitoreNome: displayNome,
      docDetectedHint,
      importo,
      statusKey: 'ignored',
      href: openDocumentUrl({ documentoId: docId }),
      docOpen: { kind: 'documento', id: docId, fileUrl },
      mittenteRaw: mitt || null,
      mittenteEmail,
      sedeId,
    }
  }

  return {
    atIso: iso,
    tipoLabelKey,
    fornitoreNome: displayNome,
    docDetectedHint,
    importo,
    statusKey: 'needs_supplier',
    href: openDocumentUrl({ documentoId: docId }),
    docOpen: { kind: 'documento', id: docId, fileUrl },
    mittenteRaw: mitt || null,
    mittenteEmail,
    sedeId,
  }
}

/**
 * Conteggio righe coda nel giorno locale (stessi filtri della lista paginata).
 */
export async function countEmailActivityQueueToday(opts: LoadEmailActivityClients): Promise<number> {
  const { start, endExclusive } = queueDayBounds(opts.timeZone)
  let q = opts.service
    .from('documenti_da_processare')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', start)
    .lt('created_at', endExclusive)
    .or(EMAIL_ACTIVITY_QUEUE_STATO_OR)
  q = applyQueueSede(q, opts)

  const { count, error } = await q
  if (error) {
    console.error('[email-activity-day] count coda', error.message)
    return 0
  }
  return count ?? 0
}

export type EmailActivityDayPageResult = {
  rows: EmailActivityRow[]
  queueTotal: number
  page: number
  pageSize: number
  pageCount: number
}

/**
 * Una pagina della coda «Attività email» (solo `documenti_da_processare`), ordinata come prima (più recenti prima).
 */
export async function loadEmailActivityDayRowsPage(
  opts: LoadEmailActivityClients,
  requestedPage: number,
): Promise<EmailActivityDayPageResult> {
  const pageSize = EMAIL_ACTIVITY_QUEUE_PAGE_SIZE
  const queueTotal = await countEmailActivityQueueToday(opts)
  const pageCount = Math.max(1, Math.ceil(queueTotal / pageSize))

  let page = Number.isFinite(requestedPage) && requestedPage >= 1 ? Math.floor(requestedPage) : 1
  page = Math.min(page, EMAIL_ACTIVITY_QUEUE_MAX_PAGE, pageCount)
  page = Math.max(1, page)

  const offset = (page - 1) * pageSize
  const { start, endExclusive } = queueDayBounds(opts.timeZone)

  let q = opts.service
    .from('documenti_da_processare')
    .select(
      'id, created_at, file_url, file_name, stato, metadata, mittente, oggetto_mail, is_statement, sede_id, fornitore:fornitori(nome)',
    )
    .gte('created_at', start)
    .lt('created_at', endExclusive)
    .or(EMAIL_ACTIVITY_QUEUE_STATO_OR)
  q = applyQueueSede(q, opts)
  q = q
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(offset, offset + pageSize - 1)

  const { data: docRows, error: docErr } = await q
  if (docErr) {
    console.error('[email-activity-day] documenti query', docErr.message)
  }

  const rows = (docRows ?? []).map((d) => mapDocRowToActivity(d as Record<string, unknown>))

  return {
    rows,
    queueTotal,
    page,
    pageSize,
    pageCount,
  }
}

/**
 * ID documento più recenti ammissibili alla pipeline (stessi filtri del log), per il POST reprocess (max {@link EMAIL_ACTIVITY_QUEUE_PROCESS_ID_CAP}).
 */
export async function loadEmailActivityQueueProcessDocIdsPeek(opts: LoadEmailActivityClients): Promise<string[]> {
  const { start, endExclusive } = queueDayBounds(opts.timeZone)

  let q = opts.service
    .from('documenti_da_processare')
    .select('id')
    .gte('created_at', start)
    .lt('created_at', endExclusive)
    .or(EMAIL_ACTIVITY_QUEUE_STATO_OR)
  q = applyQueueSede(q, opts)
  q = q
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(EMAIL_ACTIVITY_QUEUE_PROCESS_ID_CAP)

  const { data, error } = await q
  if (error) {
    console.error('[email-activity-day] peek doc ids', error.message)
    return []
  }

  return (data ?? [])
    .map((r) => String((r as { id?: string }).id ?? '').trim())
    .filter(Boolean)
}

/** Fatture + bolle con `email_sync_auto_saved_at` nel giorno locale (stessi filtri sede della pagina log). */
export async function countEmailActivityAutoSavedToday(opts: LoadEmailActivityClients): Promise<number> {
  const { start, endExclusive } = queueDayBounds(opts.timeZone)

  let fattureQ = opts.user
    .from('fatture')
    .select('*', { count: 'exact', head: true })
    .gte('email_sync_auto_saved_at', start)
    .lt('email_sync_auto_saved_at', endExclusive)
    .not('email_sync_auto_saved_at', 'is', null)

  let bolleQ = opts.user
    .from('bolle')
    .select('*', { count: 'exact', head: true })
    .gte('email_sync_auto_saved_at', start)
    .lt('email_sync_auto_saved_at', endExclusive)
    .not('email_sync_auto_saved_at', 'is', null)

  if (!opts.masterSeesAllSedi && opts.sedeScopeId) {
    fattureQ = fattureQ.eq('sede_id', opts.sedeScopeId)
    bolleQ = bolleQ.eq('sede_id', opts.sedeScopeId)
  }

  const [fattureRes, bolleRes] = await Promise.all([fattureQ, bolleQ])

  if (fattureRes.error) {
    console.error('[email-activity-day] count fatture', fattureRes.error.message)
  }
  if (bolleRes.error) {
    console.error('[email-activity-day] count bolle', bolleRes.error.message)
  }

  const cf = fattureRes.error ? 0 : (fattureRes.count ?? 0)
  const cb = bolleRes.error ? 0 : (bolleRes.count ?? 0)
  return cf + cb
}
