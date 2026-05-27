import type { CodaItem } from '@/lib/command-system/types'

export type CodaDisplayEntry =
  | { type: 'item'; item: CodaItem }
  | { type: 'statement_group'; statementId: string; items: CodaItem[] }

export function getStatementIdFromCodaItem(item: CodaItem): string | null {
  if (item.origine !== 'riga_statement') return null
  const ctx = item.contesto_originale as Record<string, unknown> | null
  const id = ctx?.statement_id
  return typeof id === 'string' && id.length > 0 ? id : null
}

/** Raggruppa righe statement con lo stesso `statement_id` (≥2 righe nella pagina). */
export function buildCodaDisplayEntries(items: CodaItem[]): CodaDisplayEntry[] {
  const statementCounts = new Map<string, number>()
  for (const item of items) {
    const sid = getStatementIdFromCodaItem(item)
    if (sid) statementCounts.set(sid, (statementCounts.get(sid) ?? 0) + 1)
  }

  const groupEmitted = new Set<string>()
  const entries: CodaDisplayEntry[] = []

  for (const item of items) {
    const sid = getStatementIdFromCodaItem(item)
    const shouldGroup = sid != null && (statementCounts.get(sid) ?? 0) >= 2

    if (!shouldGroup) {
      entries.push({ type: 'item', item })
      continue
    }

    if (groupEmitted.has(sid)) continue

    groupEmitted.add(sid)
    const groupItems = items.filter((i) => getStatementIdFromCodaItem(i) === sid)
    entries.push({ type: 'statement_group', statementId: sid, items: groupItems })
  }

  return entries
}

export type StatementCheckStatusKey =
  | 'fattura_mancante'
  | 'bolle_mancanti'
  | 'errore_importo'
  | 'rekki_prezzo_discordanza'
  | 'pending'
  | 'other'

export function countStatementRowsByStatus(
  items: CodaItem[],
): Partial<Record<StatementCheckStatusKey, number>> {
  const counts: Partial<Record<StatementCheckStatusKey, number>> = {}
  for (const item of items) {
    const raw = item.stato_origine
    const key: StatementCheckStatusKey =
      raw === 'fattura_mancante' ||
      raw === 'bolle_mancanti' ||
      raw === 'errore_importo' ||
      raw === 'rekki_prezzo_discordanza' ||
      raw === 'pending'
        ? raw
        : 'other'
    counts[key] = (counts[key] ?? 0) + 1
  }
  return counts
}

export function worstPrioritaInGroup(items: CodaItem[]): number {
  if (items.length === 0) return 99
  return Math.min(...items.map((i) => i.priorita))
}
