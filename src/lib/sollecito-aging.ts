/**
 * Aging / soglie giorni per solleciti documenti mancanti.
 * Legge da `configurazioni_app` (chiavi italiane); compatibilità con `configurazioni_solleciti` (chiavi legacy).
 */
import type { SupabaseClient } from '@supabase/supabase-js'

/** Chiavi correnti in `public.configurazioni_app` (scrittura UI / upsert). */
export const SOLLECITI_CONFIG_CHIAVI = {
  bolla: 'giorni_attesa_bolla',
  promessa: 'giorni_attesa_promessa',
  estratto: 'giorni_attesa_mismatch_estratto',
  autoEnabled: 'solleciti_automatici_attivi',
} as const

/** Ordine di lettura: prima la chiave in `configurazioni_app`, poi legacy `configurazioni_solleciti`. */
export const SOLLECITI_CONFIG_KEY_READ_ORDER = {
  autoEnabled: ['solleciti_automatici_attivi', 'auto_solleciti_enabled'] as const,
  bolla: ['giorni_attesa_bolla', 'giorni_tolleranza_bolla'] as const,
  promessa: ['giorni_attesa_promessa', 'giorni_tolleranza_promessa_documento'] as const,
  estratto: ['giorni_attesa_mismatch_estratto', 'giorni_tolleranza_estratto_mismatch'] as const,
} as const

/** Testi descrittivi salvati in DB insieme al valore (upsert). */
export const SOLLECITI_APP_DESCRIZIONI: Record<(typeof SOLLECITI_CONFIG_CHIAVI)[keyof typeof SOLLECITI_CONFIG_CHIAVI], string> =
  {
    [SOLLECITI_CONFIG_CHIAVI.autoEnabled]:
      'Abilita o disabilita l\'invio automatico dei solleciti.',
    [SOLLECITI_CONFIG_CHIAVI.bolla]:
      'Giorni dalla data documento (bolla in attesa) prima di considerare il caso per i solleciti.',
    [SOLLECITI_CONFIG_CHIAVI.promessa]:
      'Giorni dalla creazione del record quando metadata.promessa_invio_documento è true, prima del sollecito documento promesso.',
    [SOLLECITI_CONFIG_CHIAVI.estratto]:
      'Giorni di attesa per righe estratto con stato mismatch / errore sul triple-check.',
  }

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

/** Se la chiave manca nel DB si assume attivo per non bloccare comportamento legacy */
export const DEFAULT_AUTO_SOLLECITI_ENABLED = true

export type SollecitiReminderSettings = SollecitiToleranceConfig & {
  autoSollecitiEnabled: boolean
}

export function parseAutoSollecitiEnabled(raw: string | undefined | null): boolean {
  if (raw == null || String(raw).trim() === '') return DEFAULT_AUTO_SOLLECITI_ENABLED
  const v = String(raw).trim().toLowerCase()
  if (['true', '1', 'yes', 'si', 'sì', 'on'].includes(v)) return true
  if (['false', '0', 'no', 'off'].includes(v)) return false
  return DEFAULT_AUTO_SOLLECITI_ENABLED
}

