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

export type StatementGroupSummary = {
  totalImporto: number | null
  docDateFrom: string | null
  docDateTo: string | null
  numeriDoc: string[]
}

export function summarizeStatementGroup(items: CodaItem[]): StatementGroupSummary {
  let totalImporto = 0
  let hasImporto = false
  const docDates: string[] = []
  const numeriDoc: string[] = []

  for (const item of items) {
    if (item.importo != null) {
      totalImporto += item.importo
      hasImporto = true
    }
    if (item.data_doc) docDates.push(item.data_doc)
    const num = item.numero_documento ?? item.riferimenti
    if (num) numeriDoc.push(num)
  }

  docDates.sort()
  numeriDoc.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))

  return {
    totalImporto: hasImporto ? totalImporto : null,
    docDateFrom: docDates[0] ?? null,
    docDateTo: docDates.length > 0 ? docDates[docDates.length - 1]! : null,
    numeriDoc,
  }
}

export type StatementStatusCountLabels = Record<
  StatementCheckStatusKey,
  { one: string; many: string }
>

export function formatStatementStatusCount(
  n: number,
  key: StatementCheckStatusKey,
  labels: StatementStatusCountLabels,
): string {
  const tpl = n === 1 ? labels[key].one : labels[key].many
  return tpl.replace('{n}', String(n))
}

const STATUS_CHIP_CLASS: Record<StatementCheckStatusKey, string> = {
  errore_importo: 'bg-rose-500/15 text-rose-200 ring-rose-500/30',
  fattura_mancante: 'bg-orange-500/15 text-orange-200 ring-orange-500/30',
  rekki_prezzo_discordanza: 'bg-amber-500/15 text-amber-200 ring-amber-500/30',
  bolle_mancanti: 'bg-yellow-500/15 text-yellow-200 ring-yellow-500/30',
  pending: 'bg-app-line-15 text-app-fg-muted ring-app-line-25',
  other: 'bg-app-line-15 text-app-fg-muted ring-app-line-25',
}

export function statementStatusChipClass(key: StatementCheckStatusKey): string {
  return STATUS_CHIP_CLASS[key]
}
