#!/usr/bin/env node
/**
 * Audit OCR — confronta dati consolidati in DB vs pipeline Gemini aggiornata
 * (Structured Output + Sharp preprocessing).
 *
 * Per ciascun record in `fatture` e/o `bolle` con allegato:
 *   1. Scarica il file dal bucket "documenti" via Supabase Storage (service role).
 *   2. Pre-processa le immagini con Sharp (resize max 2000px, JPEG q80, rotazione EXIF).
 *   3. Invia il documento a Gemini Vision con Structured Output (stesso schema di OCR_INVOICE_SCHEMA).
 *   4. Confronta numero documento e importo (tolleranza ±0.05 €).
 *   5. Emette log per ogni file e salva i risultati in audit-report.json.
 *
 * Uso:
 *   node scripts/audit-processed-ocr.mjs [opzioni]
 *
 * Opzioni:
 *   --table=fatture|bolle|all    Tabella da auditare (default: all)
 *   --sede-id=<uuid>             Filtra per sede specifica
 *   --limit=N                    Massimo N record per tabella (default: illimitato)
 *   --fornitore-id=<uuid>        Filtra per fornitore specifico
 *   --only-anomalie              Includi in audit-report.json solo le anomalie
 *   --dry-run                    Analizza senza scrivere audit-report.json
 *   -h, --help                   Mostra questo aiuto
 *
 * Prerequisiti in .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL     (oppure SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY
 *   GEMINI_API_KEY
 *   GEMINI_MODEL                 (opzionale, default: gemini-2.5-flash-lite)
 */

import { readFileSync, existsSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

// ─── Costanti allineate al codebase TypeScript ────────────────────────────────

/** Bucket Supabase Storage (da src/lib/documenti-storage-url.ts). */
const STORAGE_BUCKET = 'documenti'

/** Tolleranza importo (da src/lib/triple-check.ts TRIPLE_CHECK_TOLERANCE). */
const AMOUNT_TOLERANCE = 0.05

/** Modello Gemini (override via GEMINI_MODEL, allineato a src/lib/gemini-vision.ts). */
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash-lite'

/** Max lato lungo immagine prima del resize (da src/lib/ocr-invoice-vision-prepare.ts). */
const VISION_MAX_LONG_EDGE_PX = 2000

/** Qualità JPEG output Sharp. */
const VISION_JPEG_QUALITY = 80

/**
 * Structured Output schema — allineato a OCR_INVOICE_SCHEMA in gemini-vision.ts.
 * Usa valori stringa invece di SchemaType enum per compatibilità ESM pura.
 */
const OCR_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    ragione_sociale:      { type: 'STRING', nullable: true },
    p_iva:                { type: 'STRING', nullable: true },
    indirizzo:            { type: 'STRING', nullable: true },
    data_fattura:         { type: 'STRING', nullable: true },
    numero_fattura:       { type: 'STRING', nullable: true },
    tipo_documento: {
      type: 'STRING',
      nullable: true,
      enum: ['fattura', 'nota_credito', 'bolla_ddt', 'ordine', 'estratto_conto', 'comunicazione', null],
    },
    promessa_invio_documento: { type: 'BOOLEAN', nullable: true },
    totale_iva_inclusa:   { type: 'NUMBER', nullable: true },
    note_corpo_mail:      { type: 'STRING', nullable: true },
    estrazione_utile:     { type: 'BOOLEAN', nullable: true },
    importo_raw:          { type: 'STRING', nullable: true },
  },
  required: ['ragione_sociale', 'p_iva', 'data_fattura', 'numero_fattura', 'tipo_documento', 'totale_iva_inclusa'],
}

