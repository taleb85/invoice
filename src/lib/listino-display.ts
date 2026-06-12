import { isBadListinoOcrPrice, listinoHistRefForLineInference } from '@/lib/listino-price-sanity'
import { resolveListinoUnitPriceForDisplay } from '@/lib/listino-invoice-line-normalize'
import type { ListinoImportDocTipo } from '@/lib/listino-import-document'
import type { Locale } from '@/lib/translations/types'

export type { ListinoImportDocTipo }

/** Machine-parseable suffix on `listino_prezzi.note` when saving from invoice import. */
export const LISTINO_SRC_FATTURA_MARK = '|listino_src_fattura:'
/** Machine-parseable suffix when saving from bolla / DDT import. */
export const LISTINO_SRC_BOLLA_MARK = '|listino_src_bolla:'
/** Machine-parseable suffix when saving from conferma ordine import. */
export const LISTINO_SRC_ORDINE_MARK = '|listino_src_ordine:'

const LISTINO_SRC_MARKS = [
  LISTINO_SRC_FATTURA_MARK,
  LISTINO_SRC_BOLLA_MARK,
  LISTINO_SRC_ORDINE_MARK,
] as const

function extractListinoSrcId(
  note: string | null | undefined,
  mark: string,
): string | null {
  if (!note) return null
  const i = note.indexOf(mark)
  if (i < 0) return null
  const rest = note.slice(i + mark.length).trim()
  const uuid = rest.split('|')[0]?.trim()
  return uuid && /^[0-9a-f-]{36}$/i.test(uuid) ? uuid : null
}

export function extractListinoSrcFatturaId(note: string | null | undefined): string | null {
  return extractListinoSrcId(note, LISTINO_SRC_FATTURA_MARK)
}

export function extractListinoSrcBollaId(note: string | null | undefined): string | null {
  return extractListinoSrcId(note, LISTINO_SRC_BOLLA_MARK)
}

export function extractListinoSrcOrdineId(note: string | null | undefined): string | null {
  return extractListinoSrcId(note, LISTINO_SRC_ORDINE_MARK)
}

export type ListinoSrcDocument = { tipo: ListinoImportDocTipo; id: string }

export function extractListinoSrcDocument(
  note: string | null | undefined,
): ListinoSrcDocument | null {
  const fatturaId = extractListinoSrcFatturaId(note)
  if (fatturaId) return { tipo: 'fattura', id: fatturaId }
  const bollaId = extractListinoSrcBollaId(note)
  if (bollaId) return { tipo: 'bolla', id: bollaId }
  const ordineId = extractListinoSrcOrdineId(note)
  if (ordineId) return { tipo: 'ordine', id: ordineId }
  return null
}

/** Note without machine token (for secondary UI / parsing human parts). */
export function stripListinoSrcMachineSuffix(note: string | null | undefined): string {
  if (!note) return ''
  let out = note
  for (const mark of LISTINO_SRC_MARKS) {
    const i = out.indexOf(mark)
    if (i >= 0) out = out.slice(0, i)
  }
  return out.trim().replace(/\s+\|\s*$/, '').trim()
}

export function listinoDocumentOriginLabel(
  tipo: ListinoImportDocTipo,
  data: string,
  numero: string | null,
): string {
  if (tipo === 'fattura') {
    return numero ? `Fattura ${numero} — ${data}` : `Fattura · ${data}`
  }
  if (tipo === 'bolla') {
    return numero ? `Bolla ${numero} — ${data}` : `Bolla · ${data}`
  }
  return numero ? `Ordine ${numero} — ${data}` : `Ordine · ${data}`
}

export function listinoOriginNoteWithSrc(
  baseNote: string | null,
  tipo: ListinoImportDocTipo,
  docId: string,
  originLabel: string,
): string {
  const mark =
    tipo === 'fattura'
      ? LISTINO_SRC_FATTURA_MARK
      : tipo === 'bolla'
        ? LISTINO_SRC_BOLLA_MARK
        : LISTINO_SRC_ORDINE_MARK
  const tail = `Origine: ${originLabel}${mark}${docId}|`
  return baseNote ? `${baseNote} — ${tail}` : `Origine listino — ${tail}`
}

export type ParsedListinoNote = {
  codice: string | null
  unita: string | null
  humanTail: string | null
}

