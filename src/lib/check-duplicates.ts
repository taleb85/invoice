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

/**
 * Duplicati per stesso fornitore + numero + importo: mantiene la fattura con **data più vecchia**
 * (a parità di data, `id` lessicografico minore). Le altre righe sono `excessIds`.
 */
export function analyzeFatturaDuplicatesForDeletion(rows: FatturaDupListRow[]): FatturaDuplicateDeletionAnalysis {
  const byKey = new Map<string, FatturaDupListRow[]>()
  for (const r of rows) {
    const k = fatturaDupKey(r)
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
    arr.sort((a, b) => {
      if (a.data !== b.data) return a.data < b.data ? -1 : a.data > b.data ? 1 : 0
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
    })
    const canonId = arr[0]!.id
    canonicalIdByGroupKey.set(k, canonId)
    groupMembers.set(
      k,
      arr.map((x) => x.id),
    )
    const cents = importoCents(arr[0]!.importo)!
    surplusCount += arr.length - 1
    surplusImportoCents += (arr.length - 1) * cents
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
  /** Per ogni gruppo con >1 riga: (n − 1) copie in eccesso. */
  surplusCount: number
  /** Tutti gli id appartenenti a un gruppo con almeno 2 righe (per badge UI). */
  memberIds: Set<string>
  /** Importo da sottrarre alla somma grezza (stesso importo nel gruppo). */
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

/** Duplicati bolle: stessa data + fornitore + numero; canonical = data più vecchia poi `id`. */
export function analyzeBolleDuplicatesForDeletion(rows: BollaDupProbe[]): FatturaDuplicateDeletionAnalysis {
  const byKey = new Map<string, BollaDupProbe[]>()
  for (const r of rows) {
    const k = bollaDupKey(r)
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
  for (const [k, arr] of byKey) {
    if (arr.length <= 1) continue
    arr.sort((a, b) => {
      if (a.data !== b.data) return a.data < b.data ? -1 : a.data > b.data ? 1 : 0
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
    })
    const canonId = arr[0]!.id
    canonicalIdByGroupKey.set(k, canonId)
    groupMembers.set(
      k,
      arr.map((x) => x.id),
    )
    surplusCount += arr.length - 1
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
    surplusImporto: 0,
  }
}

/** Duplicati ordini (conferme): canonical = `created_at` più vecchio poi `id`. */
export function analyzeOrdineDuplicatesForDeletion(rows: OrdineDupListRow[]): FatturaDuplicateDeletionAnalysis {
  const byKey = new Map<string, OrdineDupListRow[]>()
  for (const r of rows) {
    const k = ordineDupKey(r)
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
  for (const [k, arr] of byKey) {
    if (arr.length <= 1) continue
    arr.sort((a, b) => {
      const ca = a.created_at
      const cb = b.created_at
      if (ca !== cb) return ca < cb ? -1 : ca > cb ? 1 : 0
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
    })
    const canonId = arr[0]!.id
    canonicalIdByGroupKey.set(k, canonId)
    groupMembers.set(
      k,
      arr.map((x) => x.id),
    )
    surplusCount += arr.length - 1
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
    surplusImporto: 0,
  }
}

/** Raggruppa per fornitore + numero fattura normalizzato + importo (centesimi). */
export function analyzeFatturaDuplicateGroups(rows: FatturaDupProbe[]): DuplicateGroupAnalysis {
  const groups = new Map<string, { ids: string[]; importoCents: number }>()
  for (const r of rows) {
    const k = fatturaDupKey(r)
    if (!k) continue
    const cents = importoCents(r.importo)!
    let g = groups.get(k)
    if (!g) {
      g = { ids: [], importoCents: cents }
      groups.set(k, g)
    }
    g.ids.push(r.id)
  }
  let surplusCount = 0
  let surplusImportoCents = 0
  const memberIds = new Set<string>()
  for (const g of groups.values()) {
    if (g.ids.length <= 1) continue
    surplusCount += g.ids.length - 1
    surplusImportoCents += (g.ids.length - 1) * g.importoCents
    for (const id of g.ids) memberIds.add(id)
  }
  return {
    surplusCount,
    memberIds,
    surplusImporto: surplusImportoCents / 100,
  }
}

/** Raggruppa per fornitore + numero bolla normalizzato (senza importo). */
export function analyzeBolleDuplicateGroups(rows: BollaDupProbe[]): DuplicateGroupAnalysis {
  const groups = new Map<string, string[]>()
  for (const r of rows) {
    const k = bollaDupKey(r)
    if (!k) continue
    const arr = groups.get(k) ?? []
    arr.push(r.id)
    groups.set(k, arr)
  }
  let surplusCount = 0
  const memberIds = new Set<string>()
  for (const ids of groups.values()) {
    if (ids.length <= 1) continue
    surplusCount += ids.length - 1
    for (const id of ids) memberIds.add(id)
  }
  return { surplusCount, memberIds, surplusImporto: 0 }
}

async function fetchAllFattureDupRows(
  supabase: SupabaseClient,
  fornitoreIds: string[] | null,
  fiscalBounds: FiscalPgBounds | null
): Promise<FatturaDupProbe[]> {
  const out: FatturaDupProbe[] = []
  for (let from = 0; from < DUPLICATE_SCAN_MAX_ROWS; from += PAGE_SIZE) {
    let q = supabase
      .from('fatture')
      .select('id, importo, numero_fattura, fornitore_id')
      .order('id', { ascending: false })
      .range(from, from + PAGE_SIZE - 1)
    if (fornitoreIds?.length) q = q.in('fornitore_id', fornitoreIds)
    if (fiscalBounds) {
      q = q.gte('data', fiscalBounds.dateFrom).lt('data', fiscalBounds.dateToExclusive)
    }
    const { data, error } = await q
    if (error) break
    const chunk = (data ?? []) as FatturaDupProbe[]
    out.push(...chunk)
    if (chunk.length < PAGE_SIZE) break
  }
  return out.slice(0, DUPLICATE_SCAN_MAX_ROWS)
}

async function fetchAllBolleDupRows(
  supabase: SupabaseClient,
  fornitoreIds: string[] | null,
  fiscalBounds: FiscalPgBounds | null
): Promise<BollaDupProbe[]> {
  const out: BollaDupProbe[] = []
  for (let from = 0; from < DUPLICATE_SCAN_MAX_ROWS; from += PAGE_SIZE) {
    let q = supabase
      .from('bolle')
      .select('id, numero_bolla, fornitore_id, data')
      .order('id', { ascending: false })
      .range(from, from + PAGE_SIZE - 1)
    if (fornitoreIds?.length) q = q.in('fornitore_id', fornitoreIds)
    if (fiscalBounds) {
      q = q.gte('data', fiscalBounds.dateFrom).lt('data', fiscalBounds.dateToExclusive)
    }
    const { data, error } = await q
    if (error) break
    const chunk = (data ?? []) as BollaDupProbe[]
    out.push(...chunk)
    if (chunk.length < PAGE_SIZE) break
  }
  return out.slice(0, DUPLICATE_SCAN_MAX_ROWS)
}

/**
 * Conteggio copie in eccesso: per ogni gruppo (stesso `numero_fattura` normalizzato, `fornitore_id`, stesso importo)
 * con almeno 2 fatture, si aggiunge (n − 1).
 */
export async function getDuplicateInvoicesCount(
  supabase: SupabaseClient,
  opts: { fornitoreIds: string[] | null; fiscalBounds: FiscalPgBounds | null }
): Promise<number> {
  const rows = await fetchAllFattureDupRows(supabase, opts.fornitoreIds, opts.fiscalBounds)
  return analyzeFatturaDuplicateGroups(rows).surplusCount
}

/** Stessa logica sulle bolle: `numero_bolla` + `fornitore_id`. */
export async function getDuplicateBolleCount(
  supabase: SupabaseClient,
  opts: { fornitoreIds: string[] | null; fiscalBounds: FiscalPgBounds | null }
): Promise<number> {
  const rows = await fetchAllBolleDupRows(supabase, opts.fornitoreIds, opts.fiscalBounds)
  return analyzeBolleDuplicatesForDeletion(rows).surplusCount
}

async function fetchAllOrdiniDupRows(
  supabase: SupabaseClient,
  fornitoreIds: string[] | null,
  fiscalBounds: FiscalPgBounds | null
): Promise<OrdineDupListRow[]> {
  const out: OrdineDupListRow[] = []
  for (let from = 0; from < DUPLICATE_SCAN_MAX_ROWS; from += PAGE_SIZE) {
    let q = supabase
      .from('conferme_ordine')
      .select('id, fornitore_id, data_ordine, numero_ordine, titolo, created_at')
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1)
    if (fornitoreIds?.length) q = q.in('fornitore_id', fornitoreIds)
    if (fiscalBounds) {
      q = q.gte('created_at', fiscalBounds.tsFrom).lt('created_at', fiscalBounds.tsToExclusive)
    }
    const { data, error } = await q
    if (error) break
    const chunk = (data ?? []) as OrdineDupListRow[]
    out.push(...chunk)
    if (chunk.length < PAGE_SIZE) break
  }
  return out.slice(0, DUPLICATE_SCAN_MAX_ROWS)
}

export async function getDuplicateOrdiniCount(
  supabase: SupabaseClient,
  opts: { fornitoreIds: string[] | null; fiscalBounds: FiscalPgBounds | null }
): Promise<number> {
  const rows = await fetchAllOrdiniDupRows(supabase, opts.fornitoreIds, opts.fiscalBounds)
  return analyzeOrdineDuplicatesForDeletion(rows).surplusCount
}