/** System prompt OCR — estratto sintetico di buildSystemPrompt() in ocr-invoice.ts. */
const OCR_SYSTEM_PROMPT = `You are a universal fiscal document parser for invoices, delivery notes, and commercial documents.
Return ONLY valid JSON matching the schema exactly — no markdown, no code fences, no extra text.

Fields:
- ragione_sociale: legal issuer/seller name (Cedente/Prestatore on EU invoices, upper-right block), NOT the buyer. null if absent.
- p_iva: supplier VAT digits only, no country prefix. null if absent.
- indirizzo: supplier registered address as a single line. null if absent.
- data_fattura: document issue date in YYYY-MM-DD. null if absent.
- numero_fattura: invoice/DDT/document reference number only (no label text). null if absent.
- tipo_documento: exactly one of: fattura | nota_credito | bolla_ddt | ordine | estratto_conto | comunicazione | null
- promessa_invio_documento: false unless email-body-only promises a fiscal document and no attachment is being analysed.
- totale_iva_inclusa: gross total amount as a NUMBER (float). null if absent.
- importo_raw: raw amount string as printed (e.g. "1.234,56"). null if absent.
- note_corpo_mail: null for document attachments.
- estrazione_utile: true if any business-relevant data was extracted; false only for blank/unreadable documents.

Rules:
- For tipo_documento: use fattura for tax invoices with VAT lines/totals; bolla_ddt for transport/delivery docs without full invoice structure; estratto_conto for account/bank statements; comunicazione for conversational email text or CVs.
- Always use the EU/Italian issuer layout: seller (Cedente) is typically upper-right with VAT; buyer is upper-left. ragione_sociale = seller, not buyer.
- If a field is absent, return null.`

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Carica variabili da .env.local senza sovrascrivere quelle già presenti. */
function loadEnvLocal() {
  const p = resolve(ROOT, '.env.local')
  if (!existsSync(p)) return
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq < 1) continue
    const key = t.slice(0, eq).trim()
    let val = t.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = val
  }
}

/**
 * Estrae bucket e objectPath da un URL Supabase Storage.
 * Gestisce /public/, /sign/ e /authenticated/ come in ai-analyze.mjs.
 */
function parseStorageUrl(fileUrl) {
  try {
    const u = new URL(fileUrl)
    const m =
      u.pathname.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+)$/)
    if (m) return { bucket: m[1], objectPath: decodeURIComponent(m[2].split('?')[0]) }
    return null
  } catch {
    return null
  }
}

/** Inferisce MIME type dai magic bytes (allineato a inferContentTypeFromBuffer in fix-ocr-dates-helpers.ts). */
function inferMimeFromBuffer(buf) {
  if (buf.length < 12) return null
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png'
  if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) return 'application/pdf'
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return 'image/gif'
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp'
  return null
}

/**
 * Pre-processing immagini con Sharp — allineato a prepareImageBufferForVision()
 * in src/lib/ocr-invoice-vision-prepare.ts.
 * Ridimensiona al lato lungo max 2000px, ruota via EXIF, forza JPEG q80.
 * Ritorna il buffer originale su errore (graceful fallback).
 */
async function prepareImageBuffer(buf, mimeType) {
  if (!mimeType.startsWith('image/')) return { buffer: buf, mimeType }
  try {
    const sharp = (await import('sharp')).default
    let pipeline = sharp(buf, { failOn: 'none' }).rotate()
    const meta = await pipeline.metadata()
    const w = meta.width ?? 0
    const h = meta.height ?? 0
    const long = Math.max(w, h)
    if (long > VISION_MAX_LONG_EDGE_PX) {
      pipeline = sharp(buf, { failOn: 'none' })
        .rotate()
        .resize({
          width: w >= h ? VISION_MAX_LONG_EDGE_PX : undefined,
          height: h > w ? VISION_MAX_LONG_EDGE_PX : undefined,
          fit: 'inside',
          withoutEnlargement: true,
        })
    }
    const out = await pipeline.jpeg({ quality: VISION_JPEG_QUALITY, mozjpeg: true }).toBuffer()
    return { buffer: out, mimeType: 'image/jpeg' }
  } catch {
    return { buffer: buf, mimeType }
  }
}

/**
 * Normalizza una stringa importo in float (allineato a parseAnyAmount in ocr-amount.ts).
 * Gestisce sia il formato continentale (1.234,56) sia anglosassone (1,234.56).
 */