/**
 * Estrae prefisso `Codice: …`, `Unità: …` (o varianti) dalla nota di listino,
 * preservando il resto come `humanTail`.
 *
 * Supporta due formati storici:
 *   1) `Codice: 61025 — Unità: 24x33cl — restante` (separatore em-dash con spazi,
 *      etichette capitalizzate e con accento). Salvato dal flow di import manuale.
 *   2) `codice:61025 · unita:24x33cl · restante` (separatore mezzopunto, etichette
 *      minuscole, senza accento, senza spazi). Salvato dall'auto-import OCR
 *      `/api/listino/importa-da-fattura`.
 *
 * Bug storico: prima del fix solo (1) era riconosciuto, quindi le note OCR (2)
 * cadevano interamente nel `humanTail` e nella UI si vedeva ad es.
 * `Beer Menabrea 61025 · unita:24x33cl · codice:61025 · unita:24x33cl`
 * (le etichette comparivano sia nel badge sia nei metadati testuali).
 */
export function parseListinoNoteParts(note: string | null | undefined): ParsedListinoNote {
  const raw = stripListinoSrcMachineSuffix(note)
  if (!raw) return { codice: null, unita: null, humanTail: null }
  let codice: string | null = null
  let unita: string | null = null
  const parts = raw.split(/\s*(?:—|·)\s*/)
  const tail: string[] = []
  for (const p of parts) {
    const trimmed = p.trim()
    if (!trimmed) continue
    const c = trimmed.match(/^codice\s*:\s*(.+)$/i)
    if (c) {
      const val = c[1]!.trim()
      if (val) codice = val
      continue
    }
    const u = trimmed.match(/^(?:unit[aà])\s*:\s*(.+)$/i)
    if (u) {
      const val = u[1]!.trim()
      if (val) unita = val
      continue
    }
    tail.push(trimmed)
  }
  const humanTail = tail.length ? tail.join(' · ') : null
  return { codice, unita, humanTail }
}

/** Nome prodotto senza suffissi OCR tipo RETURNS (stesso articolo, descrizione diversa). */
export function normalizeListinoProductName(name: string): string {
  return name
    .trim()
    .replace(/\s+returns?\s*$/i, '')
    .replace(/[\s.,;:\-]+$/g, '')
}

/**
 * Chiave di raggruppamento listino: preferisce `codice` dalla nota (es. MWB500),
 * altrimenti nome normalizzato. Evita doppie voci per lo stesso SKU.
 */
export function listinoGroupKey(row: { prodotto: string; note?: string | null }): string {
  const parsed = parseListinoNoteParts(row.note)
  const codice = parsed.codice?.trim()
  if (codice) return `cod:${codice.toUpperCase()}`
  return `name:${normalizeListinoProductName(row.prodotto).toLowerCase()}`
}

/** Etichetta UI per un gruppo di righe (nome più completo, senza RETURNS se possibile). */
export function listinoDisplayLabel(rows: { prodotto: string }[]): string {
  const names = rows.map((r) => r.prodotto.trim()).filter(Boolean)
  if (names.length === 0) return ''
  const withoutReturns = names.filter((n) => !/\breturns?\b/i.test(n))
  const pool = withoutReturns.length ? withoutReturns : names
  return pool.reduce((best, n) => (n.length > best.length ? n : best))
}

/**
 * Etichetta univoca per la UI listino: stesso nome generico (es. "Goods/Services")
 * con codici diversi resta in gruppi separati.
 */
