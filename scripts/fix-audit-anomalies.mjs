#!/usr/bin/env node
/**
 * Fix Audit Anomalies — bonifica automatica dei record anomali trovati dall'audit OCR.
 *
 * Legge audit-report.json e applica le seguenti correzioni su Supabase (Service Role):
 *
 *   Cat. 1  — Rimozione suffisso ".pdf" dal numero_fattura (5 record "LA TUA PASTA")
 *   Cat. 4  — Sostituzione codice cliente "C098" con numero fattura reale (5 rec "LDNFOODS LTD")
 *   Cat. 5  — Fix emblematici hardcoded:
 *               cde931a0: importo 0.00 → 14.60 (Parts Town UK)
 *               9fdd2be3: numero_fattura "51120543" → "SI120543" (Mondial Wine)
 *   Cat.503 — Mini-ciclo di riprocessamento OCR per i 22 record con errore 503 Gemini.
 *             Aggiorna audit-report.json con i nuovi risultati (non modifica il DB).
 *
 * Uso:
 *   node scripts/fix-audit-anomalies.mjs [opzioni]
 *
 * Opzioni:
 *   --dry-run          Mostra cosa farebbe senza applicare modifiche al DB
 *   --skip-retry-503   Stampa gli UUID 503 senza riprocessarli via Gemini
 *   -h, --help         Mostra questo aiuto
 *
 * Prerequisiti in .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL  (oppure SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY
 *   GEMINI_API_KEY            (solo per il mini-ciclo 503; obbligatorio se non --skip-retry-503)
 */

import { readFileSync, existsSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

// ─── ANSI colors ───────────────────────────────────────────────────────────────

const GREEN  = '\x1b[32m'
const YELLOW = '\x1b[33m'
const RED    = '\x1b[31m'
const CYAN   = '\x1b[36m'
const RESET  = '\x1b[0m'
const BOLD   = '\x1b[1m'
const DIM    = '\x1b[2m'

// ─── OCR schema + prompt (specchio di audit-processed-ocr.mjs) ────────────────

const OCR_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    ragione_sociale:          { type: 'STRING', nullable: true },
    p_iva:                    { type: 'STRING', nullable: true },
    indirizzo:                { type: 'STRING', nullable: true },
    data_fattura:             { type: 'STRING', nullable: true },
    numero_fattura:           { type: 'STRING', nullable: true },
    tipo_documento: {
      type: 'STRING',
      nullable: true,
      enum: ['fattura', 'nota_credito', 'bolla_ddt', 'ordine', 'estratto_conto', 'comunicazione', null],
    },
    promessa_invio_documento: { type: 'BOOLEAN', nullable: true },
    totale_iva_inclusa:       { type: 'NUMBER', nullable: true },
    note_corpo_mail:          { type: 'STRING', nullable: true },
    estrazione_utile:         { type: 'BOOLEAN', nullable: true },
    importo_raw:              { type: 'STRING', nullable: true },
  },
  required: ['ragione_sociale', 'p_iva', 'data_fattura', 'numero_fattura', 'tipo_documento', 'totale_iva_inclusa'],
}

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

// ─── Env loading ───────────────────────────────────────────────────────────────

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

// ─── Storage helpers ───────────────────────────────────────────────────────────

/** Rimuove newline parassite che alcune URL nel report hanno. */
function sanitizeUrl(url) {
  return (url ?? '').replace(/\n/g, '').trim()
}

function parseStorageUrl(fileUrl) {
  try {
    const u = new URL(sanitizeUrl(fileUrl))
    const m = u.pathname.match(
      /\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+)$/
    )
    if (m) return { bucket: m[1], objectPath: decodeURIComponent(m[2].split('?')[0]) }
    return null
  } catch {
    return null
  }
}

function inferMimeFromBuffer(buf) {
  if (buf.length < 12) return null
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png'
  if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) return 'application/pdf'
  if (buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp'
  return null
}

