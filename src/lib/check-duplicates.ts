import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeNumeroFattura } from '@/lib/fattura-duplicate-check'
import type { FiscalPgBounds } from '@/lib/fiscal-year-page'

/** Allineato al report duplicati: non oltre questo campione per KPI / totali. */
export const DUPLICATE_SCAN_MAX_ROWS = 50_000

const PAGE_SIZE = 2_000

export type FatturaDupProbe = {
  id: string
  numero_fattura: string | null
  fornitore_id: string
  importo: number | null
}

/** Riga fattura con data documento per scegliere quale copia tenere (più vecchia = originale). */
export type FatturaDupListRow = FatturaDupProbe & { data: string }

export type FatturaDuplicateDeletionAnalysis = {
  memberIds: Set<string>
  excessIds: Set<string>
  canonicalIdByGroupKey: Map<string, string>
  groupMembers: Map<string, string[]>
  surplusCount: number
  surplusImporto: number
}

/** JSON-safe payload per componenti client (liste fatture). */
export type FatturaDuplicateDeletionPayload = {
  excessIds: string[]
  memberIds: string[]
  canonicalIdByGroup: Record<string, string>
  groupMembers: Record<string, string[]>
}

export function serializeFatturaDuplicateDeletionPayload(
  a: FatturaDuplicateDeletionAnalysis,
): FatturaDuplicateDeletionPayload {
  const canonicalIdByGroup: Record<string, string> = {}
  for (const [k, id] of a.canonicalIdByGroupKey) canonicalIdByGroup[k] = id
  const groupMembers: Record<string, string[]> = {}
  for (const [k, ids] of a.groupMembers) groupMembers[k] = ids
  return {
    excessIds: [...a.excessIds],
    memberIds: [...a.memberIds],
    canonicalIdByGroup,
    groupMembers,
  }
}

/** `data` = data documento bolla (YYYY-MM-DD), inclusa nel criterio duplicato. */
export type BollaDupProbe = {
  id: string
  numero_bolla: string | null
  fornitore_id: string
  data: string
}

/** Conferme ordine: criterio `numero_ordine` (o titolo) + `fornitore_id` + `data_ordine`. */
export type OrdineDupListRow = {
  id: string
  fornitore_id: string
  data_ordine: string | null
  numero_ordine: string | null
  titolo: string | null
  created_at: string
}

export type DuplicateGroupAnalysis = {
  surplusCount: number
  memberIds: Set<string>
  surplusImporto: number
}

function importoCents(v: number | null | undefined): number | null {
  if (v == null) return null
  const n = Number(v)
  if (!Number.isFinite(n)) return null
  return Math.round(n * 100)
}

function fatturaDupKey(r: FatturaDupProbe): string | null {
  const num = normalizeNumeroFattura(r.numero_fattura)
  if (!num || !r.fornitore_id) return null
  const cents = importoCents(r.importo)
  if (cents == null) return null
  return `${r.fornitore_id}\u0000${cents}\u0000${num.toLowerCase()}`
}

function bollaDupKey(r: BollaDupProbe): string | null {
  const num = normalizeNumeroFattura(r.numero_bolla)
  if (!num || !r.fornitore_id) return null
  const d = (r.data ?? '').trim().slice(0, 10)
  if (!d) return null
  return `${r.fornitore_id}\u0000${d}\u0000${num.toLowerCase()}`
}

function ordineDupKey(r: OrdineDupListRow): string | null {
  const num = normalizeNumeroFattura(r.numero_ordine ?? r.titolo ?? null)
  if (!num || !r.fornitore_id) return null
  const d = (r.data_ordine ?? '').trim().slice(0, 10)
  if (!d) return null
  return `${r.fornitore_id}\u0000${d}\u0000${num.toLowerCase()}`
}

// ── Helpers generici ──────────────────────────────────────────

type DupRowLike = { id: string }

/**
 * Fetch paginato con range per una tabella duplicati.
 */
async function fetchAllDupRows<T extends DupRowLike>(
  supabase: SupabaseClient,
  table: string,
  select: string,
  orderColumn: string,
  fornitoreIds: string[] | null,
  fiscalBounds: FiscalPgBounds | null,
  fiscalColumn: 'data' | 'created_at',
): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; from < DUPLICATE_SCAN_MAX_ROWS; from += PAGE_SIZE) {
    let q = supabase
      .from(table)
      .select(select)
      .order(orderColumn, { ascending: false })
      .range(from, from + PAGE_SIZE - 1)
    if (fornitoreIds?.length) q = q.in('fornitore_id', fornitoreIds)
    if (fiscalBounds) {
      const [fromKey, toKey] = fiscalColumn === 'created_at'
        ? ['tsFrom' as const, 'tsToExclusive' as const]
        : ['dateFrom' as const, 'dateToExclusive' as const]
      q = q.gte(fiscalColumn, fiscalBounds[fromKey]).lt(fiscalColumn, fiscalBounds[toKey])
    }
    const { data, error } = await q
    if (error) break
    const chunk = (data ?? []) as unknown as T[]
    out.push(...chunk)
    if (chunk.length < PAGE_SIZE) break
  }
  return out.slice(0, DUPLICATE_SCAN_MAX_ROWS)
}