export function listinoDisplayLabelForGroup(
  rows: { prodotto: string; note?: string | null }[],
): string {
  const name = listinoDisplayLabel(rows)
  const codice = parseListinoNoteParts(rows[0]?.note ?? null).codice?.trim()
  if (!codice) return name
  const codiceInName = new RegExp(`\\b${codice.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(
    name,
  )
  if (codiceInName) return name
  return `${name} (${codice})`
}

/** Nomi prodotto alternativi nel gruppo (OCR / righe RETURNS), esclusa l'etichetta principale. */
export function listinoGroupAliasNames(
  rows: { prodotto: string }[],
  displayLabel: string,
): string[] {
  const norm = displayLabel.trim().toLowerCase()
  return [...new Set(rows.map((r) => r.prodotto.trim()).filter((n) => n && n.toLowerCase() !== norm))]
}

/** True se il codice articolo compare già nel titolo riga (es. suffisso tra parentesi). */
export function listinoCodiceShownInTitle(
  productTitle: string,
  codice: string | null | undefined,
): boolean {
  const c = codice?.trim()
  if (!c) return false
  return new RegExp(`\\b${c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(productTitle.trim())
}

function stripParentheticalSuffix(name: string): string {
  return name.trim().replace(/\s*\([^)]*\)\s*$/g, '').trim()
}

function listinoNameTokens(name: string): string[] {
  return normalizeListinoProductName(stripParentheticalSuffix(name))
    .toLowerCase()
    .split(/[\s/·—]+/)
    .map((t) => t.replace(/[^\w]/g, ''))
    .filter(Boolean)
}

function aliasTokensSubsumedByMain(alias: string, displayLabel: string): boolean {
  const aliasTokens = listinoNameTokens(alias)
  if (aliasTokens.length === 0) return true
  const mainSet = new Set(listinoNameTokens(displayLabel))
  return aliasTokens.every((t) => mainSet.has(t))
}

/** Alias OCR da mostrare: esclude varianti quasi identiche al titolo riga. */
export function listinoGroupAliasNamesForDisplay(
  rows: { prodotto: string }[],
  displayLabel: string,
): string[] {
  const aliases = listinoGroupAliasNames(rows, displayLabel)
  const mainNorm = normalizeListinoProductName(displayLabel).toLowerCase()
  const mainCore = normalizeListinoProductName(stripParentheticalSuffix(displayLabel)).toLowerCase()
  return aliases.filter((alias) => {
    if (aliasTokensSubsumedByMain(alias, displayLabel)) return false
    const full = normalizeListinoProductName(alias).toLowerCase()
    const core = normalizeListinoProductName(stripParentheticalSuffix(alias)).toLowerCase()
    if (full === mainNorm || core === mainCore) return false
    if (mainNorm.includes(full) || full.includes(mainNorm)) return false
    if (mainCore.includes(core) || core.includes(mainCore)) return false
    return true
  })
}

function isListinoNoteDateOnlyPart(part: string): boolean {
  const p = part.trim()
  if (/^\d{4}-?$/.test(p)) return true
  if (/^\d{4}-\d{2}-\d{2}$/.test(p)) return true
  if (/^\d{4}-\d{2}$/.test(p)) return true
  return false
}

/** Resto nota listino senza «Origine:» se già mostrata come link in riga. */
export function listinoNoteTailForDisplay(
  humanTail: string | null | undefined,
  opts?: { skipOrigin?: boolean },
): string | null {
  if (!humanTail?.trim()) return null
  let parts = humanTail
    .split(/\s*(?:—|·)\s*/)
    .map((p) => p.trim())
    .filter(Boolean)
  if (opts?.skipOrigin) {
    parts = parts.filter((p) => !/^Origine(\s+listino)?\s*:/i.test(p))
  }
  parts = parts.filter((p) => !isListinoNoteDateOnlyPart(p))
  const joined = parts.join(' · ').trim()
  if (!joined) return null
  if (isListinoNoteDateOnlyPart(joined)) return null
  return joined
}

export function groupListinoRowsByProduct<T extends { prodotto: string; note?: string | null }>(
  rows: T[],
): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const row of rows) {
    const key = listinoGroupKey(row)
    const arr = map.get(key) ?? []
    arr.push(row)
    map.set(key, arr)
  }
  return map
}

/** Record UI: chiave = etichetta display (un gruppo SKU per voce), valore = rilevazioni. */
export function buildListinoByProduct<T extends { prodotto: string; note?: string | null; data_prezzo: string }>(
  rows: T[],
): Record<string, T[]> {
  const grouped = groupListinoRowsByProduct(rows.filter((r) => isListinoCatalogRow(r)))
  const out: Record<string, T[]> = {}
  for (const groupRows of grouped.values()) {
    const label = listinoDisplayLabelForGroup(groupRows)
    out[label] = [...groupRows].sort((a, b) => a.data_prezzo.localeCompare(b.data_prezzo))
  }
  return out
}

/** Voci listino ordinate per data ultima rilevazione (più recenti prima). */
export function listinoProductEntriesByLatestDateDesc<T extends { data_prezzo: string }>(
  byProduct: Record<string, T[]>,
): [string, T[]][] {
  return Object.entries(byProduct).sort(([nameA, rowsA], [nameB, rowsB]) => {
    const latestA = rowsA.reduce((best, r) => (r.data_prezzo > best ? r.data_prezzo : best), '')
    const latestB = rowsB.reduce((best, r) => (r.data_prezzo > best ? r.data_prezzo : best), '')
    const byDate = latestB.localeCompare(latestA)
    if (byDate !== 0) return byDate
    return nameA.localeCompare(nameB, undefined, { sensitivity: 'base' })
  })
}

