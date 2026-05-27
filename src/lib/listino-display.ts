/** Machine-parseable suffix on `listino_prezzi.note` when saving from invoice import. */
export const LISTINO_SRC_FATTURA_MARK = '|listino_src_fattura:'

export function extractListinoSrcFatturaId(note: string | null | undefined): string | null {
  if (!note) return null
  const i = note.indexOf(LISTINO_SRC_FATTURA_MARK)
  if (i < 0) return null
  const rest = note.slice(i + LISTINO_SRC_FATTURA_MARK.length).trim()
  const uuid = rest.split('|')[0]?.trim()
  return uuid && /^[0-9a-f-]{36}$/i.test(uuid) ? uuid : null
}

/** Note without machine token (for secondary UI / parsing human parts). */
export function stripListinoSrcMachineSuffix(note: string | null | undefined): string {
  if (!note) return ''
  const i = note.indexOf(LISTINO_SRC_FATTURA_MARK)
  return (i < 0 ? note : note.slice(0, i)).trim().replace(/\s+\|\s*$/, '').trim()
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

type PriceRow = { id: string; data_prezzo: string; prezzo: number }

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
 * Filtra outlier dai prezzi di un singolo prodotto per il calcolo del trend.
 *
 * Motivazione: i prezzi nel listino vengono estratti dall'OCR da diverse
 * colonne della stessa fattura (lordo riga vs. unitario vs. sconto vs. totale).
 * Per "Beer Menabrea Blonde" abbiamo visto serie come
 *   £1.48, £5.02, £7.00, £10.40, £12.84, £35.66, £36.04
 * dove £35.66/£36.04 sono i prezzi-cassa veri (24 bottiglie × £1.49) e gli
 * altri sono unitari di bottiglia singola o sconti volumetrici. Mescolarli
 * fa esplodere il trend (es. +414%).
 *
 * Strategia: tieni solo i prezzi che cadono entro ±50% della mediana del
 * cluster (1ª stima). Serve almeno 4 punti, sotto questa soglia non filtra.
 * Nei test: per la serie sopra, mediana = 8.7, range [4.35, 13.05] → tiene
 * 5.02/7.00/7.00/10.40/12.84 e scarta 1.48/35.66/35.66/36.04. Ancora non
 * perfetto ma utilizzabile.
 *
 * NB: questo filtro è SOLO per analisi/trend, NON per la visualizzazione
 * dello storico (l'utente vede ancora tutti i prezzi).
 */
export function filterOutliersForTrend<T extends { prezzo: number }>(rows: T[]): T[] {
  if (rows.length < 4) return rows
  const m = median(rows.map((r) => r.prezzo))
  if (m <= 0) return rows
  const lo = m * 0.5
  const hi = m * 1.5
  const kept = rows.filter((r) => r.prezzo >= lo && r.prezzo <= hi)
  // Safety: se il filtro ha azzerato la serie, ritorna l'input (fallback).
  return kept.length >= 2 ? kept : rows
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

export function checkResultMatchesVerificaProdotto(
  r: {
    numero: string
    bolle: { id: string; numero_bolla: string | null; importo: number | null; data: string }[]
  },
  needle: string,
): boolean {
  const n = needle.trim().toLowerCase()
  if (!n) return true
  if (r.numero.toLowerCase().includes(n)) return true
  for (const b of r.bolle as unknown[]) {
    if (!b || typeof b !== 'object') continue
    const o = b as Record<string, unknown>
    const meta = o.rekki_meta
    if (meta && typeof meta === 'object') {
      const prod = String((meta as Record<string, unknown>).prodotto ?? '').toLowerCase()
      if (prod && (prod.includes(n) || n.includes(prod))) return true
    }
    const nb = String(o.numero_bolla ?? '').toLowerCase()
    if (nb.includes(n)) return true
  }
  return false
}
