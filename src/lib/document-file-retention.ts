import type { SupabaseClient } from '@supabase/supabase-js'
import {
  FILE_ATTACHMENT_RETENTION_DEFAULT_RUN_DAY,
  FILE_ATTACHMENT_RETENTION_HOT_MONTHS,
} from '@/lib/file-retention-config'
import { parseSupabasePublicStorageUrl } from '@/lib/open-document-url'
import { DOCUMENTI_PENDING_FILTER_STATES } from '@/lib/documenti-queue-stato'

const BUCKET = 'documenti'
const STORAGE_BATCH = 100
const PAGE = 1000

const DOC_PROTECTED_STATI = new Set<string>(DOCUMENTI_PENDING_FILTER_STATES)

export type SedeRetentionRow = {
  id: string
  nome: string
  timezone: string | null
  file_retention_policy: string | null
  file_retention_run_day: number | null
}

export type PurgeFileRetentionOptions = {
  dryRun?: boolean
  force?: boolean
  sedeId?: string
}

export type PurgeFileRetentionResult = {
  sediProcessed: number
  sediSkipped: number
  recordsCleared: number
  storageObjectsRemoved: number
  bytesFreedEstimate: number
  errors: string[]
  bySede: Record<
    string,
    { nome: string; recordsCleared: number; storageRemoved: number; cutoff: string }
  >
}

function validTimezone(tz: string | null | undefined): string {
  const candidate = (tz ?? '').trim() || 'Europe/Rome'
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: candidate }).format(new Date())
    return candidate
  } catch {
    return 'Europe/Rome'
  }
}

/** Primo giorno del mese calendario che apre la finestra hot (inclusivo). */
export function getFileRetentionCutoffYmd(
  timezone: string,
  hotMonths: number = FILE_ATTACHMENT_RETENTION_HOT_MONTHS,
  now: Date = new Date(),
): string {
  const tz = validTimezone(timezone)
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now)
  let year = Number(parts.find((p) => p.type === 'year')?.value ?? 0)
  let month = Number(parts.find((p) => p.type === 'month')?.value ?? 1)
  const shift = Math.max(1, hotMonths) - 1
  month -= shift
  while (month <= 0) {
    month += 12
    year -= 1
  }
  return `${year}-${String(month).padStart(2, '0')}-01`
}

function zonedDayOfMonth(timezone: string, now: Date): number {
  const tz = validTimezone(timezone)
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    day: '2-digit',
  }).formatToParts(now)
  return Number(parts.find((p) => p.type === 'day')?.value ?? 1)
}

export function shouldRunRetentionForSede(
  sede: Pick<SedeRetentionRow, 'file_retention_run_day' | 'timezone'>,
  now: Date,
  opts: { force?: boolean },
): boolean {
  if (opts.force) return true
  const runDay = sede.file_retention_run_day ?? FILE_ATTACHMENT_RETENTION_DEFAULT_RUN_DAY
  return zonedDayOfMonth(sede.timezone ?? 'Europe/Rome', now) === runDay
}

function storagePathFromFileUrl(fileUrl: string): string | null {
  const parsed = parseSupabasePublicStorageUrl(fileUrl)
  if (!parsed || parsed.bucket !== BUCKET) return null
  return parsed.objectPath
}

type FileRef = {
  table: string
  id: string
  file_url: string
  docDate: string
  protected: boolean
}