type PriceRow = { id: string; data_prezzo: string; prezzo: number; note?: string | null }

/** Latest row in calendar month of `dataYmd` (YYYY-MM-DD), excluding `excludeId` if set. */
export function latestListinoInMonth(
  sortedByDateAsc: PriceRow[],
  y: number,
  m: number,
  excludeId?: string,
): PriceRow | null {
  const prefix = `${y}-${String(m).padStart(2, '0')}`
  let best: PriceRow | null = null
  for (const row of sortedByDateAsc) {
    if (excludeId && row.id === excludeId) continue
    if (!row.data_prezzo.startsWith(prefix)) continue
    if (!best || row.data_prezzo > best.data_prezzo) best = row
  }
  return best
}

export function calendarMonthBefore(isoDate: string): { y: number; m: number } {
  const d = isoDate.slice(0, 10)
  const [ys, ms] = d.split('-')
  const y = Number(ys)
  const mo = Number(ms)
  if (!Number.isFinite(y) || !Number.isFinite(mo)) return { y: 1970, m: 1 }
  if (mo <= 1) return { y: y - 1, m: 12 }
  return { y, m: mo - 1 }
}

const INTL_LOCALE: Record<Locale, string> = {
  it: 'it-IT',
  en: 'en-GB',
  es: 'es-ES',
  fr: 'fr-FR',
  de: 'de-DE',
}

/** Percentuale variazione listino leggibile (es. 3496,6 → «+3.497%» in it-IT). */
export function formatListinoPriceChangePct(pct: number, locale: Locale = 'it'): string {
  if (!Number.isFinite(pct)) return '0%'
  const abs = Math.abs(pct)
  if (abs < 0.05) return '0%'
  const sign = pct > 0 ? '+' : '-'
  const maximumFractionDigits = abs >= 100 ? 0 : abs >= 10 ? 0 : 1
  const formatted = new Intl.NumberFormat(INTL_LOCALE[locale] ?? 'it-IT', {
    maximumFractionDigits,
    minimumFractionDigits: 0,
    useGrouping: true,
  }).format(abs)
  return `${sign}${formatted}%`
}

/**
 * Reference price: latest entry in the calendar month before `ultimo.data_prezzo`;
 * if none, uses chronologically previous row (penultimate in sorted list).
 */
export function referencePriceForListinoRow(
  sortedByDateAsc: PriceRow[],
  ultimo: PriceRow,
): { ref: PriceRow | null; mode: 'prior_month' | 'previous_entry' } {
  const { y, m } = calendarMonthBefore(ultimo.data_prezzo)
  const inMonth = latestListinoInMonth(sortedByDateAsc, y, m)
  if (inMonth) return { ref: inMonth, mode: 'prior_month' }
  if (sortedByDateAsc.length < 2) return { ref: null, mode: 'previous_entry' }
  const idx = sortedByDateAsc.findIndex((r) => r.id === ultimo.id)
  if (idx <= 0) return { ref: null, mode: 'previous_entry' }
  return { ref: sortedByDateAsc[idx - 1]!, mode: 'previous_entry' }
}

/**
 * Riconosce righe "promozione" (sconti, bundle, omaggi) che NON sono
 * prodotti comparabili. Esempi visti in produzione (Del Italia):
 *   - prodotto `Menabrea Deal`, codice `61MENABREA` → riga-sconto bundle 6+1
 *   - codice contenente `FOC`, `OMAGGIO`, `DEAL`, `PROMO`, `OFFERTA`
 * Da nascondere nel dashboard "Analisi prezzi" e nei calcoli trend/anomalie.
 */
/*
 * Niente \b davanti perché tokens come `DEAL` compaiono spesso suffisso di
 * codice (es. `61MENABREA_DEAL`, `WINEDEAL2026`). \b dopo è invece utile per
 * non matchare `dealer`/`dealership`. Per `foc` lasciamo case-insensitive ma
 * richiediamo che sia parola intera per non innescare su `focaccia` ecc.
 */
/*
 * Niente \b davanti perché tokens come `DEAL` compaiono spesso suffisso di
 * codice (es. `61MENABREA_DEAL`, `WINEDEAL2026`). Per `foc` cerchiamo varianti
 * come `FOC`, `FOC123`, `FOC-something` ma escludiamo `focaccia` etc. usando
 * \bfoc (inizio parola, free dopo).
 */