async function downloadFile(supabase, fileUrl) {
  const parsed = parseStorageUrl(fileUrl)
  if (!parsed) return { error: `URL storage non riconosciuto: ${fileUrl}` }
  const { data, error } = await supabase.storage.from(parsed.bucket).download(parsed.objectPath)
  if (error || !data) return { error: error?.message ?? 'Risposta storage vuota' }
  const buf = Buffer.from(await data.arrayBuffer())
  let mimeType = (data.type ?? '').trim().toLowerCase()
  if (!mimeType || mimeType === 'application/octet-stream') {
    mimeType = inferMimeFromBuffer(buf) ?? 'application/octet-stream'
  }
  return { buffer: buf, mimeType }
}

// ─── OCR helpers ───────────────────────────────────────────────────────────────

async function tryExtractPdfText(buf) {
  try {
    const pdfParse = (await import('pdf-parse')).default
    const result = await pdfParse(buf, { max: 2 })
    return result.text?.trim() || null
  } catch {
    return null
  }
}

function parseOcrResponse(raw) {
  if (!raw?.trim()) return null
  try {
    const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (!match) return null
    return JSON.parse(match[0])
  } catch {
    return null
  }
}

function buildUsage(meta, pricing) {
  const input  = meta?.promptTokenCount    ?? 0
  const output = meta?.candidatesTokenCount ?? 0
  const cost = (input / 1_000_000) * pricing.inputPerM + (output / 1_000_000) * pricing.outputPerM
  return {
    inputTokens:      input,
    outputTokens:     output,
    totalTokens:      meta?.totalTokenCount ?? (input + output),
    estimatedCostUsd: Math.round(cost * 1_000_000) / 1_000_000,
  }
}

async function analizzaDocumentoFiscale(buffer, mimeType, ctx) {
  const { model, pricing } = ctx

  if (mimeType === 'application/pdf') {
    const text = await tryExtractPdfText(buffer)
    if (text && text.length > 80) {
      const result = await model.generateContent(
        `Document text (extracted from PDF):\n${text.slice(0, 8000)}`
      )
      return { ocr: parseOcrResponse(result.response.text()), usage: buildUsage(result.response.usageMetadata, pricing) }
    }
  }

  // Vision mode: PDF nativo o immagine
  const base64 = buffer.toString('base64')
  const result = await model.generateContent([
    { inlineData: { mimeType, data: base64 } },
    { text: 'Analyze this fiscal document and return the JSON.' },
  ])
  return { ocr: parseOcrResponse(result.response.text()), usage: buildUsage(result.response.usageMetadata, pricing) }
}

// ─── Confronto dati ─────────────────────────────────────────────────────────

const AMOUNT_TOLERANCE = 0.05

