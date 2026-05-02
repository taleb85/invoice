import type { SupabaseClient } from '@supabase/supabase-js'
import type { Sede } from '@/types'
import { PENDING_DOCUMENTI_STATI } from '@/lib/dashboard-notification-counts'
import { countOcrFailuresBySedeLast48h, sedeSyncUnhealthy } from '@/lib/dashboard-admin-sede-health'

const PAGE = 1000

function countBySedeId(rows: { sede_id: string | null }[]): Record<string, number> {
  const m: Record<string, number> = {}
  for (const r of rows) {
    const id = r.sede_id
    if (!id) continue
    m[id] = (m[id] ?? 0) + 1
  }
  return m
}

/** Tutte le righe `sede_id` (PostgREST limita ~1000 per richiesta senza range). */
async function fetchAllSedeIdRows(
  runPage: (from: number, to: number) => PromiseLike<{ data: { sede_id: string | null }[] | null }>
): Promise<{ sede_id: string | null }[]> {
  const out: { sede_id: string | null }[] = []
  let from = 0
  for (;;) {
    const { data } = await runPage(from, from + PAGE - 1)
    const chunk = data ?? []
    out.push(...chunk)
    if (chunk.length < PAGE) break
    from += PAGE
  }
  return out
}

export type SedeAdminOverviewRow = Sede & {
  fornitori: number
  bolleInAttesa: number
  /** Righe tabella `fatture` per sede */
  fatture: number
  /** Documenti in coda (stati pendenti) per sede */
  documentiInCoda: number
  ocrFailures48h: number
  syncUnhealthy: boolean
}

/**
 * Panoramica admin: prima era 4×N query (una sede alla volta).
 * Qui sono 2 + 4 round-trip totali (sedi + OCR map, poi quattro select leggeri su sede_id).
 */
export async function fetchAdminDashboardSediWithStats(
  supabase: SupabaseClient
): Promise<SedeAdminOverviewRow[]> {
  const [{ data: sedi }, ocrMap] = await Promise.all([
    supabase.from('sedi').select('*').order('nome'),
    countOcrFailuresBySedeLast48h(supabase),
  ])

  const list = (sedi ?? []) as Sede[]
  if (list.length === 0) return []

  const ids = list.map((s) => s.id)

  const [fornitoriRows, bolleRows, fattureRows, docRows] = await Promise.all([
    fetchAllSedeIdRows((from, to) =>
      supabase.from('fornitori').select('sede_id').in('sede_id', ids).range(from, to)
    ),
    fetchAllSedeIdRows((from, to) =>
      supabase
        .from('bolle')
        .select('sede_id')
        .in('sede_id', ids)
        .eq('stato', 'in attesa')
        .range(from, to)
    ),
    fetchAllSedeIdRows((from, to) =>
      supabase.from('fatture').select('sede_id').in('sede_id', ids).range(from, to)
    ),
    fetchAllSedeIdRows((from, to) =>
      supabase
        .from('documenti_da_processare')
        .select('sede_id')
        .in('sede_id', ids)
        .in('stato', [...PENDING_DOCUMENTI_STATI])
        .range(from, to)
    ),
  ])

  const fornitoriMap = countBySedeId(fornitoriRows)
  const bolleMap = countBySedeId(bolleRows)
  const fattureMap = countBySedeId(fattureRows)
  const docMap = countBySedeId(docRows)

  return list.map((sede) => {
    const ext = sede as Sede & { last_imap_sync_error?: string | null }
    const ocrN = ocrMap[sede.id] ?? 0
    const docN = docMap[sede.id] ?? 0
    const fatN = fattureMap[sede.id] ?? 0
    return {
      ...sede,
      fornitori: fornitoriMap[sede.id] ?? 0,
      bolleInAttesa: bolleMap[sede.id] ?? 0,
      fatture: fatN,
      documentiInCoda: docN,
      ocrFailures48h: ocrN,
      syncUnhealthy: sedeSyncUnhealthy(ext.last_imap_sync_error, ocrN),
    }
  })
}

const LOG_ERROR_STATI = ['fornitore_non_trovato', 'bolla_non_trovata'] as const

function since24hIso(): string {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
}

async function countSyncLogErrorsBySede24h(
  supabase: SupabaseClient,
  sedeIds: string[]
): Promise<Record<string, number>> {
  if (sedeIds.length === 0) return {}
  const { data } = await supabase
    .from('log_sincronizzazione')
    .select('sede_id')
    .in('stato', [...LOG_ERROR_STATI])
    .gte('data', since24hIso())
    .in('sede_id', sedeIds)
  return countBySedeId(data ?? [])
}

export type SedeAdminGlobalOverviewRow = Pick<Sede, 'id' | 'nome' | 'country_code' | 'imap_host' | 'imap_user'> & {
  /** Ultimo errore IMAP persistito su `sedi` (se presente). */
  hasLastImapSyncError: boolean
  ocrFailures48h: number
  syncLogErrors24h: number
}

