import { filterOutliersForTrend, listinoRowPrimaryDisplayPrice } from '@/lib/listino-display'
import { isBadListinoOcrPrice } from '@/lib/listino-price-sanity'

export type ListinoHistoryRow = { id: string; prezzo: number; data_prezzo: string }

/** Righe con prezzo plausibile (cluster listino reale, es. cassa non unitario OCR). */
export function plausibleListinoHistoryRows<T extends ListinoHistoryRow>(sortedAsc: T[]): T[] {
  if (sortedAsc.length < 4) {
    return sortedAsc.filter(
      (row) =>
        !isBadListinoOcrPrice(
          row.prezzo,
          sortedAsc.filter((x) => x.id !== row.id).map((x) => x.prezzo),
        ),
    )
  }
  return filterOutliersForTrend(sortedAsc)
}

/**
 * Per ogni riga (ordine cronologico asc), prezzo plausibile immediatamente precedente.
 * Usato per % variazione nello storico senza salti tipo +177% da outlier OCR.
 */
export function previousPlausiblePriceByRowId<T extends ListinoHistoryRow>(
  sortedAsc: T[],
): Map<string, number | null> {
  const plausible = plausibleListinoHistoryRows(sortedAsc)
  const plausibleIds = new Set(plausible.map((r) => r.id))
  const out = new Map<string, number | null>()
  let last: number | null = null
  for (const row of sortedAsc) {
    if (plausibleIds.has(row.id)) {
      out.set(row.id, last)
      last = row.prezzo
    } else {
      out.set(row.id, null)
    }
  }
  return out
}

export function listinoHistoryDeltaPercent(
  entryPrice: number,
  previousPlausible: number | null | undefined,
): number | null {
  if (previousPlausible == null || !(previousPlausible > 0)) return null
  return ((entryPrice - previousPlausible) / previousPlausible) * 100
}

/**
 * Come `previousPlausiblePriceByRowId`, ma sui prezzi a unità normalizzati (6×75cl, OCR, ecc.).
 */
export function previousPlausiblePrimaryPriceByRowId<T extends ListinoHistoryRow>(
  sortedAsc: T[],
  unita: string | null | undefined,
): Map<string, number | null> {
  const normalized = sortedAsc.map((row) => ({
    ...row,
    prezzo: listinoRowPrimaryDisplayPrice(row, sortedAsc, unita),
  }))
  return previousPlausiblePriceByRowId(normalized)
}
