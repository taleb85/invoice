/**
 * Parsing conferme d'ordine / email Rekki (testo o HTML).
 * Estrae: prodotto, quantità, prezzo unitario indicato nell'app e totale riga.
 */
import type { StatementLine } from '@/lib/triple-check'

export const REKKI_BOLLE_JSON_NOTE = 'Origine: Rekki - Prezzo da verificare'

export interface RekkiLine {
  prodotto: string
  quantita: number
  /** Prezzo unitario così come riportato nell'app / email Rekki */
  prezzo_unitario: number
  /** quantità × prezzo unitario (arrotondato a 2 decimali) */
  importo_linea: number
}

export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Heuristica: mittente/oggetto/corpo suggeriscono un messaggio Rekki. */
export function isLikelyRekkiEmail(
  subject: string | null | undefined,
  from: string | null | undefined,
  body: string | null | undefined,
): boolean {
  const s = `${subject ?? ''} ${from ?? ''} ${body ?? ''}`.toLowerCase()
  if (s.includes('rekki')) return true
  if (/\border\s*confirm/i.test(subject ?? '') || /\bconferma\s*ordine/i.test(subject ?? '')) {
    return /\b(qty|quantity|qtà|quantità|pcs|each|×|x\s*\d)/i.test(body ?? '')
  }
  return false
}

/**
 * Estrae righe ordine da testo piano.
 * Pattern supportati (anche misti):
 * - "2 x Salmon fillet @ £12.50" / "3 × Pomodori 4.50 EUR"
 * - "Prodotto    Qty    Price" header tabellare
 * - "Salmon  2  12.50" (nome qty prezzo_unit)
 */
export function parseRekkiOrderContent(raw: string): RekkiLine[] {
  if (!raw?.trim()) return []
  const text = raw.replace(/\r\n/g, '\n').trim()
  const lines: RekkiLine[] = []
  const seen = new Set<string>()

  const money = /(?:£|€|\$|EUR|GBP|USD)?\s*(\d{1,6}(?:[.,]\d{2,3})?)\s*(?:£|€|\$|EUR|GBP|USD)?/i

  // Pattern: qty [x×] name [@ price] o name qty price
  const reX = /^(\d+(?:[.,]\d+)?)\s*[x×]\s*(.+?)(?:\s+@\s*|\s+per\s+|\s+)(?:£|€|\$)?\s*(\d+(?:[.,]\d{1,4})?)/i
  const reTail = /^(.+?)\s+(\d+(?:[.,]\d+)?)\s+(?:£|€|\$)?\s*(\d+(?:[.,]\d{1,4})?)\s*$/i

  for (const line of text.split('\n')) {
    const t = line.trim()
    if (t.length < 3) continue
    if (/^(total|subtotal|tax|iva|delivery|ordine|order\s*#)/i.test(t)) continue

    let m = t.match(reX)
    if (m) {
      const qty = parseFloat(m[1].replace(',', '.'))
      const prodotto = m[2].replace(/\s+/g, ' ').trim().replace(/[,;]+$/, '')
      const pu = parseFloat(m[3].replace(',', '.'))
      if (qty > 0 && pu >= 0 && prodotto.length >= 1) {
        const importo_linea = Math.round(qty * pu * 100) / 100
        pushLine(lines, seen, { prodotto, quantita: qty, prezzo_unitario: pu, importo_linea })
      }
      continue
    }

    m = t.match(reTail)
    if (m) {
      const prodotto = m[1].replace(/\s+/g, ' ').trim().replace(/[,;]+$/, '')
      const qty = parseFloat(m[2].replace(',', '.'))
      const pu = parseFloat(m[3].replace(',', '.'))
      if (qty > 0 && pu >= 0 && prodotto.length >= 2 && !/^\d+$/.test(prodotto)) {
        const importo_linea = Math.round(qty * pu * 100) / 100
        pushLine(lines, seen, { prodotto, quantita: qty, prezzo_unitario: pu, importo_linea })
      }
    }
  }

  // Fallback: linee tabulate "nome   2   12.50"
  if (lines.length === 0) {
    for (const line of text.split('\n')) {
      const parts = line.split(/\t+/).map((p) => p.trim()).filter(Boolean)
      if (parts.length >= 3) {
        const last = parts[parts.length - 1]
        const mid = parts[parts.length - 2]
        const name = parts.slice(0, -2).join(' ')
        const qty = parseFloat(mid.replace(',', '.'))
        const puMatch = last.match(money)
        const pu = puMatch ? parseFloat(puMatch[1].replace(',', '.')) : NaN
        if (name.length >= 2 && qty > 0 && !Number.isNaN(pu) && pu >= 0) {
          const importo_linea = Math.round(qty * pu * 100) / 100
          pushLine(lines, seen, { prodotto: name, quantita: qty, prezzo_unitario: pu, importo_linea })
        }
      }
    }
  }

  return lines
}

function pushLine(
  out: RekkiLine[],
  seen: Set<string>,
  row: RekkiLine,
) {
  const key = `${row.prodotto}|${row.quantita}|${row.prezzo_unitario}`
  if (seen.has(key)) return
  seen.add(key)
  out.push(row)
}

function slugPart(s: string, max = 20): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, max) || 'item'
}

/** Converte righe Rekki in righe statement per il triple-check (importo = totale riga Rekki). */
export function rekkiLinesToStatementLines(
  rekkiLines: RekkiLine[],
  referenceDate?: string,
): StatementLine[] {
  const data =
    referenceDate && /^\d{4}-\d{2}-\d{2}$/.test(referenceDate)
      ? referenceDate
      : new Date().toISOString().slice(0, 10)

  return rekkiLines.map((l, i) => {
    const idx = i + 1
    const numero = `REKKI-${String(idx).padStart(3, '0')}-${slugPart(l.prodotto)}`
    const importo = l.importo_linea
    return {
      numero,
      importo,
      data,
      rekki: {
        prodotto: l.prodotto,
        quantita: l.quantita,
        prezzo_unitario: l.prezzo_unitario,
      },
    }
  })
}

export function parseRekkiFromEmailParts(opts: {
  subject?: string | null
  html?: string | null
  text?: string | null
}): RekkiLine[] {
  const plain = opts.text?.trim()
    ? opts.text
    : opts.html
      ? stripHtml(opts.html)
      : ''
  return parseRekkiOrderContent(plain)
}