const PROMO_TOKENS_REGEX =
  /(deal|promo|promotion|promotional|\bfoc\b|\bfoc[0-9_\-]|free\s*of\s*charge|omaggio|sconto|discount|offerta|bundle|6\s*\+\s*1|\bgift\b)/i

export function isPromoListinoRow(row: { prodotto: string; note?: string | null }): boolean {
  if (PROMO_TOKENS_REGEX.test(row.prodotto)) return true
  const parsed = parseListinoNoteParts(row.note ?? null)
  if (parsed.codice && PROMO_TOKENS_REGEX.test(parsed.codice)) return true
  if (parsed.humanTail && PROMO_TOKENS_REGEX.test(parsed.humanTail)) return true
  return false
}

/** Righe fattura OCR che non sono articoli (istruzioni consegna, telefoni, note logistiche). */
const NON_PRODUCT_LISTINO_REGEXES = [
  /\bdelivery\b/i,
  /\bconsegna\b/i,
  /\bspedizione\b/i,
  /\bfreight\b/i,
  /\bhandball\s+drop\b/i,
  /\bdrop\s+based\s+on\b/i,
  /\bor\s+after\b/i,
  /\bfrom\s+\d{1,2}\s*[-–]\s*\d{1,2}\b/i,
  /\b0\d{9,11}\b/,
  /\bsales\s+orders?\b/i,
  /\bminimum\s+order\b/i,
  /\bcarriage\s+paid\b/i,
  /\bdelivery\s+charge\b/i,
  /\bservice\s+charge\b/i,
] as const

function listinoRowHasSku(row: { prodotto: string; note?: string | null }): boolean {
  const codice = parseListinoNoteParts(row.note ?? null).codice?.trim()
  if (codice) return true
  const first = row.prodotto.trim().split(/\s+/)[0] ?? ''
  return /^[A-Z]{1,6}\d{2,}[A-Z0-9]*$/i.test(first)
}

/** Nome articolo reale (vino, birra, confezione) anche senza codice in nota. */
function looksLikeCatalogProductDescription(name: string): boolean {
  if (/\d+\s*[xX×]\s*\d+\s*(?:cl|ml|l|lt|ltr)\b/i.test(name)) return true
  if (/\b(?:doc|docg|igt|igp|aoc|aop|750\s?ml)\b/i.test(name)) return true
  if (
    /\b(?:pinot|chardonnay|sauvignon|merlot|cabernet|prosecco|grigio|brut|spumante|riesling|shiraz|malbec)\b/i.test(
      name,
    )
  ) {
    return true
  }
  if (/\b(?:wine|vino|beer|lager|ale|cider|spirit|vodka|gin|whisky|whiskey|champagne|cava)\b/i.test(name)) {
    return true
  }
  return false
}

/**
 * Testo descrittivo / logistico importato per errore dal PDF fattura (es. fascia oraria
 * consegna + telefono + «10 CASE Drop Based On Sales Orders»).
 */
export function isNonProductListinoRow(row: { prodotto: string; note?: string | null }): boolean {
  const name = row.prodotto.trim()
  if (!name) return true
  const hay = `${name} ${stripListinoSrcMachineSuffix(row.note ?? null)}`
  for (const re of NON_PRODUCT_LISTINO_REGEXES) {
    if (re.test(hay)) return true
  }
  if (!listinoRowHasSku(row)) {
    if (looksLikeCatalogProductDescription(name)) return false
    if (/\b\d+\s+case\b/i.test(name) && /\bdrop\b/i.test(name)) return true
    const words = name.split(/\s+/).filter(Boolean)
    if (words.length >= 8 && name.length >= 48) return true
  }
  return false
}

/** Esclude promo e righe non-prodotto da raggruppamento UI / analisi. */
export function isListinoCatalogRow(row: { prodotto: string; note?: string | null }): boolean {
  return !isPromoListinoRow(row) && !isNonProductListinoRow(row)
}

/**
 * Calcola la mediana di un array di numeri (ignora NaN/Infinity).
 */
function median(values: number[]): number {
  const cleaned = values.filter((v) => Number.isFinite(v))
  if (cleaned.length === 0) return 0
  const sorted = [...cleaned].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!
}