type CompareFn<T> = (a: T, b: T) => number

/**
 * Analisi generica duplicati per cancellazione: raggruppa per chiave, ordina,
 * calcola canonical (primo) e excess (restanti).
 */
function analyzeDuplicatesForDeletion<T extends { id: string }>(
  rows: T[],
  getKey: (r: T) => string | null,
  sortFn: CompareFn<T>,
  withImporto: boolean,
  getImporto?: (r: T) => number | null,
): FatturaDuplicateDeletionAnalysis {
  const byKey = new Map<string, T[]>()
  for (const r of rows) {
    const k = getKey(r)
    if (!k) continue
    const arr = byKey.get(k) ?? []
    arr.push(r)
    byKey.set(k, arr)
  }
  const memberIds = new Set<string>()
  const excessIds = new Set<string>()
  const canonicalIdByGroupKey = new Map<string, string>()
  const groupMembers = new Map<string, string[]>()
  let surplusCount = 0
  let surplusImportoCents = 0
  for (const [k, arr] of byKey) {
    if (arr.length <= 1) continue
    arr.sort(sortFn)
    const canonId = arr[0]!.id
    canonicalIdByGroupKey.set(k, canonId)
    groupMembers.set(k, arr.map((x) => x.id))
    surplusCount += arr.length - 1
    if (withImporto && getImporto) {
      const cents = importoCents(getImporto(arr[0]!))
      if (cents != null) surplusImportoCents += (arr.length - 1) * cents
    }
    for (const row of arr) {
      memberIds.add(row.id)
      if (row.id !== canonId) excessIds.add(row.id)
    }
  }
  return {
    memberIds,
    excessIds,
    canonicalIdByGroupKey,
    groupMembers,
    surplusCount,
    surplusImporto: surplusImportoCents / 100,
  }
}

/**
 * Analisi gruppi duplicati (senza canonical): raggruppa per chiave e conta surplus.
 */
function analyzeDuplicateGroups<T extends { id: string }>(
  rows: T[],
  getKey: (r: T) => string | null,
  withImporto: boolean,
  getImporto?: (r: T) => number | null,
): DuplicateGroupAnalysis {
  const groups = new Map<string, string[]>()
  const importoByKey = new Map<string, number>()
  for (const r of rows) {
    const k = getKey(r)
    if (!k) continue
    const arr = groups.get(k) ?? []
    arr.push(r.id)
    groups.set(k, arr)
    if (withImporto && getImporto) {
      const cents = importoCents(getImporto(r))
      if (cents != null) importoByKey.set(k, cents)
    }
  }
  let surplusCount = 0
  let surplusImportoCents = 0
  const memberIds = new Set<string>()
  for (const [k, ids] of groups) {
    if (ids.length <= 1) continue
    surplusCount += ids.length - 1
    if (withImporto) {
      const cents = importoByKey.get(k)
      if (cents != null) surplusImportoCents += (ids.length - 1) * cents
    }
    for (const id of ids) memberIds.add(id)
  }
  return { surplusCount, memberIds, surplusImporto: surplusImportoCents / 100 }
}

