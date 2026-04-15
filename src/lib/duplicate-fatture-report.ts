import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeNumeroFattura } from '@/lib/fattura-duplicate-check'

const PAGE_SIZE = 1000
export const DUPLICATE_FATTURE_REPORT_MAX_ROWS = 50_000

export type DuplicateFatturaReportRow = {
  id: string
  fornitore_id: string
  sede_id: string | null
  data: string
  numero_fattura: string | null
  importo: number | null
  created_at: string
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
    created_at: String(r.created_at ?? ''),
    fornitore: fornitore?.nome != null ? { nome: String(fornitore.nome) } : null,
    sede: sede?.nome != null ? { nome: String(sede.nome) } : null,
  }
}

/**
 * Elenca gruppi di fatture duplicate visibili al client Supabase (RLS).
 * Stessa chiave dell’app: fornitore + data + numero normalizzato + sede.
 */
export async function fetchDuplicateFattureReport(supabase: SupabaseClient): Promise<{
  groups: DuplicateFatturaReportGroup[]
  scannedRows: number
  truncated: boolean
}> {
  const all: DuplicateFatturaReportRow[] = []
  let from = 0
  let truncated = false

  for (;;) {
    const to = from + PAGE_SIZE - 1
    const { data, error } = await supabase
      .from('fatture')
      .select(
        'id, fornitore_id, sede_id, data, numero_fattura, importo, created_at, fornitore:fornitori(nome), sede:sedi(nome)',
      )
      .order('created_at', { ascending: true })
      .range(from, to)

    if (error) throw new Error(error.message)

    const batch = (data ?? []).map((row) => embedFornitoreSede(row))
    if (batch.length === 0) break
    all.push(...batch)
    if (all.length >= DUPLICATE_FATTURE_REPORT_MAX_ROWS) {
      truncated = true
      break
    }
    if (batch.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  const withNum = all.filter((r) => normalizeNumeroFattura(r.numero_fattura))
  const map = new Map<string, DuplicateFatturaReportRow[]>()

  for (const r of withNum) {
    const nn = normalizeNumeroFattura(r.numero_fattura)!
    const key = `${r.sede_id ?? '\0'}|${r.fornitore_id}|${r.data}|${nn.toLowerCase()}`
    const arr = map.get(key)
    if (arr) arr.push(r)
    else map.set(key, [r])
  }

  const groups: DuplicateFatturaReportGroup[] = []
  for (const rows of map.values()) {
    if (rows.length < 2) continue
    rows.sort((a, b) => a.created_at.localeCompare(b.created_at))
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

  groups.sort((a, b) => b.fatture.length - a.fatture.length || b.data.localeCompare(a.data))

  return { groups, scannedRows: all.length, truncated }
}