async function fetchFileRefsForSede(
  service: SupabaseClient,
  sedeId: string,
  cutoff: string,
): Promise<FileRef[]> {
  const refs: FileRef[] = []

  const pushRows = (
    table: string,
    rows: { id: string; file_url: string | null; docDate: string | null; protected: boolean }[],
  ) => {
    for (const row of rows) {
      const url = row.file_url?.trim()
      const docDate = row.docDate?.trim()
      if (!url || !docDate) continue
      refs.push({
        table,
        id: row.id,
        file_url: url,
        docDate,
        protected: row.protected,
      })
    }
  }

  for (let from = 0; ; from += PAGE) {
    const { data, error } = await service
      .from('fatture')
      .select('id, file_url, data, approval_status')
      .eq('sede_id', sedeId)
      .not('file_url', 'is', null)
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`fatture: ${error.message}`)
    const chunk = data ?? []
    pushRows(
      'fatture',
      chunk.map((r) => ({
        id: r.id as string,
        file_url: r.file_url as string | null,
        docDate: r.data as string | null,
        protected: r.approval_status === 'pending',
      })),
    )
    if (chunk.length < PAGE) break
  }

  for (let from = 0; ; from += PAGE) {
    const { data, error } = await service
      .from('bolle')
      .select('id, file_url, data, stato')
      .eq('sede_id', sedeId)
      .not('file_url', 'is', null)
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`bolle: ${error.message}`)
    const chunk = data ?? []
    pushRows(
      'bolle',
      chunk.map((r) => ({
        id: r.id as string,
        file_url: r.file_url as string | null,
        docDate: r.data as string | null,
        protected: r.stato === 'in attesa',
      })),
    )
    if (chunk.length < PAGE) break
  }

  for (let from = 0; ; from += PAGE) {
    const { data, error } = await service
      .from('documenti_da_processare')
      .select('id, file_url, data_documento, stato')
      .eq('sede_id', sedeId)
      .not('file_url', 'is', null)
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`documenti_da_processare: ${error.message}`)
    const chunk = data ?? []
    pushRows(
      'documenti_da_processare',
      chunk.map((r) => ({
        id: r.id as string,
        file_url: r.file_url as string | null,
        docDate: r.data_documento as string | null,
        protected: DOC_PROTECTED_STATI.has(String(r.stato ?? '')),
      })),
    )
    if (chunk.length < PAGE) break
  }

  for (let from = 0; ; from += PAGE) {
    const { data, error } = await service
      .from('log_sincronizzazione')
      .select('id, file_url, data')
      .eq('sede_id', sedeId)
      .not('file_url', 'is', null)
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`log_sincronizzazione: ${error.message}`)
    const chunk = data ?? []
    pushRows(
      'log_sincronizzazione',
      chunk.map((r) => {
        const dataCol = r.data as string | null
        const docDate = dataCol?.slice(0, 10) ?? null
        return {
          id: r.id as string,
          file_url: r.file_url as string | null,
          docDate,
          protected: false,
        }
      }),
    )
    if (chunk.length < PAGE) break
  }

  for (let from = 0; ; from += PAGE) {
    const { data, error } = await service
      .from('conferme_ordine')
      .select('id, file_url, data_ordine, created_at')
      .eq('sede_id', sedeId)
      .not('file_url', 'is', null)
      .range(from, from + PAGE - 1)
    if (error) {
      if (error.code === '42P01') break
      throw new Error(`conferme_ordine: ${error.message}`)
    }
    const chunk = data ?? []
    pushRows(
      'conferme_ordine',
      chunk.map((r) => ({
        id: r.id as string,
        file_url: r.file_url as string | null,
        docDate: (r.data_ordine as string | null) ?? (r.created_at as string | null)?.slice(0, 10) ?? null,
        protected: false,
      })),
    )
    if (chunk.length < PAGE) break
  }

  for (let from = 0; ; from += PAGE) {
    const { data, error } = await service
      .from('statements')
      .select('id, file_url, document_date, created_at')
      .eq('sede_id', sedeId)
      .not('file_url', 'is', null)
      .range(from, from + PAGE - 1)
    if (error) {
      if (error.code === '42P01') break
      throw new Error(`statements: ${error.message}`)
    }
    const chunk = data ?? []
    pushRows(
      'statements',
      chunk.map((r) => ({
        id: r.id as string,
        file_url: r.file_url as string | null,
        docDate:
          (r.document_date as string | null) ??
          (r.created_at as string | null)?.slice(0, 10) ??
          null,
        protected: false,
      })),
    )
    if (chunk.length < PAGE) break
  }

  return refs
}

function isHot(docDate: string, cutoff: string): boolean {
  return docDate >= cutoff
}

