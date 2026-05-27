import { isBadListinoOcrPrice } from '@/lib/listino-price-sanity'

export type ListinoPriceAuditRow = {
  id: string
  fornitore_id: string
  prodotto: string
  prezzo: number
  data_prezzo: string
}

function groupKey(fornitoreId: string, prodotto: string): string {
  return `${fornitoreId}\0${prodotto.trim()}`
}

/**
 * Trova righe sospette (qty/unitario OCR) in un singolo prodotto dello stesso fornitore.
 */
export function findSuspiciousInProductGroup(group: ListinoPriceAuditRow[]): ListinoPriceAuditRow[] {
  if (group.length < 2) return []

  const out: ListinoPriceAuditRow[] = []
  for (const row of group) {
    const others = group.filter((g) => g.id !== row.id).map((g) => g.prezzo)
    if (isBadListinoOcrPrice(row.prezzo, others)) out.push(row)
  }
  return out
}

/** Audit globale: tutti i fornitori, tutti i prodotti. */
export function findSuspiciousListinoRows(all: ListinoPriceAuditRow[]): ListinoPriceAuditRow[] {
  const byGroup = new Map<string, ListinoPriceAuditRow[]>()

  for (const row of all) {
    const prezzo = typeof row.prezzo === 'number' ? row.prezzo : parseFloat(String(row.prezzo))
    if (!Number.isFinite(prezzo) || prezzo <= 0) continue
    const normalized: ListinoPriceAuditRow = {
      ...row,
      prodotto: row.prodotto.trim(),
      prezzo,
      data_prezzo: row.data_prezzo.slice(0, 10),
    }
    const key = groupKey(row.fornitore_id, normalized.prodotto)
    const arr = byGroup.get(key) ?? []
    arr.push(normalized)
    byGroup.set(key, arr)
  }

  const suspicious: ListinoPriceAuditRow[] = []
  for (const group of byGroup.values()) {
    suspicious.push(...findSuspiciousInProductGroup(group))
  }
  return suspicious
}
