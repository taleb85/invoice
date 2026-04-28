import { NextResponse } from 'next/server'
import { classifyImapError, type ClassifiedImapError } from '@/lib/imap-error-classifier'
import { recordImapFailure, recordImapSuccess } from '@/lib/imap-health'
import { fetchUnseenEmails, ScannedEmail, type FetchUnseenImapHooks } from '@/lib/mail-scanner'
import { createServiceClient } from '@/utils/supabase/server'
import { SupabaseClient } from '@supabase/supabase-js'
import { simpleParser } from 'mailparser'
import { withImapSession } from '@/lib/imap-session'
import {
  ocrInvoice,
  ocrInvoiceFromEmailBody,
  ocrBodyOnlyWorthInserting,
  ocrExtractedNothingUseful,
  OcrResult,
  EMPTY_OCR,
  OcrInvoiceConfigurationError,
  OcrTransientError,
} from '@/lib/ocr-invoice'
import { MIN_EMAIL_BODY_CHARS_FOR_SCAN, emailHasScannableBody } from '@/lib/mail-scanner'
import { extractedPdfDatesToJson, ocrStatement } from '@/lib/ocr-statement'
import { runTripleCheck } from '@/lib/triple-check'
import { isLikelyRekkiEmail, parseRekkiFromEmailParts } from '@/lib/rekki-parser'
import {
  resolveFornitoreByPartialName,
  resolveFornitoreByRekkiSupplierId,
  type FornitoreInferRow,
} from '@/lib/fornitore-infer-from-document'
import { safeDate } from '@/lib/safe-date'
import { persistRekkiOrderStatement } from '@/lib/rekki-statement'
import type { EmailScanMailboxContext, EmailScanStreamEvent } from '@/lib/email-scan-stream'
import {
  buildScanAttachmentFingerprint,
  isScanUnitAlreadyCompleted,
} from '@/lib/email-scan-checkpoint'
import { defaultFiscalYearLabel, fiscalYearRangeUtc, isValidFiscalYear } from '@/lib/fiscal-year'
import {
  emailSubjectLooksLikeStatement,
  inferAutoPendingKindFromEmailScan,
  scanContextSuggestsBolla,
  scanContextSuggestsFattura,
} from '@/lib/document-bozza-routing'
import { fetchFornitorePendingKindHint, ocrTipoHintKey } from '@/lib/fornitore-doc-type-hints'
import { isFiscalDocumentAttachment } from '@/lib/fiscal-document-attachments'
import {
  findDuplicateFatturaId,
  findDuplicateFatturaSansNumeroByImporto,
  normalizeNumeroFattura,
} from '@/lib/fattura-duplicate-check'
import { documentiPublicRefUrl } from '@/lib/documenti-storage-url'

/**
 * Limite durata funzione serverless su Vercel (secondi). Piano Hobby: massimo **300**.
 * Piano Pro consente più di 300 secondi ma il deploy viene rifiutato se questo valore supera il tetto del piano.
 * Per scansioni molto lunghe: batch più piccoli oppure piano superiore.
 */
export const maxDuration = 300

type EmailSyncDocumentKind = 'all' | 'fornitore' | 'bolla' | 'fattura' | 'estratto_conto'

const EMAIL_SYNC_DOCUMENT_KINDS = new Set<string>([
  'all',
  'fornitore',
  'bolla',
  'fattura',
  'estratto_conto',
])

function parseEmailSyncDocumentKind(raw: unknown): EmailSyncDocumentKind {
  return typeof raw === 'string' && EMAIL_SYNC_DOCUMENT_KINDS.has(raw) ? (raw as EmailSyncDocumentKind) : 'all'
}

function filterEmailsForSyncDocumentKind(
  emails: ScannedEmail[],
  kind: EmailSyncDocumentKind,
): ScannedEmail[] {
  if (kind !== 'estratto_conto') return emails
  const snip = (t: string | null | undefined) => (t ?? '').slice(0, 12_000)
  return emails.filter(
    (e) =>
      inferAutoPendingKindFromEmailScan(
        e.subject,
        e.attachments[0]?.filename ?? null,
        snip(e.bodyText),
        null,
      ) === 'statement',
  )
}

/** Heartbeat NDJSON durante OCR: evita timeout UI client (~30s) tra un allegato e l’altro. */
const PROCESS_STREAM_HEARTBEAT_MS = 15_000

/** Nessun `console.log` in produzione (log Vercel / dati sensibili). */
const mailDebugLog =
  process.env.NODE_ENV !== 'production' ? (...args: unknown[]) => console.log(...args) : () => {}

/** Messaggio stream NDJSON durante retry IMAP (barra rossa in UI). */
const IMAP_CONNECTION_RETRY_USER_MESSAGE = 'Errore di connessione alla sede. Riprovo…'

/** Serializza le scansioni sulla stessa istanza (riduce conflitti IMAP concorrenti). */
let emailScanTail = Promise.resolve()
function queueEmailScan<T>(fn: () => Promise<T>): Promise<T> {
  const run = emailScanTail.then(() => fn())
  emailScanTail = run.then(
    () => undefined,
    () => undefined
  )
  return run
}

/** Converte OcrResult in oggetto metadata da salvare in jsonb.
 *  Includes raw amount string and format hint for UI validation badge. */
function buildMetadata(
  ocr: OcrResult,
  matchedBy: 'email' | 'alias' | 'domain' | 'piva' | 'ragione_sociale' | 'rekki_supplier' | 'unknown'
) {
  return {
    ragione_sociale:    ocr.ragione_sociale,
    p_iva:              ocr.p_iva,
    indirizzo:          ocr.indirizzo ?? null,
    data_fattura:       ocr.data_fattura,
    numero_fattura:     ocr.numero_fattura,
    tipo_documento:     ocr.tipo_documento ?? null,
    // Stored as a pure float — no formatting at rest
    totale_iva_inclusa: ocr.totale_iva_inclusa,
    // Preserved for UI validation badge ("Parsed as UK format £1,234.56")
    importo_raw:        ocr.importo_raw ?? null,
    formato_importo:    ocr.formato_importo ?? null,
    matched_by:         matchedBy,
  }
}

/**
 * Esegue l'insert in documenti_da_processare con fallback automatico:
 * se la colonna 'metadata' non è ancora stata migrata (errore 42703),
 * riprova senza il campo metadata.
 * Ritorna l'errore finale (null = successo).
 */
async function insertDocumento(
  supabase: SupabaseClient,
  payload: Record<string, unknown>
) {
  const { error } = await supabase.from('documenti_da_processare').insert([payload])

  if (error) {
    // Fallback: colonna 'metadata' non ancora migrata
    if (error.code === '42703' || error.message?.includes('metadata') || error.message?.includes('is_statement') || error.message?.includes('note')) {
      console.warn('[INSERT] Colonna extra non trovata — retry senza metadata/is_statement/note')
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { metadata: _m, is_statement: _is, note: _n, ...safePayload } = payload as Record<string, unknown>
      const { error: e2 } = await supabase.from('documenti_da_processare').insert([safePayload])
      if (e2) console.error('[INSERT] Fallback insert error:', e2.message)
      return e2
    }
    console.error('[INSERT] Errore inserimento documento:', error.message)
  }

  return error
}

type LogStato = 'successo' | 'fornitore_non_trovato' | 'bolla_non_trovata' | 'fornitore_suggerito'

async function insertLog(
  supabase: SupabaseClient,
  email: ScannedEmail,
  stato: LogStato,
  opts: {
    fornitore_id?: string
    file_url?: string
    errore_dettaglio?: string
    sede_id?: string | null
    allegato_nome?: string | null
    imap_uid?: number
    scan_attachment_fingerprint?: string | null
  } = {}
) {
  await supabase.from('log_sincronizzazione').insert([{
    mittente: email.from,
    oggetto_mail: email.subject ?? null,
    stato,
    fornitore_id: opts.fornitore_id ?? null,
    file_url: opts.file_url ?? null,
    errore_dettaglio: opts.errore_dettaglio ?? null,
    sede_id: opts.sede_id ?? null,
    allegato_nome: opts.allegato_nome ?? null,
    imap_uid: opts.imap_uid ?? email.uid ?? null,
    scan_attachment_fingerprint: opts.scan_attachment_fingerprint ?? null,
  }])
}

type FetchImapHooks = {
  onRetry?: (info: { attempt: number; maxAttempts: number; error: unknown }) => void | Promise<void>
  beforeReconnect?: (info: { attempt: number; maxAttempts: number }) => void | Promise<void>
  /** Prima di `client.connect()` (stream UI). */
  beforeConnect?: () => void | Promise<void>
  /** Dopo `connect()` riuscito, prima di aprire la casella (stream UI). */
  afterConnect?: () => void | Promise<void>
  afterMailboxOpen?: () => void | Promise<void>
}

function scanEmailMessageDate(
  internalDate: Date | string | undefined,
  envelopeDate: Date | undefined,
  parsedDate: Date | undefined
): Date | null {
  if (internalDate != null) {
    const d = internalDate instanceof Date ? internalDate : new Date(internalDate)
    if (!Number.isNaN(d.getTime())) return d
  }
  if (envelopeDate && !Number.isNaN(envelopeDate.getTime())) return envelopeDate
  if (parsedDate && !Number.isNaN(parsedDate.getTime())) return parsedDate
  return null
}

type FetchImapEmailOpts = {
  lookbackDays?: number | null
  /** Se impostato, ha priorità sul lookback; filtra per data messaggio (internal/envelope/parsed). */
  fiscalRange?: { start: Date; endExclusive: Date } | null
}

/** Scansiona una casella IMAP e restituisce le email nella finestra scelta (lette e non lette, allegati e/o corpo testuale). */
async function fetchFromImap(
  host: string,
  port: number,
  user: string,
  password: string,
  opts: FetchImapEmailOpts,
  hooks?: FetchImapHooks
): Promise<ScannedEmail[]> {
  const { lookbackDays, fiscalRange } = opts
  mailDebugLog(
    `[IMAP] Tentativo di connessione: host=${host} porta=${port} utente=${user} lookback=${lookbackDays ?? 'illimitato'}gg fiscal=${fiscalRange ? 'sì' : 'no'}`
  )

  let searchCriteria: { since?: Date; before?: Date; all?: boolean }
  if (fiscalRange) {
    searchCriteria = {
      since: fiscalRange.start,
      before: fiscalRange.endExclusive,
    }
  } else {
    const sinceDate =
      lookbackDays && lookbackDays > 0
        ? new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000)
        : undefined
    searchCriteria = sinceDate ? { since: sinceDate } : { all: true }
  }

  return withImapSession(
    {
      host,
      port,
      user,
      password,
      secure: port !== 143,
      tls: { rejectUnauthorized: false },
    },
    async (client) => {
      mailDebugLog(`[IMAP] Connessione stabilita: ${host}`)
      const emails: ScannedEmail[] = []
      await client.mailboxOpen('INBOX')
      await hooks?.afterMailboxOpen?.()

      let totalMsg = 0
      let withAttach = 0
      for await (const msg of client.fetch(searchCriteria, {
        envelope: true,
        source: true,
        internalDate: true,
      })) {
        totalMsg++
        if (!msg.source) continue
        const parsed = await simpleParser(msg.source)

        const msgDate = scanEmailMessageDate(
          msg.internalDate as Date | string | undefined,
          msg.envelope?.date,
          parsed.date ?? undefined
        )
        if (fiscalRange) {
          if (!msgDate || msgDate < fiscalRange.start || msgDate >= fiscalRange.endExclusive) {
            continue
          }
        }

        const attachments = (parsed.attachments ?? [])
          .filter(a => isFiscalDocumentAttachment(a.contentType, a.filename))
          .map(a => {
            const ext = a.filename?.split('.').pop()?.toLowerCase() ?? 'pdf'
            return {
              filename: a.filename ?? `allegato.${ext}`,
              content: a.content,
              contentType: a.contentType,
              extension: ext,
            }
          })

        const txt = parsed.text?.trim()
          ? parsed.text
          : typeof parsed.html === 'string'
            ? parsed.html
                .replace(/<script[\s\S]*?<\/script>/gi, ' ')
                .replace(/<style[\s\S]*?<\/style>/gi, ' ')
                .replace(/<[^>]+>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim()
            : ''

        const bodyText = txt || null
        const hasBody = (bodyText?.trim().length ?? 0) >= MIN_EMAIL_BODY_CHARS_FOR_SCAN

        if (!attachments.length) {
          if (!hasBody) continue
          withAttach++
          emails.push({
            uid: msg.uid,
            from: parsed.from?.value?.[0]?.address ?? '',
            subject: parsed.subject ?? null,
            bodyText,
            attachments: [],
          })
          continue
        }

        withAttach++
        emails.push({
          uid: msg.uid,
          from: parsed.from?.value?.[0]?.address ?? '',
          subject: parsed.subject ?? null,
          bodyText,
          attachments,
        })
      }
      mailDebugLog(`[IMAP] Messaggi nella finestra di ricerca: ${totalMsg} (con allegati o testo analizzabile: ${withAttach})`)
      mailDebugLog(`[IMAP] Sessione chiusa correttamente: ${host}`)
      return emails
    },
    {
      onRetry: hooks?.onRetry,
      beforeReconnect: hooks?.beforeReconnect,
      beforeConnect: hooks?.beforeConnect,
      afterConnect: hooks?.afterConnect,
    }
  )
}

