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
 * Parses "Codice: … — Unità: … — …" prefix from import flow; keeps remainder as `humanTail`.
 */
export function parseListinoNoteParts(note: string | null | undefined): ParsedListinoNote {
  const raw = stripListinoSrcMachineSuffix(note)
  if (!raw) return { codice: null, unita: null, humanTail: null }
  let codice: string | null = null
  let unita: string | null = null
  const parts = raw.split(/\s+—\s+/)
  const tail: string[] = []
  for (const p of parts) {
    const c = p.match(/^Codice:\s*(.+)$/i)
    if (c) {
      codice = c[1]!.trim() || null
      continue
    }
    const u = p.match(/^Unità:\s*(.+)$/i)
    if (u) {
      unita = u[1]!.trim() || null
      continue
    }
    tail.push(p)
  }
  const humanTail = tail.length ? tail.join(' — ') : null
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
  let y = Number(ys)
  let mo = Number(ms)
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
