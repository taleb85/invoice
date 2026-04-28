/**
 * Valori ammessi da `documenti_da_processare_stato_check` (allineamento DB prod).
 * Legacy: `in_attesa` può essere presente nei dati — mappato a `da_processare`.
 */
export const DOCUMENTI_DA_PROCESSARE_STATI = [
  'da_processare',
  'da_associare',
  'bozza_creata',
  'associato',
  'scartato',
  'da_revisionare',
] as const

export type DocumentoDaProcessareStato = (typeof DOCUMENTI_DA_PROCESSARE_STATI)[number]

const ALLOWED_SET = new Set<string>(DOCUMENTI_DA_PROCESSARE_STATI)

const LEGACY_STATO_MAP: Record<string, DocumentoDaProcessareStato> = {
  in_attesa: 'da_processare',
  ignorato: 'scartato',
  mittente_sconosciuto: 'da_revisionare',
}

/**
 * Garantisce un valore accettabile dal constraint prima di INSERT/UPDATE righe documenti.
 */
export function normalizeDocumentoQueueStatoForDb(input: unknown): DocumentoDaProcessareStato {
  const s = typeof input === 'string' ? input.trim() : ''
  if (ALLOWED_SET.has(s)) return s as DocumentoDaProcessareStato
  const mapped = s ? LEGACY_STATO_MAP[s] : undefined
  if (mapped) return mapped
  return 'da_associare'
}

/**
 * Lista di stati da usare nei filtri GET (API / UI) quando si vogliono entrambi i nomi legacy.
 */
export const DOCUMENTI_PENDING_FILTER_STATES: DocumentoDaProcessareStato[] = [
  'da_processare',
  'da_associare',
  'da_revisionare',
  'bozza_creata',
]
