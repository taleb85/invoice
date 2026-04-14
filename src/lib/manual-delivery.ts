/**
 * Digitalizzazione del ricevuto — consegne senza bolla cartacea.
 *
 * - Parsing AI (gpt-4o-mini) → JSON rigoroso: prodotto, quantità, unità.
 * - Persistenza su `statements` + `statement_rows` + `runTripleCheck` (invariato).
 * - Flag `is_manual_entry: true` nel payload `bolle_json` (array sintetico compatibile con la UI
 *   che si aspetta `bolle_json` come lista di oggetti con id/importo/data/numero_bolla).
 *
 * Riconoscimento triple-check: righe con `numero_doc` prefissato `MANUAL-` sono attese in stato
 * `fattura_mancante` finché non esiste una fattura con numero corrispondente; nessuna modifica a
 * `triple-check.ts` è richiesta per un flusso coerente (confronto importi attivo quando la fattura arriva).
 */

import OpenAI from 'openai'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  runTripleCheck,
  type CheckSummary,
  type StatementLine,
} from '@/lib/triple-check'

const MODEL = 'gpt-4o-mini' as const

/** Riga estratta dall’AI (JSON strutturato richiesto). */
export interface ManualDeliveryLine {
  prodotto: string
  quantita: number
  unita: string
}

/** Voce salvata in `bolle_json` quando non ci sono bolle reali dal triple-check. */
export interface ManualEntryBollaPayload {
  id: string
  numero_bolla: string | null
  importo: number | null
  data: string
  is_manual_entry: true
  prodotto: string
  quantita: number
  unita: string
}

export interface ParseManualDeliveryResult {
  lines: ManualDeliveryLine[]
}

export type SaveManualDigitalReceiptResult =
  | {
      ok: true
      statementId: string
      statementLines: StatementLine[]
      manualLines: ManualDeliveryLine[]
      summary: CheckSummary
    }
  | {
      ok: false
      error: string
      code: 'NO_API_KEY' | 'PARSE_EMPTY' | 'STATEMENT_INSERT' | 'ROWS_INSERT'
    }

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

function slugPart(s: string, max = 24): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, max) || 'item'
}

function buildPrompt(languageHint?: string): string {
  const hint = languageHint
    ? `\nInput language is likely ${languageHint.toUpperCase()}. Accept units and product names in that language.`
    : ''

  return `You extract structured delivery lines from short informal text (mobile warehouse note).${hint}

Examples:
- "5kg calamari, 2 casse limoni" → two rows
- "3 casse mele" → one row

Return ONLY valid JSON — no markdown, no commentary:
{
  "rows": [
    { "prodotto": "calamari", "quantita": 5, "unita": "kg" },
    { "prodotto": "limoni", "quantita": 2, "unita": "casse" }
  ]
}

Rules:
- "prodotto": short noun phrase (the good delivered).
- "quantita": positive number (integer or decimal if user wrote decimals).
- "unita": normalized unit (kg, g, casse, sacchi, pallet, pz, litri, …). If missing, use "pz".
- Split items on commas, semicolons, "e", "and", "&", or new lines.
- Skip empty rows and greetings.`
}

function parseAiRows(content: string): ManualDeliveryLine[] {
  try {
    const cleaned = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (!match) return []
    const parsed = JSON.parse(match[0]) as { rows?: unknown[] }
    if (!Array.isArray(parsed.rows)) return []
    const out: ManualDeliveryLine[] = []
    for (const raw of parsed.rows) {
      const row = raw as Record<string, unknown>
      const prodotto = row.prodotto != null ? String(row.prodotto).trim() : ''
      const quantita = Number(row.quantita)
      if (Number.isNaN(quantita) || quantita <= 0) continue
      let unita = row.unita != null ? String(row.unita).trim() : ''
      if (!unita) unita = 'pz'
      if (!prodotto) continue
      out.push({ prodotto, quantita, unita })
    }
    return out
  } catch {
    return []
  }
}

const VISION_SYSTEM_SUFFIX = `

When the user message includes an image: read handwriting, printed receipts, or delivery lists in the photo and return the same JSON "rows" format. If plain text is also provided, combine it with the image (merge items; skip obvious duplicates).`

/**
 * Testo libero e/o foto → JSON strutturato (prodotto, quantità, unità) via OpenAI.
 */
export async function extractManualDeliveryLines(
  userText: string | undefined | null,
  options?: { languageHint?: string; imageBase64?: string; imageMimeType?: string },
): Promise<ParseManualDeliveryResult | null> {
  const text = userText?.trim() ?? ''
  const imageBase64 = options?.imageBase64?.trim()
  const imageMimeType = options?.imageMimeType?.trim()
  const hasImage = Boolean(imageBase64 && imageMimeType)

  if (!text && !hasImage) return null
  if (!process.env.OPENAI_API_KEY) {
    console.warn('[MANUAL-DELIVERY] OPENAI_API_KEY missing')
    return null
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  if (hasImage) {
    const imageUrl = `data:${imageMimeType!};base64,${imageBase64!}`
    const system = buildPrompt(options?.languageHint) + VISION_SYSTEM_SUFFIX
    const userContent: OpenAI.Chat.ChatCompletionContentPart[] = [
      { type: 'image_url', image_url: { url: imageUrl, detail: 'high' } },
      {
        type: 'text',
        text: text
          ? `The user also wrote:\n${text}`
          : 'Extract every delivered product line from this image.',
      },
    ]
    try {
      const res = await openai.chat.completions.create({
        model: MODEL,
        max_tokens: 1200,
        temperature: 0,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userContent },
        ],
      })
      const lines = parseAiRows(res.choices[0]?.message?.content ?? '')
      if (!lines.length) return null
      return { lines }
    } catch (e) {
      console.error('[MANUAL-DELIVERY] OpenAI vision error:', e)
      return null
    }
  }

  try {
    const res = await openai.chat.completions.create({
      model: MODEL,
      max_tokens: 800,
      temperature: 0,
      messages: [
        { role: 'system', content: buildPrompt(options?.languageHint) },
        { role: 'user', content: text },
      ],
    })
    const lines = parseAiRows(res.choices[0]?.message?.content ?? '')
    if (!lines.length) return null
    return { lines }
  } catch (e) {
    console.error('[MANUAL-DELIVERY] OpenAI error:', e)
    return null
  }
}