const byDataThenId: CompareFn<{ id: string; data: string }> = (a, b) => {
  if (a.data !== b.data) return a.data < b.data ? -1 : a.data > b.data ? 1 : 0
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

const byCreatedAtThenId: CompareFn<{ id: string; created_at: string }> = (a, b) => {
  if (a.created_at !== b.created_at) return a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

// ── Fatture ───────────────────────────────────────────────────

function fattureSortFn(a: FatturaDupListRow, b: FatturaDupListRow): number {
  return byDataThenId(a, b)
}

function fatturaImporto(r: FatturaDupProbe): number | null {
  return r.importo
}

/** Duplicati per stesso fornitore + numero + importo: mantiene la fattura con **data più vecchia**
 * (a parità di data, `id` lessicografico minore). Le altre righe sono `excessIds`. */
export function analyzeFatturaDuplicatesForDeletion(rows: FatturaDupListRow[]): FatturaDuplicateDeletionAnalysis {
  return analyzeDuplicatesForDeletion(rows, fatturaDupKey, fattureSortFn, true, fatturaImporto)
}

/** Raggruppa per fornitore + numero fattura normalizzato + importo (centesimi). */
export function analyzeFatturaDuplicateGroups(rows: FatturaDupProbe[]): DuplicateGroupAnalysis {
  return analyzeDuplicateGroups(rows, fatturaDupKey, true, fatturaImporto)
}

async function fetchAllFattureDupRows(
  supabase: SupabaseClient,
  fornitoreIds: string[] | null,
  fiscalBounds: FiscalPgBounds | null,
): Promise<FatturaDupProbe[]> {
  return fetchAllDupRows<FatturaDupProbe>(
    supabase, 'fatture', 'id, importo, numero_fattura, fornitore_id', 'id',
    fornitoreIds, fiscalBounds, 'data',
  )
}

export async function getDuplicateInvoicesCount(
  supabase: SupabaseClient,
  opts: { fornitoreIds: string[] | null; fiscalBounds: FiscalPgBounds | null },
): Promise<number> {
  const rows = await fetchAllFattureDupRows(supabase, opts.fornitoreIds, opts.fiscalBounds)
  return analyzeFatturaDuplicateGroups(rows).surplusCount
}

// ── Bolle ─────────────────────────────────────────────────────

function bolleSortFn(a: BollaDupProbe, b: BollaDupProbe): number {
  return byDataThenId(a as { id: string; data: string }, b as { id: string; data: string })
}

/** Duplicati bolle: stessa data + fornitore + numero; canonical = data più vecchia poi `id`. */
export function analyzeBolleDuplicatesForDeletion(rows: BollaDupProbe[]): FatturaDuplicateDeletionAnalysis {
  return analyzeDuplicatesForDeletion(rows, bollaDupKey, bolleSortFn, false)
}

/** Raggruppa per fornitore + numero bolla normalizzato (senza importo). */
export function analyzeBolleDuplicateGroups(rows: BollaDupProbe[]): DuplicateGroupAnalysis {
  return analyzeDuplicateGroups(rows, bollaDupKey, false)
}

async function fetchAllBolleDupRows(
  supabase: SupabaseClient,
  fornitoreIds: string[] | null,
  fiscalBounds: FiscalPgBounds | null,
): Promise<BollaDupProbe[]> {
  return fetchAllDupRows<BollaDupProbe>(
    supabase, 'bolle', 'id, numero_bolla, fornitore_id, data', 'id',
    fornitoreIds, fiscalBounds, 'data',
  )
}

export async function getDuplicateBolleCount(
  supabase: SupabaseClient,
  opts: { fornitoreIds: string[] | null; fiscalBounds: FiscalPgBounds | null },
): Promise<number> {
  const rows = await fetchAllBolleDupRows(supabase, opts.fornitoreIds, opts.fiscalBounds)
  return analyzeBolleDuplicatesForDeletion(rows).surplusCount
}

// ── Ordini (conferme) ─────────────────────────────────────────

function ordiniSortFn(a: OrdineDupListRow, b: OrdineDupListRow): number {
  return byCreatedAtThenId(a, b)
}

/** Duplicati ordini (conferme): canonical = `created_at` più vecchio poi `id`. */
export function analyzeOrdineDuplicatesForDeletion(rows: OrdineDupListRow[]): FatturaDuplicateDeletionAnalysis {
  return analyzeDuplicatesForDeletion(rows, ordineDupKey, ordiniSortFn, false)
}

async function fetchAllOrdiniDupRows(
  supabase: SupabaseClient,
  fornitoreIds: string[] | null,
  fiscalBounds: FiscalPgBounds | null,
): Promise<OrdineDupListRow[]> {
  return fetchAllDupRows<OrdineDupListRow>(
    supabase, 'conferme_ordine', 'id, fornitore_id, data_ordine, numero_ordine, titolo, created_at', 'created_at',
    fornitoreIds, fiscalBounds, 'created_at',
  )
}

export async function getDuplicateOrdiniCount(
  supabase: SupabaseClient,
  opts: { fornitoreIds: string[] | null; fiscalBounds: FiscalPgBounds | null },
): Promise<number> {
  const rows = await fetchAllOrdiniDupRows(supabase, opts.fornitoreIds, opts.fiscalBounds)
  return analyzeOrdineDuplicatesForDeletion(rows).surplusCount
}

/**
 * Elimina automaticamente i record duplicati in eccesso (copie extra).
 * Usa service-role bypass RLS. Ritorna il numero di eliminazioni.
 */
export async function autoDeleteExcessDuplicates(
  supabase: SupabaseClient,
  table: 'bolle' | 'fatture' | 'conferme_ordine',
  excessIds: string[],
): Promise<number> {
  if (!excessIds.length) return 0
  const { error } = await supabase.from(table).delete().in('id', excessIds)
  if (error) {
    console.error(`[autoDeleteExcessDuplicates] Errore su ${table}:`, error.message)
    return 0
  }
  return excessIds.length
}