/** Evento mostrato nella console globale (solo contesto tecnico, niente importi commerci). */
export type AdminGlobalConsoleEvent = {
  id: string
  occurredAt: string
  sedeId: string | null
  sedeNome: string
  channel: 'imap' | 'sync'
  statoKey: string
  detail: string
  allegatoNome: string | null
}

const CONSOLE_LOG_SINCE_H = 72
const CONSOLE_LOG_ROWS_CAP = 120
const CONSOLE_EVENTS_MAX = 100

/**
 * Dati portale master: sedi con stato tecnico + feed console (log + IMAP).
 * Oggi una “azienda” nel deploy = filiale (`sedi`); in futuro si può filtrare per `organization_id`.
 */
export async function fetchAdminGlobalPortalBundle(supabase: SupabaseClient): Promise<{
  sediHealth: SedeAdminGlobalOverviewRow[]
  consoleEvents: AdminGlobalConsoleEvent[]
}> {
  const sinceIso = new Date(Date.now() - CONSOLE_LOG_SINCE_H * 60 * 60 * 1000).toISOString()

  const [{ data: sediRows }, ocrMap, { data: logRows }] = await Promise.all([
    supabase
      .from('sedi')
      .select('id, nome, country_code, imap_host, imap_user, last_imap_sync_error, last_imap_sync_at')
      .order('nome'),
    countOcrFailuresBySedeLast48h(supabase),
    supabase
      .from('log_sincronizzazione')
      .select('id, data, sede_id, stato, errore_dettaglio, allegato_nome')
      .in('stato', [...LOG_ERROR_STATI])
      .gte('data', sinceIso)
      .order('data', { ascending: false })
      .limit(CONSOLE_LOG_ROWS_CAP),
  ])

  const list = (sediRows ?? []) as (Pick<Sede, 'id' | 'nome' | 'country_code' | 'imap_host' | 'imap_user'> & {
    last_imap_sync_error?: string | null
    last_imap_sync_at?: string | null
  })[]
  if (list.length === 0) return { sediHealth: [], consoleEvents: [] }

  const ids = list.map((s) => s.id)
  const errMap = await countSyncLogErrorsBySede24h(supabase, ids)

  const sediHealth: SedeAdminGlobalOverviewRow[] = list.map((sede) => {
    const lastErr = sede.last_imap_sync_error
    return {
      id: sede.id,
      nome: sede.nome,
      country_code: sede.country_code,
      imap_host: sede.imap_host,
      imap_user: sede.imap_user,
      hasLastImapSyncError: !!(typeof lastErr === 'string' && lastErr.trim() !== ''),
      ocrFailures48h: ocrMap[sede.id] ?? 0,
      syncLogErrors24h: errMap[sede.id] ?? 0,
    }
  })

  const nameById: Record<string, string> = Object.fromEntries(list.map((s) => [s.id, s.nome]))

  const consoleEvents: AdminGlobalConsoleEvent[] = []

  for (const s of list) {
    const err = typeof s.last_imap_sync_error === 'string' ? s.last_imap_sync_error.trim() : ''
    if (err) {
      const at =
        typeof s.last_imap_sync_at === 'string' && s.last_imap_sync_at.trim() !== ''
          ? s.last_imap_sync_at.trim()
          : '1970-01-01T00:00:00.000Z'
      consoleEvents.push({
        id: `imap:${s.id}`,
        occurredAt: at,
        sedeId: s.id,
        sedeNome: s.nome,
        channel: 'imap',
        statoKey: 'imap_error',
        detail: err.slice(0, 400),
        allegatoNome: null,
      })
    }
  }

  for (const row of logRows ?? []) {
    const sid = (row.sede_id as string | null) ?? null
    consoleEvents.push({
      id: String(row.id),
      occurredAt: String(row.data),
      sedeId: sid,
      sedeNome: sid && nameById[sid] ? nameById[sid] : '—',
      channel: 'sync',
      statoKey: String(row.stato ?? ''),
      detail: String(row.errore_dettaglio ?? '').slice(0, 400),
      allegatoNome: (row.allegato_nome as string | null) ?? null,
    })
  }

  consoleEvents.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
  return { sediHealth, consoleEvents: consoleEvents.slice(0, CONSOLE_EVENTS_MAX) }
}

/**
 * Panoramica portale master: sedi + solo indicatori tecnici (IMAP, log sync, OCR).
 * Nessun conteggio fornitori/bolle/fatture.
 */
export async function fetchSediHealthOverviewForAdminGlobalPortal(
  supabase: SupabaseClient,
): Promise<SedeAdminGlobalOverviewRow[]> {
  return (await fetchAdminGlobalPortalBundle(supabase)).sediHealth
}
