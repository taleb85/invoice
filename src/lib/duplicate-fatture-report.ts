import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeNumeroFattura } from '@/lib/fattura-duplicate-check'

const PAGE_SIZE = 1000
export const DUPLICATE_FATTURE_REPORT_MAX_ROWS = 50_000

/** Evita di monopolizzare l’event loop (dev server / un solo worker) durante scan lunghi. */
function yieldEventLoop(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

function checkAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw new DOMException('Operazione annullata', 'AbortError')
  }
}

export type DuplicateFatturaReportRow = {
  id: string
  fornitore_id: string
  sede_id: string | null
  data: string
  numero_fattura: string | null
  importo: number | null
  fornitore: { nome: string } | null
  sede: { nome: string } | null
}

export type DuplicateFatturaReportGroup = {
  sede_id: string | null
  sede_nome: string | null
  fornitore_id: string
  fornitore_nome: string | null
  data: string
  numero_normalizzato: string
  fatture: DuplicateFatturaReportRow[]
}

/** Anteprima durante lo scan (streaming): ultimo lotto letto da DB. */
export type DuplicateFatturaScanProgressItem = {
  id: string
  data: string
  numero_fattura: string | null
  fornitore_nome: string | null
  /** Nome file da `file_url` (path/segmento), se presente. */
  file_label: string | null
}

function fileLabelFromUrl(url: string | null | undefined): string | null {
  if (url == null) return null
  const s = String(url).trim()
  if (!s) return null
  try {
    const decoded = decodeURIComponent(s)
    const noQuery = decoded.split('?')[0] ?? decoded
    const parts = noQuery.split('/').filter(Boolean)
    const last = parts[parts.length - 1]
    if (last && last.length <= 160) return last
    return decoded.length > 72 ? `${decoded.slice(0, 72)}…` : decoded
  } catch {
    return s.length > 72 ? `${s.slice(0, 72)}…` : s
  }
}

function embedFornitoreSede(row: unknown): DuplicateFatturaReportRow {
  const r = row as Record<string, unknown>
  const fornitoreRaw = r.fornitore
  const sedeRaw = r.sede
  const fornitore =
    fornitoreRaw && typeof fornitoreRaw === 'object' && !Array.isArray(fornitoreRaw)
      ? (fornitoreRaw as { nome?: string })
      : null
  const sede =
    sedeRaw && typeof sedeRaw === 'object' && !Array.isArray(sedeRaw)
      ? (sedeRaw as { nome?: string })
      : null
  return {
    id: String(r.id ?? ''),
    fornitore_id: String(r.fornitore_id ?? ''),
    sede_id: (r.sede_id as string | null) ?? null,
    data: String(r.data ?? ''),
    numero_fattura: (r.numero_fattura as string | null) ?? null,
    importo: r.importo != null ? Number(r.importo) : null,
    fornitore: fornitore?.nome != null ? { nome: String(fornitore.nome) } : null,
    sede: sede?.nome != null ? { nome: String(sede.nome) } : null,
  }
}

/** Nessun `updated_at`/`created_at`: su DB legacy spesso assenti; `data`+`id` danno paginazione stabile. */
const FATTURE_SELECT =
  'id, fornitore_id, sede_id, data, numero_fattura, importo, file_url, fornitore:fornitori(nome), sede:sedi(nome)'

export type DuplicateFattureReportResult = {
  groups: DuplicateFatturaReportGroup[]
  scannedRows: number
  truncated: boolean
}

/**
 * Elenca gruppi di fatture duplicate visibili al client Supabase (RLS).
 * `onProgress` viene chiamato dopo ogni batch (ultime ~12 righe del lotto come anteprima).
 */
export async function runDuplicateFattureReport(
  supabase: SupabaseClient,
  onProgress?: (p: { scannedSoFar: number; sample: DuplicateFatturaScanProgressItem[] }) => void,
  signal?: AbortSignal,
): Promise<DuplicateFattureReportResult> {
  const all: DuplicateFatturaReportRow[] = []
  let from = 0
  let truncated = false

  for (;;) {
    checkAborted(signal)
    const to = from + PAGE_SIZE - 1
    const { data, error } = await supabase
      .from('fatture')
      .select(FATTURE_SELECT)
      .order('data', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to)

    if (error) throw new Error(error.message)

    const rawBatch = data ?? []
    const batch = rawBatch.map((row) => embedFornitoreSede(row))
    if (batch.length === 0) break
    all.push(...batch)

    if (onProgress && rawBatch.length > 0) {
      const slice = rawBatch.slice(-12)
      const sample: DuplicateFatturaScanProgressItem[] = slice.map((raw) => {
        const emb = embedFornitoreSede(raw)
        const fr = raw as Record<string, unknown>
        return {
          id: emb.id,
          data: emb.data,
          numero_fattura: emb.numero_fattura,
          fornitore_nome: emb.fornitore?.nome ?? null,
          file_label: fileLabelFromUrl(fr.file_url as string | null | undefined),
        }
      })
      onProgress({ scannedSoFar: all.length, sample })
    }

    await yieldEventLoop()

    if (all.length >= DUPLICATE_FATTURE_REPORT_MAX_ROWS) {
      truncated = true
      break
    }
    if (batch.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  checkAborted(signal)
  const withNum = all.filter((r) => normalizeNumeroFattura(r.numero_fattura))
  const map = new Map<string, DuplicateFatturaReportRow[]>()

  let idx = 0
  for (const r of withNum) {
    idx++
    if (idx % 4000 === 0) {
      checkAborted(signal)
      await yieldEventLoop()
    }
    const nn = normalizeNumeroFattura(r.numero_fattura)!
    const key = `${r.sede_id ?? '\0'}|${r.fornitore_id}|${r.data}|${nn.toLowerCase()}`
    const arr = map.get(key)
    if (arr) arr.push(r)
    else map.set(key, [r])
  }

  checkAborted(signal)
  const groups: DuplicateFatturaReportGroup[] = []
  let gidx = 0
  for (const rows of map.values()) {
    gidx++
    if (gidx % 2000 === 0) {
      checkAborted(signal)
      await yieldEventLoop()
    }
    if (rows.length < 2) continue
    rows.sort((a, b) => a.data.localeCompare(b.data) || a.id.localeCompare(b.id))
    const first = rows[0]!
    groups.push({
      sede_id: first.sede_id,
      sede_nome: first.sede?.nome ?? null,
      fornitore_id: first.fornitore_id,
      fornitore_nome: first.fornitore?.nome ?? null,
      data: first.data,
      numero_normalizzato: normalizeNumeroFattura(first.numero_fattura)!,
      fatture: rows,
    })
  }

  await yieldEventLoop()
  groups.sort((a, b) => b.fatture.length - a.fatture.length || b.data.localeCompare(a.data))

  return { groups, scannedRows: all.length, truncated }
}

export async function fetchDuplicateFattureReport(supabase: SupabaseClient): Promise<DuplicateFattureReportResult> {
  return runDuplicateFattureReport(supabase, undefined, undefined)
}