async function clearFileUrlOnRow(
  service: SupabaseClient,
  table: string,
  id: string,
  dryRun: boolean,
): Promise<void> {
  if (dryRun) return
  const payload: Record<string, null | string> = { file_url: null }
  const { error } = await service.from(table).update(payload).eq('id', id)
  if (error) throw new Error(`${table} ${id}: ${error.message}`)
}

async function purgeSede(
  service: SupabaseClient,
  sede: SedeRetentionRow,
  opts: PurgeFileRetentionOptions,
): Promise<{ recordsCleared: number; storageRemoved: number; cutoff: string }> {
  const tz = validTimezone(sede.timezone)
  const cutoff = getFileRetentionCutoffYmd(tz)
  const dryRun = opts.dryRun === true

  const refs = await fetchFileRefsForSede(service, sede.id, cutoff)

  const urlsToKeep = new Set<string>()
  const coldRefs: FileRef[] = []

  for (const ref of refs) {
    if (ref.protected || isHot(ref.docDate, cutoff)) {
      urlsToKeep.add(ref.file_url)
    } else {
      coldRefs.push(ref)
    }
  }

  const pathsToDelete = new Set<string>()
  for (const ref of coldRefs) {
    if (urlsToKeep.has(ref.file_url)) continue
    const path = storagePathFromFileUrl(ref.file_url)
    if (path) pathsToDelete.add(path)
  }

  let storageRemoved = 0
  const pathList = [...pathsToDelete]
  if (!dryRun && pathList.length > 0) {
    for (let i = 0; i < pathList.length; i += STORAGE_BATCH) {
      const batch = pathList.slice(i, i + STORAGE_BATCH)
      const { error } = await service.storage.from(BUCKET).remove(batch)
      if (error) throw new Error(`storage remove: ${error.message}`)
      storageRemoved += batch.length
    }
  } else {
    storageRemoved = pathList.length
  }

  let recordsCleared = 0
  for (const ref of coldRefs) {
    if (urlsToKeep.has(ref.file_url)) continue
    await clearFileUrlOnRow(service, ref.table, ref.id, dryRun)
    recordsCleared++
  }

  return { recordsCleared, storageRemoved, cutoff }
}

export async function purgeColdDocumentFiles(
  service: SupabaseClient,
  opts: PurgeFileRetentionOptions = {},
): Promise<PurgeFileRetentionResult> {
  const now = new Date()
  const result: PurgeFileRetentionResult = {
    sediProcessed: 0,
    sediSkipped: 0,
    recordsCleared: 0,
    storageObjectsRemoved: 0,
    bytesFreedEstimate: 0,
    errors: [],
    bySede: {},
  }

  let query = service
    .from('sedi')
    .select('id, nome, timezone, file_retention_policy, file_retention_run_day')

  if (opts.sedeId?.trim()) {
    query = query.eq('id', opts.sedeId.trim())
  }

  const { data: sedi, error } = await query
  if (error) throw new Error(error.message)

  for (const row of sedi ?? []) {
    const sede = row as SedeRetentionRow
    const policy = sede.file_retention_policy ?? 'delete_only'
    if (policy === 'keep') {
      result.sediSkipped++
      continue
    }
    if (!shouldRunRetentionForSede(sede, now, { force: opts.force })) {
      result.sediSkipped++
      continue
    }

    try {
      const sedeResult = await purgeSede(service, sede, opts)
      result.sediProcessed++
      result.recordsCleared += sedeResult.recordsCleared
      result.storageObjectsRemoved += sedeResult.storageRemoved
      result.bySede[sede.id] = {
        nome: sede.nome,
        recordsCleared: sedeResult.recordsCleared,
        storageRemoved: sedeResult.storageRemoved,
        cutoff: sedeResult.cutoff,
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      result.errors.push(`${sede.nome} (${sede.id}): ${msg}`)
    }
  }

  return result
}

export function isDocumentAttachmentArchived(fileUrl: string | null | undefined): boolean {
  return !fileUrl?.trim()
}