function parseAnyAmount(raw) {
  if (raw == null) return null
  const s = String(raw).replace(/[£€$¥₹CHF\s]/g, '').trim()
  if (!s) return null
  // Formato continentale: 1.234,56 — la virgola è decimale
  const commaDecimal = s.match(/^-?[\d.]*\d,\d{1,2}$/)
  if (commaDecimal) {
    const n = Number(s.replace(/\./g, '').replace(',', '.'))
    return Number.isFinite(n) ? n : null
  }
  // Rimuovi separatori migliaia e prova parse diretto
  const cleaned = s.replace(/,(\d{3})/g, '$1').replace(',', '.')
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

/**
 * Estrae testo grezzo da PDF con pdf-parse (solo se disponibile).
 * Ritorna null in caso di errore o assenza del modulo.
 */
async function tryExtractPdfText(buf) {
  try {
    const pdfParse = (await import('pdf-parse')).default
    const result = await pdfParse(buf, { max: 2 })
    return result.text?.trim() || null
  } catch {
    return null
  }
}

// ─── Core OCR function ────────────────────────────────────────────────────────

/**
 * Analizza un documento fiscale con Gemini Vision + Structured Output.
 * Corrisponde funzionalmente all'integrazione di geminiGenerateVision() +
 * OCR_INVOICE_SCHEMA + prepareImageBufferForVision() nel codebase TypeScript.
 *
 * @param {Buffer} buffer
 * @param {string} mimeType
 * @param {{ model: object, pricing: { inputPerM: number, outputPerM: number } }} ctx
 * @returns {Promise<{ ocr: object, usage: object }>}
 */
async function analizzaDocumentoFiscale(buffer, mimeType, ctx) {
  const { model, pricing } = ctx

  let sendBuffer = buffer
  let sendMime = mimeType

  if (mimeType === 'application/pdf') {
    // PDF con testo embedded: usa text-only mode (veloce, economico)
    const text = await tryExtractPdfText(buffer)
    if (text && text.length > 80) {
      const userMsg = `Document text (extracted from PDF):\n${text.slice(0, 8000)}`
      const result = await model.generateContent(userMsg)
      const raw = result.response.text()
      const usage = buildUsage(result.response.usageMetadata, pricing)
      return { ocr: parseOcrResponse(raw), usage }
    }
    // PDF immagine: invia nativo (Gemini lo supporta)
    sendBuffer = buffer
    sendMime = 'application/pdf'
  } else if (mimeType.startsWith('image/')) {
    // Pre-processa immagine con Sharp prima dell'encoding
    const prepared = await prepareImageBuffer(buffer, mimeType)
    sendBuffer = prepared.buffer
    sendMime = prepared.mimeType
  }

  const base64 = sendBuffer.toString('base64')
  const result = await model.generateContent([
    { inlineData: { mimeType: sendMime, data: base64 } },
    { text: 'Analyze this fiscal document and return the JSON.' },
  ])

  const raw = result.response.text()
  const usage = buildUsage(result.response.usageMetadata, pricing)
  return { ocr: parseOcrResponse(raw), usage }
}

/** Parsing robusto della risposta OCR (con fallback su regex JSON). */
function parseOcrResponse(raw) {
  if (!raw?.trim()) return null
  try {
    // Con Structured Output il JSON è diretto, ma difendiamo da markdown fence residui
    const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (!match) return null
    return JSON.parse(match[0])
  } catch {
    return null
  }
}

/** Costruisce l'oggetto usage con costo stimato. */
function buildUsage(meta, pricing) {
  const input = meta?.promptTokenCount ?? 0
  const output = meta?.candidatesTokenCount ?? 0
  const cost = (input / 1_000_000) * pricing.inputPerM + (output / 1_000_000) * pricing.outputPerM
  return {
    inputTokens: input,
    outputTokens: output,
    totalTokens: meta?.totalTokenCount ?? input + output,
    estimatedCostUsd: Math.round(cost * 1_000_000) / 1_000_000,
  }
}

// ─── Confronto dati DB vs OCR ─────────────────────────────────────────────────

/**
 * Determina se l'OCR ha estratto dati utili (analogo di controllo_quadratura).
 * Restituisce false se né numero documento né importo sono stati estratti.
 */
function ocrHaEstrattoDatiUtili(ocr) {
  if (!ocr) return false
  const hasNumero = !!(ocr.numero_fattura?.trim())
  const hasImporto = ocr.totale_iva_inclusa != null && Number.isFinite(Number(ocr.totale_iva_inclusa))
  return hasNumero || hasImporto || ocr.estrazione_utile === true
}

/**
 * Rileva discrepanze tra valori DB e OCR.
 * Ritorna un array di stringhe descrittive (vuoto = nessuna anomalia).
 *
 * @param {{ numero: string|null, importo: number|null }} db
 * @param {object|null} ocr
 */
function rilevaDiscrepanze(db, ocr) {
  const motivi = []

  if (!ocrHaEstrattoDatiUtili(ocr)) {
    motivi.push('OCR non ha estratto dati utili (controllo_quadratura = false)')
    return motivi
  }

  // ── Confronto importo ──────────────────────────────────────────────────────
  const ocrImporto =
    ocr.totale_iva_inclusa != null
      ? Number(ocr.totale_iva_inclusa)
      : parseAnyAmount(ocr.importo_raw)

  if (db.importo != null && ocrImporto != null) {
    const delta = Math.abs(Number(db.importo) - ocrImporto)
    if (delta > AMOUNT_TOLERANCE) {
      motivi.push(
        `Importo differisce: DB=${db.importo} € vs OCR=${ocrImporto.toFixed(2)} € (Δ=${delta.toFixed(2)} €)`,
      )
    }
  } else if (db.importo != null && ocrImporto == null) {
    motivi.push(`Importo presente in DB (${db.importo} €) ma non estratto da OCR`)
  }

  // ── Confronto numero documento ─────────────────────────────────────────────
  const dbNumero = db.numero?.trim()?.toLowerCase()
  const ocrNumero = ocr.numero_fattura?.trim()?.toLowerCase()

  if (dbNumero && ocrNumero && dbNumero !== ocrNumero) {
    // Tolleranza: confronta rimuovendo caratteri non alfanumerici (slash, trattini, spazi)
    const clean = (s) => s.replace(/[^a-z0-9]/g, '')
    if (clean(dbNumero) !== clean(ocrNumero)) {
      motivi.push(`Numero documento differisce: DB="${db.numero}" vs OCR="${ocr.numero_fattura}"`)
    }
  } else if (dbNumero && !ocrNumero) {
    motivi.push(`Numero documento presente in DB ("${db.numero}") ma non estratto da OCR`)
  }

  return motivi
}

// ─── CLI parsing ──────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = argv.slice(2)
  if (args.includes('-h') || args.includes('--help')) {
    console.log(`
Audit OCR — confronta dati DB vs pipeline Gemini aggiornata

Uso:
  node scripts/audit-processed-ocr.mjs [opzioni]

Opzioni:
  --table=fatture|bolle|all    Tabella da auditare (default: all)
  --sede-id=<uuid>             Filtra per sede specifica
  --fornitore-id=<uuid>        Filtra per fornitore specifico
  --limit=N                    Massimo N record per tabella (default: illimitato)
  --only-anomalie              Includi in audit-report.json solo le anomalie
  --dry-run                    Analizza senza scrivere audit-report.json
  -h, --help                   Mostra questo aiuto

Esempi:
  node scripts/audit-processed-ocr.mjs --table=fatture --limit=50
  node scripts/audit-processed-ocr.mjs --sede-id=abc-123 --only-anomalie
  node scripts/audit-processed-ocr.mjs --dry-run --limit=10
`)
    process.exit(0)
  }

  const get = (flag) => {
    const found = args.find((a) => a.startsWith(`--${flag}=`))
    return found ? found.split('=').slice(1).join('=') : null
  }
  const has = (flag) => args.includes(`--${flag}`)

  return {
    table:       get('table') ?? 'all',
    sedeId:      get('sede-id'),
    fornitoreId: get('fornitore-id'),
    limit:       get('limit') ? parseInt(get('limit'), 10) : null,
    onlyAnomalie: has('only-anomalie'),
    dryRun:      has('dry-run'),
  }
}