/**
 * Filtra outlier dai prezzi di un singolo prodotto per trend e display.
 *
 * Motivazione: l'OCR legge colonne diverse (qty, unitario, totale riga).
 * Es. Beer Menabrea Blonde: £1.48, £7.00 (qty), £35.66/£36.04 (cassa 24×).
 * Con mediana semplice restava il cluster basso (qty/unitario) e si scartavano
 * i prezzi-cassa corretti — il contrario di quanto serve.
 *
 * Strategia bimodale: se max/min > 2.5×, tieni solo prezzi ≥ 50% del massimo
 * (cluster alto = prezzo listino reale). Altrimenti, banda ±50% attorno alla
 * mediana per serie omogenee.
 */
export function filterOutliersForTrend<T extends { prezzo: number }>(rows: T[]): T[] {
  if (rows.length < 4) return rows
  const prices = rows.map((r) => r.prezzo).filter((p) => p > 0 && Number.isFinite(p))
  if (prices.length < 4) return rows
  const minP = Math.min(...prices)
  const maxP = Math.max(...prices)
  if (maxP <= 0) return rows

  let kept: T[]
  if (minP > 0 && maxP / minP > 2.5) {
    const cutoff = maxP * 0.5
    kept = rows.filter((r) => r.prezzo >= cutoff)
  } else {
    const m = median(prices)
    if (m <= 0) return rows
    const lo = m * 0.5
    const hi = m * 1.5
    kept = rows.filter((r) => r.prezzo >= lo && r.prezzo <= hi)
  }

  return kept.length >= 2 ? kept : rows
}

/**
 * Riga da mostrare come "prezzo attuale" in ListinoTab.
 * Se l'ultima rilevazione cronologica è un outlier OCR (es. qty 7 al posto
 * di £36.04), usa l'ultima voce del cluster plausibile.
 */
export function pickDisplayListinoRow<T extends PriceRow>(sortedByDateAsc: T[]): T {
  if (sortedByDateAsc.length === 0) {
    throw new Error('pickDisplayListinoRow: empty input')
  }
  if (sortedByDateAsc.length === 1) {
    const only = sortedByDateAsc[0]!
    return only
  }
  const latest = sortedByDateAsc[sortedByDateAsc.length - 1]!
  const otherPrices = sortedByDateAsc.slice(0, -1).map((r) => r.prezzo)
  if (otherPrices.length >= 2 && isBadListinoOcrPrice(latest.prezzo, otherPrices)) {
    return pickDisplayListinoRow(sortedByDateAsc.slice(0, -1))
  }
  /*
   * Non scartare l’ultima riga solo perché filterOutliersForTrend la esclude:
   * un aumento reale (es. £15,23 → £22,84) finirebbe altrimenti nel cluster
   * basso. Il filtro resta per trend/riferimento, non per il prezzo in evidenza.
   */
  return latest
}

/** Prezzo unitario effettivo per UI (corregge totale riga / IVA inclusa OCR). */
export function displayListinoUnitPrice(row: PriceRow, sortedByDateAsc: PriceRow[]): number {
  const others = sortedByDateAsc.filter((r) => r.id !== row.id).map((r) => r.prezzo)
  return resolveListinoUnitPriceForDisplay(row.prezzo, row.note, others)
}

/**
 * Formato confezione UK «x 12» / «X12»: il prezzo listino è per cassa, non per bottiglia.
 */
export function isListinoCaseUnitFormat(unita: string | null | undefined): boolean {
  const u = (unita ?? '').trim()
  if (!u) return false
  // «x 12» / «x12» = cassa; non «X6» (confezione da 6, come 6x75cl)
  if (/^[xX×]\s+\d{1,3}(?:\s*(?:cl|ml|l|lt|ltr|g|kg))?$/i.test(u)) return true
  return /^[xX×]\d{2,3}(?:\s*(?:cl|ml|l|lt|ltr|g|kg))?$/i.test(u)
}

/**
 * Pezzi per confezione da `Unità:` in nota listino (es. 6 da `6x75cl`, 24 da `24x33cl`).
 * Non è la quantità ordinata in fattura (`Qtà fattura:`) né il formato cassa `x 12`.
 */
export function parsePackSizeFromListinoUnita(unita: string | null | undefined): number | null {
  const u = (unita ?? '').trim()
  if (!u || isListinoCaseUnitFormat(u)) return null
  const nx = u.match(/^(\d{1,3})\s*[xX×]\d/)
  if (nx) {
    const n = parseInt(nx[1]!, 10)
    if (n >= 2 && n <= 999) return n
  }
  const xOnly = u.match(/^X(\d{1,3})$/i)
  if (xOnly) {
    const n = parseInt(xOnly[1]!, 10)
    if (n >= 2 && n <= 999) return n
  }
  return null
}

