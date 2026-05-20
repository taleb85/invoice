/**
 * Shared triple-check logic.
 *
 * Can be called from:
 *   - /api/triple-check-statement  (interactive API)
 *   - scan-emails processing       (automatic background check)
 *
 * For each statement line ({ numero, importo }):
 *   1. Find matching fattura by numero_fattura (ilike)
 *   2. Find associated bolle (via bolla_id FK + importo/data)
 *   3. Compare amounts (`TRIPLE_CHECK_TOLERANCE`); Rekki vs fattura usa `REKKI_VS_FATTURA_TOLERANCE`.
 *
 * Returns an array of CheckResult objects.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeNumeroFattura } from '@/lib/fattura-duplicate-check'

export type CheckStatus =
  | 'ok'                       // ✅ verde   — fattura + bolle + importi OK
  | 'fattura_mancante'         // 🟡 giallo  — nessuna fattura trovata
  | 'bolle_mancanti'           // 🟠 arancio — fattura presente, bolle mancanti
  | 'errore_importo'           // 🔴 rosso   — documenti presenti, importo non coincide
  | 'rekki_prezzo_discordanza' // 🟠 ambra   — fattura/bolle coerenti tra loro ma importo Rekki ≠ fattura

/** Metadati riga ordine Rekki (prezzo indicativo app). */
export interface RekkiLineMeta {
  prodotto: string
  quantita: number
  prezzo_unitario: number
}

export interface StatementLine {
  numero:  string
  importo: number
  data?:   string | null
  /** Se presente, la riga statement proviene da Rekki (prezzo da verificare vs fornitore). */
  rekki?:  RekkiLineMeta
}

export interface CheckResult {
  numero:           string
  importoStatement: number
  status:           CheckStatus
  fattura: {
    id:             string
    numero_fattura: string | null
    importo:        number | null
    data:           string
    file_url:       string | null
    fornitore_id:   string
  } | null
  bolle: {
    id:           string
    numero_bolla: string | null
    importo:      number | null
    data:         string
  }[]
  deltaImporto: number | null   // statement − DB (negativo = DB maggiore)
  fornitore: {
    id:    string
    nome:  string
    email: string | null
  } | null
}

export interface CheckSummary {
  ok:                        number
  fattura_mancante:          number
  bolle_mancanti:            number
  errore_importo:            number
  rekki_prezzo_discordanza:  number
}

/** Tolleranza generale triple-check (fattura ↔ riga estratto ↔ bolle). */
export const TRIPLE_CHECK_TOLERANCE = 0.05

/**
 * Tolleranza stretta Rekki: totale ordine app vs importo fattura.
 * Oltre questa soglia → `rekki_prezzo_discordanza` (se fattura e bolle sono coerenti tra loro).
 */
export const REKKI_VS_FATTURA_TOLERANCE = 0.01

/** Stati bolla considerati per il match (DDT registrato, anche se fattura non ancora chiusa). */
export const TRIPLE_CHECK_BOLLA_STATI = ['completato', 'in attesa'] as const

export type TripleCheckBollaRow = {
  id: string
  numero_bolla: string | null
  importo: number | null
  data: string
  fornitore_id: string
}

type FatturaMatchInput = {
  fornitore_id: string
  data: string
  importo: number | null
  bolla_id: string | null
}

type FatturaRow = {
  id: string; numero_fattura: string | null; importo: number | null
  data: string; file_url: string | null; fornitore_id: string; bolla_id: string | null
  fornitori: { id: string; nome: string; email: string | null } |
             { id: string; nome: string; email: string | null }[] | null
}

export function amountsMatchForTripleCheck(a: number, b: number, tolerance = TRIPLE_CHECK_TOLERANCE): boolean {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false
  return Math.abs(a - b) <= tolerance
}