// ─── Fetch record da Supabase ─────────────────────────────────────────────────

/**
 * Recupera i record da `fatture` con allegato (file_url non null).
 * Normalizza in formato unificato { id, tabella, numero, data, importo, file_url }.
 */
async function fetchFatture(supabase, opts) {
  let q = supabase
    .from('fatture')
    .select('id, numero_fattura, data, importo, file_url, fornitore_id, sede_id')
    .not('file_url', 'is', null)
    .order('data', { ascending: false })

  if (opts.sedeId)      q = q.eq('sede_id', opts.sedeId)
  if (opts.fornitoreId) q = q.eq('fornitore_id', opts.fornitoreId)
  if (opts.limit)       q = q.limit(opts.limit)

  const { data, error } = await q
  if (error) throw new Error(`[fatture] ${error.message}`)

  return (data ?? []).map((r) => ({
    id:          r.id,
    tabella:     'fatture',
    numero:      r.numero_fattura ?? null,
    data:        r.data ?? null,
    importo:     r.importo != null ? Number(r.importo) : null,
    file_url:    r.file_url,
    fornitore_id: r.fornitore_id ?? null,
    sede_id:     r.sede_id ?? null,
  }))
}

/**
 * Recupera i record da `bolle` con allegato (file_url non null).
 * Filtra le bolle completate (stato != 'in attesa') per evitare bozze incomplete.
 */
