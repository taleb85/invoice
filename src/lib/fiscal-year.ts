/**
 * Intervalli anno fiscale per sincronizzazione email (date in UTC, fine esclusiva).
 * - IT, FR, DE, ES: anno civile (1 gen – 31 dic dello stesso anno).
 * - UK: tax year che termina il 5 aprile di `ukEndYear` (6 apr ukEndYear-1 → 5 apr ukEndYear inclusi).
 */

const FY_MIN = 1990
const FY_MAX = 2100

function clampYear(y: number): number {
  if (!Number.isFinite(y)) return new Date().getUTCFullYear()
  return Math.min(FY_MAX, Math.max(FY_MIN, Math.floor(y)))
}

/** Inizio UTC (00:00) del giorno indicato. */
function utcDate(y: number, monthIndex0: number, day: number): Date {
  return new Date(Date.UTC(y, monthIndex0, day, 0, 0, 0, 0))
}

/**
 * @param countryCode — country della sede
 * @param labelYear — IT/FR/DE/ES: anno civile. UK: anno di chiusura del tax year (5 aprile in questo anno).
 */
export function fiscalYearRangeUtc(
  countryCode: string,
  labelYear: number
): { start: Date; endExclusive: Date } {
  const y = clampYear(labelYear)
  const cc = (countryCode || 'UK').toUpperCase()

  if (cc === 'UK') {
    const start = utcDate(y - 1, 3, 6)
    const endExclusive = utcDate(y, 3, 6)
    return { start, endExclusive }
  }

  const start = utcDate(y, 0, 1)
  const endExclusive = utcDate(y + 1, 0, 1)
  return { start, endExclusive }
}

/**
 * Etichetta anno fiscale “corrente” rispetto a `ref` (UTC).
 * UK: anno in cui cade il 5 aprile della fine del tax year in corso.
 */
export function defaultFiscalYearLabel(countryCode: string, ref = new Date()): number {
  const cc = (countryCode || 'UK').toUpperCase()
  const y = ref.getUTCFullYear()
  const m = ref.getUTCMonth()
  const d = ref.getUTCDate()

  if (cc === 'UK') {
    if (m > 3 || (m === 3 && d >= 6)) return y + 1
    return y
  }

  return y
}

export function isValidFiscalYear(y: unknown): y is number {
  return typeof y === 'number' && Number.isFinite(y) && y >= FY_MIN && y <= FY_MAX
}

/** Bound per query Supabase: colonne `date` e `timestamptz` nell’intervallo anno fiscale (fine esclusiva). */
export function getFiscalYearPgBounds(
  countryCode: string,
  labelYear: number
): { dateFrom: string; dateToExclusive: string; tsFrom: string; tsToExclusive: string } {
  const { start, endExclusive } = fiscalYearRangeUtc(countryCode, labelYear)
  return {
    dateFrom: start.toISOString().slice(0, 10),
    dateToExclusive: endExclusive.toISOString().slice(0, 10),
    tsFrom: start.toISOString(),
    tsToExclusive: endExclusive.toISOString(),
  }
}

/** `fy` in query string → etichetta anno; fuori range o assente → anno fiscale corrente per paese. */
export function parseFiscalYearQueryParam(raw: string | undefined, countryCode: string): number {
  if (raw === undefined || raw === '') return defaultFiscalYearLabel(countryCode, new Date())
  const n = Number(raw)
  if (isValidFiscalYear(n)) return n
  return defaultFiscalYearLabel(countryCode, new Date())
}

/**
 * Etichetta breve per UI: UK `2025/26` (tax year che termina ad aprile `labelYear`);
 * IT/FR/DE/ES anno civile come stringa (`2025`).
 */
export function formatFiscalYearShort(countryCode: string, labelYear: number): string {
  const y = clampYear(labelYear)
  const cc = (countryCode || 'UK').toUpperCase()
  if (cc === 'UK') {
    const startYear = y - 1
    const endTwo = String(y).slice(-2).padStart(2, '0')
    return `${startYear}/${endTwo}`
  }
  return String(y)
}

/** Mesi civili che compongono l’anno fiscale `fiscalLabelYear` (UK: apr → mar; altri: gen → dic). */
export function listFiscalYearCalendarMonths(countryCode: string, fiscalLabelYear: number): { y: number; m: number }[] {
  const L = clampYear(fiscalLabelYear)
  const cc = (countryCode || 'UK').toUpperCase()
  const out: { y: number; m: number }[] = []
  if (cc === 'UK') {
    let y = L - 1
    let m = 4
    for (let i = 0; i < 12; i++) {
      out.push({ y, m })
      m += 1
      if (m > 12) {
        m = 1
        y += 1
      }
    }
  } else {
    for (let m = 1; m <= 12; m++) out.push({ y: L, m })
  }
  return out
}

const monthOrd = (y: number, m: number) => y * 12 + (m - 1)

/**
 * Finestre mensili (from/to esclusivo come `YYYY-MM-DD`) per il riepilogo fornitore:
 * dall’inizio dell’anno fiscale che contiene il mese selezionato fino a quel mese incluso,
 * ordine dal più recente al più vecchio (stessa logica email sync / `defaultFiscalYearLabel`).
 */
export function listFiscalMonthsThroughSelection(
  countryCode: string,
  selectedYear: number,
  selectedMonth: number
): { y: number; m: number; from: string; to: string }[] {
  const cc = (countryCode || 'UK').toUpperCase()
  const lastDay = new Date(Date.UTC(selectedYear, selectedMonth, 0))
  const label = defaultFiscalYearLabel(cc, lastDay)
  const all = listFiscalYearCalendarMonths(cc, label)
  const selOrd = monthOrd(selectedYear, selectedMonth)
  const filtered = all.filter((x) => monthOrd(x.y, x.m) <= selOrd)
  const withRanges = filtered.map(({ y, m }) => {
    const from = `${y}-${String(m).padStart(2, '0')}-01`
    const nm = m === 12 ? 1 : m + 1
    const ny = m === 12 ? y + 1 : y
    const to = `${ny}-${String(nm).padStart(2, '0')}-01`
    return { y, m, from, to }
  })
  return withRanges.reverse()
}
