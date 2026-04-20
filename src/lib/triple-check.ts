/**
 * Shared triple-check logic.
 *
 * Can be called from:
 *   - /api/triple-check-statement  (interactive API)
 *   - scan-emails processing       (automatic background check)
 *
 * For each statement line ({ numero, importo }):
 *   1. Find matching fattura by numero_fattura (ilike)
 *   2. Find associated bolle (via bolla_id FK + date proximity)
 *   3. Compare amounts (`TRIPLE_CHECK_TOLERANCE`); Rekki vs fattura usa `REKKI_VS_FATTURA_TOLERANCE`.
 *
 * Returns an array of CheckResult objects.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

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
export const TRIPLE_CHECK_TOLERANCE = 0.02

/**
 * Tolleranza stretta Rekki: totale ordine app vs importo fattura.
 * Oltre questa soglia → `rekki_prezzo_discordanza` (se fattura e bolle sono coerenti tra loro).
 */
export const REKKI_VS_FATTURA_TOLERANCE = 0.01

type FatturaRow = {
  id: string; numero_fattura: string | null; importo: number | null
  data: string; file_url: string | null; fornitore_id: string; bolla_id: string | null
  fornitori: { id: string; nome: string; email: string | null } |
             { id: string; nome: string; email: string | null }[] | null
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

  // ── Bulk prefetch: one query for fatture, one for bolle ──────────────
  //
  // Old behaviour: 2 DB round-trips × N lines (N+1 per-line pattern).
  // New behaviour: 2 round-trips total, then in-memory matching.
  //
  // Scope: load all fatture/bolle for the given (sede, fornitore) pair.
  // In-memory ilike match replaces per-line .ilike() query.

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let fattureQ = (supabase as any)
    .from('fatture')
    .select('id, numero_fattura, importo, data, file_url, fornitore_id, bolla_id, fornitori(id, nome, email)')
  if (sede_id)      fattureQ = fattureQ.eq('sede_id',      sede_id)
  if (fornitore_id) fattureQ = fattureQ.eq('fornitore_id', fornitore_id)
  const { data: allFattureRaw } = await fattureQ
  const fatturePool = (allFattureRaw ?? []) as FatturaRow[]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let bolleQ = (supabase as any)
    .from('bolle')
    .select('id, numero_bolla, importo, data, fornitore_id')
    .eq('stato', 'completato')
  if (sede_id)      bolleQ = bolleQ.eq('sede_id',      sede_id)
  if (fornitore_id) bolleQ = bolleQ.eq('fornitore_id', fornitore_id)
  const { data: allBolleRaw } = await bolleQ
  type BollaPoolRow = { id: string; numero_bolla: string | null; importo: number | null; data: string; fornitore_id: string }
  const bollePool = (allBolleRaw ?? []) as BollaPoolRow[]

  for (const line of lines) {
    // ── STEP 1: Find matching invoice (in-memory ilike) ─────────────────
    const numLower = line.numero.toLowerCase()
    const rawFattura = fatturePool.find(
      (f) => f.numero_fattura != null && f.numero_fattura.toLowerCase().includes(numLower),
    )

    if (!rawFattura) {
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

    // ── STEP 2: Filter bolle in-memory (date window + fornitore) ────────
    const fatturaDate = rawFattura.data
    const dateFrom    = new Date(fatturaDate); dateFrom.setDate(dateFrom.getDate() - 45)
    const dateTo      = new Date(fatturaDate); dateTo.setDate(dateTo.getDate() + 5)
    const dfStr = dateFrom.toISOString().slice(0, 10)
    const dtStr = dateTo.toISOString().slice(0, 10)

    const bolle = bollePool.filter(
      (b) => b.fornitore_id === rawFattura.fornitore_id && b.data >= dfStr && b.data <= dtStr,
    )

    // ── STEP 3: Amount checks ───────────────────────────────────────────
    const dbImporto         = rawFattura.importo ?? 0
    const bolleSum          = bolle.reduce((s, b) => s + (b.importo ?? 0), 0)
    const delta             = parseFloat((line.importo - dbImporto).toFixed(2))
    const importiCombaciano = Math.abs(delta) <= TRIPLE_CHECK_TOLERANCE

    let status: CheckStatus

    if (bolle.length === 0 && !rawFattura.bolla_id) {
      status = 'bolle_mancanti'
    } else if (!importiCombaciano) {
      status = 'errore_importo'
    } else {
      status = 'ok'
    }

    if (status !== 'bolle_mancanti') {
      const bollaeDeltaOk = bolle.length === 0 || Math.abs(bolleSum - line.importo) <= TRIPLE_CHECK_TOLERANCE
      if (!importiCombaciano || !bollaeDeltaOk) status = 'errore_importo'
    }

    // Rekki: fattura e bolle coerenti tra loro, ma totale ordine app ≠ prezzo fatturato → ambra dedicata
    if (line.rekki && fattura && bolle.length > 0) {
      const prezzoFattura = rawFattura.importo ?? 0
      const prezzoRekki    = line.importo
      const invoiceMatchesBolle = Math.abs(prezzoFattura - bolleSum) <= TRIPLE_CHECK_TOLERANCE
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
