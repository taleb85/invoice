/**
 * Aging / soglie giorni per solleciti documenti mancanti.
 * Tolleranze da tabella `configurazioni_solleciti`; fallback statici se la tabella manca o la query fallisce.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

/** Chiavi riga in `public.configurazioni_solleciti` (colonna chiave). */
export const SOLLECITI_CONFIG_CHIAVI = {
  bolla: 'giorni_tolleranza_bolla',
  promessa: 'giorni_tolleranza_promessa_documento',
  estratto: 'giorni_tolleranza_estratto_mismatch',
} as const

export type SollecitiToleranceConfig = {
  /** Da documento/bolla (`bolle.data`) per righe ancora senza chiusura fiscale prevista */
  giorniTolBolla: number
  /** Da creazione record coda/metadata con promessa allegato futuro */
  giorniTolPromessa: number
  /** Da ingresso/analisi riga estratto con mismatch sul triple-check */
  giorniTolEstrattoMismatch: number
}

export const DEFAULT_SOLLECITI_TOLERANCE: SollecitiToleranceConfig = {
  giorniTolBolla: 5,
  giorniTolPromessa: 2,
  giorniTolEstrattoMismatch: 3,
}

/** Stati `statement_rows.check_status` da considerare “mismatch / errore” per aging solleciti. */
export const STATEMENT_MISMATCH_STATUSES = [
  'fattura_mancante',
  'bolle_mancanti',
  'errore_importo',
  'rekki_prezzo_discordanza',
] as const satisfies readonly string[]

export type StatementMismatchStatus = (typeof STATEMENT_MISMATCH_STATUSES)[number]

function parseToleranceInt(raw: string | undefined | null, fallback: number): number {
  if (raw == null || typeof raw !== 'string') return fallback
  const n = Number.parseInt(raw.trim(), 10)
  if (!Number.isFinite(n) || n < 0) return fallback
  return n
}

function mapRowsToTolerance(
  rows: { chiave: string; valore: string }[] | null | undefined,
): SollecitiToleranceConfig {
  const byKey = new Map<string, string>()
  for (const r of rows ?? []) {
    if (r?.chiave) byKey.set(r.chiave.trim(), r.valore)
  }
  return {
    giorniTolBolla: parseToleranceInt(
      byKey.get(SOLLECITI_CONFIG_CHIAVI.bolla),
      DEFAULT_SOLLECITI_TOLERANCE.giorniTolBolla,
    ),
    giorniTolPromessa: parseToleranceInt(
      byKey.get(SOLLECITI_CONFIG_CHIAVI.promessa),
      DEFAULT_SOLLECITI_TOLERANCE.giorniTolPromessa,
    ),
    giorniTolEstrattoMismatch: parseToleranceInt(
      byKey.get(SOLLECITI_CONFIG_CHIAVI.estratto),
      DEFAULT_SOLLECITI_TOLERANCE.giorniTolEstrattoMismatch,
    ),
  }
}

/** Legge le tolleranze da Supabase; in caso di tabella assente / errore ritorna i default senza propagare errore. */
export async function fetchSollecitiToleranceConfig(
  supabase: Pick<SupabaseClient, 'from'>,
): Promise<SollecitiToleranceConfig> {
  try {
    const { data, error } = await supabase.from('configurazioni_solleciti').select('chiave, valore')
    if (error) {
      console.warn('[sollecito-aging] configurazioni_solleciti:', error.message)
      return { ...DEFAULT_SOLLECITI_TOLERANCE }
    }
    return mapRowsToTolerance(data as { chiave: string; valore: string }[])
  } catch (e) {
    console.warn('[sollecito-aging] configurazioni_solleciti read failed:', e)
    return { ...DEFAULT_SOLLECITI_TOLERANCE }
  }
}

function toUtcMidday(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0, 0))
}

/** Giorni interi trascorsi dall’anchor (≤ now), calendario UTC. */
export function wholeDaysSinceUtc(from: Date, now: Date = new Date()): number {
  const a = toUtcMidday(from)
  const b = toUtcMidday(now)
  return Math.floor((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000))
}

