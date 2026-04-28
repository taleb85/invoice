/** Finestra sync storica a chunk (UTC, date-only). */

function parseIsoDateUtc(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return new Date(NaN)
  return new Date(Date.UTC(y, m - 1, d))
}

export function formatIsoDateUtc(d: Date): string {
  const y = d.getUTCFullYear()
  const m = d.getUTCMonth() + 1
  const day = d.getUTCDate()
  return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function utcDayStart(ms: Date): Date {
  return new Date(Date.UTC(ms.getUTCFullYear(), ms.getUTCMonth(), ms.getUTCDate()))
}

function utcAddDays(d: Date, days: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + days))
}

function utcStartOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
}

function utcAddMonths(monthStart: Date, n: number): Date {
  return new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + n, 1))
}

function dateMax(a: Date, b: Date): Date {
  return a.getTime() >= b.getTime() ? a : b
}

function dateMin(a: Date, b: Date): Date {
  return a.getTime() <= b.getTime() ? a : b
}

/** Exclusive end dell’intera sync storica (inizio del giorno UTC successivo a “oggi”). */
export function utcTomorrowStartUtc(from = new Date()): Date {
  const t = utcDayStart(from).getTime() + 86400000
  return new Date(t)
}

/** Inizio rollout pari a `(now − lookbackDays)` (stesso criterio lookback giorni nella fetch IMAP «rolling»). */
export function rollingLookbackSince(lookbackDays: number): Date {
  return new Date(Date.now() - Math.max(1, lookbackDays) * 86400000)
}

/**
 * Prossimo slice mensile (o frazione) nella finestra [rollingStart, overallEndExclusive).
 * `checkpointIso` = ultimo giorno incluso completato, o null.
 */
export function computeNextHistoricalChunk(
  checkpointIso: string | null,
  rollingStart: Date,
  overallEndExclusive: Date,
): { sliceStartInclusive: Date; sliceEndExclusive: Date } | null {
  let cursorStart = checkpointIso
    ? utcAddDays(utcDayStart(parseIsoDateUtc(checkpointIso)), 1)
    : rollingStart

  while (cursorStart < overallEndExclusive) {
    const monthStart = utcStartOfMonth(cursorStart)
    const sliceStart = dateMax(cursorStart, rollingStart)
    const sliceEndExclusive = dateMin(utcAddMonths(monthStart, 1), overallEndExclusive)
    if (sliceStart < sliceEndExclusive) {
      return { sliceStartInclusive: sliceStart, sliceEndExclusive }
    }
    cursorStart = utcAddMonths(monthStart, 1)
  }

  return null
}

/** Data inclusiva da salvare come checkpoint (ultimo istante coperto nello slice). */
export function inclusiveEndDateFromSliceEndExclusive(sliceEndExclusive: Date): string {
  const d = new Date(sliceEndExclusive.getTime() - 1)
  return formatIsoDateUtc(d)
}

export function historicalProgressLabel(sliceStartInclusive: Date, locale: string): string {
  try {
    return sliceStartInclusive.toLocaleDateString(locale, {
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    })
  } catch {
    return formatIsoDateUtc(sliceStartInclusive)
  }
}