type Fornitore = {
  id: string
  nome: string
  sede_id: string | null
  language?: string | null
  rekki_link?: string | null
  rekki_supplier_id?: string | null
  email?: string | null
}

type SupplierEmailScope = {
  allowedEmails: Set<string>
  allowedDomains: Set<string>
}

const GENERIC_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'libero.it',
  'pec.it',
  'legalmail.it',
  'aruba.it',
])

async function loadFornitoreScanContext(
  supabase: SupabaseClient,
  fornitoreId: string
): Promise<{ fornitore: Fornitore; scope: SupplierEmailScope } | null> {
  const { data: f, error } = await supabase
    .from('fornitori')
    .select('id, nome, sede_id, language, rekki_link, rekki_supplier_id, email')
    .eq('id', fornitoreId)
    .single()
  if (error || !f) return null

  const { data: aliasRows } = await supabase
    .from('fornitore_emails')
    .select('email')
    .eq('fornitore_id', fornitoreId)

  const allowedEmails = new Set<string>()
  if (f.email?.trim()) allowedEmails.add(f.email.trim().toLowerCase())
  for (const row of aliasRows ?? []) {
    const em = (row as { email?: string | null }).email
    if (em?.trim()) allowedEmails.add(em.trim().toLowerCase())
  }
  const allowedDomains = new Set<string>()
  for (const em of allowedEmails) {
    const d = em.split('@')[1]?.toLowerCase()
    if (d && !GENERIC_EMAIL_DOMAINS.has(d)) allowedDomains.add(d)
  }

  const fornitore: Fornitore = {
    id: f.id,
    nome: f.nome,
    sede_id: f.sede_id,
    language: f.language,
    rekki_link: f.rekki_link,
    rekki_supplier_id: f.rekki_supplier_id,
    email: f.email,
  }
  return { fornitore, scope: { allowedEmails, allowedDomains } }
}

function emailMatchesSupplierScope(fromRaw: string, scope: SupplierEmailScope): boolean {
  const from = (fromRaw || '').trim().toLowerCase()
  if (!from.includes('@')) return false
  if (scope.allowedEmails.has(from)) return true
  const dom = from.split('@')[1]
  return !!dom && scope.allowedDomains.has(dom)
}

/** Unità di lavoro per una singola email (allegati o corpo scansionabile). */
function countUnitsForOneEmail(e: ScannedEmail): number {
  if (e.attachments.length) return e.attachments.length
  if (emailHasScannableBody(e)) return 1
  return 0
}

/** Allegati + eventuali email solo-testo da processare come unità di lavoro. */
function countScanEmailUnits(emails: ScannedEmail[]): number {
  return emails.reduce((sum, e) => sum + countUnitsForOneEmail(e), 0)
}

const SYNTHETIC_EMAIL_DOC_FILENAME = '[DA TESTO EMAIL] Documento sintetico.txt'

async function uploadSyntheticEmailBodyDoc(
  supabase: SupabaseClient,
  email: ScannedEmail
): Promise<{ publicUrl: string } | { error: string }> {
  const header =
    '[DA TESTO EMAIL] Documento sintetico generato dal corpo del messaggio\n' +
    `Mittente: ${email.from}\n` +
    `Oggetto: ${email.subject ?? '(nessuno)'}\n\n` +
    '--- Corpo messaggio ---\n\n'
  const raw = email.bodyText?.trim() ?? ''
  const buf = Buffer.from(header + raw.slice(0, 200_000), 'utf8')
  const uniqueName = `email_testo_${crypto.randomUUID()}.txt`
  const { error: uploadError } = await supabase.storage
    .from('documenti')
    .upload(uniqueName, buf, { contentType: 'text/plain; charset=utf-8', upsert: false })
  if (uploadError) return { error: uploadError.message }
  return { publicUrl: documentiPublicRefUrl(uniqueName) }
}

async function resolveFornitore(
  supabase: SupabaseClient,
  senderEmail: string,
  sedeFilter?: string
): Promise<Fornitore | null> {
  mailDebugLog(`[RLS] resolveFornitore: mittente="${senderEmail}" sedeFilter=${sedeFilter ?? 'nessuno'}`)

  // 1️⃣ Alias esatto
  const aliasQuery = supabase
    .from('fornitore_emails')
    .select('fornitore_id, fornitori!inner(id, nome, sede_id, language, rekki_link, rekki_supplier_id)')
    .ilike('email', senderEmail)
    .limit(1)
  if (sedeFilter) aliasQuery.eq('fornitori.sede_id', sedeFilter)
  const { data: aliasRows, error: aliasErr } = await aliasQuery
  mailDebugLog(`[RLS] alias query → righe=${aliasRows?.length ?? 0}${aliasErr ? ` errore="${aliasErr.message}"` : ''}`)
  if (aliasRows?.length) {
    const found = (aliasRows[0] as unknown as { fornitori: Fornitore }).fornitori
    mailDebugLog(`[RLS] trovato via alias: ${found.nome} (id=${found.id})`)
    return found
  }

  // 2️⃣ Email principale
  const fornitoriQuery = supabase
    .from('fornitori')
    .select('id, nome, sede_id, language, rekki_link, rekki_supplier_id')
    .ilike('email', senderEmail)
    .limit(1)
  if (sedeFilter) fornitoriQuery.eq('sede_id', sedeFilter)
  const { data: fornitori, error: fornErr } = await fornitoriQuery
  mailDebugLog(`[RLS] email principale query → righe=${fornitori?.length ?? 0}${fornErr ? ` errore="${fornErr.message}"` : ''}`)
  if (fornitori?.length) {
    mailDebugLog(`[RLS] trovato via email principale: ${fornitori[0].nome}`)
    return fornitori[0]
  }

  // 3️⃣ Dominio (evita domini generici)
  const domain = senderEmail.split('@')[1]?.toLowerCase()
  const genericDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'libero.it', 'pec.it', 'legalmail.it', 'aruba.it']
  if (domain && !genericDomains.includes(domain)) {
    const domainQuery = supabase
      .from('fornitori')
      .select('id, nome, sede_id, language, rekki_link, rekki_supplier_id')
      .ilike('email', `%@${domain}`)
      .limit(1)
    if (sedeFilter) domainQuery.eq('sede_id', sedeFilter)
    const { data: byDomain, error: domErr } = await domainQuery
    mailDebugLog(`[RLS] dominio "@${domain}" query → righe=${byDomain?.length ?? 0}${domErr ? ` errore="${domErr.message}"` : ''}`)
    if (byDomain?.length) {
      mailDebugLog(`[RLS] trovato via dominio: ${byDomain[0].nome}`)
      return byDomain[0]
    }
  } else {
    mailDebugLog(`[RLS] dominio "@${domain}" saltato (generico o mancante)`)
  }

  mailDebugLog(`[RLS] fornitore NON trovato per "${senderEmail}"`)
  return null
}

/**
 * Tentativo di matching per P.IVA (usato come fallback quando l'email è sconosciuta).
 * Normalizza la P.IVA rimuovendo prefisso paese e caratteri non numerici.
 */
function inferRowToFornitore(r: FornitoreInferRow): Fornitore {
  return {
    id: r.id,
    nome: r.nome,
    sede_id: r.sede_id,
    language: r.language,
    rekki_link: r.rekki_link,
    rekki_supplier_id: r.rekki_supplier_id,
    email: r.email,
  }
}

