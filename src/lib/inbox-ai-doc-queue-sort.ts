/**
 * Ordine coda AI Inbox: **più recente prima** (decrescente).
 * Usata sia dal POST `reprocess-pending-docs` (`gemini_classify`) sia dalla lista in UI,
 * così il batch Gemini segue esattamente l’ordine mostrato.
 *
 * Chiave temporale: `data_documento` (se presente, es. giorno fattura), altrimenti `created_at` (ricezione).
 */
export type InboxQueueSortRow = {
  id: string
  created_at?: string | null
  data_documento?: string | null
}

/** Millisecondi per ordinamento decrescente (il valore più alto = più recente in cima). */
export function inboxQueueSortTimeMs(row: InboxQueueSortRow): number {
  const raw = (row.data_documento?.trim() || row.created_at?.trim() || '').trim()
  if (!raw) return 0
  let t = Date.parse(raw)
  if (!Number.isFinite(t) && /^\d{4}-\d{2}-\d{2}$/.test(raw.slice(0, 10))) {
    t = Date.parse(`${raw.slice(0, 10)}T12:00:00.000Z`)
  }
  return Number.isFinite(t) ? t : 0
}

/** Comparator: più recente prima; a parità di istante, `id` decrescente (stabile). */
export function compareInboxQueueNewestFirst(a: InboxQueueSortRow, b: InboxQueueSortRow): number {
  const ka = inboxQueueSortTimeMs(a)
  const kb = inboxQueueSortTimeMs(b)
  if (kb !== ka) return kb - ka
  return b.id.localeCompare(a.id)
}