function dateWindowIso(centerIso: string, daysBefore: number, daysAfter: number): { from: string; to: string } {
  const center = new Date(`${centerIso.slice(0, 10)}T12:00:00Z`)
  const from = new Date(center)
  from.setUTCDate(from.getUTCDate() - daysBefore)
  const to = new Date(center)
  to.setUTCDate(to.getUTCDate() + daysAfter)
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }
}

function daysFromCenter(centerIso: string, dateIso: string): number {
  const center = new Date(`${centerIso.slice(0, 10)}T12:00:00Z`).getTime()
  const other = new Date(`${dateIso.slice(0, 10)}T12:00:00Z`).getTime()
  return Math.abs(Math.round((other - center) / 86_400_000))
}

/**
 * Trova le bolle collegate a una fattura senza sommare tutte le DDT del periodo
 * (evita falsi `bolle_mancanti` quando fattura SI* e bolla SDN* hanno numeri diversi).
 */
export function findMatchingBolleForFattura(
  rawFattura: FatturaMatchInput,
  bollePool: TripleCheckBollaRow[],
  lineImporto: number,
): TripleCheckBollaRow[] {
  if (rawFattura.bolla_id) {
    const linked = bollePool.find((b) => b.id === rawFattura.bolla_id)
    if (linked) return [linked]
  }

  const targetAmount = lineImporto > 0 ? lineImporto : (rawFattura.importo ?? 0)
  const sameSupplier = (b: TripleCheckBollaRow) => b.fornitore_id === rawFattura.fornitore_id

  const matchByAmountInWindow = (daysBefore: number, daysAfter: number): TripleCheckBollaRow[] => {
    const { from, to } = dateWindowIso(rawFattura.data, daysBefore, daysAfter)
    const candidates = bollePool.filter(
      (b) =>
        sameSupplier(b) &&
        b.data >= from &&
        b.data <= to &&
        b.importo != null &&
        amountsMatchForTripleCheck(b.importo, targetAmount),
    )
    if (candidates.length === 0) return []
    candidates.sort((a, b) => daysFromCenter(rawFattura.data, a.data) - daysFromCenter(rawFattura.data, b.data))
    return [candidates[0]]
  }

  for (const [before, after] of [[7, 7], [14, 14], [45, 5]] as const) {
    const matched = matchByAmountInWindow(before, after)
    if (matched.length) return matched
  }

  const sameDay = bollePool.filter((b) => sameSupplier(b) && b.data === rawFattura.data)
  if (sameDay.length === 1) return sameDay

  return []
}

function resolveCheckStatus(
  line: StatementLine,
  rawFattura: FatturaRow,
  bolle: TripleCheckBollaRow[],
): { status: CheckStatus; delta: number } {
  const dbImporto = rawFattura.importo ?? 0
  const delta = parseFloat((line.importo - dbImporto).toFixed(2))
  const importiCombaciano = amountsMatchForTripleCheck(line.importo, dbImporto)

  let status: CheckStatus
  if (!importiCombaciano) {
    status = 'errore_importo'
  } else if (bolle.length === 0) {
    status = 'bolle_mancanti'
  } else {
    const bolleSum = bolle.reduce((s, b) => s + (b.importo ?? 0), 0)
    const bolleOk =
      amountsMatchForTripleCheck(bolleSum, line.importo) &&
      amountsMatchForTripleCheck(bolleSum, dbImporto)
    status = bolleOk ? 'ok' : 'bolle_mancanti'
  }

  return { status, delta }
}