/** Costruisce `StatementLine` per il triple-check (importo 0 se non monetario). */
export function manualLinesToStatementLines(
  lines: ManualDeliveryLine[],
  referenceDate?: string,
): StatementLine[] {
  const data = referenceDate && /^\d{4}-\d{2}-\d{2}$/.test(referenceDate) ? referenceDate : todayIsoDate()
  return lines.map((l, i) => {
    const idx = i + 1
    const numero = `MANUAL-${String(idx).padStart(3, '0')}-${slugPart(l.prodotto)}`
    return { numero, importo: 0, data }
  })
}

function displayLine(l: ManualDeliveryLine): string {
  return `${l.quantita} ${l.unita} ${l.prodotto}`.replace(/\s+/g, ' ').trim()
}

function syntheticBolleJson(
  manual: ManualDeliveryLine,
  statementLine: StatementLine,
  rowIndex: number,
): ManualEntryBollaPayload[] {
  return [
    {
      id: `manual-digital-${rowIndex}`,
      numero_bolla: displayLine(manual),
      importo: null,
      data: statementLine.data ?? todayIsoDate(),
      is_manual_entry: true,
      prodotto: manual.prodotto,
      quantita: manual.quantita,
      unita: manual.unita,
    },
  ]
}

/**
 * Salva ricevuto digitale: `statements` + `statement_rows`, triple-check, `bolle_json` con flag
 * `is_manual_entry` quando non ci sono bolle collegate dal motore di check.
 */
export async function saveManualDigitalReceipt(
  supabase: SupabaseClient,
  opts: {
    fornitoreId: string
    sedeId: string | null
    userText: string
    languageHint?: string
    referenceDate?: string
    emailSubject?: string
    imageBase64?: string
    imageMimeType?: string
  },
): Promise<SaveManualDigitalReceiptResult> {
  if (!process.env.OPENAI_API_KEY) {
    return { ok: false, error: 'OPENAI_API_KEY non configurata.', code: 'NO_API_KEY' }
  }

  const parsed = await extractManualDeliveryLines(opts.userText, {
    languageHint: opts.languageHint,
    imageBase64: opts.imageBase64,
    imageMimeType: opts.imageMimeType,
  })
  if (!parsed?.lines.length) {
    return {
      ok: false,
      error: 'Nessuna riga estratta dal testo.',
      code: 'PARSE_EMPTY',
    }
  }

  const { lines: manualLines } = parsed
  const statementLines = manualLinesToStatementLines(manualLines, opts.referenceDate)

  const subject =
    opts.emailSubject ??
    `Ricevuto digitale (consegna senza bolla) — ${manualLines.length} voce/i`

  const { data: stmtRow, error: stmtErr } = await supabase
    .from('statements')
    .insert([
      {
        sede_id: opts.sedeId,
        fornitore_id: opts.fornitoreId,
        email_subject: subject,
        file_url: null,
        status: 'processing',
        total_rows: 0,
        missing_rows: 0,
        received_at: new Date().toISOString(),
      },
    ])
    .select('id')
    .single()

  if (stmtErr || !stmtRow) {
    console.error('[MANUAL-DELIVERY] statements insert:', stmtErr?.message)
    return {
      ok: false,
      error: stmtErr?.message ?? 'Errore creazione statement.',
      code: 'STATEMENT_INSERT',
    }
  }

  const statementId = stmtRow.id as string

  const { results, summary } = await runTripleCheck(
    supabase,
    statementLines,
    opts.sedeId,
    opts.fornitoreId,
  )

  const rowInserts = results.map((r, i) => {
    const manual = manualLines[i]
    const stLine = statementLines[i]
    const realBolle = r.bolle.length ? r.bolle : null
    const manualJson =
      !realBolle && manual && stLine
        ? syntheticBolleJson(manual, stLine, i)
        : null

    return {
      statement_id: statementId,
      numero_doc: r.numero,
      importo: r.importoStatement,
      data_doc: stLine?.data ?? null,
      check_status: r.status,
      delta_importo: r.deltaImporto,
      fattura_id: r.fattura?.id ?? null,
      fattura_numero: r.fattura?.numero_fattura ?? null,
      fornitore_id: r.fornitore?.id ?? opts.fornitoreId,
      bolle_json: realBolle ?? manualJson,
    }
  })

  const { error: rowsErr } = await supabase.from('statement_rows').insert(rowInserts)
  if (rowsErr) {
    console.error('[MANUAL-DELIVERY] statement_rows insert:', rowsErr.message)
    await supabase.from('statements').update({ status: 'error' }).eq('id', statementId)
    return { ok: false, error: rowsErr.message, code: 'ROWS_INSERT' }
  }

  const missingRows = results.filter((x) => x.status !== 'ok').length
  await supabase
    .from('statements')
    .update({
      status: 'done',
      total_rows: results.length,
      missing_rows: missingRows,
    })
    .eq('id', statementId)

  return {
    ok: true,
    statementId,
    statementLines,
    manualLines,
    summary,
  }
}