async function fetchBolle(supabase, opts) {
  let q = supabase
    .from('bolle')
    .select('id, numero_bolla, data, importo, file_url, fornitore_id, sede_id, stato')
    .not('file_url', 'is', null)
    .neq('stato', 'in attesa')
    .order('data', { ascending: false })

  if (opts.sedeId)      q = q.eq('sede_id', opts.sedeId)
  if (opts.fornitoreId) q = q.eq('fornitore_id', opts.fornitoreId)
  if (opts.limit)       q = q.limit(opts.limit)

  const { data, error } = await q
  if (error) throw new Error(`[bolle] ${error.message}`)

  return (data ?? []).map((r) => ({
    id:          r.id,
    tabella:     'bolle',
    numero:      r.numero_bolla ?? null,
    data:        r.data ?? null,
    importo:     r.importo != null ? Number(r.importo) : null,
    file_url:    r.file_url,
    fornitore_id: r.fornitore_id ?? null,
    sede_id:     r.sede_id ?? null,
  }))
}

// ─── Download file da Storage ─────────────────────────────────────────────────

/**
 * Scarica un file da Supabase Storage tramite service-role (nessun URL pre-firmato necessario).
 * Ritorna { buffer, mimeType } oppure { error: string }.
 */
async function downloadFile(supabase, fileUrl) {
  const parsed = parseStorageUrl(fileUrl)
  if (!parsed) return { error: `URL storage non riconosciuto: ${fileUrl}` }

  const { data, error } = await supabase.storage
    .from(parsed.bucket)
    .download(parsed.objectPath)

  if (error || !data) return { error: error?.message ?? 'Risposta storage vuota' }

  const ab = await data.arrayBuffer()
  const buf = Buffer.from(ab)

  let mimeType = (data.type ?? '').trim().toLowerCase()
  if (!mimeType || mimeType === 'application/octet-stream') {
    mimeType = inferMimeFromBuffer(buf) ?? 'application/octet-stream'
  }

  return { buffer: buf, mimeType }
}

// ─── Log helpers ──────────────────────────────────────────────────────────────

const GREEN  = '\x1b[32m'
const YELLOW = '\x1b[33m'
const RED    = '\x1b[31m'
const CYAN   = '\x1b[36m'
const RESET  = '\x1b[0m'
const BOLD   = '\x1b[1m'

