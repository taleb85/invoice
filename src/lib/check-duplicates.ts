import type { SupabaseClient } from '@supabase/supabase-js'
import { confermeFileUrlsInUse, deleteConfermaOrdineRow } from '@/lib/conferme-ordine-delete'
import {
  extractOrderReferenceFromFileName,
  extractOrderReferenceFromText,
} from '@/lib/extract-doc-type'
import { enrichOrdiniDupRowsFromDocumenti } from '@/lib/conferme-ordine-query'
import {
  bollaDuplicateGroupKey,
  fatturaDuplicateGroupKey,
  rowsLookLikeMultiDocInSamePdf,
} from '@/lib/duplicate-group-keys'
import { normalizeNumeroFattura } from '@/lib/fattura-duplicate-check'
import type { FiscalPgBounds } from '@/lib/fiscal-year-page'
import { logger } from '@/lib/logger'

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
export type FatturaDupListRow = FatturaDupProbe & { data: string; file_url?: string | null }

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
  importo?: number | null
}

/** Campi opzionali per euristiche globali (orfana+numero, stesso file_url). */
export type BollaDupListRow = BollaDupProbe & {
  file_url?: string | null
  sede_id?: string | null
  email_sync_auto_saved_at?: string | null
}

/** Conferme ordine: criterio `numero_ordine` (o titolo) + `fornitore_id` + `data_ordine`. */
export type OrdineDupListRow = {
  id: string
  fornitore_id: string
  data_ordine: string | null
  numero_ordine: string | null
  titolo: string | null
  created_at: string
  file_url?: string | null
  file_name?: string | null
  numero_fattura_doc?: string | null
  oggetto_mail?: string | null
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
  return fatturaDuplicateGroupKey({
    fornitore_id: r.fornitore_id,
    numero_fattura: r.numero_fattura,
    importo: r.importo,
  })
}

/** Stesso fornitore + data documento + importo (OCR numero diverso). */
function fatturaDupKeyBySupplierDateAmount(r: FatturaDupListRow): string | null {
  if (!r.fornitore_id) return null
  const d = (r.data ?? '').trim().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null
  const cents = importoCents(r.importo)
  if (cents == null) return null
  return `${r.fornitore_id}\u0000dateamt\u0000${d}\u0000${cents}`
}

function numeroMatchesFileUrl(numero: string | null | undefined, fileUrl: string | null | undefined): boolean {
  const n = normalizeNumeroFattura(numero)
  if (!n || !fileUrl?.trim()) return false
  return fileUrl.toLowerCase().includes(n.toLowerCase())
}

function bollaDupKey(r: BollaDupProbe): string | null {
  return bollaDuplicateGroupKey({
    fornitore_id: r.fornitore_id,
    data: r.data,
    numero_bolla: r.numero_bolla,
  })
}

/** Chiave duplicato bolla SENZA data: stesso fornitore + numero + importo (date diverse non bloccano). */
function bollaDupKeyNoDate(r: BollaDupProbe): string | null {
  const num = normalizeNumeroFattura(r.numero_bolla)
  if (!num || !r.fornitore_id) return null
  return `${r.fornitore_id}\0${num.toLowerCase()}\0${r.importo ?? ''}`
}

function looksLikeRekkiEmailMessageId(value: string): boolean {
  return /^\d{7,9}$/.test(value.trim())
}

/** Numero ordine per duplicati: evita titolo/metadata fattura (troppi falsi positivi). */
function ordineDupResolvedNumero(r: OrdineDupListRow): string | null {
  const col = r.numero_ordine?.trim()
  if (col) {
    const n = normalizeNumeroFattura(col)
    if (n && !looksLikeRekkiEmailMessageId(n)) return n
  }
  const fileRef = extractOrderReferenceFromFileName(r.file_name)
  if (fileRef) {
    const n = normalizeNumeroFattura(fileRef)
    if (n) return n
  }
  const textRef = extractOrderReferenceFromText(r.oggetto_mail, r.titolo)
  if (textRef && /[A-Z]{2,}/i.test(textRef)) {
    const n = normalizeNumeroFattura(textRef)
    if (n && !looksLikeRekkiEmailMessageId(n)) return n
  }
  return null
}