function listinoPriceAmountsClose(a: number, b: number, rel = 0.18): boolean {
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return false
  return Math.abs(a - b) / Math.abs(b) <= rel
}

/** Confezione vino/spirits tipo `6x75cl` (non cassa UK `x 12`). */
function listinoUnitaIsBottlePack(unita: string | null | undefined): boolean {
  return /\d\s*[xX×]\s*\d+\s*cl/i.test((unita ?? '').trim())
}

/**
 * Quando il prezzo in evidenza è per l'intera confezione (es. £63,66 per 6×75cl),
 * restituisce il prezzo a pezzo da mostrare sotto il totale confezione.
 */
export function listinoPerPiecePriceHint(opts: {
  displayUnitPrice: number
  unita: string | null | undefined
  otherPrices: number[]
}): { packSize: number; perPiecePrice: number } | null {
  const packSize = parsePackSizeFromListinoUnita(opts.unita)
  if (!packSize || packSize < 2) return null
  if (!Number.isFinite(opts.displayUnitPrice) || opts.displayUnitPrice <= 0) return null

  const perPiecePrice = Math.round((opts.displayUnitPrice / packSize) * 100) / 100
  if (!Number.isFinite(perPiecePrice) || perPiecePrice <= 0) return null
  if (perPiecePrice >= opts.displayUnitPrice * 0.999) return null

  const unita = opts.unita ?? ''
  const bottlePack = listinoUnitaIsBottlePack(unita)
  const minCaseTotalForHint = packSize * 2.5

  // Prezzo già a bottiglia/pezzo (es. £10,61 con unità 6x75cl), non dividere.
  if (bottlePack && opts.displayUnitPrice < minCaseTotalForHint) return null

  const hist = opts.otherPrices.filter((p) => Number.isFinite(p) && p > 0)
  if (hist.length > 0) {
    const ref = listinoHistRefForLineInference(hist)
    if (listinoPriceAmountsClose(opts.displayUnitPrice, ref, 0.18)) {
      return { packSize, perPiecePrice }
    }
    if (opts.displayUnitPrice > ref * 1.2) {
      return { packSize, perPiecePrice }
    }
    return null
  }

  return { packSize, perPiecePrice }
}

/**
 * Soglia dinamica "prezzo storico/scaduto" per un singolo prodotto, in giorni.
 *
 * Invece di usare 60 giorni fissi (che marcano stale anche prodotti acquistati
 * trimestralmente o promo natalizie), calcola la mediana degli intervalli
 * effettivi tra rilevazioni e usa `mediana × 2` come soglia di freschezza
 * (range: min 30, max 365). Esempi:
 *   - acqua acquistata ogni 7gg → stale dopo 14gg
 *   - vino acquistato ogni 60gg → stale dopo 120gg
 *   - promo natalizia (1 acquisto/anno) → 365gg (mai stale entro l'anno)
 */
export function dynamicStaleThresholdDays(sortedDataPrezzoAsc: string[]): number {
  const DEFAULT = 60
  const MIN = 30
  const MAX = 365
  if (sortedDataPrezzoAsc.length < 3) return DEFAULT
  const intervals: number[] = []
  for (let i = 1; i < sortedDataPrezzoAsc.length; i++) {
    const a = Date.parse(sortedDataPrezzoAsc[i - 1]!)
    const b = Date.parse(sortedDataPrezzoAsc[i]!)
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue
    const diffDays = Math.round((b - a) / (1000 * 60 * 60 * 24))
    if (diffDays > 0) intervals.push(diffDays)
  }
  if (intervals.length === 0) return DEFAULT
  const med = median(intervals)
  const proposed = Math.round(med * 2)
  if (proposed < MIN) return MIN
  if (proposed > MAX) return MAX
  return proposed
}

function verificaProductTokens(name: string): string[] {
  return normalizeListinoProductName(name)
    .toLowerCase()
    .replace(/[+&/]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3)
}

