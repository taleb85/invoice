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
import { resolveFornitoreFromScanEmail } from '@/lib/fornitore-resolve-scan-email'
import { retroactiveCleanupDaRevisionare } from '@/lib/documenti-revisione-auto'
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
  inferPendingDocumentKindForQueueRow,
} from '@/lib/document-bozza-routing'
import { fetchFornitorePendingKindHint, ocrTipoHintKey } from '@/lib/fornitore-doc-type-hints'
import { isFiscalDocumentAttachment } from '@/lib/fiscal-document-attachments'
import { insertEmailAutoBolla, insertEmailAutoFattura } from '@/lib/email-sync-auto-register-core'
import { normalizeTipoDocumento } from '@/lib/ocr-tipo-documento'
import { documentiPublicRefUrl } from '@/lib/documenti-storage-url'
import {
  loadEmailScanBlacklistSet,
  senderMatchesEmailScanBlacklist,
} from '@/lib/email-scan-blacklist'
import { normalizeDocumentoQueueStatoForDb } from '@/lib/documenti-queue-stato'
import {
  computeNextHistoricalChunk,
  historicalProgressLabel,
  inclusiveEndDateFromSliceEndExclusive,
  rollingLookbackSince,
  utcTomorrowStartUtc,
} from '@/lib/historical-email-chunk'
import { recordAiUsage } from '@/lib/ai-usage-log'
import type { GeminiUsage } from '@/lib/gemini-vision'

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
    estrazione_utile:   ocr.estrazione_utile ?? undefined,
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
  const stato = normalizeDocumentoQueueStatoForDb(payload.stato)
  const payloadNorm = { ...payload, stato }
  const { error } = await supabase.from('documenti_da_processare').insert([payloadNorm])

  if (error) {
    // Fallback: colonna 'metadata' non ancora migrata
    if (
      error.code === '42703' ||
      error.message?.includes('metadata') ||
      error.message?.includes('is_statement') ||
      error.message?.includes('note')
    ) {
      console.warn('[INSERT] Colonna extra non trovata — retry senza metadata/is_statement/note')
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { metadata: _sm, is_statement: _sis, note: _sn, ...rest } = payloadNorm as Record<string, unknown>
      const safePayload = { ...rest }
      const statoSafe = normalizeDocumentoQueueStatoForDb(safePayload.stato)
      const { error: e2 } = await supabase
        .from('documenti_da_processare')
        .insert([{ ...safePayload, stato: statoSafe }])
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
  /** Finestra più stretta dei giorni (cron / Forza sync). Priorità su `lookbackDays` se > 0. */
  lookbackHours?: number | null
  /** Se impostato, ha priorità sul lookback; filtra per data messaggio (internal/envelope/parsed). */
  fiscalRange?: { start: Date; endExclusive: Date } | null
  /** Sync storica a chunk mensile: ricerca IMAP `since`/`before` (priorità su lookback fiscal). */
  narrowDateRange?: { start: Date; endExclusive: Date } | null
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
  const { lookbackDays, lookbackHours, fiscalRange, narrowDateRange } = opts
  mailDebugLog(
    `[IMAP] Tentativo di connessione: host=${host} porta=${port} utente=${user} lookback=${lookbackHours != null && lookbackHours > 0 ? `${lookbackHours}h` : lookbackDays ?? 'illimitato'}gg fiscal=${fiscalRange ? 'sì' : 'no'} narrow=${narrowDateRange ? 'sì' : 'no'}`
  )

  let searchCriteria: { since?: Date; before?: Date; all?: boolean }
  if (narrowDateRange) {
    searchCriteria = {
      since: narrowDateRange.start,
      before: narrowDateRange.endExclusive,
    }
  } else if (fiscalRange) {
    searchCriteria = {
      since: fiscalRange.start,
      before: fiscalRange.endExclusive,
    }
  } else {
    const sinceDate =
      lookbackHours != null && lookbackHours > 0
        ? new Date(Date.now() - lookbackHours * 60 * 60 * 1000)
        : lookbackDays && lookbackDays > 0
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
        if (narrowDateRange) {
          if (!msgDate || msgDate < narrowDateRange.start || msgDate >= narrowDateRange.endExclusive) {
            continue
          }
        } else if (fiscalRange) {
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
  sedeFilter?: string,
): Promise<Fornitore | null> {
  mailDebugLog(`[RLS] resolveFornitore: mittente="${senderEmail}" sedeFilter=${sedeFilter ?? 'nessuno'} (solo rubrica registrata)`)
  const resolved = await resolveFornitoreFromScanEmail(supabase, senderEmail, sedeFilter ?? null)
  if (resolved) {
    mailDebugLog(`[RLS] trovato via rubrica registrata: ${resolved.nome} (${resolved.id})`)
  } else {
    mailDebugLog(`[RLS] fornitore NON trovato per "${senderEmail}"`)
  }
  return resolved
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
  const logGeminiUsage = (usage: GeminiUsage) => {
    void recordAiUsage(supabase, {
      sede_id: logSedeId,
      tipo: 'ocr_scan_email_body',
      usage,
    })
  }
  try {
    return await ocrInvoiceFromEmailBody(body, langHint, { logContext, onUsage: logGeminiUsage })
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
  const logGeminiUsage = (usage: GeminiUsage) => {
    void recordAiUsage(supabase, {
      sede_id: logSedeId,
      tipo: 'ocr_scan_email',
      usage,
    })
  }
  try {
    return await ocrInvoice(buf, contentType, langHint, {
      logContext,
      emailBodyText: email.bodyText ?? null,
      onUsage: logGeminiUsage,
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
  /** Mittenti in blacklist sede: nessun OCR / log / Gemini. */
  blacklistSkipped: number
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

  const docKind = options?.documentKind ?? 'all'
  const onlyUnknownSenders = docKind === 'fornitore' && !options?.directFornitore

  // La sede effettiva da usare: priorità sedeFilter (per-sede IMAP) → fallbackSedeId (global IMAP)
  const effectiveSede = sedeFilter ?? fallbackSedeId ?? null

  const blacklistSet =
    effectiveSede ? await loadEmailScanBlacklistSet(supabase, effectiveSede) : new Set<string>()
  const workEmails =
    blacklistSet.size === 0
      ? emails
      : emails.filter((e) => !senderMatchesEmailScanBlacklist(blacklistSet, e.from))
  const blacklistSkipped = emails.length - workEmails.length

  const attachmentsTotal = countScanEmailUnits(workEmails)
  let attachmentsProcessed = 0
  const unitsPerUid = new Map<number, number>()
  const unitsDonePerUid = new Map<number, number>()
  for (const e of workEmails) {
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

  mailDebugLog(
    `[PROCESS] Inizio processEmails: ${emails.length} email (${blacklistSkipped} blacklist) → ${workEmails.length} da elaborare; sedeFilter=${sedeFilter ?? 'nessuno'} fallback=${fallbackSedeId ?? 'nessuno'} effective=${effectiveSede ?? 'NULL'} documentKind=${docKind}`,
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
    for (const email of workEmails) {
      for (const attachment of email.attachments) {
        g.items.push({ email, attachment })
      }
      if (!email.attachments.length && emailHasScannableBody(email)) {
        g.items.push({ email, attachment: null })
      }
    }
    mailDebugLog(`[PROCESS] Fase 1 (fornitore mirato): ${workEmails.length} email → fornitore "${direct.nome}"`)
  } else {
    for (const email of workEmails) {
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
          mailDebugLog(`[PROCESS] ⚠️  Solo testo, fornitore non trovato per "${email.from}" — estrazione corpo email`)
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

  // ── Mittenti sconosciuti: OCR → salva da_revisionare (mittente_sconosciuto), niente match sul documento ─────
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

      mailDebugLog(`[PROCESS] Mittente sconosciuto "${email.from}" — OCR in corso (nessun fallback fornitore sul documento)`)

      const baseMimeU = (attachment.contentType ?? '').split(';')[0].trim().toLowerCase()
      if (baseMimeU === 'text/plain') {
        mailDebugLog(`[PROCESS] Allegato solo text/plain ignorato (nessun OCR Vision): ${attachment.filename ?? '(file)'}`)
        bumpAttach(email.uid)
        continue
      }

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

      // 3a. Dati solo da testo → documento sintetico [DA TESTO EMAIL]
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
          stato:          'da_revisionare',
          metadata:       {
            ...buildMetadata(ocr, 'unknown'),
            mittente_sconosciuto: true,
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

      // 3b. Upload allegato + salva come sconosciuto (mittente_sconosciuto)
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
        stato:          'da_revisionare',
        metadata:       {
          ...buildMetadata(ocr, 'unknown'),
          mittente_sconosciuto: true,
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

  // ── Mittenti sconosciuti, solo corpo mail: salva da_revisionare, niente match sul testo OCR ───────────────
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
      stato:          'da_revisionare',
      metadata:       {
        ...buildMetadata(ocr, 'unknown'),
        mittente_sconosciuto: true,
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

      const baseMimeGrp = attachment ? (attachment.contentType ?? '').split(';')[0].trim().toLowerCase() : ''
      if (attachment && baseMimeGrp === 'text/plain') {
        mailDebugLog(`[PROCESS] Allegato text/plain ignorato per "${fornitore.nome}": ${attachment.filename ?? ''}`)
        bumpAttach(email.uid)
        continue
      }

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

      const isStatementEmail = emailSubjectLooksLikeStatement(email.subject)
      const isStatementDoc = effectivePendingKind === 'statement'

      let registratoAutoFatturaId: string | null = null
      let registratoAutoBollaId: string | null = null
      let duplicateSkippedFatturaId: string | null = null
      let needsDocRevision = false

      const skipAutoBozza = treatAsStatement || effectivePendingKind === 'ordine'

      const ocrMetaForInfer = {
        ragione_sociale: ocr.ragione_sociale,
        note_corpo_mail: ocr.note_corpo_mail,
        tipo_documento: ocr.tipo_documento ?? null,
        numero_fattura: ocr.numero_fattura,
        totale_iva_inclusa: ocr.totale_iva_inclusa ?? null,
      }

      const suggestedPendingKind: 'fattura' | 'bolla' =
        effectivePendingKind === 'fattura' || effectivePendingKind === 'bolla'
          ? effectivePendingKind
          : normalizeTipoDocumento(ocr.tipo_documento) === 'bolla'
            ? 'bolla'
            : 'fattura'

      if (fornitore.id && documentSedeId && !skipAutoBozza) {
        const dataDocLocal = safeDate(ocr.data_fattura) ?? new Date().toISOString().slice(0, 10)
        const inferredKind = inferPendingDocumentKindForQueueRow({
          oggetto_mail: email.subject,
          file_name: storedFileName,
          metadata: ocrMetaForInfer,
        })

        let targetKind: 'fattura' | 'bolla' | null = null
        if (docKind === 'fattura') targetKind = 'fattura'
        else if (docKind === 'bolla') targetKind = 'bolla'
        else if (inferredKind === 'fattura') targetKind = 'fattura'
        else if (inferredKind === 'bolla') targetKind = 'bolla'
        else targetKind = null

        if (targetKind === 'fattura') {
          const res = await insertEmailAutoFattura(supabase, {
            fornitoreId: fornitore.id,
            sedeId: documentSedeId,
            dataDoc: dataDocLocal,
            fileUrl: file_url,
            meta: { numero_fattura: ocr.numero_fattura, totale_iva_inclusa: ocr.totale_iva_inclusa },
          })
          if ('id' in res) {
            registratoAutoFatturaId = res.id
            bozzaCreate++
            mailDebugLog(`[AUTO] ✅ Fattura registrata: id=${res.id}`)
            const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '') || 'http://localhost:3000'
            fetch(`${baseUrl}/api/price-anomalies/check`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(process.env.CRON_SECRET ? { Authorization: `Bearer ${process.env.CRON_SECRET}` } : {}),
              },
              body: JSON.stringify({ fattura_id: res.id, fornitore_id: fornitore.id }),
            }).catch(() => {})
          } else if ('duplicateId' in res) {
            duplicateSkippedFatturaId = res.duplicateId
            needsDocRevision = true
            mailDebugLog(`[AUTO] ⚠️ Fattura già esistente (id=${res.duplicateId}) — in coda revisione`)
          } else if ('error' in res) {
            console.warn(`[AUTO] Fattura non registrata: ${res.error}`)
          }
        } else if (targetKind === 'bolla') {
          const numRef = ocr.numero_fattura?.trim() || null
          const rb = await insertEmailAutoBolla(supabase, {
            fornitoreId: fornitore.id,
            sedeId: documentSedeId,
            dataDoc: dataDocLocal,
            fileUrl: file_url,
            numeroBolla: numRef,
            importo: ocr.totale_iva_inclusa ?? null,
          })
          if ('id' in rb) {
            registratoAutoBollaId = rb.id
            bozzaCreate++
            mailDebugLog(`[AUTO] ✅ Bolla registrata (in attesa fattura): id=${rb.id}`)
          }
        } else {
          needsDocRevision = true
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

      const pendingKindStored =
        needsDocRevision && duplicateSkippedFatturaId
          ? ('fattura' as const)
          : needsDocRevision
            ? suggestedPendingKind
            : effectivePendingKind

      const metadata = {
        ...buildMetadata(ocr, matchedBy),
        ...(isSyntheticBodyDoc ? { origine_testo_email: true } : {}),
        ...(pendingKindStored ? { pending_kind: pendingKindStored } : {}),
        ...(duplicateSkippedFatturaId ? { duplicate_skipped_fattura_id: duplicateSkippedFatturaId } : {}),
        ...(registratoAutoFatturaId || registratoAutoBollaId ? { salvato_automaticamente: true as const } : {}),
        ...(fornitore.rekki_link?.trim()
          ? { rekki_link: fornitore.rekki_link.trim() }
          : {}),
        ...(fornitore.rekki_supplier_id?.trim()
          ? { rekki_supplier_id: fornitore.rekki_supplier_id.trim() }
          : {}),
        ...(earlyRekkiLines.length ? { rekki_lines: earlyRekkiLines } : {}),
      }

      const rowStato:
        | 'associato'
        | 'da_associare'
        | 'da_revisionare' =
        isStatementEmail
          ? 'associato'
          : skipAutoBozza
            ? 'da_associare'
            : registratoAutoFatturaId || registratoAutoBollaId
              ? 'associato'
              : needsDocRevision
                ? 'da_revisionare'
                : 'da_associare'

      const knownPayload = {
        fornitore_id:   fornitore.id,
        sede_id:        documentSedeId,
        mittente:       email.from || 'sconosciuto',
        oggetto_mail:   email.subject ?? null,
        file_url,
        file_name:      storedFileName,
        content_type:   storedContentType,
        data_documento: safeDate(ocr.data_fattura),
        stato:          rowStato,
        is_statement:   isStatementDoc,
        metadata,
        note:           noteFromEmailBody,
        ...(registratoAutoFatturaId ? { fattura_id: registratoAutoFatturaId } : {}),
        ...(registratoAutoBollaId ? { bolla_id: registratoAutoBollaId } : {}),
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
        mailDebugLog(
          `[PROCESS] ✅ Documento salvato per "${fornitore.nome}" | stato=${rowStato} | autoFatt=${registratoAutoFatturaId ?? '—'} autoBolla=${registratoAutoBollaId ?? '—'} | sede=${documentSedeId ?? 'NULL'}`,
        )
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
    `[PROCESS] Fine processEmails: ricevuti=${ricevuti} ignorate=${ignorate} bozzeCreate=${bozzaCreate} skippedAlready=${skippedAlreadyCompleted} preFiltered=${preFiltered} blacklistSkipped=${blacklistSkipped}`,
  )
  return {
    ricevuti,
    ignorate,
    bozzaCreate,
    attachmentsTotal,
    attachmentsProcessed,
    skippedAlreadyCompleted,
    preFiltered,
    blacklistSkipped,
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
  const ocr = await ocrStatement(buffer, contentType, undefined, {
    onUsage: usage =>
      void recordAiUsage(supabase, {
        sede_id: sedeId,
        tipo: 'ocr_statement',
        usage,
      }),
  })
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

/** Stessa coda della GET `/api/scan-emails` (cron `sync-emails`, test). Default `imapSyncMode`: `auto` (finestra 3h). */
export async function runEmailSyncForAllSedi(opts?: { imapSyncMode?: ImapSyncMode }) {
  return queueEmailScan(() =>
    runEmailScanCore({ imapSyncMode: opts?.imapSyncMode ?? 'auto' }),
  )
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET non configurato' }, { status: 500 })

  const authHeader = (req as Request & { headers: Headers }).headers.get('authorization')
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
  }

  try {
    const result = await runEmailSyncForAllSedi({ imapSyncMode: 'auto' })
    if (result.avvisi && result.avvisi.length > 0 && result.ricevuti === 0 && result.ignorate === 0) {
      return NextResponse.json({
        ricevuti: 0,
        ignorate: 0,
        bozzeCreate: 0,
        skippedAlreadyCompleted: result.skippedAlreadyCompleted,
        preFiltered: result.preFiltered,
        blacklistSkipped: result.blacklistSkipped,
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
      blacklistSkipped: result.blacklistSkipped,
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

export type ImapSyncMode = 'auto' | 'manual' | 'historical'

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
  /**
   * Finestra ricerca IMAP in scope lookback: `auto`=3h (cron), `manual`=24h (Forza sync),
   * `historical`=override giorni / `imap_lookback_days` sede.
   */
  imapSyncMode?: ImapSyncMode
  /** Un solo mese (o frazione) per una sede — sync storica a chunk (evita timeout Vercel). */
  historicalNarrowChunk?: {
    sedeId: string
    rangeStartInclusive: Date
    rangeEndExclusive: Date
  }
}

function resolveSedeImapLookbackWindow(p: {
  imapSyncMode: ImapSyncMode | undefined
  emailSyncScope: 'lookback' | 'fiscal_year'
  sedeFiscalRange: { start: Date; endExclusive: Date } | null
  lookbackDaysOverride: number | undefined
  sedeImapLookbackDays: number | null | undefined
}): { lookbackDays: number | null; lookbackHours: number | null } {
  if (p.sedeFiscalRange) return { lookbackDays: null, lookbackHours: null }
  if (p.emailSyncScope !== 'lookback') return { lookbackDays: null, lookbackHours: null }
  const mode = p.imapSyncMode ?? 'historical'
  if (mode === 'auto') return { lookbackDays: null, lookbackHours: 3 }
  if (mode === 'manual') return { lookbackDays: null, lookbackHours: 24 }
  const days =
    p.lookbackDaysOverride !== undefined
      ? p.lookbackDaysOverride
      : p.sedeImapLookbackDays != null && p.sedeImapLookbackDays > 0
        ? p.sedeImapLookbackDays
        : null
  return { lookbackDays: days, lookbackHours: null }
}

function resolveGlobalImapLookbackWindow(p: {
  imapSyncMode: ImapSyncMode | undefined
  emailSyncScope: 'lookback' | 'fiscal_year'
  globalFiscalRange: { start: Date; endExclusive: Date } | null
  lookbackDaysOverride: number | undefined
}): { lookbackDays: number | null; lookbackHours: number | null } {
  if (p.globalFiscalRange) return { lookbackDays: null, lookbackHours: null }
  if (p.emailSyncScope !== 'lookback') return { lookbackDays: null, lookbackHours: null }
  const mode = p.imapSyncMode ?? 'historical'
  if (mode === 'auto') return { lookbackDays: null, lookbackHours: 3 }
  if (mode === 'manual') return { lookbackDays: null, lookbackHours: 24 }
  const days = p.lookbackDaysOverride !== undefined ? p.lookbackDaysOverride : null
  return { lookbackDays: days, lookbackHours: null }
}

function parseImapSyncMode(raw: unknown): ImapSyncMode | undefined {
  return raw === 'auto' || raw === 'manual' || raw === 'historical' ? raw : undefined
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
  /** Email saltate (mittente in blacklist sede) — nessun OCR né log. */
  blacklistSkipped: number
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
  let totalBlacklistSkipped = 0
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
    .select(
      'id, nome, imap_host, imap_port, imap_user, imap_password, imap_lookback_days, country_code, imap_sync_checkpoint',
    )
    .not('imap_host', 'is', null)
    .not('imap_user', 'is', null)
    .not('imap_password', 'is', null)

  if (params.historicalNarrowChunk?.sedeId) {
    sediQuery = sediQuery.eq('id', params.historicalNarrowChunk.sedeId) as typeof sediQuery
  } else if (filterSedeId) {
    sediQuery = sediQuery.eq('id', filterSedeId) as typeof sediQuery
    mailDebugLog(`[SCAN] filter_sede_id=${filterSedeId}`)
  }

  const { data: sedi, error: sediErr } = await sediQuery

  mailDebugLog(`[DB] Sedi con IMAP: ${sedi?.length ?? 0}${sediErr ? ` errore="${sediErr.message}"` : ''}`)

  /** Prima di IMAP: sblocca documenti da_revisionare se il mittente è stato aggiunto alla rubrica da ultimo ciclo. */
  const retroSedeFilter = filterSedeId ?? null
  try {
    const cleanup = await retroactiveCleanupDaRevisionare(supabase, { sedeId: retroSedeFilter, maxRows: 120 })
    mailDebugLog(
      `[CLEANUP] da_revisionare retroattivo: scanned=${cleanup.scanned} processed=${cleanup.processed} errors=${cleanup.errors.length}`,
    )
    if (cleanup.processed > 0 || cleanup.scanned > 0 || cleanup.errors.length > 0) {
      const logCleanupSede = retroSedeFilter ?? params.userSedeId ?? null
      void supabase.from('activity_log').insert([
        {
          user_id: null,
          sede_id: logCleanupSede,
          action: 'email.scan.revisione_cleanup',
          entity_type: 'system',
          entity_id: null,
          entity_label: `Cleanup coda revisione: ${cleanup.processed} processati / ${cleanup.scanned} esaminati`,
          metadata: {
            processed: cleanup.processed,
            scanned: cleanup.scanned,
            error_sample: cleanup.errors.slice(0, 12),
          },
        },
      ]).then(() => {}, () => {})
    }
  } catch (e) {
    console.warn('[CLEANUP] retroactiveCleanupDaRevisionare', e)
  }

  const skipGlobalImap = !!params.fornitoreId || !!filterSedeId || !!params.historicalNarrowChunk

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
    blacklistSkipped: totalBlacklistSkipped,
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
        const sedeLb = resolveSedeImapLookbackWindow({
          imapSyncMode: params.imapSyncMode,
          emailSyncScope,
          sedeFiscalRange,
          lookbackDaysOverride: lookbackOverride,
          sedeImapLookbackDays: sede.imap_lookback_days,
        })
        const hn = params.historicalNarrowChunk
        const emails = await fetchFromImap(
          sede.imap_host,
          sede.imap_port ?? 993,
          sede.imap_user,
          sede.imap_password,
          hn?.sedeId === sede.id && hn
            ? {
                lookbackDays: null,
                lookbackHours: null,
                fiscalRange: null,
                narrowDateRange: {
                  start: hn.rangeStartInclusive,
                  endExclusive: hn.rangeEndExclusive,
                },
              }
            : {
                lookbackDays: sedeFiscalRange ? null : sedeLb.lookbackDays,
                lookbackHours: sedeFiscalRange ? null : sedeLb.lookbackHours,
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
        mailsFound += batchMails

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
          let blacklistBatch = 0
          try {
            const batchAtt = countScanEmailUnits(syncKindFiltered)
            const out = await processEmails(supabase, syncKindFiltered, sede.id, undefined, {
              directFornitore: directFornitore ?? undefined,
              onEmailFullyProcessed: () => {
                emailsDoneInBatch++
              },
              onAttachmentProgress: batchAtt > 0 ? onAttachmentProgress : undefined,
              documentKind: effectiveDocKind,
            })
            blacklistBatch = out.blacklistSkipped
            attTotalRun += out.attachmentsTotal
            peDone = out.attachmentsProcessed
            totalRicevuti += out.ricevuti
            totalIgnorate += out.ignorate
            totalBozzeCreate += out.bozzaCreate
            totalSkippedAlready += out.skippedAlreadyCompleted
            totalPreFiltered += out.preFiltered
            totalBlacklistSkipped += out.blacklistSkipped
          } finally {
            clearInterval(processHb)
          }

          attDoneRun += peDone
          attDoneLive = Math.max(attDoneLive, attDoneRun)
          mailsProcessed += batchMails - blacklistBatch
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
        if (params.historicalNarrowChunk?.sedeId === sede.id) throw err
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
      const gLb = resolveGlobalImapLookbackWindow({
        imapSyncMode: params.imapSyncMode,
        emailSyncScope,
        globalFiscalRange,
        lookbackDaysOverride: lookbackOverride,
      })
      const emails = await fetchUnseenEmails(globalHooks, globalFiscalRange, gLb.lookbackDays, gLb.lookbackHours)
      const filtered = supplierScope
        ? emails.filter((e) => emailMatchesSupplierScope(e.from, supplierScope!))
        : emails
      const syncKindFiltered = filterEmailsForSyncDocumentKind(filtered, effectiveDocKind)
      const batchMails = syncKindFiltered.length
      mailsFound += batchMails

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
        let blacklistGlobal = 0
        try {
          const batchAtt = countScanEmailUnits(syncKindFiltered)
          const out = await processEmails(supabase, syncKindFiltered, undefined, systemFallbackSedeId, {
            directFornitore: directFornitore ?? undefined,
            onEmailFullyProcessed: () => {
              emailsDoneInBatch++
            },
            onAttachmentProgress: batchAtt > 0 ? onAttachmentProgress : undefined,
            documentKind: effectiveDocKind,
          })
          blacklistGlobal = out.blacklistSkipped
          attTotalRun += out.attachmentsTotal
          peDoneGlobal = out.attachmentsProcessed
          totalRicevuti += out.ricevuti
          totalIgnorate += out.ignorate
          totalBozzeCreate += out.bozzaCreate
          totalSkippedAlready += out.skippedAlreadyCompleted
          totalPreFiltered += out.preFiltered
          totalBlacklistSkipped += out.blacklistSkipped
        } finally {
          clearInterval(processHbGlobal)
        }

        attDoneRun += peDoneGlobal
        attDoneLive = Math.max(attDoneLive, attDoneRun)
        mailsProcessed += batchMails - blacklistGlobal
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
    `\n[FINE] totale ricevuti=${totalRicevuti} ignorate=${totalIgnorate} bozzeCreate=${totalBozzeCreate} skippedAlready=${totalSkippedAlready} preFiltered=${totalPreFiltered} blacklistSkipped=${totalBlacklistSkipped} avvisi=${avvisi.length}`,
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
    messaggio = `${totalRicevuti} ${totalRicevuti === 1 ? 'documento ricevuto' : 'documenti ricevuti'} — ${totalBozzeCreate} ${totalBozzeCreate === 1 ? 'documento registrato automaticamente dall’OCR email' : 'documenti registrati automaticamente dall’OCR email'}. Solo i documenti in «Da confermare» richiedono un passaggio manuale.`
  } else {
    messaggio = `${totalRicevuti} ${totalRicevuti === 1 ? 'documento ricevuto' : 'documenti ricevuti'} — salvati in Documenti da Elaborare per la revisione.`
  }

  if (totalBlacklistSkipped > 0) {
    messaggio += ` ${totalBlacklistSkipped} email skippate (blacklist).`
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
    blacklistSkipped: totalBlacklistSkipped,
  }
}

function resolveHistoricalLookbackDaysForSede(
  lookbackOverride: number | undefined,
  sedeImapLookbackDays: number | null | undefined,
): number {
  if (lookbackOverride !== undefined) return lookbackOverride
  if (sedeImapLookbackDays != null && sedeImapLookbackDays > 0) return sedeImapLookbackDays
  return 365
}

type HistoricalIncrementalResult = {
  done: boolean
  checkpoint?: string
  processed?: number
  ricevuti: number
  ignorate: number
  bozzeCreate?: number
  messaggio?: string
  progressLabel?: string
  sede_id?: string
  sede_nome?: string | null
  skippedAlreadyCompleted?: number
  preFiltered?: number
  blacklistSkipped?: number
  mailsFound?: number
  mailsProcessed?: number
  attachmentsTotal?: number
  attachmentsProcessed?: number
  avvisi?: string[]
}

async function runHistoricalIncrementalScan(params: {
  userSedeId?: string
  filterSedeId?: string
  lookbackDaysOverride?: number
  documentKind: EmailSyncDocumentKind
  /** es. Accept-Language / navigator.language per etichetta periodo nei JSON */
  progressLocale?: string
}): Promise<HistoricalIncrementalResult> {
  const supabase = createServiceClient()

  let q = supabase
    .from('sedi')
    .select('id, nome, imap_sync_checkpoint, imap_lookback_days, imap_host, imap_user, imap_password')
    .not('imap_host', 'is', null)
    .not('imap_user', 'is', null)
    .not('imap_password', 'is', null)
    .order('id')

  if (params.filterSedeId) q = q.eq('id', params.filterSedeId) as typeof q
  else if (params.userSedeId) q = q.eq('id', params.userSedeId) as typeof q

  const { data: sediRows, error } = await q
  if (error) throw new Error(error.message)
  if (!sediRows?.length) {
    return { done: true, ricevuti: 0, ignorate: 0, messaggio: 'Nessuna sede con IMAP configurato.' }
  }

  type SedeRow = {
    id: string
    nome: string | null
    imap_sync_checkpoint?: string | null
    imap_lookback_days?: number | null
  }

  const overallEndExclusive = utcTomorrowStartUtc()
  const lbOverride = params.lookbackDaysOverride

  for (const raw of sediRows) {
    const sede = raw as SedeRow
    const lookbackDays = resolveHistoricalLookbackDaysForSede(lbOverride, sede.imap_lookback_days)
    const rollingStart = rollingLookbackSince(lookbackDays)
    const cpRaw = sede.imap_sync_checkpoint
    const cp =
      typeof cpRaw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(cpRaw)
        ? cpRaw
        : typeof cpRaw === 'string' && cpRaw.length >= 10
          ? cpRaw.slice(0, 10)
          : null

    const chunk = computeNextHistoricalChunk(cp, rollingStart, overallEndExclusive)
    if (!chunk) continue

    const result = await runEmailScanCore({
      userSedeId: params.userSedeId,
      filterSedeId: sede.id,
      emailSyncScope: 'lookback',
      lookbackDaysOverride: lbOverride,
      documentKind: params.documentKind,
      imapSyncMode: 'historical',
      historicalNarrowChunk: {
        sedeId: sede.id,
        rangeStartInclusive: chunk.sliceStartInclusive,
        rangeEndExclusive: chunk.sliceEndExclusive,
      },
    })

    const checkpointIso = inclusiveEndDateFromSliceEndExclusive(chunk.sliceEndExclusive)
    const { error: upErr } = await supabase
      .from('sedi')
      .update({ imap_sync_checkpoint: checkpointIso })
      .eq('id', sede.id)
    if (upErr) console.error('[historical] checkpoint update:', upErr.message)

    const processed = result.ricevuti + result.ignorate
    const progressLabel = historicalProgressLabel(
      chunk.sliceStartInclusive,
      params.progressLocale ?? 'it-IT',
    )

    const stillPending = sediRows.some((row) => {
      const r = row as SedeRow
      const effectiveCp =
        r.id === sede.id
          ? checkpointIso
          : typeof r.imap_sync_checkpoint === 'string' && r.imap_sync_checkpoint.length >= 10
            ? r.imap_sync_checkpoint.slice(0, 10)
            : typeof r.imap_sync_checkpoint === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.imap_sync_checkpoint)
              ? r.imap_sync_checkpoint
              : null
      const lb = resolveHistoricalLookbackDaysForSede(lbOverride, r.imap_lookback_days)
      const rs = rollingLookbackSince(lb)
      const normalizedCp =
        effectiveCp && /^\d{4}-\d{2}-\d{2}$/.test(effectiveCp) ? effectiveCp : null
      return computeNextHistoricalChunk(normalizedCp, rs, overallEndExclusive) !== null
    })

    const doneFlag = !stillPending

    return {
      done: doneFlag,
      checkpoint: checkpointIso,
      processed,
      progressLabel,
      sede_id: sede.id,
      sede_nome: sede.nome ?? null,
      ricevuti: result.ricevuti,
      ignorate: result.ignorate,
      bozzeCreate: result.bozzeCreate,
      messaggio: doneFlag ? result.messaggio : undefined,
      ...(result.avvisi && result.avvisi.length > 0 && { avvisi: result.avvisi }),
      skippedAlreadyCompleted: result.skippedAlreadyCompleted,
      preFiltered: result.preFiltered,
      blacklistSkipped: result.blacklistSkipped,
      mailsFound: result.mailsFound,
      mailsProcessed: result.mailsProcessed,
      attachmentsTotal: result.attachmentsTotal,
      attachmentsProcessed: result.attachmentsProcessed,
    }
  }

  return { done: true, ricevuti: 0, ignorate: 0, messaggio: 'Cronologia già elaborata.' }
}

export async function POST(req: Request) {
  let userSedeId: string | undefined
  let filterSedeId: string | undefined
  let fornitoreId: string | undefined
  let wantStream = false
  let emailSyncScope: 'lookback' | 'fiscal_year' | undefined
  let fiscalYear: number | undefined
  let lookbackDaysOverride: number | undefined
  let clientLocale: string | undefined
  let documentKind: EmailSyncDocumentKind = 'all'
  /** Default POST: `historical` (giorni sede / override). */
  let imapSyncMode: ImapSyncMode = 'historical'
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
      client_locale?: string
      mode?: unknown
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
    const parsedMode = parseImapSyncMode(body?.mode)
    if (parsedMode) imapSyncMode = parsedMode
    if (typeof body?.client_locale === 'string' && body.client_locale.trim().length > 0) {
      clientLocale = body.client_locale.trim().slice(0, 32)
    }
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
            imapSyncMode,
            emit: write,
          })
          await write({
            type: 'done',
            ricevuti: result.ricevuti,
            ignorate: result.ignorate,
            bozzeCreate: result.bozzeCreate,
            skippedAlreadyCompleted: result.skippedAlreadyCompleted,
            preFiltered: result.preFiltered,
            blacklistSkipped: result.blacklistSkipped,
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
    const scopeEffective = emailSyncScope ?? 'lookback'
    if (
      !wantStream &&
      imapSyncMode === 'historical' &&
      !fornitoreId &&
      scopeEffective === 'lookback'
    ) {
      const inc = await queueEmailScan(() =>
        runHistoricalIncrementalScan({
          userSedeId,
          filterSedeId,
          lookbackDaysOverride,
          documentKind,
          progressLocale: clientLocale ?? 'it-IT',
        }),
      )
      return NextResponse.json(inc)
    }

    const result = await queueEmailScan(() =>
      runEmailScanCore({
        userSedeId,
        filterSedeId,
        fornitoreId,
        emailSyncScope,
        fiscalYear,
        lookbackDaysOverride,
        documentKind,
        imapSyncMode,
      }),
    )
    if (result.avvisi && result.avvisi.length > 0 && result.ricevuti === 0 && result.ignorate === 0) {
      return NextResponse.json({
        ricevuti: 0,
        ignorate: 0,
        bozzeCreate: 0,
        skippedAlreadyCompleted: result.skippedAlreadyCompleted,
        preFiltered: result.preFiltered,
        blacklistSkipped: result.blacklistSkipped,
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
      blacklistSkipped: result.blacklistSkipped,
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