/** Parse ISO date `YYYY-MM-DD` o ISO timestamp → Date UTC per confronto giorni. */
export function parseDateOnlyOrIso(value: string | Date | null | undefined): Date | null {
  if (value == null || value === '') return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  const s = String(value).trim()
  const ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[^\d]|$)/)
  if (ymd) {
    const y = Number(ymd[1])
    const m = Number(ymd[2]) - 1
    const day = Number(ymd[3])
    const d = new Date(Date.UTC(y, m, day, 12, 0, 0, 0))
    return Number.isNaN(d.getTime()) ? null : d
  }
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

export type BollaOverdueInput = {
  stato: string | null | undefined
  /** Campo tipico tabella bolle (`data`): data documento bolla */
  data: string | Date | null | undefined
  toleranceDays: number
  now?: Date
}

/**
 * True se la bolla è ancora senza ciclo previsto (“in attesa”) e dalla data documento
 * sono trascorsi almeno `toleranceDays` (calendario UTC).
 */
export function isBollaOverdue(input: BollaOverdueInput): boolean {
  const stato = String(input.stato ?? '').trim()
  if (stato !== 'in attesa') return false
  const anchor = parseDateOnlyOrIso(input.data ?? null)
  if (!anchor) return false
  return wholeDaysSinceUtc(anchor, input.now ?? new Date()) >= input.toleranceDays
}

export type PromisedDocOverdueInput = {
  metadata: Record<string, unknown> | null | undefined
  /** Tipicamente `documenti_da_processare.created_at` */
  recordCreatedAt: string | Date | null | undefined
  toleranceDays: number
  /**
   * True se nel frattempo è arrivato/elaborato il documento fiscale previsto:
   * es. registrazione bolla/fattura, stato coda diverso da attesa sintetica, ecc.
   * Se non sai ancora distinguerlo nel job, passa sempre false qui.
   */
  documentResolved: boolean
  now?: Date
}

function metadataPromessaTrue(meta: Record<string, unknown> | null | undefined): boolean {
  return meta?.promessa_invio_documento === true
}

/**
 * True se `promessa_invio_documento` in metadata, record creato da almeno `toleranceDays`
 * e il “documento reale” non è ancora considerato ricevuto.
 */
export function isPromisedDocOverdue(input: PromisedDocOverdueInput): boolean {
  if (input.documentResolved) return false
  if (!metadataPromessaTrue(input.metadata ?? undefined)) return false
  const createdRaw = input.recordCreatedAt
  if (createdRaw == null) return false
  const created = typeof createdRaw === 'string' ? new Date(createdRaw) : createdRaw
  if (Number.isNaN(created.getTime())) return false
  return wholeDaysSinceUtc(created, input.now ?? new Date()) >= input.toleranceDays
}

export type StatementMismatchOverdueInput = {
  checkStatus: string | null | undefined
  /** Tipicamente `statement_rows.created_at` */
  rowCreatedAt: string | Date | null | undefined
  toleranceDays: number
  now?: Date
}

export function statementCheckIsMismatch(checkStatus: string | null | undefined): boolean {
  const s = String(checkStatus ?? '').trim().toLowerCase()
  return (STATEMENT_MISMATCH_STATUSES as readonly string[]).includes(s as StatementMismatchStatus)
}

/** True per righe estratto triple-check ancora “in errore / mismatch” oltre la tolleranza. */
export function isStatementMismatchOverdue(input: StatementMismatchOverdueInput): boolean {
  if (!statementCheckIsMismatch(input.checkStatus)) return false
  const raw = input.rowCreatedAt
  if (raw == null) return false
  const created = typeof raw === 'string' ? new Date(raw) : raw
  if (Number.isNaN(created.getTime())) return false
  return wholeDaysSinceUtc(created, input.now ?? new Date()) >= input.toleranceDays
}
