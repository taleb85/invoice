#!/usr/bin/env node
/**
 * CLI per analisi AI di fatture/bolle con suggerimenti da applicare.
 *
 * Uso:
 *   node scripts/ai-analyze.mjs bolla <id>
 *   node scripts/ai-analyze.mjs fattura <id>
 *   node scripts/ai-analyze.mjs bolla <id> -i
 *   node scripts/ai-analyze.mjs fattura <id> --json
 *
 * Modalità:
 *   default    — analisi + suggerimenti (sola lettura)
 *   -i / --interactive  — analisi + interattivo per applicare suggerimenti
 *   --json     — output JSON raw
 *
 * Prerequisiti in .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   GEMINI_API_KEY
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createInterface } from 'node:readline'
import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

// ─── Helpers ──────────────────────────────────────────────────────────────────

function loadEnvLocal() {
  const p = resolve(root, '.env.local')
  if (!existsSync(p)) return
  const text = readFileSync(p, 'utf8')
  for (const line of text.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq < 1) continue
    const key = t.slice(0, eq).trim()
    let val = t.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = val
  }
}

function parseSupabasePublicStorageUrl(fileUrl) {
  try {
    const u = new URL(fileUrl)
    const pathname = u.pathname
    const publicM = pathname.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/)
    if (publicM) {
      return { bucket: publicM[1], objectPath: decodeURIComponent(publicM[2]) }
    }
    const signM = pathname.match(/\/storage\/v1\/object\/sign\/([^/]+)\/(.+)$/)
    if (signM) {
      return { bucket: signM[1], objectPath: decodeURIComponent(signM[2]) }
    }
    return null
  } catch {
    return null
  }
}

function inferContentTypeFromBuffer(buf) {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(new Uint8Array(buf))
  if (b.length < 12) return null
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png'
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return 'application/pdf'
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'image/gif'
  if (b.toString('ascii', 0, 4) === 'RIFF' && b.length >= 12 && b.toString('ascii', 8, 12) === 'WEBP') return 'image/webp'
  return null
}

function askQuestion(query) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    rl.question(query, (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

// ─── Types ────────────────────────────────────────────────────────────────────

/** @typedef {'bolla' | 'fattura'} EntityType */
/** @typedef {'info' | 'anomaly' | 'convert-to-fattura' | 'not-invoice' | 'assign-supplier'} SuggestionType */

/**
 * @typedef {{ type: SuggestionType, label: string, description: string }} AiSuggestion
 * @typedef {{ analysis: string, suggestions: AiSuggestion[] }} AiAnalysisResult
 */

// ─── Constants ────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an assistant that analyzes fiscal documents (delivery notes and invoices).
The user provides a document image/PDF and context data from the database.
Analyze the document visually and with the context data, then return a JSON object with:
- "analysis": A concise description of what the document appears to be (max 3 sentences).
- "suggestions": An array of suggestion objects. Each has:
  - "type": one of:
    - "info" — general information about the document.
    - "anomaly" — something seems off (dates, amounts, supplier mismatch).
    - "convert-to-fattura" — only for delivery notes (bolle/DDT) that look like invoices.
    - "not-invoice" — the document is not an invoice (e.g. a delivery note, order form, etc.).
    - "assign-supplier" — the supplier name is readable on the document but may not match or is missing in the system.
  - "label": A short action button label (max 40 chars, e.g. "Convert to invoice", "Supplier found", "Not an invoice").
  - "description": Explanation of why this is suggested (max 2 sentences).

IMPORTANT: Return ONLY valid JSON, no markdown, no code fences, no extra text.`

const SUGGESTION_LABELS = {
  info: 'Informazione',
  anomaly: 'Anomalia',
  'convert-to-fattura': 'Converti in fattura',
  'not-invoice': 'Non è una fattura',
  'assign-supplier': 'Assegna fornitore',
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  loadEnvLocal()

  const args = process.argv.slice(2)

  if (args.length < 2 || args[0].startsWith('-')) {
    console.log(`
CLI analisi AI documenti

Uso:
  node scripts/ai-analyze.mjs <tipo> <id> [opzioni]

Tipo:
  bolla              Analizza una bolla/DDT
  fattura            Analizza una fattura