/** Nessun endpoint/cron deve inviare solleciti se l’automazione è disattivata dall’admin. */
export function canSendSolleciti(reminderSettings: Pick<SollecitiReminderSettings, 'autoSollecitiEnabled'>): boolean {
  return reminderSettings.autoSollecitiEnabled === true
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

function pickByKeys(
  byKey: Map<string, string>,
  keys: readonly string[],
): string | undefined {
  for (const k of keys) {
    const v = byKey.get(k)
    if (v !== undefined && String(v).trim() !== '') return v
  }
  return undefined
}

function mapRowsToReminderSettings(rows: { chiave: string; valore: string }[] | null | undefined): SollecitiReminderSettings {
  const byKey = new Map<string, string>()
  for (const r of rows ?? []) {
    if (r?.chiave) byKey.set(r.chiave.trim(), r.valore)
  }
  return {
    giorniTolBolla: parseToleranceInt(
      pickByKeys(byKey, SOLLECITI_CONFIG_KEY_READ_ORDER.bolla),
      DEFAULT_SOLLECITI_TOLERANCE.giorniTolBolla,
    ),
    giorniTolPromessa: parseToleranceInt(
      pickByKeys(byKey, SOLLECITI_CONFIG_KEY_READ_ORDER.promessa),
      DEFAULT_SOLLECITI_TOLERANCE.giorniTolPromessa,
    ),
    giorniTolEstrattoMismatch: parseToleranceInt(
      pickByKeys(byKey, SOLLECITI_CONFIG_KEY_READ_ORDER.estratto),
      DEFAULT_SOLLECITI_TOLERANCE.giorniTolEstrattoMismatch,
    ),
    autoSollecitiEnabled: parseAutoSollecitiEnabled(
      pickByKeys(byKey, SOLLECITI_CONFIG_KEY_READ_ORDER.autoEnabled),
    ),
  }
}

/** Legge tolleranze + toggle automazione da Supabase. */
export async function fetchSollecitiReminderSettings(
  supabase: Pick<SupabaseClient, 'from'>,
): Promise<SollecitiReminderSettings> {
  try {
    const [appRes, legRes] = await Promise.all([
      supabase.from('configurazioni_app').select('chiave, valore'),
      supabase.from('configurazioni_solleciti').select('chiave, valore'),
    ])
    if (appRes.error) {
      console.warn('[sollecito-aging] configurazioni_app:', appRes.error.message)
    }
    if (legRes.error) {
      console.warn('[sollecito-aging] configurazioni_solleciti:', legRes.error.message)
    }
    if (appRes.error && legRes.error) {
      return {
        ...DEFAULT_SOLLECITI_TOLERANCE,
        autoSollecitiEnabled: DEFAULT_AUTO_SOLLECITI_ENABLED,
      }
    }
    const merged: { chiave: string; valore: string }[] = []
    if (!legRes.error && legRes.data?.length) {
      merged.push(...(legRes.data as { chiave: string; valore: string }[]))
    }
    if (!appRes.error && appRes.data?.length) {
      merged.push(...(appRes.data as { chiave: string; valore: string }[]))
    }
    return mapRowsToReminderSettings(merged)
  } catch (e) {
    console.warn('[sollecito-aging] configurazioni solleciti read failed:', e)
    return {
      ...DEFAULT_SOLLECITI_TOLERANCE,
      autoSollecitiEnabled: DEFAULT_AUTO_SOLLECITI_ENABLED,
    }
  }
}

/** Legge le tolleranze da Supabase; in caso di tabella assente / errore ritorna i default senza propagare errore. */
export async function fetchSollecitiToleranceConfig(
  supabase: Pick<SupabaseClient, 'from'>,
): Promise<SollecitiToleranceConfig> {
  const r = await fetchSollecitiReminderSettings(supabase)
  return {
    giorniTolBolla: r.giorniTolBolla,
    giorniTolPromessa: r.giorniTolPromessa,
    giorniTolEstrattoMismatch: r.giorniTolEstrattoMismatch,
  }
}

/**
 * Fallback esplicito per soglie bolla/promessa documento se il DB non risponde:
 * {@link DEFAULT_SOLLECITI_TOLERANCE} → 5 gg bolle, 2 gg promesse.
 */
export function getSoglieSollecitiDocumentiFallback(): {
  giorniAttesaBolla: number
  giorniAttesaPromessa: number
} {
  return {
    giorniAttesaBolla: DEFAULT_SOLLECITI_TOLERANCE.giorniTolBolla,
    giorniAttesaPromessa: DEFAULT_SOLLECITI_TOLERANCE.giorniTolPromessa,
  }
}

/**
 * Legge da `configurazioni_app` (e legacy) i giorni di attesa per DDT e per promessa allegato.
 * Se il database non risponde → stessi valori di {@link getSoglieSollecitiDocumentiFallback}.
 */
export async function fetchSoglieSollecitiDocumenti(
  supabase: Pick<SupabaseClient, 'from'>,
): Promise<{ giorniAttesaBolla: number; giorniAttesaPromessa: number }> {
  const cfg = await fetchSollecitiToleranceConfig(supabase)
  return {
    giorniAttesaBolla: cfg.giorniTolBolla,
    giorniAttesaPromessa: cfg.giorniTolPromessa,
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
 * Confronta la data documento DDT con “oggi”: vero se sono passati almeno `soglia` giorni (UTC).
 * Non controlla lo stato bolla; per il filtro “in attesa” usa l’overload a oggetto.
 */
export function isBollaOverdue(
  bollaData: string | Date | null | undefined,
  soglia: number,
  now?: Date,
): boolean
/**
 * True se la bolla è ancora senza ciclo previsto (“in attesa”) e dalla data documento
 * sono trascorsi almeno `toleranceDays` (calendario UTC).
 */
export function isBollaOverdue(input: BollaOverdueInput): boolean
export function isBollaOverdue(
  bollaDataOrInput: string | Date | null | undefined | BollaOverdueInput,
  soglia?: number,
  now?: Date,
): boolean {
  if (typeof soglia === 'number') {
    const anchor = parseDateOnlyOrIso(bollaDataOrInput as string | Date | null | undefined)
    if (!anchor) return false
    return wholeDaysSinceUtc(anchor, now ?? new Date()) >= soglia
  }
  const input = bollaDataOrInput as BollaOverdueInput
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

function isPromisedDocOverdueCore(input: {
  metadata: Record<string, unknown> | null | undefined
  recordCreatedAt: string | Date | null | undefined
  toleranceDays: number
  documentResolved: boolean
  now?: Date
}): boolean {
  if (input.documentResolved) return false
  if (!metadataPromessaTrue(input.metadata ?? undefined)) return false
  const createdRaw = input.recordCreatedAt
  if (createdRaw == null) return false
  const created = typeof createdRaw === 'string' ? new Date(createdRaw) : createdRaw
  if (Number.isNaN(created.getTime())) return false
  return wholeDaysSinceUtc(created, input.now ?? new Date()) >= input.toleranceDays
}

function isPromisedDocFullInput(x: unknown): x is PromisedDocOverdueInput {
  if (x == null || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  return (
    'recordCreatedAt' in o &&
    'toleranceDays' in o &&
    'documentResolved' in o
  )
}

/**
 * Usa `promessa_invio_documento` nei metadata: vero se dalla data record (es. arrivo mail)
 * sono passati almeno `soglia` giorni senza che il documento sia considerato risolto.
 */
export function isPromisedDocOverdue(
  metadata: Record<string, unknown> | null | undefined,
  createdAt: string | Date | null | undefined,
  soglia: number,
  now?: Date,
): boolean
/**
 * True se `promessa_invio_documento` in metadata, record creato da almeno `toleranceDays`
 * e il “documento reale” non è ancora considerato ricevuto.
 */
export function isPromisedDocOverdue(input: PromisedDocOverdueInput): boolean
export function isPromisedDocOverdue(
  metaOrInput: Record<string, unknown> | null | undefined | PromisedDocOverdueInput,
  createdAt?: string | Date | null | undefined,
  soglia?: number,
  now?: Date,
): boolean {
  if (isPromisedDocFullInput(metaOrInput)) {
    return isPromisedDocOverdueCore(metaOrInput)
  }
  if (soglia === undefined) return false
  return isPromisedDocOverdueCore({
    metadata: metaOrInput as Record<string, unknown> | null | undefined,
    recordCreatedAt: createdAt ?? null,
    toleranceDays: soglia,
    documentResolved: false,
    now,
  })
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
