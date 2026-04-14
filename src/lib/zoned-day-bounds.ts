/**
 * UTC ISO bounds [start, endExclusive) for the calendar day containing `instant`
 * in `ianaTimeZone` (IANA name, e.g. Europe/Rome).
 */
export function utcBoundsForZonedCalendarDay(ianaTimeZone: string, instant = new Date()) {
  let tz = (ianaTimeZone ?? '').trim() || 'UTC'
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(instant)
  } catch {
    tz = 'UTC'
  }

  const dayKey = (ms: number) =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(ms))

  const key = dayKey(instant.getTime())
  let lo = instant.getTime()
  while (dayKey(lo - 60_000) === key) lo -= 60_000
  const startMs = lo
  let hi = startMs
  while (dayKey(hi) === key) hi += 60_000
  return { start: new Date(startMs).toISOString(), endExclusive: new Date(hi).toISOString() }
}
