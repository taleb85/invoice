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