function logProgress(i, total, tabella, id, status, detail = '') {
  const prefix = `[${String(i).padStart(String(total).length)}/${total}]`
  const short   = id.slice(0, 8)
  const src     = `${tabella}/${short}`
  if (status === 'ok') {
    console.log(`${GREEN}${prefix}${RESET} ${src} — ${GREEN}OK${RESET}${detail ? ' ' + detail : ''}`)
  } else if (status === 'anomalia') {
    console.log(`${YELLOW}${prefix}${RESET} ${src} — ${YELLOW}ANOMALIA${RESET} ${detail}`)
  } else if (status === 'errore') {
    console.log(`${RED}${prefix}${RESET} ${src} — ${RED}ERRORE${RESET} ${detail}`)
  } else {
    console.log(`${CYAN}${prefix}${RESET} ${src} — ${detail}`)
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  loadEnvLocal()

  const opts = parseArgs(process.argv)

  if (!['fatture', 'bolle', 'all'].includes(opts.table)) {
    console.error(`${RED}Errore: --table deve essere fatture, bolle o all${RESET}`)
    process.exit(1)
  }

  // ── Variabili d'ambiente ─────────────────────────────────────────────────
  const supabaseUrl  = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '').trim()
  const serviceKey   = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim()
  const geminiKey    = (process.env.GEMINI_API_KEY ?? '').trim()
  const geminiModel  = (process.env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL).trim()

  if (!supabaseUrl || !serviceKey) {
    console.error(`${RED}Mancano NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local${RESET}`)
    process.exit(1)
  }
  if (!geminiKey) {
    console.error(`${RED}Manca GEMINI_API_KEY in .env.local${RESET}`)
    process.exit(1)
  }

  // ── Init client ──────────────────────────────────────────────────────────
  const supabase = createClient(supabaseUrl, serviceKey)

  const genAI = new GoogleGenerativeAI(geminiKey)
  const model = genAI.getGenerativeModel({
    model: geminiModel,
    systemInstruction: OCR_SYSTEM_PROMPT,
    generationConfig: {
      maxOutputTokens: 900,
      temperature: 0,
      responseMimeType: 'application/json',
      responseSchema: OCR_RESPONSE_SCHEMA,
    },
  })

  const pricing = {
    inputPerM:  Number(process.env.GEMINI_INPUT_PRICE?.trim()) || 0.075,
    outputPerM: Number(process.env.GEMINI_OUTPUT_PRICE?.trim()) || 0.30,
  }

  const ocrCtx = { model, pricing }

  // ── Fetch record ─────────────────────────────────────────────────────────
  console.log(`\n${BOLD}Audit OCR${RESET} — modello: ${geminiModel}`)
  if (opts.dryRun) console.log(`${CYAN}[DRY RUN — audit-report.json non verrà scritto]${RESET}`)
  console.log()

  let records = []

  if (opts.table === 'fatture' || opts.table === 'all') {
    process.stdout.write('Caricamento fatture...')
    const fatture = await fetchFatture(supabase, opts)
    process.stdout.write(` ${fatture.length} trovate\n`)
    records.push(...fatture)
  }
  if (opts.table === 'bolle' || opts.table === 'all') {
    process.stdout.write('Caricamento bolle (completate)...')
    const bolle = await fetchBolle(supabase, opts)
    process.stdout.write(` ${bolle.length} trovate\n`)
    records.push(...bolle)
  }

  if (records.length === 0) {
    console.log(`\n${YELLOW}Nessun record da analizzare con i filtri correnti.${RESET}`)
    process.exit(0)
  }

  const totCostStimato = records.length * 0.00003  // stima very rough ~$0.03/1000 token per doc
  console.log(`\nRecord da analizzare: ${BOLD}${records.length}${RESET} — costo stimato: ~$${totCostStimato.toFixed(4)}\n`)

  // ── Ciclo di audit ───────────────────────────────────────────────────────
  const risultati = []
  let countAnomalieRilevate = 0
  let countErrori = 0
  let totalCostUsd = 0

  for (let i = 0; i < records.length; i++) {
    const rec = records[i]
    const idx = i + 1

    let ocrRaw = null
    let usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCostUsd: 0 }
    let erroreDocumento = null
    let discrepanze = []

    try {
      // 1. Download file
      const dl = await downloadFile(supabase, rec.file_url)
      if ('error' in dl) {
        throw new Error(`Storage: ${dl.error}`)
      }

      const { buffer, mimeType } = dl

      // 2. Formato non supportato da Gemini Vision
      const supportati = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif']
      if (!supportati.includes(mimeType)) {
        throw new Error(`Formato non supportato: ${mimeType}`)
      }

      // 3. Analisi OCR
      const res = await analizzaDocumentoFiscale(buffer, mimeType, ocrCtx)
      ocrRaw = res.ocr
      usage = res.usage
      totalCostUsd += usage.estimatedCostUsd

      // 4. Confronto DB vs OCR
      discrepanze = rilevaDiscrepanze(
        { numero: rec.numero, importo: rec.importo },
        ocrRaw,
      )

    } catch (err) {
      erroreDocumento = err instanceof Error ? err.message : String(err)
      countErrori++
      logProgress(idx, records.length, rec.tabella, rec.id, 'errore', erroreDocumento)
    }

    const haAnomalia = discrepanze.length > 0

    if (!erroreDocumento) {
      if (haAnomalia) {
        countAnomalieRilevate++
        logProgress(idx, records.length, rec.tabella, rec.id, 'anomalia', discrepanze.join(' | '))
      } else {
        const costStr = `~$${usage.estimatedCostUsd.toFixed(6)}`
        logProgress(idx, records.length, rec.tabella, rec.id, 'ok', costStr)
      }
    }

    // 5. Accumula risultato
    const esitoRecord = {
      id:          rec.id,
      tabella:     rec.tabella,
      file_url:    rec.file_url,
      fornitore_id: rec.fornitore_id,
      sede_id:     rec.sede_id,
      db: {
        numero:  rec.numero,
        data:    rec.data,
        importo: rec.importo,
      },
      ocr: ocrRaw
        ? {
            numero_fattura:    ocrRaw.numero_fattura ?? null,
            data_fattura:      ocrRaw.data_fattura ?? null,
            ragione_sociale:   ocrRaw.ragione_sociale ?? null,
            p_iva:             ocrRaw.p_iva ?? null,
            tipo_documento:    ocrRaw.tipo_documento ?? null,
            totale_iva_inclusa: ocrRaw.totale_iva_inclusa ?? null,
            importo_raw:       ocrRaw.importo_raw ?? null,
            estrazione_utile:  ocrRaw.estrazione_utile ?? null,
          }
        : null,
      anomalia:         haAnomalia,
      anomalia_motivo:  haAnomalia ? discrepanze : null,
      controllo_quadratura: ocrHaEstrattoDatiUtili(ocrRaw),
      errore:           erroreDocumento,
      tokenUsage:       usage,
    }

    if (opts.onlyAnomalie) {
      if (haAnomalia || erroreDocumento) risultati.push(esitoRecord)
    } else {
      risultati.push(esitoRecord)
    }

    // Pausa breve per rispettare RPM Gemini (evita 429 su volumi grandi)
    if (i < records.length - 1) {
      await new Promise((r) => setTimeout(r, 200))
    }
  }

  // ── Riepilogo ────────────────────────────────────────────────────────────
  console.log()
  console.log('─'.repeat(60))
  console.log(`${BOLD}Riepilogo audit${RESET}`)
  console.log(`  Record analizzati : ${records.length}`)
  console.log(`  ${GREEN}OK               : ${records.length - countAnomalieRilevate - countErrori}${RESET}`)
  console.log(`  ${YELLOW}Anomalie rilevate: ${countAnomalieRilevate}${RESET}`)
  console.log(`  ${RED}Errori           : ${countErrori}${RESET}`)
  console.log(`  Costo Gemini     : ~$${totalCostUsd.toFixed(6)}`)
  console.log('─'.repeat(60))

  // ── Scrittura audit-report.json ──────────────────────────────────────────
  const report = {
    generatedAt:       new Date().toISOString(),
    parametri: {
      table:       opts.table,
      sedeId:      opts.sedeId,
      fornitoreId: opts.fornitoreId,
      limit:       opts.limit,
      onlyAnomalie: opts.onlyAnomalie,
    },
    sommario: {
      totaleAnalizzati:    records.length,
      ok:                  records.length - countAnomalieRilevate - countErrori,
      anomalie:            countAnomalieRilevate,
      errori:              countErrori,
      costoGeminiUsd:      parseFloat(totalCostUsd.toFixed(6)),
    },
    risultati,
  }

  const outPath = resolve(ROOT, 'audit-report.json')

  if (opts.dryRun) {
    console.log(`\n${CYAN}[DRY RUN] audit-report.json NON scritto.${RESET}`)
    console.log('Preview JSON (prime 3 righe risultati):')
    console.log(JSON.stringify({ ...report, risultati: report.risultati.slice(0, 3) }, null, 2))
  } else {
    writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8')
    console.log(`\nReport salvato: ${BOLD}${outPath}${RESET}`)
    console.log(`  ${risultati.length} record inclusi${opts.onlyAnomalie ? ' (solo anomalie/errori)' : ''}`)
  }
}

main().catch((err) => {
  console.error(`\n${RED}Errore fatale:${RESET}`, err instanceof Error ? err.message : String(err))
  if (err instanceof Error && err.stack) {
    console.error(err.stack.split('\n').slice(1, 4).join('\n'))
  }
  process.exit(1)
})