Opzioni:
  -i, --interactive  Modalità interattiva per applicare suggerimenti
  --json             Output JSON raw (sola lettura)
  -h, --help         Mostra questo aiuto

Esempi:
  node scripts/ai-analyze.mjs bolla abc-123
  node scripts/ai-analyze.mjs fattura xyz-456 -i
  node scripts/ai-analyze.mjs bolla abc-123 --json
`)
    process.exit(0)
  }

  const entityType = args[0]
  const entityId = args[1]
  const isInteractive = args.includes('-i') || args.includes('--interactive')
  const isJson = args.includes('--json')
  const isHelp = args.includes('-h') || args.includes('--help')

  if (isHelp) {
    console.log(`
Uso: node scripts/ai-analyze.mjs <tipo> <id> [opzioni]

Tipo: bolla | fattura
Opzioni:
  -i, --interactive  Modalità interattiva per applicare suggerimenti
  --json             Output JSON raw
  -h, --help         Mostra questo aiuto
`)
    process.exit(0)
  }

  if (entityType !== 'bolla' && entityType !== 'fattura') {
    console.error('Errore: tipo deve essere "bolla" o "fattura"')
    process.exit(1)
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim()
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  const geminiKey = process.env.GEMINI_API_KEY?.trim()

  if (!supabaseUrl || !serviceKey) {
    console.error('Mancano NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY in .env.local')
    process.exit(1)
  }
  if (!geminiKey) {
    console.error('Manca GEMINI_API_KEY in .env.local')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, serviceKey)

  // ── 1. Carica documento ────────────────────────────────────────────────
  console.error(`\n Caricamento ${entityType} ${entityId}...`)

  let fileUrl = null
  let entityContext = ''
  let fornitoreName = ''

  if (entityType === 'bolla') {
    const { data, error } = await supabase
      .from('bolle')
      .select('id, numero_bolla, data, file_url, stato, fornitore_id, fornitori(nome)')
      .eq('id', entityId)
      .maybeSingle()

    if (error || !data) {
      console.error(`Bolla non trovata: ${error?.message ?? 'ID sconosciuto'}`)
      process.exit(1)
    }

    fileUrl = data.file_url
    const forn = data.fornitori
    fornitoreName = forn?.nome ?? ''
    entityContext = [
      `Tipo: Bolla / DDT`,
      `Numero: ${data.numero_bolla ?? '—'}`,
      `Data: ${data.data ?? '—'}`,
      `Stato: ${data.stato ?? '—'}`,
      `Fornitore: ${fornitoreName || '—'}`,
    ].join('\n')
  } else {
    const { data, error } = await supabase
      .from('fatture')
      .select('id, numero_fattura, data, file_url, importo, fornitore_id, fornitori(nome)')
      .eq('id', entityId)
      .maybeSingle()

    if (error || !data) {
      console.error(`Fattura non trovata: ${error?.message ?? 'ID sconosciuto'}`)
      process.exit(1)
    }

    fileUrl = data.file_url
    const forn = data.fornitori
    fornitoreName = forn?.nome ?? ''
    entityContext = [
      `Tipo: Fattura`,
      `Numero: ${data.numero_fattura ?? '—'}`,
      `Data: ${data.data ?? '—'}`,
      `Importo: ${data.importo ?? '—'}`,
      `Fornitore: ${fornitoreName || '—'}`,
    ].join('\n')
  }

  if (!fileUrl?.trim()) {
    console.error('Nessun allegato da analizzare')
    process.exit(1)
  }

  // ── 2. Scarica file dallo storage ──────────────────────────────────────
  console.error(' Download del documento...')

  const parsed = parseSupabasePublicStorageUrl(fileUrl.trim())
  if (!parsed) {
    console.error('URL storage non riconosciuto')
    process.exit(1)
  }

  const { data: blob, error: dlErr } = await supabase.storage
    .from(parsed.bucket)
    .download(parsed.objectPath)

  if (dlErr || !blob) {
    console.error(`Download fallito: ${dlErr?.message ?? 'errore sconosciuto'}`)
    process.exit(1)
  }

  const ab = await blob.arrayBuffer()
  const fileBuffer = Buffer.from(ab)
  const contentType = blob.type && blob.type !== '' ? blob.type : 'application/octet-stream'

  let mime = contentType.trim().toLowerCase()
  if (!mime || mime === 'application/octet-stream') {
    mime = inferContentTypeFromBuffer(fileBuffer) ?? 'application/pdf'
  }
  if (!mime.includes('pdf') && !mime.startsWith('image/')) {
    mime = 'application/pdf'
  }

  const base64 = fileBuffer.toString('base64')

  // ── 3. Chiamata Gemini ─────────────────────────────────────────────────
  console.error(' Analisi con AI (Gemini 2.5 Flash-Lite)...')

  const genAI = new GoogleGenerativeAI(geminiKey)
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash-lite',
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: { maxOutputTokens: 800, temperature: 0 },
  })

  const userPrompt = `Document context from database:\n${entityContext}\n\nAnalyze the attached document and return JSON with analysis and suggestions.`

  const geminiResult = await model.generateContent([
    { inlineData: { mimeType: mime, data: base64 } },
    { text: userPrompt },
  ])

  const rawText = geminiResult.response.text()

  // ── 4. Parsing risultato ────────────────────────────────────────────────
  let result
  try {
    const cleaned = rawText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
    result = JSON.parse(cleaned)
    if (!result.analysis || !Array.isArray(result.suggestions)) {
      throw new Error('Invalid response structure')
    }
  } catch {
    result = {
      analysis: rawText.trim(),
      suggestions: [],
    }
  }

  const usage = geminiResult.response.usageMetadata
  const inputTokens = usage?.promptTokenCount ?? 0
  const outputTokens = usage?.candidatesTokenCount ?? 0
  const estimatedCost = ((inputTokens / 1_000_000) * 0.075 + (outputTokens / 1_000_000) * 0.30).toFixed(6)

  // ── 5. Output ──────────────────────────────────────────────────────────

  if (isJson) {
    console.log(JSON.stringify({
      entityType,
      entityId,
      context: entityContext,
      result,
      usage: { inputTokens, outputTokens, estimatedCostUsd: parseFloat(estimatedCost) },
    }, null, 2))
    return
  }

  // ── Output formattato ──────────────────────────────────────────────────
  console.log('\n' + '='.repeat(60))
  console.log(` ANALISI AI — ${entityType === 'bolla' ? 'BOLLA' : 'FATTURA'} #${entityId.slice(0, 8)}`)
  console.log('='.repeat(60))
  console.log(`\n Contesto documento:`)
  console.log(entityContext)
  console.log(`\n Analisi:`)
  console.log(`  ${result.analysis}`)
  console.log(`\n Token: ${inputTokens} in / ${outputTokens} out · Costo: ~$${estimatedCost}`)

  if (result.suggestions.length > 0) {
    console.log(`\n Suggerimenti (${result.suggestions.length}):`)
    console.log('-'.repeat(60))
    for (const [i, s] of result.suggestions.entries()) {
      const icon = s.type === 'info' ? 'ℹ️' : s.type === 'anomaly' ? '⚠️' : s.type === 'convert-to-fattura' ? '📄' : s.type === 'not-invoice' ? '🚫' : '🏷️'
      console.log(`  ${i + 1}. ${icon} [${SUGGESTION_LABELS[s.type] ?? s.type}] ${s.label}`)
      if (s.description) {
        console.log(`     ${s.description}`)
      }
      console.log()
    }
  } else {
    console.log('\n Nessun suggerimento specifico per questo documento.')
  }

  // ── 6. Modalità interattiva ─────────────────────────────────────────────
  if (!isInteractive || result.suggestions.length === 0) {
    return
  }

  const applicable = result.suggestions.filter(
    (s) => s.type !== 'info' && s.type !== 'anomaly'
  )

  if (applicable.length === 0) {
    console.log(' Nessun suggerimento applicabile in modalità interattiva.')
    return
  }

  console.log(`\n${'='.repeat(60)}`)
  console.log(' MODALITÀ INTERATTIVA')
  console.log('='.repeat(60))
  console.log('\nSuggerimenti applicabili:')
  for (const [i, s] of applicable.entries()) {
    console.log(`  ${i + 1}. ${s.label}`)
    console.log(`     ${s.description}`)
  }
  console.log(`  0. Esci senza applicare nulla\n`)

  const answer = await askQuestion(`Quale suggerimento vuoi applicare? (0-${applicable.length}): `)
  const idx = parseInt(answer, 10)

  if (isNaN(idx) || idx === 0 || idx < 1 || idx > applicable.length) {
    console.log(' Nessuna azione applicata.')
    return
  }

  const selected = applicable[idx - 1]
  console.log(`\n Applicazione: ${selected.label}...`)

  try {
    await applySuggestion(supabase, entityType, entityId, selected)
    console.log(' Suggerimento applicato con successo!')
  } catch (err) {
    console.error(` Errore nell'applicazione: ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  }
}

// ─── Apply suggestion ─────────────────────────────────────────────────────────

/**
 * @param {ReturnType<typeof createClient>} supabase
 * @param {EntityType} entityType
 * @param {string} entityId
 * @param {AiSuggestion} suggestion
 */
async function applySuggestion(supabase, entityType, entityId, suggestion) {
  switch (suggestion.type) {
    case 'convert-to-fattura': {
      if (entityType !== 'bolla') {
        throw new Error('convert-to-fattura è disponibile solo per bolle')
      }
      // Carica bolla per verificare stato
      const { data: bolla, error: bErr } = await supabase
        .from('bolle')
        .select('id, fornitore_id, sede_id, data, file_url, importo, numero_bolla')
        .eq('id', entityId)
        .single()

      if (bErr || !bolla) {
        throw new Error(`Bolla non trovata: ${bErr?.message}`)
      }
      if (!bolla.fornitore_id) {
        throw new Error('La bolla non ha un fornitore associato. Assegna prima un fornitore.')
      }

      const payload = {
        fornitore_id: bolla.fornitore_id,
        sede_id: bolla.sede_id,
        data: bolla.data,
        file_url: bolla.file_url,
        importo: bolla.importo,
        numero_fattura: bolla.numero_bolla?.trim() || null,
      }

      const { data: newFattura, error: insErr } = await supabase
        .from('fatture')
        .insert([payload])
        .select('id')
        .single()

      if (insErr) {
        throw new Error(`Creazione fattura fallita: ${insErr.message}`)
      }

      const { error: delErr } = await supabase
        .from('bolle')
        .delete()
        .eq('id', entityId)

      if (delErr) {
        await supabase.from('fatture').delete().eq('id', newFattura.id)
        throw new Error(`Eliminazione bolla fallita (fattura annullata): ${delErr.message}`)
      }

      console.log(`  Bolla convertita in fattura #${newFattura.id.slice(0, 8)}`)
      break
    }

    case 'assign-supplier': {
      // In modalità interattiva chiediamo l'ID fornitore
      const fornitoreId = await askQuestion('Inserisci l\'ID del fornitore da assegnare: ')
      if (!fornitoreId?.trim()) {
        throw new Error('ID fornitore non valido')
      }

      // Verifica che il fornitore esista
      const { data: forn, error: fornErr } = await supabase
        .from('fornitori')
        .select('id, nome')
        .eq('id', fornitoreId.trim())
        .maybeSingle()

      if (fornErr || !forn) {
        throw new Error(`Fornitore non trovato: ${fornErr?.message ?? 'ID sconosciuto'}`)
      }

      const table = entityType === 'bolla' ? 'bolle' : 'fatture'
      const { error: updErr } = await supabase
        .from(table)
        .update({ fornitore_id: forn.id })
        .eq('id', entityId)

      if (updErr) {
        throw new Error(`Aggiornamento fallito: ${updErr.message}`)
      }

      console.log(`  Fornitore "${forn.nome}" assegnato con successo`)
      break
    }

    case 'not-invoice': {
      // Segnala che il documento potrebbe non essere una fattura
      console.log('  Suggerimento "Non è una fattura" registrato.')
      console.log('  Per cambiare il tipo di documento, usa la UI web.')
      break
    }

    default:
      console.log(`  Suggerimento "${suggestion.type}" non richiede azioni particolari.`)
  }
}

main().catch((err) => {
  console.error('\n Errore:', err instanceof Error ? err.message : String(err))
  process.exit(1)
})