/** Confronto fuzzy tra nomi listino e righe estratto (OCR / Rekki). */
export function productNamesMatchForVerifica(a: string, b: string): boolean {
  const na = normalizeListinoProductName(a).toLowerCase()
  const nb = normalizeListinoProductName(b).toLowerCase()
  if (!na || !nb) return false
  if (na === nb) return true
  // Evita falsi positivi (es. numero fattura "A" ⊆ "…xyz…" per la lettera «a»).
  const minSub = 4
  if (na.length >= minSub && nb.length >= minSub) {
    if (na.includes(nb) || nb.includes(na)) return true
  }
  const ta = verificaProductTokens(a)
  const tb = verificaProductTokens(b)
  if (ta.length === 0 || tb.length === 0) return false
  const shared = ta.filter((t) =>
    tb.some((u) => u === t || u.includes(t) || t.includes(u)),
  )
  const minLen = Math.min(ta.length, tb.length)
  return shared.length >= Math.max(2, Math.ceil(minLen * 0.5))
}

function codiceMatchesVerificaNeedle(codice: string, ...haystacks: string[]): boolean {
  const c = codice.trim().toLowerCase()
  if (!c || c.length < 3) return false
  for (const h of haystacks) {
    const t = h.trim().toLowerCase()
    if (!t) continue
    if (t === c) return true
    if (c.length >= 4 && t.includes(c)) return true
    if (t.length >= 4 && c.includes(t)) return true
  }
  return false
}

export function checkResultMatchesVerificaProdotto(
  r: {
    numero: string
    bolle: { id: string; numero_bolla: string | null; importo: number | null; data: string }[]
  },
  needle: string,
  codice?: string | null,
): boolean {
  const n = needle.trim()
  const code = codice?.trim() ?? ''
  if (!n && !code) return true

  if (n) {
    if (productNamesMatchForVerifica(n, r.numero)) return true
  }
  if (code && codiceMatchesVerificaNeedle(code, r.numero)) return true

  for (const b of r.bolle as unknown[]) {
    if (!b || typeof b !== 'object') continue
    const o = b as Record<string, unknown>
    const meta = o.rekki_meta
    if (meta && typeof meta === 'object') {
      const m = meta as Record<string, unknown>
      const prod = String(m.prodotto ?? '')
      const sku = String(m.codice ?? m.sku ?? m.product_code ?? '')
      if (n && prod && productNamesMatchForVerifica(n, prod)) return true
      if (code && codiceMatchesVerificaNeedle(code, prod, sku)) return true
    }
    const nb = String(o.numero_bolla ?? '')
    if (n && nb && productNamesMatchForVerifica(n, nb)) return true
    if (code && codiceMatchesVerificaNeedle(code, nb)) return true
  }
  return false
}

export type VerificaDisplayMode =
  | 'strict'
  | 'product_relaxed'
  | 'stmt_anomalies'
  | 'status_relaxed'
  | 'all_fallback'
  | 'empty'

/** Righe da mostrare in Verifica con fallback se il filtro prodotto/stato non trova nulla. */
export function resolveVerificaDisplayRows<T extends {
  numero: string
  status: string
  bolle: { id: string; numero_bolla: string | null; importo: number | null; data: string }[]
}>(
  checkResults: T[],
  opts: {
    checkFilter: string
    verificaProdotto: string
    verificaCodice?: string | null
    deepLink?: boolean
  },
): { rows: T[]; mode: VerificaDisplayMode } {
  const { checkFilter, verificaProdotto, verificaCodice, deepLink } = opts
  const byProduct = (rows: T[]) =>
    !verificaProdotto.trim() && !verificaCodice?.trim()
      ? rows
      : rows.filter((r) => checkResultMatchesVerificaProdotto(r, verificaProdotto, verificaCodice))
  const byStatus = (rows: T[]) =>
    checkFilter === 'all' ? rows : rows.filter((r) => r.status === checkFilter)

  const strict = byStatus(byProduct(checkResults))
  if (strict.length > 0) return { rows: strict, mode: 'strict' }

  const productOnly = byProduct(checkResults)
  if (verificaProdotto.trim() && productOnly.length > 0) {
    return { rows: productOnly, mode: 'product_relaxed' }
  }

  const anomalies = checkResults.filter((r) => r.status !== 'ok' && r.status !== 'pending')
  if (verificaProdotto.trim() && anomalies.length > 0) {
    const anomalyFiltered = byStatus(anomalies)
    return {
      rows: anomalyFiltered.length > 0 ? anomalyFiltered : anomalies,
      mode: 'stmt_anomalies',
    }
  }

  if (checkFilter !== 'all') {
    const statusOnly = byStatus(checkResults)
    if (statusOnly.length > 0) return { rows: statusOnly, mode: 'status_relaxed' }
  }

  if (deepLink && checkResults.length > 0) {
    return { rows: checkResults, mode: 'all_fallback' }
  }

  return { rows: [], mode: 'empty' }
}