export async function runTripleCheck(
  supabase:     SupabaseClient,
  lines:        StatementLine[],
  sede_id?:     string | null,
  fornitore_id?: string | null,
): Promise<{ results: CheckResult[]; summary: CheckSummary }> {
  const results: CheckResult[] = []

  if (lines.length === 0) {
    return { results, summary: { ok: 0, fattura_mancante: 0, bolle_mancanti: 0, errore_importo: 0, rekki_prezzo_discordanza: 0 } }
  }

  const baseFattureQ = supabase
    .from('fatture')
    .select('id, numero_fattura, importo, data, file_url, fornitore_id, bolla_id, fornitori(id, nome, email)')
  let fattureQ: typeof baseFattureQ = baseFattureQ
  if (sede_id)      fattureQ = fattureQ.eq('sede_id',      sede_id)
  if (fornitore_id) fattureQ = fattureQ.eq('fornitore_id', fornitore_id)
  const { data: allFattureRaw } = await fattureQ
  const fatturePool = (allFattureRaw ?? []) as FatturaRow[]

  const baseBolleQ = supabase
    .from('bolle')
    .select('id, numero_bolla, importo, data, fornitore_id')
    .in('stato', [...TRIPLE_CHECK_BOLLA_STATI])
  let bolleQ: typeof baseBolleQ = baseBolleQ
  if (sede_id)      bolleQ = bolleQ.eq('sede_id',      sede_id)
  if (fornitore_id) bolleQ = bolleQ.eq('fornitore_id', fornitore_id)
  const { data: allBolleRaw } = await bolleQ
  const bollePool = (allBolleRaw ?? []) as TripleCheckBollaRow[]

  for (const line of lines) {
    const numNorm = normalizeNumeroFattura(line.numero)
    const rawFattura = fatturePool.find(
      (f) => f.numero_fattura != null && normalizeNumeroFattura(f.numero_fattura) === numNorm,
    )

    if (!rawFattura) {
      const bollaMatch = bollePool.find(
        (b) => b.numero_bolla != null && normalizeNumeroFattura(b.numero_bolla) === numNorm,
      )
      if (bollaMatch) {
        results.push({
          numero: line.numero, importoStatement: line.importo,
          status: 'bolle_mancanti', fattura: null, bolle: [bollaMatch], deltaImporto: null, fornitore: null,
        })
        continue
      }
      results.push({
        numero: line.numero, importoStatement: line.importo,
        status: 'fattura_mancante', fattura: null, bolle: [], deltaImporto: null, fornitore: null,
      })
      continue
    }

    const fornitoreRaw = Array.isArray(rawFattura.fornitori) ? rawFattura.fornitori[0] : rawFattura.fornitori
    const fornitore    = fornitoreRaw ? { id: fornitoreRaw.id, nome: fornitoreRaw.nome, email: fornitoreRaw.email } : null
    const fattura      = {
      id: rawFattura.id, numero_fattura: rawFattura.numero_fattura,
      importo: rawFattura.importo, data: rawFattura.data,
      file_url: rawFattura.file_url, fornitore_id: rawFattura.fornitore_id,
    }

    const bolle = findMatchingBolleForFattura(rawFattura, bollePool, line.importo)
    let { status, delta } = resolveCheckStatus(line, rawFattura, bolle)

    if (line.rekki && fattura && bolle.length > 0) {
      const prezzoFattura = rawFattura.importo ?? 0
      const prezzoRekki    = line.importo
      const bolleSum = bolle.reduce((s, b) => s + (b.importo ?? 0), 0)
      const invoiceMatchesBolle = amountsMatchForTripleCheck(prezzoFattura, bolleSum)
      const rekkiVsFattura      = Math.abs(prezzoRekki - prezzoFattura) > REKKI_VS_FATTURA_TOLERANCE
      if (invoiceMatchesBolle && rekkiVsFattura) {
        status = 'rekki_prezzo_discordanza'
      }
    }

    results.push({ numero: line.numero, importoStatement: line.importo, status, fattura, bolle, deltaImporto: delta, fornitore })
  }

  const summary: CheckSummary = {
    ok:                       results.filter(r => r.status === 'ok').length,
    fattura_mancante:         results.filter(r => r.status === 'fattura_mancante').length,
    bolle_mancanti:           results.filter(r => r.status === 'bolle_mancanti').length,
    errore_importo:           results.filter(r => r.status === 'errore_importo').length,
    rekki_prezzo_discordanza: results.filter(r => r.status === 'rekki_prezzo_discordanza').length,
  }

  return { results, summary }
}