function ordineDupDocumentDate(r: OrdineDupListRow): string | null {
  const d = (r.data_ordine ?? '').trim().slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null
}

function ordineDupKey(r: OrdineDupListRow): string | null {
  const num = ordineDupResolvedNumero(r)
  if (!num || !r.fornitore_id) return null
  const d = ordineDupDocumentDate(r)
  if (!d) return null
  return `${r.fornitore_id}\u0000${d}\u0000${num.toLowerCase()}`
}

function ordineHasDocumentDate(r: OrdineDupListRow): boolean {
  return ordineDupDocumentDate(r) != null
}

function ordineRowsLookLikeMultiDocInSamePdf(arr: OrdineDupListRow[]): boolean {
  return rowsLookLikeMultiDocInSamePdf(
    arr.map((r) => ({
      file_url: r.file_url,
      documentDate: ordineDupDocumentDate(r),
      documentNumero: ordineDupResolvedNumero(r),
    })),
  )
}

/**
 * Stesso fornitore + numero ordine: una conferma senza `data_ordine` e una+ con data
 * (doppio passaggio scan). Esclude più date sullo stesso PDF (documenti distinti).
 */
function analyzeOrdineOrphanDateDuplicates(rows: OrdineDupListRow[]): FatturaDuplicateDeletionAnalysis {
  const byNumero = new Map<string, OrdineDupListRow[]>()
  for (const r of rows) {
    if (!r.fornitore_id) continue
    const num = ordineDupResolvedNumero(r)
    if (!num || !/^\d{4,}$/.test(num)) continue
    const k = `${r.fornitore_id}\u0000${num.toLowerCase()}`
    const arr = byNumero.get(k) ?? []
    arr.push(r)
    byNumero.set(k, arr)
  }

  let merged = emptyDuplicateDeletionAnalysis()
  for (const [bucketKey, arr] of byNumero) {
    const orphans = arr.filter((r) => !ordineHasDocumentDate(r))
    const withDate = arr.filter((r) => ordineHasDocumentDate(r))
    if (orphans.length !== 1 || withDate.length === 0) continue
    const dates = new Set(withDate.map((r) => r.data_ordine!.trim().slice(0, 10)))
    if (dates.size !== 1) continue
    if (ordineRowsLookLikeMultiDocInSamePdf(arr)) continue
    const slice = analyzeDuplicatesForDeletion(
      arr,
      () => `${bucketKey}\u0000orphan-date`,
      ordineCanonicalSort,
      false,
    )
    merged = mergeDuplicateAnalyses(merged, slice)
  }
  return merged
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

function mergeDuplicateAnalyses(
  primary: FatturaDuplicateDeletionAnalysis,
  secondary: FatturaDuplicateDeletionAnalysis,
): FatturaDuplicateDeletionAnalysis {
  const canonicalIds = new Set<string>([
    ...primary.canonicalIdByGroupKey.values(),
    ...secondary.canonicalIdByGroupKey.values(),
  ])
  const excessIds = new Set<string>()
  for (const id of [...primary.excessIds, ...secondary.excessIds]) {
    if (!canonicalIds.has(id)) excessIds.add(id)
  }
  return {
    memberIds: new Set([...primary.memberIds, ...secondary.memberIds]),
    excessIds,
    canonicalIdByGroupKey: new Map([...primary.canonicalIdByGroupKey, ...secondary.canonicalIdByGroupKey]),
    groupMembers: new Map([...primary.groupMembers, ...secondary.groupMembers]),
    surplusCount: excessIds.size,
    surplusImporto: primary.surplusImporto + secondary.surplusImporto,
  }
}

function fatturaDateAmountSortFn(a: FatturaDupListRow, b: FatturaDupListRow): number {
  const aMatch = numeroMatchesFileUrl(a.numero_fattura, a.file_url) ? 1 : 0
  const bMatch = numeroMatchesFileUrl(b.numero_fattura, b.file_url) ? 1 : 0
  if (aMatch !== bMatch) return bMatch - aMatch
  return fattureSortFn(a, b)
}

function analyzeFatturaSameFileUrlDuplicates(rows: FatturaDupListRow[]): FatturaDuplicateDeletionAnalysis {
  const byUrl = new Map<string, FatturaDupListRow[]>()
  for (const r of rows) {
    const u = r.file_url?.trim()
    if (!u) continue
    const arr = byUrl.get(u) ?? []
    arr.push(r)
    byUrl.set(u, arr)
  }

  let merged = emptyDuplicateDeletionAnalysis()
  for (const [url, arr] of byUrl) {
    if (arr.length <= 1) continue
    if (
      rowsLookLikeMultiDocInSamePdf(
        arr.map((r) => ({
          file_url: r.file_url,
          documentDate: r.data,
          documentNumero: r.numero_fattura,
          importo: r.importo,
        })),
      )
    ) {
      continue
    }
    const slice = analyzeDuplicatesForDeletion(
      arr,
      () => `fileurl\u0000${url}`,
      fatturaDateAmountSortFn,
      true,
      fatturaImporto,
    )
    merged = mergeDuplicateAnalyses(merged, slice)
  }
  return merged
}

/** Duplicati per stesso fornitore + numero + importo: mantiene la fattura con **data più vecchia**
 * (a parità di data, `id` lessicografico minore). Le altre righe sono `excessIds`.
 * Include anche stesso fornitore + data + importo (numeri OCR diversi). */
export function analyzeFatturaDuplicatesForDeletion(rows: FatturaDupListRow[]): FatturaDuplicateDeletionAnalysis {
  const byNumero = analyzeDuplicatesForDeletion(rows, fatturaDupKey, fattureSortFn, true, fatturaImporto)
  const byDateAmount = analyzeDuplicatesForDeletion(
    rows,
    fatturaDupKeyBySupplierDateAmount,
    fatturaDateAmountSortFn,
    true,
    fatturaImporto,
  )
  return mergeDuplicateAnalyses(byNumero, byDateAmount)
}

/**
 * Duplicati fatture con confidenza alta per cancellazione automatica:
 * - stesso fornitore + numero fattura + importo
 * - stesso `file_url` (stesso PDF registrato due volte)
 * Escluso il gruppo «stessa data + importo» con numeri OCR diversi (revisione manuale).
 */
export function analyzeHighConfidenceFatturaDuplicatesForDeletion(
  rows: FatturaDupListRow[],
): FatturaDuplicateDeletionAnalysis {
  const byNumero = analyzeDuplicatesForDeletion(rows, fatturaDupKey, fattureSortFn, true, fatturaImporto)
  const byFile = analyzeFatturaSameFileUrlDuplicates(rows)
  return mergeDuplicateAnalyses(byFile, byNumero)
}

export function fatturaExcessIdsForAutoDeletion(rows: FatturaDupListRow[]): string[] {
  return [...analyzeHighConfidenceFatturaDuplicatesForDeletion(rows).excessIds]
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

async function fetchFatturaDupListRows(
  supabase: SupabaseClient,
  fornitoreIds: string[] | null,
  fiscalBounds: FiscalPgBounds | null,
): Promise<FatturaDupListRow[]> {
  return fetchAllDupRows<FatturaDupListRow>(
    supabase,
    'fatture',
    'id, importo, numero_fattura, fornitore_id, data, file_url',
    'id',
    fornitoreIds,
    fiscalBounds,
    'data',
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

/** Canonical: auto-save email, poi riga con numero, poi più vecchia per data/id. */
function bollaCanonicalSort(a: BollaDupListRow, b: BollaDupListRow): number {
  const aAuto = a.email_sync_auto_saved_at ? 1 : 0
  const bAuto = b.email_sync_auto_saved_at ? 1 : 0
  if (aAuto !== bAuto) return bAuto - aAuto
  const aNum = normalizeNumeroFattura(a.numero_bolla) ? 1 : 0
  const bNum = normalizeNumeroFattura(b.numero_bolla) ? 1 : 0
  if (aNum !== bNum) return bNum - aNum
  return bolleSortFn(a, b)
}

function emptyDuplicateDeletionAnalysis(): FatturaDuplicateDeletionAnalysis {
  return {
    memberIds: new Set(),
    excessIds: new Set(),
    canonicalIdByGroupKey: new Map(),
    groupMembers: new Map(),
    surplusCount: 0,
    surplusImporto: 0,
  }
}

/**
 * Stesso fornitore + data + sede: una bolla senza numero e una o più con lo stesso numero
 * (doppio passaggio scan email) — allineato a `insertEmailAutoBolla`.
 */
function analyzeBolleOrphanNumeroDuplicates(rows: BollaDupListRow[]): FatturaDuplicateDeletionAnalysis {
  const byBucket = new Map<string, BollaDupListRow[]>()
  for (const r of rows) {
    if (!r.fornitore_id) continue
    const d = (r.data ?? '').trim().slice(0, 10)
    if (!d) continue
    const k = `${r.fornitore_id}\u0000${d}\u0000${r.sede_id ?? ''}`
    const arr = byBucket.get(k) ?? []
    arr.push(r)
    byBucket.set(k, arr)
  }

  let merged = emptyDuplicateDeletionAnalysis()
  for (const [bucketKey, arr] of byBucket) {
    const orphans = arr.filter((r) => !normalizeNumeroFattura(r.numero_bolla))
    const withNum = arr.filter((r) => normalizeNumeroFattura(r.numero_bolla))
    if (orphans.length !== 1 || withNum.length === 0) continue
    const byNum = new Map<string, BollaDupListRow[]>()
    for (const r of withNum) {
      const n = normalizeNumeroFattura(r.numero_bolla)!.toLowerCase()
      const g = byNum.get(n) ?? []
      g.push(r)
      byNum.set(n, g)
    }
    if (byNum.size !== 1) continue
    const slice = analyzeDuplicatesForDeletion(
      arr,
      () => `${bucketKey}\u0000orphan-numero`,
      bollaCanonicalSort,
      false,
    )
    merged = mergeDuplicateAnalyses(merged, slice)
  }
  return merged
}

/** Stesso `file_url` su più righe bolle — solo se stesso documento (esclude PDF multi-documento). */
function analyzeBolleSameFileUrlDuplicates(rows: BollaDupListRow[]): FatturaDuplicateDeletionAnalysis {
  const byUrl = new Map<string, BollaDupListRow[]>()
  for (const r of rows) {
    const u = r.file_url?.trim()
    if (!u) continue
    const arr = byUrl.get(u) ?? []
    arr.push(r)
    byUrl.set(u, arr)
  }

  let merged = emptyDuplicateDeletionAnalysis()
  for (const [url, arr] of byUrl) {
    if (arr.length <= 1) continue
    if (
      rowsLookLikeMultiDocInSamePdf(
        arr.map((r) => ({
          file_url: r.file_url,
          documentDate: r.data,
          documentNumero: r.numero_bolla,
        })),
      )
    ) {
      continue
    }
    const slice = analyzeDuplicatesForDeletion(
      arr,
      () => `fileurl\u0000${url}`,
      bollaCanonicalSort,
      false,
    )
    merged = mergeDuplicateAnalyses(merged, slice)
  }
  return merged
}

/**
 * Duplicati bolle (tutti i fornitori): stesso numero+data+fornitore, orfana+numero, stesso file_url.
 * Canonical: salvata da email sync, poi con numero, poi più vecchia.
 */
export function analyzeBolleDuplicatesForDeletion(
  rows: BollaDupListRow[],
): FatturaDuplicateDeletionAnalysis {
  const byNumero = analyzeDuplicatesForDeletion(rows, bollaDupKey, bollaCanonicalSort, false)
  const byNumeroNoDate = analyzeDuplicatesForDeletion(rows, bollaDupKeyNoDate, bollaCanonicalSort, false)
  const byOrphan = analyzeBolleOrphanNumeroDuplicates(rows)
  const byFile = analyzeBolleSameFileUrlDuplicates(rows)
  return mergeDuplicateAnalyses(mergeDuplicateAnalyses(byNumero, byOrphan), mergeDuplicateAnalyses(byNumeroNoDate, byFile))
}

/**
 * Bolle: tutti i criteri attuali sono ad alta confidenza (numero+data, orfana+numero, stesso PDF).
 */
export function analyzeHighConfidenceBolleDuplicatesForDeletion(
  rows: BollaDupListRow[],
): FatturaDuplicateDeletionAnalysis {
  return analyzeBolleDuplicatesForDeletion(rows)
}

export function bollaExcessIdsForAutoDeletion(rows: BollaDupListRow[]): string[] {
  return [...analyzeHighConfidenceBolleDuplicatesForDeletion(rows).excessIds]
}

/** Raggruppa per fornitore + numero bolla normalizzato (senza importo). */
export function analyzeBolleDuplicateGroups(rows: BollaDupProbe[]): DuplicateGroupAnalysis {
  return analyzeDuplicateGroups(rows, bollaDupKey, false)
}

async function fetchAllBolleDupRows(
  supabase: SupabaseClient,
  fornitoreIds: string[] | null,
  fiscalBounds: FiscalPgBounds | null,
): Promise<BollaDupListRow[]> {
  return fetchAllDupRows<BollaDupListRow>(
    supabase,
    'bolle',
    'id, numero_bolla, fornitore_id, data, file_url, sede_id, email_sync_auto_saved_at',
    'id',
    fornitoreIds,
    fiscalBounds,
    'data',
  )
}

export type CleanupDuplicateBolleResult = {
  scanned: number
  excessFound: number
  deleted: number
  excessIds: string[]
}

/**
 * Rimuove copie bolle in eccesso per tutta la sede o un solo fornitore.
 */
export async function cleanupDuplicateBolle(
  supabase: SupabaseClient,
  opts: {
    sedeId: string
    fornitoreId?: string | null
    fiscalBounds?: FiscalPgBounds | null
    dryRun?: boolean
  },
): Promise<CleanupDuplicateBolleResult> {
  const fornitoreIds = opts.fornitoreId ? [opts.fornitoreId] : null
  let q = supabase.from('bolle').select(
    'id, numero_bolla, fornitore_id, data, file_url, sede_id, email_sync_auto_saved_at',
  )
  q = q.eq('sede_id', opts.sedeId)
  if (fornitoreIds?.length) q = q.in('fornitore_id', fornitoreIds)
  if (opts.fiscalBounds) {
    q = q
      .gte('data', opts.fiscalBounds.dateFrom)
      .lt('data', opts.fiscalBounds.dateToExclusive)
  }

  const rows: BollaDupListRow[] = []
  for (let from = 0; from < DUPLICATE_SCAN_MAX_ROWS; from += PAGE_SIZE) {
    const { data, error } = await q.order('data', { ascending: false }).range(from, from + PAGE_SIZE - 1)
    if (error) break
    const chunk = (data ?? []) as BollaDupListRow[]
    rows.push(...chunk)
    if (chunk.length < PAGE_SIZE) break
  }

  const analysis = analyzeHighConfidenceBolleDuplicatesForDeletion(rows.slice(0, DUPLICATE_SCAN_MAX_ROWS))
  const excessIds = [...analysis.excessIds]
  const deleted =
    opts.dryRun || excessIds.length === 0
      ? 0
      : await autoDeleteExcessDuplicates(supabase, 'bolle', excessIds)

  return {
    scanned: rows.length,
    excessFound: excessIds.length,
    deleted,
    excessIds,
  }
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

/** Mantiene la copia più completa (data/numero) e la più vecchia. */
function ordineCanonicalSort(a: OrdineDupListRow, b: OrdineDupListRow): number {
  const aDate = (a.data_ordine ?? '').trim().length >= 10 ? 1 : 0
  const bDate = (b.data_ordine ?? '').trim().length >= 10 ? 1 : 0
  if (aDate !== bDate) return bDate - aDate
  const aNum = ordineDupResolvedNumero(a) ? 1 : 0
  const bNum = ordineDupResolvedNumero(b) ? 1 : 0
  if (aNum !== bNum) return bNum - aNum
  return ordiniSortFn(a, b)
}

/** Duplicati ordini (conferme): canonical = `created_at` più vecchio poi `id`. */
export function analyzeOrdineDuplicatesForDeletion(rows: OrdineDupListRow[]): FatturaDuplicateDeletionAnalysis {
  const byNumeroData = analyzeDuplicatesForDeletion(rows, ordineDupKey, ordineCanonicalSort, false)
  const byFile = analyzeOrdineSameFileUrlDuplicates(rows)
  const byOrphanDate = analyzeOrdineOrphanDateDuplicates(rows)
  return mergeDuplicateAnalyses(mergeDuplicateAnalyses(byNumeroData, byFile), byOrphanDate)
}

/**
 * Duplicati con confidenza alta per cancellazione automatica:
 * - stesso `file_url` (stesso PDF registrato due volte)
 * - stesso fornitore + numero ordine + data ordine
 * Esclusi i gruppi «solo numero» senza data allineata (revisione manuale).
 */
export function analyzeHighConfidenceOrdineDuplicatesForDeletion(
  rows: OrdineDupListRow[],
): FatturaDuplicateDeletionAnalysis {
  const byNumeroData = analyzeDuplicatesForDeletion(rows, ordineDupKey, ordineCanonicalSort, false)
  const byFile = analyzeOrdineSameFileUrlDuplicates(rows)
  return mergeDuplicateAnalyses(byFile, byNumeroData)
}

export function ordineExcessIdsForAutoDeletion(rows: OrdineDupListRow[]): string[] {
  return [...analyzeHighConfidenceOrdineDuplicatesForDeletion(rows).excessIds]
}

function analyzeOrdineSameFileUrlDuplicates(rows: OrdineDupListRow[]): FatturaDuplicateDeletionAnalysis {
  const byUrl = new Map<string, OrdineDupListRow[]>()
  for (const r of rows) {
    const u = r.file_url?.trim()
    if (!u) continue
    const arr = byUrl.get(u) ?? []
    arr.push(r)
    byUrl.set(u, arr)
  }
  let merged = emptyDuplicateDeletionAnalysis()
  for (const [url, arr] of byUrl) {
    if (arr.length <= 1) continue
    if (ordineRowsLookLikeMultiDocInSamePdf(arr)) continue
    const byDupKey = new Map<string, OrdineDupListRow[]>()
    for (const r of arr) {
      const k = ordineDupKey(r)
      if (!k) continue
      const bucket = byDupKey.get(k) ?? []
      bucket.push(r)
      byDupKey.set(k, bucket)
    }
    for (const keyed of byDupKey.values()) {
      if (keyed.length < 2) continue
      const slice = analyzeDuplicatesForDeletion(
        keyed,
        () => `fileurl\u0000${url}\u0000${ordineDupKey(keyed[0]!)}`,
        ordineCanonicalSort,
        false,
      )
      merged = mergeDuplicateAnalyses(merged, slice)
    }
  }
  return merged
}

const ORDINI_DUP_SELECT =
  'id, fornitore_id, data_ordine, numero_ordine, titolo, created_at, file_url, file_name'

async function fetchAllOrdiniDupRows(
  supabase: SupabaseClient,
  fornitoreIds: string[] | null,
  fiscalBounds: FiscalPgBounds | null,
): Promise<OrdineDupListRow[]> {
  const rows = await fetchAllDupRows<OrdineDupListRow>(
    supabase,
    'conferme_ordine',
    ORDINI_DUP_SELECT,
    'created_at',
    fornitoreIds,
    fiscalBounds,
    'created_at',
  )
  return enrichOrdiniDupRowsFromDocumenti(supabase, rows)
}

export type CleanupSafeDuplicatesSlice = {
  scanned: number
  excessFound: number
  deleted: number
  excessIds: string[]
}

export type CleanupSafeDuplicatesForFornitoreResult = {
  bolle: CleanupSafeDuplicatesSlice
  fatture: CleanupSafeDuplicatesSlice
  ordini: CleanupSafeDuplicatesSlice
}

/**
 * Rimuove duplicati ad alta confidenza (bolle, fatture, conferme ordine) per un fornitore.
 */
export async function cleanupSafeDuplicatesForFornitore(
  supabase: SupabaseClient,
  opts: {
    sedeId: string
    fornitoreId: string
    fiscalBounds?: FiscalPgBounds | null
    dryRun?: boolean
  },
): Promise<CleanupSafeDuplicatesForFornitoreResult> {
  const fornitoreIds = [opts.fornitoreId]
  const fiscal = opts.fiscalBounds ?? null

  const bolleSlice = await cleanupDuplicateBolle(supabase, {
    sedeId: opts.sedeId,
    fornitoreId: opts.fornitoreId,
    fiscalBounds: fiscal,
    dryRun: opts.dryRun,
  })

  const fattureRows = await fetchFatturaDupListRows(supabase, fornitoreIds, fiscal)
  const fattureExcess = fatturaExcessIdsForAutoDeletion(fattureRows)
  const fattureDeleted =
    opts.dryRun || fattureExcess.length === 0
      ? 0
      : await autoDeleteExcessDuplicates(supabase, 'fatture', fattureExcess)

  const ordiniRows = await fetchAllOrdiniDupRows(supabase, fornitoreIds, fiscal)
  const ordiniExcess = ordineExcessIdsForAutoDeletion(ordiniRows)
  let ordiniDeleted = 0
  if (!opts.dryRun && ordiniExcess.length > 0) {
    const deleteIds = new Set(ordiniExcess)
    const urlsStillUsed = confermeFileUrlsInUse(ordiniRows, deleteIds)
    for (const id of ordiniExcess) {
      const row = ordiniRows.find((r) => r.id === id)
      const { error } = await deleteConfermaOrdineRow(supabase, {
        id,
        fileUrl: row?.file_url,
        otherFileUrlsStillInUse: urlsStillUsed,
      })
      if (!error) ordiniDeleted++
    }
  }

  return {
    bolle: {
      scanned: bolleSlice.scanned,
      excessFound: bolleSlice.excessFound,
      deleted: bolleSlice.deleted,
      excessIds: bolleSlice.excessIds,
    },
    fatture: {
      scanned: fattureRows.length,
      excessFound: fattureExcess.length,
      deleted: fattureDeleted,
      excessIds: fattureExcess,
    },
    ordini: {
      scanned: ordiniRows.length,
      excessFound: ordiniExcess.length,
      deleted: ordiniDeleted,
      excessIds: ordiniExcess,
    },
  }
}

export async function fetchOrdiniDupListRows(
  supabase: SupabaseClient,
  opts: { fornitoreIds: string[] | null; fiscalBounds: FiscalPgBounds | null },
): Promise<OrdineDupListRow[]> {
  return fetchAllOrdiniDupRows(supabase, opts.fornitoreIds, opts.fiscalBounds)
}

export async function getDuplicateOrdiniCount(
  supabase: SupabaseClient,
  opts: { fornitoreIds: string[] | null; fiscalBounds: FiscalPgBounds | null },
): Promise<number> {
  const rows = await fetchOrdiniDupListRows(supabase, opts)
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
    logger.error(`[autoDeleteExcessDuplicates] Errore su ${table}:`, error.message)
    return 0
  }
  return excessIds.length
}