function parseAnyAmount(raw) {
  if (raw == null) return null
  const s = String(raw).replace(/[£€$¥₹CHF\s]/g, '').trim()
  if (!s) return null
  if (s.match(/^-?[\d.]*\d,\d{1,2}$/)) {
    const n = Number(s.replace(/\./g, '').replace(',', '.'))
    return Number.isFinite(n) ? n : null
  }
  const n = Number(s.replace(/,(\d{3})/g, '$1').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function rilevaDiscrepanze(db, ocr) {
  if (!ocr) return { anomalia: false, motivi: [], quadratura: false }

  const motivi = []
  const hasNumero  = !!(ocr.numero_fattura?.trim())
  const hasImporto = ocr.totale_iva_inclusa != null

  if (!hasNumero && !hasImporto) {
    return {
      anomalia: true,
      motivi: ['OCR non ha estratto dati utili (controllo_quadratura = false)'],
      quadratura: false,
    }
  }

  const ocrNumero = ocr.numero_fattura?.trim()?.toLowerCase()
  const dbNumero  = db.numero?.trim()?.toLowerCase()

  if (dbNumero && ocrNumero && dbNumero !== ocrNumero) {
    motivi.push(`Numero documento differisce: DB="${db.numero}" vs OCR="${ocr.numero_fattura}"`)
  } else if (dbNumero && !ocrNumero) {
    motivi.push(`Numero documento presente in DB ("${db.numero}") ma non estratto da OCR`)
  }

  const ocrImporto = parseAnyAmount(ocr.importo_raw) ?? ocr.totale_iva_inclusa
  if (db.importo != null && ocrImporto != null && Math.abs(db.importo - ocrImporto) > AMOUNT_TOLERANCE) {
    motivi.push(
      `Importo differisce: DB=${db.importo} € vs OCR=${ocrImporto.toFixed(2)} € (Δ=${Math.abs(db.importo - ocrImporto).toFixed(2)} €)`
    )
  }

  return { anomalia: motivi.length > 0, motivi, quadratura: true }
}

// ─── DB update helper ──────────────────────────────────────────────────────────

/**
 * Applica un UPDATE su Supabase. In dry-run stampa solo la query senza eseguirla.
 * @returns {boolean} true se aggiornato con successo (o simulato)
 */
async function aggiornaDato(supabase, tabella, id, campi, isDryRun, label) {
  const descrizione = Object.entries(campi)
    .map(([k, v]) => `${k} = ${JSON.stringify(v)}`)
    .join(', ')

  if (isDryRun) {
    console.log(
      `  ${CYAN}[DRY RUN]${RESET} UPDATE ${tabella} SET ${descrizione} WHERE id='${id.slice(0, 8)}…' ${DIM}— ${label}${RESET}`
    )
    return true
  }

  const { error } = await supabase.from(tabella).update(campi).eq('id', id)
  if (error) {
    console.log(`  ${RED}✘ ERRORE${RESET}  ${tabella}/${id.slice(0, 8)} — ${error.message}`)
    return false
  }
  console.log(`  ${GREEN}✔ AGGIORNATO${RESET} ${tabella}/${id.slice(0, 8)} ${DIM}— ${label}${RESET} → ${BOLD}${descrizione}${RESET}`)
  return true
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  loadEnvLocal()

  const args = process.argv.slice(2)
  if (args.includes('-h') || args.includes('--help')) {
    console.log([
      '',
      `${BOLD}Fix Audit Anomalies${RESET}`,
      'Uso: node scripts/fix-audit-anomalies.mjs [--dry-run] [--skip-retry-503]',
      '',
      '  --dry-run          Simula le operazioni senza modificare il DB',
      '  --skip-retry-503   Stampa solo la lista UUID 503 senza riprocessare via Gemini',
    ].join('\n'))
    process.exit(0)
  }

  const isDryRun      = args.includes('--dry-run')
  const skipRetry503  = args.includes('--skip-retry-503')

  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '').trim()
  const serviceKey  = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim()
  const geminiKey   = (process.env.GEMINI_API_KEY ?? '').trim()

  if (!supabaseUrl || !serviceKey) {
    console.error(`\n${RED}Mancano NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local${RESET}`)
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, serviceKey)

  // ── Leggi report ─────────────────────────────────────────────────────────────

  const reportPath = resolve(ROOT, 'audit-report.json')
  if (!existsSync(reportPath)) {
    console.error(`\n${RED}File audit-report.json non trovato. Esegui prima audit-processed-ocr.mjs.${RESET}`)
    process.exit(1)
  }

  const report = JSON.parse(readFileSync(reportPath, 'utf8'))

  console.log(`\n${BOLD}Fix Audit Anomalies${RESET}${isDryRun ? `  ${CYAN}[DRY RUN]${RESET}` : ''}`)
  console.log(`${DIM}Report: ${report.generatedAt} — ${report.sommario.totaleAnalizzati} record analizzati${RESET}\n`)

  const fixedIds  = new Set()
  const stats = {
    cat1:             0,
    cat4:             0,
    cat5:             0,
    retry503:         0,
    retry503Ok:       0,
    retry503Anomalie: 0,
    retry503Err:      0,
  }

  // ════════════════════════════════════════════════════════════════════════════
  // CATEGORIA 1 — Rimozione suffisso ".pdf" dal numero_fattura
  // ════════════════════════════════════════════════════════════════════════════

  console.log(`${BOLD}Categoria 1${RESET} — Rimozione suffisso ".pdf" dal numero_fattura`)

  const cat1Records = report.risultati.filter(
    r => r.anomalia
      && r.tabella === 'fatture'
      && typeof r.db?.numero === 'string'
      && r.db.numero.toLowerCase().endsWith('.pdf')
      && r.ocr?.numero_fattura
  )

  if (cat1Records.length === 0) {
    console.log(`  ${DIM}Nessun record corrispondente nel report.${RESET}`)
  } else {
    for (const rec of cat1Records) {
      const nuovoNumero = rec.db.numero.replace(/\.pdf$/i, '')
      const ok = await aggiornaDato(
        supabase, 'fatture', rec.id, { numero_fattura: nuovoNumero }, isDryRun,
        `"${rec.db.numero}" → "${nuovoNumero}"`
      )
      if (ok) { stats.cat1++; fixedIds.add(rec.id) }
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // CATEGORIA 4 — Sostituzione "C098" con numero fattura reale (LDNFOODS LTD)
  // ════════════════════════════════════════════════════════════════════════════

  console.log(`\n${BOLD}Categoria 4${RESET} — Sostituzione "C098" con numero fattura reale`)

  const cat4Records = report.risultati.filter(
    r => r.anomalia
      && r.tabella === 'fatture'
      && r.db?.numero === 'C098'
      && r.ocr?.numero_fattura
      // Aggiorna solo se importo coincide (sicurezza): evita di sovrascrivere il numero
      // su record per cui il file potrebbe non essere quello corretto.
      && (
        r.db.importo == null
        || r.ocr.totale_iva_inclusa == null
        || Math.abs((r.db.importo ?? 0) - (r.ocr.totale_iva_inclusa ?? 0)) <= AMOUNT_TOLERANCE
      )
  )

  if (cat4Records.length === 0) {
    console.log(`  ${DIM}Nessun record corrispondente nel report.${RESET}`)
  } else {
    for (const rec of cat4Records) {
      const ok = await aggiornaDato(
        supabase, 'fatture', rec.id,
        { numero_fattura: rec.ocr.numero_fattura }, isDryRun,
        `"C098" → "${rec.ocr.numero_fattura}"  (importo: ${rec.db.importo ?? '—'} €)`
      )
      if (ok) { stats.cat4++; fixedIds.add(rec.id) }
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // CATEGORIA 5 — Fix emblematici hardcoded
  // ════════════════════════════════════════════════════════════════════════════

  console.log(`\n${BOLD}Categoria 5${RESET} — Fix emblematici`)

  /**
   * Ogni voce descrive un singolo UPDATE sicuro: importo confermato dall'OCR
   * oppure numero corretto per errore di character recognition (5→I).
   * Il campo `tabella_col` indica la colonna da aggiornare per quella tabella.
   */
  const emblematici = [
    {
      id:      'cde931a0-c85b-40a7-91dc-1d031d5cd523',
      tabella: 'fatture',
      campi:   { importo: 14.60 },
      label:   'Parts Town UK — importo DB=0.00 → OCR=14.60',
    },
    {
      id:      '9fdd2be3-4802-4d59-a943-26b6861e731f',
      tabella: 'fatture',
      campi:   { numero_fattura: 'SI120543' },
      label:   'Mondial Wine — numero "51120543" → "SI120543" (5/I character swap, importo OK)',
    },
  ]

  for (const fix of emblematici) {
    const inReport = report.risultati.find(r => r.id === fix.id)
    if (!inReport) {
      console.log(`  ${YELLOW}⚠ ${fix.id.slice(0, 8)} non trovato nel report — skip.${RESET}`)
      continue
    }
    const ok = await aggiornaDato(supabase, fix.tabella, fix.id, fix.campi, isDryRun, fix.label)
    if (ok) { stats.cat5++; fixedIds.add(fix.id) }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // CATEGORIA 503 — Mini-ciclo OCR per i record con errore Gemini 503
  // ════════════════════════════════════════════════════════════════════════════

  const err503Records = report.risultati.filter(r => r.errore?.includes('503'))

  console.log(`\n${BOLD}Categoria 503${RESET} — ${err503Records.length} record con errore Gemini 503 transitorio`)

  if (err503Records.length === 0) {
    console.log(`  ${GREEN}Nessun record da riprocessare.${RESET}`)
  } else if (skipRetry503) {
    console.log(`  ${CYAN}--skip-retry-503 attivo. Lista UUID pronti per il prossimo run:${RESET}\n`)
    for (const r of err503Records) {
      const filename = sanitizeUrl(r.file_url).split('/').pop()
      console.log(`  ${DIM}${r.id}${RESET}  [${r.tabella}]  ${filename}`)
    }
    console.log(`\n  ${DIM}Per riprocessarli: node scripts/fix-audit-anomalies.mjs${isDryRun ? ' --dry-run' : ''}${RESET}`)
  } else {
    if (!geminiKey) {
      console.error(
        `  ${RED}GEMINI_API_KEY mancante — impossibile riprocessare.${RESET}\n` +
        `  Aggiungi la chiave in .env.local oppure usa --skip-retry-503 per listare solo gli UUID.`
      )
    } else {
      const geminiModel = (process.env.GEMINI_MODEL ?? 'gemini-2.5-flash-lite').trim()
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
        inputPerM:  Number(process.env.GEMINI_INPUT_PRICE?.trim())  || 0.075,
        outputPerM: Number(process.env.GEMINI_OUTPUT_PRICE?.trim()) || 0.30,
      }
      const ocrCtx = { model, pricing }

      console.log(`  Modello: ${geminiModel}${isDryRun ? `  ${CYAN}[DRY RUN — report non aggiornato]${RESET}` : ''}`)
      console.log()

      const total = err503Records.length
      let totalCost = 0

      for (let i = 0; i < total; i++) {
        const rec    = err503Records[i]
        const prefix = `[${String(i + 1).padStart(String(total).length)}/${total}]`
        const short  = rec.id.slice(0, 8)
        stats.retry503++

        process.stdout.write(`  ${prefix} ${rec.tabella}/${short} — `)

        // Download
        const dl = await downloadFile(supabase, rec.file_url ?? '')
        if (dl.error) {
          process.stdout.write(`${RED}ERRORE DOWNLOAD${RESET} ${dl.error}\n`)
          stats.retry503Err++
          const idx = report.risultati.findIndex(r => r.id === rec.id)
          if (idx >= 0 && !isDryRun) {
            report.risultati[idx].errore = `[DOWNLOAD] ${dl.error}`
          }
          await new Promise(r => setTimeout(r, 200))
          continue
        }

        // OCR
        try {
          const { ocr, usage } = await analizzaDocumentoFiscale(dl.buffer, dl.mimeType, ocrCtx)
          const { anomalia, motivi, quadratura } = rilevaDiscrepanze(rec.db, ocr)
          const ocrImporto = ocr ? (parseAnyAmount(ocr.importo_raw) ?? ocr.totale_iva_inclusa) : null
          totalCost += usage.estimatedCostUsd

          // Aggiorna entry nel report
          const idx = report.risultati.findIndex(r => r.id === rec.id)
          if (idx >= 0 && !isDryRun) {
            report.risultati[idx].ocr = ocr
              ? {
                  numero_fattura:    ocr.numero_fattura    ?? null,
                  data_fattura:      ocr.data_fattura      ?? null,
                  ragione_sociale:   ocr.ragione_sociale   ?? null,
                  p_iva:             ocr.p_iva             ?? null,
                  tipo_documento:    ocr.tipo_documento    ?? null,
                  totale_iva_inclusa: ocrImporto,
                  importo_raw:       ocr.importo_raw       ?? null,
                  estrazione_utile:  ocr.estrazione_utile  ?? null,
                }
              : null
            report.risultati[idx].anomalia           = anomalia
            report.risultati[idx].anomalia_motivo    = motivi.length > 0 ? motivi : null
            report.risultati[idx].controllo_quadratura = quadratura
            report.risultati[idx].errore             = null
            report.risultati[idx].tokenUsage         = usage
          }

          if (!anomalia) {
            process.stdout.write(`${GREEN}OK${RESET}  ~$${usage.estimatedCostUsd.toFixed(6)}\n`)
            stats.retry503Ok++
          } else {
            process.stdout.write(`${YELLOW}ANOMALIA${RESET}  ${motivi.join(' | ')}  ~$${usage.estimatedCostUsd.toFixed(6)}\n`)
            stats.retry503Anomalie++
          }
        } catch (err) {
          const msg = String(err?.message ?? err).slice(0, 160)
          process.stdout.write(`${RED}ERRORE OCR${RESET}  ${msg}\n`)
          stats.retry503Err++
          const idx = report.risultati.findIndex(r => r.id === rec.id)
          if (idx >= 0 && !isDryRun) report.risultati[idx].errore = msg
        }

        if (i < total - 1) await new Promise(r => setTimeout(r, 400))
      }

      console.log()
      console.log(
        `  Riprocessati: ${stats.retry503} — ` +
        `${GREEN}OK: ${stats.retry503Ok}${RESET} — ` +
        `${YELLOW}Anomalie: ${stats.retry503Anomalie}${RESET} — ` +
        `${RED}Errori: ${stats.retry503Err}${RESET}  ` +
        `${DIM}(costo: ~$${totalCost.toFixed(4)})${RESET}`
      )
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Aggiorna audit-report.json
  // ════════════════════════════════════════════════════════════════════════════

  if (!isDryRun) {
    const now = new Date().toISOString()

    // Marca i record DB-fixati come risolti nel report
    for (const r of report.risultati) {
      if (fixedIds.has(r.id)) {
        r.anomalia        = false
        r.anomalia_motivo = null
        r.fixApplicatoAt  = now
      }
    }

    // Ricalcola sommario
    const all = report.risultati
    report.sommario.ok       = all.filter(r => !r.anomalia && !r.errore).length
    report.sommario.anomalie = all.filter(r => r.anomalia).length
    report.sommario.errori   = all.filter(r => !!r.errore).length

    report.fixApplicatoAt = now
    report.fixStats       = { ...stats }

    writeFileSync(reportPath, JSON.stringify(report, null, 2))
    console.log(`\nReport aggiornato: ${BOLD}${reportPath}${RESET}`)
  } else {
    console.log(`\n${CYAN}[DRY RUN] audit-report.json non modificato.${RESET}`)
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Riepilogo finale
  // ════════════════════════════════════════════════════════════════════════════

  const sep = '─'.repeat(62)
  console.log(`\n${sep}`)
  console.log(`${BOLD}Riepilogo fix${RESET}${isDryRun ? `  ${CYAN}[DRY RUN]${RESET}` : ''}`)
  console.log(`  Cat. 1  ".pdf" suffix rimosso   : ${GREEN}${stats.cat1}${RESET} / ${cat1Records?.length ?? 0} record`)
  console.log(`  Cat. 4  C098 → numero reale      : ${GREEN}${stats.cat4}${RESET} / ${cat4Records?.length ?? 0} record`)
  console.log(`  Cat. 5  fix emblematici          : ${GREEN}${stats.cat5}${RESET} / ${emblematici.length} record`)
  if (!skipRetry503) {
    console.log(
      `  Cat.503 retry OCR                : ` +
      `${GREEN}${stats.retry503Ok} OK${RESET}  ` +
      `${YELLOW}${stats.retry503Anomalie} anomalie${RESET}  ` +
      `${RED}${stats.retry503Err} errori${RESET}`
    )
  }
  console.log(sep)
  console.log()
}

main().catch(e => {
  console.error(`\n${RED}Errore fatale:${RESET}`, e)
  process.exit(1)
})
