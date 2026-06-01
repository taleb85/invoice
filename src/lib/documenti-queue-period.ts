/**
 * Filtri periodo ledger sulla scheda fornitore.
 * `toExclusive` = giorno dopo l’ultimo incluso (stesso schema di `supplierExclusiveEndAfterInclusive`).
 */

/** Coda email: `data_documento` se valorizzata, altrimenti `created_at`. */
export function pendingDocLedgerPeriodOrFilter(from: string, toExclusive: string): string {
  return `and(data_documento.gte.${from},data_documento.lt.${toExclusive}),and(data_documento.is.null,created_at.gte.${from},created_at.lt.${toExclusive})`
}

/** Conferme ordine: `data_ordine` se valorizzata, altrimenti `created_at`. */
export function confermeOrdineLedgerPeriodOrFilter(from: string, toExclusive: string): string {
  return `and(data_ordine.gte.${from},data_ordine.lt.${toExclusive}),and(data_ordine.is.null,created_at.gte.${from},created_at.lt.${toExclusive})`
}

/** Giorno effettivo per filtri client (colonna + fallback metadata). */
export function effectivePendingDocDayIso(row: {
  data_documento?: string | null
  created_at?: string | null
  metadata?: { data_fattura?: string | null } | null
}): string | null {
  const col = row.data_documento?.trim()
  if (col && /^\d{4}-\d{2}-\d{2}$/.test(col)) return col
  const raw = row.metadata?.data_fattura?.trim()
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  if (raw) {
    const d = new Date(raw)
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  }
  const c = row.created_at?.trim()
  if (c && /^\d{4}-\d{2}-\d{2}/.test(c)) return c.slice(0, 10)
  return null
}

export function isYmdInHalfOpenRange(day: string, from: string, toExclusive: string): boolean {
  return day >= from && day < toExclusive
}
