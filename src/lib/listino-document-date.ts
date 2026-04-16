/**
 * Confronto date ISO YYYY-MM-DD (string-safe).
 * «Data ultimo listino» per un prodotto = massimo `data_prezzo` sulle righe `listino_prezzi` con quel nome.
 */
export function compareIsoDateStrings(a: string, b: string): number {
  const x = a.slice(0, 10)
  const y = b.slice(0, 10)
  if (x < y) return -1
  if (x > y) return 1
  return 0
}

export function isDocumentDateAtLeastLatestListino(
  documentDate: string,
  latestListinoDate: string | null
): boolean {
  if (!latestListinoDate) return true
  return compareIsoDateStrings(documentDate.slice(0, 10), latestListinoDate.slice(0, 10)) >= 0
}

/** Data massima `data_prezzo` per `prodotto` esatto (trim), o null se il prodotto non esiste. */
export function maxListinoDateForExactProduct(
  rows: { prodotto: string; data_prezzo: string }[],
  prodotto: string
): string | null {
  const p = prodotto.trim()
  if (!p) return null
  let max: string | null = null
  for (const row of rows) {
    if (row.prodotto.trim() !== p) continue
    const d = row.data_prezzo.slice(0, 10)
    if (!max || compareIsoDateStrings(d, max) > 0) max = d
  }
  return max
}

/** Giorni di calendario da `fromIso` a `toIso` (inclusivo approssimazione mezzogiorno UTC). */
export function calendarDaysBetweenIso(fromIso: string, toIso: string): number {
  const a = new Date(`${fromIso.slice(0, 10)}T12:00:00Z`).getTime()
  const b = new Date(`${toIso.slice(0, 10)}T12:00:00Z`).getTime()
  return Math.floor((b - a) / 86400000)
}