/** Cerca un ID fornitore Rekki nel corpo/oggetto (metadati testuali). */
function extractRekkiSupplierIdFromEmailHint(email: ScannedEmail, ocr: OcrResult): string | null {
  const blob = `${email.subject ?? ''}\n${email.bodyText ?? ''}`
  const m =
    blob.match(/rekki[_\s-]*supplier[_\s-]*id\s*[:=]\s*["']?([A-Za-z0-9_-]{2,64})/i) ??
    blob.match(/supplier[_\s-]*id\s*[:=]\s*["']?([A-Za-z0-9_-]{2,64})/i)
  if (m?.[1]) return m[1].trim()
  const meta = ocr as unknown as { rekki_supplier_id?: string | null }
  const fromOcr = meta.rekki_supplier_id?.trim()
  return fromOcr && fromOcr.length >= 2 ? fromOcr : null
}

async function resolveFornitoreByPIVA(
  supabase: SupabaseClient,
  piva: string,
  sedeFilter?: string
): Promise<{ fornitore: Fornitore; matchedBy: 'piva' } | null> {
  const pivaNorm = piva.replace(/\D/g, '')
  if (pivaNorm.length < 7) return null   // troppo corto per essere una P.IVA

  mailDebugLog(`[PIVA] Ricerca fornitore per P.IVA normalizzata: "${pivaNorm}"`)
  const q = supabase
    .from('fornitori')
    .select('id, nome, sede_id, language, rekki_link, rekki_supplier_id')
    .or(`piva.ilike.%${pivaNorm}%,piva.eq.${pivaNorm}`)
    .limit(1)
  if (sedeFilter) q.eq('sede_id', sedeFilter)
  const { data, error } = await q
  if (error) console.warn(`[PIVA] Errore query: ${error.message}`)
  if (data?.length) {
    mailDebugLog(`[PIVA] ✅ Trovato via P.IVA: ${data[0].nome} (${data[0].id})`)
    return { fornitore: data[0], matchedBy: 'piva' }
  }
  mailDebugLog(`[PIVA] Nessun fornitore per P.IVA "${pivaNorm}"`)
  return null
}

/**
 * Returns null when OCR fails due to a transient API error (timeout / rate-limit / 5xx).
 * The caller must NOT record a scan fingerprint in this case — the next scan cycle will
 * pick up the same attachment and retry OCR cleanly.
 */
async function runOcrEmailBodyOnly(
  supabase: SupabaseClient,
  email: ScannedEmail,
  langHint: string | undefined,
  fornitoreId: string | null,
  logSedeId: string | null,
  scanFingerprint?: string | null,
): Promise<OcrResult | null> {
  const body = email.bodyText?.trim()
  if (!body) return { ...EMPTY_OCR, estrazione_utile: false }
  const logContext = {
    supabase,
    mittente:     email.from || 'sconosciuto',
    oggetto_mail: email.subject,
    file_name:    SYNTHETIC_EMAIL_DOC_FILENAME,
    fornitore_id: fornitoreId,
    file_url:     null as string | null,
    sede_id:      logSedeId,
    scanAttachmentFingerprint: scanFingerprint ?? null,
    imapUid:      email.uid,
  }
  try {
    return await ocrInvoiceFromEmailBody(body, langHint, { logContext })
  } catch (e) {
    if (e instanceof OcrInvoiceConfigurationError) {
      console.error('[PROCESS]', e.message)
      return EMPTY_OCR
    }
    if (e instanceof OcrTransientError) {
      console.warn(`[OCR] Transient failure (body "${email.from}"): ${(e as Error).message} — will retry next scan`)
      return null
    }
    throw e
  }
}

/**
 * Returns null when OCR fails due to a transient API error (timeout / rate-limit / 5xx).
 * The caller must NOT record a scan fingerprint in this case — the next scan cycle will
 * pick up the same attachment and retry OCR cleanly.
 */
async function runOcrForEmail(
  supabase: SupabaseClient,
  buf: Buffer,
  contentType: string,
  langHint: string | undefined,
  email: ScannedEmail,
  attachment: ScannedEmail['attachments'][number],
  fornitoreId: string | null,
  logSedeId: string | null,
  scanFingerprint?: string | null,
): Promise<OcrResult | null> {
  const logContext = {
    supabase,
    mittente:     email.from || 'sconosciuto',
    oggetto_mail: email.subject,
    file_name:    attachment.filename ?? null,
    fornitore_id: fornitoreId,
    file_url:     null as string | null,
    sede_id:      logSedeId,
    scanAttachmentFingerprint: scanFingerprint ?? null,
    imapUid:      email.uid,
  }
  try {
    return await ocrInvoice(buf, contentType, langHint, {
      logContext,
      emailBodyText: email.bodyText ?? null,
    })
  } catch (e) {
    if (e instanceof OcrInvoiceConfigurationError) {
      console.error('[PROCESS]', e.message)
      return EMPTY_OCR
    }
    if (e instanceof OcrTransientError) {
      console.warn(`[OCR] Transient failure ("${attachment.filename ?? contentType}"): ${(e as Error).message} — will retry next scan`)
      return null
    }
    throw e
  }
}

// ── Pre-filtro oggetto email ──────────────────────────────────────────────────
// Parole chiave che indicano un documento fiscale/commerciale nell'oggetto.
// Le email da mittenti sconosciuti senza allegati che NON contengono queste
// parole vengono scartate PRIMA di chiamare Gemini → risparmio token 60-80%.
const FISCAL_SUBJECT_KEYWORDS = [
  // Italiano
  'fattura', 'fatt.', ' ft.', 'ft ', 'ddt', 'bolla', 'bolle', 'consegna',
  'ordine', 'pagamento', 'nota credito', 'nota di credito', 'rimessa',
  'acquisto', 'spedizione', 'documento fiscale', 'ricevuta', 'preventivo',
  'pro forma', 'proforma', 'estratto conto', 'listino', 'fornitore',
  // English
  'invoice', 'inv.', ' inv ', 'delivery', 'receipt', 'order', 'payment',
  'shipment', 'statement', 'credit note', 'purchase', 'quotation', 'p.o.',
  'purchase order', 'remittance', 'dispatch',
  // Francese / Tedesco / Spagnolo (fornitori internazionali comuni in Italia)
  'facture', 'rechnung', 'factura', 'bon de livraison', 'lieferschein',
  'aviso de pago', 'albarán',
]

/**
 * Ritorna true se l'oggetto dell'email contiene almeno una parola chiave
 * che suggerisce un documento fiscale/commerciale.
 */
function subjectLooksFiscal(subject: string | null | undefined): boolean {
  if (!subject) return false
  const low = subject.toLowerCase()
  return FISCAL_SUBJECT_KEYWORDS.some(kw => low.includes(kw))
}

type ProcessEmailsOptions = {
  onAttachmentProgress?: (p: { attachmentsProcessed: number; attachmentsTotal: number }) => void
  /** Chiamato quando tutte le unità (allegati / corpo) di un messaggio IMAP sono state elaborate. */
  onEmailFullyProcessed?: () => void
  /** Scansione mirata: tutte le email in input sono attribuite a questo fornitore. */
  directFornitore?: Fornitore | null
  /** Filtro tipologia import lato server (default all). */
  documentKind?: EmailSyncDocumentKind
}

async function processEmails(
  supabase: SupabaseClient,
  emails: ScannedEmail[],
  sedeFilter?: string,
  fallbackSedeId?: string,
  options?: ProcessEmailsOptions
): Promise<{
  ricevuti: number
  ignorate: number
  bozzaCreate: number
  attachmentsTotal: number
  attachmentsProcessed: number
  /** Unità (allegato o corpo) già chiuse in `log_sincronizzazione` — nessun nuovo insert. */
  skippedAlreadyCompleted: number
  /** Email scartate dal pre-filtro (mittente sconosciuto + oggetto non fiscale) prima di chiamare Gemini. */
  preFiltered: number
}> {
  let ricevuti = 0
  let ignorate = 0
  let skippedAlreadyCompleted = 0
  let preFiltered = 0
  const rekkiPersistedUids = new Set<number>()

  if (!process.env.GEMINI_API_KEY?.trim()) {
    console.error(
      "[PROCESS] GEMINI_API_KEY assente o vuota: l'estrazione OCR produrrà campi vuoti per tutti i documenti finché non è configurata.",
    )
  }

  const attachmentsTotal = countScanEmailUnits(emails)
  let attachmentsProcessed = 0
  const unitsPerUid = new Map<number, number>()
  const unitsDonePerUid = new Map<number, number>()
  for (const e of emails) {
    const n = countUnitsForOneEmail(e)
    if (n > 0) unitsPerUid.set(e.uid, n)
  }
  const bumpAttach = (uid: number) => {
    attachmentsProcessed++
    const need = unitsPerUid.get(uid)
    if (need !== undefined) {
      const done = (unitsDonePerUid.get(uid) ?? 0) + 1
      unitsDonePerUid.set(uid, done)
      if (done >= need) {
        options?.onEmailFullyProcessed?.()
      }
    }
    options?.onAttachmentProgress?.({ attachmentsProcessed, attachmentsTotal })
  }

  const docKind = options?.documentKind ?? 'all'
  const onlyUnknownSenders = docKind === 'fornitore' && !options?.directFornitore

  // La sede effettiva da usare: priorità sedeFilter (per-sede IMAP) → fallbackSedeId (global IMAP)
  const effectiveSede = sedeFilter ?? fallbackSedeId ?? null
  mailDebugLog(
    `[PROCESS] Inizio processEmails: ${emails.length} email, sedeFilter=${sedeFilter ?? 'nessuno'} fallback=${fallbackSedeId ?? 'nessuno'} effective=${effectiveSede ?? 'NULL'} documentKind=${docKind}`,
  )

  // ── FASE 1: raggruppa allegati (e messaggi solo-testo) per fornitore ────
  // Item include anche l'OCR pre-computato (per i documenti risolti via P.IVA)
  type Item = {
    email: ScannedEmail
    attachment: ScannedEmail['attachments'][number] | null
    ocr?: OcrResult   // pre-computato se risolto via P.IVA
  }
  type GroupEntry = {
    fornitore: Fornitore
    items: Item[]
    matchedBy: 'email' | 'alias' | 'domain' | 'piva' | 'ragione_sociale' | 'rekki_supplier'
  }
  const groups = new Map<string, GroupEntry>()
  const noFornitore: ScannedEmail[] = []
  const noFornitoreBodyOnly: ScannedEmail[] = []

  const direct = options?.directFornitore ?? null
  if (direct) {
    if (!groups.has(direct.id)) {
      groups.set(direct.id, { fornitore: direct, items: [], matchedBy: 'email' })
    }
    const g = groups.get(direct.id)!
    for (const email of emails) {
      for (const attachment of email.attachments) {
        g.items.push({ email, attachment })
      }
      if (!email.attachments.length && emailHasScannableBody(email)) {
        g.items.push({ email, attachment: null })
      }
    }
    mailDebugLog(`[PROCESS] Fase 1 (fornitore mirato): ${emails.length} email → fornitore "${direct.nome}"`)
  } else {
    for (const email of emails) {
      mailDebugLog(
        `[PROCESS] Analisi email da: ${email.from} | allegati: ${email.attachments.length} | corpo utilizzabile: ${emailHasScannableBody(email)}`
      )
      if (email.attachments.length) {
        const fornitore = await resolveFornitore(supabase, email.from, sedeFilter)
        if (!fornitore) {
          mailDebugLog(`[PROCESS] ⚠️  Fornitore non trovato per "${email.from}" — OCR+P.IVA verrà tentato`)
          noFornitore.push(email)
          continue
        }
        if (onlyUnknownSenders) {
          mailDebugLog(`[PROCESS] Modalità «nuovo fornitore»: salto email da mittente già in rubrica (${fornitore.nome})`)
          for (let ai = 0; ai < email.attachments.length; ai++) bumpAttach(email.uid)
          continue
        }
        mailDebugLog(`[PROCESS] ✅ Fornitore abbinato: ${fornitore.nome} (${fornitore.id})`)
        if (!groups.has(fornitore.id)) {
          groups.set(fornitore.id, { fornitore, items: [], matchedBy: 'email' })
        }
        for (const attachment of email.attachments) {
          groups.get(fornitore.id)!.items.push({ email, attachment })
        }
      } else if (emailHasScannableBody(email)) {
        const fornitore = await resolveFornitore(supabase, email.from, sedeFilter)
        if (!fornitore) {
          // ── PRE-FILTRO: mittente sconosciuto senza allegati ──────────────────
          // Se l'oggetto non contiene parole chiave fiscali, scarta l'email
          // senza chiamare Gemini. Risparmio stimato: 60-80% dei token su
          // email corpo-testo (newsletter, promo, notifiche automatiche ecc.).
          if (!subjectLooksFiscal(email.subject)) {
            mailDebugLog(
              `[PREFILTRO] ✂️  Scartata (mittente sconosciuto + oggetto non fiscale): da="${email.from}" oggetto="${(email.subject ?? '').slice(0, 80)}"`,
            )
            preFiltered++
            bumpAttach(email.uid)
            continue
          }
          mailDebugLog(`[PROCESS] ⚠️  Solo testo, fornitore non trovato per "${email.from}" — estrazione+P.IVA`)
          noFornitoreBodyOnly.push(email)
          continue
        }
        if (onlyUnknownSenders) {
          mailDebugLog(`[PROCESS] Modalità «nuovo fornitore»: salto solo-testo da mittente già in rubrica (${fornitore.nome})`)
          bumpAttach(email.uid)
          continue
        }
        mailDebugLog(`[PROCESS] ✅ Solo testo, fornitore: ${fornitore.nome} (${fornitore.id})`)
        if (!groups.has(fornitore.id)) {
          groups.set(fornitore.id, { fornitore, items: [], matchedBy: 'email' })
        }
        groups.get(fornitore.id)!.items.push({ email, attachment: null })
      }
    }
  }

  mailDebugLog(
    `[PROCESS] Riepilogo fase 1: ${groups.size} fornitori via email, ${noFornitore.length} email con allegati senza fornitore, ${noFornitoreBodyOnly.length} email solo-testo senza fornitore`
  )

  // ── Mittenti sconosciuti: OCR → tenta P.IVA match → salva in coda ─────
  for (const email of noFornitore) {
    for (const attachment of email.attachments) {
      const fp = buildScanAttachmentFingerprint({
        sedeId: effectiveSede,
        imapUid: email.uid,
        filename: attachment.filename,
        content: attachment.content,
        kind: 'attachment',
      })
      if (await isScanUnitAlreadyCompleted(supabase, fp)) {
        skippedAlreadyCompleted++
        bumpAttach(email.uid)
        continue
      }

      mailDebugLog(`[PROCESS] Mittente sconosciuto "${email.from}" — OCR in corso per tentare matching P.IVA`)

      // 1. OCR allegato + corpo mail (runOcrForEmail passa già emailBodyText all'AI)
      const ocrOrNull = await runOcrForEmail(
        supabase,
        attachment.content,
        attachment.contentType,
        undefined,
        email,
        attachment,
        null,
        effectiveSede,
        fp,
      )
      // Transient OCR failure (timeout/rate-limit) — skip this unit entirely.
      // No fingerprint recorded → next scan cycle retries OCR on the same attachment.
      if (ocrOrNull === null) {
        mailDebugLog(`[PROCESS] OCR transient: skip "${attachment.filename ?? 'allegato'}" da "${email.from}" — nessun fingerprint, ritentato al prossimo ciclo`)
        ignorate++
        bumpAttach(email.uid)
        continue
      }
      let ocr: OcrResult = ocrOrNull
      let docFromBodyFallback = false
      if (ocrExtractedNothingUseful(ocr) && emailHasScannableBody(email)) {
        const bodyOcrOrNull = await runOcrEmailBodyOnly(supabase, email, undefined, null, effectiveSede, fp)
        // Treat a transient body-OCR failure as "nothing extracted" — the attachment was
        // already uploaded; we'll retry the full chain on the next scan.
        if (bodyOcrOrNull !== null && ocrBodyOnlyWorthInserting(bodyOcrOrNull)) {
          ocr = bodyOcrOrNull
          docFromBodyFallback = true
          mailDebugLog(`[PROCESS] Allegato poco leggibile — uso dati estratti dal corpo email [DA TESTO EMAIL]`)
        }
      }
      mailDebugLog(`[PROCESS] OCR sconosciuto: ragione_sociale=${ocr.ragione_sociale ?? '—'} piva=${ocr.p_iva ?? '—'} totale=${ocr.totale_iva_inclusa ?? '—'} bodyFallback=${docFromBodyFallback}`)

      // 2. Prova a trovare il fornitore via P.IVA estratta dal documento
      let pivaMatchResult: Awaited<ReturnType<typeof resolveFornitoreByPIVA>> = null
      if (ocr.p_iva) {
        pivaMatchResult = await resolveFornitoreByPIVA(supabase, ocr.p_iva, sedeFilter)
        if (pivaMatchResult) {
          const { fornitore } = pivaMatchResult
          if (!groups.has(fornitore.id)) groups.set(fornitore.id, { fornitore, items: [], matchedBy: 'piva' })
          groups.get(fornitore.id)!.items.push({ email, attachment, ocr })
          mailDebugLog(`[PROCESS] ✅ Documento sconosciuto risolto via P.IVA → "${fornitore.nome}"`)
          continue
        }
      }

      const rekkiIdHint = extractRekkiSupplierIdFromEmailHint(email, ocr)
      if (rekkiIdHint) {
        const rkRow = await resolveFornitoreByRekkiSupplierId(supabase, rekkiIdHint, sedeFilter)
        if (rkRow) {
          const fornitore = inferRowToFornitore(rkRow)
          if (!groups.has(fornitore.id)) groups.set(fornitore.id, { fornitore, items: [], matchedBy: 'rekki_supplier' })
          groups.get(fornitore.id)!.items.push({ email, attachment, ocr })
          mailDebugLog(`[PROCESS] ✅ Documento sconosciuto risolto via rekki_supplier_id → "${fornitore.nome}"`)
          continue
        }
      }

      const nomeRow = await resolveFornitoreByPartialName(supabase, ocr.ragione_sociale, sedeFilter)
      if (nomeRow) {
        const fornitore = inferRowToFornitore(nomeRow)
        if (!groups.has(fornitore.id)) groups.set(fornitore.id, { fornitore, items: [], matchedBy: 'ragione_sociale' })
        groups.get(fornitore.id)!.items.push({ email, attachment, ocr })
        mailDebugLog(`[PROCESS] ✅ Documento sconosciuto risolto via ragione sociale parziale → "${fornitore.nome}"`)
        continue
      }

      // 3a. Nessun match, dati solo da testo → documento sintetico [DA TESTO EMAIL]
      if (docFromBodyFallback) {
        const syn = await uploadSyntheticEmailBodyDoc(supabase, email)
        if ('error' in syn) {
          console.error(`[PROCESS] Upload sintetico fallito (fallback corpo): ${syn.error}`)
          await insertLog(supabase, email, 'fornitore_non_trovato', {
            errore_dettaglio: `Allegato illeggibile, fallback testo email. Errore upload: ${syn.error}`,
            sede_id: effectiveSede,
            allegato_nome: attachment.filename ?? null,
          })
          ignorate++
          bumpAttach(email.uid)
          continue
        }
        const unknownDocSedeId = sedeFilter ?? fallbackSedeId ?? effectiveSede ?? null
        const bodySnipU = email.bodyText?.slice(0, 12_000) ?? null
        const autoKindU = inferAutoPendingKindFromEmailScan(
          email.subject,
          attachment.filename ?? null,
          bodySnipU,
          ocr,
        )
        const unknownPayload = {
          fornitore_id:   null,
          sede_id:        unknownDocSedeId,
          mittente:       email.from || 'sconosciuto',
          oggetto_mail:   email.subject ?? null,
          file_url:       syn.publicUrl,
          file_name:      SYNTHETIC_EMAIL_DOC_FILENAME,
          content_type:   'text/plain',
          data_documento: safeDate(ocr.data_fattura),
          stato:          'da_associare',
          metadata:       {
            ...buildMetadata(ocr, 'unknown'),
            origine_testo_email: true,
            ...(autoKindU ? { pending_kind: autoKindU } : {}),
          },
          ...(autoKindU === 'statement' ? { is_statement: true } : {}),
          note:           ocr.note_corpo_mail?.trim() || null,
        }
        const insErr = await insertDocumento(supabase, unknownPayload)
        if (insErr) {
          const detail = `[${insErr.code ?? 'ERR'}] ${insErr.message}${insErr.details ? ' | ' + insErr.details : ''}`
          console.error(`[PROCESS] ❌ Insert sintetico sconosciuto fallito: ${detail}`)
          await insertLog(supabase, email, 'fornitore_non_trovato', {
            errore_dettaglio: detail,
            sede_id: unknownDocSedeId,
            allegato_nome: attachment.filename ?? null,
            scan_attachment_fingerprint: fp,
          })
          ignorate++
          bumpAttach(email.uid)
        } else {
          mailDebugLog(`[PROCESS] ✅ Documento [DA TESTO EMAIL] salvato — mittente="${email.from}"`)
          const hinted =
            !!(ocr.ragione_sociale?.trim() || (ocr.p_iva && ocr.p_iva.replace(/\D/g, '').length >= 7))
          const sugLabel = ocr.ragione_sociale?.trim() || ocr.p_iva || '—'
          await insertLog(supabase, email, hinted ? 'fornitore_suggerito' : 'successo', {
            file_url: syn.publicUrl,
            sede_id: unknownDocSedeId,
            allegato_nome: attachment.filename ?? null,
            scan_attachment_fingerprint: fp,
            ...(hinted && {
              errore_dettaglio:
                `Fornitore Suggerito: ${sugLabel}` +
                (ocr.p_iva ? ` | P.IVA estratta dal testo: ${ocr.p_iva}` : '') +
                (email.from ? ` | Mittente: ${email.from}` : ''),
            }),
          })
          ricevuti++
          bumpAttach(email.uid)
        }
        continue
      }

      // 3b. Nessun match → upload allegato + salva come sconosciuto
      const uniqueName = `email_auto_${crypto.randomUUID()}.${attachment.extension}`
      const { error: uploadError } = await supabase.storage
        .from('documenti')
        .upload(uniqueName, attachment.content, { contentType: attachment.contentType, upsert: false })

      if (uploadError) {
        console.error(`[PROCESS] Upload fallito (sconosciuto): ${uploadError.message}`)
        await insertLog(supabase, email, 'fornitore_non_trovato', {
          errore_dettaglio: `Mittente sconosciuto. Errore upload: ${uploadError.message}`,
          sede_id: effectiveSede,
          allegato_nome: attachment.filename ?? null,
        })
        ignorate++
        bumpAttach(email.uid)
        continue
      }

      const publicRef = documentiPublicRefUrl(uniqueName)
      // sede_id: usa sempre sedeFilter (scansione corrente) come priorità massima
      const unknownDocSedeId = sedeFilter ?? fallbackSedeId ?? effectiveSede ?? null
      const bodySnipAtt = email.bodyText?.slice(0, 12_000) ?? null
      const autoKindAtt = inferAutoPendingKindFromEmailScan(
        email.subject,
        attachment.filename ?? null,
        bodySnipAtt,
        ocr,
      )

      const unknownPayload = {
        fornitore_id:   null,
        sede_id:        unknownDocSedeId,
        mittente:       email.from || 'sconosciuto',
        oggetto_mail:   email.subject ?? null,
        file_url:       publicRef,
        file_name:      attachment.filename ?? null,
        content_type:   attachment.contentType ?? null,
        data_documento: safeDate(ocr.data_fattura),
        stato:          'da_associare',
        metadata:       {
          ...buildMetadata(ocr, 'unknown'),
          ...(autoKindAtt ? { pending_kind: autoKindAtt } : {}),
        },
        ...(autoKindAtt === 'statement' ? { is_statement: true } : {}),
        note:           ocr.note_corpo_mail?.trim() || null,
      }

      const insErr = await insertDocumento(supabase, unknownPayload)

      if (insErr) {
        const detail = `[${insErr.code ?? 'ERR'}] ${insErr.message}${insErr.details ? ' | ' + insErr.details : ''}`
        console.error(`[PROCESS] ❌ Insert sconosciuto fallito: ${detail}`)
        await insertLog(supabase, email, 'fornitore_non_trovato', {
          errore_dettaglio: detail,
          sede_id: unknownDocSedeId,
          allegato_nome: attachment.filename ?? null,
          scan_attachment_fingerprint: fp,
        })
        ignorate++
        bumpAttach(email.uid)
      } else {
        mailDebugLog(`[PROCESS] ✅ Documento sconosciuto salvato — mittente="${email.from}" sede=${unknownDocSedeId ?? 'NULL'} piva_ocr="${ocr.p_iva ?? '—'}"`)
        const hinted =
          !!(ocr.ragione_sociale?.trim() || (ocr.p_iva && ocr.p_iva.replace(/\D/g, '').length >= 7))
        const sugLabel = ocr.ragione_sociale?.trim() || ocr.p_iva || '—'
        await insertLog(supabase, email, hinted ? 'fornitore_suggerito' : 'successo', {
          file_url: publicRef,
          sede_id: unknownDocSedeId,
          allegato_nome: attachment.filename ?? null,
          scan_attachment_fingerprint: fp,
          ...(hinted && {
            errore_dettaglio:
              `Fornitore Suggerito: ${sugLabel}` +
              (ocr.p_iva ? ` | P.IVA OCR: ${ocr.p_iva}` : '') +
              (email.from ? ` | Mittente: ${email.from}` : ''),
          }),
        })
        ricevuti++
        bumpAttach(email.uid)
      }
    }
  }

  // ── Mittenti sconosciuti, solo corpo mail (nessun allegato) ───────────────
  for (const email of noFornitoreBodyOnly) {
    const fp = buildScanAttachmentFingerprint({
      sedeId: effectiveSede,
      imapUid: email.uid,
      filename: null,
      content: Buffer.from(email.bodyText ?? '', 'utf8'),
      kind: 'body_only',
    })
    if (await isScanUnitAlreadyCompleted(supabase, fp)) {
      skippedAlreadyCompleted++
      bumpAttach(email.uid)
      continue
    }

    mailDebugLog(`[PROCESS] Solo testo, mittente sconosciuto "${email.from}" — estrazione AI sul corpo`)

    const ocrBodyOrNull = await runOcrEmailBodyOnly(supabase, email, undefined, null, effectiveSede, fp)
    // Transient failure — skip without fingerprint so next scan retries OCR on the body.
    if (ocrBodyOrNull === null) {
      mailDebugLog(`[PROCESS] OCR transient (body-only "${email.from}") — nessun fingerprint, ritentato al prossimo ciclo`)
      ignorate++
      bumpAttach(email.uid)
      continue
    }
    const ocr: OcrResult = ocrBodyOrNull
    mailDebugLog(
      `[PROCESS] Estrazione testo: ragione_sociale=${ocr.ragione_sociale ?? '—'} piva=${ocr.p_iva ?? '—'} totale=${ocr.totale_iva_inclusa ?? '—'} utile=${ocr.estrazione_utile}`
    )

    if (!ocrBodyOnlyWorthInserting(ocr)) {
      await insertLog(supabase, email, 'fornitore_non_trovato', {
        errore_dettaglio: 'Solo testo email: nessun dato fiscale o logistico rilevante estratto.',
        sede_id: effectiveSede,
        allegato_nome: null,
        scan_attachment_fingerprint: fp,
      })
      ignorate++
      bumpAttach(email.uid)
      continue
    }

    let pivaMatchResult: Awaited<ReturnType<typeof resolveFornitoreByPIVA>> = null
    if (ocr.p_iva) {
      pivaMatchResult = await resolveFornitoreByPIVA(supabase, ocr.p_iva, sedeFilter)
      if (pivaMatchResult) {
        const { fornitore } = pivaMatchResult
        if (!groups.has(fornitore.id)) groups.set(fornitore.id, { fornitore, items: [], matchedBy: 'piva' })
        groups.get(fornitore.id)!.items.push({ email, attachment: null, ocr })
        mailDebugLog(`[PROCESS] ✅ Testo email risolto via P.IVA → "${fornitore.nome}"`)
        continue
      }
    }

    const rekBody = extractRekkiSupplierIdFromEmailHint(email, ocr)
    if (rekBody) {
      const rkRow = await resolveFornitoreByRekkiSupplierId(supabase, rekBody, sedeFilter)
      if (rkRow) {
        const fornitore = inferRowToFornitore(rkRow)
        if (!groups.has(fornitore.id)) groups.set(fornitore.id, { fornitore, items: [], matchedBy: 'rekki_supplier' })
        groups.get(fornitore.id)!.items.push({ email, attachment: null, ocr })
        mailDebugLog(`[PROCESS] ✅ Testo email risolto via rekki_supplier_id → "${fornitore.nome}"`)
        continue
      }
    }

    const nomeBody = await resolveFornitoreByPartialName(supabase, ocr.ragione_sociale, sedeFilter)
    if (nomeBody) {
      const fornitore = inferRowToFornitore(nomeBody)
      if (!groups.has(fornitore.id)) groups.set(fornitore.id, { fornitore, items: [], matchedBy: 'ragione_sociale' })
      groups.get(fornitore.id)!.items.push({ email, attachment: null, ocr })
      mailDebugLog(`[PROCESS] ✅ Testo email risolto via ragione sociale parziale → "${fornitore.nome}"`)
      continue
    }

    const syn = await uploadSyntheticEmailBodyDoc(supabase, email)
    if ('error' in syn) {
      console.error(`[PROCESS] Upload sintetico fallito (sconosciuto solo-testo): ${syn.error}`)
      await insertLog(supabase, email, 'fornitore_non_trovato', {
        errore_dettaglio: `Solo testo, mittente sconosciuto. Errore upload: ${syn.error}`,
        sede_id: effectiveSede,
        allegato_nome: null,
      })
      ignorate++
      bumpAttach(email.uid)
      continue
    }

    const unknownDocSedeId = sedeFilter ?? fallbackSedeId ?? effectiveSede ?? null
    const bodySnipOnly = email.bodyText?.slice(0, 12_000) ?? null
    const autoKindOnly = inferAutoPendingKindFromEmailScan(
      email.subject,
      SYNTHETIC_EMAIL_DOC_FILENAME,
      bodySnipOnly,
      ocr,
    )
    const unknownPayload = {
      fornitore_id:   null,
      sede_id:        unknownDocSedeId,
      mittente:       email.from || 'sconosciuto',
      oggetto_mail:   email.subject ?? null,
      file_url:       syn.publicUrl,
      file_name:      SYNTHETIC_EMAIL_DOC_FILENAME,
      content_type:   'text/plain',
      data_documento: safeDate(ocr.data_fattura),
      stato:          'da_associare',
      metadata:       {
        ...buildMetadata(ocr, 'unknown'),
        origine_testo_email: true,
        ...(autoKindOnly ? { pending_kind: autoKindOnly } : {}),
      },
      ...(autoKindOnly === 'statement' ? { is_statement: true } : {}),
      note:           ocr.note_corpo_mail?.trim() || null,
    }

    const insErr = await insertDocumento(supabase, unknownPayload)

    if (insErr) {
      const detail = `[${insErr.code ?? 'ERR'}] ${insErr.message}${insErr.details ? ' | ' + insErr.details : ''}`
      console.error(`[PROCESS] ❌ Insert solo-testo sconosciuto fallito: ${detail}`)
      await insertLog(supabase, email, 'fornitore_non_trovato', {
        errore_dettaglio: detail,
        sede_id: unknownDocSedeId,
        allegato_nome: null,
        scan_attachment_fingerprint: fp,
      })
      ignorate++
      bumpAttach(email.uid)
    } else {
      mailDebugLog(`[PROCESS] ✅ Documento solo-testo salvato — mittente="${email.from}"`)
      const hinted =
        !!(ocr.ragione_sociale?.trim() || (ocr.p_iva && ocr.p_iva.replace(/\D/g, '').length >= 7))
      const sugLabel = ocr.ragione_sociale?.trim() || ocr.p_iva || '—'
      await insertLog(supabase, email, hinted ? 'fornitore_suggerito' : 'successo', {
        file_url: syn.publicUrl,
        sede_id: unknownDocSedeId,
        allegato_nome: null,
        scan_attachment_fingerprint: fp,
        ...(hinted && {
          errore_dettaglio:
            `Fornitore Suggerito: ${sugLabel}` +
            (ocr.p_iva ? ` | P.IVA estratta: ${ocr.p_iva}` : '') +
            (email.from ? ` | Mittente: ${email.from}` : ''),
        }),
      })
      ricevuti++
      bumpAttach(email.uid)
    }
  }

  // ── FASE 2: per ogni fornitore, OCR, salva in coda e crea Bolla/Fattura bozza ─
  let bozzaCreate = 0

  for (const { fornitore, items, matchedBy } of groups.values()) {
    // OCR in parallelo; se già pre-computato (da P.IVA match) lo riutilizza.
    // Pass supplier language as a parsing hint (conflict-prevention rule:
    // supplier language takes priority for parsing; sede currency used for display).
    const langHint = fornitore.language ?? undefined
    const logSedeForFornitore = sedeFilter ?? fornitore.sede_id ?? fallbackSedeId ?? effectiveSede ?? null
    const checkpointSede = logSedeForFornitore

    const fpList: string[] = []
    const skipped: boolean[] = []
    for (let i = 0; i < items.length; i++) {
      const { email, attachment } = items[i]
      const fp = attachment
        ? buildScanAttachmentFingerprint({
            sedeId: checkpointSede,
            imapUid: email.uid,
            filename: attachment.filename,
            content: attachment.content,
            kind: 'attachment',
          })
        : buildScanAttachmentFingerprint({
            sedeId: checkpointSede,
            imapUid: email.uid,
            filename: SYNTHETIC_EMAIL_DOC_FILENAME,
            content: Buffer.from(email.bodyText ?? '', 'utf8'),
            kind: 'body_only',
          })
      fpList[i] = fp
      const done = await isScanUnitAlreadyCompleted(supabase, fp)
      skipped[i] = done
      if (done) {
        skippedAlreadyCompleted++
        bumpAttach(email.uid)
      }
    }

    // null = transient OCR failure for that item — do NOT fingerprint; retry next scan.
    const ocrResults: (OcrResult | null)[] = await Promise.all(
      items.map(({ attachment, ocr, email }, i) => {
        if (skipped[i]) return Promise.resolve(EMPTY_OCR)
        const fp = fpList[i]
        return ocr
          ? Promise.resolve(ocr)
          : attachment
            ? runOcrForEmail(
                supabase,
                attachment.content,
                attachment.contentType,
                langHint,
                email,
                attachment,
                fornitore.id,
                logSedeForFornitore,
                fp,
              )
            : runOcrEmailBodyOnly(
                supabase,
                email,
                langHint,
                fornitore.id,
                logSedeForFornitore,
                fp,
              )
      }),
    )
    mailDebugLog(`[PROCESS] OCR completato per "${fornitore.nome}" (matched_by=${matchedBy}): numeri fattura=[${ocrResults.map(r => r?.numero_fattura ?? 'null').join(', ')}] totali=[${ocrResults.map(r => r?.totale_iva_inclusa ?? 'null').join(', ')}]`)

    for (let i = 0; i < items.length; i++) {
      if (skipped[i]) continue
      const { email, attachment } = items[i]
      const fp = fpList[i]

      // Transient OCR failure — do NOT fingerprint so the next scan cycle retries cleanly.
      if (ocrResults[i] === null) {
        mailDebugLog(`[PROCESS] OCR transient: skip "${attachment?.filename ?? 'body'}" per "${fornitore.nome}" — ritentato al prossimo ciclo`)
        ignorate++
        bumpAttach(email.uid)
        continue
      }
      const ocr = ocrResults[i] as OcrResult
      const documentSedeId = sedeFilter ?? fornitore.sede_id ?? fallbackSedeId ?? effectiveSede ?? null

      let file_url: string
      let storedFileName: string | null
      let storedContentType: string | null
      let isSyntheticBodyDoc = false

      if (attachment) {
        mailDebugLog(`[PROCESS] Upload allegato "${attachment.filename}" (${attachment.contentType}) per "${fornitore.nome}"`)
        const uniqueName = `email_auto_${crypto.randomUUID()}.${attachment.extension}`
        const { error: uploadError } = await supabase.storage
          .from('documenti')
          .upload(uniqueName, attachment.content, { contentType: attachment.contentType, upsert: false })

        if (uploadError) {
          console.error(`[PROCESS] ❌ Upload fallito: ${uploadError.message}`)
          await insertLog(supabase, email, 'fornitore_non_trovato', {
            fornitore_id: fornitore.id,
            errore_dettaglio: `Errore upload allegato: ${uploadError.message}`,
            sede_id: documentSedeId,
            allegato_nome: attachment.filename ?? null,
          })
          bumpAttach(email.uid)
          continue
        }

        file_url = documentiPublicRefUrl(uniqueName)
        storedFileName = attachment.filename ?? null
        storedContentType = attachment.contentType ?? null
        mailDebugLog(`[PROCESS] Upload OK → ${file_url}`)
      } else {
        mailDebugLog(`[PROCESS] Documento sintetico da corpo mail per "${fornitore.nome}"`)
        const syn = await uploadSyntheticEmailBodyDoc(supabase, email)
        if ('error' in syn) {
          console.error(`[PROCESS] ❌ Upload testo sintetico fallito: ${syn.error}`)
          await insertLog(supabase, email, 'fornitore_non_trovato', {
            fornitore_id: fornitore.id,
            errore_dettaglio: `Errore upload documento da testo email: ${syn.error}`,
            sede_id: documentSedeId,
            allegato_nome: null,
          })
          bumpAttach(email.uid)
          continue
        }
        file_url = syn.publicUrl
        storedFileName = SYNTHETIC_EMAIL_DOC_FILENAME
        storedContentType = 'text/plain'
        isSyntheticBodyDoc = true
        mailDebugLog(`[PROCESS] Upload sintetico OK → ${file_url}`)
      }

      const noteFromEmailBody = ocr.note_corpo_mail?.trim() || null

      const bodySnippet = email.bodyText?.slice(0, 12_000) ?? null
      const autoPendingKind = inferAutoPendingKindFromEmailScan(
        email.subject,
        storedFileName,
        bodySnippet,
        ocr,
      )

      const ocrTipoKey = ocrTipoHintKey(ocr.tipo_documento)
      const learnedPendingKind = fornitore.id
        ? await fetchFornitorePendingKindHint(supabase, fornitore.id, ocrTipoKey)
        : null

      /** L’oggetto/corpo che dicono “estratto” o “ordine” vincono sull’hint appreso (es. fattura) per quel fornitore. */
      const effectivePendingKind = autoPendingKind ?? learnedPendingKind

      const treatAsStatement = effectivePendingKind === 'statement'

      // ── AUTO-CREAZIONE BOZZA ───────────────────────────────────────────────
      // Tenta di creare automaticamente una Bolla o Fattura in stato 'bozza'
      // basandosi sui dati OCR estratti. Il documento rimane in "Documenti da
      // Elaborare" per la conferma finale dell'utente.
      let bozzaId: string | null = null
      let bozzaTipo: 'bolla' | 'fattura' | null = null

      const skipAutoBozza = treatAsStatement || effectivePendingKind === 'ordine'

      if (fornitore.id && documentSedeId && !skipAutoBozza) {
        const dataDoc = safeDate(ocr.data_fattura) ?? new Date().toISOString().slice(0, 10)
        const numRef = ocr.numero_fattura?.trim() || null
        const tipo = ocr.tipo_documento ?? null
        const isFatturaTipo = tipo === 'fattura'
        const ctxFattura = scanContextSuggestsFattura(email.subject, storedFileName)
        const ctxBolla = scanContextSuggestsBolla(email.subject, storedFileName)

        let createFatturaBozza = isFatturaTipo

        // OCR tipo "bolla" / "altro" / assente ma oggetto o nome file da chiaramente fattura.
        if (!createFatturaBozza && ctxFattura && !ctxBolla) {
          createFatturaBozza = true
        }

        if (docKind === 'fattura') {
          createFatturaBozza = true
        } else if (docKind === 'bolla') {
          createFatturaBozza = false
        }

        if (learnedPendingKind === 'fattura' && docKind !== 'bolla') {
          createFatturaBozza = true
        } else if (learnedPendingKind === 'bolla' && docKind !== 'fattura') {
          createFatturaBozza = false
        }

        if (createFatturaBozza) {
          const numNorm = normalizeNumeroFattura(numRef ?? '')
          let skipFatturaBozza = false
          if (numNorm && fornitore.id && documentSedeId) {
            const dupId = await findDuplicateFatturaId(supabase, {
              sedeId: documentSedeId,
              fornitoreId: fornitore.id,
              data: dataDoc,
              numeroFattura: numNorm,
            })
            if (dupId) {
              skipFatturaBozza = true
              mailDebugLog(
                `[BOZZA] Fattura bozza saltata: già registrata id=${dupId} n.fattura=${numNorm} fornitore="${fornitore.nome}"`,
              )
            }
          }
          if (
            !skipFatturaBozza &&
            !numNorm &&
            fornitore.id &&
            documentSedeId &&
            ocr.totale_iva_inclusa != null
          ) {
            const imp = Number(ocr.totale_iva_inclusa)
            if (Number.isFinite(imp)) {
              const dupSans = await findDuplicateFatturaSansNumeroByImporto(supabase, {
                sedeId: documentSedeId,
                fornitoreId: fornitore.id,
                data: dataDoc,
                importo: imp,
              })
              if (dupSans) {
                skipFatturaBozza = true
                mailDebugLog(
                  `[BOZZA] Fattura bozza saltata (senza n.): già registrata id=${dupSans} importo=${imp} fornitore="${fornitore.nome}"`,
                )
              }
            }
          }
          if (!skipFatturaBozza) {
            const { data: newFattura, error: fatturaErr } = await supabase
              .from('fatture')
              .insert([{
                fornitore_id:             fornitore.id,
                sede_id:                  documentSedeId,
                data:                     dataDoc,
                numero_fattura:           numNorm || null,
                importo:                  ocr.totale_iva_inclusa ?? null,
                verificata_estratto_conto: false,
                file_url,
              }])
              .select('id')
              .single()

            if (fatturaErr) {
              console.warn(`[BOZZA] Fattura bozza non creata per "${fornitore.nome}": ${fatturaErr.message}`)
            } else if (newFattura) {
              bozzaId = newFattura.id
              bozzaTipo = 'fattura'
              bozzaCreate++
              mailDebugLog(`[BOZZA] ✅ Fattura bozza creata: id=${bozzaId} n.fattura=${numNorm || numRef || '—'}`)
            }
          }
        } else {
          const { data: newBolla, error: bollaErr } = await supabase
            .from('bolle')
            .insert([{
              fornitore_id:  fornitore.id,
              sede_id:       documentSedeId,
              data:          dataDoc,
              /** Qualsiasi riferimento estratto (anche da etichette tipo "Note Number") va sul DDT. */
              numero_bolla:  numRef,
              importo:       ocr.totale_iva_inclusa ?? null,
              stato:         'bozza',
              file_url,
            }])
            .select('id')
            .single()

          if (bollaErr) {
            console.warn(`[BOZZA] Bolla bozza non creata per "${fornitore.nome}": ${bollaErr.message}`)
          } else if (newBolla) {
            bozzaId = newBolla.id
            bozzaTipo = 'bolla'
            bozzaCreate++
            mailDebugLog(
              `[BOZZA] ✅ Bolla bozza creata: id=${bozzaId} n.bolla=${numRef ?? '—'} importo=${ocr.totale_iva_inclusa ?? '—'}`,
            )
          }
        }
      }

      // ── REKKI: parse anticipato per includere le righe prodotto in metadata ──
      let earlyRekkiLines: import('@/lib/rekki-parser').RekkiLine[] = []
      if (
        !rekkiPersistedUids.has(email.uid) &&
        email.bodyText &&
        isLikelyRekkiEmail(email.subject, email.from, email.bodyText)
      ) {
        earlyRekkiLines = parseRekkiFromEmailParts({ subject: email.subject, text: email.bodyText })
      }

      const metadata = {
        ...buildMetadata(ocr, matchedBy),
        ...(isSyntheticBodyDoc ? { origine_testo_email: true } : {}),
        ...(effectivePendingKind ? { pending_kind: effectivePendingKind } : {}),
        // Riferimento alla bozza creata automaticamente
        ...(bozzaId ? { bozza_id: bozzaId, bozza_tipo: bozzaTipo } : {}),
        ...(fornitore.rekki_link?.trim()
          ? { rekki_link: fornitore.rekki_link.trim() }
          : {}),
        ...(fornitore.rekki_supplier_id?.trim()
          ? { rekki_supplier_id: fornitore.rekki_supplier_id.trim() }
          : {}),
        // Righe prodotto Rekki — usate da finalizePendingByTipo per popolare conferme_ordine.righe
        ...(earlyRekkiLines.length ? { rekki_lines: earlyRekkiLines } : {}),
      }

      // Estratto classico (oggetto): marca associato + parsing; altri “statement-like” restano in coda con tipo Estratto.
      const isStatementEmail = emailSubjectLooksLikeStatement(email.subject)
      const isStatementDoc = effectivePendingKind === 'statement'

      const knownPayload = {
        fornitore_id:   fornitore.id,
        sede_id:        documentSedeId,
        mittente:       email.from || 'sconosciuto',
        oggetto_mail:   email.subject ?? null,
        file_url,
        file_name:      storedFileName,
        content_type:   storedContentType,
        data_documento: safeDate(ocr.data_fattura),
        stato:          isStatementEmail ? 'associato' : (bozzaId ? 'bozza_creata' : 'da_associare'),
        is_statement:   isStatementDoc,
        metadata,
        note:           noteFromEmailBody,
      }

      const insertError = await insertDocumento(supabase, knownPayload)

      if (insertError) {
        const detail = `[${insertError.code ?? 'ERR'}] ${insertError.message}${insertError.details ? ' | ' + insertError.details : ''}`
        console.error(`[PROCESS] ❌ Insert FALLITO per "${fornitore.nome}": ${detail}`)
        await insertLog(supabase, email, 'fornitore_non_trovato', {
          fornitore_id: fornitore.id,
          file_url,
          errore_dettaglio: detail,
          sede_id: documentSedeId,
          allegato_nome: attachment?.filename ?? null,
          scan_attachment_fingerprint: fp,
        })
        bumpAttach(email.uid)
        continue
      }

      // ── AUTO-PROCESS STATEMENT / PAYMENT-RECEIPT PDF (stesso parser righe) ──
      const stmtPdf =
        attachment &&
        (attachment.contentType === 'application/pdf' || String(attachment.extension).toLowerCase() === 'pdf')
      if (treatAsStatement && stmtPdf) {
        mailDebugLog(
          `[PROCESS] 📋 Documento estratto/receipt rilevato per "${fornitore.nome}" — avvio parsing automatico righe`,
        )
        // Fire-and-forget in background (don't block the main loop)
        processStatementInBackground(supabase, {
          fornitoreId: fornitore.id,
          sedeId:      documentSedeId,
          fileUrl:     file_url,
          subject:     email.subject ?? null,
          buffer:      attachment.content,
          contentType: attachment.contentType,
        }).catch(err => console.error('[STMT] Errore background processing:', err))
      } else {
        mailDebugLog(`[PROCESS] ✅ Documento salvato per "${fornitore.nome}" | stato=${bozzaId ? 'bozza_creata' : 'da_associare'} | bozza_tipo=${bozzaTipo ?? 'nessuna'} | sede=${documentSedeId ?? 'NULL'}`)
      }

      await insertLog(supabase, email, 'successo', {
        fornitore_id: fornitore.id,
        file_url,
        sede_id: documentSedeId,
        allegato_nome: attachment?.filename ?? null,
        scan_attachment_fingerprint: fp,
      })

      ricevuti++

      // Processa email Rekki: usa le righe già parsate anticipatamente
      if (earlyRekkiLines.length && !rekkiPersistedUids.has(email.uid)) {
        rekkiPersistedUids.add(email.uid)
        persistRekkiOrderStatement(supabase, {
          fornitoreId: fornitore.id,
          sedeId: documentSedeId,
          rekkiLines: earlyRekkiLines,
          emailSubject: email.subject ?? `Rekki — ${fornitore.nome}`,
          fileUrl: file_url,
        }).catch((err) => console.error('[REKKI] persist fallito:', err))
      }
      bumpAttach(email.uid)
    }
  }

  mailDebugLog(
    `[PROCESS] Fine processEmails: ricevuti=${ricevuti} ignorate=${ignorate} bozzeCreate=${bozzaCreate} skippedAlready=${skippedAlreadyCompleted} preFiltered=${preFiltered}`,
  )
  return {
    ricevuti,
    ignorate,
    bozzaCreate,
    attachmentsTotal,
    attachmentsProcessed,
    skippedAlreadyCompleted,
    preFiltered,
  }
}

/**
 * Parse a statement attachment, save rows to the `statements` + `statement_rows`
 * tables, then run a triple-check on each row.
 *
 * Called in a fire-and-forget manner so it doesn't block the email scan loop.
 */
async function processStatementInBackground(
  supabase: SupabaseClient,
  opts: {
    fornitoreId: string
    sedeId:      string | null
    fileUrl:     string
    subject:     string | null
    buffer:      Buffer | Uint8Array
    contentType: string
  }
) {
  const { fornitoreId, sedeId, fileUrl, subject, buffer, contentType } = opts

  // 1️⃣ Create the statement record (status = processing)
  const { data: stmtRow, error: stmtErr } = await supabase
    .from('statements')
    .insert([{
      sede_id:       sedeId,
      fornitore_id:  fornitoreId,
      email_subject: subject,
      file_url:      fileUrl,
      status:        'processing',
      total_rows:    0,
      missing_rows:  0,
    }])
    .select('id')
    .single()

  if (stmtErr || !stmtRow) {
    console.error('[STMT] Errore creazione statement record:', stmtErr?.message)
    // Table might not exist yet — silently skip
    return
  }

  const statementId = stmtRow.id
  mailDebugLog(`[STMT] Statement record creato: ${statementId}`)

  // 2️⃣ OCR — parse statement rows + optional PDF header dates
  const ocr = await ocrStatement(buffer, contentType)
  const rows = ocr.rows
  const extractedPdfDates = extractedPdfDatesToJson(ocr.extractedPdfDates)

  if (!rows.length) {
    console.warn(`[STMT] Nessuna riga estratta dal PDF per statement ${statementId}`)
    await supabase
      .from('statements')
      .update({ status: 'error', total_rows: 0, extracted_pdf_dates: extractedPdfDates })
      .eq('id', statementId)
    return
  }

  mailDebugLog(`[STMT] ${rows.length} righe estratte — avvio triple-check`)

  // 3️⃣ Run triple-check
  const { results } = await runTripleCheck(supabase, rows, sedeId, fornitoreId)

  // 4️⃣ Save statement_rows
  const rowInserts = results.map(r => ({
    statement_id:   statementId,
    numero_doc:     r.numero,
    importo:        r.importoStatement,
    data_doc:       rows.find(row => row.numero === r.numero)?.data ?? null,
    check_status:   r.status,
    delta_importo:  r.deltaImporto,
    fattura_id:     r.fattura?.id ?? null,
    fattura_numero: r.fattura?.numero_fattura ?? null,
    fornitore_id:   r.fornitore?.id ?? fornitoreId,
    bolle_json:     r.bolle.length ? r.bolle : null,
  }))

  const { error: rowsErr } = await supabase.from('statement_rows').insert(rowInserts)
  if (rowsErr) {
    console.error('[STMT] Errore insert statement_rows:', rowsErr.message)
    await supabase.from('statements').update({ status: 'error' }).eq('id', statementId)
    return
  }

  // 5️⃣ Update statement record with counts
  const missingRows = results.filter(r => r.status !== 'ok').length
  await supabase.from('statements').update({
    status:              'done',
    total_rows:          results.length,
    missing_rows:        missingRows,
    extracted_pdf_dates: extractedPdfDates,
  }).eq('id', statementId)

  mailDebugLog(`[STMT] ✅ Statement ${statementId} completato: ${results.length} righe, ${missingRows} anomalie`)
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET non configurato' }, { status: 500 })

  const authHeader = (req as Request & { headers: Headers }).headers.get('authorization')
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
  }

  try {
    const result = await queueEmailScan(() => runEmailScanCore({}))
    if (result.avvisi && result.avvisi.length > 0 && result.ricevuti === 0 && result.ignorate === 0) {
      return NextResponse.json({
        ricevuti: 0,
        ignorate: 0,
        bozzeCreate: 0,
        skippedAlreadyCompleted: result.skippedAlreadyCompleted,
        preFiltered: result.preFiltered,
        avvisi: result.avvisi,
        messaggio: result.avvisi[0],
        mailsFound: result.mailsFound,
        mailsProcessed: result.mailsProcessed,
        attachmentsTotal: result.attachmentsTotal,
        attachmentsProcessed: result.attachmentsProcessed,
      })
    }
    return NextResponse.json({
      ricevuti: result.ricevuti,
      ignorate: result.ignorate,
      bozzeCreate: result.bozzeCreate,
      skippedAlreadyCompleted: result.skippedAlreadyCompleted,
      preFiltered: result.preFiltered,
      messaggio: result.messaggio,
      ...(result.avvisi && result.avvisi.length > 0 && { avvisi: result.avvisi }),
      mailsFound: result.mailsFound,
      mailsProcessed: result.mailsProcessed,
      attachmentsTotal: result.attachmentsTotal,
      attachmentsProcessed: result.attachmentsProcessed,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Errore sconosciuto'
    console.error('[FATAL] Errore inatteso in scan-emails GET:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/** Classify an IMAP error and format it for the avvisi[] array and DB storage. */
function classifyImapErrorForSede(
  err: unknown,
  nome: string,
): { avviso: string; classified: ClassifiedImapError } {
  const classified = classifyImapError(err)
  const avviso = `Sede "${nome}": ${classified.message}. ${classified.actionHint}`
  return { avviso, classified }
}

type RunEmailScanParams = {
  userSedeId?: string
  filterSedeId?: string
  fornitoreId?: string
  /** Default lookback da impostazioni sede. */
  emailSyncScope?: 'lookback' | 'fiscal_year'
  /** Obbligatorio se fiscal_year e scope fiscal; altrimenti calcolato per sede. */
  fiscalYear?: number
  /** Solo scope lookback: override giorni (1–365). Assente = usa `imap_lookback_days` per sede. */
  lookbackDaysOverride?: number
  /** Filtro tipologia documenti (fornitore mirato: ignorato, si usa sempre all). */
  documentKind?: EmailSyncDocumentKind
  emit?: (e: EmailScanStreamEvent) => void | Promise<void>
}

type EmailScanCoreResult = {
  ricevuti: number
  ignorate: number
  bozzeCreate: number
  messaggio: string
  avvisi?: string[]
  /** Structured IMAP errors — one per failed sede/global mailbox. UI can use kind + actionHint
   *  to show targeted guidance (e.g. "wrong credentials" → link to IMAP settings). */
  imapErrorDetails?: ClassifiedImapError[]
  mailsFound: number
  mailsProcessed: number
  attachmentsTotal: number
  attachmentsProcessed: number
  /** Allegati/corpi già registrati in log (sync precedente) — nessun nuovo documento in coda. */
  skippedAlreadyCompleted: number
  /** Email scartate dal pre-filtro prima di chiamare Gemini (mittente sconosciuto + oggetto non fiscale). */
  preFiltered: number
}

async function runEmailScanCore(params: RunEmailScanParams): Promise<EmailScanCoreResult> {
  const emit = params.emit
  const s = async (e: EmailScanStreamEvent) => {
    if (emit) await emit(e)
  }

  const supabase = createServiceClient()

  const hasGlobalImap = !!(process.env.IMAP_HOST && process.env.IMAP_USER && process.env.IMAP_PASSWORD)
  if (!hasGlobalImap) {
    console.warn('[ENV] Casella IMAP globale non configurata (IMAP_HOST/IMAP_USER/IMAP_PASSWORD mancanti)')
  }

  let directFornitore: Fornitore | null = null
  let supplierScope: SupplierEmailScope | null = null
  let filterSedeId = params.filterSedeId

  if (params.fornitoreId) {
    const ctx = await loadFornitoreScanContext(supabase, params.fornitoreId)
    if (!ctx) throw new Error('Fornitore non trovato.')
    if (!ctx.fornitore.sede_id) throw new Error('Assegnare una sede al fornitore per sincronizzare le email.')
    if (ctx.scope.allowedEmails.size === 0) {
      throw new Error('Aggiungi almeno un indirizzo email (o alias) al fornitore.')
    }
    directFornitore = ctx.fornitore
    supplierScope = ctx.scope
    filterSedeId = ctx.fornitore.sede_id
    mailDebugLog(`[FORNITORE] Scansione mirata id=${params.fornitoreId} sede=${filterSedeId}`)
  }

  const effectiveDocKind: EmailSyncDocumentKind = directFornitore ? 'all' : (params.documentKind ?? 'all')

  let totalRicevuti = 0
  let totalIgnorate = 0
  let totalBozzeCreate = 0
  let totalSkippedAlready = 0
  let totalPreFiltered = 0
  const avvisi: string[] = []
  const imapErrorDetails: ClassifiedImapError[] = []

  let mailsFound = 0
  let mailsProcessed = 0
  /** Email completate nel batch `processEmails` in corso (stream UI; azzerato a fine batch). */
  let emailsDoneInBatch = 0
  let attDoneRun = 0
  /** Include l’avanzamento dell’unità corrente (OCR); `attDoneRun` solo a fine batch. Serve a heartbeat/stream. */
  let attDoneLive = 0
  let attTotalRun = 0

  let scopeMailboxKind: 'sede' | 'global' = 'sede'
  let scopeMailboxName = ''
  const scopeSupplierFilter: string | undefined =
    directFornitore?.nome?.trim() ? directFornitore.nome.trim() : undefined

  const mailboxCtx = (): EmailScanMailboxContext | undefined => {
    if (scopeMailboxKind === 'global') {
      return { mailboxKind: 'global', supplierFilter: scopeSupplierFilter }
    }
    if (scopeMailboxName.trim().length > 0) {
      return {
        mailboxKind: 'sede',
        mailboxName: scopeMailboxName,
        supplierFilter: scopeSupplierFilter,
      }
    }
    return undefined
  }

  let systemFallbackSedeId: string | undefined = params.userSedeId
  if (!systemFallbackSedeId) {
    const { data: firstSede } = await supabase.from('sedi').select('id').limit(1).single()
    systemFallbackSedeId = firstSede?.id ?? undefined
  }
  mailDebugLog(`[SCAN] sede fallback: ${systemFallbackSedeId ?? 'NESSUNA'}`)

  const emailSyncScope = params.emailSyncScope ?? 'lookback'
  const fiscalYearParam = isValidFiscalYear(params.fiscalYear) ? params.fiscalYear : undefined
  const lookbackOverride =
    typeof params.lookbackDaysOverride === 'number' &&
    Number.isFinite(params.lookbackDaysOverride) &&
    params.lookbackDaysOverride >= 1 &&
    params.lookbackDaysOverride <= 365
      ? Math.floor(params.lookbackDaysOverride)
      : undefined

  let sediQuery = supabase
    .from('sedi')
    .select('id, nome, imap_host, imap_port, imap_user, imap_password, imap_lookback_days, country_code')
    .not('imap_host', 'is', null)
    .not('imap_user', 'is', null)
    .not('imap_password', 'is', null)

  if (filterSedeId) {
    sediQuery = sediQuery.eq('id', filterSedeId) as typeof sediQuery
    mailDebugLog(`[SCAN] filter_sede_id=${filterSedeId}`)
  }

  const { data: sedi, error: sediErr } = await sediQuery

  mailDebugLog(`[DB] Sedi con IMAP: ${sedi?.length ?? 0}${sediErr ? ` errore="${sediErr.message}"` : ''}`)

  const skipGlobalImap = !!params.fornitoreId || !!filterSedeId

  let globalFiscalRange: { start: Date; endExclusive: Date } | null = null
  if (emailSyncScope === 'fiscal_year' && !skipGlobalImap && hasGlobalImap) {
    const ctxId = systemFallbackSedeId
    let globalCc = 'UK'
    if (ctxId) {
      const { data: row } = await supabase.from('sedi').select('country_code').eq('id', ctxId).maybeSingle()
      globalCc = (row as { country_code?: string } | null)?.country_code?.trim() || 'UK'
    }
    const y = fiscalYearParam ?? defaultFiscalYearLabel(globalCc, new Date())
    globalFiscalRange = fiscalYearRangeUtc(globalCc, y)
    mailDebugLog(`[SCAN] Casella globale — FY label=${y} country=${globalCc}`)
  }

  const snap = () => ({
    mailsFound,
    mailsProcessed: mailsProcessed + emailsDoneInBatch,
    ricevuti: totalRicevuti,
    ignorate: totalIgnorate,
    bozzeCreate: totalBozzeCreate,
    skippedAlreadyCompleted: totalSkippedAlready,
    attachmentsTotal: attTotalRun,
    attachmentsProcessed: attDoneLive,
    mailboxContext: mailboxCtx(),
  })

  /** Percentuale fase process: 45–89 in base alle unità effettivamente elaborate (incluso batch in corso). */
  const processPercentFromUnits = (done: number, totalUnits: number) => {
    const total = Math.max(totalUnits, 1)
    const ratio = Math.min(1, Math.max(0, done / total))
    return 45 + Math.min(44, Math.floor(44 * ratio))
  }

  const emitProcessPulse = () =>
    s({
      type: 'progress',
      phase: 'process',
      percent: processPercentFromUnits(attDoneLive, attTotalRun),
      connectionWarning: null,
      ...snap(),
    })

  await s({ type: 'progress', phase: 'connect', percent: 10, connectionWarning: null, connectStep: null, ...snap() })

  /** Ogni retry IMAP: errore + dopo backoff un secondo evento (heartbeat NDJSON). */
  const imapStreamRetryHooks: Pick<FetchImapHooks, 'onRetry' | 'beforeReconnect'> = {
    onRetry: async ({ attempt, maxAttempts }) => {
      await s({
        type: 'progress',
        phase: 'connect',
        percent: Math.min(24, 10 + attempt * 5),
        connectionWarning: IMAP_CONNECTION_RETRY_USER_MESSAGE,
        imapRetry: { attempt: Math.min(maxAttempts, attempt + 1), maxAttempts },
        connectStep: 'to_server',
        ...snap(),
      })
    },
    beforeReconnect: async ({ attempt, maxAttempts }) => {
      await s({
        type: 'progress',
        phase: 'connect',
        percent: Math.min(27, 12 + attempt * 4),
        connectionWarning: null,
        imapRetry: { attempt, maxAttempts },
        connectStep: 'to_server',
        ...snap(),
      })
    },
  }

  if (sedi && sedi.length > 0) {
    for (const sede of sedi) {
      scopeMailboxKind = 'sede'
      scopeMailboxName = sede.nome?.trim() || '—'
      mailDebugLog(`\n[SEDE] ══ Inizio scansione sede "${sede.nome}" (${sede.id}) ══`)
      try {
        await s({ type: 'progress', phase: 'connect', percent: 10, connectionWarning: null, connectStep: null, ...snap() })
        const sedeCc =
          (sede as { country_code?: string | null }).country_code?.trim().toUpperCase() || 'UK'
        const sedeFiscalRange =
          emailSyncScope === 'fiscal_year'
            ? fiscalYearRangeUtc(
                sedeCc,
                fiscalYearParam ?? defaultFiscalYearLabel(sedeCc, new Date())
              )
            : null
        const emails = await fetchFromImap(
          sede.imap_host,
          sede.imap_port ?? 993,
          sede.imap_user,
          sede.imap_password,
          {
            lookbackDays: sedeFiscalRange
              ? null
              : lookbackOverride !== undefined
                ? lookbackOverride
                : sede.imap_lookback_days,
            fiscalRange: sedeFiscalRange,
          },
          {
            ...imapStreamRetryHooks,
            beforeConnect: async () => {
              await s({
                type: 'progress',
                phase: 'connect',
                percent: 12,
                connectionWarning: null,
                connectStep: 'to_server',
                ...snap(),
              })
            },
            afterConnect: async () => {
              await s({
                type: 'progress',
                phase: 'connect',
                percent: 20,
                connectionWarning: null,
                connectStep: 'opening_mailbox',
                ...snap(),
              })
            },
            afterMailboxOpen: async () => {
              await s({
                type: 'progress',
                phase: 'search',
                percent: 28,
                connectionWarning: null,
                ...snap(),
              })
            },
          }
        )
        const filtered = supplierScope
          ? emails.filter((e) => emailMatchesSupplierScope(e.from, supplierScope!))
          : emails
        const syncKindFiltered = filterEmailsForSyncDocumentKind(filtered, effectiveDocKind)

        const batchMails = syncKindFiltered.length
        const batchAtt = countScanEmailUnits(syncKindFiltered)
        mailsFound += batchMails
        attTotalRun += batchAtt

        await s({
          type: 'progress',
          phase: 'search',
          percent: 38,
          connectionWarning: null,
          ...snap(),
        })

        mailDebugLog(
          `[SEDE] "${sede.nome}": ${emails.length} in inbox / ${batchMails} dopo filtri (fornitore + tipologia sync)`,
        )

        if (syncKindFiltered.length > 0) {
          emailsDoneInBatch = 0
          await s({
            type: 'progress',
            phase: 'process',
            percent: 45,
            connectionWarning: null,
            ...snap(),
          })
          const onAttachmentProgress = (p: { attachmentsProcessed: number; attachmentsTotal: number }) => {
            const done = attDoneRun + p.attachmentsProcessed
            attDoneLive = Math.max(attDoneLive, done)
            void s({
              type: 'progress',
              phase: 'process',
              percent: processPercentFromUnits(attDoneLive, attTotalRun),
              connectionWarning: null,
              ...snap(),
              attachmentsProcessed: attDoneLive,
            })
          }

          const processHb = setInterval(() => {
            void emitProcessPulse()
          }, PROCESS_STREAM_HEARTBEAT_MS)
          let peDone = 0
          try {
            const out = await processEmails(supabase, syncKindFiltered, sede.id, undefined, {
              directFornitore: directFornitore ?? undefined,
              onEmailFullyProcessed: () => {
                emailsDoneInBatch++
              },
              onAttachmentProgress: batchAtt > 0 ? onAttachmentProgress : undefined,
              documentKind: effectiveDocKind,
            })
            peDone = out.attachmentsProcessed
            totalRicevuti += out.ricevuti
            totalIgnorate += out.ignorate
            totalBozzeCreate += out.bozzaCreate
            totalSkippedAlready += out.skippedAlreadyCompleted
            totalPreFiltered += out.preFiltered
          } finally {
            clearInterval(processHb)
          }

          attDoneRun += peDone
          attDoneLive = Math.max(attDoneLive, attDoneRun)
          mailsProcessed += batchMails
          emailsDoneInBatch = 0

          await s({
            type: 'progress',
            phase: 'persist',
            percent: 90,
            connectionWarning: null,
            ...snap(),
          })
        }

        await Promise.all([
          supabase
            .from('sedi')
            .update({ last_imap_sync_at: new Date().toISOString(), last_imap_sync_error: null })
            .eq('id', sede.id),
          recordImapSuccess(supabase, sede.id),
        ])
      } catch (err) {
        const { avviso, classified } = classifyImapErrorForSede(err, sede.nome)
        console.error(`[SEDE] ❌ Errore sede "${sede.nome}" [${classified.kind}]:`, err)
        avvisi.push(avviso)
        imapErrorDetails.push(classified)
        // Stream a structured event so the UI can render a per-sede error card immediately
        await s({
          type: 'sede_error',
          sede_id: sede.id,
          sede_nome: sede.nome,
          error: classified.message,
          kind: classified.kind,
          retryable: classified.retryable,
          actionHint: classified.actionHint,
        })
        // Prefix with [kind] so admins can filter by error type without a schema migration
        const persistedError = `[${classified.kind}] ${classified.message} — ${classified.actionHint}`
        await Promise.all([
          supabase
            .from('sedi')
            .update({ last_imap_sync_error: persistedError.slice(0, 2000) })
            .eq('id', sede.id),
          recordImapFailure(supabase, sede.id, classified.kind, classified.message),
        ])
        // Intentional: do NOT rethrow — continue scanning remaining sedi (partial results)
      }
    }
  }

  if (!skipGlobalImap && process.env.IMAP_HOST && process.env.IMAP_USER && process.env.IMAP_PASSWORD) {
    mailDebugLog('\n[GLOBALE] ══ Inizio scansione casella globale ══')
    scopeMailboxKind = 'global'
    scopeMailboxName = ''
    try {
      await s({ type: 'progress', phase: 'connect', percent: 10, connectionWarning: null, connectStep: null, ...snap() })
      const globalHooks: FetchUnseenImapHooks = {
        ...imapStreamRetryHooks,
        beforeConnect: async () => {
          await s({
            type: 'progress',
            phase: 'connect',
            percent: 12,
            connectionWarning: null,
            connectStep: 'to_server',
            ...snap(),
          })
        },
        afterConnect: async () => {
          await s({
            type: 'progress',
            phase: 'connect',
            percent: 20,
            connectionWarning: null,
            connectStep: 'opening_mailbox',
            ...snap(),
          })
        },
        afterInboxOpen: async () => {
          await s({
            type: 'progress',
            phase: 'search',
            percent: 28,
            connectionWarning: null,
            ...snap(),
          })
        },
      }
      const globalLookbackDays =
        !globalFiscalRange && emailSyncScope === 'lookback' && lookbackOverride !== undefined
          ? lookbackOverride
          : null
      const emails = await fetchUnseenEmails(globalHooks, globalFiscalRange, globalLookbackDays)
      const filtered = supplierScope
        ? emails.filter((e) => emailMatchesSupplierScope(e.from, supplierScope!))
        : emails
      const syncKindFiltered = filterEmailsForSyncDocumentKind(filtered, effectiveDocKind)
      const batchMails = syncKindFiltered.length
      const batchAtt = countScanEmailUnits(syncKindFiltered)
      mailsFound += batchMails
      attTotalRun += batchAtt

      await s({
        type: 'progress',
        phase: 'search',
        percent: 38,
        connectionWarning: null,
        ...snap(),
      })

      mailDebugLog(`[GLOBALE] Email trovate: ${emails.length} / ${batchMails} dopo filtri`)
      if (syncKindFiltered.length > 0) {
        emailsDoneInBatch = 0
        await s({
          type: 'progress',
          phase: 'process',
          percent: 45,
          connectionWarning: null,
          ...snap(),
        })
        const onAttachmentProgress = (p: { attachmentsProcessed: number; attachmentsTotal: number }) => {
          const done = attDoneRun + p.attachmentsProcessed
          attDoneLive = Math.max(attDoneLive, done)
          void s({
            type: 'progress',
            phase: 'process',
            percent: processPercentFromUnits(attDoneLive, attTotalRun),
            connectionWarning: null,
            ...snap(),
            attachmentsProcessed: attDoneLive,
          })
        }

        const processHbGlobal = setInterval(() => {
          void emitProcessPulse()
        }, PROCESS_STREAM_HEARTBEAT_MS)
        let peDoneGlobal = 0
        try {
          const out = await processEmails(supabase, syncKindFiltered, undefined, systemFallbackSedeId, {
            directFornitore: directFornitore ?? undefined,
            onEmailFullyProcessed: () => {
              emailsDoneInBatch++
            },
            onAttachmentProgress: batchAtt > 0 ? onAttachmentProgress : undefined,
            documentKind: effectiveDocKind,
          })
          peDoneGlobal = out.attachmentsProcessed
          totalRicevuti += out.ricevuti
          totalIgnorate += out.ignorate
          totalBozzeCreate += out.bozzaCreate
          totalSkippedAlready += out.skippedAlreadyCompleted
          totalPreFiltered += out.preFiltered
        } finally {
          clearInterval(processHbGlobal)
        }

        attDoneRun += peDoneGlobal
        attDoneLive = Math.max(attDoneLive, attDoneRun)
        mailsProcessed += batchMails
        emailsDoneInBatch = 0

        await s({
          type: 'progress',
          phase: 'persist',
          percent: 90,
          connectionWarning: null,
          ...snap(),
        })
      }
      await recordImapSuccess(supabase, null)
    } catch (err) {
      const { avviso, classified } = classifyImapErrorForSede(err, 'casella globale')
      console.error(`[GLOBALE] ❌ Errore casella globale [${classified.kind}]:`, err)
      avvisi.push(avviso)
      imapErrorDetails.push(classified)
      await s({
        type: 'sede_error',
        sede_id: 'global',
        sede_nome: 'Casella Globale',
        error: classified.message,
        kind: classified.kind,
        retryable: classified.retryable,
        actionHint: classified.actionHint,
      })
      await recordImapFailure(supabase, null, classified.kind, classified.message)
    }
  } else if (!skipGlobalImap) {
    mailDebugLog('[GLOBALE] Casella globale non configurata — salto')
  }

  mailDebugLog(
    `\n[FINE] totale ricevuti=${totalRicevuti} ignorate=${totalIgnorate} bozzeCreate=${totalBozzeCreate} skippedAlready=${totalSkippedAlready} preFiltered=${totalPreFiltered} avvisi=${avvisi.length}`,
  )

  // Log pre-filter metrics to activity_log for Gemini savings tracking (fire-and-forget)
  if (totalPreFiltered > 0 || totalRicevuti > 0 || totalIgnorate > 0) {
    const logSedeId = filterSedeId ?? params.filterSedeId ?? params.userSedeId ?? null
    const processed = totalRicevuti + totalIgnorate
    const total = totalPreFiltered + processed
    const scanFornitoreId = params.fornitoreId
    const summaryLabel = `Scansione email: ${processed} elaborate, ${totalPreFiltered} scartate`
    const metadata: Record<string, unknown> = {
      email_scartate_prefiltro: totalPreFiltered,
      email_processate_gemini: processed,
      email_gia_elaborate: totalSkippedAlready,
      risparmio_stimato_pct: total > 0 ? Math.round((totalPreFiltered / total) * 100) : 0,
    }
    if (scanFornitoreId) metadata.fornitore_id = scanFornitoreId
    supabase.from('activity_log').insert([{
      user_id: null,
      sede_id: logSedeId,
      action: 'email.scan.prefiltro',
      entity_type: scanFornitoreId ? 'fornitore' : 'system',
      entity_id: scanFornitoreId ?? null,
      entity_label: summaryLabel,
      metadata,
    }]).then(() => {}, () => {})
  }

  // Fire push notification when new documents arrive (fire-and-forget)
  if (totalRicevuti > 0 && process.env.NEXT_PUBLIC_SITE_URL && process.env.CRON_SECRET) {
    const pushSedeId = params.filterSedeId ?? params.userSedeId
    fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/push/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.CRON_SECRET}`,
      },
      body: JSON.stringify({
        title: 'Nuovi documenti',
        body: `${totalRicevuti} document${totalRicevuti > 1 ? 'i' : 'o'} da elaborare`,
        url: '/documenti',
        ...(pushSedeId ? { sede_id: pushSedeId } : {}),
      }),
    }).catch(() => {})
  }

  let messaggio: string
  if (totalRicevuti === 0) {
    if (totalSkippedAlready > 0) {
      messaggio =
        `Nessun documento nuovo in coda: ${totalSkippedAlready} ${totalSkippedAlready === 1 ? 'unità (allegato o corpo mail) era già stata elaborata' : 'unità (allegati o corpi mail) erano già state elaborate'} in una sincronizzazione precedente (vedi Log sincronizzazione o Documenti da elaborare).`
    } else {
      messaggio = 'Nessuna nuova email con allegati o testo da elaborare.'
    }
  } else if (totalBozzeCreate > 0) {
    messaggio = `${totalRicevuti} ${totalRicevuti === 1 ? 'documento ricevuto' : 'documenti ricevuti'} — ${totalBozzeCreate} ${totalBozzeCreate === 1 ? 'bozza creata automaticamente' : 'bozze create automaticamente'}. Controlla in Statements → Documenti da Elaborare.`
  } else {
    messaggio = `${totalRicevuti} ${totalRicevuti === 1 ? 'documento ricevuto' : 'documenti ricevuti'} — salvati in Documenti da Elaborare per la revisione.`
  }

  return {
    ricevuti: totalRicevuti,
    ignorate: totalIgnorate,
    bozzeCreate: totalBozzeCreate,
    messaggio,
    ...(avvisi.length > 0 && { avvisi }),
    ...(imapErrorDetails.length > 0 && { imapErrorDetails }),
    mailsFound,
    mailsProcessed,
    attachmentsTotal: attTotalRun,
    attachmentsProcessed: attDoneRun,
    skippedAlreadyCompleted: totalSkippedAlready,
    preFiltered: totalPreFiltered,
  }
}

export async function POST(req: Request) {
  let userSedeId: string | undefined
  let filterSedeId: string | undefined
  let fornitoreId: string | undefined
  let wantStream = false
  let emailSyncScope: 'lookback' | 'fiscal_year' | undefined
  let fiscalYear: number | undefined
  let lookbackDaysOverride: number | undefined
  let documentKind: EmailSyncDocumentKind = 'all'
  try {
    const body = await req.json() as {
      user_sede_id?: string
      filter_sede_id?: string
      fornitore_id?: string
      stream?: boolean
      email_sync_scope?: 'lookback' | 'fiscal_year'
      fiscal_year?: number
      email_sync_lookback_days?: number
      email_sync_document_kind?: string
    }
    userSedeId = body?.user_sede_id ?? undefined
    filterSedeId = body?.filter_sede_id ?? undefined
    fornitoreId = body?.fornitore_id ?? undefined
    wantStream = body?.stream === true
    emailSyncScope = body?.email_sync_scope === 'fiscal_year' ? 'fiscal_year' : body?.email_sync_scope === 'lookback' ? 'lookback' : undefined
    fiscalYear = typeof body?.fiscal_year === 'number' ? body.fiscal_year : undefined
    if (typeof body?.email_sync_lookback_days === 'number' && Number.isFinite(body.email_sync_lookback_days)) {
      const n = Math.floor(body.email_sync_lookback_days)
      if (n >= 1 && n <= 365) lookbackDaysOverride = n
    }
    documentKind = parseEmailSyncDocumentKind(body?.email_sync_document_kind)
  } catch { /* no body */ }

  if (wantStream) {
    const encoder = new TextEncoder()
    const streamOut = new TransformStream()
    const writer = streamOut.writable.getWriter()

    void (async () => {
      const write = async (obj: EmailScanStreamEvent) => {
        await writer.write(encoder.encode(JSON.stringify(obj) + '\n'))
      }
      try {
        await queueEmailScan(async () => {
          await write({ type: 'progress', phase: 'queued', percent: 5, connectionWarning: null })
          const result = await runEmailScanCore({
            userSedeId,
            filterSedeId,
            fornitoreId,
            emailSyncScope,
            fiscalYear,
            lookbackDaysOverride,
            documentKind,
            emit: write,
          })
          await write({
            type: 'done',
            ricevuti: result.ricevuti,
            ignorate: result.ignorate,
            bozzeCreate: result.bozzeCreate,
            skippedAlreadyCompleted: result.skippedAlreadyCompleted,
            messaggio: result.messaggio,
            avvisi: result.avvisi,
            imapErrorDetails: result.imapErrorDetails,
            mailsFound: result.mailsFound,
            mailsProcessed: result.mailsProcessed,
            attachmentsTotal: result.attachmentsTotal,
            attachmentsProcessed: result.attachmentsProcessed,
          })
        })
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Errore sconosciuto'
        console.error('[scan-emails] stream error:', err)
        try {
          await write({ type: 'error', error: message })
        } catch { /* ignore */ }
      } finally {
        try {
          await writer.close()
        } catch { /* ignore */ }
      }
    })()

    return new Response(streamOut.readable, {
      headers: {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    })
  }

  try {
    const result = await queueEmailScan(() =>
      runEmailScanCore({
        userSedeId,
        filterSedeId,
        fornitoreId,
        emailSyncScope,
        fiscalYear,
        lookbackDaysOverride,
        documentKind,
      })
    )
    if (result.avvisi && result.avvisi.length > 0 && result.ricevuti === 0 && result.ignorate === 0) {
      return NextResponse.json({
        ricevuti: 0,
        ignorate: 0,
        bozzeCreate: 0,
        skippedAlreadyCompleted: result.skippedAlreadyCompleted,
        avvisi: result.avvisi,
        messaggio: result.avvisi[0],
        mailsFound: result.mailsFound,
        mailsProcessed: result.mailsProcessed,
        attachmentsTotal: result.attachmentsTotal,
        attachmentsProcessed: result.attachmentsProcessed,
      })
    }
    return NextResponse.json({
      ricevuti: result.ricevuti,
      ignorate: result.ignorate,
      bozzeCreate: result.bozzeCreate,
      skippedAlreadyCompleted: result.skippedAlreadyCompleted,
      messaggio: result.messaggio,
      ...(result.avvisi && result.avvisi.length > 0 && { avvisi: result.avvisi }),
      mailsFound: result.mailsFound,
      mailsProcessed: result.mailsProcessed,
      attachmentsTotal: result.attachmentsTotal,
      attachmentsProcessed: result.attachmentsProcessed,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Errore sconosciuto'
    console.error('[FATAL] Errore inatteso in scan-emails POST:', err)
    const isClient =
      /Fornitore non trovato|Assegnare una sede|Aggiungi almeno un indirizzo/i.test(message)
    return NextResponse.json({ error: message }, { status: isClient ? 400 : 500 })
  }
}
